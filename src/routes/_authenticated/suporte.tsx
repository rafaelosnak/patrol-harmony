import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Headphones, Send, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/pg/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/suporte")({
  head: () => ({ meta: [{ title: "Suporte — PhytonGuard" }] }),
  component: SupportPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm">
      <h2 className="font-semibold mb-2">Não foi possível abrir o suporte</h2>
      <pre className="text-xs whitespace-pre-wrap text-muted-foreground">{error?.message ?? String(error)}</pre>
    </div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">Página não encontrada.</div>,
});

type SupportMessage = {
  id: string;
  company_id: string;
  sender_id: string;
  from_super_admin: boolean;
  body: string;
  created_at: string;
};

function SupportPage() {
  const { user, isSuperAdmin, companyId } = useAuth();
  const qc = useQueryClient();
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeCompany = isSuperAdmin ? selectedCompany : companyId;

  // Super admin: list companies that have support messages OR all companies
  const { data: companies } = useQuery({
    queryKey: ["support-companies"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("id,name,status")
        .order("name");
      return data ?? [];
    },
  });

  const { data: messages } = useQuery<SupportMessage[]>({
    queryKey: ["support-messages", activeCompany],
    enabled: !!activeCompany,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("support_messages")
        .select("*")
        .eq("company_id", activeCompany!)
        .order("created_at", { ascending: true });
      return (data ?? []) as SupportMessage[];
    },
  });

  useEffect(() => {
    if (!activeCompany) return;
    const ch = supabase
      .channel(`support-${activeCompany}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `company_id=eq.${activeCompany}` },
        () => qc.invalidateQueries({ queryKey: ["support-messages", activeCompany] })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeCompany, qc]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    if (!user || !activeCompany || !text.trim()) return;
    const body = text.trim();
    setText("");
    const { error } = await (supabase as any).from("support_messages").insert({
      company_id: activeCompany,
      sender_id: user.id,
      from_super_admin: isSuperAdmin,
      body,
    });
    if (error) { toast.error(error.message); setText(body); }
    else qc.invalidateQueries({ queryKey: ["support-messages", activeCompany] });
  };

  const selectedName = useMemo(() => {
    if (!isSuperAdmin) return "Suporte PhytonGuard";
    return companies?.find((c) => c.id === selectedCompany)?.name ?? "Selecione uma empresa";
  }, [isSuperAdmin, companies, selectedCompany]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Suporte"
        subtitle={isSuperAdmin ? "Atenda empresas em tempo real" : "Fale diretamente com a equipe PhytonGuard"}
      />
      <div className={cn("grid gap-3 h-[calc(100vh-220px)]", isSuperAdmin ? "grid-cols-1 md:grid-cols-[280px_1fr]" : "grid-cols-1")}>
        {isSuperAdmin && (
          <div className="glass rounded-xl overflow-hidden flex flex-col">
            <div className="px-3 py-2 text-xs uppercase text-muted-foreground border-b border-border/60 flex items-center gap-2">
              <Building2 className="h-3 w-3" /> Empresas
            </div>
            <div className="flex-1 overflow-y-auto">
              {(companies ?? []).length === 0 && <div className="p-4 text-xs text-muted-foreground">Nenhuma empresa</div>}
              {(companies ?? []).map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCompany(c.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 text-sm hover:bg-accent/40 transition-colors border-b border-border/40",
                    selectedCompany === c.id && "bg-accent/60"
                  )}
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">{c.status}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="glass rounded-xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border/60 font-medium text-sm flex items-center gap-2">
            <Headphones className="h-4 w-4 text-primary" /> {selectedName}
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
            {!activeCompany && <EmptyState icon={Headphones} title={isSuperAdmin ? "Selecione uma empresa" : "Carregando..."} />}
            {activeCompany && (messages ?? []).length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">
                {isSuperAdmin ? "Sem mensagens dessa empresa" : "Envie sua primeira mensagem para o suporte"}
              </div>
            )}
            {(messages ?? []).map((m) => {
              const mine = m.sender_id === user?.id;
              const fromSupport = m.from_super_admin;
              return (
                <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                    mine ? "bg-primary text-primary-foreground" : fromSupport ? "bg-emerald-500/15 border border-emerald-500/30" : "bg-accent/60"
                  )}>
                    {!mine && (
                      <div className="text-[10px] uppercase opacity-70 mb-0.5">
                        {fromSupport ? "Suporte PhytonGuard" : "Empresa"}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap break-words">{m.body}</div>
                    <div className="text-[10px] mt-1 opacity-70">
                      {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {activeCompany && (
            <div className="border-t border-border/60 p-3 flex gap-2">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Digite uma mensagem..."
                maxLength={4000}
              />
              <Button onClick={send} disabled={!text.trim()}><Send className="h-4 w-4" /></Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
