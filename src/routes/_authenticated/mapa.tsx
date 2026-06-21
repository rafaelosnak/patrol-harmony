import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Map as MapIcon, Truck, Users, AlertTriangle, Building2, Layers, Search, Locate, Activity } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { PageHeader, StatusDot } from "@/components/pg/ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/mapa")({
  head: () => ({ meta: [{ title: "Mapa — PhytonGuard" }] }),
  component: MapPage,
});

declare global {
  interface Window {
    google?: typeof google;
    __initPgMap?: () => void;
  }
}

const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const TRACKING_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

function loadMaps(): Promise<typeof google> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) return resolve(window.google);
    if (!BROWSER_KEY) return reject(new Error("Missing Google Maps key"));
    const existing = document.querySelector<HTMLScriptElement>("script[data-pg-maps]");
    window.__initPgMap = () => resolve(window.google!);
    if (existing) return;
    const s = document.createElement("script");
    s.dataset.pgMaps = "1";
    s.async = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${BROWSER_KEY}&loading=async&callback=__initPgMap${TRACKING_ID ? `&channel=${TRACKING_ID}` : ""}`;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
}

type Layers = { alerts: boolean; clients: boolean; vehicles: boolean };

function MapPage() {
  const { t } = useI18n();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [layers, setLayers] = useState<Layers>({ alerts: true, clients: true, vehicles: true });
  const [search, setSearch] = useState("");

  const { data: team } = useQuery({
    queryKey: ["map-team"],
    queryFn: async () => (await supabase.from("profiles").select("id,full_name,status,last_lat,last_lng,last_location_at").limit(200)).data ?? [],
    refetchInterval: 15000,
  });
  const { data: vehicles } = useQuery({
    queryKey: ["map-vehicles"],
    queryFn: async () => (await supabase.from("vehicles").select("id,prefix,plate,status").limit(50)).data ?? [],
  });
  const { data: clients } = useQuery({
    queryKey: ["map-clients"],
    queryFn: async () => (await supabase.from("clients").select("id,name,address,latitude,longitude").limit(500)).data ?? [],
    refetchInterval: 30000,
  });
  const { data: alerts } = useQuery({
    queryKey: ["map-alerts"],
    queryFn: async () => (await supabase.from("alerts").select("id,alert_type,latitude,longitude,created_at,user_id").eq("status", "active").limit(50)).data ?? [],
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (!mapRef.current || !BROWSER_KEY) return;
    let cancelled = false;
    loadMaps().then((g) => {
      if (cancelled || !mapRef.current) return;
      mapInstance.current = new g.maps.Map(mapRef.current, {
        center: { lat: -14.235, lng: -51.9253 },
        zoom: 4,
        disableDefaultUI: false,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        zoomControl: true,
        styles: [
          { elementType: "geometry", stylers: [{ color: "#0b1220" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#0b1220" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
          { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#1f2937" }] },
          { featureType: "road", elementType: "geometry", stylers: [{ color: "#1f2937" }] },
          { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#374151" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1a2b" }] },
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
        ],
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const g = window.google;
    const map = mapInstance.current;
    if (!g || !map) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new g.maps.LatLngBounds();
    let has = false;

    // Clients
    if (layers.clients) {
      (clients ?? []).forEach((c) => {
        const lat = (c as { latitude: number | null }).latitude;
        const lng = (c as { longitude: number | null }).longitude;
        if (lat == null || lng == null) return;
        const pos = { lat: Number(lat), lng: Number(lng) };
        const m = new g.maps.Marker({
          position: pos, map, title: c.name,
          icon: { path: g.maps.SymbolPath.CIRCLE, scale: 7, fillColor: "#3b82f6", fillOpacity: 0.9, strokeColor: "#dbeafe", strokeWeight: 2 },
          zIndex: 10,
        });
        const info = new g.maps.InfoWindow({ content: `<div style="color:#0b1220;font-family:system-ui;max-width:240px"><strong>🏢 ${escapeHtmlSafe(c.name)}</strong>${c.address ? `<br/><span style="font-size:11px">${escapeHtmlSafe(c.address)}</span>` : ""}</div>` });
        m.addListener("click", () => info.open({ map, anchor: m }));
        markersRef.current.push(m);
        bounds.extend(pos); has = true;
      });
    }

    // Live team
    if (layers.vehicles) {
      const cutoff = Date.now() - 10 * 60 * 1000; // last 10min = "live"
      (team ?? []).forEach((p) => {
        const t = p as { last_lat: number | null; last_lng: number | null; last_location_at: string | null; full_name: string; status: string };
        if (t.last_lat == null || t.last_lng == null || !t.last_location_at) return;
        const isLive = new Date(t.last_location_at).getTime() > cutoff;
        const pos = { lat: Number(t.last_lat), lng: Number(t.last_lng) };
        const color = t.status === "round" ? "#f59e0b" : isLive ? "#10b981" : "#6b7280";
        const m = new g.maps.Marker({
          position: pos, map, title: t.full_name,
          icon: { path: g.maps.SymbolPath.CIRCLE, scale: 9, fillColor: color, fillOpacity: 0.95, strokeColor: "#ffffff", strokeWeight: 2 },
          zIndex: 50,
        });
        const info = new g.maps.InfoWindow({ content: `<div style="color:#0b1220;font-family:system-ui"><strong>👮 ${escapeHtmlSafe(t.full_name)}</strong><br/><span style="font-size:11px">${t.status} • atualizado ${new Date(t.last_location_at).toLocaleTimeString()}</span></div>` });
        m.addListener("click", () => info.open({ map, anchor: m }));
        markersRef.current.push(m);
        bounds.extend(pos); has = true;
      });
    }

    // Alerts (on top)
    if (layers.alerts) {
      (alerts ?? []).forEach((a) => {
        if (a.latitude == null || a.longitude == null) return;
        const pos = { lat: Number(a.latitude), lng: Number(a.longitude) };
        const m = new g.maps.Marker({
          position: pos, map, title: `Alerta: ${a.alert_type}`,
          icon: { path: g.maps.SymbolPath.CIRCLE, scale: 11, fillColor: "#ef4444", fillOpacity: 0.95, strokeColor: "#fee2e2", strokeWeight: 3 },
          animation: g.maps.Animation.BOUNCE,
          zIndex: 999,
        });
        const info = new g.maps.InfoWindow({ content: `<div style="color:#0b1220;font-family:system-ui"><strong>🚨 ${a.alert_type.toUpperCase()}</strong><br/><span style="font-size:11px">${new Date(a.created_at).toLocaleString()}</span></div>` });
        m.addListener("click", () => info.open({ map, anchor: m }));
        markersRef.current.push(m);
        bounds.extend(pos); has = true;
      });
    }

    if (has) {
      map.fitBounds(bounds);
      if ((markersRef.current.length ?? 0) <= 1) map.setZoom(15);
    }
  }, [alerts, clients, team, layers]);


  const activeAlerts = alerts ?? [];
  const onDuty = (team ?? []).filter((p) => p.status === "working" || p.status === "round").length;
  const onPatrol = (vehicles ?? []).filter((v) => v.status === "patrol").length;

  const filteredTeam = useMemo(
    () => (team ?? []).filter((p) => p.full_name?.toLowerCase().includes(search.toLowerCase())),
    [team, search],
  );
  const filteredVehicles = useMemo(
    () => (vehicles ?? []).filter((v) => `${v.prefix} ${v.plate}`.toLowerCase().includes(search.toLowerCase())),
    [vehicles, search],
  );

  const recenter = () => {
    const map = mapInstance.current;
    if (!map) return;
    map.setCenter({ lat: -14.235, lng: -51.9253 });
    map.setZoom(4);
  };

  const toggle = (k: keyof Layers) => setLayers((s) => ({ ...s, [k]: !s[k] }));

  return (
    <div className="space-y-4">
      <PageHeader title={t("map.title")} subtitle={t("map.subtitle")} />

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={<AlertTriangle className="h-4 w-4" />} label="Alertas ativos" value={activeAlerts.length} tone="danger" />
        <KpiCard icon={<Activity className="h-4 w-4" />} label="Em serviço" value={onDuty} tone="success" />
        <KpiCard icon={<Truck className="h-4 w-4" />} label="Em patrulha" value={onPatrol} tone="info" />
        <KpiCard icon={<Building2 className="h-4 w-4" />} label="Clientes" value={(clients ?? []).length} tone="muted" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        <div className="glass rounded-xl overflow-hidden h-[calc(100vh-280px)] min-h-[420px] relative">
          {BROWSER_KEY ? (
            <>
              <div ref={mapRef} className="absolute inset-0" />

              {/* Layer chips */}
              <div className="absolute top-3 left-3 flex flex-wrap gap-2 z-10">
                <LayerChip active={layers.alerts} onClick={() => toggle("alerts")} tone="danger">
                  <AlertTriangle className="h-3 w-3" /> Alertas
                </LayerChip>
                <LayerChip active={layers.clients} onClick={() => toggle("clients")} tone="info">
                  <Building2 className="h-3 w-3" /> Clientes
                </LayerChip>
                <LayerChip active={layers.vehicles} onClick={() => toggle("vehicles")} tone="success">
                  <Truck className="h-3 w-3" /> Viaturas
                </LayerChip>
              </div>

              {/* Recenter */}
              <Button
                size="icon"
                variant="secondary"
                className="absolute top-3 right-3 z-10 shadow-lg"
                onClick={recenter}
                title="Recentralizar"
              >
                <Locate className="h-4 w-4" />
              </Button>

              {/* Legend */}
              <div className="absolute bottom-3 left-3 z-10 bg-card/90 backdrop-blur rounded-lg px-3 py-2 text-[11px] border border-border/60 flex items-center gap-3">
                <Layers className="h-3 w-3 text-muted-foreground" />
                <LegendDot color="bg-status-sos" label="Alerta" />
                <LegendDot color="bg-primary" label="Cliente" />
                <LegendDot color="bg-status-round" label="Patrulha" />
              </div>

              {/* Empty hint */}
              {activeAlerts.length === 0 && (
                <div className="absolute bottom-3 right-3 z-10 bg-card/90 backdrop-blur rounded-lg px-3 py-1.5 text-[11px] text-muted-foreground border border-border/60">
                  Sem alertas ativos no momento
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 grid place-items-center text-center p-6">
              <div>
                <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/20 grid place-items-center text-primary mb-3">
                  <MapIcon className="h-7 w-7" />
                </div>
                <p className="text-sm font-medium">{t("map.placeholder")}</p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar vigia ou viatura..."
              className="pl-9 h-9"
            />
          </div>

          {activeAlerts.length > 0 && (
            <div className="glass rounded-xl p-4 border border-status-sos/40">
              <h3 className="text-sm font-semibold flex items-center justify-between text-status-sos">
                <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Alertas ativos</span>
                <span className="text-[10px] bg-status-sos/20 px-1.5 py-0.5 rounded-full">{activeAlerts.length}</span>
              </h3>
              <ul className="mt-2 space-y-1">
                {activeAlerts.map((a) => (
                  <li key={a.id} className="text-xs py-1 flex items-center justify-between gap-2">
                    <strong className="capitalize">{a.alert_type}</strong>
                    <span className="text-muted-foreground text-[10px]">{new Date(a.created_at).toLocaleTimeString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <SidePanel
            icon={<Users className="h-4 w-4" />}
            title="Equipe"
            count={filteredTeam.length}
            empty={t("common.empty")}
          >
            {filteredTeam.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm py-1.5">
                <StatusDot status={p.status} />
                <span className="flex-1 truncate">{p.full_name}</span>
                <span className="text-[10px] uppercase text-muted-foreground">{p.status}</span>
              </li>
            ))}
          </SidePanel>

          <SidePanel
            icon={<Truck className="h-4 w-4" />}
            title="Viaturas"
            count={filteredVehicles.length}
            empty={t("common.empty")}
          >
            {filteredVehicles.map((v) => (
              <li key={v.id} className="flex items-center gap-2 text-sm py-1.5">
                <StatusDot status={v.status === "patrol" ? "round" : v.status === "available" ? "working" : "offline"} />
                <span className="flex-1 truncate font-mono">{v.prefix} — {v.plate}</span>
                <span className="text-[10px] uppercase text-muted-foreground">{v.status}</span>
              </li>
            ))}
          </SidePanel>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "danger" | "success" | "info" | "muted" }) {
  const toneMap = {
    danger: "text-status-sos bg-status-sos/10",
    success: "text-status-working bg-status-working/10",
    info: "text-primary bg-primary/10",
    muted: "text-muted-foreground bg-muted/40",
  } as const;
  return (
    <div className="glass rounded-xl p-3 flex items-center gap-3">
      <div className={`h-9 w-9 rounded-lg grid place-items-center ${toneMap[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground truncate">{label}</div>
        <div className="text-xl font-bold leading-tight">{value}</div>
      </div>
    </div>
  );
}

