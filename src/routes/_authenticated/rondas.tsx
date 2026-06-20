import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Footprints, Play, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { EmptyState, PageHeader, Pill } from "@/components/pg/ui";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/rondas")({
  head: () => ({ meta: [{ title: "Rondas — PhytonGuard" }] }),
  component: RoundsPage,
});

function RoundsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["rounds"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rounds")
        .select("*, units(name), profiles!rounds_user_id_fkey(full_name)")
        .order("started_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  const start = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("rounds").insert({
        user_id: user.id, checkpoints_total: 6, checkpoints_done: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Ronda iniciada"); qc.invalidateQueries({ queryKey: ["rounds"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const finish = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rounds").update({
        finished_at: new Date().toISOString(), status: "completed",
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Ronda finalizada"); qc.invalidateQueries({ queryKey: ["rounds"] }); },
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
              <th className="text-left px-4 py-3">{t("common.unit")}</th>
              <th className="text-left px-4 py-3">{t("common.start")}</th>
              <th className="text-left px-4 py-3">{t("rounds.checkpoints")}</th>
              <th className="text-left px-4 py-3">{t("common.status")}</th>
              <th className="text-right px-4 py-3">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">{t("common.loading")}</td></tr>}
            {!isLoading && (data ?? []).length === 0 && (
              <tr><td colSpan={6}><EmptyState icon={Footprints} title={t("common.empty")} /></td></tr>
            )}
            {(data ?? []).map((r) => {
              const inProg = r.status === "in_progress";
              const profile = (r as unknown as { profiles?: { full_name?: string } }).profiles;
              const unit = (r as unknown as { units?: { name?: string } }).units;
              return (
                <tr key={r.id} className="hover:bg-accent/30">
                  <td className="px-4 py-3 font-medium">{profile?.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{unit?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(r.started_at).toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.checkpoints_done}/{r.checkpoints_total}</td>
                  <td className="px-4 py-3">
                    <Pill tone={inProg ? "warn" : r.status === "completed" ? "success" : "default"}>
                      {inProg ? t("rounds.inprogress") : r.status === "completed" ? t("rounds.completed") : r.status}
                    </Pill>
                  </td>
                  <td className="px-4 py-3 text-right">
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
    </div>
  );
}
