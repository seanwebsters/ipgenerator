import { seeded } from "../util";
import type {
  CharacterIn,
  CharacterOutT,
  ConceptOutT,
  DevelopIn,
  DevelopOutT,
  DirectorIn,
  DirectorOutT,
  DiscoveryIn,
  DiscoveryOutT,
  SocialOutT,
  StudioAssetsOutT,
  StudioIn,
  BriefIn,
  WorldExpandOutT,
} from "./schemas";

/*
 * Deterministic mock generators. Same input -> same output, so the whole
 * product works (and screenshots are reproducible) with no API key.
 */

const STOP = new Set(
  "a an the and or but of to in on at for with about from into over under who what that this those these is are was were be been being it its as by can could would should will just very some any their there they them his her our your my me we you i make create build franchise story world ip idea".split(
    " ",
  ),
);

function keywords(prompt: string): string[] {
  return prompt
    .toLowerCase()
    .replace(/[^a-z\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w) && !VERBS.has(w))
    .sort((a, b) => b.length - a.length);
}

const VERBS = new Set("talk talks live lives look looks find finds become becomes turn turns keep keeps want wants need needs have has know knows love loves help helps take takes give gives tell tells after before where when only even still".split(" "));

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
const FALLBACK_WORDS = ["Moon", "Ember", "Tide", "Hollow", "Star", "Thistle", "Lantern", "Comet"];

interface Angle {
  genre: string;
  tone: string;
  audience: string;
  formats: string[];
  comparables: string[];
  palette: string[];
  titles: ((k: string) => string)[];
  heroes: string[];
  goals: string[];
  stakes: string[];
  hook: (k: string) => string;
  bias: [number, number, number, number];
}

