import "dotenv/config";
import { hostname } from "node:os";
import { db } from "../lib/db";
import { errorMessage } from "../lib/errors";
import { log } from "../lib/log";
import { sleep } from "../lib/util";
import { seedAgents } from "./agents";
import { refreshChannels } from "./channels";
import { ensureSchedules, HANDLERS } from "./jobs";
import { complete, fail, fireSchedules, heartbeat, lease } from "./queue";

/**
 * WEBSTER ENGINE worker. Run any number of these (`npm run worker`).
 * Leases due jobs up to the configured concurrency, heartbeats long jobs,
 * turns schedules into jobs, and shuts down gracefully on SIGINT/SIGTERM.
 */
const OWNER = `${hostname()}:${process.pid}`;
let stopping = false;
const active = new Set<Promise<void>>();

async function execute(job: Awaited<ReturnType<typeof lease>>[number]) {
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

/** Process due jobs until the queue is idle. Used by tests and `--once`. */
export async function drain(maxRounds = 200) {
  for (let i = 0; i < maxRounds; i++) {
    const jobs = await lease(OWNER, 4);
    if (!jobs.length) return i;
    await Promise.all(jobs.map(execute));
  }
  return maxRounds;
}

async function main() {
  await seedAgents();
  await ensureSchedules();
  await refreshChannels();
  await db.$executeRaw`UPDATE "ProviderState" SET "inFlight" = 0`;
  log("info", "worker started", { owner: OWNER });

  let lastSchedule = 0;
  while (!stopping) {
    try {
      if (Date.now() - lastSchedule > 10_000) {
        await fireSchedules();
        lastSchedule = Date.now();
      }
      const settings = await db.studioSettings.findUnique({ where: { id: "studio" } });
      const capacity = (settings?.maxConcurrentJobs ?? 3) - active.size;
      const jobs = await lease(OWNER, capacity);
      for (const job of jobs) {
        const p = execute(job).finally(() => active.delete(p));
        active.add(p);
      }
      await sleep(jobs.length ? 200 : 1000);
    } catch (err) {
      log("error", "worker loop error", { error: errorMessage(err) });
      await sleep(3000);
    }
  }
  await Promise.allSettled(active);
  await db.$disconnect();
  log("info", "worker stopped", { owner: OWNER });
}

for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => (stopping = true));

if (process.argv[1]?.endsWith("worker.ts")) {
  if (process.argv.includes("--once")) drain().then(() => db.$disconnect());
  else main();
}
