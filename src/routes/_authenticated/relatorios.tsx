import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/pg/ui";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — PhytonGuard" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const { t } = useI18n();

  const { data } = useQuery({
    queryKey: ["reports-summary"],
    queryFn: async () => {
      const [r, o, a, s, v] = await Promise.all([
        supabase.from("rounds").select("id", { count: "exact", head: true }),
        supabase.from("occurrences").select("id", { count: "exact", head: true }),
        supabase.from("alerts").select("id", { count: "exact", head: true }),
        supabase.from("shifts").select("id", { count: "exact", head: true }),
        supabase.from("vehicles").select("id", { count: "exact", head: true }),
      ]);
      return {
        rondas: r.count ?? 0, ocorrencias: o.count ?? 0, alertas: a.count ?? 0,
        escalas: s.count ?? 0, viaturas: v.count ?? 0,
      };
    },
  });

  const items = [
    { name: "Presença", count: data?.escalas ?? 0 },
    { name: "Escalas", count: data?.escalas ?? 0 },
    { name: "Rondas", count: data?.rondas ?? 0 },
    { name: "Ocorrências", count: data?.ocorrencias ?? 0 },
    { name: "Alertas", count: data?.alertas ?? 0 },
    { name: "Viaturas", count: data?.viaturas ?? 0 },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title={t("reports.title")} subtitle={t("reports.subtitle")} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((it) => (
          <div key={it.name} className="glass rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/15 grid place-items-center text-primary"><FileText className="h-5 w-5" /></div>
              <div className="flex-1">
                <div className="font-semibold">{it.name}</div>
                <div className="text-xs text-muted-foreground">{it.count} registros</div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="outline" className="flex-1"><Download className="h-3 w-3" />{t("reports.export.pdf")}</Button>
              <Button size="sm" variant="outline" className="flex-1"><Download className="h-3 w-3" />{t("reports.export.xlsx")}</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
