import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarClock, Plus } from "lucide-react";
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

function ShiftsPage() {
  const { t } = useI18n();
  const { isStaff } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [form, setForm] = useState({
    user_id: "", unit_id: "", shift_type: "12x36",
    start_at: today.toISOString().slice(0, 16),
    end_at: new Date(today.getTime() + 12 * 3600000).toISOString().slice(0, 16),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["shifts"],
    queryFn: async () => (await supabase.from("shifts").select("*, profiles!shifts_user_id_fkey(full_name), units(name)").order("start_at", { ascending: false }).limit(100)).data ?? [],
  });
  const { data: people } = useQuery({ queryKey: ["profiles-min"], queryFn: async () => (await supabase.from("profiles").select("id,full_name")).data ?? [] });
  const { data: units } = useQuery({ queryKey: ["units-min"], queryFn: async () => (await supabase.from("units").select("id,name")).data ?? [] });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("shifts").insert({
        user_id: form.user_id, unit_id: form.unit_id || null, shift_type: form.shift_type,
        start_at: new Date(form.start_at).toISOString(), end_at: new Date(form.end_at).toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Escala criada"); qc.invalidateQueries({ queryKey: ["shifts"] }); setOpen(false); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <div className="space-y-4">
      <PageHeader title={t("shifts.title")} subtitle={t("shifts.subtitle")} actions={
        isStaff && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" />{t("shifts.new")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("shifts.new")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>{t("common.name")}</Label>
                  <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{(people ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("common.unit")}</Label>
                  <Select value={form.unit_id} onValueChange={(v) => setForm({ ...form, unit_id: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{(units ?? []).map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
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
                <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
                <Button onClick={() => create.mutate()} disabled={!form.user_id || create.isPending}>{t("common.create")}</Button>
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
              <th className="text-left px-4 py-3">{t("common.unit")}</th>
              <th className="text-left px-4 py-3">{t("common.type")}</th>
              <th className="text-left px-4 py-3">{t("common.start")}</th>
              <th className="text-left px-4 py-3">{t("common.end")}</th>
              <th className="text-left px-4 py-3">{t("common.status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">{t("common.loading")}</td></tr>}
            {!isLoading && (data ?? []).length === 0 && <tr><td colSpan={6}><EmptyState icon={CalendarClock} title={t("common.empty")} /></td></tr>}
            {(data ?? []).map((s) => {
              const profile = (s as unknown as { profiles?: { full_name?: string } }).profiles;
              const unit = (s as unknown as { units?: { name?: string } }).units;
              return (
                <tr key={s.id} className="hover:bg-accent/30">
                  <td className="px-4 py-3 font-medium">{profile?.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{unit?.name ?? "—"}</td>
                  <td className="px-4 py-3"><Pill tone="info">{s.shift_type}</Pill></td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(s.start_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(s.end_at).toLocaleString()}</td>
                  <td className="px-4 py-3"><Pill>{s.status}</Pill></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
