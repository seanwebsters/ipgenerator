import { z } from "zod";
import { seeded } from "../../lib/util";
import { generateStructured } from "../providers/llm";
import { HOUSE_STYLE, learningsFor, type TaskMeta } from "./common";

const AGE = z.enum(["ALL", "AGE_7", "AGE_13", "AGE_16", "AGE_18"]);

/* ───────────── Cultural Intelligence: opportunity briefs ───────────── */

export const OpportunitySchema = z.object({
  opportunities: z.array(
    z.object({
      title: z.string(),
      summary: z.string(),
      audience: z.string(),
      genre: z.string(),
      score: z.number().int().describe("0-100 attractiveness"),
      evidence: z.array(
        z.object({
          claim: z.string(),
          sourceKind: z.enum(["model-knowledge", "web", "internal-metrics"]),
          source: z.string().describe("Where the claim comes from. Use 'general industry knowledge (unverified)' when no citable source."),
        }),
      ),
    }),
  ),
});
export type Opportunities = z.infer<typeof OpportunitySchema>;

export async function researchOpportunities(brief: string, meta: TaskMeta) {
  return generateStructured({
    ...meta,
    task: "intel.opportunities",
    system: `${HOUSE_STYLE}\nYou are the Cultural Intelligence lead. You find underserved audiences and story spaces. You do not copy trending IP; you describe the unmet need.`,
    prompt: `Founder brief: "${brief}"\n\nPrior learnings:\n${await learningsFor(null)}\n\nWrite 3 opportunity briefs. Each needs 2-3 evidence items. You have no live web access in this step, so mark evidence sourceKind "model-knowledge" and say "general industry knowledge (unverified)" unless the learnings above support it (then "internal-metrics").`,
    schema: OpportunitySchema,
    maxTokens: 4000,
    demo: () => demoOpportunities(brief),
  });
}

/* ───────────── Original IP Lab: concepts ───────────── */

export const ConceptSchema = z.object({
  concepts: z.array(
    z.object({
      title: z.string(),
      logline: z.string(),
      genre: z.string(),
      audience: z.string(),
      tone: z.string(),
      hook: z.string().describe("What makes it unforgettable, in one sentence"),
      ageRating: AGE,
      comparables: z.array(z.string()),
      formats: z.array(z.string()),
      palette: z.array(z.string()).describe("Four hex colours: deep base, mid, warm accent, light accent"),
      leadCharacter: z.string().describe("Lead character name"),
    }),
  ),
});
export type Concepts = z.infer<typeof ConceptSchema>;

export async function generateConcepts(input: { brief: string; count: number; opportunities: Opportunities["opportunities"] }, meta: TaskMeta) {
  return generateStructured({
    ...meta,
    task: "iplab.concepts",
    system: `${HOUSE_STYLE}\nYou are the head of the Original IP Lab. You invent franchises that can live for decades across film, series, games, music, books and products.`,
    prompt: `Founder brief: "${input.brief}"\n\nOpportunity briefs:\n${input.opportunities.map((o) => `- ${o.title}: ${o.summary} (audience: ${o.audience})`).join("\n")}\n\nInvent exactly ${input.count} clearly different original franchise concepts. Vary premise, tone and format. Give each an original title and an original lead character name.`,
    schema: ConceptSchema,
    maxTokens: 8000,
    demo: () => demoConcepts(input.brief, input.count),
  });
}

/* ───────────── Original IP Lab: scoring ───────────── */

export const ScoreSchema = z.object({
  scores: z.array(
    z.object({
      title: z.string(),
      originality: z.number().int(),
      emotionalAppeal: z.number().int(),
      extensibility: z.number().int(),
      feasibility: z.number().int().describe("Can WEBSTER produce a pilot with current capabilities?"),
      rationale: z.string(),
      resemblanceConcerns: z.array(z.string()).describe("Any resemblance to existing protected properties. Empty if none."),
    }),
  ),
});
export type Scores = z.infer<typeof ScoreSchema>;

