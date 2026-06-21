import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Map as MapIcon, Truck, Users, AlertTriangle } from "lucide-react";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { PageHeader, StatusDot } from "@/components/pg/ui";

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

function MapPage() {
  const { t } = useI18n();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  const { data: team } = useQuery({
    queryKey: ["map-team"],
    queryFn: async () => (await supabase.from("profiles").select("id,full_name,status,unit_id").limit(50)).data ?? [],
  });
  const { data: vehicles } = useQuery({
    queryKey: ["map-vehicles"],
    queryFn: async () => (await supabase.from("vehicles").select("id,prefix,plate,status").limit(50)).data ?? [],
  });
  const { data: units } = useQuery({
    queryKey: ["map-units"],
    queryFn: async () => (await supabase.from("units").select("id,name,address,latitude,longitude").limit(200)).data ?? [],
    refetchInterval: 30000,
  });
  const { data: alerts } = useQuery({
    queryKey: ["map-alerts"],
    queryFn: async () => (await supabase.from("alerts").select("id,alert_type,latitude,longitude,created_at,profiles(full_name)").eq("status", "active").limit(50)).data ?? [],
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
        styles: [
          { elementType: "geometry", stylers: [{ color: "#0b1220" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#0b1220" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
          { featureType: "road", elementType: "geometry", stylers: [{ color: "#1f2937" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1a2b" }] },
          { featureType: "poi", stylers: [{ visibility: "off" }] },
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

    (units ?? []).forEach((u) => {
      if (u.latitude == null || u.longitude == null) return;
      const pos = { lat: Number(u.latitude), lng: Number(u.longitude) };
      const m = new g.maps.Marker({
        position: pos, map, title: u.name ?? "Unidade",
        icon: { path: g.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#22c55e", fillOpacity: 0.9, strokeColor: "#064e3b", strokeWeight: 2 },
      });
      const info = new g.maps.InfoWindow({ content: `<div style="color:#0b1220"><strong>${u.name ?? ""}</strong><br/>${u.address ?? ""}</div>` });
      m.addListener("click", () => info.open({ map, anchor: m }));
      markersRef.current.push(m);
      bounds.extend(pos); has = true;
    });

    (alerts ?? []).forEach((a) => {
      if (a.latitude == null || a.longitude == null) return;
      const pos = { lat: Number(a.latitude), lng: Number(a.longitude) };
      const m = new g.maps.Marker({
        position: pos, map, title: `Alerta: ${a.alert_type}`,
        icon: { path: g.maps.SymbolPath.CIRCLE, scale: 10, fillColor: "#ef4444", fillOpacity: 0.95, strokeColor: "#7f1d1d", strokeWeight: 2 },
        animation: g.maps.Animation.BOUNCE,
      });
      const who = (a as { profiles?: { full_name?: string } }).profiles?.full_name ?? "—";
      const info = new g.maps.InfoWindow({ content: `<div style="color:#0b1220"><strong>🚨 ${a.alert_type}</strong><br/>${who}<br/>${new Date(a.created_at).toLocaleString()}</div>` });
      m.addListener("click", () => info.open({ map, anchor: m }));
      markersRef.current.push(m);
      bounds.extend(pos); has = true;
    });

    if (has) {
      map.fitBounds(bounds);
      if ((markersRef.current.length ?? 0) <= 1) map.setZoom(15);
    }
  }, [units, alerts]);

  const activeAlerts = alerts ?? [];

  return (
    <div className="space-y-4">
      <PageHeader title={t("map.title")} subtitle={t("map.subtitle")} />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="glass rounded-xl overflow-hidden h-[calc(100vh-220px)] min-h-[420px] relative">
          {BROWSER_KEY ? (
            <div ref={mapRef} className="absolute inset-0" />
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
          {activeAlerts.length > 0 && (
            <div className="glass rounded-xl p-4 border border-status-sos/40">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-status-sos"><AlertTriangle className="h-4 w-4" />Alertas ativos</h3>
              <ul className="mt-2 space-y-1">
                {activeAlerts.map((a) => (
                  <li key={a.id} className="text-xs py-1">
                    <strong className="capitalize">{a.alert_type}</strong> • {(a as { profiles?: { full_name?: string } }).profiles?.full_name ?? "—"}
                  </li>
                ))}
              </ul>
            </div>
          )}
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
