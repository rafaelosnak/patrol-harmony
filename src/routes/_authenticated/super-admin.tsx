import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Crown, Plus, Pencil, CheckCircle2, AlertCircle, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Pill } from "@/components/pg/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/super-admin")({
  head: () => ({ meta: [{ title: "Super Admin — PhytonGuard" }] }),
  component: SuperAdminPage,
});

type Company = {
  id: string;
  name: string;
  cnpj: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  status: "active" | "suspended" | "overdue";
  monthly_fee: number;
  billing_day: number;
  due_date: string | null;
  last_payment_at: string | null;
  notes: string | null;
};

const emptyForm: Omit<Company, "id" | "last_payment_at"> = {
  name: "", cnpj: "", contact_email: "", contact_phone: "", address: "",
  status: "active", monthly_fee: 0, billing_day: 5, due_date: null, notes: "",
};

function SuperAdminPage() {
  const { isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);

  const { data: companies, isLoading } = useQuery({
    queryKey: ["companies"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Company[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        cnpj: form.cnpj || null,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        address: form.address || null,
        status: form.status,
        monthly_fee: Number(form.monthly_fee) || 0,
        billing_day: Number(form.billing_day) || 1,
        due_date: form.due_date || null,
        notes: form.notes || null,
      };
      if (editing) {
        const { error } = await supabase.from("companies").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("companies").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Empresa atualizada" : "Empresa cadastrada");
      qc.invalidateQueries({ queryKey: ["companies"] });
      setOpen(false); setEditing(null); setForm(emptyForm);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const changeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Company["status"] }) => {
      const { error } = await supabase.from("companies").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const registerPayment = useMutation({
    mutationFn: async (c: Company) => {
      const next = new Date();
      next.setMonth(next.getMonth() + 1);
      next.setDate(c.billing_day);
      const { error } = await supabase.from("companies").update({
        status: "active",
        last_payment_at: new Date().toISOString(),
        due_date: next.toISOString().slice(0, 10),
      }).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pagamento registrado");
      qc.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  if (!isSuperAdmin) return <Navigate to="/dashboard" />;

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (c: Company) => {
    setEditing(c);
    setForm({
      name: c.name, cnpj: c.cnpj ?? "", contact_email: c.contact_email ?? "",
      contact_phone: c.contact_phone ?? "", address: c.address ?? "",
      status: c.status, monthly_fee: c.monthly_fee, billing_day: c.billing_day,
      due_date: c.due_date, notes: c.notes ?? "",
    });
    setOpen(true);
  };

  const statusPill = (s: Company["status"]) => {
    if (s === "active") return <Pill tone="success">Ativo</Pill>;
    if (s === "overdue") return <Pill tone="warn">Inadimplente</Pill>;
    return <Pill tone="danger">Suspenso</Pill>;
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Empresas (Super Admin)"
        subtitle="Gerencie todas as empresas que usam o PhytonGuard"
        actions={<Button onClick={openNew}><Plus className="h-4 w-4" /> Nova empresa</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}
        {(companies ?? []).map((c) => (
          <div key={c.id} className="glass rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold truncate">{c.name}</h3>
                </div>
                {c.cnpj && <div className="text-xs text-muted-foreground mt-0.5">CNPJ: {c.cnpj}</div>}
              </div>
              {statusPill(c.status)}
            </div>

            <div className="text-xs space-y-1 text-muted-foreground">
              {c.contact_email && <div>📧 {c.contact_email}</div>}
              {c.contact_phone && <div>📞 {c.contact_phone}</div>}
              <div>💰 R$ {Number(c.monthly_fee).toFixed(2)}/mês • vencimento dia {c.billing_day}</div>
              {c.due_date && <div>Próximo vencimento: {new Date(c.due_date).toLocaleDateString("pt-BR")}</div>}
              {c.last_payment_at && <div>Último pagamento: {new Date(c.last_payment_at).toLocaleDateString("pt-BR")}</div>}
            </div>

            <div className="flex flex-wrap gap-1 pt-2 border-t border-border/40">
              <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                <Pencil className="h-3 w-3" /> Editar
              </Button>
              <Button size="sm" variant="outline" onClick={() => registerPayment.mutate(c)}>
                <CheckCircle2 className="h-3 w-3" /> Pagamento
              </Button>
              {c.status !== "suspended" ? (
                <Button size="sm" variant="ghost" onClick={() => changeStatus.mutate({ id: c.id, status: "suspended" })}>
                  <Ban className="h-3 w-3" /> Bloquear
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => changeStatus.mutate({ id: c.id, status: "active" })}>
                  <CheckCircle2 className="h-3 w-3" /> Reativar
                </Button>
              )}
              {c.status === "active" && (
                <Button size="sm" variant="ghost" onClick={() => changeStatus.mutate({ id: c.id, status: "overdue" })}>
                  <AlertCircle className="h-3 w-3" /> Marcar inadimplente
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar empresa" : "Nova empresa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>CNPJ</Label><Input value={form.cnpj ?? ""} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></div>
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Company["status"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="overdue">Inadimplente</SelectItem>
                    <SelectItem value="suspended">Suspenso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>E-mail de contato</Label><Input type="email" value={form.contact_email ?? ""} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input value={form.contact_phone ?? ""} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></div>
            <div><Label>Endereço</Label><Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Mensalidade (R$)</Label><Input type="number" step="0.01" value={form.monthly_fee} onChange={(e) => setForm({ ...form, monthly_fee: Number(e.target.value) })} /></div>
              <div><Label>Dia cobrança</Label><Input type="number" min={1} max={28} value={form.billing_day} onChange={(e) => setForm({ ...form, billing_day: Number(e.target.value) })} /></div>
              <div><Label>Vencimento</Label><Input type="date" value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value || null })} /></div>
            </div>
            <div><Label>Observações</Label><Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={!form.name.trim() || save.isPending}>
              {editing ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
