import { db } from "../lib/db";
import type { ApprovalKind, AutonomyMode } from "../generated/prisma/client";

/**
 * Approval policy. Decides whether an action needs a human or is
 * pre-authorised under the current autonomy mode. Hard rules first:
 * new IP, rights, strategy and canon changes ALWAYS need the founder, and
 * DEMO output is never published outside WEBSTER WORLD.
 */
export interface PolicyInput {
  kind: ApprovalKind;
  /** Channels involved (publish). */
  channels?: string[];
  risk?: "normal" | "elevated" | "high";
  costUsd?: number;
  isDemo?: boolean;
  ageRating?: string;
}

export interface PolicyDecision {
  requiresHuman: boolean;
  reason: string;
  mode: AutonomyMode;
}

const ALWAYS_HUMAN: ApprovalKind[] = ["NEW_IP", "RIGHTS", "STRATEGY", "CANON_CHANGE"];
const INTERNAL_CHANNELS = new Set(["webster-world"]);

export async function decide(input: PolicyInput): Promise<PolicyDecision> {
  const s = await db.studioSettings.findUniqueOrThrow({ where: { id: "studio" } });
  const mode = s.autonomyMode;
  const human = (reason: string): PolicyDecision => ({ requiresHuman: true, reason, mode });
  const auto = (reason: string): PolicyDecision => ({ requiresHuman: false, reason, mode });

  if (ALWAYS_HUMAN.includes(input.kind)) return human(`${input.kind} always requires founder approval.`);
  if (input.risk && input.risk !== "normal") return human(`Risk is ${input.risk}.`);
  if (mode === "ASSISTED") return human("Assisted mode: every publication, spend and experiment needs approval.");

  if (input.kind === "SPEND") {
    const limit = Number(s.perRunBudgetUsd) * 0.5;
    return (input.costUsd ?? 0) <= limit ? auto(`Under the pre-authorised spend of $${limit.toFixed(2)}.`) : human("Material spend.");
  }

  const external = (input.channels ?? []).filter((c) => !INTERNAL_CHANNELS.has(c));
  if (input.kind === "EXPERIMENT") {
    return external.length ? human("Experiments on external platforms need approval.") : auto("Internal WEBSTER WORLD experiment within policy.");
  }

  if (input.kind === "PUBLISH") {
    if (input.ageRating === "AGE_18") return human("Mature content always needs approval.");
    if (input.isDemo && external.length) return human("DEMO output is never auto-published to external platforms.");
    if (external.length && mode === "SUPERVISED") return human("Supervised mode pre-authorises WEBSTER WORLD only.");
    const since = new Date(Date.now() - 24 * 3600_000);
    const today = await db.approval.count({ where: { kind: "PUBLISH", decidedBy: "policy", decidedAt: { gte: since } } });
    if (today >= s.autoPublishPerDay) return human(`Daily pre-authorised publishing limit (${s.autoPublishPerDay}) reached.`);
    return auto(`Pre-authorised publication ${today + 1}/${s.autoPublishPerDay} today (${mode}).`);
  }
  return human("No rule pre-authorises this action.");
}
