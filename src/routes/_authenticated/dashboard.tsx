import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Users, Footprints, AlertOctagon, Siren, Timer, CheckCircle2, Radio, UserCheck, CalendarClock,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as ReTooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { PageHeader, Pill, StatusDot } from "@/components/pg/ui";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — PhytonGuard" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { t } = useI18n();
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);

  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const [profiles, rounds, occ, alerts, shifts] = await Promise.all([
        supabase.from("profiles").select("id,status,full_name,created_at").limit(200),
        supabase.from("rounds").select("id,user_id,vehicle_id,status,started_at,finished_at,checkpoints_done,checkpoints_total").gte("started_at", new Date(Date.now() - 7 * 86400000).toISOString()).order("started_at", { ascending: false }),
        supabase.from("occurrences").select("id,status,severity,title,created_at").order("created_at", { ascending: false }).limit(50),
        supabase.from("alerts").select("id,status,alert_type,created_at").eq("status", "active"),
        supabase.from("shifts").select("id,user_id,unit_id,shift_type,start_at,end_at,status, profiles!shifts_user_id_fkey(full_name), units(name)").lte("start_at", nowIso).gte("end_at", nowIso),
      ]);
      return {
        profiles: profiles.data ?? [],
        rounds: rounds.data ?? [],
        occurrences: occ.data ?? [],
        alerts: alerts.data ?? [],
        shifts: shifts.data ?? [],
      };
    },
    refetchInterval: 15000,
  });

  // Monthly schedule (current month) — visible for all logged-in users
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const monthEnd = new Date(monthStart); monthEnd.setMonth(monthEnd.getMonth() + 1);
  const { data: monthShifts } = useQuery({
    queryKey: ["dashboard-month-shifts", monthStart.toISOString()],
    queryFn: async () => (await supabase
      .from("shifts")
      .select("id,user_id,unit_id,shift_type,start_at,end_at,status, profiles!shifts_user_id_fkey(full_name), units(name)")
      .gte("start_at", monthStart.toISOString())
      .lt("start_at", monthEnd.toISOString())
      .order("start_at", { ascending: true })
    ).data ?? [],
  });

  const profileMap: Record<string, string> = {};
  (data?.profiles ?? []).forEach((p) => { profileMap[p.id] = p.full_name ?? "—"; });

  const team = data?.profiles ?? [];
  const activeRounds = (data?.rounds ?? []).filter((r) => r.status === "in_progress").length;
  const openOcc = (data?.occurrences ?? []).filter((o) => o.status !== "closed").length;
  const activeAlerts = data?.alerts.length ?? 0;
  const todayRounds = (data?.rounds ?? []).filter((r) => new Date(r.started_at) >= new Date(new Date().setHours(0, 0, 0, 0))).length;

  const statusCount = team.reduce<Record<string, number>>((acc, p) => { acc[p.status] = (acc[p.status] ?? 0) + 1; return acc; }, {});
  const pieData = (["working", "round", "lunch", "transit", "sos"] as const).map((s) => ({
    name: t(`status.${s}` as never),
    key: s,
    value: statusCount[s] ?? 0,
  }));
  const pieColors: Record<string, string> = {
    working: "oklch(0.74 0.18 150)", round: "oklch(0.85 0.17 95)", lunch: "oklch(0.76 0.16 60)",
    transit: "oklch(0.72 0.14 235)", sos: "oklch(0.64 0.23 25)",
  };

  // Weekly chart
  const weekly = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0, 0, 0, 0);
    const next = new Date(d); next.setDate(next.getDate() + 1);
    return {
      day: d.toLocaleDateString(undefined, { weekday: "short" }),
      rondas: (data?.rounds ?? []).filter((r) => new Date(r.started_at) >= d && new Date(r.started_at) < next).length,
      ocorrencias: (data?.occurrences ?? []).filter((o) => new Date(o.created_at) >= d && new Date(o.created_at) < next).length,
    };
  });

  const kpis = [
    { icon: Users, label: t("dash.kpi.active"), value: team.length, tone: "info" as const },
    { icon: Footprints, label: t("dash.kpi.rounds"), value: todayRounds, sub: `${activeRounds} ${t("rounds.inprogress").toLowerCase()}`, tone: "success" as const },
    { icon: AlertOctagon, label: t("dash.kpi.occurrences"), value: openOcc, tone: openOcc > 0 ? "warn" as const : "default" as const },
    { icon: Siren, label: t("dash.kpi.alerts"), value: activeAlerts, tone: activeAlerts > 0 ? "danger" as const : "default" as const },
    { icon: Timer, label: t("dash.kpi.response"), value: "3m 42s", tone: "info" as const },
    { icon: CheckCircle2, label: t("dash.kpi.attendance"), value: "97%", tone: "success" as const },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dash.title")}
        subtitle={t("dash.subtitle")}
        actions={
          <div className="flex items-center gap-2 glass rounded-lg px-3 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-status-working opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-status-working" />
            </span>
            <span className="text-xs font-medium">{t("dash.live")}</span>
            <span className="text-xs text-muted-foreground font-mono">{now.toLocaleTimeString()}</span>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="glass rounded-xl p-4 hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between">
              <div className="h-9 w-9 rounded-lg bg-primary/15 grid place-items-center text-primary">
                <k.icon className="h-4 w-4" />
              </div>
              <Pill tone={k.tone}>•</Pill>
            </div>
            <div className="mt-3 text-2xl font-bold">{k.value}</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5">{k.label}</div>
            {k.sub && <div className="text-[11px] text-muted-foreground mt-0.5">{k.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold mb-3">{t("dash.weekly")}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weekly}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.08)" />
                <XAxis dataKey="day" stroke="oklch(0.68 0.025 250)" fontSize={11} />
                <YAxis stroke="oklch(0.68 0.025 250)" fontSize={11} />
                <ReTooltip contentStyle={{ background: "oklch(0.22 0.035 258)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Line type="monotone" dataKey="rondas" stroke="oklch(0.74 0.16 230)" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="ocorrencias" stroke="oklch(0.64 0.23 25)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">{t("dash.status.distribution")}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {pieData.map((entry) => (
                    <Cell key={entry.key} fill={pieColors[entry.key]} stroke="transparent" />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="glass rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" />
            Vigias em trabalho
          </h3>
          <span className="text-[11px] text-muted-foreground font-mono">{now.toLocaleString("pt-BR")}</span>
        </div>
        {(data?.shifts ?? []).length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Nenhum vigia em trabalho no momento.</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {(data?.shifts ?? []).map((s) => {
              const profile = (s as unknown as { profiles?: { full_name?: string } }).profiles;
              const unit = (s as unknown as { units?: { name?: string } }).units;
              return (
                <li key={s.id} className="rounded-lg border border-border/60 bg-card/40 p-3 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/15 grid place-items-center text-primary text-xs font-semibold">
                    {(profile?.full_name ?? "—").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{profile?.full_name ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {unit?.name ? `${unit.name} • ` : ""}{s.shift_type} • até {new Date(s.end_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <Pill tone="success">no turno</Pill>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Escala do mês */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            Escala do mês — {monthStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </h3>
          <span className="text-[11px] text-muted-foreground">{(monthShifts ?? []).length} turnos</span>
        </div>
        {(monthShifts ?? []).length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma escala lançada para este mês.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="text-left py-2">Dia</th><th className="text-left">Vigia</th><th className="text-left">Unidade</th><th className="text-left">Turno</th><th className="text-left">Horário</th></tr>
              </thead>
              <tbody>
                {(monthShifts ?? []).map((s) => {
                  const profile = (s as unknown as { profiles?: { full_name?: string } }).profiles;
                  const unit = (s as unknown as { units?: { name?: string } }).units;
                  const st = new Date(s.start_at);
                  const en = new Date(s.end_at);
                  return (
                    <tr key={s.id} className="border-t border-border/40">
                      <td className="py-1.5 font-mono text-xs">{st.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</td>
                      <td className="truncate max-w-[180px]">{profile?.full_name ?? "—"}</td>
                      <td className="text-muted-foreground truncate max-w-[160px]">{unit?.name ?? "—"}</td>
                      <td><Pill tone="info">{s.shift_type}</Pill></td>
                      <td className="text-xs text-muted-foreground">{st.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} → {en.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Footprints className="h-4 w-4 text-primary" />Rondas recentes</h3>
          </div>
          <ul className="divide-y divide-border/60">
            {(data?.rounds ?? []).slice(0, 8).map((r) => (
              <li key={r.id} className="py-2.5 flex items-center gap-3">
                <Pill tone={r.status === "in_progress" ? "warn" : r.status === "completed" ? "success" : "default"}>
                  {r.status === "in_progress" ? "Em curso" : r.status === "completed" ? "Concluída" : r.status}
                </Pill>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{profileMap[r.user_id] ?? "—"}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(r.started_at).toLocaleString()} • {r.checkpoints_done}/{r.checkpoints_total} pontos
                  </div>
                </div>
              </li>
            ))}
            {(data?.rounds ?? []).length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">{t("common.empty")}</li>
            )}
          </ul>
        </div>

        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Radio className="h-4 w-4 text-primary" />{t("dash.activity")}</h3>
          </div>
          <ul className="divide-y divide-border/60">
            {(data?.occurrences ?? []).slice(0, 8).map((o) => (
              <li key={o.id} className="py-2.5 flex items-center gap-3">
                <StatusDot status={o.status} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{o.title}</div>
                  <div className="text-[11px] text-muted-foreground">{new Date(o.created_at).toLocaleString()}</div>
                </div>
                <Pill tone={o.severity === "critical" || o.severity === "high" ? "danger" : o.severity === "medium" ? "warn" : "default"}>
                  {o.severity}
                </Pill>
              </li>
            ))}
            {(data?.occurrences ?? []).length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">{t("common.empty")}</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
