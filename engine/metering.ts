import { db, Prisma } from "../lib/db";
import { BudgetExceededError, CircuitOpenError, errorMessage } from "../lib/errors";

/**
 * Every provider call goes through meter():
 *   circuit breaker -> concurrency slot -> budget reservation -> call ->
 *   GenerationRecord + run cost -> settle reservation -> release slot.
 */

export interface CallContext {
  provider: string;
  model: string;
  task: string;
  runId?: string | null;
  stepKey?: string | null;
  agentKey?: string | null;
  /** Upper-bound estimate used for the budget hold. 0 for free/local work. */
  estimateUsd: number;
  isDemo?: boolean;
}

export interface CallOutcome<T> {
  result: T;
  costUsd: number;
  inputTokens?: number;
  outputTokens?: number;
  units?: number;
  unitLabel?: string;
  requestId?: string;
}

const PROVIDER_CONCURRENCY: Record<string, number> = { anthropic: 4, openai: 2, elevenlabs: 2, youtube: 1 };
const FAILURE_THRESHOLD = 3;

const startOfUtcDay = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const startOfUtcMonth = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

export async function spendSince(since: Date): Promise<number> {
  const agg = await db.generationRecord.aggregate({ where: { createdAt: { gte: since } }, _sum: { costUsd: true } });
  return Number(agg._sum.costUsd ?? 0);
}

export async function budgetStatus() {
  const s = await db.studioSettings.findUniqueOrThrow({ where: { id: "studio" } });
  const [day, month, held] = await Promise.all([
    spendSince(startOfUtcDay()),
    spendSince(startOfUtcMonth()),
    db.spendReservation.aggregate({ where: { status: "HELD" }, _sum: { estimateUsd: true } }),
  ]);
  return {
    day,
    month,
    held: Number(held._sum.estimateUsd ?? 0),
    dailyCap: Number(s.dailyBudgetUsd),
    monthlyCap: Number(s.monthlyBudgetUsd),
    perRunCap: Number(s.perRunBudgetUsd),
  };
}

