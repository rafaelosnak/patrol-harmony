import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LogOut, Languages, ShieldAlert } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { t, lang, setLang } = useI18n();
  const { profile, roles, isSuperAdmin, companyId } = useAuth();
  const navigate = useNavigate();
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";

  useEffect(() => {
    if (isSuperAdmin && !pathname.startsWith("/super-admin")) {
      navigate({ to: "/super-admin", replace: true });
    }
  }, [isSuperAdmin, pathname, navigate]);

  // Check company status (block if suspended/overdue, unless super admin)
  const { data: companyStatus } = useQuery({
    queryKey: ["my-company-status", companyId],
    enabled: !!companyId && !isSuperAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("status,name").eq("id", companyId!).maybeSingle();
      return data as { status: string; name: string } | null;
    },
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Até logo!");
    navigate({ to: "/auth" });
  };

  const initials = (profile?.full_name || "P G").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!profile?.avatar_url) { setAvatarUrl(null); return; }
    supabase.storage.from("avatars").createSignedUrl(profile.avatar_url, 3600).then(({ data }) => {
      if (alive) setAvatarUrl(data?.signedUrl ?? null);
    });
    return () => { alive = false; };
  }, [profile?.avatar_url]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 h-14 flex items-center gap-3 border-b border-border/60 bg-background/80 backdrop-blur px-3">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-primary" />
              <span className="font-semibold tracking-tight">PhytonGuard</span>
              <span className="hidden sm:inline text-xs text-muted-foreground">— {t("app.tagline")}</span>
            </div>

            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label="Notificações">
                <Bell className="h-4 w-4" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Idioma">
                    <Languages className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{t("settings.lang")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setLang("pt")} className={lang === "pt" ? "text-primary" : ""}>
                    Português (BR)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLang("en")} className={lang === "en" ? "text-primary" : ""}>
                    English
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 hover:bg-accent transition-colors">
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-primary/50 grid place-items-center text-[11px] font-bold text-primary-foreground overflow-hidden">
                      {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initials}
                    </div>
                    <span className="hidden sm:flex flex-col items-start leading-tight">
                      <span className="text-xs font-medium">{profile?.full_name || "Operador"}</span>
                      <span className="text-[10px] uppercase text-muted-foreground">{roles[0] ?? "—"}</span>
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{profile?.email ?? ""}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="h-4 w-4 mr-2" /> {t("auth.signout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
            {!isSuperAdmin && companyStatus && companyStatus.status !== "active" ? (
              <div className="glass rounded-2xl p-8 text-center max-w-xl mx-auto mt-12">
                <div className="h-14 w-14 rounded-2xl bg-status-sos/20 grid place-items-center text-status-sos mx-auto mb-4">
                  <ShieldAlert className="h-7 w-7" />
                </div>
                <h2 className="text-xl font-bold mb-2">
                  Acesso {companyStatus.status === "suspended" ? "suspenso" : "bloqueado por inadimplência"}
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  A empresa <strong>{companyStatus.name}</strong> está com o acesso ao PhytonGuard {companyStatus.status === "suspended" ? "suspenso" : "bloqueado por inadimplência"}.
                  Entre em contato com o suporte para regularizar.
                </p>
                <Button variant="outline" onClick={signOut}>Sair</Button>
              </div>
            ) : (
              <Outlet />
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
