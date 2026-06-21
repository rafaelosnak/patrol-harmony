import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Download, Eye, Printer, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/pg/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

type Company = { name: string; cnpj: string | null; contact_email: string | null; contact_phone: string | null; address: string | null };

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — PhytonGuard" }] }),
  component: ReportsPage,
});

type Row = Record<string, unknown>;
type ColDef = { label: string; render: (r: Row, ctx: Ctx) => string };
type Ctx = { profiles: Record<string, string>; units: Record<string, string>; vehicles: Record<string, string>; checkpoints: Record<string, string[]>; employeeClients: Record<string, string[]> };

type ReportKey = "rondas" | "ocorrencias" | "alertas" | "escalas" | "viaturas" | "presenca";

type ReportDef = {
  key: ReportKey;
  name: string;
  table: string;
  select: string;
  orderBy: string;
  cols: ColDef[];
  needsProfiles?: boolean;
  needsUnits?: boolean;
  needsVehicles?: boolean;
};

const fmtDateTime = (v: unknown) => (v ? new Date(v as string).toLocaleString("pt-BR") : "—");
const str = (v: unknown) => (v == null || v === "" ? "—" : String(v));

const REPORTS: ReportDef[] = [
  {
    key: "rondas", name: "Rondas", table: "rounds",
    select: "id,user_id,vehicle_id,started_at,finished_at,status,checkpoints_done,checkpoints_total",
    orderBy: "started_at",
    needsProfiles: true, needsVehicles: true,
    cols: [
      { label: "Início", render: (r) => fmtDateTime(r.started_at) },
      { label: "Fim", render: (r) => fmtDateTime(r.finished_at) },
      { label: "Vigia", render: (r, c) => c.profiles[r.user_id as string] ?? "—" },
      { label: "Viatura", render: (r, c) => c.vehicles[r.vehicle_id as string] ?? "—" },
      { label: "Status", render: (r) => str(r.status) },
      { label: "Pontos", render: (r) => `${r.checkpoints_done ?? 0}/${r.checkpoints_total ?? 0}` },
      { label: "Pontos visitados", render: (r, c) => (c.checkpoints[r.id as string] ?? []).join(" • ") || "—" },
      { label: "Cliente(s) do vigia", render: (r, c) => (c.employeeClients[r.user_id as string] ?? []).join(", ") || "—" },
    ],
  },
  {
    key: "ocorrencias", name: "Ocorrências", table: "occurrences",
    select: "id,user_id,title,severity,status,created_at",
    orderBy: "created_at",
    needsProfiles: true,
    cols: [
      { label: "Data", render: (r) => fmtDateTime(r.created_at) },
      { label: "Título", render: (r) => str(r.title) },
      { label: "Severidade", render: (r) => str(r.severity) },
      { label: "Status", render: (r) => str(r.status) },
      { label: "Responsável", render: (r, c) => c.profiles[r.user_id as string] ?? "—" },
      { label: "Cliente(s) atendido(s)", render: (r, c) => (c.employeeClients[r.user_id as string] ?? []).join(", ") || "—" },
    ],
  },
  {
    key: "alertas", name: "Alertas", table: "alerts",
    select: "id,user_id,alert_type,message,status,created_at,resolved_at",
    orderBy: "created_at",
    needsProfiles: true,
    cols: [
      { label: "Data", render: (r) => fmtDateTime(r.created_at) },
      { label: "Tipo", render: (r) => str(r.alert_type) },
      { label: "Vigia", render: (r, c) => c.profiles[r.user_id as string] ?? "—" },
      { label: "Observação", render: (r) => str(r.message) },
      { label: "Status", render: (r) => str(r.status) },
      { label: "Resolvido", render: (r) => fmtDateTime(r.resolved_at) },
      { label: "Cliente(s) do vigia", render: (r, c) => (c.employeeClients[r.user_id as string] ?? []).join(", ") || "—" },
    ],
  },
  {
    key: "escalas", name: "Escalas", table: "shifts",
    select: "id,user_id,client_id,shift_type,start_at,end_at,status",
    orderBy: "start_at",
    needsProfiles: true, needsUnits: false,
    cols: [
      { label: "Funcionário", render: (r, c) => c.profiles[r.user_id as string] ?? "—" },
      { label: "Cliente", render: (r, c) => c.units[r.client_id as string] ?? "—" },
      { label: "Turno", render: (r) => str(r.shift_type) },
      { label: "Início", render: (r) => fmtDateTime(r.start_at) },
      { label: "Fim", render: (r) => fmtDateTime(r.end_at) },
      { label: "Status", render: (r) => str(r.status) },
    ],
  },
  {
    key: "viaturas", name: "Viaturas", table: "vehicles",
    select: "id,plate,model,year,status,created_at",
    orderBy: "plate",
    cols: [
      { label: "Placa", render: (r) => str(r.plate) },
      { label: "Modelo", render: (r) => str(r.model) },
      { label: "Ano", render: (r) => str(r.year) },
      { label: "Status", render: (r) => str(r.status) },
    ],
  },
  {
    key: "presenca", name: "Presença (Ponto)", table: "time_entries",
    select: "id,user_id,punch_type,punched_at,latitude,longitude",
    orderBy: "punched_at",
    needsProfiles: true,
    cols: [
      { label: "Data/Hora", render: (r) => fmtDateTime(r.punched_at) },
      { label: "Funcionário", render: (r, c) => c.profiles[r.user_id as string] ?? "—" },
      { label: "Cliente(s) atendido(s)", render: (r, c) => (c.employeeClients[r.user_id as string] ?? []).join(", ") || "—" },
      { label: "Tipo", render: (r) => str(r.punch_type) },
      { label: "Local", render: (r) => r.latitude != null ? `${(r.latitude as number).toFixed(4)}, ${(r.longitude as number).toFixed(4)}` : "—" },
    ],
  },
];

