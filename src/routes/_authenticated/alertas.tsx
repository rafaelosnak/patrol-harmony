import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Siren, ShieldAlert, Wrench, HeartPulse, Check, Send, Pencil, X, Bell, BellOff, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { EmptyState, PageHeader, Pill } from "@/components/pg/ui";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/_authenticated/alertas")({
  head: () => ({ meta: [{ title: "Alertas — PhytonGuard" }] }),
  component: AlertsPage,
});

function playSiren() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.value = 0.25;
    gain.connect(ctx.destination);
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      const t0 = now + i * 0.6;
      o.frequency.setValueAtTime(880, t0);
      o.frequency.exponentialRampToValueAtTime(440, t0 + 0.5);
      o.connect(gain);
      o.start(t0);
      o.stop(t0 + 0.5);
    }
    setTimeout(() => ctx.close().catch(() => {}), 2200);
  } catch {/* ignore */}
}

type AlertTypeInfo = {
  key: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  colorClass: string;
};

function AlertsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const [observation, setObservation] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [notifEnabled, setNotifEnabled] = useState<boolean>(
    typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted",
  );
  const lastSeenRef = useRef<string | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel("alerts-listen")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alerts" }, async (payload) => {
        const row = payload.new as { id: string; alert_type: string; user_id: string; message: string | null };
        if (lastSeenRef.current === row.id) return;
        lastSeenRef.current = row.id;
        playSiren();
        let who = "Vigia";
        try {
          const { data: p } = await supabase.from("profiles").select("full_name").eq("id", row.user_id).maybeSingle();
          if (p?.full_name) who = p.full_name;
        } catch {/* ignore */}
        const title = `🚨 Alerta: ${row.alert_type.toUpperCase()}`;
        const body = `${who}${row.message ? ` — ${row.message}` : ""}`;
        toast.error(title, { description: body, duration: 12000 });
        if ("Notification" in window && Notification.permission === "granted") {
          try { new Notification(title, { body, tag: row.id, requireInteraction: true }); } catch {/* ignore */}
        }
        qc.invalidateQueries({ queryKey: ["alerts"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const requestNotif = async () => {
    if (!("Notification" in window)) { toast.error("Notificações não suportadas neste navegador"); return; }
    const perm = await Notification.requestPermission();
    setNotifEnabled(perm === "granted");
    if (perm === "granted") toast.success("Notificações ativadas");
  };

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
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const saveMessage = useMutation({
    mutationFn: async ({ id, message }: { id: string; message: string | null }) => {
      const { error } = await supabase.from("alerts").update({ message }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Observação atualizada");
      qc.invalidateQueries({ queryKey: ["alerts"] });
      setEditingId(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const activeType = alertTypes.find((a) => a.key === openDialog);

  return (
    <div className="space-y-4">
      <PageHeader title={t("alerts.title")} subtitle={t("alerts.subtitle")} actions={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => playSiren()} title="Testar som">
            <Volume2 className="h-4 w-4 mr-1" /> Testar som
          </Button>
          <Button size="sm" variant={notifEnabled ? "secondary" : "default"} onClick={requestNotif}>
            {notifEnabled ? <Bell className="h-4 w-4 mr-1" /> : <BellOff className="h-4 w-4 mr-1" />}
            {notifEnabled ? "Notificações ativas" : "Ativar notificações"}
          </Button>
        </div>
      } />

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
              const isEditing = editingId === a.id;
              return (
                <tr key={a.id} className="hover:bg-accent/30">
                  <td className="px-4 py-3 font-medium capitalize">{a.alert_type}</td>
                  <td className="px-4 py-3 text-muted-foreground">{profile?.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <Textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} rows={2} className="min-w-[180px]" />
                        <Button size="sm" variant="outline" onClick={() => saveMessage.mutate({ id: a.id, message: editDraft.trim() || null })}>
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="truncate">{a.message ?? "—"}</span>
                        <button onClick={() => { setEditingId(a.id); setEditDraft(a.message ?? ""); }} className="opacity-60 hover:opacity-100" title="Editar observação">
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Pill tone={a.status === "active" ? "danger" : a.status === "acknowledged" ? "warn" : "success"}>
                      {a.status === "active" ? t("alerts.active") : a.status === "resolved" ? t("alerts.resolved") : a.status}
                    </Pill>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(a.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    {a.status === "active" && (
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
