import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Check, FileText, Paperclip, Plus, ShieldAlert, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { EmptyState, PageHeader, Pill } from "@/components/pg/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/justificativas")({
  head: () => ({ meta: [{ title: "Justificativas — PhytonGuard" }] }),
  component: AbsencesPage,
});

type Row = {
  id: string;
  user_id: string;
  absence_date: string;
  kind: string;
  reason: string | null;
  doc_url: string | null;
  status: string;
  auto_generated: boolean;
  created_at: string;
};

function AbsencesPage() {
  const { user, isStaff, companyId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [kind, setKind] = useState("justificada");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["absences", isStaff ? "all" : user?.id],
    queryFn: async () => {
      let q = supabase
        .from("absences")
        .select("id,user_id,absence_date,kind,reason,doc_url,status,auto_generated,created_at")
        .order("absence_date", { ascending: false })
        .limit(200);
      if (!isStaff && user) q = q.eq("user_id", user.id);
      return ((await q).data ?? []) as Row[];
    },
  });

  const userIds = Array.from(new Set((data ?? []).map((r) => r.user_id)));
  const { data: nameMap } = useQuery({
    queryKey: ["abs-names", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data: p } = await supabase.from("profiles").select("id,full_name").in("id", userIds);
      const m: Record<string, string> = {};
      (p ?? []).forEach((x) => { m[x.id] = x.full_name ?? "—"; });
      return m;
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      let doc_url: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `${user.id}/${date}-${Date.now()}.${ext}`;
        const up = await supabase.storage.from("absence-docs").upload(path, file, { contentType: file.type });
        if (up.error) throw up.error;
        doc_url = path;
      }
      const { error } = await supabase.from("absences").insert({
        user_id: user.id,
        company_id: companyId!,
        absence_date: date,
        kind,
        reason: reason.trim() || null,
        doc_url,
        status: "pending",
        auto_generated: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Justificativa enviada");
      qc.invalidateQueries({ queryKey: ["absences"] });
      setOpen(false); setReason(""); setFile(null); setKind("justificada");
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const review = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.from("absences").update({
        status, reviewed_by: user?.id, reviewed_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atualizado");
      qc.invalidateQueries({ queryKey: ["absences"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Faltas e justificativas"
        subtitle={isStaff
          ? "Aprove ou rejeite as justificativas enviadas pelos vigias."
          : "Envie atestado ou justificativa quando faltar ou não bater ponto."}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4" /> Nova justificativa</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Enviar justificativa</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Data da ausência</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={kind} onValueChange={setKind}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="justificada">Justificada</SelectItem>
                      <SelectItem value="atraso">Atraso</SelectItem>
                      <SelectItem value="falta">Falta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Motivo</Label>
                  <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
                </div>
                <div>
                  <Label className="flex items-center gap-1"><Paperclip className="h-3 w-3" /> Atestado (opcional)</Label>
                  <Input
                    ref={fileRef}
                    type="file"
                    accept="image/*,application/pdf"
                    capture="environment"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">No celular abre direto a câmera para tirar foto do atestado.</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => submit.mutate()} disabled={submit.isPending || !date}>Enviar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground bg-card/40">
            <tr>
              {isStaff && <th className="text-left px-4 py-3">Funcionário</th>}
              <th className="text-left px-4 py-3">Data</th>
              <th className="text-left px-4 py-3">Tipo</th>
              <th className="text-left px-4 py-3">Motivo</th>
              <th className="text-left px-4 py-3">Atestado</th>
              <th className="text-left px-4 py-3">Origem</th>
              <th className="text-left px-4 py-3">Status</th>
              {isStaff && <th className="text-right px-4 py-3">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {isLoading && <tr><td colSpan={isStaff ? 8 : 6} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>}
            {!isLoading && (data ?? []).length === 0 && (
              <tr><td colSpan={isStaff ? 8 : 6}><EmptyState icon={ShieldAlert} title="Nenhuma falta ou justificativa." /></td></tr>
            )}
            {(data ?? []).map((r) => (
              <tr key={r.id} className="hover:bg-accent/30">
                {isStaff && <td className="px-4 py-3 font-medium">{nameMap?.[r.user_id] ?? "—"}</td>}
                <td className="px-4 py-3 text-xs">{new Date(r.absence_date).toLocaleDateString()}</td>
                <td className="px-4 py-3"><Pill tone={r.kind === "falta" ? "danger" : r.kind === "atraso" ? "warn" : "info"}>{r.kind}</Pill></td>
                <td className="px-4 py-3 text-xs max-w-[240px] truncate" title={r.reason ?? ""}>{r.reason ?? "—"}</td>
                <td className="px-4 py-3"><DocLink path={r.doc_url} /></td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{r.auto_generated ? "Automática" : "Vigia"}</td>
                <td className="px-4 py-3">
                  <Pill tone={r.status === "approved" ? "success" : r.status === "rejected" ? "danger" : "warn"}>
                    {r.status === "approved" ? "Aprovada" : r.status === "rejected" ? "Rejeitada" : "Pendente"}
                  </Pill>
                </td>
                {isStaff && (
                  <td className="px-4 py-3 text-right space-x-1">
                    {r.status === "pending" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => review.mutate({ id: r.id, status: "approved" })}>
                          <Check className="h-3 w-3" /> Aprovar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => review.mutate({ id: r.id, status: "rejected" })}>
                          <X className="h-3 w-3 text-destructive" />
                        </Button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DocLink({ path }: { path: string | null }) {
  const { data } = useQuery({
    queryKey: ["abs-doc", path],
    enabled: !!path,
    queryFn: async () => {
      const { data } = await supabase.storage.from("absence-docs").createSignedUrl(path!, 3600);
      return data?.signedUrl ?? null;
    },
  });
  if (!path) return <span className="text-muted-foreground text-xs">—</span>;
  if (!data) return <span className="text-muted-foreground text-xs">…</span>;
  return (
    <a href={data} target="_blank" rel="noreferrer" className="text-primary text-xs hover:underline inline-flex items-center gap-1">
      <FileText className="h-3 w-3" /> Ver
    </a>
  );
}
