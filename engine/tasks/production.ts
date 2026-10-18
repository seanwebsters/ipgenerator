import { z } from "zod";
import { seeded } from "../../lib/util";
import { generateStructured } from "../providers/llm";
import { HOUSE_STYLE, learningsFor, type TaskMeta } from "./common";

/* ───────────── Writers' Room: pilot short ───────────── */

export const ScriptSchema = z.object({
  title: z.string(),
  logline: z.string(),
  scenes: z.array(
    z.object({
      heading: z.string().describe("e.g. EXT. THE LISTENING SHORE - NIGHT"),
      location: z.string().describe("Canon location name"),
      action: z.string(),
      framing: z.enum(["establishing", "wide", "medium", "close"]),
      dialogue: z.array(z.object({ character: z.string(), line: z.string(), framing: z.enum(["wide", "medium", "close"]) })),
    }),
  ),
});
export type PilotScript = z.infer<typeof ScriptSchema>;

export interface CanonDigest {
  title: string;
  ageRating: string;
  synopsis: string;
  characters: { name: string; role: string; motivation: string; voice: string }[];
  locations: string[];
  rules: string[];
}

export async function writePilot(input: { canon: CanonDigest; franchiseId: string; feedback?: string[] }, meta: TaskMeta) {
  const c = input.canon;
  return generateStructured({
    ...meta,
    task: "writers.pilot",
    system: `${HOUSE_STYLE}\nYou are the head writer. You write a 60-90 second pilot short that will be produced first as a storyboard animatic, so every beat must be visual and every line short (under 14 words).`,
    prompt: `Canon (v-current):\nTitle: ${c.title} (${c.ageRating})\nSynopsis: ${c.synopsis}\nCharacters:\n${c.characters.map((x) => `- ${x.name} (${x.role}): wants ${x.motivation} Voice: ${x.voice}`).join("\n")}\nLocations: ${c.locations.join("; ")}\nRules:\n${c.rules.map((r) => `- ${r}`).join("\n")}\n\nLearnings to respect:\n${await learningsFor(input.franchiseId)}\n\n${input.feedback?.length ? `Revise to fix these QA notes:\n${input.feedback.map((f) => `- ${f}`).join("\n")}\n\n` : ""}Write the pilot short: 3 scenes, 2-4 lines of dialogue each. Use only canon characters and canon locations, spelled exactly.`,
    schema: ScriptSchema,
    maxTokens: 6000,
    demo: () => demoPilot(c, input.feedback),
  });
}

export function demoPilot(c: CanonDigest, feedback?: string[]): PilotScript {
  const [lead, friend, mentor, rival] = c.characters;
  const L = (n?: { name: string }) => n?.name ?? lead.name;
  const [home, shore, edge] = [c.locations[0] ?? "Home", c.locations[1] ?? c.locations[0] ?? "The Shore", c.locations[2] ?? c.locations[0] ?? "The Edge"];
  const r = seeded(`pilot:${c.title}:${feedback?.length ?? 0}`);
  return {
    title: `${c.title}: ${r.pick(["The Unlit Lamp", "First Tide", "What the Sea Said"])}`,
    logline: `${lead.name} hears the tide say their name and makes a promise the sea intends to keep.`,
    scenes: [
      {
        heading: `INT. ${home.toUpperCase()} - NIGHT`,
        location: home,
        action: `Rain on old glass. ${lead.name} winds a lamp that hasn't been lit in years. ${L(friend)} counts buckets under the leaks.`,
        framing: "establishing",
        dialogue: [
          { character: L(friend), line: "Seven leaks. That's a new record.", framing: "medium" },
          { character: lead.name, line: "Listen. The tide just said my name.", framing: "close" },
        ],
      },
      {
        heading: `EXT. ${shore.toUpperCase()} - NIGHT`,
        location: shore,
        action: `The two of them on the wet sand. The water repeats their words a beat late. ${L(mentor)} watches from a rock, unsurprised.`,
        framing: "wide",
        dialogue: [
          { character: L(mentor), line: "Careful. It remembers everything you promise it.", framing: "medium" },
          { character: lead.name, line: "Then I promise to light the lamp.", framing: "close" },
          { character: L(friend), line: "You can't even light a candle.", framing: "medium" },
        ],
      },
      {
        heading: `EXT. ${edge.toUpperCase()} - CONTINUOUS`,
        location: edge,
        action: `Far out, the dark gathers into a shape. ${L(rival)} turns toward the shore, listening.`,
        framing: "wide",
        dialogue: [
          { character: L(rival), line: "Another promise. How wonderful.", framing: "close" },
          { character: lead.name, line: "Whatever you are, I'm not afraid of you.", framing: "medium" },
        ],
      },
    ],
  };
}

