import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarClock, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { EmptyState, PageHeader, Pill } from "@/components/pg/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/escalas")({
  head: () => ({ meta: [{ title: "Escalas — PhytonGuard" }] }),
  component: ShiftsPage,
});

type Shift = { id: string; user_id: string; client_id: string | null; shift_type: string; start_at: string; end_at: string; status: string };

function ShiftsPage() {
  const { t } = useI18n();
  const { hasRole, companyId, user, isStaff } = useAuth();
  const canManage = hasRole("admin");
  const canDelete = hasRole("admin");
  const viewerIsVigia = !isStaff && hasRole("vigia");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const defaultForm = {
    user_id: "", client_id: "", shift_type: "12x36",
    start_at: today.toISOString().slice(0, 16),
    end_at: new Date(today.getTime() + 12 * 3600000).toISOString().slice(0, 16),
  };
  const [form, setForm] = useState(defaultForm);

  const { data, isLoading } = useQuery({
    queryKey: ["shifts", viewerIsVigia ? user?.id : "all"],
    queryFn: async () => {
      let q = supabase.from("shifts").select("id,user_id,client_id,shift_type,start_at,end_at,status").order("start_at", { ascending: false }).limit(200);
      if (viewerIsVigia && user) q = q.eq("user_id", user.id);
      return (await q).data ?? [];
    },
  });
  const { data: people } = useQuery({ queryKey: ["profiles-min"], queryFn: async () => (await supabase.from("profiles").select("id,full_name")).data ?? [] });
  const { data: clients } = useQuery({ queryKey: ["clients-min"], queryFn: async () => (await supabase.from("clients").select("id,name").order("name")).data ?? [] });

  const profileMap: Record<string, string> = {};
  (people ?? []).forEach((p) => { profileMap[p.id] = p.full_name ?? "—"; });
  const clientMap: Record<string, string> = {};
  (clients ?? []).forEach((c) => { clientMap[c.id] = c.name ?? "—"; });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: form.user_id,
        client_id: form.client_id || null,
        shift_type: form.shift_type,
        start_at: new Date(form.start_at).toISOString(),
        end_at: new Date(form.end_at).toISOString(),
        company_id: companyId!,
      };
      if (editing) {
        const { error } = await supabase.from("shifts").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("shifts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Escala atualizada" : "Escala criada");
      qc.invalidateQueries({ queryKey: ["shifts"] });
      setOpen(false); setEditing(null); setForm(defaultForm);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("shifts").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Escala removida"); qc.invalidateQueries({ queryKey: ["shifts"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const openNew = () => { setEditing(null); setForm(defaultForm); setOpen(true); };
  const openEdit = (s: Shift) => {
    setEditing(s);
    setForm({
      user_id: s.user_id, client_id: s.client_id ?? "", shift_type: s.shift_type,
      start_at: new Date(s.start_at).toISOString().slice(0, 16),
      end_at: new Date(s.end_at).toISOString().slice(0, 16),
    });
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t("shifts.title")} subtitle={t("shifts.subtitle")} actions={
        canManage && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4" />{t("shifts.new")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Editar escala" : t("shifts.new")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>{t("common.name")}</Label>
                  <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{(people ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Cliente</Label>
                  <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{(clients ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("common.type")}</Label>
                  <Select value={form.shift_type} onValueChange={(v) => setForm({ ...form, shift_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12x36">12x36</SelectItem>
                      <SelectItem value="5x1">5x1</SelectItem>
                      <SelectItem value="6x1">6x1</SelectItem>
                      <SelectItem value="4x2">4x2</SelectItem>
                      <SelectItem value="5x2">5x2</SelectItem>
                      <SelectItem value="custom">Personalizada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{t("common.start")}</Label><Input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} /></div>
                  <div><Label>{t("common.end")}</Label><Input type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>{t("common.cancel")}</Button>
                <Button onClick={() => save.mutate()} disabled={!form.user_id || save.isPending}>{editing ? "Salvar" : t("common.create")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )
      } />

      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground bg-card/40">
            <tr>
              <th className="text-left px-4 py-3">{t("common.name")}</th>
              <th className="text-left px-4 py-3">Cliente</th>
              <th className="text-left px-4 py-3">{t("common.type")}</th>
              <th className="text-left px-4 py-3">{t("common.start")}</th>
              <th className="text-left px-4 py-3">{t("common.end")}</th>
              <th className="text-left px-4 py-3">{t("common.status")}</th>
              {canManage && <th className="text-right px-4 py-3">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">{t("common.loading")}</td></tr>}
            {!isLoading && (data ?? []).length === 0 && <tr><td colSpan={7}><EmptyState icon={CalendarClock} title={t("common.empty")} /></td></tr>}
            {(data ?? []).map((s) => (
              <tr key={s.id} className="hover:bg-accent/30">
                <td className="px-4 py-3 font-medium">{profileMap[s.user_id] ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.client_id ? (clientMap[s.client_id] ?? "—") : "—"}</td>
                <td className="px-4 py-3"><Pill tone="info">{s.shift_type}</Pill></td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(s.start_at).toLocaleString()}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(s.end_at).toLocaleString()}</td>
                <td className="px-4 py-3"><Pill>{s.status}</Pill></td>
                {canManage && (
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(s as Shift)}><Pencil className="h-3 w-3" /></Button>
                      {canDelete && <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir escala?")) del.mutate(s.id); }}><Trash2 className="h-3 w-3" /></Button>}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
