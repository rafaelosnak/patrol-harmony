import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Footprints, MapPin, Play, Square } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { EmptyState, PageHeader, Pill } from "@/components/pg/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
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
  created_at: string;
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
  const { user } = useAuth();
  const qc = useQueryClient();
  const [openRound, setOpenRound] = useState<RoundRow | null>(null);

  const { data: rounds, isLoading } = useQuery({
    queryKey: ["rounds"],
    queryFn: async (): Promise<RoundRow[]> => {
      const { data, error } = await supabase
        .from("rounds")
        .select("id,user_id,unit_id,started_at,finished_at,status,checkpoints_done,checkpoints_total")
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

  const start = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await supabase.from("rounds").insert({
        user_id: user.id, checkpoints_total: 6, checkpoints_done: 0,
      }).select().single();
      if (error) throw error;
      return data as RoundRow;
    },
    onSuccess: (row) => {
      toast.success("Ronda iniciada");
      qc.invalidateQueries({ queryKey: ["rounds"] });
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

  return (
    <div className="space-y-4">
      <PageHeader title={t("rounds.title")} subtitle={t("rounds.subtitle")} actions={
        <Button onClick={() => start.mutate()} disabled={start.isPending}>
          <Play className="h-4 w-4" /> {t("rounds.new")}
        </Button>
      } />

      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground bg-card/40">
            <tr>
              <th className="text-left px-4 py-3">{t("common.name")}</th>
              <th className="text-left px-4 py-3">{t("common.start")}</th>
              <th className="text-left px-4 py-3">{t("rounds.checkpoints")}</th>
              <th className="text-left px-4 py-3">{t("common.status")}</th>
              <th className="text-right px-4 py-3">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">{t("common.loading")}</td></tr>}
            {!isLoading && (rounds ?? []).length === 0 && (
              <tr><td colSpan={5}><EmptyState icon={Footprints} title={t("common.empty")} /></td></tr>
            )}
            {(rounds ?? []).map((r) => {
              const inProg = r.status === "in_progress";
              return (
                <tr key={r.id} className="hover:bg-accent/30">
                  <td className="px-4 py-3 font-medium">{names?.[r.user_id] ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(r.started_at).toLocaleString()}</td>
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
                    {inProg && user?.id === r.user_id && (
                      <Button size="sm" variant="outline" onClick={() => finish.mutate(r.id)}>
                        <Square className="h-3 w-3" /> {t("rounds.finish")}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <CheckpointsDialog
        round={openRound}
        onClose={() => setOpenRound(null)}
        currentUserId={user?.id}
      />
    </div>
  );
}

function CheckpointsDialog({
  round, onClose, currentUserId,
}: { round: RoundRow | null; onClose: () => void; currentUserId?: string }) {
  const qc = useQueryClient();
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");

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
      const { error } = await supabase.from("round_checkpoints").insert({
        round_id: round.id,
        user_id: currentUserId,
        label: label.trim() || null,
        notes: notes.trim() || null,
        lat: pos?.coords.latitude ?? null,
        lng: pos?.coords.longitude ?? null,
        accuracy: pos?.coords.accuracy ?? null,
      });
      if (error) throw error;
      return pos !== null;
    },
    onSuccess: (hadGps) => {
      toast.success(hadGps ? "Ponto registrado com localização" : "Ponto registrado (sem GPS)");
      setLabel(""); setNotes("");
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
            <Input placeholder="Identificação do ponto (ex.: Portão A)" value={label} onChange={(e) => setLabel(e.target.value)} />
            <Input placeholder="Observação (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
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
            <div key={c.id} className="rounded-lg border border-border/60 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">#{i + 1} {c.label ?? "Ponto"}</span>
                <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleTimeString()}</span>
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
