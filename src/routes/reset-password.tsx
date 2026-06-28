import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, Loader2, Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Redefinir senha — PhytonGuard" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase places the recovery session in the URL hash; auth library picks it up automatically.
    supabase.auth.getSession().then(({ data }) => {
      setReady(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error("Senha precisa ter ao menos 8 caracteres"); return; }
    if (password !== confirm) { toast.error("As senhas não conferem"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Senha redefinida com sucesso");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 shadow-[var(--shadow-glow)] mb-4">
            <Shield className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Redefinir senha</h1>
          <p className="mt-2 text-sm text-muted-foreground">Defina uma nova senha para sua conta.</p>
        </div>

        <div className="glass rounded-2xl p-6">
          {!ready ? (
            <p className="text-sm text-muted-foreground text-center">
              Validando link de recuperação… Se nada acontecer, clique novamente no link recebido por email.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Label htmlFor="pw">Nova senha</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="pw" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9" />
                </div>
              </div>
              <div>
                <Label htmlFor="pw2">Confirmar senha</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="pw2" type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="pl-9" />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar nova senha"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
