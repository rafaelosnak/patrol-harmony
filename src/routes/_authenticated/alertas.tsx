import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Siren, ShieldAlert, Wrench, HeartPulse, Check, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { EmptyState, PageHeader, Pill } from "@/components/pg/ui";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/alertas")({
  head: () => ({ meta: [{ title: "Alertas — PhytonGuard" }] }),
  component: AlertsPage,
});

function AlertsPage() {
  const { t } = useI18n();
  const { user, isStaff } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: async () => (await supabase.from("alerts").select("*, profiles(full_name)").order("created_at", { ascending: false }).limit(100)).data ?? [],
    refetchInterval: 10000,
  });

  const trigger = useMutation({
    mutationFn: async (alert_type: string) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("alerts").insert({ user_id: user.id, alert_type, message: null });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Alerta enviado para a central"); qc.invalidateQueries({ queryKey: ["alerts"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const resolve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("alerts").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Alerta resolvido"); qc.invalidateQueries({ queryKey: ["alerts"] }); },
  });

  return (
    <div className="space-y-4">
      <PageHeader title={t("alerts.title")} subtitle={t("alerts.subtitle")} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button onClick={() => trigger.mutate("sos")} className="glass rounded-xl p-5 text-left hover:border-status-sos/60 transition-all group">
          <div className="h-12 w-12 rounded-xl bg-status-sos/20 grid place-items-center text-status-sos group-hover:pulse-ring mb-3">
            <Siren className="h-6 w-6" />
          </div>
          <div className="text-base font-semibold">{t("alerts.trigger.sos")}</div>
          <p className="text-xs text-muted-foreground mt-1">Envia localização, horário e unidade.</p>
        </button>
        <button onClick={() => trigger.mutate("support")} className="glass rounded-xl p-5 text-left hover:border-status-round/60 transition-all">
          <div className="h-12 w-12 rounded-xl bg-status-round/20 grid place-items-center text-status-round mb-3">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="text-base font-semibold">{t("alerts.trigger.support")}</div>
          <p className="text-xs text-muted-foreground mt-1">Necessidade de reforço ou situação suspeita.</p>
        </button>
        <button onClick={() => trigger.mutate("operational")} className="glass rounded-xl p-5 text-left hover:border-status-transit/60 transition-all">
          <div className="h-12 w-12 rounded-xl bg-status-transit/20 grid place-items-center text-status-transit mb-3">
            <Wrench className="h-6 w-6" />
          </div>
          <div className="text-base font-semibold">{t("alerts.trigger.op")}</div>
          <p className="text-xs text-muted-foreground mt-1">Portão, cerca, energia, equipamento.</p>
        </button>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground bg-card/40">
            <tr>
              <th className="text-left px-4 py-3">{t("common.type")}</th>
              <th className="text-left px-4 py-3">{t("common.name")}</th>
              <th className="text-left px-4 py-3">{t("common.status")}</th>
              <th className="text-left px-4 py-3">{t("common.created")}</th>
              <th className="text-right px-4 py-3">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">{t("common.loading")}</td></tr>}
            {!isLoading && (data ?? []).length === 0 && <tr><td colSpan={5}><EmptyState icon={HeartPulse} title={t("common.empty")} /></td></tr>}
            {(data ?? []).map((a) => {
              const profile = (a as unknown as { profiles?: { full_name?: string } }).profiles;
              return (
                <tr key={a.id} className="hover:bg-accent/30">
                  <td className="px-4 py-3 font-medium capitalize">{a.alert_type}</td>
                  <td className="px-4 py-3 text-muted-foreground">{profile?.full_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Pill tone={a.status === "active" ? "danger" : a.status === "acknowledged" ? "warn" : "success"}>
                      {a.status === "active" ? t("alerts.active") : a.status === "resolved" ? t("alerts.resolved") : a.status}
                    </Pill>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(a.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    {a.status === "active" && isStaff && (
                      <Button size="sm" variant="outline" onClick={() => resolve.mutate(a.id)}>
                        <Check className="h-3 w-3" /> {t("alerts.resolve")}
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
