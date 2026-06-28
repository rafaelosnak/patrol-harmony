import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Footprints, MapPin, Pencil, Play, Plus, Route as RouteIcon, Square, Trash2, Truck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/rondas")({
  head: () => ({ meta: [{ title: "Rondas — PhytonGuard" }] }),
  component: RoundsPage,
});

type TrackPoint = { lat: number; lng: number; t: number; acc?: number };

type RoundRow = {
  id: string;
  user_id: string;
  client_id: string | null;
  vehicle_id: string | null;
  started_at: string;
  finished_at: string | null;
  status: string;
  checkpoints_done: number;
  checkpoints_total: number;
  notes: string | null;
  track: TrackPoint[] | null;
  mode?: string | null;
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
  client_id: string | null;
  lat: number | null;
  lng: number | null;
  radius_meters: number;
  active: boolean;
};

function distMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dx = (b.lat - a.lat) * 111000;
  const dy = (b.lng - a.lng) * 111000 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dx * dx + dy * dy);
}

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
  const { user, hasRole, companyId } = useAuth();
  const qc = useQueryClient();
  const [openRound, setOpenRound] = useState<RoundRow | null>(null);
  const [openLocations, setOpenLocations] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [startVehicleId, setStartVehicleId] = useState<string>("");
  const [startClientId, setStartClientId] = useState<string>("");
  const [startMode, setStartMode] = useState<"auto" | "checkpoints" | "track">("auto");
  const [trackRound, setTrackRound] = useState<RoundRow | null>(null);
  const isStaff = hasRole("admin") || hasRole("supervisor");

  const { data: rounds, isLoading } = useQuery({
    queryKey: ["rounds"],
    queryFn: async (): Promise<RoundRow[]> => {
      const { data, error } = await supabase
        .from("rounds")
        .select("id,user_id,client_id,vehicle_id,started_at,finished_at,status,checkpoints_done,checkpoints_total,notes,track")
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as RoundRow[];
    },
  });

  // GPS tracking for active rounds owned by the current user.
  useEffect(() => {
    if (!user) return;
    const mine = (rounds ?? []).find((r) => r.user_id === user.id && r.status === "in_progress");
    if (!mine) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const point: TrackPoint = {
          lat: pos.coords.latitude, lng: pos.coords.longitude,
          t: Date.now(), acc: pos.coords.accuracy,
        };
        const { data: cur } = await supabase.from("rounds").select("track").eq("id", mine.id).maybeSingle();
        const prev = (cur?.track as unknown as TrackPoint[] | null) ?? [];
        const last = prev[prev.length - 1];
        if (last) {
          const dt = point.t - last.t;
          const dx = (point.lat - last.lat) * 111000;
          const dy = (point.lng - last.lng) * 111000 * Math.cos((point.lat * Math.PI) / 180);
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dt < 10000 || dist < 8) return;
        }
        await supabase.from("rounds").update({ track: [...prev, point] as unknown as never }).eq("id", mine.id);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [user, rounds]);

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

  const roundIds = (rounds ?? []).map((r) => r.id);
  const { data: roundLabels } = useQuery({
    queryKey: ["round-labels", roundIds.join(",")],
    enabled: roundIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("round_checkpoints")
        .select("round_id,label,created_at")
        .in("round_id", roundIds)
        .order("created_at", { ascending: true });
      const map: Record<string, string[]> = {};
      (data ?? []).forEach((c) => {
        const arr = map[c.round_id as string] ?? (map[c.round_id as string] = []);
        arr.push((c.label as string | null) ?? "Ponto");
      });
      return map;
    },
  });


  const { data: clientsList } = useQuery({
    queryKey: ["clients-min-rounds"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id,name,default_round_mode").order("name");
      return (data ?? []) as { id: string; name: string; default_round_mode: string | null }[];
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

  const selectedClient = (clientsList ?? []).find((c) => c.id === startClientId);
  const effectiveMode: "checkpoints" | "track" =
    startMode === "auto"
      ? ((selectedClient?.default_round_mode as "checkpoints" | "track" | null) ?? "checkpoints")
      : startMode;

  const start = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      if (!startClientId) throw new Error("Selecione o cliente");
      let total = 0;
      if (effectiveMode === "checkpoints") {
        const { count } = await supabase
          .from("checkpoint_locations")
          .select("id", { count: "exact", head: true })
          .eq("active", true)
          .eq("client_id", startClientId);
        total = count ?? 0;
        if (total === 0) throw new Error("Cliente não tem pontos cadastrados. Peça ao admin para cadastrar pontos.");
      }
      const { data, error } = await supabase.from("rounds").insert({
        user_id: user.id,
        checkpoints_total: total,
        checkpoints_done: 0,
        vehicle_id: startVehicleId || null,
        client_id: startClientId,
        mode: effectiveMode,
        company_id: companyId!,
      }).select().single();
      if (error) throw error;
      return data as RoundRow;
    },
    onSuccess: (row) => {
      toast.success(row.mode === "track" ? "Ronda iniciada — gravando trajeto por GPS" : "Ronda iniciada — registre os pontos");
      qc.invalidateQueries({ queryKey: ["rounds"] });
      setStartOpen(false);
      setStartVehicleId(""); setStartClientId(""); setStartMode("auto");
      if (row.mode === "checkpoints") setOpenRound(row);
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
                  <td className="px-4 py-3 font-mono text-xs">
                    <div>{r.checkpoints_done}/{r.checkpoints_total}</div>
                    {(roundLabels?.[r.id]?.length ?? 0) > 0 && (
                      <div className="font-sans text-[11px] text-muted-foreground mt-1 max-w-[280px] truncate" title={roundLabels![r.id].join(" • ")}>
                        {roundLabels![r.id].join(" • ")}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Pill tone={inProg ? "warn" : r.status === "completed" ? "success" : "default"}>
                      {inProg ? t("rounds.inprogress") : r.status === "completed" ? t("rounds.completed") : r.status}
                    </Pill>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => setOpenRound(r)}>
                      <MapPin className="h-3 w-3" /> Pontos
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setTrackRound(r)} title="Ver trajeto GPS">
                      <RouteIcon className="h-3 w-3" /> Trajeto{(r.track?.length ?? 0) > 0 ? ` (${r.track!.length})` : ""}
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
            <DialogDescription>
              Escolha o cliente. O modo de registro foi definido pelo admin no cadastro do cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Cliente</Label>
              <Select value={startClientId} onValueChange={setStartClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {(clientsList ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedClient && (
              <div className="rounded-md border border-border/60 p-2 text-xs text-muted-foreground">
                Modo: <span className="font-medium text-foreground">
                  {(selectedClient.default_round_mode ?? "checkpoints") === "track"
                    ? "Gravação de trajeto por GPS"
                    : "Registrar ponto a ponto (pontos cadastrados pelo admin)"}
                </span>
              </div>
            )}

            <div>
              <Label>Viatura (opcional)</Label>
              <Select value={startVehicleId} onValueChange={setStartVehicleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma viatura" />
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStartOpen(false)}>Cancelar</Button>
            <Button onClick={() => start.mutate()} disabled={start.isPending || !startClientId}>
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

      <TrackDialog round={trackRound} onClose={() => setTrackRound(null)} userName={trackRound ? (names?.[trackRound.user_id] ?? "—") : ""} />
    </div>
  );
}

function CheckpointsDialog({
  round, onClose, currentUserId, canEditLabel,
}: { round: RoundRow | null; onClose: () => void; currentUserId?: string; canEditLabel?: boolean }) {
  const qc = useQueryClient();
  const { companyId } = useAuth();
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
        company_id: companyId!,
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
        {round?.notes && (
          <div className="rounded-lg border border-border/60 bg-card/40 p-3 text-xs">
            <div className="uppercase text-[10px] text-muted-foreground mb-1">Trajeto da ronda</div>
            <div className="whitespace-pre-wrap">{round.notes}</div>
          </div>
        )}

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
        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
          <a
            href={`https://www.google.com/maps?q=${c.lat},${c.lng}`}
            target="_blank" rel="noreferrer"
            className="text-primary inline-flex items-center gap-1 hover:underline"
          >
            <MapPin className="h-3 w-3" /> Google Maps
          </a>
          <a
            href={`https://www.waze.com/ul?ll=${c.lat},${c.lng}&navigate=yes`}
            target="_blank" rel="noreferrer"
            className="text-primary inline-flex items-center gap-1 hover:underline"
          >
            <MapPin className="h-3 w-3" /> Waze
          </a>
          <span className="text-muted-foreground">
            {c.lat.toFixed(5)}, {c.lng.toFixed(5)}
            {c.accuracy != null && ` (±${Math.round(c.accuracy)}m)`}
          </span>
        </div>
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
  const { user, companyId } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState<string>("");

  const { data: items, isLoading } = useQuery({
    queryKey: ["checkpoint-locations-all"],
    enabled: open,
    queryFn: async (): Promise<(CheckpointLocation & { client_id: string | null })[]> => {
      const { data, error } = await supabase
        .from("checkpoint_locations").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as (CheckpointLocation & { client_id: string | null })[];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-min-rondas"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id,name,default_round_mode").order("name");
      return (data ?? []) as { id: string; name: string; default_round_mode: string | null }[];
    },
  });

  const clientMap: Record<string, { name: string; mode: string | null }> = {};
  (clients ?? []).forEach((c) => { clientMap[c.id] = { name: c.name, mode: c.default_round_mode }; });

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Informe o nome do ponto");
      if (!clientId) throw new Error("Selecione o cliente do ponto");
      const pos = await getPosition();
      const { error } = await supabase.from("checkpoint_locations").insert({
        name: name.trim(),
        description: description.trim() || null,
        client_id: clientId,
        lat: pos?.coords.latitude ?? null,
        lng: pos?.coords.longitude ?? null,
        created_by: user?.id ?? null,
        company_id: companyId!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ponto cadastrado");
      setName(""); setDescription("");
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

  const filtered = (items ?? []).filter((l) => !clientId || l.client_id === clientId);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pontos de ronda por cliente</DialogTitle>
          <DialogDescription>
            Cadastre os pontos que o vigia deve percorrer em cada cliente que usa modo "Ponto a ponto".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label className="text-xs">Cliente</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o cliente para ver/cadastrar pontos" />
            </SelectTrigger>
            <SelectContent>
              {(clients ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} {c.default_round_mode === "track" ? "(modo: trajeto GPS)" : "(modo: ponto a ponto)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canEdit && clientId && (
          <div className="space-y-2 rounded-lg border border-border/60 p-3">
            <p className="text-xs text-muted-foreground">Novo ponto para <span className="font-medium text-foreground">{clientMap[clientId]?.name}</span></p>
            <Input placeholder="Nome do ponto (ex.: Praça em frente ao CDD)" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Descrição (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Button className="w-full" onClick={() => create.mutate()} disabled={create.isPending}>
              <Plus className="h-4 w-4" /> Adicionar ponto (usa GPS atual)
            </Button>
          </div>
        )}

        <div className="max-h-72 overflow-auto space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!isLoading && !clientId && (
            <p className="text-sm text-muted-foreground text-center py-4">Selecione um cliente acima.</p>
          )}
          {!isLoading && clientId && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum ponto cadastrado para este cliente.</p>
          )}
          {filtered.map((l) => (
            <div key={l.id} className="rounded-lg border border-border/60 p-3 text-sm flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="font-medium">{l.name}</p>
                {l.client_id && clientMap[l.client_id] && (
                  <p className="text-xs text-primary">{clientMap[l.client_id].name}</p>
                )}
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

function TrackDialog({ round, onClose, userName }: { round: RoundRow | null; onClose: () => void; userName: string }) {
  const open = !!round;
  const points = (round?.track ?? []) as TrackPoint[];
  const distance = (() => {
    let m = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const dx = (b.lat - a.lat) * 111000;
      const dy = (b.lng - a.lng) * 111000 * Math.cos((b.lat * Math.PI) / 180);
      m += Math.sqrt(dx * dx + dy * dy);
    }
    return m;
  })();
  const mapsHref = points.length > 0
    ? `https://www.google.com/maps/dir/${points.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join("/")}`
    : null;
  const staticMap = points.length > 0
    ? (() => {
        // limit to 80 points to fit URL
        const sample = points.length > 80
          ? points.filter((_, i) => i % Math.ceil(points.length / 80) === 0)
          : points;
        const path = sample.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|");
        return `https://staticmap.openstreetmap.de/staticmap.php?size=600x400&path=color:blue|weight:4|${path}`;
      })()
    : null;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Trajeto da ronda — {userName}</DialogTitle>
          <DialogDescription>
            {points.length} pontos registrados • {(distance / 1000).toFixed(2)} km percorridos
          </DialogDescription>
        </DialogHeader>
        {points.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhum ponto GPS gravado nesta ronda.</p>
        ) : (
          <div className="space-y-3">
            {staticMap && (
              <img src={staticMap} alt="Trajeto" className="w-full rounded-md border border-border/60" />
            )}
            {mapsHref && (
              <a href={mapsHref} target="_blank" rel="noreferrer" className="text-primary text-sm hover:underline inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Abrir trajeto no Google Maps
              </a>
            )}
            <div className="max-h-48 overflow-y-auto rounded-md border border-border/60 text-xs font-mono">
              {points.map((p, i) => (
                <div key={i} className="px-2 py-1 border-b border-border/40 last:border-b-0 flex justify-between">
                  <span>{new Date(p.t).toLocaleTimeString()}</span>
                  <span>{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</span>
                  <span className="text-muted-foreground">±{Math.round(p.acc ?? 0)}m</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
