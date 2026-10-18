import Link from "next/link";
import { db } from "@/lib/db";
import { media } from "@/lib/world";
import { usd } from "@/lib/util";
import { cancel, resume } from "../../actions";
import { LiveRefresh } from "@/components/os/live";
import { ago, DemoTag, Empty, PageHeader, Section, StatusBadge } from "@/components/os/bits";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export default async function Floor({ searchParams }: { searchParams: Promise<{ run?: string }> }) {
  const { run: runId } = await searchParams;
  const runs = await db.workflowRun.findMany({ include: { steps: { select: { status: true } }, franchise: true }, orderBy: { createdAt: "desc" }, take: 40 });
  const selected = runId ?? runs[0]?.id;
  const [queued, leased, dead] = await Promise.all([db.job.count({ where: { status: "QUEUED" } }), db.job.count({ where: { status: "LEASED" } }), db.job.count({ where: { status: "DEAD" } })]);

  return (
    <div>
      <LiveRefresh ms={2500} />
      <PageHeader
        eyebrow="Studio floor"
        title="Productions in motion"
        intro="Every run is a durable workflow: each step is checkpointed, retried with backoff, and pauses at approval gates."
        actions={
          <div className="flex gap-2 text-xs">
            <Badge variant="outline">{queued} queued</Badge>
            <Badge variant="default">{leased} executing</Badge>
            {dead > 0 && <Badge variant="danger">{dead} dead-lettered</Badge>}
          </div>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Section title="Runs">
          {runs.length ? (
            <div className="space-y-1.5">
              {runs.map((r) => {
                const done = r.steps.filter((s) => s.status === "COMPLETED" || s.status === "SKIPPED").length;
                return (
                  <Link key={r.id} href={`/os/floor?run=${r.id}`} className={cn("block rounded-lg border p-3 hover:border-white/20", selected === r.id && "border-primary/50 bg-primary/5")}>
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate text-sm">{r.franchise?.title ? `${r.franchise.title}: ` : ""}{r.type === "franchise.pilot" ? "Pilot production" : r.title}</span>
                      <StatusBadge status={r.status} />
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                      <span>{r.type} · {done}/{r.steps.length} steps</span>
                      <span>{usd(r.costUsd)} · {ago(r.createdAt)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <Empty>No runs yet. Start one from the Copilot.</Empty>
          )}
        </Section>
        {selected ? <RunDetail id={selected} /> : <Empty>Select a run.</Empty>}
      </div>
    </div>
  );
}

async function RunDetail({ id }: { id: string }) {
  const run = await db.workflowRun.findUnique({ where: { id }, include: { steps: { orderBy: { order: "asc" } }, events: { orderBy: { createdAt: "desc" }, take: 60 }, franchise: true } });
  if (!run) return <Empty>Run not found.</Empty>;
  const assets = await db.asset.findMany({ where: { runId: id }, orderBy: { createdAt: "asc" } });
  const gens = await db.generationRecord.groupBy({ by: ["stepKey", "provider"], where: { runId: id }, _sum: { costUsd: true, inputTokens: true, outputTokens: true }, _count: true });
  const children = await db.workflowRun.findMany({ where: { parentRunId: id }, include: { franchise: true } });
  const video = [...assets].reverse().find((a) => a.kind === "VIDEO");
  const frames = assets.filter((a) => a.kind === "STORYBOARD_FRAME").slice(-12);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={run.status} />
          <DemoTag show={run.isDemo} />
          <span className="font-mono text-[11px] text-muted-foreground">trace {run.traceId}</span>
          <span className="ml-auto text-sm tabular-nums">{usd(run.costUsd)}</span>
        </div>
        <h2 className="font-display mt-2 text-3xl">{run.franchise ? `${run.franchise.title}: ` : ""}{run.title}</h2>
        {run.blockedReason && <div className="mt-3 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-100">Blocked: {run.blockedReason}</div>}
        {run.error && run.status !== "BLOCKED" && <div className="mt-3 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-100">{run.error}</div>}
        <div className="mt-4 flex gap-2">
          {["BLOCKED", "FAILED"].includes(run.status) && (
            <form action={resume}><input type="hidden" name="runId" value={run.id} /><Button size="sm">Resume from last checkpoint</Button></form>
          )}
          {!["COMPLETED", "FAILED", "CANCELLED"].includes(run.status) && (
            <form action={cancel}><input type="hidden" name="runId" value={run.id} /><Button size="sm" variant="secondary">Cancel run</Button></form>
          )}
          {run.status === "WAITING_APPROVAL" && <Button size="sm" asChild><Link href="/os/approvals">Go to approval</Link></Button>}
          {run.franchise && <Button size="sm" variant="ghost" asChild><Link href={`/os/universe/${run.franchise.slug}`}>Franchise workspace →</Link></Button>}
        </div>
      </div>

      <div className="grid gap-6 2xl:grid-cols-2">
        <Section title="Pipeline">
          <ol className="space-y-1">
            {run.steps.map((s) => {
              const cost = gens.filter((g) => g.stepKey === s.key).reduce((n, g) => n + Number(g._sum.costUsd ?? 0), 0);
              const providers = [...new Set(gens.filter((g) => g.stepKey === s.key).map((g) => g.provider))];
              return (
                <li key={s.id} className={cn("flex items-center gap-3 rounded-lg px-3 py-2", s.status === "RUNNING" && "bg-primary/10")}>
                  <span className={cn("size-2 shrink-0 rounded-full", s.status === "COMPLETED" ? "bg-emerald-400" : s.status === "RUNNING" ? "animate-pulse bg-primary" : s.status === "WAITING" ? "bg-amber-300" : s.status === "BLOCKED" || s.status === "FAILED" ? "bg-red-400" : "bg-white/15")} />
                  <span className="w-28 shrink-0 font-mono text-xs">{s.key}</span>
                  <span className="flex-1 truncate text-xs text-muted-foreground">{s.agentKey}{providers.length ? ` · ${providers.join(", ")}` : ""}{s.attempt > 1 ? ` · attempt ${s.attempt}` : ""}</span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">{cost ? usd(cost) : ""}</span>
                  <StatusBadge status={s.status} />
                </li>
              );
            })}
          </ol>
          {children.length > 0 && (
            <div className="mt-4 border-t pt-3 text-sm">
              <div className="mb-2 text-xs text-muted-foreground">Child productions</div>
              {children.map((c) => (
                <Link key={c.id} href={`/os/floor?run=${c.id}`} className="flex items-center gap-2 py-1 hover:text-primary">
                  <span className="flex-1">{c.franchise?.title}: pilot</span>
                  <StatusBadge status={c.status} />
                </Link>
              ))}
            </div>
          )}
        </Section>
        <Section title="Event log">
          <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1 font-mono text-[11.5px]">
            {run.events.map((e) => (
              <div key={e.id} className={cn("flex gap-2", e.level === "error" && "text-red-300", e.level === "warn" && "text-amber-200")}>
                <span className="shrink-0 text-muted-foreground">{e.createdAt.toISOString().slice(11, 19)}</span>
                {e.stepKey && <span className="shrink-0 text-brass">{e.stepKey}</span>}
                <span>{e.message}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {(video || frames.length > 0) && (
        <Section title={`Deliverables (${assets.length} assets)`}>
          {video && <video src={media(video.storageKey) ?? undefined} controls className="mb-4 aspect-video w-full max-w-3xl rounded-lg border bg-black" />}
          <div className="grid grid-cols-3 gap-2 md:grid-cols-4 xl:grid-cols-6">
            {frames.map((f) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={f.id} src={media(f.storageKey) ?? ""} alt={f.title} title={`${f.title} · ${f.provider}`} className="aspect-video w-full rounded border object-cover" />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
