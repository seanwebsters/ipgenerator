"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Inbox, RotateCcw, Sparkles } from "lucide-react";
import { useFranchises } from "@/lib/store";
import { getRepository } from "@/lib/repository";
import { genome } from "@/lib/franchise";
import { AGENTS, STUDIOS } from "@/lib/studios";
import { AgentAvatar, Badge, Card } from "@/components/ui";
import { FranchiseCover } from "@/components/FranchiseCover";
import { StudioIcon } from "@/components/StudioIcon";
import type { Franchise } from "@/lib/types";
import { timeAgo } from "@/lib/util";

const STAGE_LABEL: Record<Franchise["stage"], string> = {
  discovery: "Discovery",
  development: "In development",
  canon: "Canon",
  expansion: "Expanding",
};

export default function StudioHome() {
  const franchises = useFranchises();
  const router = useRouter();
  const [prompt, setPrompt] = useState("");

  if (!franchises) return <div className="p-10 text-muted">Opening the studio...</div>;

  const pending = franchises.flatMap((f) => f.approvals.filter((a) => a.status === "pending").map((a) => ({ a, f })));
  const activity = franchises
    .flatMap((f) => f.activity.map((x) => ({ x, f })))
    .sort((p, q) => q.x.at.localeCompare(p.x.at))
    .slice(0, 8);
  const totalAssets = franchises.reduce((n, f) => n + f.assets.length, 0);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Your portfolio</div>
          <h1 className="font-display mt-2 text-4xl font-bold">Living franchises</h1>
          <p className="mt-2 max-w-xl text-muted">
            {franchises.length} franchise{franchises.length === 1 ? "" : "s"} · {totalAssets} assets across 12 studios · {pending.length} decisions waiting on you
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            router.push(`/studio/new${prompt ? `?prompt=${encodeURIComponent(prompt)}` : ""}`);
          }}
          className="flex w-full max-w-xl items-center gap-2 rounded-2xl border border-white/15 bg-panel p-1.5"
        >
          <Sparkles className="ml-3 h-4 w-4 text-amber-300" />
          <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Launch a new franchise from one prompt..." className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-white/30" />
          <button className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-amber-300 px-4 text-sm font-semibold text-ink">
            Launch <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid content-start items-start gap-5 md:grid-cols-2">
          {franchises.map((f, i) => (
            <motion.div key={f.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <FranchiseCard f={f} />
            </motion.div>
          ))}
          <Link href="/studio/new" className="grid h-full min-h-[320px] place-items-center rounded-2xl border border-dashed border-line text-center text-muted hover:border-white/25 hover:text-white">
            <div>
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/5">
                <Sparkles className="h-5 w-5 text-amber-300" />
              </div>
              <div className="mt-3 font-medium">Launch a franchise</div>
              <div className="text-sm">Discovery runs five concepts from one prompt</div>
            </div>
          </Link>
        </div>

        <aside className="space-y-5">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <Inbox className="h-4 w-4 text-amber-300" /> Approvals
              </div>
              <Badge color="#fbbf24">{pending.length} pending</Badge>
            </div>
            <div className="space-y-2">
              {pending.slice(0, 5).map(({ a, f }) => (
                <Link key={a.id} href={`/studio/f/${f.id}/approvals`} className="flex items-start gap-3 rounded-xl p-2 hover:bg-white/5">
                  <AgentAvatar agent={a.agent} size={28} />
                  <div className="min-w-0">
                    <div className="truncate text-sm">{a.title}</div>
                    <div className="text-[11px] text-muted">
                      {f.name} · {a.kind === "review" ? <span className="text-rose-300">canon review</span> : AGENTS[a.agent].name}
                    </div>
                  </div>
                </Link>
              ))}
              {!pending.length && <div className="text-sm text-muted">Nothing waiting. The studio is quiet.</div>}
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-3 font-semibold">Studio floor</div>
            <div className="space-y-3">
              {activity.map(({ x, f }) => (
                <div key={x.id} className="flex gap-3 text-sm">
                  <AgentAvatar agent={x.agent} size={24} />
                  <div className="min-w-0">
                    <div className="text-white/90">{x.text}</div>
                    <div className="text-[11px] text-muted">
                      {f.name} · {timeAgo(x.at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <button
            onClick={() => {
              if (confirm("Reset the workspace to the Moonwilders demo? Your other franchises will be removed.")) getRepository().reset();
            }}
            className="flex items-center gap-2 text-xs text-muted hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset demo data
          </button>
        </aside>
      </div>
    </main>
  );
}

function FranchiseCard({ f }: { f: Franchise }) {
  const g = genome(f);
  const pending = f.approvals.filter((a) => a.status === "pending").length;
  const review = f.assets.filter((a) => a.status === "needs_review").length;
  const approved = f.assets.filter((a) => a.status === "approved").length;
  const active = new Set(f.assets.map((a) => a.studio));
  return (
    <Link href={`/studio/f/${f.id}`} className="group block overflow-hidden rounded-2xl border border-line bg-panel transition hover:-translate-y-0.5 hover:border-white/20">
      <FranchiseCover franchise={f} className="h-40">
        <div className="absolute left-5 top-4 flex gap-2">
          <Badge className="border-white/20 bg-black/40 text-white">{STAGE_LABEL[f.stage]}</Badge>
          {f.canon.version > 0 && <Badge className="border-white/20 bg-black/40 text-white">Canon v{f.canon.version}</Badge>}
        </div>
      </FranchiseCover>
      <div className="p-5">
        <div className="font-display text-2xl font-bold">{f.name}</div>
        <div className="mt-1 line-clamp-2 text-sm text-muted">{f.tagline}</div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat n={approved} label="approved" />
          <Stat n={pending} label="to approve" tone={pending ? "#fbbf24" : undefined} />
          <Stat n={review} label="to review" tone={review ? "#f87171" : undefined} />
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1">
            {STUDIOS.map((s) => (
              <span key={s.key} title={s.name} className="grid h-6 w-6 place-items-center rounded-md" style={{ background: active.has(s.key) ? `${s.accent}26` : "rgba(255,255,255,0.03)", color: active.has(s.key) ? s.accent : "rgba(255,255,255,0.2)" }}>
                <StudioIcon studio={s.key} className="h-3 w-3" />
              </span>
            ))}
          </div>
          <span className="font-mono text-[10px] text-muted">{g.signature}</span>
        </div>
      </div>
    </Link>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] py-2">
      <div className="text-lg font-semibold tabular-nums" style={tone ? { color: tone } : undefined}>
        {n}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
    </div>
  );
}
