import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Building2, Plus, MapPin, ExternalLink, Navigation, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { EmptyState, PageHeader } from "@/components/pg/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useStaffGuard } from "@/hooks/use-staff-guard";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { geocodeClient } from "@/lib/geocode.functions";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({ meta: [{ title: "Clientes — PhytonGuard" }] }),
  component: ClientsPage,
});

type Client = {
  id: string;
  name: string;
  document: string | null;
  contact: string | null;
  address: string | null;
  default_round_mode: string | null;
  geofence_radius_meters: number | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
};

const onlyDigits = (s: string) => s.replace(/\D+/g, "");
const fmtCNPJ = (s: string) => {
  const d = onlyDigits(s).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

const gmapsUrl = (addr: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
const wazeUrl = (addr: string) => `https://www.waze.com/ul?q=${encodeURIComponent(addr)}&navigate=yes`;

const gmapsEmbed = (addr: string) => `https://www.google.com/maps?q=${encodeURIComponent(addr)}&output=embed`;

function ClientsPage() {
  useStaffGuard();
  const { t } = useI18n();
  const { hasRole, companyId } = useAuth();
  const canWrite = hasRole("admin") || hasRole("supervisor");
  const canDelete = hasRole("admin");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const emptyForm = { name: "", document: "", contact: "", address: "", default_round_mode: "checkpoints", geofence_radius_meters: 150, latitude: null as number | null, longitude: null as number | null };
  const [form, setForm] = useState(emptyForm);
  const [previewClient, setPreviewClient] = useState<Client | null>(null);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const geocodeFn = useServerFn(geocodeClient);

  const lookupCnpj = async () => {
    const digits = onlyDigits(form.document);
    if (digits.length !== 14) { toast.error("CNPJ precisa ter 14 dígitos"); return; }
    setCnpjLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) throw new Error("CNPJ não encontrado");
      const d = await res.json();
      const addr = [
        d.logradouro && `${d.logradouro}${d.numero ? `, ${d.numero}` : ""}`,
        d.complemento, d.bairro,
        d.municipio && `${d.municipio} - ${d.uf}`,
        d.cep,
      ].filter(Boolean).join(", ");
      setForm((f) => ({
        ...f,
        name: f.name || d.razao_social || d.nome_fantasia || f.name,
        contact: f.contact || d.ddd_telefone_1 || f.contact,
        address: addr || f.address,
      }));
      toast.success("Dados do CNPJ preenchidos");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao consultar CNPJ");
    } finally { setCnpjLoading(false); }
  };

  const captureLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { toast.error("GPS indisponível"); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setForm((f) => ({ ...f, latitude: p.coords.latitude, longitude: p.coords.longitude })); toast.success(`Localização capturada (±${Math.round(p.coords.accuracy)}m)`); setGpsLoading(false); },
      () => { toast.error("Não foi possível obter GPS"); setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const { data, isLoading } = useQuery<Client[]>({
    queryKey: ["clients"],
    queryFn: async () => ((await supabase.from("clients").select("*").order("created_at", { ascending: false })).data ?? []) as Client[],
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        document: form.document || null,
        contact: form.contact || null,
        address: form.address || null,
        default_round_mode: form.default_round_mode || "checkpoints",
        geofence_radius_meters: form.geofence_radius_meters || 150,
        latitude: form.latitude,
        longitude: form.longitude,
      };
      let clientId: string;
      if (editing) {
        const { error } = await supabase.from("clients").update(payload).eq("id", editing.id);
        if (error) throw error;
        clientId = editing.id;
      } else {
        const { data, error } = await supabase.from("clients").insert({ ...payload, company_id: companyId! }).select("id").single();
        if (error) throw error;
        clientId = (data as { id: string }).id;
      }
      // Geocode in background if address provided/changed and no manual GPS captured
      if (form.address && form.latitude == null && (!editing || editing.address !== form.address)) {
        geocodeFn({ data: { clientId } })
          .then((r) => { if (r.ok) toast.success("Endereço localizado no mapa"); })
          .catch(() => toast.error("Não foi possível localizar o endereço"));
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Cliente atualizado" : "Cliente cadastrado");
      qc.invalidateQueries({ queryKey: ["clients"] });
      setOpen(false); setEditing(null);
      setForm(emptyForm);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("clients").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Cliente removido"); qc.invalidateQueries({ queryKey: ["clients"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (c: Client) => {
    setEditing(c);
    setForm({
      name: c.name, document: c.document ?? "", contact: c.contact ?? "",
      address: c.address ?? "", default_round_mode: c.default_round_mode ?? "checkpoints",
      geofence_radius_meters: c.geofence_radius_meters ?? 150,
      latitude: c.latitude, longitude: c.longitude,
    });
    setOpen(true);
  };



  return (
    <div className="space-y-4">
      <PageHeader title={t("clients.title")} subtitle={t("clients.subtitle")} actions={
        canWrite && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4" />{t("clients.new")}</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{editing ? "Editar cliente" : t("clients.new")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>{t("common.name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{t("clients.document")} (CNPJ)</Label>
                    <div className="flex gap-1">
                      <Input
                        value={form.document}
                        onChange={(e) => setForm({ ...form, document: fmtCNPJ(e.target.value) })}
                        onBlur={() => { if (onlyDigits(form.document).length === 14) lookupCnpj(); }}
                        placeholder="00.000.000/0000-00"
                        maxLength={18}
                      />
                      <Button type="button" variant="outline" size="sm" onClick={lookupCnpj} disabled={cnpjLoading}>
                        {cnpjLoading ? "..." : "Buscar"}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Preenche nome e endereço automaticamente.</p>
                  </div>
                  <div><Label>{t("clients.contact")}</Label><Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} maxLength={120} /></div>
                </div>

                <div>
                  <Label className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Endereço completo</Label>
                  <Textarea
                    rows={2}
                    placeholder="Ex.: Av. Paulista, 1000 — Bela Vista, São Paulo - SP"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                  {form.address.trim() && (
                    <div className="mt-2 space-y-2">
                      <div className="flex gap-2">
                        <a href={gmapsUrl(form.address)} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
                          <ExternalLink className="h-3 w-3" /> Abrir no Google Maps
                        </a>
                        <a href={wazeUrl(form.address)} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
                          <Navigation className="h-3 w-3" /> Abrir no Waze
                        </a>
                      </div>
                      <iframe
                        title="Prévia do endereço"
                        src={gmapsEmbed(form.address)}
                        className="w-full h-48 rounded-md border border-border/60"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="flex items-center gap-1"><Navigation className="h-3 w-3" /> Localização exata (GPS)</Label>
                    <div className="flex gap-1">
                      <Input
                        readOnly
                        value={form.latitude != null && form.longitude != null ? `${form.latitude.toFixed(6)}, ${form.longitude.toFixed(6)}` : ""}
                        placeholder="Use o endereço ou capture no local"
                      />
                      <Button type="button" variant="outline" size="sm" onClick={captureLocation} disabled={gpsLoading}>
                        {gpsLoading ? "..." : "Capturar GPS"}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label>Raio de tolerância (m)</Label>
                    <Input
                      type="number" min={20} max={2000}
                      value={form.geofence_radius_meters}
                      onChange={(e) => setForm({ ...form, geofence_radius_meters: Number(e.target.value) || 150 })}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">Alerta se vigia bater fora dessa distância.</p>
                  </div>
                </div>
                <div>
                  <Label>Como o vigia registra a ronda neste cliente?</Label>
                  <Select value={form.default_round_mode} onValueChange={(v) => setForm({ ...form, default_round_mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checkpoints">Ponto a ponto (vigia confirma cada ponto cadastrado)</SelectItem>
                      <SelectItem value="track">Gravar trajeto por GPS (sistema grava o caminho)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    O admin define aqui. O vigia só inicia a ronda — não escolhe o modo.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>{t("common.cancel")}</Button>
                <Button onClick={() => save.mutate()} disabled={!form.name || save.isPending}>{editing ? "Salvar" : t("common.create")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )
      } />

      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground bg-card/40">
            <tr>
              <th className="text-left px-4 py-3">{t("common.name")}</th>
              <th className="text-left px-4 py-3">{t("clients.document")}</th>
              <th className="text-left px-4 py-3">{t("clients.contact")}</th>
              <th className="text-left px-4 py-3">Endereço</th>
              <th className="text-left px-4 py-3">{t("common.created")}</th>
              <th className="text-right px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">{t("common.loading")}</td></tr>}
            {!isLoading && (data ?? []).length === 0 && <tr><td colSpan={6}><EmptyState icon={Building2} title={t("common.empty")} /></td></tr>}
            {(data ?? []).map((c) => (
              <tr key={c.id} className="hover:bg-accent/30">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.document ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.contact ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{c.address ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-1">
                    {c.address && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setPreviewClient(c)} title="Ver no mapa">
                          <MapPin className="h-3 w-3" />
                        </Button>
                        <a href={gmapsUrl(c.address)} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="ghost" title="Google Maps">
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </a>
                        <a href={wazeUrl(c.address)} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="ghost" title="Waze">
                            <Navigation className="h-3 w-3" />
                          </Button>
                        </a>
                      </>
                    )}
                    {canWrite && <Button size="sm" variant="ghost" onClick={() => openEdit(c)} title="Editar"><Pencil className="h-3 w-3" /></Button>}
                    {canDelete && <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir cliente?")) del.mutate(c.id); }} title="Excluir"><Trash2 className="h-3 w-3" /></Button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!previewClient} onOpenChange={(o) => !o && setPreviewClient(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{previewClient?.name}</DialogTitle>
          </DialogHeader>
          {previewClient?.address && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{previewClient.address}</p>
              <iframe
                title="Mapa do cliente"
                src={gmapsEmbed(previewClient.address)}
                className="w-full h-80 rounded-md border border-border/60"
                loading="lazy"
              />
              <div className="flex gap-2">
                <a href={gmapsUrl(previewClient.address)} target="_blank" rel="noreferrer" className="flex-1">
                  <Button variant="outline" className="w-full"><ExternalLink className="h-4 w-4" /> Google Maps</Button>
                </a>
                <a href={wazeUrl(previewClient.address)} target="_blank" rel="noreferrer" className="flex-1">
                  <Button className="w-full"><Navigation className="h-4 w-4" /> Navegar no Waze</Button>
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
