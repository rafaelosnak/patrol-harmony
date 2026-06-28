import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Truck, Plus, Pencil, Trash2 } from "lucide-react";
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
import { useStaffGuard } from "@/hooks/use-staff-guard";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/viaturas")({
  head: () => ({ meta: [{ title: "Viaturas — PhytonGuard" }] }),
  component: VehiclesPage,
});

type Vehicle = { id: string; prefix: string; plate: string; model: string | null; status: string };

function VehiclesPage() {
  const { allowed } = useStaffGuard();
  if (!allowed) return null;
  const { t } = useI18n();
  const { isStaff, hasRole, companyId } = useAuth();
  const canDelete = hasRole("admin");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState({ prefix: "", plate: "", model: "", status: "available" });

  const { data, isLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => (await supabase.from("vehicles").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        prefix: form.prefix, plate: form.plate, model: form.model || null,
        status: form.status,
      };
      if (editing) {
        const { error } = await supabase.from("vehicles").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vehicles").insert({ ...payload, company_id: companyId! });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Viatura atualizada" : "Viatura cadastrada");
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      setOpen(false); setEditing(null);
      setForm({ prefix: "", plate: "", model: "", status: "available" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("vehicles").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Viatura removida"); qc.invalidateQueries({ queryKey: ["vehicles"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const openNew = () => { setEditing(null); setForm({ prefix: "", plate: "", model: "", status: "available" }); setOpen(true); };
  const openEdit = (v: Vehicle) => { setEditing(v); setForm({ prefix: v.prefix, plate: v.plate, model: v.model ?? "", status: v.status }); setOpen(true); };

  const tone = (s: string) => s === "patrol" ? "info" : s === "maintenance" ? "warn" : "success";
  const label = (s: string) => s === "patrol" ? t("vehicles.patrol") : s === "maintenance" ? t("vehicles.maintenance") : t("vehicles.available");

  return (
    <div className="space-y-4">
      <PageHeader title={t("vehicles.title")} subtitle={t("vehicles.subtitle")} actions={
        isStaff && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4" />{t("vehicles.new")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Editar viatura" : t("vehicles.new")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{t("common.prefix")}</Label><Input value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value })} maxLength={10} /></div>
                  <div><Label>{t("common.plate")}</Label><Input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })} maxLength={10} /></div>
                </div>
                <div><Label>{t("common.model")}</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} maxLength={60} /></div>
                <div>
                  <Label>{t("common.status")}</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">{t("vehicles.available")}</SelectItem>
                      <SelectItem value="patrol">{t("vehicles.patrol")}</SelectItem>
                      <SelectItem value="maintenance">{t("vehicles.maintenance")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>{t("common.cancel")}</Button>
                <Button onClick={() => save.mutate()} disabled={!form.prefix || !form.plate || save.isPending}>{editing ? "Salvar" : t("common.create")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )
      } />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {isLoading && <div className="text-sm text-muted-foreground">{t("common.loading")}</div>}
        {!isLoading && (data ?? []).length === 0 && <div className="col-span-full"><EmptyState icon={Truck} title={t("common.empty")} /></div>}
        {(data ?? []).map((v) => (
          <div key={v.id} className="glass rounded-xl p-4 hover:border-primary/40 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase text-muted-foreground">{t("common.prefix")}</div>
                <div className="text-xl font-bold font-mono">{v.prefix}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Pill tone={tone(v.status)}>{label(v.status)}</Pill>
                {isStaff && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(v as Vehicle)}><Pencil className="h-3 w-3" /></Button>
                    {canDelete && <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir viatura?")) del.mutate(v.id); }}><Trash2 className="h-3 w-3" /></Button>}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="font-mono">{v.plate}</span>
              <span className="text-muted-foreground">{v.model ?? "—"}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