export async function scoreConcepts(concepts: Concepts["concepts"], meta: TaskMeta) {
  return generateStructured({
    ...meta,
    task: "iplab.score",
    system: `${HOUSE_STYLE}\nYou are a rigorous greenlight committee. Score honestly on 0-100; most concepts should score 45-80. Flag any resemblance to existing protected properties.`,
    prompt: `Score each concept on originality, emotional appeal, extensibility (franchise potential) and production feasibility for a studio that currently produces storyboard animatics, scripts, key art and audio.\n\n${JSON.stringify(concepts, null, 2)}`,
    schema: ScoreSchema,
    maxTokens: 6000,
    demo: () => demoScores(concepts),
  });
}

/* ───────────── Original IP Lab: canon bible ───────────── */

export const BibleSchema = z.object({
  universe: z.object({ name: z.string(), description: z.string() }),
  synopsis: z.string(),
  characters: z.array(
    z.object({
      name: z.string(),
      role: z.string(),
      age: z.string(),
      personality: z.array(z.string()),
      motivation: z.string(),
      flaw: z.string(),
      appearance: z.string(),
      color: z.string().describe("Signature hex colour"),
      voice: z.string().describe("How they sound and speak"),
      relationships: z.array(z.object({ with: z.string(), kind: z.string() })),
    }),
  ),
  locations: z.array(z.object({ name: z.string(), description: z.string(), mood: z.string() })),
  rules: z.array(z.object({ name: z.string(), description: z.string() })),
  arcs: z.array(z.object({ name: z.string(), description: z.string() })),
  timeline: z.array(z.object({ name: z.string(), when: z.string(), description: z.string() })),
  styleGuide: z.object({ shapeLanguage: z.string(), lighting: z.string(), texture: z.string(), typography: z.string(), doNot: z.array(z.string()) }),
  musicTheme: z.object({ name: z.string(), description: z.string(), instrumentation: z.string() }),
});
export type Bible = z.infer<typeof BibleSchema>;

export async function writeBible(concept: Concepts["concepts"][number], meta: TaskMeta) {
  return generateStructured({
    ...meta,
    task: "iplab.bible",
    system: `${HOUSE_STYLE}\nYou are writing the canon bible every WEBSTER department will build from. Be precise and producible.`,
    prompt: `Greenlit concept:\n${JSON.stringify(concept, null, 2)}\n\nWrite the canon bible: universe, synopsis, 4-5 characters (the lead is ${concept.leadCharacter}) with relationships by name, 3-5 locations, 3-4 world rules, 2 story arcs, a 4-6 event timeline, a visual style guide and a main music theme.`,
    schema: BibleSchema,
    maxTokens: 12000,
    demo: () => demoBible(concept),
  });
}

/* ───────────── DEMO generators (deterministic, labelled DEMO) ───────────── */

const STOP = new Set("fantasy fantasies horror comedy comedies science fiction scifi sci-fi adventure adventures mystery mysteries drama dramas thriller thrillers romance animated animation series film films show shows game games genre genres audience audiences teens teen family families modern epic cozy dark a an the and or but of to in on at for with about from into who what that this those these is are was were be been being it its as by can could would should will make create develop build franchise franchises original story stories world worlds young adults adult kids children family ip five two three four strongest concepts concept prototype".split(" "));
const keywords = (s: string) => s.toLowerCase().replace(/[^a-z\s-]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w));
const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

