import { db } from "@/lib/db";
import { usd } from "@/lib/util";
import { DEPARTMENTS } from "@/engine/agents";
import { PageHeader } from "@/components/os/bits";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function Agents() {
  const [agents, steps, costs] = await Promise.all([
    db.agent.findMany({ include: { franchise: true }, orderBy: { createdAt: "asc" } }),
    db.workflowStep.groupBy({ by: ["agentKey", "status"], _count: true }),
    db.generationRecord.groupBy({ by: ["agentKey"], _sum: { costUsd: true, inputTokens: true, outputTokens: true }, _count: true }),
  ]);
  const statsFor = (key: string) => {
    const s = steps.filter((x) => x.agentKey === key);
    const c = costs.find((x) => x.agentKey === key);
    return {
      done: s.filter((x) => x.status === "COMPLETED").reduce((n, x) => n + x._count, 0),
      failed: s.filter((x) => x.status === "FAILED" || x.status === "BLOCKED").reduce((n, x) => n + x._count, 0),
      calls: c?._count ?? 0,
      cost: Number(c?._sum.costUsd ?? 0),
      tokens: (c?._sum.inputTokens ?? 0) + (c?._sum.outputTokens ?? 0),
    };
  };
  const chief = agents.find((a) => a.role === "CHIEF");
  const directors = agents.filter((a) => a.role === "FRANCHISE_DIRECTOR");

  return (
    <div>
      <PageHeader eyebrow="Agent workforce" title="The studio team" intro="Permanent departments with lead agents and specialists. Every agent works through the same canon, tools and approval rules; none can bypass a gate." />
      {chief && (
        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-brass/30 bg-gradient-to-r from-brass/10 to-transparent p-5">
          <div className="grid size-12 place-items-center rounded-full bg-brass font-mark text-lg font-bold text-background">A</div>
          <div className="flex-1">
            <div className="font-display text-2xl">{chief.name} · {chief.title}</div>
            <div className="text-sm text-muted-foreground">Coordinates departments, portfolio, budgets and founder reporting. Delegates through durable workflows.</div>
          </div>
          <AgentStats s={statsFor(chief.key)} />
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {DEPARTMENTS.filter((d) => d.key !== "CHIEF_STUDIO").map((d) => {
          const members = agents.filter((a) => a.department === d.key && a.role !== "FRANCHISE_DIRECTOR");
          return (
            <div key={d.key} className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2">
                <div className="font-display flex-1 text-2xl">{d.name}</div>
                <Badge variant={d.phase === 1 ? "success" : "outline"}>{d.phase === 1 ? "operating" : "phase 2"}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{d.blurb}</p>
              <div className="mt-4 space-y-3">
                {members.map((a) => (
                  <div key={a.id} className="rounded-lg border bg-black/10 p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{a.name}</span>
                      <span className="text-xs text-muted-foreground">{a.title}</span>
                      <Badge variant="outline" className="ml-auto">{a.role.toLowerCase()}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">{(a.tools as string[]).map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}</div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="font-mono">{a.key}</span>
                      <AgentStats s={statsFor(a.key)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <h2 className="font-display mb-3 mt-10 text-3xl">Franchise Directors</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {directors.map((d) => (
          <div key={d.id} className="rounded-xl border bg-card p-4">
            <div className="font-medium">{d.name}</div>
            <div className="text-xs text-muted-foreground">{d.franchise?.title}</div>
            <div className="mt-2 text-[11px] text-muted-foreground">permissions: {JSON.stringify(d.permissions)}</div>
          </div>
        ))}
        {!directors.length && <div className="text-sm text-muted-foreground">Each greenlit franchise gets a persistent director.</div>}
      </div>
    </div>
  );
}

function AgentStats({ s }: { s: { done: number; failed: number; calls: number; cost: number; tokens: number } }) {
  return (
    <span className="text-[11px] tabular-nums text-muted-foreground">
      {s.done} steps{s.failed ? ` · ${s.failed} blocked/failed` : ""} · {s.calls} calls · {usd(s.cost)}
    </span>
  );
}
