import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../lib/db";
import { BudgetExceededError, CircuitOpenError, MissingCredentialError } from "../lib/errors";
import { enqueue, fail, lease } from "../engine/queue";
import { meter } from "../engine/metering";
import { registerWorkflow, resumeRun, startRun } from "../engine/workflow";
import { decideApproval } from "../engine/approvals";
import { drain } from "../engine/worker";
import { statObject } from "../engine/storage";
import { ingestAll } from "../engine/analytics/ingest";
import { reviewTitle } from "../engine/learning";
import "../engine/jobs";
import { resetDb } from "./helpers";

beforeEach(() => resetDb());

describe("durable queue", () => {
  it("is idempotent per key", async () => {
    const a = await enqueue("noop", {}, { idempotencyKey: "k1" });
    const b = await enqueue("noop", {}, { idempotencyKey: "k1" });
    expect(a.id).toBe(b.id);
    expect(await db.job.count()).toBe(1);
  });

  it("never leases the same job twice concurrently", async () => {
    for (let i = 0; i < 6; i++) await enqueue("noop", { i });
    const [x, y] = await Promise.all([lease("w1", 4), lease("w2", 4)]);
    const ids = [...x, ...y].map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(6);
  });

  it("retries with backoff, then dead-letters", async () => {
    await enqueue("noop", {}, { maxAttempts: 2 });
    let [job] = await lease("w", 1);
    expect(await fail(job, "boom")).toBe(true);
    const queued = await db.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(queued.status).toBe("QUEUED");
    expect(queued.runAt.getTime()).toBeGreaterThan(Date.now());
    await db.job.update({ where: { id: job.id }, data: { runAt: new Date() } });
    [job] = await lease("w", 1);
    expect(await fail(job, "boom again")).toBe(false);
    expect((await db.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("DEAD");
  });
});

describe("cost controls", () => {
  it("refuses a call that would exceed the daily cap, before making it", async () => {
    await db.studioSettings.update({ where: { id: "studio" }, data: { dailyBudgetUsd: 0.05 } });
    let called = false;
    await expect(
      meter({ provider: "anthropic", model: "m", task: "t", estimateUsd: 0.1 }, async () => {
        called = true;
        return { result: 1, costUsd: 0.1 };
      }),
    ).rejects.toBeInstanceOf(BudgetExceededError);
    expect(called).toBe(false);
    expect(await db.spendReservation.count({ where: { status: "HELD" } })).toBe(0);
  });

  it("meters successful calls and settles the reservation", async () => {
    const v = await meter({ provider: "anthropic", model: "m", task: "t", estimateUsd: 0.02 }, async () => ({ result: 42, costUsd: 0.013, inputTokens: 100, outputTokens: 50 }));
    expect(v).toBe(42);
    const rec = await db.generationRecord.findFirstOrThrow();
    expect(Number(rec.costUsd)).toBeCloseTo(0.013, 6);
    expect(await db.spendReservation.count({ where: { status: "SETTLED" } })).toBe(1);
  });

  it("opens the circuit after repeated provider failures", async () => {
    for (let i = 0; i < 3; i++) {
      await expect(meter({ provider: "anthropic", model: "m", task: "t", estimateUsd: 0.001 }, async () => Promise.reject(new Error("503")))).rejects.toThrow("503");
    }
    let called = false;
    await expect(
      meter({ provider: "anthropic", model: "m", task: "t", estimateUsd: 0.001 }, async () => {
        called = true;
        return { result: 1, costUsd: 0 };
      }),
    ).rejects.toBeInstanceOf(CircuitOpenError);
    expect(called).toBe(false);
  });
});

describe("workflow runtime", () => {
  let flaky = 0;
  registerWorkflow({
    type: "test.flow",
    title: () => "test",
    steps: [
      { key: "a", agent: "ops.lead", title: "a", run: async () => ({ ok: 1 }) },
      {
        key: "flaky",
        agent: "ops.lead",
        title: "flaky",
        run: async () => {
          flaky++;
          if (flaky === 1) throw new Error("transient");
          return { attempts: flaky };
        },
      },
      {
        key: "keyed",
        agent: "ops.lead",
        title: "needs a key",
        run: async (ctx) => {
          if (!ctx.state.keyed) {
            ctx.state.keyed = true;
            throw new MissingCredentialError("anthropic", "Add a key.");
          }
          return {};
        },
      },
      {
        key: "gate",
        agent: "chief.studio",
        title: "gate",
        run: async (ctx) => {
          const o = await ctx.approval({ kind: "STRATEGY", title: "Proceed?", summary: "test" });
          return { approved: o.approved };
        },
      },
    ],
  });

  it("checkpoints, retries, blocks on missing credentials, waits for approval and resumes", async () => {
    const run = await startRun("test.flow", {}, { createdBy: "test" });
    await drain();
    // flaky step scheduled a delayed retry; make it due.
    await db.job.updateMany({ where: { status: "QUEUED" }, data: { runAt: new Date() } });
    await drain();
    let r = await db.workflowRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(r.status).toBe("BLOCKED");
    expect(r.blockedReason).toContain("anthropic");
    await resumeRun(run.id, "test");
    await drain();
    r = await db.workflowRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(r.status).toBe("WAITING_APPROVAL");
    const ap = await db.approval.findFirstOrThrow({ where: { runId: run.id } });
    await decideApproval(ap.id, { approved: true }, "user:test");
    await drain();
    r = await db.workflowRun.findUniqueOrThrow({ where: { id: run.id }, include: { steps: true } });
    expect(r.status).toBe("COMPLETED");
    expect(flaky).toBe(2);
    // Step "a" ran exactly once despite retries and resumes elsewhere.
    expect((r as unknown as { steps: { key: string; attempt: number }[] }).steps.find((s) => s.key === "a")?.attempt).toBe(1);
  });
});

describe("vertical slice (DEMO provider, real FFmpeg)", () => {
  it("brief -> concepts -> greenlight -> canon -> script -> storyboard -> animatic -> QA -> approval -> WEBSTER WORLD -> analytics -> experiment", async () => {
    const brief = await db.brief.create({ data: { text: "Develop three original fantasy franchises and prototype the strongest.", createdBy: "test" } });
    const discovery = await startRun("ip.discovery", { briefId: brief.id, brief: brief.text, conceptCount: 3, prototypeCount: 1 }, { createdBy: "test", briefId: brief.id });
    await drain();
    expect(await db.concept.count()).toBe(3);
    const greenlight = await db.approval.findFirstOrThrow({ where: { kind: "NEW_IP" } });
    await expect(decideApproval(greenlight.id, { approved: true, decision: { selected: [] } }, "user:test")).rejects.toThrow();
    const top = await db.concept.findFirstOrThrow({ where: { rank: 1 } });
    await decideApproval(greenlight.id, { approved: true, decision: { selected: [top.id] } }, "user:test");
    await drain();

    const f = await db.franchise.findFirstOrThrow({ include: { versions: true, agents: true } });
    expect(f.canonVersion).toBe(1);
    expect(f.versions[0].hash).toMatch(/^[0-9a-f]{64}$/);
    expect(f.agents.some((a) => a.role === "FRANCHISE_DIRECTOR")).toBe(true);
    expect(await db.canonEntity.count({ where: { franchiseId: f.id, type: "CHARACTER", status: "ESTABLISHED" } })).toBeGreaterThanOrEqual(2);

    // Assisted mode: publication waits for the founder.
    const publish = await db.approval.findFirstOrThrow({ where: { kind: "PUBLISH", status: "PENDING" } });
    expect(await db.worldTitle.count()).toBe(0);
    await decideApproval(publish.id, { approved: true }, "user:test");
    await drain();

    const pilot = await db.workflowRun.findFirstOrThrow({ where: { type: "franchise.pilot" } });
    expect(pilot.status).toBe("COMPLETED");
    expect((await db.workflowRun.findUniqueOrThrow({ where: { id: discovery.id } })).status).toBe("COMPLETED");

    const video = await db.asset.findFirstOrThrow({ where: { kind: "VIDEO", mimeType: "video/mp4" } });
    expect((await statObject(video.storageKey)).size).toBeGreaterThan(10_000);
    expect(video.durationSec!).toBeGreaterThan(20);
    expect(video.status).toBe("APPROVED");
    expect(await db.asset.count({ where: { kind: "STORYBOARD_FRAME" } })).toBeGreaterThan(5);
    const qa = (await db.production.findFirstOrThrow()).qa as { blocking: string[]; technical: { pass: boolean }[] };
    expect(qa.blocking).toHaveLength(0);
    expect(qa.technical.every((t) => t.pass)).toBe(true);

    const title = await db.worldTitle.findFirstOrThrow({ where: { kind: "WATCH" } });
    expect(title.isDemo).toBe(true);
    expect(title.disclosure).toContain("DEMO");
    expect((await db.publication.findFirstOrThrow({ where: { channelKey: "webster-world" } })).status).toBe("PUBLISHED");
    // DEMO output is never sent to external channels.
    expect(await db.publication.count({ where: { channelKey: "youtube", status: "PUBLISHED" } })).toBe(0);
    expect(await db.generationRecord.count({ where: { provider: "demo" } })).toBeGreaterThan(5);

    // No events yet -> learning refuses to conclude anything.
    await reviewTitle(title.id);
    expect(await db.experiment.count()).toBe(0);

    // Real events -> metrics -> experiment proposal (needs approval in Assisted mode).
    const now = new Date();
    const events = Array.from({ length: 12 }, (_, i) => [
      { source: "webster-world", type: "impression", titleId: title.id, franchiseId: f.id, viewerId: `qa-${i}`, occurredAt: now, props: { qa: true } },
      ...(i % 3 === 0 ? [{ source: "webster-world", type: "play", titleId: title.id, franchiseId: f.id, viewerId: `qa-${i}`, occurredAt: now, props: { qa: true } }] : []),
    ]).flat();
    await db.analyticsEvent.createMany({ data: events });
    await ingestAll();
    const snap = await db.metricSnapshot.findFirstOrThrow({ where: { titleId: title.id }, orderBy: { createdAt: "desc" } });
    expect((snap.metrics as { impressions: number; plays: number; qaViewers: number })).toMatchObject({ impressions: 12, plays: 4, qaViewers: 12 });
    await reviewTitle(title.id);
    const exp = await db.experiment.findFirstOrThrow({ include: { variants: true } });
    expect(exp.status).toBe("PROPOSED");
    expect(exp.variants).toHaveLength(2);
    const learning = await db.learning.findFirstOrThrow({ where: { experimentId: null, statement: { contains: "QA" } } });
    expect(learning.confidence).toBe("LOW");
    expect(await db.approval.count({ where: { kind: "EXPERIMENT", status: "PENDING" } })).toBe(1);
  });

  it("blocks with setup instructions when no LLM is configured and DEMO is off", async () => {
    await db.studioSettings.update({ where: { id: "studio" }, data: { allowDemoProvider: false } });
    const brief = await db.brief.create({ data: { text: "anything", createdBy: "test" } });
    const run = await startRun("ip.discovery", { briefId: brief.id, brief: brief.text, conceptCount: 2, prototypeCount: 1 }, { createdBy: "test" });
    await drain();
    const r = await db.workflowRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(r.status).toBe("BLOCKED");
    expect(r.blockedReason).toMatch(/anthropic is not configured/i);
    expect(await db.opportunityBrief.count()).toBe(0);
  });

  it("pre-authorises WEBSTER WORLD publishing in Supervised mode within the daily limit", async () => {
    await db.studioSettings.update({ where: { id: "studio" }, data: { autonomyMode: "SUPERVISED", autoPublishPerDay: 1 } });
    const brief = await db.brief.create({ data: { text: "cozy lighthouse stories", createdBy: "test" } });
    await startRun("ip.discovery", { briefId: brief.id, brief: brief.text, conceptCount: 2, prototypeCount: 1 }, { createdBy: "test" });
    await drain();
    const ap = await db.approval.findFirstOrThrow({ where: { kind: "NEW_IP" } }); // new IP still needs a human
    const c = await db.concept.findFirstOrThrow({ where: { rank: 1 } });
    await decideApproval(ap.id, { approved: true, decision: { selected: [c.id] } }, "user:test");
    await drain();
    const publish = await db.approval.findFirstOrThrow({ where: { kind: "PUBLISH" } });
    expect(publish.decidedBy).toBe("policy");
    expect(await db.worldTitle.count({ where: { kind: "WATCH" } })).toBe(1);
  });
});
