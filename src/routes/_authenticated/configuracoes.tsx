import { createFileRoute } from "@tanstack/react-router";
import { Settings as SettingsIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { PageHeader, Pill } from "@/components/pg/ui";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

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
      </div>
    </div>
  );
}