/* ───────────── Quality & Safety: narrative critique ───────────── */

export const CritiqueSchema = z.object({
  score: z.number().int().describe("0-100 overall craft"),
  suitability: z.enum(["ALL", "AGE_7", "AGE_13", "AGE_16", "AGE_18"]).describe("Rating this script actually warrants"),
  issues: z.array(z.object({ severity: z.enum(["blocking", "major", "minor"]), note: z.string() })),
  strengths: z.array(z.string()),
});
export type Critique = z.infer<typeof CritiqueSchema>;

export async function critiqueScript(input: { script: PilotScript; canon: CanonDigest }, meta: TaskMeta) {
  return generateStructured({
    ...meta,
    task: "quality.critique",
    system: `${HOUSE_STYLE}\nYou are Quality & Safety. Be a demanding but fair story editor and standards reviewer. "blocking" means it must not ship (canon break, unsuitable content for the rating, incoherent). Most drafts have 0 blocking issues.`,
    prompt: `Target rating: ${input.canon.ageRating}\nCanon characters: ${input.canon.characters.map((c) => c.name).join(", ")}\nCanon rules:\n${input.canon.rules.map((r) => `- ${r}`).join("\n")}\n\nScript:\n${JSON.stringify(input.script, null, 2)}`,
    schema: CritiqueSchema,
    maxTokens: 3000,
    demo: () => ({
      score: 72,
      suitability: input.canon.ageRating as Critique["suitability"],
      issues: [{ severity: "minor" as const, note: "DEMO critique: the antagonist's motive could be seeded one beat earlier." }],
      strengths: ["Clear visual hook in the opening image.", "Dialogue is short enough for captions."],
    }),
  });
}

/* ───────────── Marketing & Distribution: release package ───────────── */

export const PackageSchema = z.object({
  title: z.string(),
  description: z.string().describe("2-3 sentences, no spoilers"),
  tags: z.array(z.string()),
  thumbnailLine: z.string().describe("Up to 5 words for the poster"),
  socialCaption: z.string(),
});
export type ReleasePackage = z.infer<typeof PackageSchema>;

export async function packageRelease(input: { franchise: string; script: PilotScript; ageRating: string; audience: string }, meta: TaskMeta) {
  return generateStructured({
    ...meta,
    task: "marketing.package",
    system: `${HOUSE_STYLE}\nYou are Marketing & Distribution. Write honest metadata: no clickbait claims, no implied human authorship of AI-assisted work, no false scarcity.`,
    prompt: `Franchise: ${input.franchise}\nAudience: ${input.audience} (${input.ageRating})\nPilot: ${input.script.title}: ${input.script.logline}\n\nWrite the release package for an animatic pilot short.`,
    schema: PackageSchema,
    maxTokens: 1500,
    demo: () => ({
      title: input.script.title,
      description: `${input.script.logline} The first story from ${input.franchise}, presented as an animatic pilot.`,
      tags: [input.franchise.toLowerCase(), "animatic", "original story", "pilot"],
      thumbnailLine: input.franchise,
      socialCaption: `${input.script.logline} Pilot animatic, out now.`,
    }),
  });
}
