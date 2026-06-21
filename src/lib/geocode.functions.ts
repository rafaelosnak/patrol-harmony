import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

type GeocodeResponse = {
  status: string;
  results: Array<{ geometry: { location: { lat: number; lng: number } } }>;
};

export const geocodeClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { clientId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: client, error: cErr } = await supabase
      .from("clients")
      .select("id,address,company_id")
      .eq("id", data.clientId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!client) throw new Error("Cliente não encontrado");
    if (!client.address) return { ok: false, reason: "no_address" as const };

    // Ensure user belongs to same company
    const { data: profile } = await supabase
      .from("profiles").select("company_id").eq("id", userId).maybeSingle();
    if (!profile || profile.company_id !== client.company_id) {
      throw new Error("Sem permissão");
    }

    const lovableKey = process.env.LOVABLE_API_KEY;
    const gmapsKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!lovableKey || !gmapsKey) throw new Error("Conector Google Maps não configurado");

    const res = await fetch(
      `${GATEWAY_URL}/maps/api/geocode/json?address=${encodeURIComponent(client.address)}`,
      {
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": gmapsKey,
        },
      },
    );
    if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);
    const json = (await res.json()) as GeocodeResponse;
    if (json.status !== "OK" || !json.results?.[0]) {
      return { ok: false as const, reason: "not_found" as const, status: json.status };
    }

    const { lat, lng } = json.results[0].geometry.location;
    const { error: uErr } = await supabase
      .from("clients")
      .update({ latitude: lat, longitude: lng, geocoded_at: new Date().toISOString() })
      .eq("id", client.id);
    if (uErr) throw new Error(uErr.message);

    return { ok: true as const, lat, lng };
  });
