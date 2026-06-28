import { createFileRoute } from "@tanstack/react-router";
import { Settings as SettingsIcon, Lock, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  const { profile, roles, isSuperAdmin, companyId } = useAuth();

  const { data: companyStatus } = useQuery({
    queryKey: ["my-company-status", companyId],
    enabled: !!companyId && !isSuperAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("status,name,created_at,due_date").eq("id", companyId!).maybeSingle();
      return data as { status: string; name: string; created_at: string; due_date: string | null } | null;
    },
  });

  const activationDays = companyStatus?.created_at
    ? Math.max(0, Math.floor((Date.now() - new Date(companyStatus.created_at).getTime()) / 86400000))
    : null;

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

        {!isSuperAdmin && companyStatus && (
          <section className="glass rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Status da Empresa
            </h3>
            <dl className="text-sm divide-y divide-border/60">
              <div className="grid grid-cols-3 py-2"><dt className="text-muted-foreground">Empresa</dt><dd className="col-span-2 font-medium">{companyStatus.name}</dd></div>
              <div className="grid grid-cols-3 py-2"><dt className="text-muted-foreground">Status</dt><dd className="col-span-2 text-emerald-600 dark:text-emerald-400 font-medium">Sistema ativo</dd></div>
              {activationDays !== null && (
                <div className="grid grid-cols-3 py-2"><dt className="text-muted-foreground">Tempo de ativação</dt><dd className="col-span-2">ativo há <strong>{activationDays}</strong> {activationDays === 1 ? "dia" : "dias"}</dd></div>
              )}
              {companyStatus.due_date && (
                <div className="grid grid-cols-3 py-2"><dt className="text-muted-foreground">Vencimento</dt><dd className="col-span-2">{new Date(companyStatus.due_date).toLocaleDateString("pt-BR")}</dd></div>
              )}
            </dl>
          </section>
        )}

        <section className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-3">{t("settings.lang")}</h3>
          <div className="flex gap-2">
            <Button variant={lang === "pt" ? "default" : "outline"} onClick={() => setLang("pt")}>Português (BR)</Button>
            <Button variant={lang === "en" ? "default" : "outline"} onClick={() => setLang("en")}>English</Button>
          </div>
        </section>

        <ChangePasswordCard />
      </div>

      {!isSuperAdmin && roles.includes("admin") && companyId && <ShiftHoursCard companyId={companyId} />}
    </div>
  );
}

function ShiftHoursCard({ companyId }: { companyId: string }) {
  const { data, refetch } = useQuery({
    queryKey: ["company-shift-hours", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("shift_a_start,shift_a_end,shift_b_start,shift_b_end,shift_c_start,shift_c_end")
        .eq("id", companyId)
        .maybeSingle();
      return data;
    },
  });
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const v = (k: string, fallback: string) => form[k] ?? (data?.[k as keyof typeof data] as string | null)?.slice(0, 5) ?? fallback;

  const save = async () => {
    setSaving(true);
    const payload: Record<string, string> = {};
    (["shift_a_start","shift_a_end","shift_b_start","shift_b_end","shift_c_start","shift_c_end"] as const).forEach((k) => {
      payload[k] = v(k, "00:00");
    });
    const { error } = await supabase.from("companies").update(payload).eq("id", companyId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Horários dos turnos atualizados");
    setForm({});
    refetch();
  };

  const Row = ({ label, sk, ek }: { label: string; sk: string; ek: string }) => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
      <div className="text-sm font-medium">{label}</div>
      <div>
        <Label className="text-xs">Início</Label>
        <Input type="time" value={v(sk, "")} onChange={(e) => setForm((f) => ({ ...f, [sk]: e.target.value }))} />
      </div>
      <div>
        <Label className="text-xs">Fim</Label>
        <Input type="time" value={v(ek, "")} onChange={(e) => setForm((f) => ({ ...f, [ek]: e.target.value }))} />
      </div>
    </div>
  );

  return (
    <section className="glass rounded-xl p-5 space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2"><SettingsIcon className="h-4 w-4" />Horários dos Turnos (A / B / C)</h3>
      <p className="text-xs text-muted-foreground">Defina o intervalo de cada turno. Esses horários são usados para identificar em qual turno cada funcionário trabalha.</p>
      <div className="space-y-3">
        <Row label="Turno A" sk="shift_a_start" ek="shift_a_end" />
        <Row label="Turno B" sk="shift_b_start" ek="shift_b_end" />
        <Row label="Turno C" sk="shift_c_start" ek="shift_c_end" />
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving || Object.keys(form).length === 0}>{saving ? "Salvando..." : "Salvar horários"}</Button>
      </div>
    </section>
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