const ANGLES: Angle[] = [
  {
    genre: "Cozy fantasy adventure",
    tone: "Warm, wondrous, gently funny",
    audience: "Kids 6-10 and the grown-ups watching with them",
    formats: ["Animated series", "Picture books", "Plush line", "Cozy mobile game"],
    comparables: ["Bluey", "My Neighbor Totoro", "Animal Crossing"],
    palette: ["#1e1b4b", "#7c3aed", "#fbbf24", "#a7f3d0"],
    titles: [(k) => `${k}wilders`, (k) => `The ${k} Keepers`, (k) => `${k}folk`],
    heroes: ["a curious young fox", "a shy lantern-maker", "a pocket-sized explorer"],
    goals: ["gather a found family of misfits", "map a forest that rearranges itself", "return every lost thing to its owner"],
    stakes: ["the first frost seals the hollow for a hundred years", "the last light in the valley goes out", "the grown-ups stop believing"],
    hook: (k) => `Every episode ends with a small kindness that changes the ${k.toLowerCase()} forever.`,
    bias: [70, 85, 80, 92],
  },
  {
    genre: "Mythic epic",
    tone: "Grand, earnest, bittersweet",
    audience: "Teens and young adults 13-25",
    formats: ["Streaming series", "Novel trilogy", "Action RPG", "Collectible card game"],
    comparables: ["Avatar: The Last Airbender", "Arcane", "The Legend of Zelda"],
    palette: ["#0f172a", "#b45309", "#dc2626", "#fde68a"],
    titles: [(k) => `Crown of ${k}`, (k) => `The ${k} Covenant`, (k) => `Ashes of ${k}`],
    heroes: ["an exiled heir", "a reluctant oath-breaker", "a cartographer with a forbidden map"],
    goals: ["unite five warring houses", "wake a god who should stay asleep", "find the city erased from every map"],
    stakes: ["the eclipse that ends the old pact", "their own bloodline turns against them", "the sky itself begins to fall"],
    hook: (k) => `Power is borrowed from the ${k.toLowerCase()}, and every loan comes due.`,
    bias: [78, 74, 92, 70],
  },
  {
    genre: "Comedy ensemble",
    tone: "Chaotic, quick, big-hearted",
    audience: "Tweens 9-13",
    formats: ["Animated shorts", "Comic strips", "Social channel", "Party game"],
    comparables: ["Gravity Falls", "Adventure Time", "Among Us"],
    palette: ["#111827", "#ec4899", "#22d3ee", "#facc15"],
    titles: [(k) => `${k} Patrol`, (k) => `Totally ${k}`, (k) => `${k} & Co.`],
    heroes: ["three best friends with one braincell", "an overconfident intern", "a disaster-prone substitute hero"],
    goals: ["run the town's least-qualified rescue service", "win the summer contest at any cost", "keep a very big secret very badly"],
    stakes: ["the mayor finds out", "summer ends", "everyone's group chat goes public"],
    hook: (k) => `Every problem in town is technically a ${k.toLowerCase()} problem, and nobody is qualified to fix it.`,
    bias: [72, 88, 76, 80],
  },
  {
    genre: "Mystery thriller",
    tone: "Moody, clever, eerie",
    audience: "Young adults 16-30",
    formats: ["Audio drama", "Graphic novel", "Narrative game", "Alternate-reality campaign"],
    comparables: ["Stranger Things", "Over the Garden Wall", "Night in the Woods"],
    palette: ["#020617", "#334155", "#38bdf8", "#f43f5e"],
    titles: [(k) => `The ${k} Hours`, (k) => `Beneath ${k}`, (k) => `${k} Signal`],
    heroes: ["a night-shift radio host", "a teenager who keeps waking up somewhere else", "a retired detective's granddaughter"],
    goals: ["decode a broadcast nobody else can hear", "find out who keeps leaving the notes", "solve a disappearance thirty years cold"],
    stakes: ["the town forgets them too", "the signal reaches its final message", "the next full moon"],
    hook: (k) => `Each chapter hides a real clue; the audience solves the ${k.toLowerCase()} alongside the cast.`,
    bias: [86, 70, 78, 58],
  },
  {
    genre: "Hopeful sci-fi",
    tone: "Optimistic, curious, kinetic",
    audience: "Families and sci-fi fans of all ages",
    formats: ["Feature film", "YouTube series", "Construction toys", "Sandbox game experience"],
    comparables: ["WALL-E", "Star Wars: Visions", "No Man's Sky"],
    palette: ["#0b1026", "#2563eb", "#f97316", "#e0f2fe"],
    titles: [(k) => `${k} Drift`, (k) => `Station ${k}`, (k) => `${k}runners`],
    heroes: ["a maintenance robot with a big heart", "the youngest pilot on a generation ship", "twin engineers who disagree about everything"],
    goals: ["rebuild a broken star-map", "deliver the last seed vault to a new world", "make first contact without a manual"],
    stakes: ["the ship's sun burns out", "the colony votes to turn back", "the signal fades for good"],
    hook: (k) => `Build what you see: every ship, rover and gadget in ${k} is designed to be made in real life.`,
    bias: [80, 78, 86, 88],
  },
];

function subjectOf(prompt: string): string {
  const p = prompt.trim().replace(/[.!?]+$/, "");
  if (!p) return "an old world wakes up";
  return p.length > 90 ? p.slice(0, 87) + "..." : p;
}

export function mockDiscovery({ prompt }: DiscoveryIn): DiscoveryOutT {
  const rng = seeded(`discovery:${prompt}`);
  const kws = keywords(prompt);
  const concepts: ConceptOutT[] = ANGLES.map((angle, i) => {
    const kw = cap(kws[i % Math.max(kws.length, 1)] ?? rng.pick(FALLBACK_WORDS));
    const title = rng.pick(angle.titles)(kw);
    const jitter = () => rng.int(-8, 8);
    return {
      title,
      logline: `${cap(rng.pick(angle.heroes))} must ${rng.pick(angle.goals)} before ${rng.pick(angle.stakes)}.`,
      genre: angle.genre,
      tone: angle.tone,
      audience: angle.audience,
      hook: angle.hook(kw),
      formats: angle.formats,
      comparables: angle.comparables,
      palette: angle.palette,
      scores: {
        originality: Math.min(98, angle.bias[0] + jitter()),
        marketability: Math.min(98, angle.bias[1] + jitter()),
        expandability: Math.min(98, angle.bias[2] + jitter()),
        merchability: Math.min(98, angle.bias[3] + jitter()),
      },
    };
  });
  return { concepts };
}

