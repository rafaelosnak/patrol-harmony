import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Megaphone, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { EmptyState, PageHeader, Pill } from "@/components/pg/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useStaffGuard } from "@/hooks/use-staff-guard";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/comunicados")({
  head: () => ({ meta: [{ title: "Comunicados — PhytonGuard" }] }),
  component: AnnPage,
});

type Ann = { id: string; title: string; body: string; audience: string; created_at: string; author_id: string };

function AnnPage() {
  useStaffGuard();
  const { t } = useI18n();
  const { user, isStaff, hasRole, companyId } = useAuth();
  const canDelete = hasRole("admin");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Ann | null>(null);
  const [form, setForm] = useState({ title: "", body: "", audience: "all" });

  const { data, isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => (await supabase.from("announcements").select("*, profiles!announcements_author_id_fkey(full_name)").order("created_at", { ascending: false }).limit(50)).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      if (editing) {
        const { error } = await supabase.from("announcements").update({
          title: form.title, body: form.body, audience: form.audience,
        }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("announcements").insert({
          author_id: user.id, title: form.title, body: form.body, audience: form.audience, company_id: companyId!,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Comunicado atualizado" : "Comunicado publicado");
      qc.invalidateQueries({ queryKey: ["announcements"] });
      setOpen(false); setEditing(null); setForm({ title: "", body: "", audience: "all" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Comunicado removido"); qc.invalidateQueries({ queryKey: ["announcements"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const openEdit = (a: Ann) => {
    setEditing(a); setForm({ title: a.title, body: a.body, audience: a.audience }); setOpen(true);
  };
  const openNew = () => {
    setEditing(null); setForm({ title: "", body: "", audience: "all" }); setOpen(true);
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t("ann.title")} subtitle={t("ann.subtitle")} actions={
        isStaff && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4" />{t("ann.new")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Editar comunicado" : t("ann.new")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>{t("common.title")}</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} /></div>
                <div><Label>{t("common.description")}</Label><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} maxLength={2000} /></div>
                <div>
                  <Label>{t("settings.role")}</Label>
                  <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("ann.audience.all")}</SelectItem>
                      <SelectItem value="supervisors">{t("ann.audience.supervisors")}</SelectItem>
                      <SelectItem value="vigias">{t("ann.audience.vigias")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>{t("common.cancel")}</Button>
                <Button onClick={() => create.mutate()} disabled={!form.title || !form.body || create.isPending}>{editing ? "Salvar" : t("common.create")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )
      } />

      <div className="space-y-3">
        {isLoading && <div className="text-sm text-muted-foreground">{t("common.loading")}</div>}
        {!isLoading && (data ?? []).length === 0 && <EmptyState icon={Megaphone} title={t("common.empty")} />}
        {(data ?? []).map((a) => {
          const author = (a as unknown as { profiles?: { full_name?: string } }).profiles;
          return (
            <article key={a.id} className="glass rounded-xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold">{a.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{author?.full_name ?? "—"} · {new Date(a.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Pill tone="info">{a.audience === "all" ? t("ann.audience.all") : a.audience === "supervisors" ? t("ann.audience.supervisors") : t("ann.audience.vigias")}</Pill>
                  {isStaff && <Button size="sm" variant="ghost" onClick={() => openEdit(a as Ann)}><Pencil className="h-3 w-3" /></Button>}
                  {canDelete && <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir comunicado?")) del.mutate(a.id); }}><Trash2 className="h-3 w-3" /></Button>}
                </div>
              </div>
              <p className="mt-3 text-sm whitespace-pre-wrap text-foreground/90">{a.body}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
