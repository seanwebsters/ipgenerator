import Link from "next/link";
import { db } from "@/lib/db";
import { media } from "@/lib/world";
import { usd } from "@/lib/util";
import { decide } from "../../actions";
import { CHANNELS } from "@/engine/channels";
import { ago, DemoTag, Empty, PageHeader, Section } from "@/components/os/bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = { NEW_IP: "New IP", PUBLISH: "Publication", SPEND: "Spend", RIGHTS: "Rights", STRATEGY: "Strategy", EXPERIMENT: "Experiment", CANON_CHANGE: "Canon change" };

export default async function Approvals({ searchParams }: { searchParams: Promise<{ id?: string; error?: string }> }) {
  const sp = await searchParams;
  const pending = await db.approval.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "desc" } });
  const decided = await db.approval.findMany({ where: { status: { not: "PENDING" } }, orderBy: { decidedAt: "desc" }, take: 12 });
  const selected = sp.id ? await db.approval.findUnique({ where: { id: sp.id } }) : pending[0] ?? null;

  return (
    <div>
      <PageHeader eyebrow="Approval inbox" title="Your decisions" intro="New IP, rights, strategy and canon changes always come to you. Publishing, spend and experiments come here unless your autonomy mode pre-authorises them." />
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-6">
          <Section title={`Pending (${pending.length})`}>
            {pending.length ? (
              <div className="space-y-2">
                {pending.map((a) => (
                  <Link key={a.id} href={`/os/approvals?id=${a.id}`} className={cn("block rounded-lg border p-3 hover:border-white/20", selected?.id === a.id && "border-primary/50 bg-primary/5")}>
                    <div className="flex items-center gap-2">
                      <Badge variant={a.kind === "NEW_IP" ? "brass" : "default"}>{KIND_LABEL[a.kind]}</Badge>
                      {a.risk !== "normal" && <Badge variant="warning">{a.risk} risk</Badge>}
                      <span className="ml-auto text-[11px] text-muted-foreground">{ago(a.createdAt)}</span>
                    </div>
                    <div className="mt-1.5 text-sm">{a.title}</div>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty>Inbox zero.</Empty>
            )}
          </Section>
          <Section title="Recently decided">
            <div className="space-y-2 text-sm">
              {decided.map((a) => (
                <Link key={a.id} href={`/os/approvals?id=${a.id}`} className="flex items-center gap-2">
                  <Badge variant={a.status === "APPROVED" ? "success" : "outline"}>{a.status.toLowerCase()}</Badge>
                  <span className="flex-1 truncate">{a.title}</span>
                  <span className="text-[11px] text-muted-foreground">{a.decidedBy === "policy" ? "policy" : "you"}</span>
                </Link>
              ))}
              {!decided.length && <Empty>No decisions yet.</Empty>}
            </div>
          </Section>
        </div>
        <div>{selected ? <Detail id={selected.id} error={sp.error} /> : <Empty>Select an item.</Empty>}</div>
      </div>
    </div>
  );
}

async function Detail({ id, error }: { id: string; error?: string }) {
  const a = await db.approval.findUniqueOrThrow({ where: { id } });
  const p = a.payload as Record<string, unknown>;
  const open = a.status === "PENDING";
  return (
    <form action={decide} className="space-y-6">
      <input type="hidden" name="id" value={a.id} />
      <div className="rounded-xl border bg-card p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="brass">{KIND_LABEL[a.kind]}</Badge>
          <span className="text-xs text-muted-foreground">requested by {a.requestedBy.replace("agent:", "")} · {ago(a.createdAt)}</span>
          {a.costEstimateUsd != null && <Badge variant="outline">cost so far {usd(a.costEstimateUsd)}</Badge>}
        </div>
        <h2 className="font-display mt-3 text-3xl">{a.title}</h2>
        <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{a.summary}</p>
        {!open && (
          <p className="mt-3 text-sm">
            <Badge variant={a.status === "APPROVED" ? "success" : "outline"}>{a.status.toLowerCase()}</Badge> by {a.decidedBy} {a.decidedAt && ago(a.decidedAt)}{a.note ? ` — “${a.note}”` : ""}
          </p>
        )}
      </div>

      {a.kind === "NEW_IP" && <ConceptPicker options={a.options as { id: string }[]} max={Number(p.maxSelections ?? 1)} open={open} decision={a.decision as { selected?: string[] } | null} />}
      {a.kind === "PUBLISH" && <PublishPreview p={p} />}
      {a.kind === "EXPERIMENT" && <ExperimentPreview experimentId={String(p.experimentId)} />}

      {open && (
        <div className="rounded-xl border bg-[#15110e] p-4">
          {error && <p className="mb-3 text-sm text-red-300">{error}</p>}
          <Textarea name="note" rows={2} placeholder="Note for the studio (optional)" />
          <div className="mt-3 flex gap-2">
            <Button name="verdict" value="approve">Approve</Button>
            <Button name="verdict" value="reject" variant="secondary">Decline</Button>
          </div>
        </div>
      )}
    </form>
  );
}

async function ConceptPicker({ options, max, open, decision }: { options: { id: string }[]; max: number; open: boolean; decision: { selected?: string[] } | null }) {
  const concepts = await db.concept.findMany({ where: { id: { in: options.map((o) => o.id) } }, orderBy: { rank: "asc" } });
  return (
    <div>
      <div className="mb-3 text-sm text-muted-foreground">Choose up to <b className="text-foreground">{max}</b> to greenlight. Each opens a franchise workspace with its own Franchise Director and a pilot production.</div>
      <div className="grid gap-4 lg:grid-cols-2">
        {concepts.map((c) => {
          const s = c.scores as Record<string, number | string>;
          const flags = c.resemblanceFlags as { field: string; text: string; matches: string; kind: string }[];
          const pal = c.palette as string[];
          const chosen = decision?.selected?.includes(c.id);
          return (
            <label key={c.id} className={cn("relative block cursor-pointer overflow-hidden rounded-xl border bg-card transition has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary/40", chosen && "border-primary")}>
              {open && <input type="checkbox" name="selected" value={c.id} className="peer absolute right-4 top-4 size-4 accent-[var(--ember)]" />}
              <div className="h-20" style={{ background: `radial-gradient(90% 140% at 85% 0%, ${pal[1] ?? "#5a3a6e"}, transparent 60%), linear-gradient(120deg, ${pal[0] ?? "#1d1626"}, #0d0b09)` }}>
                <div className="flex h-full items-end gap-1 p-3">
                  {pal.map((x) => <span key={x} className="size-3 rounded-full border border-white/20" style={{ background: x }} />)}
                  <span className="ml-auto font-display text-3xl text-white/80">#{c.rank}</span>
                </div>
              </div>
              <div className="p-5">
                <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider text-brass">{c.genre} · {c.ageRating.replace("AGE_", "")}{c.ageRating === "ALL" ? "" : "+"} <DemoTag show={c.isDemo} /></div>
                <div className="font-display mt-1 text-2xl">{c.title}</div>
                <p className="mt-2 text-sm text-foreground/85">{c.logline}</p>
                <p className="mt-2 text-xs italic text-muted-foreground">{c.hook}</p>
                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
                  {(["originality", "emotionalAppeal", "extensibility", "feasibility"] as const).map((k) => (
                    <div key={k}>
                      <div className="flex justify-between text-[11px] text-muted-foreground"><span>{k.replace("emotionalAppeal", "emotional appeal")}</span><span className="tabular-nums text-foreground">{s[k]}</span></div>
                      <div className="mt-1 h-1 rounded-full bg-white/5"><div className="h-full rounded-full bg-brass" style={{ width: `${Number(s[k])}%` }} /></div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Overall <b className="text-foreground">{s.overall}</b> · lead {String(s.leadCharacter ?? "")}</span>
                  <span className="text-muted-foreground">{c.provider}</span>
                </div>
                {flags.length > 0 && (
                  <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-2.5 text-xs text-amber-100">
                    Resemblance review: {flags.map((f) => `${f.field} “${f.text}” ~ ${f.matches}`).join("; ")}
                  </div>
                )}
                {typeof s.rationale === "string" && <p className="mt-3 text-xs text-muted-foreground">{s.rationale}</p>}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function PublishPreview({ p }: { p: Record<string, unknown> }) {
  const channels = (p.channels as { key: string; status: string }[]) ?? [];
  const qa = p.qa as { technical?: { check: string; pass: boolean; value: string }[]; critique?: { score: number; issues: { severity: string; note: string }[]; strengths: string[] }; rights?: { checked: number; problems: number }; originality?: unknown[] } | undefined;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <div className="space-y-4">
        {typeof p.videoKey === "string" && <video src={media(p.videoKey) ?? undefined} controls className="aspect-video w-full rounded-xl border bg-black" />}
        <Section title="Quality & Safety report">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5 text-sm">
              {qa?.technical?.map((t) => (
                <div key={t.check} className="flex items-center gap-2">
                  <span className={t.pass ? "text-emerald-300" : "text-red-300"}>{t.pass ? "✓" : "✕"}</span>
                  <span className="flex-1">{t.check}</span>
                  <span className="text-xs text-muted-foreground">{t.value}</span>
                </div>
              ))}
              <div className="flex items-center gap-2"><span className="text-emerald-300">✓</span><span className="flex-1">Rights checked</span><span className="text-xs text-muted-foreground">{qa?.rights?.checked} assets, {qa?.rights?.problems} issues</span></div>
              <div className="flex items-center gap-2"><span className="text-emerald-300">✓</span><span className="flex-1">Originality screen</span><span className="text-xs text-muted-foreground">{qa?.originality?.length ?? 0} flags</span></div>
            </div>
            <div className="text-sm">
              <div className="text-muted-foreground">Craft score <b className="text-foreground">{qa?.critique?.score}</b>/100</div>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {qa?.critique?.issues.map((i, n) => <li key={n}>· [{i.severity}] {i.note}</li>)}
                {qa?.critique?.strengths.map((s, n) => <li key={`s${n}`} className="text-emerald-200/80">+ {s}</li>)}
              </ul>
            </div>
          </div>
        </Section>
      </div>
      <div className="space-y-4">
        {typeof p.posterKey === "string" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media(p.posterKey) ?? ""} alt="" className="w-full rounded-xl border" />
        )}
        <div className="rounded-xl border bg-card p-4 text-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Channels</div>
          <div className="mt-2 space-y-2">
            {channels.map((c) => (
              <div key={c.key}>
                <div className="flex items-center justify-between"><span>{c.key}</span><Badge variant={c.status === "CONNECTED" ? "success" : "outline"}>{c.status.replace("_", " ").toLowerCase()}</Badge></div>
                {c.status !== "CONNECTED" && <div className="mt-0.5 text-[11px] text-muted-foreground">{CHANNELS.find((x) => x.key === c.key)?.notes} Will be skipped, not faked.</div>}
              </div>
            ))}
          </div>
          <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">Production cost so far: <b className="text-foreground">{usd(Number(p.runCostUsd ?? 0))}</b></div>
          <div className="mt-1 text-xs text-muted-foreground">Policy: {String(p.policy ?? "")}</div>
        </div>
      </div>
    </div>
  );
}

async function ExperimentPreview({ experimentId }: { experimentId: string }) {
  const e = await db.experiment.findUnique({ where: { id: experimentId }, include: { variants: true } });
  if (!e) return null;
  const d = e.design as { metric: string; minSamplePerArm: number; mde: number; alpha: number; maxDays: number };
  return (
    <Section title="Experiment design">
      <div className="grid gap-4 md:grid-cols-2">
        {e.variants.map((v) => (
          <div key={v.id} className="rounded-lg border p-4">
            <Badge variant={v.key === "A" ? "outline" : "brass"}>Arm {v.key}</Badge>
            <div className="font-display mt-2 text-2xl">{String((v.payload as { title?: string }).title)}</div>
            <div className="text-xs text-muted-foreground">{v.description}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
        <div>Metric: <b>{d.metric}</b> · α {d.alpha} · detect ≥ {Math.round(d.mde * 100)} pts</div>
        <div>Needs ~<b>{d.minSamplePerArm}</b> viewers per arm · max {d.maxDays} days</div>
        <div className="md:col-span-2 text-muted-foreground">Confounders: {(e.confounders as string[]).join("; ")}</div>
      </div>
    </Section>
  );
}