/** Hold budget for a call. Serialised with an advisory lock so concurrent workers can't overspend. */
async function reserve(ctx: CallContext): Promise<string | null> {
  if (ctx.estimateUsd <= 0) return null;
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(4242)`;
    const s = await tx.studioSettings.findUniqueOrThrow({ where: { id: "studio" } });
    const sum = async (since: Date) =>
      Number((await tx.generationRecord.aggregate({ where: { createdAt: { gte: since } }, _sum: { costUsd: true } }))._sum.costUsd ?? 0);
    const heldAll = Number((await tx.spendReservation.aggregate({ where: { status: "HELD" }, _sum: { estimateUsd: true } }))._sum.estimateUsd ?? 0);
    const day = (await sum(startOfUtcDay())) + heldAll + ctx.estimateUsd;
    const month = (await sum(startOfUtcMonth())) + heldAll + ctx.estimateUsd;
    if (day > Number(s.dailyBudgetUsd)) throw new BudgetExceededError("daily", Number(s.dailyBudgetUsd), day);
    if (month > Number(s.monthlyBudgetUsd)) throw new BudgetExceededError("monthly", Number(s.monthlyBudgetUsd), month);
    if (ctx.runId) {
      const run = await tx.workflowRun.findUnique({ where: { id: ctx.runId }, select: { costUsd: true } });
      const heldRun = Number((await tx.spendReservation.aggregate({ where: { status: "HELD", runId: ctx.runId }, _sum: { estimateUsd: true } }))._sum.estimateUsd ?? 0);
      const projected = Number(run?.costUsd ?? 0) + heldRun + ctx.estimateUsd;
      if (projected > Number(s.perRunBudgetUsd)) throw new BudgetExceededError("run", Number(s.perRunBudgetUsd), projected);
    }
    const r = await tx.spendReservation.create({ data: { provider: ctx.provider, runId: ctx.runId ?? null, estimateUsd: ctx.estimateUsd } });
    return r.id;
  });
}

async function checkCircuit(provider: string) {
  const st = await db.providerState.upsert({ where: { provider }, create: { provider }, update: {} });
  if (st.circuit === "OPEN" && st.openedUntil && st.openedUntil > new Date()) throw new CircuitOpenError(provider, st.openedUntil);
  if (st.circuit === "OPEN") await db.providerState.update({ where: { provider }, data: { circuit: "HALF_OPEN" } });
}

async function acquireSlot(provider: string): Promise<boolean> {
  const limit = PROVIDER_CONCURRENCY[provider];
  if (!limit) return false;
  const n = await db.$executeRaw`UPDATE "ProviderState" SET "inFlight" = "inFlight" + 1, "updatedAt" = now()
                                 WHERE provider = ${provider} AND "inFlight" < ${limit}`;
  if (n === 0) throw new Error(`${provider} concurrency limit (${limit}) reached; will retry.`);
  return true;
}

async function recordOutcome(provider: string, ok: boolean, error?: string) {
  if (ok) {
    await db.providerState.update({ where: { provider }, data: { circuit: "CLOSED", failures: 0, openedUntil: null, lastSuccessAt: new Date() } });
    return;
  }
  const st = await db.providerState.update({ where: { provider }, data: { failures: { increment: 1 }, lastError: error?.slice(0, 500) } });
  if (st.failures >= FAILURE_THRESHOLD) {
    const minutes = Math.min(15, 2 ** (st.failures - FAILURE_THRESHOLD));
    await db.providerState.update({ where: { provider }, data: { circuit: "OPEN", openedUntil: new Date(Date.now() + minutes * 60_000) } });
  }
}

export async function meter<T>(ctx: CallContext, fn: () => Promise<CallOutcome<T>>): Promise<T> {
  const external = !ctx.isDemo && ctx.estimateUsd > 0;
  if (external) await checkCircuit(ctx.provider);
  const reservation = await reserve(ctx);
  const slot = external ? await acquireSlot(ctx.provider).catch(async (e) => {
    if (reservation) await db.spendReservation.update({ where: { id: reservation }, data: { status: "RELEASED", settledAt: new Date() } });
    throw e;
  }) : false;
  const started = Date.now();
  try {
    const out = await fn();
    await db.$transaction([
      db.generationRecord.create({
        data: {
          runId: ctx.runId ?? null,
          stepKey: ctx.stepKey ?? null,
          agentKey: ctx.agentKey ?? null,
          provider: ctx.provider,
          model: ctx.model,
          task: ctx.task,
          inputTokens: out.inputTokens ?? 0,
          outputTokens: out.outputTokens ?? 0,
          units: out.units ?? 0,
          unitLabel: out.unitLabel,
          costUsd: new Prisma.Decimal(out.costUsd.toFixed(6)),
          latencyMs: Date.now() - started,
          ok: true,
          requestId: out.requestId,
          isDemo: !!ctx.isDemo,
        },
      }),
      ...(ctx.runId ? [db.workflowRun.update({ where: { id: ctx.runId }, data: { costUsd: { increment: out.costUsd } } })] : []),
      ...(reservation
        ? [db.spendReservation.update({ where: { id: reservation }, data: { status: "SETTLED", actualUsd: out.costUsd, settledAt: new Date() } })]
        : []),
    ]);
    if (external) await recordOutcome(ctx.provider, true);
    return out.result;
  } catch (err) {
    await db.generationRecord.create({
      data: {
        runId: ctx.runId ?? null,
        stepKey: ctx.stepKey ?? null,
        agentKey: ctx.agentKey ?? null,
        provider: ctx.provider,
        model: ctx.model,
        task: ctx.task,
        ok: false,
        error: errorMessage(err).slice(0, 1000),
        latencyMs: Date.now() - started,
        isDemo: !!ctx.isDemo,
      },
    });
    if (reservation) await db.spendReservation.update({ where: { id: reservation }, data: { status: "RELEASED", settledAt: new Date() } });
    if (external) await recordOutcome(ctx.provider, false, errorMessage(err));
    throw err;
  } finally {
    if (slot) await db.$executeRaw`UPDATE "ProviderState" SET "inFlight" = GREATEST("inFlight" - 1, 0) WHERE provider = ${ctx.provider}`;
  }
}
