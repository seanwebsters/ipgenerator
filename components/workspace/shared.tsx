"use client";

import { useState } from "react";
import { Check, ChevronDown, TriangleAlert, X } from "lucide-react";
import type { Asset, Franchise, StudioKey } from "@/lib/types";
import { AGENTS, STUDIO_BY_KEY } from "@/lib/studios";
import { decideAsset } from "@/lib/franchise";
import { AgentAvatar, Badge, Button, Card, StatusPill } from "@/components/ui";
import { StudioIcon } from "@/components/StudioIcon";
import { timeAgo } from "@/lib/util";
import type { WorkspaceProps } from "./types";

export function StudioHeader({ studio, children, subtitle }: { studio: StudioKey; children?: React.ReactNode; subtitle?: string }) {
  const s = STUDIO_BY_KEY[studio];
  const agent = AGENTS[studio];
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div className="flex items-center gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-2xl" style={{ background: `${s.accent}22`, color: s.accent, boxShadow: `0 0 40px -12px ${s.accent}` }}>
          <StudioIcon studio={studio} className="h-6 w-6" />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-bold">{s.name}</h1>
            {s.depth === "light" && <Badge className="border-line text-muted">Light</Badge>}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-sm text-muted">
            <AgentAvatar agent={studio} size={18} />
            {agent.name}, {agent.title} · {subtitle ?? s.short}
          </div>
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function AssetCard({ asset, franchise, update, compact }: { asset: Asset; franchise: Franchise; update: WorkspaceProps["update"]; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const deps = asset.dependsOn.map((id) => franchise.characters.find((c) => c.id === id)).filter(Boolean);
  const actionable = asset.status === "pending" || asset.status === "needs_review";
  return (
    <Card className={asset.status === "needs_review" ? "border-rose-400/30" : undefined}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted">
              <StudioIcon studio={asset.studio} className="h-3 w-3" /> {asset.kind}
            </div>
            <div className="mt-1 font-semibold">{asset.title}</div>
            <div className="mt-0.5 text-sm text-muted">{asset.summary}</div>
          </div>
          <StatusPill status={asset.status} />
        </div>
        {asset.status === "needs_review" && asset.reviewReason && (
          <div className="mt-3 flex gap-2 rounded-lg bg-rose-500/10 p-2.5 text-xs text-rose-200">
            <TriangleAlert className="h-4 w-4 shrink-0" /> {asset.reviewReason}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {deps.map((c) => (
            <Badge key={c!.id} color={c!.color}>
              {c!.name}
            </Badge>
          ))}
          <span className="text-[11px] text-muted">canon v{asset.canonVersion} · {timeAgo(asset.createdAt)}</span>
        </div>
        {!compact && (
          <button onClick={() => setOpen(!open)} className="mt-3 flex items-center gap-1 text-xs text-muted hover:text-white">
            <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} /> {open ? "Hide" : "Show"} deliverable
          </button>
        )}
        {open && <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-black/30 p-3 font-sans text-sm text-white/85">{asset.body}</pre>}
        {actionable && (
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => update((f) => decideAsset(f, asset.id, "approved"))}>
              <Check className="h-3.5 w-3.5" /> {asset.status === "needs_review" ? "Still canon" : "Approve"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => update((f) => decideAsset(f, asset.id, "rejected"))}>
              <X className="h-3.5 w-3.5" /> {asset.status === "needs_review" ? "Needs rework" : "Reject"}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

export function AssetGrid({ assets, franchise, update }: { assets: Asset[]; franchise: Franchise; update: WorkspaceProps["update"] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {assets.map((a) => (
        <AssetCard key={a.id} asset={a} franchise={franchise} update={update} />
      ))}
    </div>
  );
}
