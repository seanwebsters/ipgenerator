import "./workflows/discovery";
import "./workflows/pilot";
import { db } from "../lib/db";
import type { Job } from "../generated/prisma/client";
import { ingestAll } from "./analytics/ingest";
import { evaluateExperiments, reviewTitle } from "./learning";
import { advance } from "./workflow";

/** Job kind -> handler. Handlers must be idempotent: jobs can run more than once. */
export const HANDLERS: Record<string, (payload: Record<string, unknown>, job: Job) => Promise<unknown>> = {
  "workflow.advance": (p) => advance(String(p.runId)),
  "analytics.ingest": () => ingestAll(),
  "learning.review": (p) => reviewTitle(String(p.titleId)),
  "experiments.evaluate": () => evaluateExperiments(),
  "studio.housekeeping": async () => {
    // Release budget holds orphaned by crashed calls (older than 30 minutes).
    const stale = new Date(Date.now() - 30 * 60_000);
    const released = await db.spendReservation.updateMany({ where: { status: "HELD", createdAt: { lt: stale } }, data: { status: "RELEASED", settledAt: new Date() } });
    return { releasedHolds: released.count };
  },
};

export const SCHEDULES = [
  { key: "analytics-ingest", jobKind: "analytics.ingest", intervalSec: 120 },
  { key: "experiments-evaluate", jobKind: "experiments.evaluate", intervalSec: 300 },
  { key: "housekeeping", jobKind: "studio.housekeeping", intervalSec: 600 },
];

export async function ensureSchedules() {
  for (const s of SCHEDULES) {
    await db.schedule.upsert({ where: { key: s.key }, create: { ...s, payload: {} }, update: { jobKind: s.jobKind, intervalSec: s.intervalSec } });
  }
}
