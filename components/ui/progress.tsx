import { cn } from "@/lib/cn";

/** Determinate bar. `value` 0-100. */
export function Progress({ value, className, tone = "var(--ember)" }: { value: number; className?: string; tone?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/5", className)}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: tone }} />
    </div>
  );
}
