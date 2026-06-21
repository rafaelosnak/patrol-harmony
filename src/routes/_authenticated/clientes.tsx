import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Building2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { EmptyState, PageHeader } from "@/components/pg/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({ meta: [{ title: "Clientes — PhytonGuard" }] }),
  component: ClientsPage,
});

function ClientsPage() {
  const { t } = useI18n();
  const { hasRole } = useAuth();
  const canWrite = hasRole("admin") || hasRole("supervisor");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", document: "", contact: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clients").insert({ name: form.name, document: form.document || null, contact: form.contact || null });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cliente cadastrado"); qc.invalidateQueries({ queryKey: ["clients"] }); setOpen(false); setForm({ name: "", document: "", contact: "" }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <div className="space-y-4">
      <PageHeader title={t("clients.title")} subtitle={t("clients.subtitle")} actions={
        canWrite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" />{t("clients.new")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("clients.new")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>{t("common.name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} /></div>
                <div><Label>{t("clients.document")}</Label><Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} maxLength={32} /></div>
                <div><Label>{t("clients.contact")}</Label><Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} maxLength={120} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
                <Button onClick={() => create.mutate()} disabled={!form.name || create.isPending}>{t("common.create")}</Button>
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
              <th className="text-left px-4 py-3">{t("clients.document")}</th>
              <th className="text-left px-4 py-3">{t("clients.contact")}</th>
              <th className="text-left px-4 py-3">{t("common.created")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {isLoading && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">{t("common.loading")}</td></tr>}
            {!isLoading && (data ?? []).length === 0 && <tr><td colSpan={4}><EmptyState icon={Building2} title={t("common.empty")} /></td></tr>}
            {(data ?? []).map((c) => (
              <tr key={c.id} className="hover:bg-accent/30">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.document ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.contact ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
