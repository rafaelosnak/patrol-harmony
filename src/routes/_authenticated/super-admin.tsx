import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Crown, Plus, Pencil, CheckCircle2, AlertCircle, Ban, UserPlus, Mail } from "lucide-react";
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
import {
  createCompanyWithAdmin, updateCompany, setCompanyStatus, registerCompanyPayment,
  createCompanyAdmin, listCompanyAdmins,
} from "@/lib/super-admin.functions";

export const Route = createFileRoute("/_authenticated/super-admin")({
  head: () => ({ meta: [{ title: "Super Admin — PhytonGuard" }] }),
  component: SuperAdminPage,
});

type Status = "active" | "suspended" | "overdue";
type Company = {
  id: string;
  name: string;
  cnpj: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  status: Status;
  monthly_fee: number;
  billing_day: number;
  due_date: string | null;
  last_payment_at: string | null;
  notes: string | null;
};

type FormState = {
  name: string; cnpj: string; contact_email: string; contact_phone: string; address: string;
  status: Status; monthly_fee: number; billing_day: number; due_date: string | null; notes: string;
  admin_full_name: string; admin_email: string; admin_password: string;
};

const emptyForm: FormState = {
  name: "", cnpj: "", contact_email: "", contact_phone: "", address: "",
  status: "active", monthly_fee: 0, billing_day: 5, due_date: null, notes: "",
  admin_full_name: "", admin_email: "", admin_password: "",
};

