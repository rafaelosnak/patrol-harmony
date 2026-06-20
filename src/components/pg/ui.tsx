import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatusDot({ status, className }: { status: string; className?: string }) {
  const map: Record<string, string> = {
    working: "bg-status-working text-status-working",
    round: "bg-status-round text-status-round",
    lunch: "bg-status-lunch text-status-lunch",
    transit: "bg-status-transit text-status-transit",
    sos: "bg-status-sos text-status-sos pulse-ring",
    offline: "bg-muted-foreground text-muted-foreground",
    active: "bg-status-sos text-status-sos pulse-ring",
    in_progress: "bg-status-round text-status-round",
    open: "bg-status-sos text-status-sos",
    closed: "bg-muted-foreground text-muted-foreground",
    completed: "bg-status-working text-status-working",
  };
  return <span className={cn("inline-block h-2.5 w-2.5 rounded-full", map[status] ?? "bg-muted-foreground", className)} />;
}

export function Pill({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "success" | "warn" | "danger" | "info" }) {
  const tones: Record<string, string> = {
    default: "bg-muted text-muted-foreground",
    success: "bg-status-working/15 text-status-working border border-status-working/30",
    warn: "bg-status-round/15 text-status-round border border-status-round/30",
    danger: "bg-status-sos/15 text-status-sos border border-status-sos/30",
    info: "bg-primary/15 text-primary border border-primary/30",
  };
  return <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium", tones[tone])}>{children}</span>;
}

export function EmptyState({ icon: Icon, title, subtitle }: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle?: string }) {
  return (
    <div className="text-center py-16">
      <div className="mx-auto h-12 w-12 rounded-2xl bg-muted grid place-items-center mb-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}
