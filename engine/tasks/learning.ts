import { z } from "zod";
import { generateStructured } from "../providers/llm";
import { HOUSE_STYLE, type TaskMeta } from "./common";

/**
 * The learning agent turns measured results into hypotheses and experiment
 * designs. Statistics are computed deterministically in analytics/stats.ts;
 * the model only proposes what to test next, and must cite the numbers.
 */
export const ProposalSchema = z.object({
  findings: z.array(z.object({ statement: z.string(), confidence: z.enum(["LOW", "MEDIUM", "HIGH"]), basis: z.string() })),
  hypothesis: z.string(),
  variantTitle: z.string().describe("An alternative title for variant B (the control keeps the current title)"),
  metric: z.enum(["play_rate", "completion_rate"]),
  rationale: z.string(),
  confounders: z.array(z.string()),
});
export type Proposal = z.infer<typeof ProposalSchema>;

export async function proposeExperiment(
  input: { title: string; franchise: string; logline: string; metrics: Record<string, number | null>; sampleSize: number; goals: Record<string, number>; priorLearnings: string; note?: string },
  meta: TaskMeta,
) {
  return generateStructured({
    ...meta,
    task: "learning.propose",
    system: `${HOUSE_STYLE}\nYou are Audience Intelligence. You never invent metrics, never treat correlation as causation, and you say plainly when the sample is too small to conclude anything. Propose exactly one controlled A/B experiment that WEBSTER WORLD can run by randomising viewers.`,
    prompt: `Title: ${input.title} (${input.franchise})\nLogline: ${input.logline}\nMeasured on WEBSTER WORLD (real events): ${JSON.stringify(input.metrics)}\nSample size (unique viewers): ${input.sampleSize}\n${input.note ? `Data caveat: ${input.note}\n` : ""}Goals: ${JSON.stringify(input.goals)}\nPrior learnings:\n${input.priorLearnings}\n\nState findings with honest confidence, then one hypothesis and a variant title to test.`,
    schema: ProposalSchema,
    maxTokens: 2500,
    demo: () => ({
      findings: [
        {
          statement:
            input.sampleSize < 30
              ? `Only ${input.sampleSize} unique viewers so far; no reliable conclusion about ${input.title} is possible yet.`
              : `Play rate is ${fmt(input.metrics.playRate)} against a goal of ${fmt(input.goals.playRate)}.`,
          confidence: "LOW" as const,
          basis: `n=${input.sampleSize} unique viewers on WEBSTER WORLD.`,
        },
      ],
      hypothesis: `A title that names the central promise will raise the share of viewers who start ${input.franchise} after seeing it.`,
      variantTitle: `${input.franchise}: The Promise`,
      metric: "play_rate" as const,
      rationale: "Title is the first thing viewers see on the home row; it is cheap to vary and measurable per viewer.",
      confounders: ["Home-row position changes as new titles are published", "Small, self-selected early audience", "Time of day"],
    }),
  });
}

const fmt = (v: number | null | undefined) => (v == null ? "n/a" : `${(v * 100).toFixed(1)}%`);

/* ───────────── Founder Copilot: intent parsing ───────────── */

export const IntentSchema = z.object({
  action: z.enum(["develop_franchises", "status_report", "pause_autonomy", "unknown"]),
  brief: z.string().describe("The creative brief to hand the IP Lab, in the founder's words"),
  conceptCount: z.number().int().describe("How many concepts to develop (1-8)"),
  prototypeCount: z.number().int().describe("How many of the strongest to prototype (1-3)"),
  reply: z.string().describe("One sentence telling the founder what will happen"),
});
export type Intent = z.infer<typeof IntentSchema>;

const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, a: 1, an: 1 };

export function parseIntentLocally(text: string): Intent {
  const t = text.toLowerCase();
  const num = (re: RegExp, d: number) => {
    const m = t.match(re);
    if (!m) return d;
    const v = Number(m[1]) || WORDS[m[1]] || d;
    return v;
  };
  if (/\b(status|report|how are|what.?s happening)\b/.test(t)) {
    return { action: "status_report", brief: text, conceptCount: 0, prototypeCount: 0, reply: "Here is the current studio status." };
  }
  if (/\b(pause|stop|halt)\b/.test(t)) {
    return { action: "pause_autonomy", brief: text, conceptCount: 0, prototypeCount: 0, reply: "Switching the studio to Assisted mode." };
  }
  const conceptCount = Math.min(8, Math.max(1, num(/\b(\d+|one|two|three|four|five|six|seven|eight)\s+(?:new\s+)?(?:original\s+)?(?:\w+\s+){0,3}(?:franchises?|concepts?|ideas?|worlds?|properties)/, 5)));
  const prototypeCount = Math.min(3, Math.max(1, num(/prototype\s+(?:the\s+)?(\d+|one|two|three|a|an)\b/, 1)));
  return {
    action: "develop_franchises",
    brief: text,
    conceptCount,
    prototypeCount,
    reply: `Commissioning the IP Lab: ${conceptCount} original concept${conceptCount === 1 ? "" : "s"}, then a pilot for the ${prototypeCount === 1 ? "one" : prototypeCount} you approve.`,
  };
}

export async function parseIntent(text: string) {
  return generateStructured({
    task: "copilot.intent",
    system: `${HOUSE_STYLE}\nYou are the Chief Studio Agent's command parser. Map the founder's instruction to an action. Never invent permissions: you only start workflows that still pass approval gates.`,
    prompt: `Founder: "${text}"`,
    schema: IntentSchema,
    maxTokens: 800,
    effort: "low",
    demo: () => parseIntentLocally(text),
  });
}
