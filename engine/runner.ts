import { hostname } from "node:os";
import { db } from "../lib/db";
import { errorMessage } from "../lib/errors";
import { log } from "../lib/log";
import { HANDLERS } from "./jobs";
import { complete, fail, fireSchedules, heartbeat, lease } from "./queue";

export const OWNER = `${hostname()}:${process.pid}`;

/**
 * Engine placement. "worker" (default) expects `npm run worker` processes.
 * "inline" runs jobs inside the web app's own requests (POST /api/engine/tick),
 * so a serverless host like Vercel needs no separate worker. It is the
 * default on Vercel; set WEBSTER_ENGINE to override.
 */
export const engineInline = () => process.env.WEBSTER_ENGINE === "inline" || (!!process.env.VERCEL && process.env.WEBSTER_ENGINE !== "worker");

export async function execute(job: Awaited<ReturnType<typeof lease>>[number]) {
  const handler = HANDLERS[job.kind];
  const beat = setInterval(() => heartbeat(job.id, OWNER).catch(() => {}), 30_000);
  const started = Date.now();
  try {
    if (!handler) throw new Error(`No handler for job kind ${job.kind}`);
    await handler(job.payload as Record<string, unknown>, job);
    await complete(job.id);
    log("info", "job done", { job: job.id, kind: job.kind, ms: Date.now() - started });
  } catch (err) {
    const retried = await fail(job, errorMessage(err), { retry: !!handler });
    log(retried ? "warn" : "error", retried ? "job failed, will retry" : "job dead-lettered", { job: job.id, kind: job.kind, error: errorMessage(err) });
  } finally {
    clearInterval(beat);
  }
}

/**
 * One inline engine tick: fire due schedules, then process due jobs until the
 * queue is idle or the time budget is spent. Jobs are leased like a worker's,
 * so a tick that is cut off mid-job is reclaimed when its lease expires.
 */
export async function tick(budgetMs: number) {
  const until = Date.now() + budgetMs;
  // A request killed mid-generation can't release its provider slot; reclaim
  // slots once nothing holds a live lease.
  await db.$executeRaw`UPDATE "ProviderState" SET "inFlight" = 0
    WHERE "inFlight" > 0 AND NOT EXISTS (SELECT 1 FROM "Job" WHERE status = 'LEASED' AND "leaseExpiresAt" > now())`;
  await fireSchedules();
  let done = 0;
  while (Date.now() < until) {
    const settings = await db.studioSettings.findUnique({ where: { id: "studio" } });
    const live = await db.job.count({ where: { status: "LEASED", leaseExpiresAt: { gt: new Date() } } });
    const jobs = await lease(OWNER, (settings?.maxConcurrentJobs ?? 3) - live);
    if (!jobs.length) break;
    await Promise.all(jobs.map(execute));
    done += jobs.length;
  }
  const pending = await db.job.count({ where: { status: "QUEUED", runAt: { lte: new Date() } } });
  return { done, pending };
}
