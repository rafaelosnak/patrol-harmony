import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Map, Users, Footprints, AlertOctagon, Siren,
  CalendarClock, Truck, Megaphone, Building2, BarChart3, Settings, ShieldAlert,
  UserCog, Clock, MessageCircle, Crown, Phone,
} from "lucide-react";

import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (p: string) => pathname === p || pathname.startsWith(p + "/");
  const { t } = useI18n();
  const { isStaff, isSuperAdmin } = useAuth();

  const groups: { label: string; items: { title: string; url: string; icon: typeof Map; external?: boolean }[] }[] = isSuperAdmin
    ? [{
        label: "Super Admin",
        items: [{ title: "Empresas", url: "/super-admin", icon: Crown }],
      }]
    : [
        {
          label: t("nav.group.operation"),
          items: [
            { title: t("nav.dashboard"), url: "/dashboard", icon: LayoutDashboard },
            { title: t("nav.map"), url: "/mapa", icon: Map },
            { title: t("nav.teams"), url: "/equipes", icon: Users },
            { title: t("nav.rounds"), url: "/rondas", icon: Footprints },
            { title: t("nav.occurrences"), url: "/ocorrencias", icon: AlertOctagon },
            { title: t("nav.alerts"), url: "/alertas", icon: Siren },
            { title: "Ponto", url: "/ponto", icon: Clock },
            { title: "Chat interno", url: "/chat", icon: MessageCircle },
          ],
        },
        ...(isStaff ? [{
          label: t("nav.group.management"),
          items: [
            { title: "Funcionários", url: "/funcionarios", icon: UserCog },
            { title: t("nav.shifts"), url: "/escalas", icon: CalendarClock },
            { title: t("nav.vehicles"), url: "/viaturas", icon: Truck },
            { title: t("nav.announcements"), url: "/comunicados", icon: Megaphone },
            { title: t("nav.clients"), url: "/clientes", icon: Building2 },
          ],
        }] : []),
        {
          label: t("nav.group.system"),
          items: [
            ...(isStaff ? [{ title: t("nav.reports"), url: "/relatorios", icon: BarChart3 }] : []),
            { title: t("nav.settings"), url: "/configuracoes", icon: Settings },
            { title: "Suporte", url: "/suporte", icon: Phone },
          ],
        },
      ];

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-3 py-4">
        <Link to={isSuperAdmin ? "/super-admin" : "/dashboard"} className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 grid place-items-center shadow-[var(--shadow-glow)]">
            <ShieldAlert className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-tight">PhytonGuard</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Command Center</div>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((g) => (
          <SidebarGroup key={g.label}>
            {!collapsed && <SidebarGroupLabel>{g.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={!item.external && isActive(item.url)} tooltip={item.title}>
                      {item.external ? (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5">
                          <item.icon className="h-4 w-4 shrink-0" />
                          {!collapsed && <span className="truncate">{item.title}</span>}
                        </a>
                      ) : (
                        <Link to={item.url} className="flex items-center gap-2.5">
                          <item.icon className="h-4 w-4 shrink-0" />
                          {!collapsed && <span className="truncate">{item.title}</span>}
                        </Link>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
