import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import * as S from "./schemas";
import * as M from "./mock";

export const MODEL = "claude-opus-5-5";

const SYSTEM = `You are the creative engine of WorldFactory, a studio that develops original entertainment franchises (IP).
Write like a seasoned studio executive and showrunner: specific, vivid, commercially aware, never generic.
Invent original names; never reuse existing franchises' characters or trademarks. Comparables may name real titles.
Keep everything consistent with the canon you are given. Use the canon's exact character names.`;

interface TaskDef<In, Out extends z.ZodType> {
  schema: Out;
  prompt: (input: In) => string;
  mock: (input: In) => z.infer<Out>;
}

function def<In, Out extends z.ZodType>(d: TaskDef<In, Out>) {
  return d;
}

export const TASKS = {
  discovery: def({
    schema: S.DiscoveryOut,
    mock: M.mockDiscovery,
    prompt: (i: S.DiscoveryIn) =>
      `A creator's one-line idea: "${i.prompt}"\n\nRun Discovery. Return exactly five franchise concepts that each take the idea in a clearly different direction (genre, audience, tone). Each needs a title, logline, genre, tone, audience, a distinctive hook, 3-4 formats, 3 comparables, a 4-colour hex palette and honest 0-100 scores.`,
  }),
  develop: def({
    schema: S.DevelopOut,
    mock: M.mockDevelop,
    prompt: (i: S.DevelopIn) =>
      `Original idea: "${i.prompt}"\nChosen concept:\n${JSON.stringify(i.concept, null, 2)}\n\nRun creative development. Produce the franchise core (logline, premise, 3 themes, 4 pillars, audience, tone, comparables, 4-5 formats with status), a cast of 5 characters with relationships by name, and a world with 4-5 locations, 3-4 rules, 3 factions and a 4-6 entry timeline.`,
  }),
  character: def({
    schema: S.CharacterOut,
    mock: M.mockCharacter,
    prompt: (i: S.CharacterIn) =>
      `Canon:\n${i.brief}\n\nCreate one new character for ${i.name} from this idea: "${i.idea || "surprise me"}". Relationships must reference existing characters by name.`,
  }),
  world: def({
    schema: S.WorldExpandOut,
    mock: M.mockWorldExpand,
    prompt: (i: S.BriefIn) =>
      `Canon:\n${i.brief}\n\nExpand the world of ${i.name}: one new location, one new rule and one new faction that fit canon and open new story doors.`,
  }),
  studio: def({
    schema: S.StudioAssetsOut,
    mock: M.mockStudio,
    prompt: (i: S.StudioIn) =>
      `Canon:\n${i.brief}\n\nYou are the ${i.studio} department. Create one "${i.kind}" for ${i.name}.${i.direction ? ` Direction from the creator: ${i.direction}.` : ""} Put the full deliverable in body. List which canon characters it uses.`,
  }),
  social: def({
    schema: S.SocialOut,
    mock: M.mockSocial,
    prompt: (i: S.BriefIn) =>
      `Canon:\n${i.brief}\n\nPlan a 30-day launch calendar for ${i.name}: 12 platform-native posts spread across days 1-30 on TikTok, Instagram, YouTube Shorts and X. Each needs a scroll-stopping hook, caption, 2-4 hashtags and the characters featured.`,
  }),
  director: def({
    schema: S.DirectorOut,
    mock: M.mockDirector,
    prompt: (i: S.DirectorIn) =>
      `Canon:\n${i.brief}\n\nYou are the Studio Director. Objective: ${i.objective || "take the franchise from canon v1 to a proven audience in 90 days"}.\nPlan 3 phases with 3-4 tasks each, assigned to studio departments (ip-lab, characters, world, story, social, animation, music, games, publishing, merch, brand, vault). Each task's deliverable should be a short asset kind name such as "episode outline", "style guide" or "product line".`,
  }),
} as const;

export type TaskName = keyof typeof TASKS;

export interface AIResult<T> {
  data: T;
  source: "claude" | "mock";
  note?: string;
}

function hasCredentials() {
  if (process.env.WORLDFACTORY_MOCK === "1") return false;
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let client: Anthropic | null = null;

export async function runTask(name: TaskName, input: unknown): Promise<AIResult<unknown>> {
  const task = TASKS[name] as TaskDef<unknown, z.ZodType>;
  if (!hasCredentials()) return { data: task.mock(input), source: "mock" };

  client ??= new Anthropic();
  try {
    const res = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: "medium", format: zodOutputFormat(task.schema) },
      messages: [{ role: "user", content: task.prompt(input) }],
    });
    if (res.stop_reason === "refusal" || res.parsed_output == null) {
      return { data: task.mock(input), source: "mock", note: `Claude returned ${res.stop_reason}; used the mock.` };
    }
    return { data: res.parsed_output, source: "claude" };
  } catch (err) {
    const msg =
      err instanceof Anthropic.APIError ? `HTTP ${err.status ?? "?"}: ${err.message.slice(0, 120)}` : err instanceof Error ? err.message : "error";
    console.error(`[worldfactory] ${name} failed, using mock:`, msg);
    return { data: task.mock(input), source: "mock", note: `Claude unavailable (${msg.trim()}); used the mock.` };
  }
}