const NAME_BANK: Record<string, string[]> = {
  "Cozy fantasy adventure": ["Pip", "Wren", "Bramble", "Tansy", "Oolu", "Fennick", "Clover", "Moss", "Juniper", "Sorrel"],
  "Mythic epic": ["Kaelen", "Ysolde", "Taren", "Maelis", "Corvan", "Ilyra", "Dravek", "Seren", "Vashti", "Orrin"],
  "Comedy ensemble": ["Dash", "Marlo", "Bix", "Gigi", "Toby", "Rocco", "Peaches", "Ziggy", "Mo", "Lulu"],
  "Mystery thriller": ["Nell", "Avery", "Silas", "Mara", "Theo", "Imogen", "Cole", "Rhea", "Jonah", "Ivy"],
  "Hopeful sci-fi": ["Nova", "Kip", "Astra", "Bolt", "Rio", "Vega", "Tycho", "Lumi", "Orion", "Cass"],
};

const ROLES = [
  { role: "protagonist", archetype: "The Seeker", motive: "to prove they belong", flaw: "rushes in before thinking" },
  { role: "best friend", archetype: "The Loyal Heart", motive: "to keep everyone together", flaw: "can't say no" },
  { role: "mentor", archetype: "The Keeper of Secrets", motive: "to pass on what they know before it's too late", flaw: "hides the truth to protect others" },
  { role: "rival", archetype: "The Mirror", motive: "to be the one everyone looks to", flaw: "pride" },
  { role: "antagonist", archetype: "The Hollow Crown", motive: "to undo the loss that made them", flaw: "believes the ends justify everything" },
];

const COLORS = ["#f472b6", "#60a5fa", "#fbbf24", "#34d399", "#a78bfa", "#f87171"];

