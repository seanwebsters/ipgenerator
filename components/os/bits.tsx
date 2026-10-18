import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export function PageHeader({ eyebrow, title, intro, actions }: { eyebrow?: string; title: string; intro?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        {eyebrow && <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-brass">{eyebrow}</div>}
        <h1 className="font-display mt-1 text-4xl leading-tight sm:text-5xl">{title}</h1>
        {intro && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{intro}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="font-display mt-1 text-3xl tabular-nums" style={tone ? { color: tone } : undefined}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function Section({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-card", className)}>
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{children}</div>;
}

const RUN: Record<string, "success" | "warning" | "danger" | "outline" | "default" | "brass"> = {
  PENDING: "outline",
  RUNNING: "default",
  WAITING_APPROVAL: "warning",
  BLOCKED: "danger",
  COMPLETED: "success",
  FAILED: "danger",
  CANCELLED: "outline",
  WAITING: "warning",
  SKIPPED: "outline",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={RUN[status] ?? "outline"}>{status === "RUNNING" && <span className="size-1.5 animate-pulse rounded-full bg-current" />}{status.replace(/_/g, " ").toLowerCase()}</Badge>;
}

export function DemoTag({ show }: { show: boolean }) {
  return show ? <Badge variant="demo">Demo</Badge> : null;
}

export function ago(d: Date) {
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const pct = (v: number | null | undefined, digits = 0) => (v == null ? "—" : `${(v * 100).toFixed(digits)}%`);
