import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Map as MapIcon, Truck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { PageHeader, StatusDot } from "@/components/pg/ui";

export const Route = createFileRoute("/_authenticated/mapa")({
  head: () => ({ meta: [{ title: "Mapa — PhytonGuard" }] }),
  component: MapPage,
});

function MapPage() {
  const { t } = useI18n();
  const { data: team } = useQuery({
    queryKey: ["map-team"],
    queryFn: async () => (await supabase.from("profiles").select("id,full_name,status,unit_id").limit(50)).data ?? [],
  });
  const { data: vehicles } = useQuery({
    queryKey: ["map-vehicles"],
    queryFn: async () => (await supabase.from("vehicles").select("id,prefix,plate,status").limit(50)).data ?? [],
  });

  return (
    <div className="space-y-4">
      <PageHeader title={t("map.title")} subtitle={t("map.subtitle")} />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="glass rounded-xl overflow-hidden h-[calc(100vh-220px)] min-h-[420px] relative">
          {/* Stylized radar/map placeholder */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,oklch(0.30_0.05_235_/_0.5),transparent_70%)]" />
          <svg className="absolute inset-0 w-full h-full opacity-30" preserveAspectRatio="none">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="oklch(0.74 0.16 230 / 0.25)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center max-w-sm px-6">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/20 grid place-items-center text-primary mb-3">
                <MapIcon className="h-7 w-7" />
              </div>
              <p className="text-sm font-medium">{t("map.placeholder")}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Conecte o Google Maps Platform em Conectores para ativar o mapa em tempo real com posições GPS.
              </p>
            </div>
          </div>
          {/* Pulsing units */}
          {[20, 45, 70, 30, 80].map((x, i) => (
            <div key={i} className="absolute h-3 w-3 rounded-full bg-status-working text-status-working pulse-ring"
              style={{ left: `${x}%`, top: `${15 + i * 14}%` }} />
          ))}
        </div>

        <div className="space-y-3">
          <div className="glass rounded-xl p-4">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Users className="h-4 w-4" />Equipe</h3>
            <ul className="mt-2 space-y-1 max-h-64 overflow-auto pr-1">
              {(team ?? []).map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-sm py-1.5">
                  <StatusDot status={p.status} />
                  <span className="flex-1 truncate">{p.full_name}</span>
                  <span className="text-[10px] uppercase text-muted-foreground">{p.status}</span>
                </li>
              ))}
              {(team ?? []).length === 0 && <li className="text-xs text-muted-foreground py-2">{t("common.empty")}</li>}
            </ul>
          </div>
          <div className="glass rounded-xl p-4">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Truck className="h-4 w-4" />Viaturas</h3>
            <ul className="mt-2 space-y-1 max-h-64 overflow-auto pr-1">
              {(vehicles ?? []).map((v) => (
                <li key={v.id} className="flex items-center gap-2 text-sm py-1.5">
                  <StatusDot status={v.status === "patrol" ? "round" : v.status === "available" ? "working" : "offline"} />
                  <span className="flex-1 truncate font-mono">{v.prefix} — {v.plate}</span>
                  <span className="text-[10px] uppercase text-muted-foreground">{v.status}</span>
                </li>
              ))}
              {(vehicles ?? []).length === 0 && <li className="text-xs text-muted-foreground py-2">{t("common.empty")}</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
