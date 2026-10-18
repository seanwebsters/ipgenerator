import Link from "next/link";
import { db } from "@/lib/db";
import { budgetStatus } from "@/engine/metering";
import { media } from "@/lib/world";
import { usd } from "@/lib/util";
import { CommandBar } from "@/components/os/command-bar";
import { LiveRefresh } from "@/components/os/live";
import { ago, DemoTag, Empty, PageHeader, pct, Section, Stat, StatusBadge } from "@/components/os/bits";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [budget, franchises, titles, runs, approvals, pubs, notifications] = await Promise.all([
    budgetStatus(),
    db.franchise.findMany({ orderBy: { updatedAt: "desc" } }),
    db.worldTitle.findMany({ where: { kind: "WATCH" }, include: { franchise: true }, orderBy: { publishedAt: "desc" } }),
    db.workflowRun.findMany({ where: { status: { in: ["PENDING", "RUNNING", "WAITING_APPROVAL", "BLOCKED"] } }, include: { steps: { orderBy: { order: "asc" } }, franchise: true }, orderBy: { updatedAt: "desc" }, take: 8 }),
    db.approval.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.publication.findMany({ include: { release: { include: { franchise: true } } }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.notification.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
  ]);
  const snapshots = await Promise.all(titles.map((t) => db.metricSnapshot.findFirst({ where: { titleId: t.id }, orderBy: { windowEnd: "desc" } })));
  const hour = new Date().getHours();

  return (
    <div className="space-y-6">
      <LiveRefresh ms={4000} />
      <PageHeader eyebrow={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} title={hour < 12 ? "Good morning." : hour < 18 ? "Good afternoon." : "Good evening."} intro="Set direction. The studio executes within your budgets, guardrails and approvals." />

      <CommandBar />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Franchises" value={franchises.length} hint={`${franchises.filter((f) => f.status === "ACTIVE").length} live`} />
        <Stat label="Released titles" value={titles.length} hint="on WEBSTER WORLD" />
        <Stat label="Active productions" value={runs.filter((r) => r.status === "RUNNING").length} hint={`${runs.length} open runs`} />
        <Stat label="Awaiting you" value={approvals.length} tone={approvals.length ? "var(--ember)" : undefined} hint="decisions" />
        <Stat label="Spend today" value={usd(budget.day)} hint={`cap ${usd(budget.dailyCap)}`} />
        <Stat label="Spend this month" value={usd(budget.month)} hint={`cap ${usd(budget.monthlyCap)}`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Section title="Live productions" action={<Link href="/os/floor" className="text-xs text-primary">Studio Floor →</Link>}>
          {runs.length ? (
            <div className="space-y-3">
              {runs.map((r) => {
                const done = r.steps.filter((s) => s.status === "COMPLETED" || s.status === "SKIPPED").length;
                const cur = r.steps.find((s) => s.key === r.currentStep);
                return (
                  <Link key={r.id} href={`/os/floor?run=${r.id}`} className="block rounded-lg border bg-black/10 p-3 hover:border-white/20">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate text-sm font-medium">{r.franchise ? `${r.franchise.title} · ` : ""}{r.title}</span>
                      <DemoTag show={r.isDemo} />
                      <StatusBadge status={r.status} />
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <Progress value={(done / r.steps.length) * 100} />
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{done}/{r.steps.length}</span>
                    </div>
                    <div className="mt-1.5 text-xs text-muted-foreground">
                      {r.status === "BLOCKED" ? <span className="text-red-300">{r.blockedReason}</span> : cur ? `${cur.key} · ${cur.agentKey}` : "queued"} · {usd(r.costUsd)}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <Empty>No productions running. Give the studio a brief above.</Empty>
          )}
        </Section>

        <Section title="Approval inbox" action={<Link href="/os/approvals" className="text-xs text-primary">Open inbox →</Link>}>
          {approvals.length ? (
            <div className="space-y-2">
              {approvals.map((a) => (
                <Link key={a.id} href={`/os/approvals?id=${a.id}`} className="flex items-center gap-3 rounded-lg border bg-black/10 p-3 hover:border-white/20">
                  <Badge variant={a.kind === "NEW_IP" ? "brass" : a.kind === "PUBLISH" ? "default" : "outline"}>{a.kind.replace("_", " ").toLowerCase()}</Badge>
                  <span className="flex-1 truncate text-sm">{a.title}</span>
                  <span className="text-[11px] text-muted-foreground">{ago(a.createdAt)}</span>
                </Link>
              ))}
            </div>
          ) : (
            <Empty>Nothing needs you right now.</Empty>
          )}
        </Section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Section title="Portfolio performance (WEBSTER WORLD, measured)" action={<Link href="/os/intelligence" className="text-xs text-primary">Intelligence →</Link>}>
          {titles.length ? (
            <div className="space-y-3">
              {titles.map((t, i) => {
                const m = snapshots[i]?.metrics as { impressions?: number; plays?: number; playRate?: number | null; playRateLow?: number | null; playRateHigh?: number | null; completionRate?: number | null } | undefined;
                return (
                  <div key={t.id} className="flex items-center gap-4 rounded-lg border bg-black/10 p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={media(t.posterKey) ?? ""} alt="" className="h-16 w-11 rounded object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{t.title} <DemoTag show={t.isDemo} /></div>
                      <div className="text-xs text-muted-foreground">{t.franchise.title} · released {ago(t.publishedAt)}</div>
                    </div>
                    {m && (m.impressions ?? 0) > 0 ? (
                      <div className="grid grid-cols-3 gap-4 text-right text-xs">
                        <div><div className="text-sm tabular-nums text-foreground">{m.impressions}</div>viewers</div>
                        <div><div className="text-sm tabular-nums text-foreground">{pct(m.playRate)}</div>play rate<div className="text-[10px]">{pct(m.playRateLow)}–{pct(m.playRateHigh)}</div></div>
                        <div><div className="text-sm tabular-nums text-foreground">{pct(m.completionRate)}</div>completion</div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">No audience data yet</span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty>No releases yet. Performance appears here once real viewers watch.</Empty>
          )}
        </Section>
        <div className="space-y-6">
          <Section title="Recent publications">
            {pubs.length ? (
              <div className="space-y-2 text-sm">
                {pubs.map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <Badge variant={p.status === "PUBLISHED" ? "success" : p.status === "FAILED" ? "danger" : "outline"}>{p.channelKey}</Badge>
                    <span className="flex-1 truncate">{p.release.title}</span>
                    <span className="text-[11px] text-muted-foreground">{p.status.replace(/_/g, " ").toLowerCase()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty>Nothing published yet.</Empty>
            )}
          </Section>
          <Section title="Notifications">
            {notifications.length ? (
              <div className="space-y-3 text-sm">
                {notifications.map((n) => (
                  <Link key={n.id} href={n.href ?? "/os"} className="block">
                    <div className="font-medium">{n.title}</div>
                    <div className="line-clamp-2 text-xs text-muted-foreground">{n.body}</div>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty>All quiet.</Empty>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
