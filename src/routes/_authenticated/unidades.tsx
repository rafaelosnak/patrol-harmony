import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { EmptyState, PageHeader } from "@/components/pg/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/unidades")({
  head: () => ({ meta: [{ title: "Unidades — PhytonGuard" }] }),
  component: UnitsPage,
});

type Unit = { id: string; name: string; client_id: string | null; address: string | null };

function UnitsPage() {
  const { t } = useI18n();
  const { hasRole } = useAuth();
  const canWrite = hasRole("admin") || hasRole("supervisor");
  const canDelete = hasRole("admin");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [form, setForm] = useState({ name: "", client_id: "", address: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["units"],
    queryFn: async () => (await supabase.from("units").select("*, clients(name)").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: clients } = useQuery({ queryKey: ["clients-min"], queryFn: async () => (await supabase.from("clients").select("id,name")).data ?? [] });

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from("units").update({
          name: form.name, client_id: form.client_id || null, address: form.address || null,
        }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("units").insert({
          name: form.name, client_id: form.client_id || null, address: form.address || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Unidade atualizada" : "Unidade cadastrada");
      qc.invalidateQueries({ queryKey: ["units"] });
      setOpen(false); setEditing(null); setForm({ name: "", client_id: "", address: "" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("units").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Unidade removida"); qc.invalidateQueries({ queryKey: ["units"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const openNew = () => { setEditing(null); setForm({ name: "", client_id: "", address: "" }); setOpen(true); };
  const openEdit = (u: Unit) => { setEditing(u); setForm({ name: u.name, client_id: u.client_id ?? "", address: u.address ?? "" }); setOpen(true); };

  return (
    <div className="space-y-4">
      <PageHeader title={t("units.title")} subtitle={t("units.subtitle")} actions={
        canWrite && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4" />{t("units.new")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Editar unidade" : t("units.new")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>{t("common.name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} /></div>
                <div>
                  <Label>{t("common.client")}</Label>
                  <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{(clients ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>{t("common.address")}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={200} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>{t("common.cancel")}</Button>
                <Button onClick={() => save.mutate()} disabled={!form.name || save.isPending}>{editing ? "Salvar" : t("common.create")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )
      } />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {isLoading && <div className="text-sm text-muted-foreground">{t("common.loading")}</div>}
        {!isLoading && (data ?? []).length === 0 && <div className="col-span-full"><EmptyState icon={MapPin} title={t("common.empty")} /></div>}
        {(data ?? []).map((u) => {
          const client = (u as unknown as { clients?: { name?: string } }).clients;
          return (
            <div key={u.id} className="glass rounded-xl p-4 hover:border-primary/40 transition-colors">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/15 grid place-items-center text-primary"><MapPin className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{u.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{client?.name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">{u.address ?? "—"}</div>
                </div>
                {canWrite && (
                  <div className="flex flex-col gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(u as Unit)}><Pencil className="h-3 w-3" /></Button>
                    {canDelete && <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir unidade?")) del.mutate(u.id); }}><Trash2 className="h-3 w-3" /></Button>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