function LayerChip({ active, onClick, tone, children }: { active: boolean; onClick: () => void; tone: "danger" | "info" | "success"; children: React.ReactNode }) {
  const toneOn = {
    danger: "bg-status-sos/20 text-status-sos border-status-sos/50",
    info: "bg-primary/20 text-primary border-primary/50",
    success: "bg-status-working/20 text-status-working border-status-working/50",
  }[tone];
  return (
    <button
      onClick={onClick}
      className={`text-[11px] px-2.5 py-1 rounded-full border flex items-center gap-1.5 backdrop-blur transition-colors ${active ? toneOn : "bg-card/80 text-muted-foreground border-border/60"}`}
    >
      {children}
    </button>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function SidePanel({ icon, title, count, empty, children }: { icon: React.ReactNode; title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-xl p-4">
      <h3 className="text-sm font-semibold flex items-center justify-between">
        <span className="flex items-center gap-2">{icon}{title}</span>
        <span className="text-[10px] bg-muted/60 px-1.5 py-0.5 rounded-full">{count}</span>
      </h3>
      <ul className="mt-2 space-y-1 max-h-64 overflow-auto pr-1">
        {count === 0 ? <li className="text-xs text-muted-foreground py-2">{empty}</li> : children}
      </ul>
    </div>
  );
}
