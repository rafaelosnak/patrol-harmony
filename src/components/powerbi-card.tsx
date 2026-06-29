import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { BarChart3, Copy, RefreshCw, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DATASETS = ["rounds", "occurrences", "shifts", "time_entries", "alerts", "absences", "profiles", "clients"] as const;

function genKey() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return "pbi_" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export function PowerBiCard({ companyId }: { companyId: string }) {
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dataset, setDataset] = useState<(typeof DATASETS)[number]>("rounds");

  const { data, refetch } = useQuery({
    queryKey: ["powerbi-key", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("powerbi_api_key").eq("id", companyId).maybeSingle();
      return data as { powerbi_api_key: string | null } | null;
    },
  });

  const key = data?.powerbi_api_key ?? "";
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const url = key ? `${baseUrl}/api/public/powerbi/${dataset}?company=${companyId}&key=${key}` : "";
  const csvUrl = key ? `${url}&format=csv` : "";

  const rotate = async () => {
    setSaving(true);
    const newKey = genKey();
    const { error } = await supabase.from("companies").update({ powerbi_api_key: newKey }).eq("id", companyId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(key ? "Chave rotacionada" : "Chave gerada");
    refetch();
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  return (
    <section className="glass rounded-xl p-5 lg:col-span-2 space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2"><BarChart3 className="h-4 w-4" />Integração com Power BI</h3>
      <p className="text-xs text-muted-foreground">
        Gere uma chave de acesso e use a URL abaixo no Power BI Desktop: <strong>Obter Dados → Web</strong>. Cole a URL e atualize quando quiser. Os dados retornam em JSON (ou CSV) já filtrados pela sua empresa.
      </p>

      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Label className="text-xs">Chave de API (mantenha em segredo)</Label>
          <div className="relative">
            <Input value={key || "— ainda não gerada —"} readOnly type={show ? "text" : "password"} className="font-mono text-xs pr-20" />
            {key && (
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                <button type="button" onClick={() => setShow((v) => !v)} className="p-1 text-muted-foreground hover:text-foreground" aria-label="mostrar">
                  {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button type="button" onClick={() => copy(key, "Chave")} className="p-1 text-muted-foreground hover:text-foreground" aria-label="copiar">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
        <Button onClick={rotate} disabled={saving} variant={key ? "outline" : "default"}>
          <RefreshCw className="h-4 w-4 mr-1" /> {key ? "Rotacionar" : "Gerar chave"}
        </Button>
      </div>

      <div>
        <Label className="text-xs">Dataset</Label>
        <div className="flex flex-wrap gap-1.5">
          {DATASETS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDataset(d)}
              className={`px-2.5 py-1 rounded-md text-xs border ${dataset === d ? "bg-primary text-primary-foreground border-primary" : "border-border/60 hover:bg-muted/40"}`}
            >{d}</button>
          ))}
        </div>
      </div>

      {key ? (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">URL para Power BI (JSON)</Label>
            <div className="flex gap-2">
              <Input readOnly value={url} className="font-mono text-xs" />
              <Button variant="outline" size="sm" onClick={() => copy(url, "URL JSON")}><Copy className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
          <div>
            <Label className="text-xs">URL alternativa (CSV)</Label>
            <div className="flex gap-2">
              <Input readOnly value={csvUrl} className="font-mono text-xs" />
              <Button variant="outline" size="sm" onClick={() => copy(csvUrl, "URL CSV")}><Copy className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">Como conectar no Power BI</summary>
            <ol className="list-decimal ml-5 mt-2 space-y-1">
              <li>Abra o Power BI Desktop → <strong>Obter Dados</strong> → <strong>Web</strong>.</li>
              <li>Cole a URL JSON e clique OK (anônimo).</li>
              <li>No editor Power Query, expanda o campo <code>data</code> para registros e depois em colunas.</li>
              <li>Clique em <strong>Atualizar</strong> sempre que quiser dados novos. Use também <strong>Atualização agendada</strong> no Power BI Service.</li>
              <li>Repita o processo para outros datasets (rondas, ocorrências, ponto, etc.).</li>
            </ol>
          </details>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Gere uma chave para liberar as URLs.</p>
      )}
    </section>
  );
}
