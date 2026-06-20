import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { EmptyState, PageHeader, Pill, StatusDot } from "@/components/pg/ui";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/equipes")({
  head: () => ({ meta: [{ title: "Equipes — PhytonGuard" }] }),
  component: TeamsPage,
});

function TeamsPage() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["profiles-with-roles"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      const map = new Map<string, string[]>();
      (roles ?? []).forEach((r) => { const arr = map.get(r.user_id) ?? []; arr.push(r.role); map.set(r.user_id, arr); });
      return (profiles ?? []).map((p) => ({ ...p, roles: map.get(p.id) ?? [] }));
    },
  });

  const filtered = (data ?? []).filter((p) => p.full_name.toLowerCase().includes(q.toLowerCase()) || (p.email ?? "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <PageHeader title={t("teams.title")} subtitle={t("teams.subtitle")} actions={
        <Input placeholder={t("common.search")} value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
      } />

      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground bg-card/40">
            <tr>
              <th className="text-left px-4 py-3">{t("common.name")}</th>
              <th className="text-left px-4 py-3">{t("settings.role")}</th>
              <th className="text-left px-4 py-3">{t("common.status")}</th>
              <th className="text-left px-4 py-3">{t("auth.email")}</th>
              <th className="text-left px-4 py-3">{t("common.created")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">{t("common.loading")}</td></tr>}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={5}><EmptyState icon={Users} title={t("common.empty")} /></td></tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-accent/30">
                <td className="px-4 py-3 font-medium">{p.full_name}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {p.roles.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                    {p.roles.map((r) => <Pill key={r} tone="info">{r}</Pill>)}
                  </div>
                </td>
                <td className="px-4 py-3"><span className="flex items-center gap-2"><StatusDot status={p.status} /><span className="text-xs capitalize">{p.status}</span></span></td>
                <td className="px-4 py-3 text-muted-foreground">{p.email}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
