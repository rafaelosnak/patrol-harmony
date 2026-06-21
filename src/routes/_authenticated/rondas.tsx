import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Footprints, MapPin, Pencil, Play, Plus, Square, Trash2, Truck } from "lucide-react";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { EmptyState, PageHeader, Pill } from "@/components/pg/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/rondas")({
  head: () => ({ meta: [{ title: "Rondas — PhytonGuard" }] }),
  component: RoundsPage,
});

type RoundRow = {
  id: string;
  user_id: string;
  unit_id: string | null;
  vehicle_id: string | null;
  started_at: string;
  finished_at: string | null;
  status: string;
  checkpoints_done: number;
  checkpoints_total: number;
};

type Checkpoint = {
  id: string;
  round_id: string;
  user_id: string;
  label: string | null;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  notes: string | null;
  photo_url: string | null;
  checkpoint_location_id: string | null;
  created_at: string;
};

type CheckpointLocation = {
  id: string;
  name: string;
  description: string | null;
  unit_id: string | null;
  lat: number | null;
  lng: number | null;
  active: boolean;
};

function getPosition(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  });
}

function RoundsPage() {
  const { t } = useI18n();
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const [openRound, setOpenRound] = useState<RoundRow | null>(null);
  const [openLocations, setOpenLocations] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [startVehicleId, setStartVehicleId] = useState<string>("");
  const isStaff = hasRole("admin") || hasRole("supervisor");

  const { data: rounds, isLoading } = useQuery({
    queryKey: ["rounds"],
    queryFn: async (): Promise<RoundRow[]> => {
      const { data, error } = await supabase
        .from("rounds")
        .select("id,user_id,unit_id,vehicle_id,started_at,finished_at,status,checkpoints_done,checkpoints_total")
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as RoundRow[];
    },
  });

  const userIds = Array.from(new Set((rounds ?? []).map((r) => r.user_id)));
  const { data: names } = useQuery({
    queryKey: ["round-user-names", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles").select("id,full_name").in("id", userIds);
      const map: Record<string, string> = {};
      (data ?? []).forEach((p) => { map[p.id] = p.full_name ?? "—"; });
      return map;
    },
  });

  const { data: vehicles } = useQuery({
    queryKey: ["vehicles-active"],
    queryFn: async () => {
      const { data } = await supabase.from("vehicles").select("id,plate,model").order("plate");
      return (data ?? []) as { id: string; plate: string; model: string | null }[];
    },
  });
  const vehicleMap: Record<string, string> = {};
  (vehicles ?? []).forEach((v) => { vehicleMap[v.id] = `${v.plate}${v.model ? ` — ${v.model}` : ""}`; });

  const start = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await supabase.from("rounds").insert({
        user_id: user.id, checkpoints_total: 6, checkpoints_done: 0,
        vehicle_id: startVehicleId || null,
      }).select().single();
      if (error) throw error;
      return data as RoundRow;
    },
    onSuccess: (row) => {
      toast.success("Ronda iniciada");
      qc.invalidateQueries({ queryKey: ["rounds"] });
      setStartOpen(false);
      setStartVehicleId("");
      setOpenRound(row);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao iniciar ronda"),
  });

  const finish = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rounds").update({
        finished_at: new Date().toISOString(), status: "completed",
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ronda finalizada");
      qc.invalidateQueries({ queryKey: ["rounds"] });
      setOpenRound(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("round_checkpoints").delete().eq("round_id", id);
      const { error } = await supabase.from("rounds").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ronda excluída");
      qc.invalidateQueries({ queryKey: ["rounds"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao excluir"),
  });

  return (
    <div className="space-y-4">
      <PageHeader title={t("rounds.title")} subtitle={t("rounds.subtitle")} actions={
        <div className="flex gap-2">
          {isStaff && (
            <Button variant="outline" onClick={() => setOpenLocations(true)}>
              <MapPin className="h-4 w-4" /> Pontos cadastrados
            </Button>
          )}
          <Button onClick={() => setStartOpen(true)}>
            <Play className="h-4 w-4" /> {t("rounds.new")}
          </Button>
        </div>
      } />

      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground bg-card/40">
            <tr>
              <th className="text-left px-4 py-3">{t("common.name")}</th>
              <th className="text-left px-4 py-3">{t("common.start")}</th>
              <th className="text-left px-4 py-3">Viatura</th>
              <th className="text-left px-4 py-3">{t("rounds.checkpoints")}</th>
              <th className="text-left px-4 py-3">{t("common.status")}</th>
              <th className="text-right px-4 py-3">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">{t("common.loading")}</td></tr>}
            {!isLoading && (rounds ?? []).length === 0 && (
              <tr><td colSpan={6}><EmptyState icon={Footprints} title={t("common.empty")} /></td></tr>
            )}
            {(rounds ?? []).map((r) => {
              const inProg = r.status === "in_progress";
              return (
                <tr key={r.id} className="hover:bg-accent/30">
                  <td className="px-4 py-3 font-medium">{names?.[r.user_id] ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(r.started_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs">{r.vehicle_id ? (vehicleMap[r.vehicle_id] ?? "—") : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.checkpoints_done}/{r.checkpoints_total}</td>
                  <td className="px-4 py-3">
                    <Pill tone={inProg ? "warn" : r.status === "completed" ? "success" : "default"}>
                      {inProg ? t("rounds.inprogress") : r.status === "completed" ? t("rounds.completed") : r.status}
                    </Pill>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => setOpenRound(r)}>
                      <MapPin className="h-3 w-3" /> Pontos
                    </Button>
                    {inProg && (
                      <Button size="sm" variant="outline" onClick={() => finish.mutate(r.id)}>
                        <Square className="h-3 w-3" /> {t("rounds.finish")}
                      </Button>
                    )}
                    {hasRole("admin") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { if (confirm("Excluir esta ronda e todos os pontos?")) remove.mutate(r.id); }}
                        title="Excluir ronda"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Iniciar nova ronda</DialogTitle>
            <DialogDescription>Selecione a viatura que você usará nesta ronda.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Select value={startVehicleId} onValueChange={setStartVehicleId}>
              <SelectTrigger>
                <SelectValue placeholder="Viatura (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {(vehicles ?? []).map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    <span className="inline-flex items-center gap-2"><Truck className="h-3 w-3" /> {v.plate}{v.model ? ` — ${v.model}` : ""}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStartOpen(false)}>Cancelar</Button>
            <Button onClick={() => start.mutate()} disabled={start.isPending}>
              <Play className="h-4 w-4" /> Iniciar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CheckpointsDialog
        round={openRound}
        onClose={() => setOpenRound(null)}
        currentUserId={user?.id}
        canEditLabel={true}
      />

      <LocationsDialog open={openLocations} onClose={() => setOpenLocations(false)} canEdit={isStaff} />
    </div>
  );
}

function CheckpointsDialog({
  round, onClose, currentUserId, canEditLabel,
}: { round: RoundRow | null; onClose: () => void; currentUserId?: string; canEditLabel?: boolean }) {
  const qc = useQueryClient();
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [locationId, setLocationId] = useState<string>("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: locations } = useQuery({
    queryKey: ["checkpoint-locations-active"],
    queryFn: async (): Promise<CheckpointLocation[]> => {
      const { data, error } = await supabase
        .from("checkpoint_locations").select("*").eq("active", true).order("name");
      if (error) throw error;
      return (data ?? []) as CheckpointLocation[];
    },
  });

  const { data: checkpoints, isLoading } = useQuery({
    queryKey: ["round-checkpoints", round?.id],
    enabled: !!round,
    queryFn: async (): Promise<Checkpoint[]> => {
      const { data, error } = await supabase
        .from("round_checkpoints")
        .select("*")
        .eq("round_id", round!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Checkpoint[];
    },
  });

  const register = useMutation({
    mutationFn: async () => {
      if (!round || !currentUserId) throw new Error("Sem ronda ou usuário");
      const pos = await getPosition();

      let photo_url: string | null = null;
      if (photoFile) {
        const ext = photoFile.name.split(".").pop() || "jpg";
        const path = `${currentUserId}/${round.id}/${Date.now()}.${ext}`;
        const up = await supabase.storage.from("round-photos").upload(path, photoFile, {
          contentType: photoFile.type, upsert: false,
        });
        if (up.error) throw up.error;
        photo_url = path;
      }

      const chosen = locations?.find((l) => l.id === locationId);
      const { error } = await supabase.from("round_checkpoints").insert({
        round_id: round.id,
        user_id: currentUserId,
        label: chosen?.name ?? (label.trim() || null),
        notes: notes.trim() || null,
        lat: pos?.coords.latitude ?? chosen?.lat ?? null,
        lng: pos?.coords.longitude ?? chosen?.lng ?? null,
        accuracy: pos?.coords.accuracy ?? null,
        photo_url,
        checkpoint_location_id: locationId || null,
      });
      if (error) throw error;
      return pos !== null;
    },
    onSuccess: (hadGps) => {
      toast.success(hadGps ? "Ponto registrado com localização" : "Ponto registrado");
      setLabel(""); setNotes(""); setLocationId(""); setPhotoFile(null);
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["round-checkpoints", round?.id] });
      qc.invalidateQueries({ queryKey: ["rounds"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao registrar ponto"),
  });

  const canRegister = round?.status === "in_progress" && round.user_id === currentUserId;

  return (
    <Dialog open={!!round} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pontos da ronda</DialogTitle>
          <DialogDescription>
            {round && `Iniciada ${new Date(round.started_at).toLocaleString()} • ${round.checkpoints_done}/${round.checkpoints_total}`}
          </DialogDescription>
        </DialogHeader>

        {canRegister && (
          <div className="space-y-2 rounded-lg border border-border/60 p-3">
            {locations && locations.length > 0 && (
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar ponto cadastrado (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {!locationId && (
              <Input placeholder="Identificação do ponto (ex.: Portão A)" value={label} onChange={(e) => setLabel(e.target.value)} />
            )}
            <Input placeholder="Observação (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="flex items-center gap-2">
              <Input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                className="flex-1"
              />
              <Camera className="h-4 w-4 text-muted-foreground" />
            </div>
            {photoFile && (
              <p className="text-xs text-muted-foreground">📷 {photoFile.name}</p>
            )}
            <Button className="w-full" onClick={() => register.mutate()} disabled={register.isPending}>
              <MapPin className="h-4 w-4" /> Registrar ponto agora
            </Button>
          </div>
        )}

        <div className="max-h-72 overflow-auto space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!isLoading && (checkpoints ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum ponto registrado ainda.</p>
          )}
          {(checkpoints ?? []).map((c, i) => (
            <CheckpointItem key={c.id} idx={i} c={c} canEdit={!!canEditLabel} roundId={round?.id} />
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CheckpointItem({ idx, c, canEdit, roundId }: { idx: number; c: Checkpoint; canEdit?: boolean; roundId?: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.label ?? "");

  const { data: photoUrl } = useQuery({
    queryKey: ["round-photo", c.photo_url],
    enabled: !!c.photo_url,
    queryFn: async () => {
      const { data } = await supabase.storage.from("round-photos").createSignedUrl(c.photo_url!, 3600);
      return data?.signedUrl ?? null;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("round_checkpoints")
        .update({ label: draft.trim() || null })
        .eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ponto atualizado");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["round-checkpoints", roundId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <div className="rounded-lg border border-border/60 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        {editing ? (
          <div className="flex-1 flex gap-1">
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} className="h-7 text-sm" />
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(c.label ?? ""); }}>×</Button>
          </div>
        ) : (
          <>
            <span className="font-medium">#{idx + 1} {c.label ?? "Ponto"}</span>
            <div className="flex items-center gap-2">
              {canEdit && (
                <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-foreground">
                  <Pencil className="h-3 w-3" />
                </button>
              )}
              <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleTimeString()}</span>
            </div>
          </>
        )}
      </div>
      {c.notes && <p className="text-muted-foreground text-xs mt-1">{c.notes}</p>}
      {c.lat != null && c.lng != null ? (
        <a
          href={`https://www.google.com/maps?q=${c.lat},${c.lng}`}
          target="_blank" rel="noreferrer"
          className="text-xs text-primary inline-flex items-center gap-1 mt-1"
        >
          <MapPin className="h-3 w-3" /> {c.lat.toFixed(5)}, {c.lng.toFixed(5)}
          {c.accuracy != null && ` (±${Math.round(c.accuracy)}m)`}
        </a>
      ) : (
        <span className="text-xs text-muted-foreground">Sem localização</span>
      )}
      {photoUrl && (
        <a href={photoUrl} target="_blank" rel="noreferrer" className="block mt-2">
          <img src={photoUrl} alt="Foto do ponto" className="rounded-md max-h-40 object-cover border border-border/60" />
        </a>
      )}
    </div>
  );
}

function LocationsDialog({
  open, onClose, canEdit,
}: { open: boolean; onClose: () => void; canEdit: boolean }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unitId, setUnitId] = useState<string>("");

  const { data: items, isLoading } = useQuery({
    queryKey: ["checkpoint-locations-all"],
    enabled: open,
    queryFn: async (): Promise<CheckpointLocation[]> => {
      const { data, error } = await supabase
        .from("checkpoint_locations").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CheckpointLocation[];
    },
  });

  const { data: units } = useQuery({
    queryKey: ["units-min"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("units").select("id,name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Informe o nome do ponto");
      const pos = await getPosition();
      const { error } = await supabase.from("checkpoint_locations").insert({
        name: name.trim(),
        description: description.trim() || null,
        unit_id: unitId || null,
        lat: pos?.coords.latitude ?? null,
        lng: pos?.coords.longitude ?? null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ponto cadastrado");
      setName(""); setDescription(""); setUnitId("");
      qc.invalidateQueries({ queryKey: ["checkpoint-locations-all"] });
      qc.invalidateQueries({ queryKey: ["checkpoint-locations-active"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("checkpoint_locations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["checkpoint-locations-all"] });
      qc.invalidateQueries({ queryKey: ["checkpoint-locations-active"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pontos de ronda cadastrados</DialogTitle>
          <DialogDescription>
            Locais pré-definidos (ex.: "Praça em frente ao CDD") que aparecem para o vigia escolher.
          </DialogDescription>
        </DialogHeader>

        {canEdit && (
          <div className="space-y-2 rounded-lg border border-border/60 p-3">
            <Input placeholder="Nome do ponto (ex.: Praça em frente ao CDD)" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Descrição (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} />
            {units && units.length > 0 && (
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger>
                  <SelectValue placeholder="Unidade (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button className="w-full" onClick={() => create.mutate()} disabled={create.isPending}>
              <Plus className="h-4 w-4" /> Adicionar ponto (usa GPS atual)
            </Button>
          </div>
        )}

        <div className="max-h-72 overflow-auto space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!isLoading && (items ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum ponto cadastrado.</p>
          )}
          {(items ?? []).map((l) => (
            <div key={l.id} className="rounded-lg border border-border/60 p-3 text-sm flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="font-medium">{l.name}</p>
                {l.description && <p className="text-xs text-muted-foreground">{l.description}</p>}
                {l.lat != null && l.lng != null && (
                  <a
                    href={`https://www.google.com/maps?q=${l.lat},${l.lng}`}
                    target="_blank" rel="noreferrer"
                    className="text-xs text-primary inline-flex items-center gap-1 mt-1"
                  >
                    <MapPin className="h-3 w-3" /> {l.lat.toFixed(5)}, {l.lng.toFixed(5)}
                  </a>
                )}
              </div>
              {canEdit && (
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(l.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
