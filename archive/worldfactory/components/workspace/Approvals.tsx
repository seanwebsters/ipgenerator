"use client";

import { useState } from "react";
import { Check, CheckCheck, TriangleAlert, X } from "lucide-react";
import { AGENTS, STUDIO_BY_KEY } from "@/lib/studios";
import { decideApproval } from "@/lib/franchise";
import { AgentAvatar, Badge, Button, Card, Empty } from "@/components/ui";
import { cx, timeAgo } from "@/lib/util";
import type { WorkspaceProps } from "./types";

type Filter = "pending" | "review" | "decided";

export function Approvals({ franchise: f, update }: WorkspaceProps) {
  const [filter, setFilter] = useState<Filter>("pending");
  const [open, setOpen] = useState<string | null>(null);
  const items = f.approvals.filter((a) => (filter === "pending" ? a.status === "pending" : filter === "review" ? a.status === "pending" && a.kind === "review" : a.status !== "pending"));
  const pendingAssets = f.approvals.filter((a) => a.status === "pending" && a.kind === "asset");
  const counts = {
    pending: f.approvals.filter((a) => a.status === "pending").length,
    review: f.approvals.filter((a) => a.status === "pending" && a.kind === "review").length,
    decided: f.approvals.filter((a) => a.status !== "pending").length,
  };

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="font-display text-3xl font-bold">Approvals</h1>
          <div className="text-sm text-muted">Nothing becomes canon-approved until you say so. Canon reviews appear when an asset depends on something you changed.</div>
        </div>
        {pendingAssets.length > 1 && (
          <Button variant="secondary" onClick={() => update((d) => pendingAssets.forEach((a) => decideApproval(d, a.id, "approved")))}>
            <CheckCheck className="h-4 w-4" /> Approve all {pendingAssets.length} new assets
          </Button>
        )}
      </div>

      <div className="mb-5 flex gap-2">
        {(["pending", "review", "decided"] as Filter[]).map((k) => (
          <button key={k} onClick={() => setFilter(k)} className={cx("rounded-full border px-3 py-1 text-sm capitalize", filter === k ? "border-white/30 bg-white/10" : "border-line text-muted")}>
            {k === "review" ? "Canon reviews" : k} <span className="ml-1 tabular-nums text-muted">{counts[k]}</span>
          </button>
        ))}
      </div>

      {!items.length ? (
        <Empty title="Queue is clear" body="When department agents deliver work, or a canon change touches existing assets, it lands here." />
      ) : (
        <div className="space-y-3">
          {items.map((a) => {
            const asset = f.assets.find((x) => x.id === a.refId);
            return (
              <Card key={a.id} className={cx("p-4", a.kind === "review" && a.status === "pending" && "border-rose-400/30")}>
                <div className="flex items-start gap-4">
                  <AgentAvatar agent={a.agent} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{a.title}</span>
                      {a.kind === "review" ? (
                        <Badge color="#f87171">
                          <TriangleAlert className="h-3 w-3" /> Canon review
                        </Badge>
                      ) : (
                        <Badge color={STUDIO_BY_KEY[a.studio].accent}>{STUDIO_BY_KEY[a.studio].name}</Badge>
                      )}
                      {a.status !== "pending" && <Badge color={a.status === "approved" ? "#34d399" : "#9b9bb4"}>{a.status}</Badge>}
                    </div>
                    <div className="mt-1 text-sm text-muted">{a.description}</div>
                    <div className="mt-1 text-[11px] text-muted">
                      {AGENTS[a.agent].name}, {AGENTS[a.agent].title} · {timeAgo(a.createdAt)}
                      {asset && (
                        <button onClick={() => setOpen(open === a.id ? null : a.id)} className="ml-2 text-amber-300 hover:underline">
                          {open === a.id ? "hide" : "view"} deliverable
                        </button>
                      )}
                    </div>
                    {open === a.id && asset && <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-black/30 p-3 font-sans text-sm text-white/85">{asset.body}</pre>}
                  </div>
                  {a.status === "pending" && (
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" onClick={() => update((d) => decideApproval(d, a.id, "approved"))}>
                        <Check className="h-3.5 w-3.5" /> {a.kind === "review" ? "Still canon" : "Approve"}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => update((d) => decideApproval(d, a.id, "rejected"))}>
                        <X className="h-3.5 w-3.5" /> {a.kind === "review" ? "Rework" : "Reject"}
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
