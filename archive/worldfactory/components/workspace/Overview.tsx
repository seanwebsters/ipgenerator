"use client";

import Link from "next/link";
import { ArrowRight, Crown, FileDown, TriangleAlert } from "lucide-react";
import { AGENTS, STUDIOS } from "@/lib/studios";
import { genome } from "@/lib/franchise";
import { AgentAvatar, Badge, Card, ScoreBar } from "@/components/ui";
import { FranchiseCover } from "@/components/FranchiseCover";
import { StudioIcon } from "@/components/StudioIcon";
import { timeAgo } from "@/lib/util";
import type { WorkspaceProps } from "./types";

export function Overview({ franchise: f, base }: WorkspaceProps) {
  const pending = f.approvals.filter((a) => a.status === "pending");
  const review = f.assets.filter((a) => a.status === "needs_review");
  const g = genome(f);
  const tasks = f.plan?.phases.flatMap((p) => p.tasks) ?? [];
  const done = tasks.filter((t) => t.status === "done").length;

  return (
    <div className="space-y-6">
      <FranchiseCover franchise={f} className="rounded-3xl border border-line">
        <div className="relative z-10 flex min-h-[260px] flex-col justify-end p-8">
          <div className="flex gap-2">
            <Badge className="border-white/20 bg-black/40 text-white">{f.concept.genre}</Badge>
            <Badge className="border-white/20 bg-black/40 text-white">Canon v{f.canon.version}</Badge>
            <Badge className="border-white/20 bg-black/40 font-mono text-white">{g.signature}</Badge>
          </div>
          <h1 className="font-display mt-3 text-5xl font-bold drop-shadow">{f.name}</h1>
          <p className="mt-2 max-w-2xl text-white/85">{f.tagline}</p>
          <div className="mt-5 flex gap-2">
            <Link href={`${base}/director`} className="inline-flex h-9 items-center gap-2 rounded-xl bg-amber-300 px-4 text-sm font-semibold text-ink">
              <Crown className="h-4 w-4" /> Studio Director
            </Link>
            <Link href={`${base}/bible`} className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/20 bg-black/30 px-4 text-sm">
              <FileDown className="h-4 w-4" /> IP Bible
            </Link>
          </div>
        </div>
      </FranchiseCover>

      {review.length > 0 && (
        <Link href={`${base}/approvals`} className="flex items-center gap-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm">
          <TriangleAlert className="h-5 w-5 text-rose-300" />
          <span className="flex-1">
            <b>{review.length} asset{review.length === 1 ? "" : "s"}</b> {review.length === 1 ? "depends" : "depend"} on canon that changed and {review.length === 1 ? "needs" : "need"} your review.
          </span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="font-semibold">Studios</div>
            <div className="text-xs text-muted">{f.assets.length} assets</div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {STUDIOS.map((s) => {
              const as = f.assets.filter((a) => a.studio === s.key);
              const flagged = as.some((a) => a.status === "needs_review");
              const extra =
                s.key === "characters" ? `${f.characters.length} characters` : s.key === "world" ? `${f.world.locations.length} places` : s.key === "vault" ? `${f.vault.length} records` : s.key === "ip-lab" ? `${f.core.formats.length} formats` : `${as.length} assets`;
              return (
                <Link key={s.key} href={`${base}/${s.key}`} className="group rounded-xl border border-line bg-white/[0.02] p-3 hover:border-white/20">
                  <div className="flex items-center justify-between">
                    <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `${s.accent}22`, color: s.accent }}>
                      <StudioIcon studio={s.key} className="h-4 w-4" />
                    </span>
                    {flagged && <span className="h-2 w-2 rounded-full bg-rose-400" />}
                  </div>
                  <div className="mt-2 text-sm font-medium">{s.name}</div>
                  <div className="text-[11px] text-muted">
                    {AGENTS[s.key].name} · {extra}
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <AgentAvatar agent="director" size={40} />
              <div>
                <div className="font-semibold">Atlas · Studio Director</div>
                <div className="text-xs text-muted">{f.plan ? `${done} of ${tasks.length} tasks done` : "No plan yet"}</div>
              </div>
            </div>
            {f.plan ? (
              <>
                <p className="mt-3 text-sm text-white/80">{f.plan.objective}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full bg-amber-300" style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%` }} />
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted">Ask Atlas for a plan to start building the slate.</p>
            )}
            <Link href={`${base}/director`} className="mt-4 inline-flex items-center gap-1 text-sm text-amber-300">
              Open plan <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Card>
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-semibold">Waiting on you</div>
              <Badge color="#fbbf24">{pending.length}</Badge>
            </div>
            <div className="space-y-2">
              {pending.slice(0, 4).map((a) => (
                <Link key={a.id} href={`${base}/approvals`} className="flex items-center gap-2 rounded-lg p-1.5 text-sm hover:bg-white/5">
                  <AgentAvatar agent={a.agent} size={22} />
                  <span className="flex-1 truncate">{a.title}</span>
                  {a.kind === "review" && <Badge color="#f87171">review</Badge>}
                </Link>
              ))}
              {!pending.length && <div className="text-sm text-muted">All clear.</div>}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="p-5">
          <div className="mb-3 font-semibold">IP Genome</div>
          <div className="space-y-2.5">
            {g.genes.slice(0, 6).map((x) => (
              <ScoreBar key={x.key} label={x.label} value={x.value} color="#a78bfa" />
            ))}
          </div>
        </Card>
        <Card className="p-5 xl:col-span-2">
          <div className="mb-3 font-semibold">Studio floor</div>
          <div className="space-y-3">
            {f.activity.slice(0, 7).map((x) => (
              <div key={x.id} className="flex items-center gap-3 text-sm">
                <AgentAvatar agent={x.agent} size={24} />
                <span className="flex-1">{x.text}</span>
                <span className="text-[11px] text-muted">{timeAgo(x.at)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
