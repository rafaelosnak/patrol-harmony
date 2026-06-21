import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Download, Eye, Printer, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/pg/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — PhytonGuard" }] }),
  component: ReportsPage,
});

type ReportKey = "rondas" | "ocorrencias" | "alertas" | "escalas" | "viaturas" | "presenca";

type Col = { key: string; label: string; format?: (v: unknown, row: Record<string, unknown>) => string };

const REPORTS: { key: ReportKey; name: string; table: string; select: string; orderBy: string; cols: Col[] }[] = [
  {
    key: "rondas", name: "Rondas", table: "rounds",
    select: "id,started_at,finished_at,status,checkpoints_done,checkpoints_total, profiles!rounds_user_id_fkey(full_name), vehicles(plate,model)",
    orderBy: "started_at",
    cols: [
      { key: "started_at", label: "Início", format: (v) => new Date(v as string).toLocaleString("pt-BR") },
      { key: "finished_at", label: "Fim", format: (v) => v ? new Date(v as string).toLocaleString("pt-BR") : "—" },
      { key: "profiles.full_name", label: "Vigia" },
      { key: "vehicles.plate", label: "Viatura" },
      { key: "status", label: "Status" },
      { key: "checkpoints", label: "Pontos", format: (_v, r) => `${r.checkpoints_done ?? 0}/${r.checkpoints_total ?? 0}` },
    ],
  },
  {
    key: "ocorrencias", name: "Ocorrências", table: "occurrences",
    select: "id,title,severity,status,created_at, profiles!occurrences_user_id_fkey(full_name)",
    orderBy: "created_at",
    cols: [
      { key: "created_at", label: "Data", format: (v) => new Date(v as string).toLocaleString("pt-BR") },
      { key: "title", label: "Título" },
      { key: "severity", label: "Severidade" },
      { key: "status", label: "Status" },
      { key: "profiles.full_name", label: "Responsável" },
    ],
  },
  {
    key: "alertas", name: "Alertas", table: "alerts",
    select: "id,alert_type,message,status,created_at,resolved_at, profiles(full_name)",
    orderBy: "created_at",
    cols: [
      { key: "created_at", label: "Data", format: (v) => new Date(v as string).toLocaleString("pt-BR") },
      { key: "alert_type", label: "Tipo" },
      { key: "profiles.full_name", label: "Vigia" },
      { key: "message", label: "Observação", format: (v) => (v as string) ?? "—" },
      { key: "status", label: "Status" },
      { key: "resolved_at", label: "Resolvido", format: (v) => v ? new Date(v as string).toLocaleString("pt-BR") : "—" },
    ],
  },
  {
    key: "escalas", name: "Escalas", table: "shifts",
    select: "id,shift_type,start_at,end_at,status, profiles!shifts_user_id_fkey(full_name), units(name)",
    orderBy: "start_at",
    cols: [
      { key: "profiles.full_name", label: "Funcionário" },
      { key: "units.name", label: "Unidade" },
      { key: "shift_type", label: "Turno" },
      { key: "start_at", label: "Início", format: (v) => new Date(v as string).toLocaleString("pt-BR") },
      { key: "end_at", label: "Fim", format: (v) => new Date(v as string).toLocaleString("pt-BR") },
      { key: "status", label: "Status" },
    ],
  },
  {
    key: "viaturas", name: "Viaturas", table: "vehicles",
    select: "id,plate,model,year,status,created_at",
    orderBy: "plate",
    cols: [
      { key: "plate", label: "Placa" },
      { key: "model", label: "Modelo" },
      { key: "year", label: "Ano" },
      { key: "status", label: "Status" },
    ],
  },
  {
    key: "presenca", name: "Presença (Ponto)", table: "time_entries",
    select: "id,punch_type,punched_at,latitude,longitude,user_id",
    orderBy: "punched_at",
    cols: [
      { key: "punched_at", label: "Data/Hora", format: (v) => new Date(v as string).toLocaleString("pt-BR") },
      { key: "user_id", label: "Funcionário" },
      { key: "punch_type", label: "Tipo" },
      { key: "location", label: "Local", format: (_v, r) => r.latitude != null ? `${(r.latitude as number).toFixed(4)}, ${(r.longitude as number).toFixed(4)}` : "—" },
    ],
  },
];

function getValue(row: Record<string, unknown>, key: string): unknown {
  if (!key.includes(".")) return row[key];
  return key.split(".").reduce<unknown>((acc, k) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
    return undefined;
  }, row);
}

function ReportsPage() {
  const { t } = useI18n();
  const [openKey, setOpenKey] = useState<ReportKey | null>(null);

  const { data: counts } = useQuery({
    queryKey: ["reports-summary"],
    queryFn: async () => {
      const out: Record<string, number> = {};
      await Promise.all(REPORTS.map(async (r) => {
        const { count } = await supabase.from(r.table).select("id", { count: "exact", head: true });
        out[r.key] = count ?? 0;
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
}: { report: typeof REPORTS[number] | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["report-data", report?.key],
    enabled: !!report,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(report!.table)
        .select(report!.select)
        .order(report!.orderBy, { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
  });

  // For time_entries report, resolve user names
  const { data: nameMap } = useQuery({
    queryKey: ["report-names", report?.key, (data ?? []).length],
    enabled: report?.key === "presenca" && !!data && data.length > 0,
    queryFn: async () => {
      const ids = Array.from(new Set((data ?? []).map((r) => r.user_id as string).filter(Boolean)));
      if (!ids.length) return {};
      const { data: profs } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p) => { map[p.id] = p.full_name ?? "—"; });
      return map;
    },
  });

  const rows = useMemo(() => {
    if (!report || !data) return [];
    return data.map((row) => {
      const out: Record<string, string> = {};
      report.cols.forEach((c) => {
        let val: unknown = getValue(row, c.key);
        if (report.key === "presenca" && c.key === "user_id") {
          val = nameMap?.[val as string] ?? "—";
        }
        out[c.label] = c.format ? c.format(val, row) : (val == null ? "—" : String(val));
      });
      return out;
    });
  }, [report, data, nameMap]);

  const printReport = () => {
    if (!report) return;
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    const headers = report.cols.map((c) => `<th>${c.label}</th>`).join("");
    const body = rows.map((r) => `<tr>${report.cols.map((c) => `<td>${escapeHtml(r[c.label] ?? "")}</td>`).join("")}</tr>`).join("");
    win.document.write(`<!doctype html><html><head><title>Relatório — ${report.name}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        .meta { font-size: 11px; color: #666; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
        th { background: #f4f4f4; }
        tr:nth-child(even) td { background: #fafafa; }
      </style></head><body>
      <h1>Relatório — ${report.name}</h1>
      <div class="meta">Gerado em ${new Date().toLocaleString("pt-BR")} • ${rows.length} registros</div>
      <table><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table>
      <script>window.onload = () => { window.print(); };<\/script>
      </body></html>`);
    win.document.close();
  };

  const exportCsv = () => {
    if (!report) return;
    const headers = report.cols.map((c) => c.label);
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [headers.map(escape).join(",")]
      .concat(rows.map((r) => headers.map((h) => escape(r[h] ?? "")).join(",")))
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

        <div className="max-h-[60vh] overflow-auto rounded-md border border-border/60">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : rows.length === 0 ? (
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
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-border/40">
                    {report!.cols.map((c) => (
                      <td key={c.label} className="p-2">{r[c.label]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>
            <Download className="h-3 w-3" /> Exportar (CSV)
          </Button>
          <Button onClick={printReport} disabled={!rows.length}>
            <Printer className="h-3 w-3" /> Imprimir / PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
