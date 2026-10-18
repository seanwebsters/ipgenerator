import { z } from "zod";
import { seeded } from "../../lib/util";
import { generateStructured } from "../providers/llm";
import { HOUSE_STYLE, type TaskMeta } from "./common";
import type { CanonDigest } from "./production";

/* ───────────── Franchise Development: expansion opportunities ───────────── */

/** Kinds the studio can actually produce today. Others are proposals only. */
export const PRODUCIBLE = ["EPISODE", "COMIC", "INTERACTIVE"] as const;

export const OpportunitySchema = z.object({
  opportunities: z.array(
    z.object({
      kind: z.enum(["EPISODE", "COMIC", "INTERACTIVE", "SPINOFF", "MUSIC", "MERCH", "LICENSING"]),
      title: z.string(),
      rationale: z.string().describe("Why now, citing the measured evidence you were given. Never invent numbers."),
      direction: z.string().describe("A one-sentence creative direction for the production team"),
      risks: z.array(z.string()),
    }),
  ),
});
export type ExpansionOpportunities = z.infer<typeof OpportunitySchema>;

export async function proposeExpansion(
  input: { canon: CanonDigest; evidence: string; learnings: string; released: string[] },
  meta: TaskMeta,
) {
  return generateStructured({
    ...meta,
    task: "franchise.opportunities",
    system: `${HOUSE_STYLE}\nYou are Head of Franchise Development. You propose how a franchise should grow next, with honest business reasoning. When evidence is thin, say so and prefer cheap, learnable bets. Licensing and merchandise are proposals only — WEBSTER never makes external commitments without the founder.`,
    prompt: `Franchise: ${input.canon.title} (${input.canon.ageRating})\nSynopsis: ${input.canon.synopsis}\nCharacters: ${input.canon.characters.map((c) => c.name).join(", ")}\nAlready released: ${input.released.join("; ") || "nothing yet"}\n\nMeasured evidence:\n${input.evidence}\n\nLearnings:\n${input.learnings}\n\nPropose 4 expansion opportunities. Include at least one each of EPISODE, COMIC and INTERACTIVE (the formats the studio can produce now).`,
    schema: OpportunitySchema,
    maxTokens: 4000,
    demo: () => demoExpansion(input.canon, input.evidence),
  });
}

export function demoExpansion(c: CanonDigest, evidence: string): ExpansionOpportunities {
  const lead = c.characters[0]?.name ?? "the lead";
  const second = c.characters[1]?.name ?? "the crew";
  const thin = /no audience data|0 viewers|insufficient/i.test(evidence) || !/viewers/.test(evidence);
  const basis = thin ? "Evidence is thin so far; this is a low-cost bet that also generates learning." : "Builds on the measured response to the pilot.";
  return {
    opportunities: [
      { kind: "EPISODE", title: `${c.title}: Episode 2`, rationale: `${basis} A second episode tests whether viewers return for ${lead}.`, direction: `${second} takes the lead while ${lead} keeps the promise from the pilot.`, risks: ["Small audience may not support a series read", "Continuity with the pilot must hold"] },
      { kind: "COMIC", title: `${c.title}: The Illustrated Pilot`, rationale: `${basis} Reuses approved storyboard art, so the marginal cost is near zero.`, direction: "Lay out the pilot as a four-panel-per-page comic with the original dialogue.", risks: ["Animatic framing may read stiffly as comic panels"] },
      { kind: "INTERACTIVE", title: `${c.title}: Choose the Tide`, rationale: `${basis} An interactive story measures which choices audiences make, informing future arcs.`, direction: `Let the reader guide ${lead} through one night with three different endings.`, risks: ["Branch quality varies", "Needs playtesting"] },
      { kind: "MERCH", title: `${lead} keepsake lantern`, rationale: "Proposal only. Merchandise needs licensing partners and founder approval; no commitment is made.", direction: "Concept sketch only.", risks: ["No validated demand yet"] },
    ],
  };
}

/* ───────────── Games & Interactive: branching story ───────────── */

export const StoryGraphSchema = z.object({
  title: z.string(),
  synopsis: z.string(),
  start: z.string(),
  nodes: z.array(
    z.object({
      id: z.string(),
      location: z.string().describe("Canon location name"),
      characters: z.array(z.string()).describe("Canon character names present"),
      text: z.string().describe("2-4 vivid sentences, second person"),
      choices: z.array(z.object({ label: z.string(), to: z.string() })),
      ending: z.enum(["", "triumph", "bittersweet", "lost"]).describe("Non-empty only for endings (which have no choices)"),
    }),
  ),
});
export type StoryGraph = z.infer<typeof StoryGraphSchema>;

