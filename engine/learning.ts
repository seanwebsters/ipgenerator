import { db, Prisma } from "../lib/db";
import { experimentArms, titleMetrics } from "./analytics/ingest";
import { conclude, confidenceFor, sampleSizePerArm } from "./analytics/stats";
import { decide } from "./policy";
import { learningsFor } from "./tasks/common";
import { proposeExperiment } from "./tasks/learning";

/** Default goals for a pilot on WEBSTER WORLD. Founder-editable later. */
export const GOALS = { playRate: 0.35, completionRate: 0.5 };
/** Below this many unique viewers the agent records "insufficient data" instead of proposing tests. */
const MIN_VIEWERS = () => Number(process.env.LEARNING_MIN_VIEWERS ?? 20);

/**
 * Learning review for a published title: measure (real events only),
 * record findings with sample-size-capped confidence, and propose ONE
 * controlled experiment. Experiments go through the approval policy.
 */
export async function reviewTitle(titleId: string) {
  const title = await db.worldTitle.findUniqueOrThrow({ where: { id: titleId }, include: { franchise: true } });
  // One open experiment per franchise keeps tests clean (no overlapping arms) and the inbox focused.
  const open = await db.experiment.findFirst({ where: { franchiseId: title.franchiseId, status: { in: ["PROPOSED", "APPROVED", "RUNNING"] } } });
  if (open) return { skipped: "An experiment is already open for this franchise." };

  const m = await titleMetrics(titleId);
  if (m.impressions < MIN_VIEWERS()) {
    const prefix = `Not enough audience data yet for "${title.title}"`;
    const recent = await db.learning.findFirst({ where: { franchiseId: title.franchiseId, statement: { startsWith: prefix }, createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
    if (recent) return { skipped: "Insufficient data (already recorded)" };
    await db.learning.create({
      data: {
        franchiseId: title.franchiseId,
        statement: `${prefix} (${m.impressions} of the ${MIN_VIEWERS()} viewers needed before experimenting). Nothing can be concluded.`,
        evidence: { metrics: m } as unknown as Prisma.InputJsonValue,
        confidence: "LOW",
        decision: "Wait for real viewing data before experimenting.",
        createdBy: "agent:audience.lead",
      },
    });
    return { skipped: "No data" };
  }

  const res = await proposeExperiment(
    {
      title: title.title,
      franchise: title.franchise.title,
      logline: title.synopsis,
      metrics: { playRate: m.playRate, completionRate: m.completionRate, avgWatchSec: m.avgWatchSec },
      sampleSize: m.impressions,
      ...(m.qaViewers ? { note: `${m.qaViewers} of ${m.impressions} viewers are internal automated QA sessions, not audience.` } : {}),
      goals: GOALS,
      priorLearnings: await learningsFor(title.franchiseId),
    },
    { agentKey: "audience.lead" },
  );

  for (const finding of res.data.findings) {
    await db.learning.create({
      data: {
        franchiseId: title.franchiseId,
        // Confidence is capped by sample size regardless of what the model said.
        statement: m.qaViewers ? `${finding.statement} (Includes ${m.qaViewers} internal QA session${m.qaViewers === 1 ? "" : "s"}; not audience evidence.)` : finding.statement,
        evidence: { metrics: m, basis: finding.basis, provider: res.provider, isDemo: res.isDemo, qaViewers: m.qaViewers } as unknown as Prisma.InputJsonValue,
        confidence: lower(finding.confidence, confidenceFor(m.impressions)),
        decision: "Propose a controlled title experiment.",
        followUp: res.data.hypothesis,
        createdBy: "agent:audience.lead",
      },
    });
  }

  const baseline = m.playRate ?? 0.3;
  const minPerArm = sampleSizePerArm(Math.min(0.9, Math.max(0.05, baseline)), 0.1);
  const exp = await db.experiment.create({
    data: {
      franchiseId: title.franchiseId,
      titleId,
      hypothesis: res.data.hypothesis,
      design: { type: "ab", metric: res.data.metric, unit: "viewer", allocation: { A: 0.5, B: 0.5 }, alpha: 0.05, power: 0.8, mde: 0.1, minSamplePerArm: minPerArm, maxDays: 14, baseline } as Prisma.InputJsonValue,
      conditions: { channel: "webster-world", surface: "home + franchise rows", audience: "all WEBSTER WORLD viewers allowed to see this rating" } as Prisma.InputJsonValue,
      confounders: res.data.confounders,
      createdBy: "agent:audience.lead",
      variants: {
        create: [
          { key: "A", description: "Control: current title", payload: { title: title.title } },
          { key: "B", description: "Variant title", payload: { title: res.data.variantTitle } },
        ],
      },
    },
  });

  const policy = await decide({ kind: "EXPERIMENT", channels: ["webster-world"] });
  const approval = await db.approval.create({
    data: {
      kind: "EXPERIMENT",
      title: `Experiment: "${res.data.variantTitle}" vs "${title.title}"`,
      summary: `${res.data.hypothesis}\n\nMetric: ${res.data.metric}. Needs ~${minPerArm} viewers per arm to detect a 10-point lift. ${res.data.rationale}`,
      payload: { experimentId: exp.id, titleId, metric: res.data.metric, minPerArm, confounders: res.data.confounders, isDemo: res.isDemo },
      requestedBy: "agent:audience.lead",
      franchiseId: title.franchiseId,
      ...(policy.requiresHuman ? {} : { status: "APPROVED" as const, decidedBy: "policy", decidedAt: new Date(), note: policy.reason }),
    },
  });
  if (!policy.requiresHuman) await startExperiment(exp.id);
  else await db.notification.create({ data: { kind: "approval", title: approval.title, body: res.data.hypothesis, href: `/os/approvals?id=${approval.id}` } });
  return { experimentId: exp.id, autoStarted: !policy.requiresHuman };
}

const RANK = { LOW: 0, MEDIUM: 1, HIGH: 2 } as const;
const lower = (a: keyof typeof RANK, b: keyof typeof RANK) => (RANK[a] <= RANK[b] ? a : b);

export async function startExperiment(experimentId: string) {
  await db.experiment.update({ where: { id: experimentId }, data: { status: "RUNNING", startedAt: new Date() } });
}

/** Evaluate running experiments; conclude when both arms reach the planned sample or max duration passes. */
export async function evaluateExperiments() {
  const running = await db.experiment.findMany({ where: { status: "RUNNING" } });
  const out = [];
  for (const e of running) {
    if (!e.titleId) continue;
    const d = e.design as { metric: "play_rate" | "completion_rate"; minSamplePerArm: number; maxDays: number; alpha: number };
    const { arms, test } = await experimentArms(e.id, e.titleId, d.metric);
    const expired = e.startedAt && Date.now() - e.startedAt.getTime() > d.maxDays * 86_400_000;
    const conclusion = conclude(test, arms.A.n, arms.B.n, d.minSamplePerArm, d.alpha);
    await db.experimentResult.create({
      data: {
        experimentId: e.id,
        metric: d.metric,
        arms: arms as unknown as Prisma.InputJsonValue,
        effect: test?.diff ?? null,
        ciLow: test?.ciLow ?? null,
        ciHigh: test?.ciHigh ?? null,
        pValue: test?.pValue ?? null,
        conclusion,
      },
    });
    if (conclusion !== "INSUFFICIENT_DATA" || expired) {
      const n = arms.A.n + arms.B.n;
      await db.experiment.update({ where: { id: e.id }, data: { status: "CONCLUDED", endedAt: new Date() } });
      await db.learning.create({
        data: {
          franchiseId: e.franchiseId,
          experimentId: e.id,
          statement:
            conclusion === "INSUFFICIENT_DATA"
              ? `Experiment ended at max duration without enough data (A n=${arms.A.n}, B n=${arms.B.n}). No conclusion.`
              : conclusion === "NO_DETECTABLE_DIFFERENCE"
                ? `No detectable difference in ${d.metric} between titles (p=${test!.pValue.toFixed(3)}, effect ${(test!.diff * 100).toFixed(1)} pts, 95% CI ${(test!.ciLow * 100).toFixed(1)} to ${(test!.ciHigh * 100).toFixed(1)}).`
                : `${conclusion === "VARIANT_BETTER" ? "Variant" : "Control"} title performed better on ${d.metric} (effect ${(test!.diff * 100).toFixed(1)} pts, p=${test!.pValue.toFixed(3)}).`,
          evidence: { arms, test } as unknown as Prisma.InputJsonValue,
          confidence: confidenceFor(n, test?.pValue),
          decision: conclusion === "VARIANT_BETTER" ? "Recommend adopting the variant title (founder applies)." : "Keep the current title.",
          followUp: "Test poster variants next, holding title constant.",
          createdBy: "agent:audience.lead",
        },
      });
    }
    out.push({ id: e.id, conclusion, arms });
  }
  return out;
}

/** Deterministic A/B assignment: stable per viewer and experiment. */
export function assignVariant(viewerId: string, experimentId: string): "A" | "B" {
  let h = 0;
  const s = `${viewerId}:${experimentId}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 2 === 0 ? "A" : "B";
}
