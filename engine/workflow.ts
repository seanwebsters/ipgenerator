import Anthropic from "@anthropic-ai/sdk";
import { db, Prisma } from "../lib/db";
import type { ApprovalKind, WorkflowRun } from "../generated/prisma/client";
import { errorMessage, isBlocking } from "../lib/errors";
import { randomToken } from "../lib/crypto";
import { log } from "../lib/log";
import { backoffMs, enqueue } from "./queue";

/**
 * Durable workflow runtime.
 *
 * A workflow is an ordered list of steps. Each `advance` job executes exactly
 * one step and checkpoints its output in WorkflowStep, then enqueues the next
 * advance. Completed steps are never re-executed, so a crashed worker resumes
 * from the last checkpoint. Steps can:
 *   - return output                          -> COMPLETED
 *   - await ctx.approval(...)                -> WAITING until a human decides
 *   - ctx.goto(step)                         -> bounded revision loops
 *   - ctx.skip(reason) / ctx.cancel(reason)
 *   - throw a blocking error (missing key, budget, policy) -> BLOCKED until resumed
 *   - throw anything else                    -> retried with backoff, then FAILED
 */

export interface ApprovalRequest {
  kind: ApprovalKind;
  title: string;
  summary: string;
  payload?: Prisma.InputJsonValue;
  options?: Prisma.InputJsonValue;
  costEstimateUsd?: number;
  risk?: "normal" | "elevated" | "high";
  franchiseId?: string | null;
}

export interface ApprovalOutcome {
  approved: boolean;
  decision: Record<string, unknown> | null;
  note: string | null;
  decidedBy: string | null;
  /** True when no human was needed because policy pre-authorised it. */
  auto: boolean;
}

export interface StepContext<I = Record<string, unknown>> {
  run: WorkflowRun;
  input: I;
  stepKey: string;
  agentKey: string;
  attempt: number;
  /** Outputs of completed steps, by key. */
  outputs: Record<string, unknown>;
  /** Run-level state; changes are persisted when the step completes. */
  state: Record<string, unknown>;
  log(message: string, data?: Prisma.InputJsonValue, level?: "info" | "warn" | "error"): Promise<void>;
  approval(req: ApprovalRequest, opts?: { autoApprove?: boolean; autoReason?: string }): Promise<ApprovalOutcome>;
  goto(stepKey: string, reason: string): never;
  skip(reason: string): never;
  cancel(reason: string): never;
}

export interface StepDef<I = any> {
  key: string;
  agent: string;
  title: string;
  maxAttempts?: number;
  run(ctx: StepContext<I>): Promise<unknown>;
}

export interface WorkflowDef<I = any> {
  type: string;
  title(input: I): string;
  steps: StepDef<I>[];
  onComplete?(run: WorkflowRun): Promise<void>;
}

class WaitSignal {}
class GotoSignal {
  constructor(public target: string, public reason: string) {}
}
class SkipSignal {
  constructor(public reason: string) {}
}
class CancelSignal {
  constructor(public reason: string) {}
}

const registry = new Map<string, WorkflowDef>();
export function registerWorkflow(def: WorkflowDef) {
  registry.set(def.type, def);
}
export function getWorkflow(type: string) {
  const def = registry.get(type);
  if (!def) throw new Error(`Unknown workflow type ${type}`);
  return def;
}

export async function startRun<I extends Record<string, unknown>>(
  type: string,
  input: I,
  opts: { createdBy: string; franchiseId?: string; briefId?: string; parentRunId?: string; isDemo?: boolean },
) {
  const def = getWorkflow(type);
  const run = await db.workflowRun.create({
    data: {
      type,
      title: def.title(input),
      input: input as Prisma.InputJsonValue,
      traceId: randomToken(12),
      createdBy: opts.createdBy,
      franchiseId: opts.franchiseId,
      briefId: opts.briefId,
      parentRunId: opts.parentRunId,
      isDemo: !!opts.isDemo,
      steps: {
        create: def.steps.map((s, i) => ({ key: s.key, agentKey: s.agent, order: i, maxAttempts: s.maxAttempts ?? 3 })),
      },
    },
  });
  await event(run.id, null, null, `Run started: ${run.title}`, { type, createdBy: opts.createdBy });
  await db.auditLog.create({ data: { actor: opts.createdBy, action: "workflow.start", targetType: "WorkflowRun", targetId: run.id, traceId: run.traceId } });
  await enqueue("workflow.advance", { runId: run.id }, { idempotencyKey: `advance:${run.id}:start` });
  return run;
}