const ANGLES = [
  { genre: "Mythic fantasy", tone: "Grand, bittersweet, luminous", audience: "Young adults 16-28", age: "AGE_13" as const, formats: ["Animated series", "Novel trilogy", "Narrative game", "Soundtrack album"], comps: ["Arcane", "Avatar: The Last Airbender", "Hollow Knight"], palette: ["#14101f", "#4b2f6b", "#e8a54b", "#a8d5c2"], titles: (k: string) => [`The ${k} Tide`, `Crown of ${k}`, `${k}fall`], leads: ["Isolde Varr", "Kesh Andair", "Mirren Tal"], hook: (k: string) => `Every spell borrows a memory, and the ${k.toLowerCase()} keeps the receipts.` },
  { genre: "Cozy adventure", tone: "Warm, wondrous, gently funny", audience: "Families, kids 6-10", age: "ALL" as const, formats: ["Animated shorts", "Picture books", "Plush line", "Cozy mobile game"], comps: ["Bluey", "My Neighbor Totoro", "Animal Crossing"], palette: ["#1d1626", "#5a3a6e", "#f0a64a", "#8fc9b4"], titles: (k: string) => [`${k}wick Hollow`, `The ${k} Keepers`, `Little ${k}`], leads: ["Pim Thistlewood", "Odo Fennick", "Juniper Bell"], hook: (k: string) => `Each story ends with a small kindness that changes the ${k.toLowerCase()} for good.` },
  { genre: "Folk horror mystery", tone: "Eerie, tender, slow-burn", audience: "Adults 18-34", age: "AGE_16" as const, formats: ["Audio drama", "Graphic novel", "Limited series", "ARG"], comps: ["Over the Garden Wall", "Midsommar", "Night in the Woods"], palette: ["#0e1113", "#2d3a33", "#c9773b", "#d9d2b6"], titles: (k: string) => [`The ${k} Hours`, `Beneath ${k}`, `${k} Hymnal`], leads: ["Agnes Corrow", "Tobiah Wren", "Nell Ashgrove"], hook: (k: string) => `The village sings the ${k.toLowerCase()} hymn every night. Nobody remembers learning it.` },
  { genre: "Hopeful science fiction", tone: "Optimistic, kinetic, curious", audience: "Teens and families", age: "AGE_7" as const, formats: ["Feature film", "YouTube series", "Construction toys", "Sandbox game"], comps: ["WALL-E", "The Iron Giant", "Outer Wilds"], palette: ["#0b1026", "#24508f", "#f2793a", "#dff1ff"], titles: (k: string) => [`${k} Drift`, `Station ${k}`, `${k}runners`], leads: ["Tycho Amare", "Nova Reyes", "Bix Okonkwo"], hook: (k: string) => `The last ${k.toLowerCase()} repair crew in the solar system is three kids and a robot who hates small talk.` },
  { genre: "Comedy ensemble", tone: "Chaotic, quick, big-hearted", audience: "Tweens 9-13", age: "AGE_7" as const, formats: ["Animated shorts", "Webcomic", "Social channel", "Party game"], comps: ["Gravity Falls", "Adventure Time", "Overcooked"], palette: ["#151320", "#d94f7a", "#2ec4c4", "#f7d046"], titles: (k: string) => [`${k} Patrol`, `Totally ${k}`, `${k} & Sons`], leads: ["Dash Mbeki", "Marlo Quist", "Gigi Fontaine"], hook: (k: string) => `Every disaster in town is technically a ${k.toLowerCase()} problem, and nobody is qualified.` },
];

