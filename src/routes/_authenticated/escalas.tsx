import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, Plus, Sparkles, Trash2, Repeat, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Pill } from "@/components/pg/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/escalas")({
  head: () => ({ meta: [{ title: "Escalas — PhytonGuard" }] }),
  component: ShiftsPage,
});

type Shift = { id: string; user_id: string; client_id: string | null; shift_type: string; start_at: string; end_at: string; status: string };
type SwapReq = { id: string; requester_id: string; shift_id: string; reason: string | null; status: string; admin_notes: string | null; replacement_user_id: string | null; created_at: string };

function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function startOfMonth(y: number, m: number) { return new Date(y, m, 1); }
function endOfMonth(y: number, m: number) { return new Date(y, m+1, 0); }

function ShiftsPage() {
  const { hasRole, companyId, user, isStaff } = useAuth();
  const canManage = hasRole("admin");
  const viewerIsVigia = !isStaff && hasRole("vigia");
  const qc = useQueryClient();

  const now = new Date();
  const [month, setMonth] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [view, setView] = useState<"calendar" | "byuser">("calendar");

  // dialogs
  const [dayOpen, setDayOpen] = useState<string | null>(null); // ISO date
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ user_id: "", client_id: "", shift_type: "12x36", date: ymd(now) });
  const [swapOpen, setSwapOpen] = useState<Shift | null>(null);
  const [swapReason, setSwapReason] = useState("");

  const from = startOfMonth(month.y, month.m);
  const to = new Date(endOfMonth(month.y, month.m).getTime() + 86400000);

  const { data: shifts, isLoading } = useQuery({
    queryKey: ["shifts", month.y, month.m, viewerIsVigia ? user?.id : "all"],
    queryFn: async () => {
      let q = supabase.from("shifts")
        .select("id,user_id,client_id,shift_type,start_at,end_at,status")
        .gte("start_at", from.toISOString())
        .lt("start_at", to.toISOString())
        .order("start_at");
      if (viewerIsVigia && user) q = q.eq("user_id", user.id);
      return ((await q).data ?? []) as Shift[];
    },
  });

  const { data: people } = useQuery({
    queryKey: ["profiles-shift-mini"],
    queryFn: async () => (await supabase.from("profiles").select("id,full_name,default_shift_type,work_period")).data ?? [],
  });
  const { data: clients } = useQuery({
    queryKey: ["clients-mini"],
    queryFn: async () => (await supabase.from("clients").select("id,name").order("name")).data ?? [],
  });
  const profileMap: Record<string, string> = {};
  (people ?? []).forEach((p) => { profileMap[p.id] = p.full_name ?? "—"; });
  const clientMap: Record<string, string> = {};
  (clients ?? []).forEach((c) => { clientMap[c.id] = c.name ?? "—"; });

  // group by date
  const byDay = useMemo(() => {
    const map: Record<string, Shift[]> = {};
    (shifts ?? []).forEach((s) => {
      const k = ymd(new Date(s.start_at));
      (map[k] ??= []).push(s);
    });
    return map;
  }, [shifts]);

  // calendar cells (with leading blanks)
  const cells = useMemo(() => {
    const first = startOfMonth(month.y, month.m);
    const last = endOfMonth(month.y, month.m);
    const lead = first.getDay();
    const arr: (Date | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= last.getDate(); d++) arr.push(new Date(month.y, month.m, d));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [month]);

  const generate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("generate_monthly_schedule", {
        _company_id: companyId!, _year: month.y, _month: month.m + 1, _overwrite: false,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => { toast.success(`${n} plantões gerados`); qc.invalidateQueries({ queryKey: ["shifts"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao gerar escala"),
  });

  const addShift = useMutation({
    mutationFn: async () => {
      const p = (people ?? []).find((x) => x.id === addForm.user_id) as { work_period?: string | null } | undefined;
      const period = (p?.work_period ?? "A").toUpperCase();
      const { data: comp } = await supabase.from("companies")
        .select("shift_a_start,shift_a_end,shift_b_start,shift_b_end,shift_c_start,shift_c_end")
        .eq("id", companyId!).maybeSingle();
      const c = comp as Record<string, string | null> | null;
      const s = (period === "B" ? c?.shift_b_start : period === "C" ? c?.shift_c_start : c?.shift_a_start) ?? "07:00";
      const e = (period === "B" ? c?.shift_b_end   : period === "C" ? c?.shift_c_end   : c?.shift_a_end)   ?? "19:00";
      const start = new Date(`${addForm.date}T${s}:00`);
      let end = new Date(`${addForm.date}T${e}:00`);
      if (end <= start) end = new Date(end.getTime() + 86400000);
      const { error } = await supabase.from("shifts").insert({
        user_id: addForm.user_id, client_id: addForm.client_id || null,
        shift_type: addForm.shift_type, start_at: start.toISOString(), end_at: end.toISOString(),
        company_id: companyId!,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Plantão criado"); qc.invalidateQueries({ queryKey: ["shifts"] }); setAddOpen(false); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const delShift = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("shifts").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Plantão removido"); qc.invalidateQueries({ queryKey: ["shifts"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  // Swap requests
  const { data: swaps } = useQuery({
    queryKey: ["swaps", viewerIsVigia ? user?.id : "all"],
    queryFn: async () => {
      let q = supabase.from("shift_swap_requests").select("id,requester_id,shift_id,reason,status,admin_notes,replacement_user_id,created_at").order("created_at", { ascending: false });
      if (viewerIsVigia && user) q = q.eq("requester_id", user.id);
      return ((await q).data ?? []) as SwapReq[];
    },
  });

  const createSwap = useMutation({
    mutationFn: async () => {
      if (!swapOpen || !user) return;
      const { error } = await supabase.from("shift_swap_requests").insert({
        company_id: companyId!, requester_id: user.id, shift_id: swapOpen.id, reason: swapReason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Solicitação enviada"); qc.invalidateQueries({ queryKey: ["swaps"] }); setSwapOpen(null); setSwapReason(""); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const reviewSwap = useMutation({
    mutationFn: async (input: { id: string; status: "approved" | "rejected"; replacement_user_id?: string | null; admin_notes?: string | null; shift_id?: string }) => {
      const { error } = await supabase.from("shift_swap_requests").update({
        status: input.status, replacement_user_id: input.replacement_user_id ?? null,
        admin_notes: input.admin_notes ?? null, reviewed_by: user?.id, reviewed_at: new Date().toISOString(),
      }).eq("id", input.id);
      if (error) throw error;
      if (input.status === "approved" && input.replacement_user_id && input.shift_id) {
        const { error: e2 } = await supabase.from("shifts").update({ user_id: input.replacement_user_id }).eq("id", input.shift_id);
        if (e2) throw e2;
      }
    },
    onSuccess: () => { toast.success("Solicitação atualizada"); qc.invalidateQueries({ queryKey: ["swaps"] }); qc.invalidateQueries({ queryKey: ["shifts"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const monthLabel = new Date(month.y, month.m, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const shiftMine = (s: Shift) => user && s.user_id === user.id;

  return (
    <div className="space-y-4">
      <PageHeader
        title={viewerIsVigia ? "Minha escala" : "Escalas"}
        subtitle={viewerIsVigia ? "Seus plantões e solicitações de troca." : "Calendário mensal — gere automaticamente ou ajuste manual."}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setMonth(({ y, m }) => m === 0 ? { y: y-1, m: 11 } : { y, m: m-1 })}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm capitalize min-w-[140px] text-center">{monthLabel}</span>
            <Button size="sm" variant="ghost" onClick={() => setMonth(({ y, m }) => m === 11 ? { y: y+1, m: 0 } : { y, m: m+1 })}><ChevronRight className="h-4 w-4" /></Button>
            {canManage && (
              <>
                <Button size="sm" variant="outline" onClick={() => generate.mutate()} disabled={generate.isPending}>
                  <Sparkles className="h-4 w-4" />Gerar automático
                </Button>
                <Button size="sm" onClick={() => { setAddForm({ user_id: "", client_id: "", shift_type: "12x36", date: ymd(new Date(month.y, month.m, 1)) }); setAddOpen(true); }}>
                  <Plus className="h-4 w-4" />Novo
                </Button>
              </>
            )}
          </div>
        }
      />

      <Tabs defaultValue="calendar">
        <TabsList>
          <TabsTrigger value="calendar">Calendário</TabsTrigger>
          <TabsTrigger value="byuser">Por vigia</TabsTrigger>
          <TabsTrigger value="swaps">Trocas {((swaps ?? []).filter(s => s.status === "pending").length) > 0 && <Pill tone="warning" className="ml-2">{(swaps ?? []).filter(s => s.status === "pending").length}</Pill>}</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <div className="glass rounded-xl p-3">
            <div className="grid grid-cols-7 gap-1 text-xs text-center text-muted-foreground mb-1">
              {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((d) => <div key={d} className="py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                if (!d) return <div key={i} className="min-h-[88px] rounded bg-card/20" />;
                const k = ymd(d);
                const list = byDay[k] ?? [];
                const isToday = ymd(new Date()) === k;
                return (
                  <button key={i} onClick={() => setDayOpen(k)}
                    className={`min-h-[88px] rounded border text-left p-1 hover:bg-accent/40 ${isToday ? "border-primary" : "border-border/60"}`}>
                    <div className="text-xs font-semibold mb-1">{d.getDate()}</div>
                    <div className="space-y-0.5">
                      {list.slice(0, 3).map((s) => (
                        <div key={s.id} className={`text-[10px] truncate rounded px-1 ${shiftMine(s) ? "bg-primary/20" : "bg-accent/50"}`}>
                          {profileMap[s.user_id]?.split(" ")[0] ?? "—"} · {s.shift_type}
                        </div>
                      ))}
                      {list.length > 3 && <div className="text-[10px] text-muted-foreground">+{list.length - 3}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
            {isLoading && <div className="text-xs text-muted-foreground text-center py-4">Carregando…</div>}
          </div>
        </TabsContent>

        <TabsContent value="byuser">
          <div className="glass rounded-xl overflow-auto">
            <table className="text-xs min-w-full">
              <thead className="bg-card/40">
                <tr>
                  <th className="text-left px-2 py-2 sticky left-0 bg-card/80 z-10">Vigia</th>
                  {Array.from({ length: endOfMonth(month.y, month.m).getDate() }, (_, i) => i+1).map((d) => (
                    <th key={d} className="px-1 py-2 w-7 text-center text-muted-foreground">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {(() => {
                  const users = Array.from(new Set((shifts ?? []).map((s) => s.user_id)));
                  if (users.length === 0) return <tr><td colSpan={32} className="px-4 py-6 text-center text-muted-foreground">Sem plantões neste mês.</td></tr>;
                  return users.map((uid) => {
                    const userShifts = (shifts ?? []).filter((s) => s.user_id === uid);
                    return (
                      <tr key={uid} className="hover:bg-accent/20">
                        <td className="px-2 py-1 sticky left-0 bg-card/60 font-medium whitespace-nowrap">{profileMap[uid] ?? "—"}</td>
                        {Array.from({ length: endOfMonth(month.y, month.m).getDate() }, (_, i) => i+1).map((d) => {
                          const found = userShifts.find((s) => new Date(s.start_at).getDate() === d);
                          return <td key={d} className="px-0.5 py-1 text-center">{found ? <span className="inline-block w-5 h-5 rounded bg-primary/40" title={found.shift_type} /> : <span className="text-muted-foreground/40">·</span>}</td>;
                        })}
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="swaps">
          <div className="glass rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground bg-card/40">
                <tr>
                  <th className="text-left px-3 py-2">Solicitante</th>
                  <th className="text-left px-3 py-2">Plantão</th>
                  <th className="text-left px-3 py-2">Motivo</th>
                  <th className="text-left px-3 py-2">Status</th>
                  {canManage && <th className="text-right px-3 py-2">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {(swaps ?? []).length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Sem solicitações.</td></tr>}
                {(swaps ?? []).map((sw) => {
                  const sh = (shifts ?? []).find((x) => x.id === sw.shift_id);
                  return (
                    <tr key={sw.id} className="hover:bg-accent/30">
                      <td className="px-3 py-2">{profileMap[sw.requester_id] ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {sh ? `${new Date(sh.start_at).toLocaleString("pt-BR")} · ${sh.shift_type}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">{sw.reason ?? "—"}</td>
                      <td className="px-3 py-2">
                        <Pill tone={sw.status === "approved" ? "success" : sw.status === "rejected" ? "danger" : "warning"}>{sw.status}</Pill>
                      </td>
                      {canManage && (
                        <td className="px-3 py-2 text-right">
                          {sw.status === "pending" && (
                            <ApproveRow swap={sw} people={(people ?? []) as { id: string; full_name: string }[]} onApprove={(rep) => reviewSwap.mutate({ id: sw.id, status: "approved", replacement_user_id: rep, shift_id: sw.shift_id })} onReject={() => reviewSwap.mutate({ id: sw.id, status: "rejected" })} />
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Day modal */}
      <Dialog open={!!dayOpen} onOpenChange={(o) => { if (!o) setDayOpen(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dayOpen && new Date(dayOpen + "T00:00:00").toLocaleDateString("pt-BR")}</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-auto">
            {dayOpen && (byDay[dayOpen] ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sem plantões.</p>}
            {dayOpen && (byDay[dayOpen] ?? []).map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 rounded border border-border/60 px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{profileMap[s.user_id]}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(s.start_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} – {new Date(s.end_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {s.shift_type}
                    {s.client_id && ` · ${clientMap[s.client_id]}`}
                  </div>
                </div>
                <div className="flex gap-1">
                  {shiftMine(s) && <Button size="sm" variant="outline" onClick={() => { setSwapOpen(s); setSwapReason(""); }}><Repeat className="h-3 w-3" />Trocar</Button>}
                  {canManage && <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir?")) delShift.mutate(s.id); }}><Trash2 className="h-3 w-3" /></Button>}
                </div>
              </div>
            ))}
          </div>
          {canManage && dayOpen && (
            <DialogFooter>
              <Button size="sm" variant="outline" onClick={() => { setAddForm({ user_id: "", client_id: "", shift_type: "12x36", date: dayOpen }); setAddOpen(true); }}><Plus className="h-3 w-3" />Adicionar neste dia</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Add modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo plantão</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Data</Label>
              <Input type="date" value={addForm.date} onChange={(e) => setAddForm({ ...addForm, date: e.target.value })} />
            </div>
            <div>
              <Label>Vigia</Label>
              <Select value={addForm.user_id} onValueChange={(v) => {
                const p = (people ?? []).find((x) => x.id === v) as { default_shift_type?: string | null } | undefined;
                setAddForm({ ...addForm, user_id: v, shift_type: p?.default_shift_type || addForm.shift_type });
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{(people ?? []).map((p) => {
                  const meta = [p.default_shift_type, p.work_period ? `Turno ${p.work_period}` : null].filter(Boolean).join(" · ");
                  return <SelectItem key={p.id} value={p.id}>{p.full_name}{meta ? ` (${meta})` : ""}</SelectItem>;
                })}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cliente</Label>
              <Select value={addForm.client_id} onValueChange={(v) => setAddForm({ ...addForm, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{(clients ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de escala</Label>
              <Select value={addForm.shift_type} onValueChange={(v) => setAddForm({ ...addForm, shift_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="12x36">12x36</SelectItem>
                  <SelectItem value="5x1">5x1</SelectItem>
                  <SelectItem value="6x1">6x1</SelectItem>
                  <SelectItem value="4x2">4x2</SelectItem>
                  <SelectItem value="5x2">5x2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">O horário usa o turno (A/B/C) cadastrado no funcionário e os horários definidos em Configurações.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={() => addShift.mutate()} disabled={!addForm.user_id || addShift.isPending}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Swap modal */}
      <Dialog open={!!swapOpen} onOpenChange={(o) => { if (!o) setSwapOpen(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Solicitar troca</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {swapOpen && `Plantão em ${new Date(swapOpen.start_at).toLocaleString("pt-BR")} (${swapOpen.shift_type}).`}
            </p>
            <div>
              <Label>Motivo</Label>
              <Textarea rows={3} value={swapReason} onChange={(e) => setSwapReason(e.target.value)} placeholder="Justifique sua solicitação..." />
            </div>
            <p className="text-xs text-muted-foreground">O administrador irá avaliar e escolher quem cobre o plantão.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSwapOpen(null)}>Cancelar</Button>
            <Button onClick={() => createSwap.mutate()} disabled={!swapReason || createSwap.isPending}>Enviar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApproveRow({ swap, people, onApprove, onReject }: { swap: SwapReq; people: { id: string; full_name: string }[]; onApprove: (uid: string) => void; onReject: () => void }) {
  const [rep, setRep] = useState("");
  return (
    <div className="flex items-center gap-1 justify-end">
      <Select value={rep} onValueChange={setRep}>
        <SelectTrigger className="h-7 text-xs w-[160px]"><SelectValue placeholder="Substituir por…" /></SelectTrigger>
        <SelectContent>{people.filter((p) => p.id !== swap.requester_id).map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
      </Select>
      <Button size="sm" variant="ghost" onClick={() => rep && onApprove(rep)} disabled={!rep}><Check className="h-3 w-3" /></Button>
      <Button size="sm" variant="ghost" onClick={onReject}><X className="h-3 w-3" /></Button>
    </div>
  );
}
