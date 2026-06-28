import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { AlertOctagon, Paperclip, Pencil, Plus, Trash2 } from "lucide-react";
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
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ocorrencias")({
  head: () => ({ meta: [{ title: "Ocorrências — PhytonGuard" }] }),
  component: OccPage,
});

const TYPES = ["invasion", "suspect", "theft", "damage", "operational"] as const;
const SEVS = ["low", "medium", "high", "critical"] as const;

function OccPage() {
  const { t } = useI18n();
  const { user, hasRole, isStaff, companyId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", type: "operational", severity: "medium" });
  const [editing, setEditing] = useState<null | { id: string; title: string; description: string; type: string; severity: string; status: string }>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["occurrences"],
    queryFn: async () => (await supabase.from("occurrences").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("occurrences").insert({
        user_id: user.id, title: form.title, description: form.description,
        type: form.type, severity: form.severity, company_id: companyId!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ocorrência registrada"); qc.invalidateQueries({ queryKey: ["occurrences"] });
      setOpen(false); setForm({ title: "", description: "", type: "operational", severity: "medium" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("Nada para atualizar");
      const { error } = await supabase.from("occurrences").update({
        title: editing.title, description: editing.description,
        type: editing.type, severity: editing.severity, status: editing.status,
        closed_at: editing.status === "closed" ? new Date().toISOString() : null,
      }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ocorrência atualizada"); qc.invalidateQueries({ queryKey: ["occurrences"] });
      setEditing(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("occurrences").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Ocorrência excluída"); qc.invalidateQueries({ queryKey: ["occurrences"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const close = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("occurrences").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Ocorrência encerrada"); qc.invalidateQueries({ queryKey: ["occurrences"] }); },
  });

  return (
    <div className="space-y-4">
      <PageHeader title={t("occ.title")} subtitle={t("occ.subtitle")} actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" />{t("occ.new")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("occ.new")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{t("common.title")}</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={140} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("common.type")}</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPES.map((tp) => <SelectItem key={tp} value={tp}>{t(`occ.types.${tp}` as never)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("common.severity")}</Label>
                  <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SEVS.map((s) => <SelectItem key={s} value={s}>{t(`occ.sev.${s}` as never)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>{t("common.description")}</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} maxLength={1000} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={() => create.mutate()} disabled={!form.title || create.isPending}>{t("common.create")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      } />

      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground bg-card/40">
            <tr>
              <th className="text-left px-4 py-3">{t("common.title")}</th>
              <th className="text-left px-4 py-3">{t("common.type")}</th>
              <th className="text-left px-4 py-3">{t("common.severity")}</th>
              <th className="text-left px-4 py-3">{t("common.status")}</th>
              <th className="text-left px-4 py-3">{t("common.created")}</th>
              <th className="text-right px-4 py-3">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">{t("common.loading")}</td></tr>}
            {!isLoading && (data ?? []).length === 0 && <tr><td colSpan={6}><EmptyState icon={AlertOctagon} title={t("common.empty")} /></td></tr>}
            {(data ?? []).map((o) => (
              <tr key={o.id} className="hover:bg-accent/30">
                <td className="px-4 py-3 font-medium">{o.title}</td>
                <td className="px-4 py-3 text-muted-foreground capitalize">{t(`occ.types.${o.type}` as never)}</td>
                <td className="px-4 py-3"><Pill tone={o.severity === "critical" || o.severity === "high" ? "danger" : o.severity === "medium" ? "warn" : "default"}>{t(`occ.sev.${o.severity}` as never)}</Pill></td>
                <td className="px-4 py-3"><Pill tone={o.status === "closed" ? "default" : o.status === "in_progress" ? "warn" : "danger"}>{t(`occ.status.${o.status === "in_progress" ? "inprogress" : o.status}` as never)}</Pill></td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(o.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  {o.status !== "closed" && (
                    <Button size="sm" variant="outline" onClick={() => close.mutate(o.id)}>{t("occ.close")}</Button>
                  )}
                  {isStaff && (
                    <Button size="sm" variant="ghost" title="Editar" onClick={() => setEditing({
                      id: o.id, title: o.title ?? "", description: o.description ?? "",
                      type: o.type, severity: o.severity, status: o.status,
                    })}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                  {hasRole("admin") && (
                    <Button size="sm" variant="ghost" title="Excluir"
                      onClick={() => { if (confirm("Excluir esta ocorrência?")) remove.mutate(o.id); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar ocorrência</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>{t("common.title")}</Label>
                <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} maxLength={140} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("common.type")}</Label>
                  <Select value={editing.type} onValueChange={(v) => setEditing({ ...editing, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPES.map((tp) => <SelectItem key={tp} value={tp}>{t(`occ.types.${tp}` as never)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("common.severity")}</Label>
                  <Select value={editing.severity} onValueChange={(v) => setEditing({ ...editing, severity: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SEVS.map((s) => <SelectItem key={s} value={s}>{t(`occ.sev.${s}` as never)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>{t("common.status")}</Label>
                <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Aberta</SelectItem>
                    <SelectItem value="in_progress">Em andamento</SelectItem>
                    <SelectItem value="closed">Encerrada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("common.description")}</Label>
                <Textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={4} maxLength={1000} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>{t("common.cancel")}</Button>
            <Button onClick={() => update.mutate()} disabled={!editing?.title || update.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