async function event(runId: string, stepKey: string | null, agentKey: string | null, message: string, data?: Prisma.InputJsonValue, level = "info") {
  await db.runEvent.create({ data: { runId, stepKey, agentKey, message, data, level } });
}

const STALE_RUNNING_MS = 15 * 60_000;

/** Execute the next step of a run. Called by the worker for `workflow.advance` jobs. */
export async function advance(runId: string): Promise<void> {
  const run = await db.workflowRun.findUnique({ where: { id: runId }, include: { steps: { orderBy: { order: "asc" } } } });
  if (!run || ["COMPLETED", "FAILED", "CANCELLED", "WAITING_APPROVAL", "BLOCKED"].includes(run.status)) return;
  const def = getWorkflow(run.type);

  const step = run.steps.find((s) => s.status !== "COMPLETED" && s.status !== "SKIPPED");
  if (!step) {
    await db.workflowRun.update({ where: { id: runId }, data: { status: "COMPLETED", finishedAt: new Date(), currentStep: null } });
    await event(runId, null, null, "Run completed");
    const done = await db.workflowRun.findUniqueOrThrow({ where: { id: runId } });
    await def.onComplete?.(done);
    return;
  }
  if (step.status === "WAITING" || step.status === "BLOCKED" || step.status === "FAILED") return;
  if (step.status === "RUNNING" && Date.now() - step.updatedAt.getTime() < STALE_RUNNING_MS) return; // another worker has it

  // Claim the step atomically.
  const claimed = await db.workflowStep.updateMany({
    where: { id: step.id, status: step.status, updatedAt: step.updatedAt },
    data: { status: "RUNNING", attempt: { increment: 1 }, startedAt: step.startedAt ?? new Date(), error: null },
  });
  if (claimed.count === 0) return;
  const attempt = step.attempt + 1;
  await db.workflowRun.update({
    where: { id: runId },
    data: { status: "RUNNING", currentStep: step.key, startedAt: run.startedAt ?? new Date(), blockedReason: null },
  });

  const stepDef = def.steps.find((s) => s.key === step.key);
  if (!stepDef) throw new Error(`Step ${step.key} not defined in ${run.type}`);

  const outputs = Object.fromEntries(run.steps.filter((s) => s.status === "COMPLETED").map((s) => [s.key, s.output]));
  const state = { ...(run.state as Record<string, unknown>) };
  const settings = await db.studioSettings.findUniqueOrThrow({ where: { id: "studio" } });

  const ctx: StepContext = {
    run,
    input: run.input as Record<string, unknown>,
    stepKey: step.key,
    agentKey: step.agentKey,
    attempt,
    outputs,
    state,
    log: (message, data, level = "info") => event(runId, step.key, step.agentKey, message, data, level),
    async approval(req, opts = {}) {
      const existing = await db.approval.findFirst({ where: { runId, stepKey: step.key }, orderBy: { createdAt: "desc" } });
      if (existing && existing.status !== "PENDING") {
        return {
          approved: existing.status === "APPROVED",
          decision: (existing.decision as Record<string, unknown>) ?? null,
          note: existing.note,
          decidedBy: existing.decidedBy,
          auto: existing.decidedBy === "policy",
        };
      }
      if (existing) throw new WaitSignal();
      const auto = !!opts.autoApprove;
      const created = await db.approval.create({
        data: {
          kind: req.kind,
          title: req.title,
          summary: req.summary,
          payload: req.payload ?? {},
          options: req.options ?? [],
          costEstimateUsd: req.costEstimateUsd,
          risk: req.risk ?? "normal",
          requestedBy: `agent:${step.agentKey}`,
          runId,
          stepKey: step.key,
          franchiseId: req.franchiseId ?? run.franchiseId,
          ...(auto
            ? { status: "APPROVED" as const, decidedBy: "policy", decidedAt: new Date(), note: opts.autoReason ?? `Pre-authorised under ${settings.autonomyMode} autonomy.` }
            : {}),
        },
      });
      await db.auditLog.create({
        data: { actor: `agent:${step.agentKey}`, action: auto ? "approval.auto" : "approval.request", targetType: "Approval", targetId: created.id, traceId: run.traceId, data: { kind: req.kind } },
      });
      if (auto) return { approved: true, decision: null, note: created.note, decidedBy: "policy", auto: true };
      await db.notification.create({ data: { kind: "approval", title: req.title, body: req.summary.slice(0, 280), href: `/os/approvals?id=${created.id}` } });
      throw new WaitSignal();
    },
    goto: (target, reason) => {
      throw new GotoSignal(target, reason);
    },
    skip: (reason) => {
      throw new SkipSignal(reason);
    },
    cancel: (reason) => {
      throw new CancelSignal(reason);
    },
  };

  const persistState = () => db.workflowRun.update({ where: { id: runId }, data: { state: state as Prisma.InputJsonValue } });

  try {
    await ctx.log(`${stepDef.title}${attempt > 1 ? ` (attempt ${attempt})` : ""}`);
    const output = await stepDef.run(ctx);
    const stepCost = await db.generationRecord.aggregate({ where: { runId, stepKey: step.key }, _sum: { costUsd: true } });
    await db.$transaction([
      db.workflowStep.update({
        where: { id: step.id },
        data: { status: "COMPLETED", output: (output ?? {}) as Prisma.InputJsonValue, finishedAt: new Date(), costUsd: stepCost._sum.costUsd ?? 0 },
      }),
      persistState(),
    ]);
    await enqueue("workflow.advance", { runId }, { idempotencyKey: `advance:${runId}:${step.key}:${attempt}:done` });
  } catch (sig) {
    if (sig instanceof WaitSignal) {
      await db.$transaction([
        db.workflowStep.update({ where: { id: step.id }, data: { status: "WAITING", attempt: { decrement: 1 } } }),
        db.workflowRun.update({ where: { id: runId }, data: { status: "WAITING_APPROVAL" } }),
        persistState(),
      ]);
      await ctx.log("Waiting for founder approval");
      return;
    }
    if (sig instanceof SkipSignal) {
      await db.$transaction([db.workflowStep.update({ where: { id: step.id }, data: { status: "SKIPPED", output: { skipped: sig.reason }, finishedAt: new Date() } }), persistState()]);
      await ctx.log(`Skipped: ${sig.reason}`);
      await enqueue("workflow.advance", { runId }, { idempotencyKey: `advance:${runId}:${step.key}:${attempt}:skip` });
      return;
    }
    if (sig instanceof GotoSignal) {
      const target = run.steps.find((s) => s.key === sig.target);
      if (!target) throw new Error(`goto: unknown step ${sig.target}`);
      await db.$transaction([
        db.workflowStep.updateMany({
          where: { runId, order: { gte: target.order } },
          data: { status: "PENDING", output: Prisma.DbNull, error: null, finishedAt: null, attempt: 0 },
        }),
        persistState(),
      ]);
      await db.approval.deleteMany({ where: { runId, status: "PENDING", stepKey: { in: run.steps.filter((s) => s.order >= target.order).map((s) => s.key) } } });
      await ctx.log(`Revision: returning to "${sig.target}" — ${sig.reason}`, undefined, "warn");
      await enqueue("workflow.advance", { runId }, { idempotencyKey: `advance:${runId}:${step.key}:${attempt}:goto` });
      return;
    }
    if (sig instanceof CancelSignal) {
      await db.$transaction([
        db.workflowStep.update({ where: { id: step.id }, data: { status: "SKIPPED", output: { cancelled: sig.reason }, finishedAt: new Date() } }),
        db.workflowRun.update({ where: { id: runId }, data: { status: "CANCELLED", finishedAt: new Date(), error: sig.reason } }),
      ]);
      await ctx.log(`Cancelled: ${sig.reason}`, undefined, "warn");
      return;
    }

    const message = errorMessage(sig);
    const authProblem = sig instanceof Anthropic.APIError && (sig.status === 401 || sig.status === 403);
    if (isBlocking(sig) || authProblem) {
      await db.$transaction([
        db.workflowStep.update({ where: { id: step.id }, data: { status: "BLOCKED", error: message } }),
        db.workflowRun.update({ where: { id: runId }, data: { status: "BLOCKED", blockedReason: message } }),
        persistState(),
      ]);
      await ctx.log(`Blocked: ${message}`, undefined, "error");
      await db.notification.create({ data: { kind: "blocked", title: `${run.title} is blocked`, body: message, href: `/os/floor?run=${runId}` } });
      return;
    }

    // Non-retryable client errors from providers fail fast.
    const permanent = sig instanceof Anthropic.APIError && sig.status !== undefined && sig.status >= 400 && sig.status < 500 && ![408, 409, 429].includes(sig.status);
    if (!permanent && attempt < (step.maxAttempts ?? 3)) {
      const delay = backoffMs(attempt);
      await db.workflowStep.update({ where: { id: step.id }, data: { status: "PENDING", error: message } });
      await ctx.log(`Attempt ${attempt} failed: ${message}. Retrying in ${Math.round(delay / 1000)}s.`, undefined, "warn");
      await enqueue("workflow.advance", { runId }, { runAt: new Date(Date.now() + delay), idempotencyKey: `advance:${runId}:${step.key}:${attempt}:retry` });
      return;
    }
    await db.$transaction([
      db.workflowStep.update({ where: { id: step.id }, data: { status: "FAILED", error: message, finishedAt: new Date() } }),
      db.workflowRun.update({ where: { id: runId }, data: { status: "FAILED", error: message, finishedAt: new Date() } }),
    ]);
    await ctx.log(`Failed: ${message}`, undefined, "error");
    await db.notification.create({ data: { kind: "failed", title: `${run.title} failed`, body: message, href: `/os/floor?run=${runId}` } });
    log("error", "step failed", { runId, step: step.key, error: message });
  }
}