export function demoOpportunities(brief: string): Opportunities {
  const k = cap(keywords(brief)[0] ?? "wonder");
  return {
    opportunities: [
      { title: `Earnest ${k.toLowerCase()} myth for an older audience`, summary: `Audiences who grew up on animated fantasy want sincere, serialised mythmaking that respects them; few new originals target them.`, audience: "Young adults 16-28", genre: "Mythic fantasy", score: 74, evidence: [{ claim: "Adult animation and YA fantasy continue to find large audiences on streaming platforms.", sourceKind: "model-knowledge", source: "general industry knowledge (unverified)" }, { claim: "Few recent originals combine sincere tone with serialised lore.", sourceKind: "model-knowledge", source: "general industry knowledge (unverified)" }] },
      { title: "Comfort stories families rewatch", summary: "Short, gentle, character-led stories are rewatched and shared between parents and kids.", audience: "Families", genre: "Cozy adventure", score: 69, evidence: [{ claim: "Gentle preschool and family shows show strong rewatch behaviour.", sourceKind: "model-knowledge", source: "general industry knowledge (unverified)" }] },
      { title: "Audio-first eerie mysteries", summary: "Serialised audio mysteries build loyal audiences cheaply and translate to comics and TV.", audience: "Adults 18-34", genre: "Folk horror mystery", score: 61, evidence: [{ claim: "Fiction podcasts have been adapted into television and comics.", sourceKind: "model-knowledge", source: "general industry knowledge (unverified)" }] },
    ],
  };
}

export function demoConcepts(brief: string, count: number): Concepts {
  const r = seeded(`concepts:${brief}`);
  const kws = keywords(brief);
  const angles = r.shuffle(ANGLES).slice(0, Math.min(count, ANGLES.length));
  return {
    concepts: angles.map((a, i) => {
      // Prefer evocative words from the brief; otherwise draw from a seeded pool.
      const pool = r.shuffle(["Ember", "Lantern", "Tide", "Hollow", "Comet", "Thorn", "Gloam", "Briar", "Halcyon", "Cinder", "Vesper", "Marrow"]);
      const k = cap(kws[i] ?? pool[i % pool.length]);
      const lead = r.pick(a.leads);
      return {
        title: r.pick(a.titles(k)),
        logline: `${lead.split(" ")[0]}, ${r.pick(["an apprentice cartographer", "a night-shift lighthouse keeper", "the youngest member of a failing guild", "a reluctant heir", "a robot repair kid"])}, must ${r.pick(["return what the storm stole", "map a coastline that moves", "keep a promise nobody else remembers", "win back a town's lost song"])} before ${r.pick(["the last lantern goes out", "the tide forgets them", "the festival of masks ends", "the station's sun burns down"])}.`,
        genre: a.genre,
        audience: a.audience,
        tone: a.tone,
        hook: a.hook(k),
        ageRating: a.age,
        comparables: a.comps,
        formats: a.formats,
        palette: a.palette,
        leadCharacter: lead,
      };
    }),
  };
}

export function demoScores(concepts: Concepts["concepts"]): Scores {
  return {
    scores: concepts.map((c) => {
      const r = seeded(`score:${c.title}`);
      const base = c.genre.includes("Mythic") ? [78, 80, 86, 62] : c.genre.includes("Cozy") ? [66, 84, 78, 88] : c.genre.includes("horror") ? [82, 72, 64, 80] : c.genre.includes("science") ? [70, 76, 82, 70] : [68, 74, 70, 84];
      const j = () => r.int(-6, 6);
      return {
        title: c.title,
        originality: base[0] + j(),
        emotionalAppeal: base[1] + j(),
        extensibility: base[2] + j(),
        feasibility: base[3] + j(),
        rationale: `DEMO scoring for "${c.title}": ${c.genre.toLowerCase()} with a clear hook; feasibility reflects animatic-first production.`,
        resemblanceConcerns: [],
      };
    }),
  };
}

