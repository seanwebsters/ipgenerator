import { db, Prisma } from "../../lib/db";
import { canonDigest } from "../canon";
import { titleMetrics } from "../analytics/ingest";
import { learningsFor } from "../tasks/common";
import { PRODUCIBLE, proposeExpansion } from "../tasks/expansion";
import { registerWorkflow, startRun, type WorkflowDef } from "../workflow";

/**
 * Franchise Development: measured evidence → proposals with cost estimates
 * derived from actual production spend → strategy decision →
 * commission the chosen productions. This is the EXPAND step of the flywheel.
 */
export interface DevelopInput {
  franchiseId: string;
  trigger: string;
}

/** Relative cost of each format versus a measured pilot run. */
const COST_FACTOR: Record<string, number> = { EPISODE: 1, COMIC: 0.05, INTERACTIVE: 0.6 };

export async function measuredRunCost(type = "franchise.pilot") {
  const runs = await db.workflowRun.findMany({ where: { type, status: "COMPLETED" }, select: { costUsd: true } });
  const costs = runs.map((r) => Number(r.costUsd));
  return { n: costs.length, mean: costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : null };
}

export const develop: WorkflowDef<DevelopInput> = {
  type: "franchise.develop",
  title: () => "Franchise development",
  steps: [
    {
      key: "evidence",
      agent: "audience.lead",
      title: "Gather measured evidence",
      async run(ctx) {
        const titles = await db.worldTitle.findMany({ where: { franchiseId: ctx.input.franchiseId, releaseId: { not: null } } });
        const lines: string[] = [];
        for (const t of titles) {
          const m = await titleMetrics(t.id);
          lines.push(
            m.impressions
              ? `- "${t.title}" (${t.kind}): ${m.impressions} viewers${m.qaViewers ? ` (${m.qaViewers} internal QA)` : ""}, play rate ${m.playRate == null ? "n/a" : `${(m.playRate * 100).toFixed(0)}% (95% CI ${(m.playRateLow! * 100).toFixed(0)}–${(m.playRateHigh! * 100).toFixed(0)}%)`}, completion ${m.completionRate == null ? "n/a" : `${(m.completionRate * 100).toFixed(0)}%`}`
              : `- "${t.title}" (${t.kind}): no audience data yet`,
          );
        }
        const cost = await measuredRunCost();
        lines.push(cost.n ? `- Mean measured cost of a completed pilot run: $${cost.mean!.toFixed(4)} over ${cost.n} run(s)` : "- No completed pilot runs to cost against yet");
        return { evidence: lines.join("\n"), released: titles.map((t) => t.title) };
      },
    },
    {
      key: "propose",
      agent: "franchise.lead",
      title: "Franchise Development: expansion proposals",
      async run(ctx) {
        const { evidence, released } = ctx.outputs.evidence as { evidence: string; released: string[] };
        const canon = await canonDigest(ctx.input.franchiseId);
        const res = await proposeExpansion({ canon, evidence, learnings: await learningsFor(ctx.input.franchiseId), released }, { runId: ctx.run.id, stepKey: ctx.stepKey, agentKey: ctx.agentKey });
        const cost = await measuredRunCost();
        const ids: string[] = [];
        for (const [i, o] of res.data.opportunities.entries()) {
          const producible = (PRODUCIBLE as readonly string[]).includes(o.kind);
          const factor = COST_FACTOR[o.kind];
          const est = producible && cost.mean != null ? cost.mean * factor : null;
          const row = await db.opportunity.create({
            data: {
              franchiseId: ctx.input.franchiseId,
              kind: o.kind,
              title: o.title,
              rationale: o.rationale,
              evidence: { direction: o.direction, risks: o.risks, evidence, provider: res.provider, isDemo: res.isDemo } as Prisma.InputJsonValue,
              estCostUsd: est == null ? null : new Prisma.Decimal(est.toFixed(4)),
              estBasis: !producible
                ? "Proposal only: not producible by the studio yet; would need partners and your approval."
                : cost.mean == null
                  ? "No completed runs measured yet; cost unknown."
                  : `Mean of ${cost.n} measured pilot run(s) × ${factor}${cost.mean === 0 ? " (runs so far used $0 DEMO/local providers)" : ""}.`,
              priority: res.data.opportunities.length - i,
              status: producible ? "PROPOSED" : "PROPOSAL_ONLY",
              createdBy: `agent:${ctx.agentKey}`,
              runId: ctx.run.id,
            },
          });
          ids.push(row.id);
        }
        return { opportunityIds: ids };
      },
    },
    {
      key: "decide",
      agent: "chief.studio",
      title: "Strategy decision",
      async run(ctx) {
        const { opportunityIds } = ctx.outputs.propose as { opportunityIds: string[] };
        const opps = await db.opportunity.findMany({ where: { id: { in: opportunityIds } }, orderBy: { priority: "desc" } });
        const producible = opps.filter((o) => o.status === "PROPOSED");
        const f = await db.franchise.findUniqueOrThrow({ where: { id: ctx.input.franchiseId } });
        const outcome = await ctx.approval({
          kind: "STRATEGY",
          title: `Grow ${f.title}: choose what to make next`,
          summary: `${producible.length} producible opportunities and ${opps.length - producible.length} proposal(s) that need partners. Trigger: ${ctx.input.trigger}.`,
          options: producible.map((o) => ({ id: o.id, label: o.title, kind: o.kind })),
          payload: { maxSelections: 3, opportunityIds },
          costEstimateUsd: producible.reduce((n, o) => n + Number(o.estCostUsd ?? 0), 0),
          franchiseId: f.id,
        });
        if (!outcome.approved) {
          await db.opportunity.updateMany({ where: { id: { in: opportunityIds }, status: "PROPOSED" }, data: { status: "DECLINED" } });
          ctx.cancel(outcome.note ? `Declined: ${outcome.note}` : "Declined all opportunities.");
        }
        const selected = ((outcome.decision?.selected as string[]) ?? []).filter((id) => producible.some((o) => o.id === id));
        if (!selected.length) ctx.cancel("Nothing selected.");
        await db.opportunity.updateMany({ where: { id: { in: selected } }, data: { status: "APPROVED" } });
        await db.opportunity.updateMany({ where: { id: { in: producible.map((o) => o.id).filter((id) => !selected.includes(id)) } }, data: { status: "DECLINED" } });
        return { selected };
      },
    },
    {
      key: "commission",
      agent: "chief.studio",
      title: "Commission productions",
      async run(ctx) {
        const { selected } = ctx.outputs.decide as { selected: string[] };
        const f = await db.franchise.findUniqueOrThrow({ where: { id: ctx.input.franchiseId } });
        const started: { opportunityId: string; runId: string; type: string }[] = [];
        for (const id of selected) {
          const o = await db.opportunity.findUniqueOrThrow({ where: { id } });
          if (o.runId && o.runId !== ctx.run.id) continue; // already commissioned (idempotent on retry)
          const direction = String((o.evidence as { direction?: string }).direction ?? o.title);
          let run;
          if (o.kind === "EPISODE") {
            const episode = (await db.production.count({ where: { franchiseId: f.id, format: { in: ["SHORT", "EPISODE"] } } })) + 1;
            run = await startRun("franchise.pilot", { franchiseId: f.id, conceptId: f.conceptId ?? "", episode, direction, opportunityId: id }, { createdBy: "agent:chief.studio", franchiseId: f.id, parentRunId: ctx.run.id, isDemo: f.isDemo });
          } else if (o.kind === "COMIC") {
            const src = await db.production.findFirst({ where: { franchiseId: f.id, format: { in: ["SHORT", "EPISODE"] }, status: "RELEASED" }, orderBy: { createdAt: "desc" } });
            if (!src) {
              await ctx.log(`Skipped "${o.title}": no released animatic to adapt yet`, undefined, "warn");
              continue;
            }
            // The comic is titled after the production it actually adapts.
            run = await startRun("franchise.comic", { franchiseId: f.id, sourceProductionId: src.id, opportunityId: id, title: `${src.title} — The Comic` }, { createdBy: "agent:chief.studio", franchiseId: f.id, parentRunId: ctx.run.id, isDemo: f.isDemo });
          } else {
            run = await startRun("franchise.interactive", { franchiseId: f.id, direction, opportunityId: id }, { createdBy: "agent:chief.studio", franchiseId: f.id, parentRunId: ctx.run.id, isDemo: f.isDemo });
          }
          await db.opportunity.update({ where: { id }, data: { status: "IN_PRODUCTION", runId: run.id } });
          started.push({ opportunityId: id, runId: run.id, type: run.type });
        }
        await ctx.log(`Commissioned ${started.length} production(s)`);
        return { started };
      },
    },
  ],
};

registerWorkflow(develop);