export function mockDevelop({ prompt, concept }: DevelopIn): DevelopOutT {
  const rng = seeded(`develop:${concept.title}:${prompt}`);
  const names = rng.pickN(NAME_BANK[concept.genre] ?? NAME_BANK["Cozy fantasy adventure"], ROLES.length);
  const placeWord = concept.title.replace(/^(The|Crown of|Ashes of|Station|Beneath|Totally)\s+/i, "").split(/\s|&/)[0];
  const characters: CharacterOutT[] = ROLES.map((r, i) => ({
    name: names[i],
    role: r.role,
    archetype: r.archetype,
    description: `${names[i]} is the ${r.role} of ${concept.title}: ${rng.pick([
      "small, stubborn and brighter than they let on",
      "warm, funny and secretly terrified of being left behind",
      "ancient, patient and carrying a centuries-old promise",
      "dazzling, competitive and always one step ahead",
      "quiet, magnetic and impossible to read",
    ])}.`,
    motivation: `Wants ${r.motive}.`,
    flaw: cap(r.flaw) + ".",
    visualNotes: `Silhouette reads at thumbnail size; signature colour ${COLORS[i]}; ${rng.pick([
      "oversized scarf",
      "lantern worn on the hip",
      "mismatched boots",
      "a cracked compass pendant",
      "a hood with ears",
    ])}.`,
    voice: rng.pick(["Bright and quick", "Low and dry", "Sing-song", "Measured, warm", "Whispered, precise"]),
    color: COLORS[i],
    relationships:
      i === 0
        ? [
            { with: names[1], kind: "best friends" },
            { with: names[2], kind: "student of" },
            { with: names[3], kind: "rivals" },
          ]
        : i === 4
          ? [{ with: names[0], kind: "nemesis" }]
          : [{ with: names[0], kind: rng.pick(["protective of", "looks up to", "competes with"]) }],
  }));

  return {
    name: concept.title,
    tagline: concept.hook,
    core: {
      logline: concept.logline,
      premise: `${concept.title} is a ${concept.genre.toLowerCase()} built from one idea: "${subjectOf(prompt)}". It follows ${names[0]} and an unlikely crew through a world with clear rules, a lovable cast and room to grow into every format.`,
      themes: rng.pickN(["Belonging", "Courage is a choice", "Small acts, big change", "Home is people", "Curiosity over fear", "Everything is connected"], 3),
      pillars: ["A cast you can draw from memory", "A world with rules kids can repeat", "Every story leaves something to collect", "Heart first, spectacle second"],
      audience: concept.audience,
      tone: concept.tone,
      comparables: concept.comparables,
      formats: concept.formats.map((f, i) => ({
        name: f,
        status: i === 0 ? "core" : i < 3 ? "planned" : "exploring",
        note: i === 0 ? "Hero format - sets the canon look and voice." : "Builds on canon v1.",
      })),
    },
    characters,
    world: {
      premise: `A world where ${subjectOf(prompt).toLowerCase()}.`,
      setting: `${placeWord}vale and the lands around it`,
      era: rng.pick(["Timeless storybook present", "The age after the Long Night", "Year 212 of the voyage", "Now, but slightly wrong"]),
      locations: [
        { name: `${placeWord} Hollow`, kind: "Home base", description: `Where the crew gathers, plans and gets things wrong.`, mood: "Safe, warm, cluttered" },
        { name: `The Glass ${rng.pick(["Pond", "Spire", "Market", "Archive"])}`, kind: "Gateway", description: "Where the ordinary world thins out.", mood: "Shimmering, uncanny" },
        { name: `${rng.pick(["Thorn", "Ash", "Static", "Gloam"])}reach`, kind: "Danger zone", description: "Territory of the antagonist.", mood: "Tense, beautiful, wrong" },
        { name: `${rng.pick(["Starfall", "Copper", "Lantern", "Echo"])} Meadow`, kind: "Wonder", description: "The place every season finale returns to.", mood: "Open, glowing" },
      ],
      rules: [
        { title: "Magic has a price", description: "Every wonder costs a memory, a promise or a favour." },
        { title: "The crew is stronger together", description: "No hero can solve the final problem alone." },
        { title: "The world remembers", description: "What characters change stays changed across every format." },
      ],
      factions: [
        { name: `The ${concept.title.split(" ").slice(-1)[0]}`, ideology: "Protect the small and the lost", description: "Our heroes and their allies." },
        { name: `The ${rng.pick(["Hollow", "Grey", "Silent", "Iron"])} Court`, ideology: "Order at any cost", description: `Followers of ${names[4]}.` },
        { name: "The Wanderers", ideology: "Belong to no one", description: "Traders, rumours and unexpected help." },
      ],
      timeline: [
        { when: "Long ago", event: "The world's first rule is written." },
        { when: "A generation ago", event: `${names[2]} makes a promise that is never kept.` },
        { when: "Season 1", event: `${names[0]} arrives and everything begins.` },
        { when: "Season 1 finale", event: `${names[4]} reveals what they lost.` },
      ],
    },
  };
}

export function mockCharacter({ idea, characters, name }: CharacterIn): CharacterOutT {
  const rng = seeded(`char:${idea}:${name}`);
  const nm = cap(keywords(idea)[0] ?? rng.pick(["Marigold", "Quince", "Hob", "Sable", "Emberly"]));
  return {
    name: nm,
    role: rng.pick(["sidekick", "wildcard", "rival", "mentor"]),
    archetype: rng.pick(["The Trickster", "The Gentle Giant", "The Inventor", "The Outsider"]),
    description: `${nm} joins ${name}: ${idea || "a newcomer with a secret"}.`,
    motivation: "Wants a place in the crew without giving up who they are.",
    flaw: rng.pick(["Talks too much.", "Collects things that aren't theirs.", "Trusts too easily."]),
    visualNotes: "Strong silhouette, one signature prop, readable at icon size.",
    voice: rng.pick(["Croaky and cheerful", "Fast and breathless", "Soft, with sudden jokes"]),
    color: rng.pick(COLORS),
    relationships: characters[0] ? [{ with: characters[0], kind: "new friend" }] : [],
  };
}