// loosely-typed client to allow dynamic table names
const sb = supabase as unknown as {
  from: (t: string) => {
    select: (s: string, o?: { count?: "exact"; head?: boolean }) => {
      order?: (c: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: Row[] | null; error: { message: string } | null }> };
      in?: (col: string, vals: string[]) => Promise<{ data: Row[] | null; error: { message: string } | null }>;
      count?: number | null;
      then?: unknown;
    } & Promise<{ count: number | null; data: Row[] | null; error: { message: string } | null }>;
  };
};

function ReportsPage() {
  const { t } = useI18n();
  const [openKey, setOpenKey] = useState<ReportKey | null>(null);

  const { data: counts } = useQuery({
    queryKey: ["reports-summary"],
    queryFn: async () => {
      const out: Record<string, number> = {};
      await Promise.all(REPORTS.map(async (r) => {
        const res = await sb.from(r.table).select("id", { count: "exact", head: true });
        out[r.key] = res.count ?? 0;
      }));
      return out;
    },
  });

  return (
    <div className="space-y-4">
      <PageHeader title={t("reports.title")} subtitle={t("reports.subtitle")} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {REPORTS.map((it) => (
          <div key={it.key} className="glass rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/15 grid place-items-center text-primary"><FileText className="h-5 w-5" /></div>
              <div className="flex-1">
                <div className="font-semibold">{it.name}</div>
                <div className="text-xs text-muted-foreground">{counts?.[it.key] ?? 0} registros</div>
              </div>
            </div>
            <div className="mt-4">
              <Button size="sm" className="w-full" onClick={() => setOpenKey(it.key)}>
                <Eye className="h-3 w-3" /> Visualizar
              </Button>
            </div>
          </div>
        ))}
      </div>

      <ReportPreviewDialog
        report={openKey ? REPORTS.find((r) => r.key === openKey) ?? null : null}
        onClose={() => setOpenKey(null)}
      />
    </div>
  );
}

