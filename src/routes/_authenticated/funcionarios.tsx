import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserPlus, Shield, Trash2, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { createEmployee, deleteEmployee, updateEmployeeRole } from "@/lib/employees.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/funcionarios")({
  component: EmployeesPage,
});

type Row = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  role: AppRole | null;
};

const ROLES: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "coordenador", label: "Coordenador" },
  { value: "supervisor", label: "Supervisor (privilégios de admin)" },
  { value: "central", label: "Central" },
  { value: "vigia", label: "Vigia" },
];

function EmployeesPage() {
  const { hasRole, user } = useAuth();
  const isAdmin = hasRole("admin");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const create = useServerFn(createEmployee);
  const remove = useServerFn(deleteEmployee);
  const updateRole = useServerFn(updateEmployeeRole);

  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "", role: "vigia" as AppRole });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email, phone, status");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const roleMap = new Map<string, AppRole>();
    (roles ?? []).forEach((r) => roleMap.set(r.user_id, r.role as AppRole));
    setRows(((profiles ?? []) as Omit<Row, "role">[]).map((p) => ({ ...p, role: roleMap.get(p.id) ?? null })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await create({ data: form });
      toast.success("Funcionário cadastrado");
      setForm({ full_name: "", email: "", phone: "", password: "", role: "vigia" });
      setOpenNew(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cadastrar");
    } finally { setSubmitting(false); }
  };

  const onChangeRole = async (uid: string, role: AppRole) => {
    try {
      await updateRole({ data: { user_id: uid, role } });
      toast.success("Papel atualizado");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar");
    }
  };

  const onDelete = async (uid: string) => {
    if (!confirm("Remover este funcionário? Esta ação é permanente.")) return;
    try {
      await remove({ data: { user_id: uid } });
      toast.success("Funcionário removido");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /> Funcionários</h1>
          <p className="text-sm text-muted-foreground">Cadastro de vigias, supervisores e equipe administrativa.</p>
        </div>
        {isAdmin && (
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button><UserPlus className="h-4 w-4 mr-2" /> Novo funcionário</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Cadastrar funcionário</DialogTitle></DialogHeader>
              <form onSubmit={onCreate} className="space-y-3">
                <div>
                  <Label>Nome completo</Label>
                  <Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>E-mail</Label>
                    <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Senha inicial</Label>
                    <Input type="text" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  </div>
                  <div>
                    <Label>Função</Label>
                    <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Supervisores recebem privilégios administrativos (gerenciam rondas, ocorrências e equipes).
                </p>
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setOpenNew(false)}>Cancelar</Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cadastrar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Função</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum funcionário ainda.</TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.full_name}</TableCell>
                <TableCell className="text-muted-foreground">{r.email}</TableCell>
                <TableCell className="text-muted-foreground">{r.phone ?? "—"}</TableCell>
                <TableCell>
                  {isAdmin ? (
                    <Select value={r.role ?? "vigia"} onValueChange={(v) => onChangeRole(r.id, v as AppRole)}>
                      <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : <Badge variant="outline">{r.role ?? "—"}</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  {isAdmin && r.id !== user?.id && (
                    <Button variant="ghost" size="icon" onClick={() => onDelete(r.id)} aria-label="Remover">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
