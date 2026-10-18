"use client";

import { useState } from "react";
import { Calendar, Check, Heart, MessageCircle, Send, WandSparkles, X } from "lucide-react";
import type { Asset } from "@/lib/types";
import { addSocialPosts, briefOf, decideAsset } from "@/lib/franchise";
import { ai } from "@/lib/ai/client";
import { Badge, Button, Card, Empty, SectionTitle, StatusPill } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { cx } from "@/lib/util";
import { StudioHeader } from "./shared";
import type { WorkspaceProps } from "./types";

const PLATFORMS = ["TikTok", "Instagram", "YouTube Shorts", "X"] as const;
const PCOLOR: Record<string, string> = { TikTok: "#f472b6", Instagram: "#fb923c", "YouTube Shorts": "#f87171", X: "#94a3b8" };

export function SocialStudio({ franchise: f, update }: WorkspaceProps) {
  const posts = f.assets.filter((a) => a.studio === "social").sort((a, b) => Number(a.meta?.day ?? 0) - Number(b.meta?.day ?? 0));
  const [filter, setFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>(posts[0]?.id);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const visible = posts.filter((p) => !filter || p.meta?.platform === filter);
  const selected = posts.find((p) => p.id === selectedId) ?? visible[0];

  const plan = async () => {
    setBusy(true);
    try {
      const res = await ai.social(briefOf(f));
      const created = await update((d) => addSocialPosts(d, res.data));
      if (created?.[0]) setSelectedId(created[0].id);
      toast({ title: `Pulse planned ${res.data.posts.length} posts`, body: "Each one is waiting in your approvals queue." });
    } finally {
      setBusy(false);
    }
  };

  const byDay = new Map<number, Asset[]>();
  for (const p of visible) {
    const d = Number(p.meta?.day ?? 1);
    byDay.set(d, [...(byDay.get(d) ?? []), p]);
  }

  return (
    <div>
      <StudioHeader studio="social" subtitle={`${posts.length} posts on the calendar`}>
        <Button onClick={plan} loading={busy}>
          <WandSparkles className="h-4 w-4" /> Plan 30-day calendar
        </Button>
      </StudioHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Scheduled" value={posts.length} />
        <StatCard label="Approved" value={posts.filter((p) => p.status === "approved").length} color="#34d399" />
        <StatCard label="Awaiting you" value={posts.filter((p) => p.status === "pending").length} color="#fbbf24" />
        <StatCard label="Needs review" value={posts.filter((p) => p.status === "needs_review").length} color="#f87171" />
        <StatCard label="Characters featured" value={new Set(posts.flatMap((p) => p.dependsOn)).size} color="#a78bfa" />
      </div>

      {!posts.length ? (
        <Empty title="No calendar yet" body="Pulse turns canon into a month of platform-native shorts and posts." action={<Button onClick={plan} loading={busy}>Plan the first 30 days</Button>} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Calendar className="h-4 w-4 text-muted" />
              <span className="mr-2 text-sm font-medium">Launch calendar</span>
              <button onClick={() => setFilter(null)} className={cx("rounded-full border px-3 py-1 text-xs", !filter ? "border-white/30 bg-white/10" : "border-line text-muted")}>
                All
              </button>
              {PLATFORMS.map((p) => (
                <button key={p} onClick={() => setFilter(p === filter ? null : p)} className={cx("rounded-full border px-3 py-1 text-xs", filter === p ? "text-ink" : "border-line text-muted")} style={filter === p ? { background: PCOLOR[p], borderColor: PCOLOR[p] } : undefined}>
                  {p}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5 text-[10px] uppercase tracking-wider text-muted">
              {["Day 1", "2", "3", "4", "5", "6", "7"].map((d) => (
                <div key={d} className="px-1">{d}</div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1.5">
              {Array.from({ length: 35 }).map((_, i) => {
                const day = i + 1;
                const items = byDay.get(day) ?? [];
                return (
                  <div key={i} className={cx("min-h-[86px] rounded-lg border p-1.5", day > 30 ? "border-transparent" : "border-line bg-white/[0.015]")}>
                    {day <= 30 && <div className="mb-1 text-[10px] text-muted">{day}</div>}
                    {items.map((p) => (
                      <button key={p.id} onClick={() => setSelectedId(p.id)} className={cx("mb-1 block w-full truncate rounded-md px-1.5 py-1 text-left text-[10px]", selected?.id === p.id && "ring-2 ring-white/60")} style={{ background: `${PCOLOR[String(p.meta?.platform)]}30`, color: PCOLOR[String(p.meta?.platform)] }}>
                        {p.status === "needs_review" ? "! " : p.status === "approved" ? "✓ " : ""}
                        {p.title}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </Card>

          {selected && <PostPreview post={selected} f={f} onDecide={(d) => update((x) => decideAsset(x, selected.id, d))} />}
        </div>
      )}

      {posts.length > 0 && (
        <div className="mt-6">
          <SectionTitle eyebrow="By platform" title="Channel mix" />
          <div className="grid gap-3 md:grid-cols-4">
            {PLATFORMS.map((p) => {
              const n = posts.filter((x) => x.meta?.platform === p).length;
              return (
                <Card key={p} className="p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span>{p}</span>
                    <span className="tabular-nums text-muted">{n}</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-white/5">
                    <div className="h-full rounded-full" style={{ width: `${(n / posts.length) * 100}%`, background: PCOLOR[p] }} />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <Card className="p-4">
      <div className="text-2xl font-semibold tabular-nums" style={color ? { color } : undefined}>{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
    </Card>
  );
}

function PostPreview({ post, f, onDecide }: { post: Asset; f: WorkspaceProps["franchise"]; onDecide: (d: "approved" | "rejected") => void }) {
  const platform = String(post.meta?.platform ?? "TikTok");
  const ch = f.characters.find((c) => post.dependsOn.includes(c.id));
  const tags = (post.meta?.hashtags as string[] | undefined) ?? [];
  return (
    <div className="space-y-3">
      <div className="mx-auto w-[300px] overflow-hidden rounded-[2rem] border-4 border-white/10 bg-black">
        <div className="relative h-[440px]" style={{ background: `radial-gradient(90% 60% at 50% 30%, ${ch?.color ?? "#8b5cf6"}88, #07070c 75%)` }}>
          <div className="absolute left-4 right-4 top-4 flex items-center justify-between text-[11px] text-white/80">
            <Badge color={PCOLOR[platform]}>{platform}</Badge>
            <span>Day {String(post.meta?.day)}</span>
          </div>
          <div className="absolute inset-x-0 top-28 grid place-items-center">
            <div className="h-28 w-28 rounded-full" style={{ background: `radial-gradient(circle at 30% 30%, ${ch?.color ?? "#a78bfa"}, transparent 70%)`, boxShadow: `0 0 80px ${ch?.color ?? "#a78bfa"}` }} />
            {ch && <div className="mt-3 text-sm font-semibold">{ch.name}</div>}
          </div>
          <div className="absolute bottom-0 left-0 right-12 p-4">
            <div className="text-[11px] uppercase tracking-wider text-white/60">{String(post.meta?.format)}</div>
            <div className="mt-1 text-base font-bold leading-snug">{post.title}</div>
            <div className="mt-1 text-xs text-white/80">{post.summary}</div>
            <div className="mt-1 text-[11px] text-sky-300">{tags.join(" ")}</div>
          </div>
          <div className="absolute bottom-6 right-3 flex flex-col items-center gap-4 text-white/80">
            <Heart className="h-5 w-5" />
            <MessageCircle className="h-5 w-5" />
            <Send className="h-5 w-5" />
          </div>
        </div>
      </div>
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Post status</div>
          <StatusPill status={post.status} />
        </div>
        {post.reviewReason && post.status === "needs_review" && <div className="mt-2 text-xs text-rose-200">{post.reviewReason}</div>}
        {(post.status === "pending" || post.status === "needs_review") && (
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => onDecide("approved")}>
              <Check className="h-3.5 w-3.5" /> Approve
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onDecide("rejected")}>
              <X className="h-3.5 w-3.5" /> Reject
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