export function mockWorldExpand({ name, brief }: BriefIn): WorldExpandOutT {
  const rng = seeded(`world:${name}:${brief}`);
  return {
    locations: [
      { name: `${rng.pick(["Whisper", "Bramble", "Lumen", "Cinder"])} ${rng.pick(["Falls", "Steps", "Bazaar", "Observatory"])}`, kind: "New region", description: `A place the ${name} crew has only heard about.`, mood: rng.pick(["Hushed", "Bustling", "Windswept"]) },
    ],
    rules: [{ title: rng.pick(["Names have weight", "Nothing is ever truly lost", "Doors choose who opens them"]), description: "A rule every studio can build a story on." }],
    factions: [{ name: `The ${rng.pick(["Tinker", "Lantern", "Tide", "Moth"])} Guild`, ideology: "Trade and curiosity", description: "Neutral, useful, never quite honest." }],
  };
}

const lines = (...l: string[]) => l.join("\n");

export function mockStudio({ studio, kind, name, characters, direction }: StudioIn): StudioAssetsOutT {
  const rng = seeded(`studio:${studio}:${kind}:${name}:${direction}`);
  const [a = "The hero", b = "their best friend", c = "the mentor"] = rng.pickN(characters.length ? characters : ["The hero"], 3);
  const dir = direction ? ` Direction: ${direction}.` : "";
  const templates: Record<string, () => { title: string; summary: string; body: string; chars: string[] }> = {
    "episode outline": () => ({
      title: `${a} and the ${rng.pick(["Missing Map", "Upside-Down Day", "Borrowed Star", "Quiet Song"])}`,
      summary: `An 11-minute episode where ${a} learns that asking for help is brave.${dir}`,
      body: lines(`COLD OPEN - ${a} wakes to find something impossible.`, `ACT 1 - ${a} insists on fixing it alone; ${b} disagrees.`, `ACT 2 - It gets worse. ${c} offers a clue with a cost.`, `ACT 3 - ${a} and ${b} solve it together.`, `TAG - A small joke that seeds next week.`),
      chars: [a, b, c],
    }),
    "season arc": () => ({
      title: `Season 1: ${rng.pick(["The Long Night", "First Light", "The Lost Year"])}`,
      summary: `Twelve episodes from arrival to the first big win.${dir}`,
      body: lines("Eps 1-3: Arrival and the crew forms.", `Eps 4-6: ${a}'s secret comes out.`, `Eps 7-9: ${c}'s broken promise is revealed.`, "Eps 10-12: The crew earns the right to stay."),
      chars: [a, c],
    }),
    "pilot cold open": () => ({
      title: "Pilot - cold open",
      summary: "The first ninety seconds anyone ever sees of the franchise.",
      body: lines(`EXT. ${name.toUpperCase()} - NIGHT`, `A hush. Then a single light. ${a.toUpperCase()} steps into it.`, `${a.toUpperCase()}: Okay. Okay okay okay. Nobody panic.`, `${b.toUpperCase()} (O.S.): Who's panicking?`, "SMASH TO TITLE."),
      chars: [a, b],
    }),
    "style frame brief": () => ({
      title: `Style frame: ${a} at the threshold`,
      summary: "Key art that locks the look for every animated format.",
      body: lines("Shape language: round for heroes, angular for threat.", "Lighting: one warm source against cool ambient.", `Hero pose: ${a} mid-step, looking back at ${b}.`, "Texture: painterly backgrounds, clean character lines."),
      chars: [a, b],
    }),
    "animatic beat sheet": () => ({
      title: `Animatic: ${a}'s first jump`,
      summary: "A 60-second short in twelve boards.",
      body: lines("1-3 Establish the world in three wides.", `4-6 ${a} hesitates; ${b} cheers.`, "7-9 The leap, in slow motion.", "10-12 Landing, laugh, logo."),
      chars: [a, b],
    }),
    "short treatment": () => ({
      title: `${a} in "${rng.pick(["Tiny Trouble", "One More Minute", "The Wrong Door"])}"`,
      summary: "A dialogue-light 2-minute short built for every platform.",
      body: `${a} tries to do one simple thing. Everything goes wrong in escalating, wordless gags until ${b} shows up with exactly the wrong tool, which turns out to be exactly right.`,
      chars: [a, b],
    }),
    "main theme brief": () => ({
      title: `${name} - Main Theme`,
      summary: "A five-note motif that works as a ringtone, a lullaby and a finale.",
      body: lines("Key: D major, drifting to B minor in the bridge.", "Instrumentation: celesta, warm strings, hand percussion.", "Motif: rising fifth, falling step - 'the call home'.", "Lengths: 5s sting, 30s title, 2m full."),
      chars: [],
    }),
    leitmotif: () => ({
      title: `${a}'s leitmotif`,
      summary: `A short phrase that plays whenever ${a} chooses courage.`,
      body: "Solo woodwind, three notes up, one held. Re-harmonised in minor when the antagonist is near.",
      chars: [a],
    }),
    "song lyric": () => ({
      title: `"${rng.pick(["Stay Up With Me", "Light the Way", "We Belong Here"])}"`,
      summary: "A singalong song for the series and social.",
      body: lines("When the night gets big and the path gets small,", `${a} says we'll find the way through it all,`, "Hold your light up high, let it carry far,", "We're not lost at all - we know who we are."),
      chars: [a],
    }),
    "game concept": () => ({
      title: `${name}: ${rng.pick(["Lantern Keeper", "Hollow Builders", "Night Market"])}`,
      summary: "A cozy mobile game that extends canon rather than retelling it.",
      body: lines(`Play as ${a}, restoring the world one tile at a time.`, `Befriend ${b} and ${c} to unlock abilities.`, "Daily: tend, trade, decorate. Weekly: a story chapter.", "Monetisation: cosmetic only; no loot boxes."),
      chars: [a, b, c],
    }),
    "core loop": () => ({
      title: "Core loop",
      summary: "Explore, collect, restore, share.",
      body: "Explore a region -> collect lost things -> restore a landmark -> unlock a story beat -> share a snapshot.",
      chars: [],
    }),
    "level brief": () => ({
      title: `Level: ${rng.pick(["The Flooded Library", "Windmill Rooftops", "The Mirror Maze"])}`,
      summary: `A level teaching the world's first rule through play.`,
      body: `${a} must give up one collected memory to open each gate. The final gate needs two players.`,
      chars: [a],
    }),
    "picture book": () => ({
      title: `${a} and the ${rng.pick(["Lost Lantern", "Very Long Night", "Borrowed Moon"])}`,
      summary: "A 32-page picture book, ages 3-7.",
      body: lines(`Spread 1: ${a} can't sleep.`, `Spread 2-5: A light goes missing.`, `Spread 6-12: ${a} asks ${b} for help.`, "Spread 13-15: Together they find it, glowing, in the last place they looked.", "Spread 16: Goodnight."),
      chars: [a, b],
    }),
    "comic issue": () => ({
      title: `${name} #1`,
      summary: "A 22-page first issue.",
      body: lines("Pages 1-4: Big splash of the world.", `Pages 5-12: ${a} gets into trouble.`, `Pages 13-20: ${c} arrives too late, and just in time.`, "Pages 21-22: Cliffhanger."),
      chars: [a, c],
    }),
    "chapter outline": () => ({
      title: "Middle-grade novel, chapters 1-5",
      summary: `The novel gives ${b} the point of view.`,
      body: lines(`1. ${b} keeps a list of everything that's wrong.`, `2. ${a} arrives and ruins the list.`, "3. The first rule is broken.", `4. ${c} tells half the truth.`, "5. There is no going back."),
      chars: [a, b, c],
    }),
    "product line": () => ({
      title: `${name} hero plush line`,
      summary: "Five plush at three sizes; glow-in-the-dark accents.",
      body: lines(...characters.slice(0, 5).map((ch) => `- ${ch}: 8in / 12in / 24in, signature prop included`), "Target retail: $14.99 / $24.99 / $49.99"),
      chars: characters.slice(0, 5),
    }),
    "licensing deck": () => ({
      title: "Licensing categories, year one",
      summary: "Where the IP earns its keep without diluting canon.",
      body: lines("Tier 1: plush, picture books, apparel.", "Tier 2: stationery, bedding, puzzles.", "Tier 3: theme-park meetups, food partnerships.", "Guardrails: every product must use canon art and approved names."),
      chars: [],
    }),
    "toy brief": () => ({
      title: `${a}'s ${rng.pick(["lantern", "compass", "satchel"])} - role-play toy`,
      summary: "A prop kids already want after episode one.",
      body: "Lights up, makes the theme's first five notes, fits a 5-year-old's hand.",
      chars: [a],
    }),
    "logo brief": () => ({
      title: `${name} wordmark`,
      summary: "A wordmark that works at app-icon size and on a cinema screen.",
      body: "Hand-drawn rounded letterforms, one letter replaced by the franchise's signature object. Must survive one-colour print.",
      chars: [],
    }),
    "style guide": () => ({
      title: "Brand style guide v1",
      summary: "Colour, type and layout rules every studio follows.",
      body: lines("Primary: deep night blue. Accent: lantern gold.", "Display type: rounded serif. Body: humanist sans.", "Characters are never cropped at the eyes.", "Always leave room for the light."),
      chars: [],
    }),
    "brand voice": () => ({
      title: "Brand voice",
      summary: "How the franchise talks, everywhere.",
      body: lines("Warm, never saccharine.", "Curious, never smug.", "Funny with, never funny at.", `Sample: "Lost something? So did ${a}. Let's look together."`),
      chars: [a],
    }),
    "positioning memo": () => ({
      title: `Why ${name}, why now`,
      summary: "The one-page thesis for partners and investors.",
      body: lines("Audience gap: families want gentle adventure that respects kids' intelligence.", "Unfair advantage: a rule-based world that scales to games and toys.", "First proof point: 30 days of shorts to validate the cast."),
      chars: [],
    }),
    "pitch one-pager": () => ({
      title: `${name} - pitch one-pager`,
      summary: "Logline, cast, world, formats - on one page.",
      body: `${name}. ${a}, ${b} and ${c}. One world, a dozen ways in.`,
      chars: [a, b, c],
    }),
    "format roadmap": () => ({
      title: "Format roadmap, 24 months",
      summary: "What ships when, and why in that order.",
      body: lines("Q1: shorts + social", "Q2: picture book + plush", "Q3: series pilot", "Q4: mobile game soft launch", "Year 2: series season 1, licensing tier 2"),
      chars: [],
    }),
    "character sheet": () => ({
      title: `${a} - model sheet`,
      summary: "Front, side, back, expressions.",
      body: "Six expressions: delight, doubt, determination, sulk, awe, laugh.",
      chars: [a],
    }),
    "voice guide": () => ({
      title: `${a} & ${b} - voice guide`,
      summary: "How each character sounds on the page.",
      body: `${a}: short sentences, questions. ${b}: long sentences, jokes at the end.`,
      chars: [a, b],
    }),
    "turnaround brief": () => ({
      title: `${c} - turnaround brief`,
      summary: "Brief for the 3D team.",
      body: "Five angles, neutral pose, prop separated.",
      chars: [c],
    }),
    "location bible": () => ({
      title: `${name} - location bible`,
      summary: "Every canon place with its rules and moods.",
      body: "Home base, gateway, danger zone and wonder; each with a sound, a smell and a rule.",
      chars: [],
    }),
    "lore entry": () => ({
      title: `Lore: ${rng.pick(["The First Promise", "Why the Lights Drift", "The Night Nobody Slept"])}`,
      summary: "An in-world legend the cast half-remembers.",
      body: `They say ${c} was there. They say ${c} won't talk about it.`,
      chars: [c],
    }),
    "map brief": () => ({
      title: "World map brief",
      summary: "Illustrated map for books, the game and the website.",
      body: "Hand-drawn, north at top, home base in the warm centre, danger to the cold east.",
      chars: [],
    }),
  };
  const make =
    templates[kind] ??
    (() => ({ title: `${cap(kind)} for ${name}`, summary: `A ${kind} built from canon.${dir}`, body: `${a}, ${b} and ${c} in a new ${kind}.`, chars: [a, b, c] }));
  const out = make();
  return { assets: [{ kind, title: out.title, summary: out.summary, body: out.body, characters: out.chars }] };
}

