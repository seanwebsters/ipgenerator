import { db, Prisma } from "../../lib/db";
import { slugify } from "../../lib/util";
import { ensureFranchiseDirector } from "../agents";
import { researchOpportunities, generateConcepts, scoreConcepts, type Concepts, type Opportunities } from "../tasks/ip";
import { screenOriginality } from "../tasks/originality";
import { registerWorkflow, startRun, type WorkflowDef } from "../workflow";

export interface DiscoveryInput {
  briefId: string;
  brief: string;
  conceptCount: number;
  prototypeCount: number;
}

const weights = { originality: 0.3, emotionalAppeal: 0.3, extensibility: 0.25, feasibility: 0.15 };

export const discovery: WorkflowDef<DiscoveryInput> = {
  type: "ip.discovery",
  title: (i) => `Discovery: ${i.brief.slice(0, 70)}`,
  steps: [
    {
      key: "research",
      agent: "intel.lead",
      title: "Cultural Intelligence: opportunity briefs",
      async run(ctx) {
        const res = await researchOpportunities(ctx.input.brief, { runId: ctx.run.id, stepKey: ctx.stepKey, agentKey: ctx.agentKey });
        for (const o of res.data.opportunities) {
          await db.opportunityBrief.create({
            data: {
              briefId: ctx.input.briefId,
              title: o.title,
              summary: o.summary,
              audience: o.audience,
              genre: o.genre,
              score: o.score,
              evidence: o.evidence.map((e) => ({ ...e, verified: e.sourceKind === "internal-metrics" })),
              provider: res.provider,
              isDemo: res.isDemo,
            },
          });
        }
        ctx.state.isDemo = res.isDemo;
        await ctx.log(`${res.data.opportunities.length} opportunity briefs (${res.provider})`);
        return { opportunities: res.data.opportunities, provider: res.provider, isDemo: res.isDemo };
      },
    },
    {
      key: "concepts",
      agent: "iplab.lead",
      title: "Original IP Lab: generate concepts",
      async run(ctx) {
        const research = ctx.outputs.research as { opportunities: Opportunities["opportunities"] };
        const res = await generateConcepts(
          { brief: ctx.input.brief, count: ctx.input.conceptCount, opportunities: research.opportunities },
          { runId: ctx.run.id, stepKey: ctx.stepKey, agentKey: ctx.agentKey },
        );
        await ctx.log(`${res.data.concepts.length} concepts proposed`);
        return { concepts: res.data.concepts, provider: res.provider, isDemo: res.isDemo };
      },
    },
    {
      key: "score",
      agent: "iplab.scorer",
      title: "Score concepts and screen originality",
      async run(ctx) {
        const { concepts, provider, isDemo } = ctx.outputs.concepts as { concepts: Concepts["concepts"]; provider: string; isDemo: boolean };
        const scored = await scoreConcepts(concepts, { runId: ctx.run.id, stepKey: ctx.stepKey, agentKey: ctx.agentKey });
        const rows = concepts.map((c) => {
          const s = scored.data.scores.find((x) => x.title === c.title) ?? scored.data.scores[concepts.indexOf(c)];
          const overall = s
            ? Math.round(s.originality * weights.originality + s.emotionalAppeal * weights.emotionalAppeal + s.extensibility * weights.extensibility + s.feasibility * weights.feasibility)
            : 0;
          const flags = [
            ...screenOriginality([
              { field: "title", text: c.title, isName: true },
              { field: "leadCharacter", text: c.leadCharacter, isName: true },
              { field: "logline", text: c.logline },
              { field: "hook", text: c.hook },
            ]),
            ...(s?.resemblanceConcerns ?? []).map((note) => ({ field: "model-review", text: note, matches: "model concern", kind: "similar", similarity: 0 })),
          ];
          return { c, s, overall, flags };
        });
        rows.sort((a, b) => b.overall - a.overall);
        const ids: string[] = [];
        for (const [i, r] of rows.entries()) {
          const created = await db.concept.create({
            data: {
              briefId: ctx.input.briefId,
              title: r.c.title,
              logline: r.c.logline,
              genre: r.c.genre,
              audience: r.c.audience,
              tone: r.c.tone,
              hook: r.c.hook,
              ageRating: r.c.ageRating,
              comparables: r.c.comparables,
              formats: r.c.formats,
              palette: r.c.palette,
              scores: { ...(r.s ?? {}), overall: r.overall, leadCharacter: r.c.leadCharacter } as Prisma.InputJsonValue,
              resemblanceFlags: r.flags as unknown as Prisma.InputJsonValue,
              rank: i + 1,
              provider,
              isDemo,
            },
          });
          ids.push(created.id);
        }
        const flagged = rows.filter((r) => r.flags.length).length;
        await ctx.log(`Ranked ${rows.length} concepts; ${flagged} flagged for resemblance review`);
        return { conceptIds: ids, flagged };
      },
    },
    {
      key: "greenlight",
      agent: "chief.studio",
      title: "Founder greenlight (new IP)",
      async run(ctx) {
        const { conceptIds } = ctx.outputs.score as { conceptIds: string[] };
        const concepts = await db.concept.findMany({ where: { id: { in: conceptIds } }, orderBy: { rank: "asc" } });
        const outcome = await ctx.approval({
          kind: "NEW_IP",
          title: `Greenlight up to ${ctx.input.prototypeCount} of ${concepts.length} new franchise concepts`,
          summary: `Brief: "${ctx.input.brief}". Ranked by originality, emotional appeal, extensibility and feasibility. ${concepts.filter((c) => (c.resemblanceFlags as unknown[]).length).length} concept(s) carry resemblance flags.`,
          options: concepts.map((c) => ({ id: c.id, label: c.title, rank: c.rank })),
          payload: { maxSelections: ctx.input.prototypeCount, briefId: ctx.input.briefId },
          risk: concepts.some((c) => (c.resemblanceFlags as unknown[]).length) ? "elevated" : "normal",
        });
        if (!outcome.approved) ctx.cancel(outcome.note ? `Founder declined: ${outcome.note}` : "Founder declined all concepts.");
        const selected = ((outcome.decision?.selected as string[]) ?? []).filter((id) => conceptIds.includes(id)).slice(0, ctx.input.prototypeCount);
        if (!selected.length) ctx.cancel("No concepts selected.");
        await db.concept.updateMany({ where: { id: { in: selected } }, data: { status: "SELECTED" } });
        await db.concept.updateMany({ where: { id: { in: conceptIds.filter((id) => !selected.includes(id)) } }, data: { status: "REJECTED" } });
        return { selected };
      },
    },
    {
      key: "launch",
      agent: "chief.studio",
      title: "Open franchise workspaces and commission pilots",
      async run(ctx) {
        const { selected } = ctx.outputs.greenlight as { selected: string[] };
        const launched: { franchiseId: string; runId: string }[] = [];
        for (const conceptId of selected) {
          const c = await db.concept.findUniqueOrThrow({ where: { id: conceptId } });
          const existing = await db.franchise.findUnique({ where: { conceptId } });
          const f =
            existing ??
            (await db.franchise.create({
              data: {
                slug: `${slugify(c.title)}-${conceptId.slice(-4)}`,
                title: c.title,
                logline: c.logline,
                genre: c.genre,
                audience: c.audience,
                tone: c.tone,
                ageRating: c.ageRating,
                palette: c.palette as Prisma.InputJsonValue,
                scores: c.scores as Prisma.InputJsonValue,
                status: "DEVELOPMENT",
                conceptId,
                isDemo: c.isDemo,
              },
            }));
          await ensureFranchiseDirector(f.id, f.title);
          const child = await db.workflowRun.findFirst({ where: { parentRunId: ctx.run.id, franchiseId: f.id } });
          const run = child ?? (await startRun("franchise.pilot", { franchiseId: f.id, conceptId }, { createdBy: "agent:chief.studio", franchiseId: f.id, parentRunId: ctx.run.id, isDemo: c.isDemo }));
          launched.push({ franchiseId: f.id, runId: run.id });
        }
        await ctx.log(`Launched ${launched.length} pilot production(s)`);
        return { launched };
      },
    },
  ],
};

registerWorkflow(discovery);
