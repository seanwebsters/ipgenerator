import { db } from "@/lib/db";
import { budgetStatus } from "@/engine/metering";
import { usd } from "@/lib/util";
import { Empty, PageHeader, Section, Stat } from "@/components/os/bits";
import { Progress } from "@/components/ui/progress";

export const dynamic = "force-dynamic";

export default async function Commercial() {
  const [budget, byProvider, byTask, franchises, revenue, recent] = await Promise.all([
    budgetStatus(),
    db.generationRecord.groupBy({ by: ["provider"], _sum: { costUsd: true, inputTokens: true, outputTokens: true }, _count: true }),
    db.generationRecord.groupBy({ by: ["task"], _sum: { costUsd: true }, _count: true, orderBy: { _count: { task: "desc" } } }),
    db.franchise.findMany({ include: { runs: { select: { costUsd: true } }, productions: { select: { id: true, status: true } } } }),
    db.revenue.aggregate({ _sum: { amountUsd: true } }),
    db.generationRecord.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
  ]);
  const opportunities = await db.opportunity.findMany({ include: { franchise: true }, orderBy: { createdAt: "desc" }, take: 30 });
  const totalCost = byProvider.reduce((n, p) => n + Number(p._sum.costUsd ?? 0), 0);
  const failures = recent.filter((r) => !r.ok).length;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Commercial" title="Production economics" intro="Every provider call is metered. Budget caps are enforced before a call is made; nothing here is estimated unless labelled." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total production spend" value={usd(totalCost)} />
        <Stat label="Revenue" value={usd(revenue._sum.amountUsd ?? 0)} hint="no revenue sources connected" />
        <Stat label="Provider calls" value={byProvider.reduce((n, p) => n + p._count, 0)} hint={`${failures} failures in last 25`} />
        <Stat label="Held for in-flight calls" value={usd(budget.held)} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Budget caps (hard limits)">
          {[
            { label: "Today", v: budget.day, cap: budget.dailyCap },
            { label: "This month", v: budget.month, cap: budget.monthlyCap },
          ].map((b) => (
            <div key={b.label} className="mb-4">
              <div className="mb-1 flex justify-between text-sm"><span>{b.label}</span><span className="tabular-nums">{usd(b.v)} / {usd(b.cap)}</span></div>
              <Progress value={(b.v / Math.max(b.cap, 0.0001)) * 100} tone={b.v / b.cap > 0.8 ? "#d4574a" : "var(--ember)"} />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Per-run cap {usd(budget.perRunCap)}. A call that would exceed any cap is refused before it is made and the run pauses as blocked.</p>
        </Section>
        <Section title="Spend by provider">
          {byProvider.length ? (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="pb-2 font-medium">Provider</th><th className="font-medium">Calls</th><th className="font-medium">Tokens</th><th className="text-right font-medium">Cost</th></tr></thead>
              <tbody>
                {byProvider.map((p) => (
                  <tr key={p.provider} className="border-t"><td className="py-2">{p.provider}{p.provider === "demo" ? " (DEMO, $0)" : p.provider === "procedural" ? " (local)" : ""}</td><td className="tabular-nums">{p._count}</td><td className="tabular-nums">{((p._sum.inputTokens ?? 0) + (p._sum.outputTokens ?? 0)).toLocaleString()}</td><td className="text-right tabular-nums">{usd(p._sum.costUsd)}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <Empty>No calls yet.</Empty>}
        </Section>
        <Section title="Cost per franchise">
          {franchises.length ? franchises.map((f) => {
            const c = f.runs.reduce((n, r) => n + Number(r.costUsd), 0);
            return <div key={f.id} className="flex justify-between border-b py-2 text-sm last:border-0"><span>{f.title} <span className="text-xs text-muted-foreground">· {f.productions.length} production(s)</span></span><span className="tabular-nums">{usd(c)} <span className="text-xs text-muted-foreground">of {usd(f.budgetUsd)}</span></span></div>;
          }) : <Empty>No franchises yet.</Empty>}
        </Section>
        <Section title="Calls by task">
          <div className="space-y-1.5 text-sm">
            {byTask.map((t) => <div key={t.task} className="flex justify-between"><span className="font-mono text-xs">{t.task}</span><span className="tabular-nums text-muted-foreground">{t._count} · {usd(t._sum.costUsd)}</span></div>)}
          </div>
        </Section>
      </div>
      <Section title="Expansion, merchandise & licensing pipeline">
        {opportunities.length ? (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="pb-2 font-medium">Opportunity</th><th className="font-medium">Franchise</th><th className="font-medium">Kind</th><th className="font-medium">Est. cost</th><th className="font-medium">Basis</th><th className="font-medium">Status</th></tr></thead>
            <tbody>
              {opportunities.map((o) => (
                <tr key={o.id} className="border-t align-top">
                  <td className="py-2 pr-3">{o.title}</td>
                  <td className="pr-3 text-muted-foreground">{o.franchise.title}</td>
                  <td className="pr-3">{o.kind.toLowerCase()}</td>
                  <td className="pr-3 tabular-nums">{o.estCostUsd == null ? "—" : usd(o.estCostUsd)}</td>
                  <td className="max-w-xs pr-3 text-xs text-muted-foreground">{o.estBasis}</td>
                  <td className="text-xs">{o.status.toLowerCase().replace("_", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>No opportunities yet. Franchise Development proposes them after releases.</Empty>
        )}
        <p className="mt-3 text-xs text-muted-foreground">Merchandise and licensing appear as proposals only. Studio never enters licensing agreements or commercial commitments; those need your approval and real partners.</p>
      </Section>
    </div>
  );
}
