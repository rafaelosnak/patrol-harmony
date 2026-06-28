import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { EmptyState, PageHeader, Pill, StatusDot } from "@/components/pg/ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { updateEmployeeRole } from "@/lib/employees.functions";
import { useNoVigiaGuard } from "@/hooks/use-staff-guard";

export const Route = createFileRoute("/_authenticated/equipes")({
  head: () => ({ meta: [{ title: "Equipes — PhytonGuard" }] }),
  component: TeamsPage,
});

type AppRole = "admin" | "supervisor" | "vigia" | "central";
type Member = { id: string; full_name: string; email: string | null; status: string; created_at: string; roles: AppRole[] };

function TeamsPage() {
  useNoVigiaGuard();
  const { t } = useI18n();
  const { isStaff } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Member | null>(null);
  const [draftStatus, setDraftStatus] = useState("offline");
  const [draftRole, setDraftRole] = useState<AppRole>("vigia");
  const updateRoleFn = useServerFn(updateEmployeeRole);

  const { data, isLoading } = useQuery({
    queryKey: ["profiles-with-roles"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      const map = new Map<string, AppRole[]>();
      (roles ?? []).forEach((r) => { const arr = map.get(r.user_id) ?? []; arr.push(r.role as AppRole); map.set(r.user_id, arr); });
      return (profiles ?? []).map((p) => ({ ...p, roles: map.get(p.id) ?? [] })) as Member[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase.from("profiles").update({ status: draftStatus }).eq("id", editing.id);
      if (error) throw error;
      const current = editing.roles[0];
      if (current !== draftRole) {
        await updateRoleFn({ data: { user_id: editing.id, role: draftRole } });
      }
    },
    onSuccess: () => {
      toast.success("Membro atualizado");
      qc.invalidateQueries({ queryKey: ["profiles-with-roles"] });
      setEditing(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const openEdit = (m: Member) => {
    setEditing(m);
    setDraftStatus(m.status || "offline");
    setDraftRole((m.roles[0] as AppRole) || "vigia");
  };

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
              <th className="text-right px-4 py-3">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">{t("common.loading")}</td></tr>}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={6}><EmptyState icon={Users} title={t("common.empty")} /></td></tr>
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
                <td className="px-4 py-3 text-right">
                  {isStaff && (
                    <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                      <Pencil className="h-3 w-3 mr-1" /> Editar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar {editing?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-medium">Papel</label>
              <Select value={draftRole} onValueChange={(v) => setDraftRole(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="central">Central de Apoio</SelectItem>
                  <SelectItem value="vigia">Vigia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Status</label>
              <Select value={draftStatus} onValueChange={setDraftStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="working">Em trabalho</SelectItem>
                  <SelectItem value="round">Em ronda</SelectItem>
                  <SelectItem value="transit">Em trânsito</SelectItem>
                  <SelectItem value="break">Em pausa</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
