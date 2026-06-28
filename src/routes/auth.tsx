import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, Mail, Lock, User as UserIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — PhytonGuard" },
      { name: "description", content: "Acesse a central PhytonGuard." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const resolveHome = async (uid: string) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    const roles = (data ?? []).map((r) => r.role);
    return roles.includes("super_admin") ? "/super-admin" : "/dashboard";
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const dest = await resolveHome(data.session.user.id);
        navigate({ to: dest });
      }
    });
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Você já pode usar o PhytonGuard.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      const { data: u } = await supabase.auth.getUser();
      const dest = u.user ? await resolveHome(u.user.id) : "/dashboard";
      navigate({ to: dest });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado");
    } finally { setLoading(false); }
  };

  const onGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (result.error) {
      toast.error(result.error.message ?? "Falha no login com Google");
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-12 overflow-hidden">
      <div className="absolute inset-0 -z-10 scanline" />
      <div className="absolute top-1/3 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl -z-10" />
      <div className="absolute bottom-0 -right-32 h-96 w-96 rounded-full bg-destructive/10 blur-3xl -z-10" />

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 shadow-[var(--shadow-glow)] mb-4">
            <Shield className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-gradient">PhytonGuard</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("auth.subtitle")}</p>
        </div>

        <div className="glass rounded-2xl p-6 shadow-[var(--shadow-card)]">
          <h2 className="text-lg font-semibold">
            {mode === "signin" ? t("auth.signin") : t("auth.signup")}
          </h2>

          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="fullName">{t("auth.fullname")}</Label>
                <div className="relative mt-1">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="pl-9" placeholder="João da Silva" />
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="email">{t("auth.email")}</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" placeholder="voce@empresa.com" />
              </div>
            </div>
            <div>
              <Label htmlFor="password">{t("auth.password")}</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9" placeholder="••••••••" />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (mode === "signin" ? t("auth.signin") : t("auth.signup"))}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase text-muted-foreground">ou</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button type="button" variant="outline" onClick={onGoogle} disabled={loading} className="w-full">
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#EA4335" d="M12 10v4h5.6c-.7 2.2-2.7 3.8-5.6 3.8a6 6 0 1 1 0-12 5.6 5.6 0 0 1 4 1.5l2.8-2.8A9.7 9.7 0 0 0 12 2a10 10 0 1 0 9.8 12H12z" />
            </svg>
            {t("auth.google")}
          </Button>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            <button type="button" className="hover:text-foreground" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
              {mode === "signin" ? t("auth.toSignup") : t("auth.toSignin")}
            </button>
          </p>

          {mode === "signin" && (
            <p className="mt-2 text-center text-sm">
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={async () => {
                  if (!email) { toast.error("Informe seu email primeiro"); return; }
                  const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/reset-password`,
                  });
                  if (error) toast.error(error.message);
                  else toast.success("Enviamos um link de redefinição para seu email.");
                }}
              >
                Esqueci minha senha
              </button>
            </p>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">{t("auth.firstAdmin")}</p>
      </div>
    </div>
  );
}
