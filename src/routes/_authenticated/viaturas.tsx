import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Truck, Plus } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/viaturas")({
  head: () => ({ meta: [{ title: "Viaturas — PhytonGuard" }] }),
  component: VehiclesPage,
});

function VehiclesPage() {
  const { t } = useI18n();
  const { isStaff } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ prefix: "", plate: "", model: "", unit_id: "", status: "available" });

  const { data, isLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => (await supabase.from("vehicles").select("*, units(name)").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: units } = useQuery({ queryKey: ["units-min"], queryFn: async () => (await supabase.from("units").select("id,name")).data ?? [] });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vehicles").insert({
        prefix: form.prefix, plate: form.plate, model: form.model || null,
        unit_id: form.unit_id || null, status: form.status,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Viatura cadastrada"); qc.invalidateQueries({ queryKey: ["vehicles"] }); setOpen(false); setForm({ prefix: "", plate: "", model: "", unit_id: "", status: "available" }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const tone = (s: string) => s === "patrol" ? "info" : s === "maintenance" ? "warn" : "success";
  const label = (s: string) => s === "patrol" ? t("vehicles.patrol") : s === "maintenance" ? t("vehicles.maintenance") : t("vehicles.available");

  return (
    <div className="space-y-4">
      <PageHeader title={t("vehicles.title")} subtitle={t("vehicles.subtitle")} actions={
        isStaff && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" />{t("vehicles.new")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("vehicles.new")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{t("common.prefix")}</Label><Input value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value })} maxLength={10} /></div>
                  <div><Label>{t("common.plate")}</Label><Input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })} maxLength={10} /></div>
                </div>
                <div><Label>{t("common.model")}</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} maxLength={60} /></div>
                <div>
                  <Label>{t("common.unit")}</Label>
                  <Select value={form.unit_id} onValueChange={(v) => setForm({ ...form, unit_id: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{(units ?? []).map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
                <Button onClick={() => create.mutate()} disabled={!form.prefix || !form.plate || create.isPending}>{t("common.create")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )
      } />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {isLoading && <div className="text-sm text-muted-foreground">{t("common.loading")}</div>}
        {!isLoading && (data ?? []).length === 0 && <div className="col-span-full"><EmptyState icon={Truck} title={t("common.empty")} /></div>}
        {(data ?? []).map((v) => {
          const unit = (v as unknown as { units?: { name?: string } }).units;
          return (
            <div key={v.id} className="glass rounded-xl p-4 hover:border-primary/40 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">{t("common.prefix")}</div>
                  <div className="text-xl font-bold font-mono">{v.prefix}</div>
                </div>
                <Pill tone={tone(v.status)}>{label(v.status)}</Pill>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="font-mono">{v.plate}</span>
                <span className="text-muted-foreground">{v.model ?? "—"}</span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">{unit?.name ?? "—"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