const PLATFORMS = ["TikTok", "Instagram", "YouTube Shorts", "X"] as const;

export function mockSocial({ name, characters }: BriefIn): SocialOutT {
  const rng = seeded(`social:${name}:${characters.join(",")}`);
  const formats = ["Character intro", "Lore drop", "Behind the scenes", "Poll", "Mini-episode", "Sound trend", "Fan question"];
  const days = [1, 3, 5, 8, 10, 12, 15, 17, 19, 22, 25, 28];
  return {
    posts: days.map((day, i) => {
      const ch = characters.length ? characters[i % characters.length] : name;
      const format = formats[i % formats.length];
      return {
        platform: PLATFORMS[i % PLATFORMS.length],
        format,
        day,
        hook: rng.pick([
          `POV: you just met ${ch}`,
          `${ch} has one rule. Guess it.`,
          `Nobody in ${name} talks about this`,
          `Rate ${ch}'s plan 1-10`,
          `The sound ${ch} makes when they're scared`,
        ]),
        caption: `${format}: ${ch} in ${name}. ${rng.pick(["Drop your theory below.", "Which crew are you?", "Part 2 tomorrow.", "Turn the sound on."])}`,
        hashtags: [`#${name.replace(/[^A-Za-z0-9]/g, "")}`, "#animation", rng.pick(["#cozy", "#lore", "#originalcharacter", "#storytime"])],
        characters: characters.length ? [ch] : [],
      };
    }),
  };
}

