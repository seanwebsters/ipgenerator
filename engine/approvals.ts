import { db, Prisma } from "../lib/db";
import { startExperiment } from "./learning";
import { resumeRun } from "./workflow";

/**
 * Record a founder decision and wake whatever was waiting on it.
 * Workflow approvals resume their run; experiment approvals start the test.
 */
export async function decideApproval(
  approvalId: string,
  input: { approved: boolean; decision?: Record<string, unknown>; note?: string },
  actor: string,
) {
  const ap = await db.approval.findUniqueOrThrow({ where: { id: approvalId } });
  if (ap.status !== "PENDING") throw new Error(`Approval already ${ap.status.toLowerCase()}.`);
  if (ap.kind === "NEW_IP" && input.approved) {
    const selected = (input.decision?.selected as string[] | undefined) ?? [];
    const max = Number((ap.payload as { maxSelections?: number }).maxSelections ?? 1);
    if (!selected.length) throw new Error("Select at least one concept to greenlight.");
    if (selected.length > max) throw new Error(`Select at most ${max} concept(s).`);
  }
  await db.approval.update({
    where: { id: approvalId },
    data: {
      status: input.approved ? "APPROVED" : "REJECTED",
      decision: (input.decision ?? Prisma.DbNull) as Prisma.InputJsonValue,
      note: input.note,
      decidedBy: actor,
      decidedAt: new Date(),
    },
  });
  await db.auditLog.create({ data: { actor, action: input.approved ? "approval.approve" : "approval.reject", targetType: "Approval", targetId: approvalId, data: { kind: ap.kind, decision: input.decision ?? null, note: input.note ?? null } as Prisma.InputJsonValue } });

  if (ap.runId) await resumeRun(ap.runId, actor);
  const experimentId = (ap.payload as { experimentId?: string }).experimentId;
  if (ap.kind === "EXPERIMENT" && experimentId) {
    if (input.approved) await startExperiment(experimentId);
    else await db.experiment.update({ where: { id: experimentId }, data: { status: "ABANDONED" } });
  }
}
