import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserPlus, Shield, Trash2, Loader2, Pencil, FileText, Upload, Download, X, Building2, KeyRound } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { useStaffGuard } from "@/hooks/use-staff-guard";
import { createEmployee, deleteEmployee, updateEmployee, updateEmployeeRole, resetEmployeePassword, type EmployeeProfileInput } from "@/lib/employees.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  cpf: string | null;
  rg: string | null;
  birth_date: string | null;
  hired_at: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_district: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  notes: string | null;
  status: string;
  role: AppRole | null;
  avatar_url: string | null;
};

const ROLES: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "supervisor", label: "Supervisor (mesmos acessos do admin)" },
  { value: "central", label: "Central de Apoio (suporte ao vigia)" },
  { value: "vigia", label: "Vigia" },
];

const emptyProfile: EmployeeProfileInput = {
  full_name: "", phone: "", cpf: "", rg: "", birth_date: "", hired_at: "",
  address_street: "", address_number: "", address_complement: "",
  address_district: "", address_city: "", address_state: "", address_zip: "", notes: "",
  avatar_url: "",
};

function EmployeesPage() {
  useStaffGuard();
  const { hasRole, user } = useAuth();
  const isStaff = hasRole("admin") || hasRole("supervisor");
  const isAdmin = isStaff;
  const [rows, setRows] = useState<Row[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [docsFor, setDocsFor] = useState<Row | null>(null);
  const create = useServerFn(createEmployee);
  const update = useServerFn(updateEmployee);
  const remove = useServerFn(deleteEmployee);
  const updateRole = useServerFn(updateEmployeeRole);
  const resetPwd = useServerFn(resetEmployeePassword);
  const [pwdFor, setPwdFor] = useState<Row | null>(null);
  const [newPwd, setNewPwd] = useState("");

  const [form, setForm] = useState<EmployeeProfileInput & { email: string; password: string; role: AppRole; client_ids: string[] }>({
    ...emptyProfile, email: "", password: "", role: "vigia", client_ids: [],
  });
  const [editForm, setEditForm] = useState<EmployeeProfileInput & { client_ids: string[] }>({ ...emptyProfile, client_ids: [] });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }, { data: cls }, { data: ces }] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("clients").select("id,name").order("name"),
      supabase.from("client_employees").select("user_id,client_id"),
    ]);
    const roleMap = new Map<string, AppRole>();
    (roles ?? []).forEach((r) => roleMap.set(r.user_id, r.role as AppRole));
    setRows(((profiles ?? []) as Omit<Row, "role">[]).map((p) => ({ ...p, role: roleMap.get(p.id) ?? null })));
    setClients((cls ?? []) as { id: string; name: string }[]);
    const map: Record<string, string[]> = {};
    ((ces ?? []) as { user_id: string; client_id: string }[]).forEach((r) => {
      (map[r.user_id] ||= []).push(r.client_id);
    });
    setAssignments(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (editing) {
      setEditForm({
        full_name: editing.full_name, phone: editing.phone ?? "", cpf: editing.cpf ?? "",
        rg: editing.rg ?? "", birth_date: editing.birth_date ?? "", hired_at: editing.hired_at ?? "",
        address_street: editing.address_street ?? "", address_number: editing.address_number ?? "",
        address_complement: editing.address_complement ?? "", address_district: editing.address_district ?? "",
        address_city: editing.address_city ?? "", address_state: editing.address_state ?? "",
        address_zip: editing.address_zip ?? "", notes: editing.notes ?? "",
        avatar_url: editing.avatar_url ?? "",
        client_ids: assignments[editing.id] ?? [],
      });
    }
  }, [editing, assignments]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await create({ data: form });
      toast.success("Funcionário cadastrado");
      setForm({ ...emptyProfile, email: "", password: "", role: "vigia", client_ids: [] });
      setOpenNew(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cadastrar");
    } finally { setSubmitting(false); }
  };

  const onSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSubmitting(true);
    try {
      await update({ data: { user_id: editing.id, ...editForm } });
      toast.success("Funcionário atualizado");
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar");
    } finally { setSubmitting(false); }
  };

  const onChangeRole = async (uid: string, role: AppRole) => {
    try { await updateRole({ data: { user_id: uid, role } }); toast.success("Papel atualizado"); load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Erro"); }
  };

  const onDelete = async (uid: string) => {
    if (!confirm("Remover este funcionário? Esta ação é permanente.")) return;
    try { await remove({ data: { user_id: uid } }); toast.success("Funcionário removido"); load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Erro"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /> Funcionários</h1>
          <p className="text-sm text-muted-foreground">Cadastro completo: dados pessoais, endereço e documentos.</p>
        </div>
        {isAdmin && (
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button><UserPlus className="h-4 w-4 mr-2" /> Novo funcionário</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Cadastrar funcionário</DialogTitle></DialogHeader>
              <form onSubmit={onCreate} className="space-y-4">
                <ProfileFields value={form} onChange={(v) => setForm({ ...form, ...v })} />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-border/60">
                  <div className="md:col-span-1">
                    <Label>E-mail *</Label>
                    <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div>
                    <Label>Senha inicial *</Label>
                    <Input type="text" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  </div>
                  <div>
                    <Label>Função *</Label>
                    <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <ClientPicker
                  clients={clients}
                  value={form.client_ids}
                  onChange={(ids) => setForm({ ...form, client_ids: ids })}
                />
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
              <TableHead>CPF</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Clientes</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum funcionário ainda.</TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.full_name}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{r.cpf ?? "—"}</TableCell>
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
                <TableCell className="text-xs text-muted-foreground max-w-[220px]">
                  {(() => {
                    const ids = assignments[r.id] ?? [];
                    if (ids.length === 0) return "—";
                    const names = ids.map((id) => clients.find((c) => c.id === id)?.name).filter(Boolean) as string[];
                    return (
                      <div className="flex flex-wrap gap-1">
                        {names.slice(0, 3).map((n) => <Badge key={n} variant="secondary" className="text-[10px]">{n}</Badge>)}
                        {names.length > 3 && <span className="text-[10px]">+{names.length - 3}</span>}
                      </div>
                    );
                  })()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {isStaff && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => setDocsFor(r)} aria-label="Documentos" title="Documentos">
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setEditing(r)} aria-label="Editar" title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {isAdmin && r.id !== user?.id && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => { setPwdFor(r); setNewPwd(""); }} aria-label="Trocar senha" title="Trocar senha">
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onDelete(r.id)} aria-label="Remover">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar funcionário — {editing?.full_name}</DialogTitle></DialogHeader>
          <form onSubmit={onSaveEdit} className="space-y-4">
            <ProfileFields value={editForm} onChange={(v) => setEditForm({ ...editForm, ...v })} />
            <ClientPicker
              clients={clients}
              value={editForm.client_ids}
              onChange={(ids) => setEditForm({ ...editForm, client_ids: ids })}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Documents dialog */}
      <DocumentsDialog row={docsFor} onClose={() => setDocsFor(null)} canManage={isStaff} />
    </div>
  );
}