/** Resume a run after an approval decision or after a blocker is fixed. */
export async function resumeRun(runId: string, actor: string) {
  const run = await db.workflowRun.findUnique({ where: { id: runId }, include: { steps: true } });
  if (!run || !["WAITING_APPROVAL", "BLOCKED", "FAILED"].includes(run.status)) return false;
  await db.$transaction([
    db.workflowStep.updateMany({ where: { runId, status: { in: ["WAITING", "BLOCKED", "FAILED"] } }, data: { status: "PENDING", attempt: 0 } }),
    db.workflowRun.update({ where: { id: runId }, data: { status: "RUNNING", blockedReason: null, error: null, finishedAt: null } }),
  ]);
  await event(runId, null, null, `Resumed by ${actor}`);
  await enqueue("workflow.advance", { runId }, { idempotencyKey: `advance:${runId}:resume:${Date.now()}` });
  return true;
}

export async function cancelRun(runId: string, actor: string) {
  await db.workflowRun.update({ where: { id: runId }, data: { status: "CANCELLED", finishedAt: new Date(), error: `Cancelled by ${actor}` } });
  await db.approval.updateMany({ where: { runId, status: "PENDING" }, data: { status: "EXPIRED" } });
  await event(runId, null, null, `Cancelled by ${actor}`, undefined, "warn");
}