export function demoBible(c: Concepts["concepts"][number]): Bible {
  const r = seeded(`bible:${c.title}`);
  const leadFirst = c.leadCharacter.split(" ")[0];
  const others = r.shuffle(["Mara Quell", "Ivo Brannoch", "Tolle the Clockwork Heron", "Sefa Dunmore", "Old Ruddock", "Wick"]).slice(0, 3);
  const colors = ["#e07a3a", "#7fb7a6", "#c9a35c", "#b56a8f", "#6f8fd1"];
  const roles = ["protagonist", "best friend", "mentor", "antagonist"];
  const names = [c.leadCharacter, ...others];
  const place = c.title.replace(/^(The|Crown of|Station|Beneath|Little|Totally)\s+/i, "").split(/\s/)[0];
  return {
    universe: { name: `The ${place} Reach`, description: `The world of ${c.title}: ${c.hook}` },
    synopsis: `${c.logline} ${c.title} is a ${c.genre.toLowerCase()} told with a ${c.tone.toLowerCase()} voice, built to grow from short-form pilots into series, books and games.`,
    characters: names.map((n, i) => ({
      name: n,
      role: roles[i],
      age: ["14", "15", "a very old 300", "unknown"][i],
      personality: [["stubborn", "curious", "kind under pressure"], ["loyal", "funny", "anxious"], ["patient", "cryptic", "tired"], ["magnetic", "wounded", "certain"]][i],
      motivation: ["To prove a small person can carry a big promise.", `To keep ${leadFirst} safe without saying so.`, "To pass on what they know before it is lost.", "To undo the loss that made them."][i],
      flaw: ["Acts before asking.", "Can't say no.", "Hides the truth to protect others.", "Believes the ends justify everything."][i],
      appearance: ["Oversized amber scarf, ink-stained hands, a lantern at the hip.", "Round silhouette, patched coat, pockets full of string.", "Long-legged, brass-feathered, spectacles on a chain.", "Ink-wash silhouette that frays into moths at the edges."][i],
      color: colors[i],
      voice: ["Quick, asks three questions at once", "Low, dry, surprisingly gentle", "Measured, hums while thinking", "Soft, overlapping whispers"][i],
      relationships: i === 0 ? [{ with: names[1], kind: "best friends" }, { with: names[2], kind: "apprentice of" }, { with: names[3], kind: "hunted by" }] : [{ with: names[0], kind: ["protective of", "mentor to", "fascinated by"][i - 1] }],
    })),
    locations: [
      { name: `${place} Lighthouse`, description: "Home base: a crooked lighthouse whose lamp has not been lit in a generation.", mood: "Warm, cluttered, safe" },
      { name: "The Listening Shore", description: "A beach where the tide repeats whatever was last said near it.", mood: "Uncanny, beautiful" },
      { name: "Gloamreach", description: "The cold edge of the map where lost things gather.", mood: "Tense, wrong" },
    ],
    rules: [
      { name: "Every wonder costs a memory", description: "Magic is paid for with something remembered; the cost is always visible on screen." },
      { name: "The tide keeps promises", description: "A promise spoken to the sea must be kept, or the sea collects." },
      { name: "No one fixes the world alone", description: "Every finale is solved by the group, never the lead alone." },
    ],
    arcs: [
      { name: "Season one: The Unlit Lamp", description: `${leadFirst} relights the lighthouse and learns what it was keeping out.` },
      { name: `${names[3]}'s loss`, description: `The antagonist's grief is revealed and becomes the heart of the finale.` },
    ],
    timeline: [
      { name: "The First Promise", when: "Long ago", description: "The sea and the first keeper make a bargain." },
      { name: "The Lamp Goes Dark", when: "A generation ago", description: `${names[2]} breaks a promise; the lamp goes out.` },
      { name: "The Storm Arrives", when: "Pilot", description: `${leadFirst} hears the tide say their name.` },
      { name: "The Reckoning", when: "Season one finale", description: `${names[3]} asks for what was taken.` },
    ],
    styleGuide: { shapeLanguage: "Round for allies, angular for threat; silhouettes readable at thumbnail size.", lighting: "One warm practical source against cool moonlight.", texture: "Gouache backgrounds, film grain, clean character shapes.", typography: "High-contrast serif titles, generous letterspacing.", doNot: ["No pure black skies", "No real-world logos", "Never crop characters at the eyes"] },
    musicTheme: { name: `${c.title} — Main Theme`, description: "A rising fifth answered by a falling step: the call home.", instrumentation: "Celesta, warm strings, low hand drum, distant choir" },
  };
}
