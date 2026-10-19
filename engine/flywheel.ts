import { db } from "../lib/db";
import { log } from "../lib/log";
import { startRun } from "./workflow";

/**
 * Chief Studio flywheel tick. When enabled, it starts a Franchise
 * Development cycle for each live franchise that is idle (no open runs, no
 * pending decisions) and hasn't been developed within the configured
 * interval. Every cycle still ends at a human STRATEGY approval, and every
 * production it commissions still passes QA and publication gates.
 */
export async function flywheelTick() {
  const s = await db.studioSettings.findUniqueOrThrow({ where: { id: "studio" } });
  if (!s.flywheelEnabled) return { skipped: "Flywheel disabled in Settings." };
  const since = new Date(Date.now() - s.flywheelIntervalMin * 60_000);
  const franchises = await db.franchise.findMany({ where: { status: "ACTIVE" } });
  const started: string[] = [];
  for (const f of franchises) {
    const [open, pending, recent] = await Promise.all([
      db.workflowRun.count({ where: { franchiseId: f.id, status: { in: ["PENDING", "RUNNING", "WAITING_APPROVAL", "BLOCKED"] } } }),
      db.approval.count({ where: { franchiseId: f.id, status: "PENDING" } }),
      db.workflowRun.count({ where: { franchiseId: f.id, type: "franchise.develop", createdAt: { gte: since } } }),
    ]);
    if (open || pending || recent) continue;
    const run = await startRun("franchise.develop", { franchiseId: f.id, trigger: "scheduled flywheel cycle" }, { createdBy: "agent:chief.studio", franchiseId: f.id, isDemo: f.isDemo });
    started.push(run.id);
    await db.auditLog.create({ data: { actor: "agent:chief.studio", action: "flywheel.cycle", targetType: "Franchise", targetId: f.id, data: { runId: run.id } } });
  }
  if (started.length) log("info", "flywheel started development cycles", { count: started.length });
  return { started };
}
