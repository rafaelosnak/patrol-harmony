import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, LogIn, Coffee, Utensils, LogOut, MapPin, Pencil, Check, X, Navigation, ExternalLink, Camera, ScanFace } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/ponto")({
  component: PontoPage,
});

type PunchType = "entrada" | "almoco_saida" | "almoco_volta" | "saida";

type Entry = {
  id: string;
  user_id: string;
  punch_type: PunchType;
  punched_at: string;
  latitude: number | null;
  longitude: number | null;
  selfie_url: string | null;
};

const STEPS: { type: PunchType; label: string; icon: typeof LogIn; color: string }[] = [
  { type: "entrada", label: "Entrada", icon: LogIn, color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
  { type: "almoco_saida", label: "Saída p/ almoço", icon: Coffee, color: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
  { type: "almoco_volta", label: "Volta do almoço", icon: Utensils, color: "bg-sky-500/15 text-sky-300 border-sky-500/40" },
  { type: "saida", label: "Saída", icon: LogOut, color: "bg-rose-500/15 text-rose-300 border-rose-500/40" },
];

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function PontoPage() {
  const { user, isStaff, companyId } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState<PunchType | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const load = async () => {
    setLoading(true);
    let query = supabase.from("time_entries").select("*").order("punched_at", { ascending: false }).limit(200);
    if (!isStaff && user) query = query.eq("user_id", user.id);
    const { data } = await query;
    const list = (data ?? []) as Entry[];
    setEntries(list);
    const ids = Array.from(new Set(list.map((e) => e.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p) => { map[p.id] = p.full_name; });
      setNames(map);
    }
    setLoading(false);
  };

  useEffect(() => { if (user) load(); /* eslint-disable-next-line */ }, [user?.id, isStaff]);

  const todayMine = useMemo(() => {
    const todayStr = new Date().toDateString();
    return entries.filter((e) => e.user_id === user?.id && new Date(e.punched_at).toDateString() === todayStr);
  }, [entries, user?.id]);

  const doneToday = new Set(todayMine.map((e) => e.punch_type));
  const nextStep = STEPS.find((s) => !doneToday.has(s.type))?.type ?? null;

  const punch = async (type: PunchType) => {
    if (!user) return;
    setPunching(type);
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => {
        if (!navigator.geolocation) return rej(new Error("geo"));
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 });
      });
      lat = pos.coords.latitude; lng = pos.coords.longitude;
    } catch { /* opcional */ }

    const { error } = await supabase.from("time_entries").insert({
      user_id: user.id, punch_type: type, latitude: lat, longitude: lng, company_id: companyId!,
    });
    setPunching(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`${STEPS.find((s) => s.type === type)?.label} registrada`);
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /> Ponto</h1>
        <p className="text-sm text-muted-foreground">Entrada, almoço, volta e saída — registro com data, hora e geolocalização.</p>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Agora</p>
            <p className="text-3xl font-mono font-bold tracking-tight">{now.toLocaleTimeString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground">{now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</p>
          </div>
          <Badge variant="outline" className="text-xs">Jornada de hoje</Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {STEPS.map((s) => {
            const entry = todayMine.find((e) => e.punch_type === s.type);
            const isNext = nextStep === s.type;
            const Icon = s.icon;
            return (
              <div key={s.type} className={`rounded-xl border p-4 ${entry ? s.color : "bg-card/60 border-border/60"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{s.label}</span>
                </div>
                {entry ? (
                  <>
                    <p className="text-2xl font-mono font-bold">{fmtTime(entry.punched_at)}</p>
                    {entry.latitude != null && (
                      <div className="mt-1 flex items-center gap-2 text-[10px]">
                        <a href={`https://www.google.com/maps?q=${entry.latitude},${entry.longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                          <MapPin className="h-3 w-3" /> Maps
                        </a>
                        <a href={`https://www.waze.com/ul?ll=${entry.latitude},${entry.longitude}&navigate=yes`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                          <Navigation className="h-3 w-3" /> Waze
                        </a>
                      </div>
                    )}
                  </>
                ) : (
                  <Button
                    size="sm"
                    className="w-full mt-1"
                    variant={isNext ? "default" : "outline"}
                    disabled={!isNext || punching === s.type}
                    onClick={() => punch(s.type)}
                  >
                    {punching === s.type ? "Registrando..." : isNext ? "Bater ponto" : "Aguardando"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {!nextStep && <p className="mt-4 text-sm text-emerald-300">✓ Jornada de hoje finalizada.</p>}
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Histórico {isStaff ? "(toda a equipe)" : "(seus registros)"}</h2>
        </div>
        <div className="max-h-[500px] overflow-auto">
          {loading ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Carregando...</p>
          ) : entries.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Nenhum registro ainda.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Data</th>
                  <th className="text-left p-3">Hora</th>
                  <th className="text-left p-3">Funcionário</th>
                  <th className="text-left p-3">Tipo</th>
                  <th className="text-left p-3">Local</th>
                  {isStaff && <th className="text-right p-3">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const s = STEPS.find((x) => x.type === e.punch_type)!;
                  const who = names[e.user_id] ?? (e.user_id === user?.id ? "Você" : "—");
                  return (
                    <EntryRow
                      key={e.id}
                      entry={e}
                      step={s}
                      who={who}
                      canEdit={!!isStaff}
                      onSaved={load}
                    />
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function EntryRow({
  entry, step, who, canEdit, onSaved,
}: {
  entry: Entry;
  step: typeof STEPS[number];
  who: string;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const toLocal = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [draft, setDraft] = useState(toLocal(entry.punched_at));

  const save = async () => {
    setSaving(true);
    const iso = new Date(draft).toISOString();
    const { error } = await supabase.from("time_entries").update({ punched_at: iso }).eq("id", entry.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Ponto ajustado");
    setEditing(false);
    onSaved();
  };

  return (
    <tr className="border-t border-border/40">
      <td className="p-3">{fmtDate(entry.punched_at)}</td>
      <td className="p-3 font-mono">
        {editing ? (
          <Input
            type="datetime-local"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-8 w-48"
          />
        ) : (
          fmtTime(entry.punched_at)
        )}
      </td>
      <td className="p-3 font-medium">{who}</td>
      <td className="p-3"><Badge variant="outline" className={step.color}>{step.label}</Badge></td>
      <td className="p-3 text-xs text-muted-foreground">
        {entry.latitude != null ? (
          <div className="inline-flex items-center gap-2">
            <a
              href={`https://www.google.com/maps?q=${entry.latitude},${entry.longitude}`}
              target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> Maps
            </a>
            <a
              href={`https://www.waze.com/ul?ll=${entry.latitude},${entry.longitude}&navigate=yes`}
              target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <Navigation className="h-3 w-3" /> Waze
            </a>
          </div>
        ) : "—"}
      </td>
      {canEdit && (
        <td className="p-3 text-right">
          {editing ? (
            <div className="inline-flex gap-1">
              <Button size="sm" variant="outline" onClick={save} disabled={saving}>
                <Check className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setDraft(toLocal(entry.punched_at)); setEditing(false); }}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)} title="Ajustar hora">
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </td>
      )}
    </tr>
  );
}
