import { db } from "../../lib/db";

export const HOUSE_STYLE = `You work inside WEBSTER, an original entertainment company (film, series, music, games, books).
Standards:
- Everything must be wholly original. Never reuse existing franchises' characters, names, worlds or trademarks. Comparables may name real titles only as market reference.
- Write with specificity and emotional truth, like a world-class studio creative lead. No generic filler.
- Respect the age rating you are given. No graphic violence, sexual content or hateful material in ALL/AGE_7 work.
- Never claim facts you can't support. When you cite market or audience evidence from general knowledge, say so; never invent statistics.
- Stay consistent with any canon you are given; use canon names exactly.`;

export interface TaskMeta {
  runId?: string | null;
  stepKey?: string | null;
  agentKey?: string | null;
}

/** Recent studio and franchise learnings, retrieved into planning prompts. */
export async function learningsFor(franchiseId?: string | null, limit = 6): Promise<string> {
  const rows = await db.learning.findMany({
    where: { status: "ACTIVE", OR: [{ scope: "studio" }, ...(franchiseId ? [{ franchiseId }] : [])] },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  if (!rows.length) return "No prior learnings recorded yet.";
  return rows.map((l) => `- (${l.confidence} confidence) ${l.statement} Decision: ${l.decision}`).join("\n");
}
