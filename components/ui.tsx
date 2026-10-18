"use client";

import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import type { AgentKey, AssetStatus } from "@/lib/types";
import { AGENTS, STUDIO_BY_KEY } from "@/lib/studios";
import { cx } from "@/lib/util";
import { StudioIcon } from "./StudioIcon";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="group flex items-center gap-2.5">
      <span className="relative grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-amber-300 via-violet-500 to-indigo-700 shadow-[0_0_24px_-4px_rgba(139,92,246,0.8)]">
        <span className="h-3 w-3 rotate-45 rounded-[3px] bg-ink/90" />
      </span>
      <span className="text-[15px] font-bold tracking-[0.18em]">WORLDFACTORY</span>
    </Link>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-6 text-base",
        variant === "primary" &&
          "bg-gradient-to-r from-amber-300 to-amber-400 text-ink shadow-[0_8px_30px_-8px_rgba(251,191,36,0.6)] hover:from-amber-200 hover:to-amber-300",
        variant === "secondary" && "border border-line bg-white/5 text-white hover:bg-white/10",
        variant === "ghost" && "text-muted hover:bg-white/5 hover:text-white",
        variant === "danger" && "border border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20",
        className,
      )}
    >
      {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cx("rounded-2xl border border-line bg-panel/80", className)}>
      {children}
    </div>
  );
}

export function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{eyebrow}</div>}
        <h2 className="font-display text-xl font-semibold">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function Badge({ children, color, className }: { children: React.ReactNode; color?: string; className?: string }) {
  return (
    <span
      className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", className)}
      style={color ? { borderColor: `${color}55`, color, background: `${color}14` } : undefined}
    >
      {children}
    </span>
  );
}

const STATUS: Record<AssetStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "#9b9bb4" },
  pending: { label: "Awaiting approval", color: "#fbbf24" },
  approved: { label: "Canon-approved", color: "#34d399" },
  needs_review: { label: "Needs review", color: "#f87171" },
};

export function StatusPill({ status }: { status: AssetStatus }) {
  const s = STATUS[status];
  return (
    <Badge color={s.color}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </Badge>
  );
}

export function AgentAvatar({ agent, size = 32 }: { agent: AgentKey | "you"; size?: number }) {
  if (agent === "you")
    return (
      <span className="grid shrink-0 place-items-center rounded-full bg-white/10 text-[11px] font-semibold" style={{ width: size, height: size }}>
        You
      </span>
    );
  const color = agent === "director" ? "#fbbf24" : STUDIO_BY_KEY[agent].accent;
  return (
    <span
      title={`${AGENTS[agent].name} - ${AGENTS[agent].title}`}
      className="relative grid shrink-0 place-items-center rounded-full"
      style={{ width: size, height: size, background: `radial-gradient(circle at 30% 30%, ${color}, ${color}33 70%)`, boxShadow: `0 0 18px -6px ${color}` }}
    >
      {agent === "director" ? (
        <span className="text-[11px] font-bold text-ink">AT</span>
      ) : (
        <StudioIcon studio={agent} className="h-[45%] w-[45%] text-ink" />
      )}
    </span>
  );
}

export function ScoreBar({ label, value, color = "#8b5cf6" }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] text-muted">
        <span>{label}</span>
        <span className="tabular-nums text-white/80">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

export function SourceTag({ source }: { source?: "claude" | "mock" }) {
  if (!source) return null;
  return (
    <Badge color={source === "claude" ? "#c4b5fd" : "#9b9bb4"}>{source === "claude" ? "Generated by Claude" : "Mock generator"}</Badge>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-line bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20";

export function Empty({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      <div className="font-medium">{title}</div>
      <div className="mx-auto mt-1 max-w-md text-sm text-muted">{body}</div>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