export function mockDirector({ name, objective }: DirectorIn): DirectorOutT {
  return {
    objective: objective || `Take ${name} from canon v1 to a proven audience in 90 days.`,
    phases: [
      {
        name: "Weeks 1-2 - Lock the foundation",
        tasks: [
          { studio: "brand", title: "Logo and style guide", deliverable: "style guide" },
          { studio: "characters", title: "Model sheets for the hero cast", deliverable: "character sheet" },
          { studio: "vault", title: "File core trademarks", deliverable: "trademark filings" },
        ],
      },
      {
        name: "Weeks 3-6 - Find the audience",
        tasks: [
          { studio: "social", title: "30-day launch calendar", deliverable: "short-form post" },
          { studio: "animation", title: "First 60-second short", deliverable: "animatic beat sheet" },
          { studio: "music", title: "Main theme", deliverable: "main theme brief" },
        ],
      },
      {
        name: "Weeks 7-12 - Expand the slate",
        tasks: [
          { studio: "story", title: "Season 1 arc", deliverable: "season arc" },
          { studio: "publishing", title: "Picture book", deliverable: "picture book" },
          { studio: "games", title: "Game concept", deliverable: "game concept" },
          { studio: "merch", title: "Hero plush line", deliverable: "product line" },
        ],
      },
    ],
  };
}
