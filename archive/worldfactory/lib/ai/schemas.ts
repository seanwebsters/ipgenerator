import { z } from "zod";

const STUDIO_KEYS = [
  "ip-lab",
  "characters",
  "world",
  "story",
  "social",
  "animation",
  "music",
  "games",
  "publishing",
  "merch",
  "brand",
  "vault",
] as const;

export const ConceptOut = z.object({
  title: z.string(),
  logline: z.string(),
  genre: z.string(),
  tone: z.string(),
  audience: z.string(),
  hook: z.string(),
  formats: z.array(z.string()),
  comparables: z.array(z.string()),
  palette: z.array(z.string()).describe("Four hex colours, e.g. #1e1b4b"),
  scores: z.object({
    originality: z.number().int().describe("0-100"),
    marketability: z.number().int().describe("0-100"),
    expandability: z.number().int().describe("0-100"),
    merchability: z.number().int().describe("0-100"),
  }),
});

export const DiscoveryOut = z.object({
  concepts: z.array(ConceptOut).describe("Exactly five clearly different concepts"),
});

export const CharacterOut = z.object({
  name: z.string(),
  role: z.string().describe("protagonist, mentor, antagonist, sidekick, rival..."),
  archetype: z.string(),
  description: z.string(),
  motivation: z.string(),
  flaw: z.string(),
  visualNotes: z.string(),
  voice: z.string(),
  color: z.string().describe("Signature hex colour"),
  relationships: z.array(z.object({ with: z.string().describe("Other character's name"), kind: z.string() })),
});

const LocationOut = z.object({ name: z.string(), kind: z.string(), description: z.string(), mood: z.string() });
const RuleOut = z.object({ title: z.string(), description: z.string() });
const FactionOut = z.object({ name: z.string(), ideology: z.string(), description: z.string() });

export const DevelopOut = z.object({
  name: z.string(),
  tagline: z.string(),
  core: z.object({
    logline: z.string(),
    premise: z.string(),
    themes: z.array(z.string()),
    pillars: z.array(z.string()),
    audience: z.string(),
    tone: z.string(),
    comparables: z.array(z.string()),
    formats: z.array(
      z.object({ name: z.string(), status: z.enum(["core", "planned", "exploring"]), note: z.string() }),
    ),
  }),
  characters: z.array(CharacterOut).describe("Four to six characters"),
  world: z.object({
    premise: z.string(),
    setting: z.string(),
    era: z.string(),
    locations: z.array(LocationOut),
    rules: z.array(RuleOut),
    factions: z.array(FactionOut),
    timeline: z.array(z.object({ when: z.string(), event: z.string() })),
  }),
});

export const WorldExpandOut = z.object({
  locations: z.array(LocationOut),
  rules: z.array(RuleOut),
  factions: z.array(FactionOut),
});

export const StudioAssetsOut = z.object({
  assets: z.array(
    z.object({
      kind: z.string(),
      title: z.string(),
      summary: z.string(),
      body: z.string().describe("The deliverable itself, in plain text with line breaks"),
      characters: z.array(z.string()).describe("Names of canon characters this asset uses"),
    }),
  ),
});

export const SocialOut = z.object({
  posts: z.array(
    z.object({
      platform: z.enum(["TikTok", "Instagram", "YouTube Shorts", "X"]),
      format: z.string(),
      day: z.number().int().describe("Day 1-30 of the calendar"),
      hook: z.string(),
      caption: z.string(),
      hashtags: z.array(z.string()),
      characters: z.array(z.string()),
    }),
  ),
});

export const DirectorOut = z.object({
  objective: z.string(),
  phases: z.array(
    z.object({
      name: z.string(),
      tasks: z.array(z.object({ studio: z.enum(STUDIO_KEYS), title: z.string(), deliverable: z.string() })),
    }),
  ),
});

export type ConceptOutT = z.infer<typeof ConceptOut>;
export type DiscoveryOutT = z.infer<typeof DiscoveryOut>;
export type CharacterOutT = z.infer<typeof CharacterOut>;
export type DevelopOutT = z.infer<typeof DevelopOut>;
export type WorldExpandOutT = z.infer<typeof WorldExpandOut>;
export type StudioAssetsOutT = z.infer<typeof StudioAssetsOut>;
export type SocialOutT = z.infer<typeof SocialOut>;
export type DirectorOutT = z.infer<typeof DirectorOut>;

/** Inputs sent from the browser to /api/ai/[task]. */
export interface DiscoveryIn {
  prompt: string;
}
export interface DevelopIn {
  prompt: string;
  concept: ConceptOutT;
}
export interface BriefIn {
  /** Compact text summary of canon, built by briefOf(). */
  brief: string;
  name: string;
  characters: string[];
}
export interface CharacterIn extends BriefIn {
  idea: string;
}
export interface StudioIn extends BriefIn {
  studio: string;
  kind: string;
  direction: string;
}
export interface DirectorIn extends BriefIn {
  objective: string;
}
