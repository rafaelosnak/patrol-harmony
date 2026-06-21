import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Send, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/pg/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Chat interno — PhytonGuard" }] }),
  component: ChatPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm">
      <h2 className="font-semibold mb-2">Não foi possível abrir o chat</h2>
      <pre className="text-xs whitespace-pre-wrap text-muted-foreground">{error?.message ?? String(error)}</pre>
    </div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">Página não encontrada.</div>,
});

type Message = {
  id: string;
  thread_user_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

function ChatPage() {
  const { user, isStaff } = useAuth();
  const qc = useQueryClient();
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // For vigia: thread is themselves. For staff: list of vigia threads.
  const threadId = isStaff ? selectedThread : user?.id ?? null;

  const { data: vigias } = useQuery({
    queryKey: ["chat-vigias"],
    enabled: isStaff,
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "vigia");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from("profiles").select("id,full_name,avatar_url").in("id", ids);
      return profs ?? [];
    },
  });

  const { data: messages } = useQuery<Message[]>({
    queryKey: ["chat-messages", threadId],
    enabled: !!threadId,
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("thread_user_id", threadId!)
        .order("created_at", { ascending: true });
      return (data ?? []) as Message[];
    },
  });

  useEffect(() => {
    if (!threadId) return;
    const ch = supabase
      .channel(`messages-${threadId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `thread_user_id=eq.${threadId}` },
        () => qc.invalidateQueries({ queryKey: ["chat-messages", threadId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [threadId, qc]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    if (!user || !threadId || !text.trim()) return;
    const body = text.trim();
    setText("");
    const { error } = await supabase.from("messages").insert({
      thread_user_id: threadId, sender_id: user.id, body,
    });
    if (error) { toast.error(error.message); setText(body); }
    else qc.invalidateQueries({ queryKey: ["chat-messages", threadId] });
  };

  const selectedName = useMemo(() => {
    if (!isStaff) return "Supervisão / Admin";
    return vigias?.find((v) => v.id === selectedThread)?.full_name ?? "Selecione um vigia";
  }, [isStaff, vigias, selectedThread]);

  return (
    <div className="space-y-4">
      <PageHeader title="Chat interno" subtitle="Converse com a supervisão em tempo real" />
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-3 h-[calc(100vh-220px)]">
        {isStaff && (
          <div className="glass rounded-xl overflow-hidden flex flex-col">
            <div className="px-3 py-2 text-xs uppercase text-muted-foreground border-b border-border/60 flex items-center gap-2">
              <Users className="h-3 w-3" /> Vigias
            </div>
            <div className="flex-1 overflow-y-auto">
              {(vigias ?? []).length === 0 && <div className="p-4 text-xs text-muted-foreground">Nenhum vigia</div>}
              {(vigias ?? []).map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedThread(v.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 text-sm hover:bg-accent/40 transition-colors border-b border-border/40",
                    selectedThread === v.id && "bg-accent/60"
                  )}
                >
                  {v.full_name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="glass rounded-xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border/60 font-medium text-sm">{selectedName}</div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
            {!threadId && <EmptyState icon={MessageCircle} title="Selecione uma conversa" />}
            {threadId && (messages ?? []).length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">Sem mensagens ainda</div>
            )}
            {(messages ?? []).map((m) => {
              const mine = m.sender_id === user?.id;
              return (
                <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                    mine ? "bg-primary text-primary-foreground" : "bg-accent/60"
                  )}>
                    <div className="whitespace-pre-wrap break-words">{m.body}</div>
                    <div className={cn("text-[10px] mt-1 opacity-70")}>
                      {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {threadId && (
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
