import { useEffect, useMemo, useState } from "react";
import { Bell, Siren, Megaphone } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

type Item = {
  id: string;
  kind: "alert" | "announcement";
  title: string;
  body: string;
  created_at: string;
};

const LS_KEY = "pg.notifications.lastSeen";

export function NotificationBell() {
  const { companyId, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState<string>(() => {
    if (typeof window === "undefined") return new Date(0).toISOString();
    return localStorage.getItem(LS_KEY) ?? new Date(0).toISOString();
  });

  const { data } = useQuery({
    queryKey: ["notifications", companyId],
    enabled: !!companyId,
    refetchInterval: 30000,
    queryFn: async (): Promise<Item[]> => {
      const [a, n] = await Promise.all([
        supabase.from("alerts").select("id, alert_type, message, created_at, status")
          .eq("company_id", companyId!).order("created_at", { ascending: false }).limit(20),
        supabase.from("announcements").select("id, title, body, created_at")
          .eq("company_id", companyId!).order("created_at", { ascending: false }).limit(20),
      ]);
      const alerts: Item[] = (a.data ?? []).map((x) => ({
        id: `alert:${x.id}`,
        kind: "alert",
        title: `Alerta: ${String(x.alert_type).toUpperCase()}`,
        body: x.message ?? "Sem observação",
        created_at: x.created_at,
      }));
      const anns: Item[] = (n.data ?? []).map((x) => ({
        id: `ann:${x.id}`,
        kind: "announcement",
        title: x.title,
        body: x.body,
        created_at: x.created_at,
      }));
      return [...alerts, ...anns].sort((p, q) => q.created_at.localeCompare(p.created_at)).slice(0, 30);
    },
  });

  // Realtime
  useEffect(() => {
    if (!companyId) return;
    const ch = supabase
      .channel(`notif-${companyId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alerts", filter: `company_id=eq.${companyId}` }, (p) => {
        const row = p.new as { alert_type: string; message: string | null; user_id: string };
        if (row.user_id !== user?.id) {
          toast.error(`🚨 Novo alerta: ${row.alert_type.toUpperCase()}`, { description: row.message ?? undefined });
        }
        qc.invalidateQueries({ queryKey: ["notifications", companyId] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "announcements", filter: `company_id=eq.${companyId}` }, (p) => {
        const row = p.new as { title: string; author_id: string };
        if (row.author_id !== user?.id) {
          toast.message(`📣 Novo comunicado: ${row.title}`);
        }
        qc.invalidateQueries({ queryKey: ["notifications", companyId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [companyId, user?.id, qc]);

  const unread = useMemo(
    () => (data ?? []).filter((i) => i.created_at > lastSeen).length,
    [data, lastSeen],
  );

  const markRead = () => {
    const now = new Date().toISOString();
    localStorage.setItem(LS_KEY, now);
    setLastSeen(now);
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) markRead(); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notificações" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-status-sos text-[10px] font-bold text-white grid place-items-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-3 py-2 border-b border-border/60 text-sm font-semibold">Notificações</div>
        <div className="max-h-96 overflow-y-auto divide-y divide-border/60">
          {(data ?? []).length === 0 && (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">Sem notificações</div>
          )}
          {(data ?? []).map((i) => {
            const isNew = i.created_at > lastSeen;
            return (
              <button
                key={i.id}
                onClick={() => {
                  setOpen(false);
                  navigate({ to: i.kind === "alert" ? "/alertas" : "/comunicados" });
                }}
                className={`w-full text-left px-3 py-2.5 hover:bg-accent/40 transition-colors ${isNew ? "bg-accent/20" : ""}`}
              >
                <div className="flex items-start gap-2">
                  <div className={`mt-0.5 ${i.kind === "alert" ? "text-status-sos" : "text-primary"}`}>
                    {i.kind === "alert" ? <Siren className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold truncate">{i.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{i.body}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(i.created_at).toLocaleString()}</div>
                  </div>
                  {isNew && <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />}
                </div>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
