import { db, Prisma } from "../lib/db";
import type { Job } from "../generated/prisma/client";

/**
 * Durable Postgres job queue.
 * - enqueue() is idempotent when an idempotencyKey is given.
 * - lease() claims due jobs with FOR UPDATE SKIP LOCKED, so any number of
 *   workers can run safely; leases expire and are reclaimed if a worker dies.
 * - fail() retries with exponential backoff + jitter, then dead-letters.
 */

export interface EnqueueOptions {
  runAt?: Date;
  priority?: number;
  maxAttempts?: number;
  idempotencyKey?: string;
}

export async function enqueue(kind: string, payload: Prisma.InputJsonValue, opts: EnqueueOptions = {}): Promise<Job> {
  const data = {
    kind,
    payload,
    runAt: opts.runAt ?? new Date(),
    priority: opts.priority ?? 0,
    maxAttempts: opts.maxAttempts ?? 5,
    idempotencyKey: opts.idempotencyKey,
  };
  if (!opts.idempotencyKey) return db.job.create({ data });
  // Idempotent: an existing job with the same key is returned untouched.
  return db.job.upsert({ where: { idempotencyKey: opts.idempotencyKey }, create: data, update: {} });
}

export async function lease(owner: string, limit: number, leaseMs = 120_000): Promise<Job[]> {
  if (limit <= 0) return [];
  const until = new Date(Date.now() + leaseMs);
  return db.$queryRaw<Job[]>`
    UPDATE "Job" SET status = 'LEASED', "leaseOwner" = ${owner}, "leaseExpiresAt" = ${until},
           attempts = attempts + 1, "updatedAt" = now()
    WHERE id IN (
      SELECT id FROM "Job"
      WHERE (status = 'QUEUED' AND "runAt" <= now())
         OR (status = 'LEASED' AND "leaseExpiresAt" < now())
      ORDER BY priority DESC, "runAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *`;
}

export async function heartbeat(jobId: string, owner: string, leaseMs = 120_000) {
  await db.job.updateMany({
    where: { id: jobId, leaseOwner: owner, status: "LEASED" },
    data: { leaseExpiresAt: new Date(Date.now() + leaseMs) },
  });
}

export async function complete(jobId: string) {
  await db.job.update({ where: { id: jobId }, data: { status: "DONE", leaseOwner: null, leaseExpiresAt: null } });
}

export function backoffMs(attempt: number, baseMs = 2_000, capMs = 10 * 60_000): number {
  const exp = Math.min(capMs, baseMs * 2 ** Math.max(0, attempt - 1));
  return Math.round(exp / 2 + Math.random() * (exp / 2)); // "equal jitter"
}

/** Retry later, or dead-letter once attempts are exhausted. */
export async function fail(job: Pick<Job, "id" | "attempts" | "maxAttempts">, error: string, opts: { retry?: boolean } = {}) {
  const retry = opts.retry !== false && job.attempts < job.maxAttempts;
  await db.job.update({
    where: { id: job.id },
    data: {
      status: retry ? "QUEUED" : "DEAD",
      runAt: retry ? new Date(Date.now() + backoffMs(job.attempts)) : undefined,
      lastError: error.slice(0, 2000),
      leaseOwner: null,
      leaseExpiresAt: null,
    },
  });
  return retry;
}

/** Turn due schedules into jobs. Each slot gets a unique idempotency key. */
export async function fireSchedules(now = new Date()) {
  const due = await db.schedule.findMany({ where: { enabled: true, nextRunAt: { lte: now } } });
  for (const s of due) {
    const slot = Math.floor(s.nextRunAt.getTime() / 1000);
    await enqueue(s.jobKind, s.payload as Prisma.InputJsonValue, { idempotencyKey: `schedule:${s.key}:${slot}` });
    await db.schedule.update({
      where: { key: s.key },
      data: { lastRunAt: now, nextRunAt: new Date(Math.max(now.getTime(), s.nextRunAt.getTime()) + s.intervalSec * 1000) },
    });
  }
  return due.length;
}
