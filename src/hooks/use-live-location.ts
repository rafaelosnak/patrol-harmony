import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tracks current user's GPS while they're "on duty" (status working or round)
 * and writes last_lat/last_lng/last_location_at to their profile every ~30s.
 */
export function useLiveLocation(opts: { userId: string | undefined; enabled: boolean; intervalMs?: number }) {
  const { userId, enabled, intervalMs = 30000 } = opts;
  const lastSentRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || !userId) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const sendPosition = (pos: GeolocationPosition) => {
      const now = Date.now();
      if (now - lastSentRef.current < intervalMs) return;
      lastSentRef.current = now;
      supabase.from("profiles").update({
        last_lat: pos.coords.latitude,
        last_lng: pos.coords.longitude,
        last_location_at: new Date().toISOString(),
      }).eq("id", userId).then(() => {});
    };

    // Immediate ping, then watch
    navigator.geolocation.getCurrentPosition(sendPosition, () => {}, { enableHighAccuracy: true, timeout: 10000 });
    const watchId = navigator.geolocation.watchPosition(sendPosition, () => {}, {
      enableHighAccuracy: true,
      maximumAge: intervalMs,
      timeout: 60000,
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [userId, enabled, intervalMs]);
}