function ClientPicker({ clients, value, onChange }: { clients: { id: string; name: string }[]; value: string[]; onChange: (ids: string[]) => void }) {
  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  };
  return (
    <div className="pt-2 border-t border-border/60">
      <div className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1">
        <Building2 className="h-3 w-3" /> Clientes atendidos por este funcionário
      </div>
      {clients.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum cliente cadastrado ainda.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto rounded-md border border-border/60 p-2">
          {clients.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/40 rounded px-2 py-1">
              <Checkbox checked={value.includes(c.id)} onCheckedChange={() => toggle(c.id)} />
              <span className="truncate">{c.name}</span>
            </label>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground mt-1">Esses vínculos aparecem nos relatórios para identificar qual cliente foi atendido.</p>
    </div>
  );
}

function ProfileFields({ value, onChange }: { value: EmployeeProfileInput; onChange: (v: Partial<EmployeeProfileInput>) => void }) {
  return (
    <div className="space-y-4">
      <AvatarUploader value={value.avatar_url ?? ""} onChange={(v) => onChange({ avatar_url: v })} />

      <div>
        <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Dados pessoais</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <Label>Nome completo *</Label>
            <Input required value={value.full_name} onChange={(e) => onChange({ full_name: e.target.value })} />
          </div>
          <div><Label>CPF</Label><Input value={value.cpf ?? ""} onChange={(e) => onChange({ cpf: e.target.value })} placeholder="000.000.000-00" /></div>
          <div><Label>RG</Label><Input value={value.rg ?? ""} onChange={(e) => onChange({ rg: e.target.value })} /></div>
          <div><Label>Data de nascimento</Label><Input type="date" value={value.birth_date ?? ""} onChange={(e) => onChange({ birth_date: e.target.value })} /></div>
          <div><Label>Data de admissão</Label><Input type="date" value={value.hired_at ?? ""} onChange={(e) => onChange({ hired_at: e.target.value })} /></div>
          <div><Label>Telefone</Label><Input value={value.phone ?? ""} onChange={(e) => onChange({ phone: e.target.value })} placeholder="(11) 99999-9999" /></div>
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Endereço</div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2"><Label>CEP</Label><Input value={value.address_zip ?? ""} onChange={(e) => onChange({ address_zip: e.target.value })} /></div>
          <div className="md:col-span-4"><Label>Rua</Label><Input value={value.address_street ?? ""} onChange={(e) => onChange({ address_street: e.target.value })} /></div>
          <div className="md:col-span-1"><Label>Número</Label><Input value={value.address_number ?? ""} onChange={(e) => onChange({ address_number: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Complemento</Label><Input value={value.address_complement ?? ""} onChange={(e) => onChange({ address_complement: e.target.value })} /></div>
          <div className="md:col-span-3"><Label>Bairro</Label><Input value={value.address_district ?? ""} onChange={(e) => onChange({ address_district: e.target.value })} /></div>
          <div className="md:col-span-4"><Label>Cidade</Label><Input value={value.address_city ?? ""} onChange={(e) => onChange({ address_city: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>UF</Label><Input maxLength={2} value={value.address_state ?? ""} onChange={(e) => onChange({ address_state: e.target.value.toUpperCase() })} /></div>
        </div>
      </div>

      <div>
        <Label>Observações</Label>
        <Textarea rows={3} value={value.notes ?? ""} onChange={(e) => onChange({ notes: e.target.value })} placeholder="Anotações internas, restrições, treinamentos..." />
      </div>
    </div>
  );
}

function AvatarUploader({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!value) { setSignedUrl(null); return; }
    supabase.storage.from("avatars").createSignedUrl(value, 3600).then(({ data }) => {
      if (alive) setSignedUrl(data?.signedUrl ?? null);
    });
    return () => { alive = false; };
  }, [value]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem maior que 5MB"); return; }
    setUploading(true);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, {
      contentType: file.type, upsert: false,
    });
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (error) { toast.error(error.message); return; }
    onChange(path);
    toast.success("Foto carregada");
  };

  return (
    <div className="flex items-center gap-4 pb-3 border-b border-border/60">
      <div className="h-20 w-20 rounded-full overflow-hidden bg-muted grid place-items-center border border-border/60 shrink-0">
        {signedUrl ? (
          <img src={signedUrl} alt="Avatar" className="h-full w-full object-cover" />
        ) : (
          <UserPlus className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1">
        <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Foto do funcionário</div>
        <p className="text-xs text-muted-foreground mb-2">Aparece no topo quando o funcionário logar.</p>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            {value ? "Trocar foto" : "Enviar foto"}
          </Button>
          {value && (
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")}>
              <X className="h-3 w-3" /> Remover
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

type DocItem = { name: string; size: number; created_at: string };

function DocumentsDialog({ row, onClose, canManage }: { row: Row | null; onClose: () => void; canManage: boolean }) {
  const [files, setFiles] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = async (uid: string) => {
    setLoading(true);
    const { data, error } = await supabase.storage.from("employee-docs").list(uid, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
    if (error) toast.error(error.message);
    setFiles((data ?? []).filter((f) => f.name !== ".emptyFolderPlaceholder").map((f) => ({
      name: f.name, size: (f.metadata as { size?: number } | null)?.size ?? 0, created_at: f.created_at ?? "",
    })));
    setLoading(false);
  };

  useEffect(() => { if (row) reload(row.id); else setFiles([]); }, [row]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !row) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("Arquivo maior que 20MB"); return; }
    setUploading(true);
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${row.id}/${Date.now()}_${safe}`;
    const { error } = await supabase.storage.from("employee-docs").upload(path, file);
    if (error) toast.error(error.message); else toast.success("Documento enviado");
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    reload(row.id);
  };

  const onDownload = async (name: string) => {
    if (!row) return;
    const { data, error } = await supabase.storage.from("employee-docs").createSignedUrl(`${row.id}/${name}`, 60);
    if (error || !data) { toast.error(error?.message ?? "Erro"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const onDelete = async (name: string) => {
    if (!row || !confirm("Excluir este documento?")) return;
    const { error } = await supabase.storage.from("employee-docs").remove([`${row.id}/${name}`]);
    if (error) toast.error(error.message); else { toast.success("Removido"); reload(row.id); }
  };

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Documentos — {row?.full_name}</DialogTitle></DialogHeader>
        {canManage && (
          <div className="flex items-center gap-2 pb-2 border-b border-border/60">
            <input ref={inputRef} type="file" className="hidden" onChange={onUpload} accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" />
            <Button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              Enviar documento
            </Button>
            <span className="text-xs text-muted-foreground">PDF, imagens ou Word — até 20MB</span>
          </div>
        )}
        <div className="max-h-[50vh] overflow-y-auto">
          {loading ? (
            <div className="text-center text-muted-foreground py-8 text-sm">Carregando...</div>
          ) : files.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">Nenhum documento anexado.</div>
          ) : (
            <ul className="divide-y divide-border/60">
              {files.map((f) => {
                const displayName = f.name.replace(/^\d+_/, "");
                return (
                  <li key={f.name} className="flex items-center gap-3 py-2">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{displayName}</div>
                      <div className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(1)} KB · {f.created_at ? new Date(f.created_at).toLocaleDateString() : ""}</div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => onDownload(f.name)} title="Baixar"><Download className="h-4 w-4" /></Button>
                    {canManage && (
                      <Button size="icon" variant="ghost" onClick={() => onDelete(f.name)} title="Excluir"><X className="h-4 w-4 text-destructive" /></Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