function ReportPreviewDialog({
  report, onClose,
}: { report: ReportDef | null; onClose: () => void }) {
  const [employeeFilter, setEmployeeFilter] = useState<string>("__all__");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const { data: employees } = useQuery({
    queryKey: ["report-employees"],
    enabled: !!report?.needsProfiles,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,full_name").order("full_name");
      return (data ?? []) as { id: string; full_name: string }[];
    },
  });
  const { data, isLoading, error } = useQuery({
    queryKey: ["report-data", report?.key],
    enabled: !!report,
    queryFn: async (): Promise<{ rows: Row[]; ctx: Ctx }> => {
      const r = report!;
      const res = await (sb.from(r.table).select(r.select) as unknown as { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: Row[] | null; error: { message: string } | null }> } })
        .order(r.orderBy, { ascending: false })
        .limit(500);
      if (res.error) throw new Error(res.error.message);
      const rows = res.data ?? [];

      const userIds = r.needsProfiles ? Array.from(new Set(rows.map((x) => x.user_id as string).filter(Boolean))) : [];
      const unitIds = r.needsUnits ? Array.from(new Set(rows.map((x) => x.client_id as string).filter(Boolean))) : [];
      const vehicleIds = r.needsVehicles ? Array.from(new Set(rows.map((x) => x.vehicle_id as string).filter(Boolean))) : [];

      const [pp, uu, vv] = await Promise.all([
        userIds.length ? supabase.from("profiles").select("id,full_name").in("id", userIds) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
        unitIds.length ? supabase.from("clients").select("id,name").in("id", unitIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
        vehicleIds.length ? supabase.from("vehicles").select("id,plate,model").in("id", vehicleIds) : Promise.resolve({ data: [] as { id: string; plate: string; model: string | null }[] }),
      ]);

      const ctx: Ctx = { profiles: {}, units: {}, vehicles: {}, checkpoints: {}, employeeClients: {} };
      ((pp as { data: { id: string; full_name: string }[] | null }).data ?? []).forEach((p) => { ctx.profiles[p.id] = p.full_name ?? "—"; });
      ((uu as { data: { id: string; name: string }[] | null }).data ?? []).forEach((u) => { ctx.units[u.id] = u.name ?? "—"; });
      ((vv as { data: { id: string; plate: string; model: string | null }[] | null }).data ?? []).forEach((v) => { ctx.vehicles[v.id] = `${v.plate}${v.model ? ` — ${v.model}` : ""}`; });

      if (r.needsProfiles && userIds.length > 0) {
        const { data: ces } = await supabase
          .from("client_employees")
          .select("user_id,client_id,clients(name)")
          .in("user_id", userIds);
        ((ces ?? []) as { user_id: string; client_id: string; clients: { name: string } | null }[]).forEach((row) => {
          const name = row.clients?.name ?? "—";
          (ctx.employeeClients[row.user_id] ||= []).push(name);
        });
      }

      if (r.key === "rondas" && rows.length > 0) {
        const ids = rows.map((x) => x.id as string).filter(Boolean);
        const { data: cps } = await supabase
          .from("round_checkpoints")
          .select("round_id,label,created_at")
          .in("round_id", ids)
          .order("created_at", { ascending: true });
        (cps ?? []).forEach((c) => {
          const rid = c.round_id as string;
          const arr = ctx.checkpoints[rid] ?? (ctx.checkpoints[rid] = []);
          arr.push((c.label as string | null) ?? "Ponto");
        });
      }

      return { rows, ctx };
    },
  });

  const filteredRows = useMemo(() => {
    if (!report || !data) return [] as Row[];
    const dateField =
      report.key === "presenca" ? "punched_at"
      : report.key === "rondas" ? "started_at"
      : report.key === "ocorrencias" || report.key === "alertas" ? "created_at"
      : report.key === "escalas" ? "start_at"
      : null;
    const fromTs = fromDate ? new Date(fromDate + "T00:00:00").getTime() : null;
    const toTs = toDate ? new Date(toDate + "T23:59:59").getTime() : null;
    return data.rows.filter((row) => {
      if (report.needsProfiles && employeeFilter !== "__all__" && row.user_id !== employeeFilter) return false;
      if (dateField && (fromTs || toTs)) {
        const v = row[dateField];
        if (!v) return false;
        const t = new Date(v as string).getTime();
        if (fromTs && t < fromTs) return false;
        if (toTs && t > toTs) return false;
      }
      return true;
    });
  }, [report, data, employeeFilter, fromDate, toDate]);

  const tableRows = useMemo(() => {
    if (!report) return [] as string[][];
    return filteredRows.map((row) => report.cols.map((c) => c.render(row, data!.ctx)));
  }, [report, data, filteredRows]);

  const printReport = () => {
    if (!report) return;
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    const headers = report.cols.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("");
    const body = tableRows.map((r) => `<tr>${r.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
    win.document.write(`<!doctype html><html><head><title>Relatório — ${escapeHtml(report.name)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        .meta { font-size: 11px; color: #666; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
        th { background: #f4f4f4; }
        tr:nth-child(even) td { background: #fafafa; }
      </style></head><body>
      <h1>Relatório — ${escapeHtml(report.name)}</h1>
      <div class="meta">Gerado em ${new Date().toLocaleString("pt-BR")} • ${tableRows.length} registros</div>
      <table><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table>
      <script>window.onload = () => { window.print(); };<\/script>
      </body></html>`);
    win.document.close();
  };

  const exportCsv = () => {
    if (!report) return;
    const headers = report.cols.map((c) => c.label);
    const escape = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const csv = [headers.map(escape).join(",")]
      .concat(tableRows.map((r) => r.map(escape).join(",")))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_${report.key}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={!!report} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Relatório — {report?.name}</DialogTitle>
          <DialogDescription>
            Visualização prévia. Você pode imprimir ou exportar para CSV (Excel).
          </DialogDescription>
        </DialogHeader>

        {(report?.needsProfiles || report?.key === "presenca") && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
            {report?.needsProfiles && (
              <div>
                <Label className="text-xs">Funcionário</Label>
                <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    {(employees ?? []).map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs">De</Label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Até</Label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" />
            </div>
          </div>
        )}


        <div className="max-h-[60vh] overflow-auto rounded-md border border-border/60">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-destructive">Erro ao carregar: {(error as Error).message}</div>
          ) : tableRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Sem registros.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground sticky top-0">
                <tr>
                  {report!.cols.map((c) => (
                    <th key={c.label} className="text-left p-2">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r, i) => (
                  <tr key={i} className="border-t border-border/40">
                    {r.map((cell, j) => (
                      <td key={j} className="p-2">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {report?.key === "rondas" && filteredRows.length > 0 && (
          <RoundPhotosSection roundIds={filteredRows.map((r) => r.id as string)} ctx={data?.ctx} />
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button variant="outline" onClick={exportCsv} disabled={!tableRows.length}>
            <Download className="h-3 w-3" /> Exportar (CSV)
          </Button>
          <Button onClick={printReport} disabled={!tableRows.length}>
            <Printer className="h-3 w-3" /> Imprimir / PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function escapeHtml(s: string) {
  return (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function RoundPhotosSection({ roundIds, ctx }: { roundIds: string[]; ctx?: Ctx }) {
  const { data, isLoading } = useQuery({
    queryKey: ["round-report-photos", roundIds.sort().join(",")],
    enabled: roundIds.length > 0,
    queryFn: async () => {
      const { data: cps } = await supabase
        .from("round_checkpoints")
        .select("round_id,label,photo_url,created_at")
        .in("round_id", roundIds)
        .not("photo_url", "is", null)
        .order("created_at", { ascending: true });
      const items = (cps ?? []) as { round_id: string; label: string | null; photo_url: string; created_at: string }[];
      const signed = await Promise.all(items.map(async (it) => {
        const { data: s } = await supabase.storage.from("round-photos").createSignedUrl(it.photo_url, 3600);
        return { ...it, url: s?.signedUrl ?? "" };
      }));
      return signed.filter((s) => s.url);
    },
  });
  if (isLoading) return <div className="mt-3 text-xs text-muted-foreground">Carregando fotos…</div>;
  if (!data || data.length === 0) return null;
  return (
    <div className="mt-4 rounded-md border border-border/60 p-3">
      <div className="text-sm font-semibold mb-2">Fotos dos pontos ({data.length})</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {data.map((p, i) => (
          <a key={i} href={p.url} target="_blank" rel="noreferrer" className="block group">
            <div className="aspect-square rounded-md overflow-hidden bg-muted">
              <img src={p.url} alt={p.label ?? "Foto da ronda"} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
            </div>
            <div className="text-[10px] text-muted-foreground mt-1 truncate">{p.label ?? "Ponto"}</div>
            <div className="text-[10px] text-muted-foreground truncate">{ctx?.profiles ? "" : ""}{new Date(p.created_at).toLocaleString("pt-BR")}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
