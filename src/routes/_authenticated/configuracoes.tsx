import { createFileRoute } from "@tanstack/react-router";
import { Settings as SettingsIcon, Lock, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { PageHeader, Pill } from "@/components/pg/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — PhytonGuard" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { profile, roles } = useAuth();

  return (
    <div className="space-y-4">
      <PageHeader title={t("settings.title")} subtitle="" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><SettingsIcon className="h-4 w-4" />{t("settings.profile")}</h3>
          <dl className="text-sm divide-y divide-border/60">
            <div className="grid grid-cols-3 py-2"><dt className="text-muted-foreground">{t("common.name")}</dt><dd className="col-span-2">{profile?.full_name ?? "—"}</dd></div>
            <div className="grid grid-cols-3 py-2"><dt className="text-muted-foreground">{t("auth.email")}</dt><dd className="col-span-2">{profile?.email ?? "—"}</dd></div>
            <div className="grid grid-cols-3 py-2"><dt className="text-muted-foreground">{t("settings.role")}</dt><dd className="col-span-2 flex flex-wrap gap-1">{roles.map((r) => <Pill key={r} tone="info">{r}</Pill>)}</dd></div>
            <div className="grid grid-cols-3 py-2"><dt className="text-muted-foreground">{t("common.status")}</dt><dd className="col-span-2 capitalize">{profile?.status ?? "—"}</dd></div>
          </dl>
        </section>

        <section className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-3">{t("settings.lang")}</h3>
          <div className="flex gap-2">
            <Button variant={lang === "pt" ? "default" : "outline"} onClick={() => setLang("pt")}>Português (BR)</Button>
            <Button variant={lang === "en" ? "default" : "outline"} onClick={() => setLang("en")}>English</Button>
          </div>
        </section>

        <ChangePasswordCard />
      </div>
    </div>
  );
}

function ChangePasswordCard() {
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 6) { toast.error("A senha precisa ter ao menos 6 caracteres"); return; }
    if (pwd !== confirm) { toast.error("As senhas não coincidem"); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Senha alterada com sucesso");
    setPwd(""); setConfirm("");
  };

  return (
    <section className="glass rounded-xl p-5 lg:col-span-2">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Lock className="h-4 w-4" />Alterar senha</h3>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="new-pwd">Nova senha</Label>
          <div className="relative">
            <Input
              id="new-pwd"
              type={show ? "text" : "password"}
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="mín. 6 caracteres"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={show ? "Ocultar senha" : "Mostrar senha"}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div>
          <Label htmlFor="confirm-pwd">Confirmar nova senha</Label>
          <Input
            id="confirm-pwd"
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <Button type="submit" disabled={saving || !pwd || !confirm}>
            {saving ? "Salvando..." : "Salvar nova senha"}
          </Button>
        </div>
      </form>
      <p className="text-[11px] text-muted-foreground mt-2">Disponível para todos os usuários (admin, supervisor e vigia).</p>
    </section>
  );
}
