"use client";

import Link from "next/link";
import { GitCommitVertical, TriangleAlert } from "lucide-react";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { AssetCard } from "./shared";
import type { WorkspaceProps } from "./types";

export function Canon({ franchise: f, update, base }: WorkspaceProps) {
  const flagged = f.assets.filter((a) => a.status === "needs_review");
  const stale = f.assets.filter((a) => a.status === "approved" && a.canonVersion < f.canon.version);
  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">Canon history</h1>
        <div className="text-sm text-muted">
          Every greenlight and edit to the core, cast or world is a new canon version. Assets record the version they were approved against.
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="p-6">
          <SectionTitle eyebrow={`Head: v${f.canon.version}`} title="Versions" />
          <ol className="relative ml-3 border-l border-line">
            {f.canon.history.map((h, i) => (
              <li key={h.version} className="mb-6 ml-6">
                <span className={`absolute -left-[13px] grid h-6 w-6 place-items-center rounded-full ${i === 0 ? "bg-amber-300 text-ink" : "bg-panel-2 text-muted"}`}>
                  <GitCommitVertical className="h-3.5 w-3.5" />
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-lg font-bold">v{h.version}</span>
                  <span className="font-medium">{h.summary}</span>
                  {i === 0 && <Badge color="#fbbf24">current</Badge>}
                </div>
                <div className="text-[11px] text-muted">
                  {new Date(h.createdAt).toLocaleString()} · {h.author} · <code className="font-mono">{h.hash.slice(0, 12)}</code>
                </div>
                <ul className="mt-2 space-y-0.5 text-sm text-white/80">
                  {h.changes.map((c) => (
                    <li key={c}>· {c}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </Card>
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-2 font-semibold">
              <TriangleAlert className="h-4 w-4 text-rose-300" /> Flagged for review ({flagged.length})
            </div>
            <div className="mt-1 text-sm text-muted">These assets depend on canon that changed after they were approved.</div>
          </Card>
          {flagged.map((a) => (
            <AssetCard key={a.id} asset={a} franchise={f} update={update} compact />
          ))}
          {stale.length > 0 && (
            <Card className="p-5 text-sm text-muted">
              {stale.length} approved asset{stale.length === 1 ? " was" : "s were"} approved against an earlier version but don&rsquo;t depend on what changed.{" "}
              <Link href={`${base}/bible`} className="text-amber-300">
                See the IP Bible
              </Link>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