export async function writeInteractive(input: { canon: CanonDigest; direction: string; feedback?: string[] }, meta: TaskMeta) {
  return generateStructured({
    ...meta,
    task: "games.interactive",
    system: `${HOUSE_STYLE}\nYou are Head of Games & Interactive. You design branching stories as software: every choice must lead to an existing node, every path must reach an ending, and there must be no orphan nodes.`,
    prompt: `Canon: ${input.canon.title} (${input.canon.ageRating})\nCharacters: ${input.canon.characters.map((c) => c.name).join(", ")}\nLocations: ${input.canon.locations.join("; ")}\nRules:\n${input.canon.rules.join("\n")}\n\nDirection: ${input.direction}\n${input.feedback?.length ? `Fix these validation errors:\n${input.feedback.join("\n")}\n` : ""}\nWrite a branching story of 8-12 nodes with 3 endings (one each: triumph, bittersweet, lost). Non-ending nodes have 2 choices.`,
    schema: StoryGraphSchema,
    maxTokens: 8000,
    demo: () => demoInteractive(input.canon),
  });
}

export function demoInteractive(c: CanonDigest): StoryGraph {
  const r = seeded(`interactive:${c.title}`);
  const [lead, friend, mentor, rival] = [0, 1, 2, 3].map((i) => c.characters[i]?.name ?? c.characters[0]?.name ?? "You");
  const loc = (i: number) => c.locations[i % Math.max(1, c.locations.length)] ?? "the shore";
  return {
    title: `${c.title}: Choose the Tide`,
    synopsis: `One night, three ways it can end. Guide ${lead} — and decide what a promise is worth.`,
    start: "n1",
    nodes: [
      { id: "n1", location: loc(0), characters: [lead, friend], text: `The lamp is cold. Outside, the tide says your name again — ${lead}, ${lead} — patient as a heartbeat. ${friend} holds out a coat without a word.`, choices: [{ label: "Go down to the water", to: "n2" }, { label: "Wake the old keeper first", to: "n3" }], ending: "" },
      { id: "n2", location: loc(1), characters: [lead, friend], text: `The sand is wet and warm. Every word you say comes back a beat late, softer, like it has been carried a long way.`, choices: [{ label: "Promise to light the lamp", to: "n4" }, { label: "Ask the tide what it wants", to: "n5" }], ending: "" },
      { id: "n3", location: loc(0), characters: [lead, mentor], text: `${mentor} is already awake, sitting in the dark as if waiting. "So it has started," they say, and won't meet your eyes.`, choices: [{ label: "Demand the truth", to: "n5" }, { label: "Ask for help instead", to: "n4" }], ending: "" },
      { id: "n4", location: loc(0), characters: [lead, friend, mentor], text: `The wick won't take. ${friend} shields it with both hands. ${mentor} murmurs a word you've never heard, and the flame leans toward you.`, choices: [{ label: "Climb to the lamp room", to: "n6" }, { label: "Carry the flame to the shore", to: "n7" }], ending: "" },
      { id: "n5", location: loc(2), characters: [lead, rival], text: `Far out, the dark gathers into a shape. ${rival} speaks with a hundred small voices: "Everyone promises. No one comes back."`, choices: [{ label: "Promise to come back", to: "n7" }, { label: "Turn and run", to: "n8" }], ending: "" },
      { id: "n6", location: loc(0), characters: [lead, friend], text: `The great lamp catches all at once. Light pours over the water, and for a moment you can see every lost thing the sea has kept.`, choices: [{ label: "Look for the brightest one", to: "e1" }, { label: "Look for the darkest one", to: "e2" }], ending: "" },
      { id: "n7", location: loc(1), characters: [lead, rival], text: `You hold the flame out to the dark. It flinches — then, slowly, leans closer, the way ${friend} did the first night you met.`, choices: [{ label: "Give it the flame", to: "e2" }, { label: "Keep the flame, offer your hand", to: "e1" }], ending: "" },
      { id: "n8", location: loc(0), characters: [lead], text: `You run until the tide stops saying your name. The silence is worse.`, choices: [{ label: "Go back", to: "n2" }, { label: "Stay inside until morning", to: "e3" }], ending: "" },
      { id: "e1", location: loc(0), characters: [lead, friend, mentor, rival], text: `The lamp burns all night, and the sea gives back one small, bright thing it had been keeping for you. ${r.pick(["Your name, said kindly.", "A song you'd forgotten.", "Your first promise, kept."])}`, choices: [], ending: "triumph" },
      { id: "e2", location: loc(1), characters: [lead, rival], text: `The dark goes quiet, warmed. It is not gone — it will never be gone — but it is no longer alone.`, choices: [], ending: "bittersweet" },
      { id: "e3", location: loc(0), characters: [lead], text: `Morning comes. The lamp stays dark. Somewhere far out, something stops waiting.`, choices: [], ending: "lost" },
    ],
  };
}
