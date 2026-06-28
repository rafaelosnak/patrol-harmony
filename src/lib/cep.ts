// Busca endereço por CEP usando BrasilAPI (fallback ViaCEP)
export type CepAddress = {
  cep: string;
  street?: string;
  district?: string;
  city?: string;
  state?: string;
};

export async function lookupCep(raw: string): Promise<CepAddress | null> {
  const cep = raw.replace(/\D+/g, "");
  if (cep.length !== 8) return null;
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
    if (r.ok) {
      const d = await r.json();
      return { cep, street: d.street, district: d.neighborhood, city: d.city, state: d.state };
    }
  } catch { /* fallback */ }
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (r.ok) {
      const d = await r.json();
      if (!d.erro) return { cep, street: d.logradouro, district: d.bairro, city: d.localidade, state: d.uf };
    }
  } catch { /* ignore */ }
  return null;
}

export const fmtCep = (s: string) => {
  const d = s.replace(/\D+/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

// Distância Haversine em metros
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