function SuperAdminPage() {
  const { isSuperAdmin, loading } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"active" | "overdue" | "suspended" | "all">("active");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const [adminOpen, setAdminOpen] = useState(false);
  const [adminTarget, setAdminTarget] = useState<Company | null>(null);
  const [adminForm, setAdminForm] = useState({ full_name: "", email: "", password: "" });

  const createFn = useServerFn(createCompanyWithAdmin);
  const updateFn = useServerFn(updateCompany);
  const statusFn = useServerFn(setCompanyStatus);
  const payFn = useServerFn(registerCompanyPayment);
  const createAdminFn = useServerFn(createCompanyAdmin);
  const listAdminsFn = useServerFn(listCompanyAdmins);

  const { data: companies, isLoading } = useQuery({
    queryKey: ["companies"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Company[];
    },
  });

  const filtered = useMemo(() => {
    const list = companies ?? [];
    if (filter === "all") return list;
    return list.filter((c) => c.status === filter);
  }, [companies, filter]);

  const counts = useMemo(() => {
    const list = companies ?? [];
    return {
      all: list.length,
      active: list.filter((c) => c.status === "active").length,
      overdue: list.filter((c) => c.status === "overdue").length,
      suspended: list.filter((c) => c.status === "suspended").length,
    };
  }, [companies]);

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        await updateFn({ data: { id: editing.id, ...stripAdmin(form) } });
      } else {
        await createFn({ data: { ...stripAdmin(form), admin_full_name: form.admin_full_name, admin_email: form.admin_email, admin_password: form.admin_password } });
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Empresa atualizada" : "Empresa e administrador criados");
      qc.invalidateQueries({ queryKey: ["companies"] });
      setOpen(false); setEditing(null); setForm(emptyForm);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const changeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) =>
      statusFn({ data: { id, status } }),
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const registerPayment = useMutation({
    mutationFn: async (c: Company) => payFn({ data: { id: c.id, billing_day: c.billing_day } }),
    onSuccess: () => {
      toast.success("Pagamento registrado");
      qc.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const createAdmin = useMutation({
    mutationFn: async () => {
      if (!adminTarget) throw new Error("Empresa não selecionada");
      return createAdminFn({ data: { company_id: adminTarget.id, ...adminForm } });
    },
    onSuccess: () => {
      toast.success("Administrador criado");
      setAdminOpen(false); setAdminTarget(null);
      setAdminForm({ full_name: "", email: "", password: "" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  if (loading) return <div className="text-sm text-muted-foreground">Carregando…</div>;
  if (!isSuperAdmin) return <Navigate to="/dashboard" />;

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (c: Company) => {
    setEditing(c);
    setForm({
      name: c.name, cnpj: c.cnpj ?? "", contact_email: c.contact_email ?? "",
      contact_phone: c.contact_phone ?? "", address: c.address ?? "",
      status: c.status, monthly_fee: c.monthly_fee, billing_day: c.billing_day,
      due_date: c.due_date, notes: c.notes ?? "",
      admin_full_name: "", admin_email: "", admin_password: "",
    });
    setOpen(true);
  };
  const openAddAdmin = (c: Company) => {
    setAdminTarget(c);
    setAdminForm({ full_name: "", email: "", password: "" });
    setAdminOpen(true);
  };

  const statusPill = (s: Status) => {
    if (s === "active") return <Pill tone="success">Ativo</Pill>;
    if (s === "overdue") return <Pill tone="warn">Inadimplente</Pill>;
    return <Pill tone="danger">Suspenso</Pill>;
  };

  const tabBtn = (key: typeof filter, label: string, count: number) => (
    <button
      key={key}
      onClick={() => setFilter(key)}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
        filter === key
          ? "bg-primary text-primary-foreground border-primary"
          : "border-border/60 text-muted-foreground hover:text-foreground"
      }`}
    >
      {label} <span className="opacity-70">({count})</span>
    </button>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Empresas clientes"
        subtitle="Cadastre empresas, crie o administrador delas e controle a mensalidade"
        actions={<Button onClick={openNew}><Plus className="h-4 w-4" /> Nova empresa</Button>}
      />

      <div className="flex flex-wrap gap-2">
        {tabBtn("active", "Ativas", counts.active)}
        {tabBtn("overdue", "Inadimplentes", counts.overdue)}
        {tabBtn("suspended", "Suspensas", counts.suspended)}
        {tabBtn("all", "Todas", counts.all)}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}
        {!isLoading && filtered.length === 0 && (
          <div className="text-sm text-muted-foreground col-span-full glass rounded-xl p-6 text-center">
            Nenhuma empresa nesta categoria.
          </div>
        )}
        {filtered.map((c) => (
          <CompanyCard
            key={c.id}
            c={c}
            statusPill={statusPill}
            onEdit={() => openEdit(c)}
            onAddAdmin={() => openAddAdmin(c)}
            onPay={() => registerPayment.mutate(c)}
            onSuspend={() => changeStatus.mutate({ id: c.id, status: "suspended" })}
            onActivate={() => changeStatus.mutate({ id: c.id, status: "active" })}
            onOverdue={() => changeStatus.mutate({ id: c.id, status: "overdue" })}
            fetchAdmins={() => listAdminsFn({ data: { company_id: c.id } })}
          />
        ))}
      </div>

      {/* Empresa + admin */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar empresa" : "Nova empresa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></div>
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="overdue">Inadimplente</SelectItem>
                    <SelectItem value="suspended">Suspenso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>E-mail de contato</Label><Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></div>
            <div><Label>Endereço</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Mensalidade (R$)</Label><Input type="number" step="0.01" value={form.monthly_fee} onChange={(e) => setForm({ ...form, monthly_fee: Number(e.target.value) })} /></div>
              <div><Label>Dia cobrança</Label><Input type="number" min={1} max={28} value={form.billing_day} onChange={(e) => setForm({ ...form, billing_day: Number(e.target.value) })} /></div>
              <div><Label>Vencimento</Label><Input type="date" value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value || null })} /></div>
            </div>
            <div><Label>Observações</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>

            {!editing && (
              <div className="rounded-lg border border-border/60 p-3 space-y-3 bg-muted/30">
                <div className="text-xs font-semibold uppercase text-muted-foreground">Administrador da empresa</div>
                <div><Label>Nome completo *</Label><Input value={form.admin_full_name} onChange={(e) => setForm({ ...form, admin_full_name: e.target.value })} /></div>
                <div><Label>E-mail de login *</Label><Input type="email" value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} /></div>
                <div><Label>Senha inicial *</Label><Input type="text" minLength={8} value={form.admin_password} onChange={(e) => setForm({ ...form, admin_password: e.target.value })} placeholder="mín. 8 caracteres" /></div>
                <p className="text-[11px] text-muted-foreground">Esse usuário fará a gestão de funcionários, escalas, viaturas e operação dentro da empresa.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || !form.name.trim() || (!editing && (!form.admin_email || !form.admin_password || !form.admin_full_name))}
            >
              {editing ? "Salvar" : "Cadastrar empresa + admin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Criar admin extra */}
      <Dialog open={adminOpen} onOpenChange={setAdminOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo admin — {adminTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome completo *</Label><Input value={adminForm.full_name} onChange={(e) => setAdminForm({ ...adminForm, full_name: e.target.value })} /></div>
            <div><Label>E-mail *</Label><Input type="email" value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} /></div>
            <div><Label>Senha *</Label><Input type="text" minLength={8} value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} placeholder="mín. 8 caracteres" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdminOpen(false)}>Cancelar</Button>
            <Button onClick={() => createAdmin.mutate()} disabled={createAdmin.isPending || !adminForm.email || !adminForm.password || !adminForm.full_name}>
              Criar admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function stripAdmin(f: FormState) {
  return {
    name: f.name, cnpj: f.cnpj, contact_email: f.contact_email, contact_phone: f.contact_phone,
    address: f.address, status: f.status, monthly_fee: f.monthly_fee, billing_day: f.billing_day,
    due_date: f.due_date, notes: f.notes,
  };
}

function CompanyCard({
  c, statusPill, onEdit, onAddAdmin, onPay, onSuspend, onActivate, onOverdue, fetchAdmins,
}: {
  c: Company;
  statusPill: (s: Status) => JSX.Element;
  onEdit: () => void;
  onAddAdmin: () => void;
  onPay: () => void;
  onSuspend: () => void;
  onActivate: () => void;
  onOverdue: () => void;
  fetchAdmins: () => Promise<Array<{ id: string; full_name: string; email: string | null }>>;
}) {
  const { data: admins } = useQuery({
    queryKey: ["company-admins", c.id],
    queryFn: fetchAdmins,
  });

  return (
    <div className="glass rounded-xl p-4 space-y-3">
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
        <div>💰 R$ {Number(c.monthly_fee).toFixed(2)}/mês • dia {c.billing_day}</div>
        {c.due_date && <div>Próximo vencimento: {new Date(c.due_date).toLocaleDateString("pt-BR")}</div>}
        {c.last_payment_at && <div>Último pagamento: {new Date(c.last_payment_at).toLocaleDateString("pt-BR")}</div>}
      </div>

      <div className="text-xs">
        <div className="font-medium text-foreground/80 mb-1 flex items-center gap-1"><Mail className="h-3 w-3" /> Admins</div>
        {(admins ?? []).length === 0 ? (
          <div className="text-muted-foreground italic">Nenhum admin — crie um para liberar acesso.</div>
        ) : (
          <ul className="space-y-0.5">
            {admins!.map((a) => (
              <li key={a.id} className="truncate text-muted-foreground">{a.full_name} <span className="opacity-70">— {a.email}</span></li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-1 pt-2 border-t border-border/40">
        <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="h-3 w-3" /> Editar</Button>
        <Button size="sm" variant="outline" onClick={onAddAdmin}><UserPlus className="h-3 w-3" /> Admin</Button>
        <Button size="sm" variant="outline" onClick={onPay}><CheckCircle2 className="h-3 w-3" /> Pagamento</Button>
        {c.status !== "suspended" ? (
          <Button size="sm" variant="ghost" onClick={onSuspend}><Ban className="h-3 w-3" /> Bloquear</Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={onActivate}><CheckCircle2 className="h-3 w-3" /> Reativar</Button>
        )}
        {c.status === "active" && (
          <Button size="sm" variant="ghost" onClick={onOverdue}><AlertCircle className="h-3 w-3" /> Inadimplente</Button>
        )}
      </div>
    </div>
  );
}
