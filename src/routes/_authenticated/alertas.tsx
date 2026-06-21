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

type AlertTypeInfo = {
  key: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  colorClass: string;
};

function AlertsPage() {
  const { t } = useI18n();
  const { user, isStaff } = useAuth();
  const qc = useQueryClient();

  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const [observation, setObservation] = useState("");

  const alertTypes: AlertTypeInfo[] = [
    {
      key: "sos",
      label: t("alerts.trigger.sos"),
      desc: "Envia localização, horário e unidade.",
      icon: <Siren className="h-6 w-6" />,
      colorClass: "text-status-sos bg-status-sos/20 hover:border-status-sos/60",
    },
    {
      key: "support",
      label: t("alerts.trigger.support"),
      desc: "Necessidade de reforço ou situação suspeita.",
      icon: <ShieldAlert className="h-6 w-6" />,
      colorClass: "text-status-round bg-status-round/20 hover:border-status-round/60",
    },
    {
      key: "operational",
      label: t("alerts.trigger.op"),
      desc: "Portão, cerca, energia, equipamento.",
      icon: <Wrench className="h-6 w-6" />,
      colorClass: "text-status-transit bg-status-transit/20 hover:border-status-transit/60",
    },
  ];

  const { data, isLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: async () => (await supabase.from("alerts").select("*, profiles(full_name)").order("created_at", { ascending: false }).limit(100)).data ?? [],
    refetchInterval: 10000,
  });

  const trigger = useMutation({
    mutationFn: async ({ alert_type, message }: { alert_type: string; message: string | null }) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("alerts").insert({ user_id: user.id, alert_type, message });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Alerta enviado para a central");
      qc.invalidateQueries({ queryKey: ["alerts"] });
      setObservation("");
      setOpenDialog(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const resolve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("alerts").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Alerta resolvido"); qc.invalidateQueries({ queryKey: ["alerts"] }); },
  });

  const activeType = alertTypes.find((a) => a.key === openDialog);

  return (
    <div className="space-y-4">
      <PageHeader title={t("alerts.title")} subtitle={t("alerts.subtitle")} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {alertTypes.map((type) => (
          <button
            key={type.key}
            onClick={() => { setOpenDialog(type.key); setObservation(""); }}
            className={`glass rounded-xl p-5 text-left transition-all group ${type.colorClass}`}
          >
            <div className={`h-12 w-12 rounded-xl grid place-items-center mb-3`}>
              {type.icon}
            </div>
            <div className="text-base font-semibold">{type.label}</div>
            <p className="text-xs text-muted-foreground mt-1">{type.desc}</p>
          </button>
        ))}
      </div>

      {activeType && (
        <Dialog open onOpenChange={(v) => !v && setOpenDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Disparar alerta: {activeType.label}</DialogTitle>
              <DialogDescription>
                Adicione uma observação para a central. Ex: "carro quebrou em ronda", "solicitar apoio", etc.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <Textarea
                placeholder="Descreva o problema ou solicitação..."
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                rows={4}
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setOpenDialog(null)}>Cancelar</Button>
                <Button
                  onClick={() => trigger.mutate({ alert_type: activeType.key, message: observation.trim() || null })}
                  disabled={trigger.isPending}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {trigger.isPending ? "Enviando..." : "Enviar alerta"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground bg-card/40">
            <tr>
              <th className="text-left px-4 py-3">{t("common.type")}</th>
              <th className="text-left px-4 py-3">{t("common.name")}</th>
              <th className="text-left px-4 py-3">Observação</th>
              <th className="text-left px-4 py-3">{t("common.status")}</th>
              <th className="text-left px-4 py-3">{t("common.created")}</th>
              <th className="text-right px-4 py-3">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">{t("common.loading")}</td></tr>}
            {!isLoading && (data ?? []).length === 0 && <tr><td colSpan={6}><EmptyState icon={HeartPulse} title={t("common.empty")} /></td></tr>}
            {(data ?? []).map((a) => {
              const profile = (a as unknown as { profiles?: { full_name?: string } }).profiles;
              return (
                <tr key={a.id} className="hover:bg-accent/30">
                  <td className="px-4 py-3 font-medium capitalize">{a.alert_type}</td>
                  <td className="px-4 py-3 text-muted-foreground">{profile?.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{a.message ?? "—"}</td>
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
