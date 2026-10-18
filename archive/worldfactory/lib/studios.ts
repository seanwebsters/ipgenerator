import type { AgentKey, StudioKey } from "./types";

export interface StudioDef {
  key: StudioKey;
  name: string;
  short: string;
  blurb: string;
  icon: string;
  accent: string;
  depth: "full" | "light";
  /** Asset kinds a department agent can produce in this studio. */
  kinds: string[];
}

export const STUDIOS: StudioDef[] = [
  {
    key: "ip-lab",
    name: "IP Lab",
    short: "Concept, positioning and the franchise thesis",
    blurb: "Pressure-test the core idea, define pillars and plan every format the IP can live in.",
    icon: "FlaskConical",
    accent: "#a78bfa",
    depth: "full",
    kinds: ["positioning memo", "pitch one-pager", "format roadmap"],
  },
  {
    key: "characters",
    name: "Character Studio",
    short: "Cast, arcs, voices and relationships",
    blurb: "Build a cast with motivations, flaws, visual language and a relationship web that stays canon.",
    icon: "Users",
    accent: "#f472b6",
    depth: "full",
    kinds: ["character sheet", "voice guide", "turnaround brief"],
  },
  {
    key: "world",
    name: "World Builder",
    short: "Places, rules, factions and history",
    blurb: "Map the world, write the rules it obeys and keep a timeline every studio can build on.",
    icon: "Globe",
    accent: "#34d399",
    depth: "full",
    kinds: ["location bible", "lore entry", "map brief"],
  },
  {
    key: "story",
    name: "Story Room",
    short: "Series, episodes and scripts",
    blurb: "Break seasons, outline episodes and draft pilot pages from canon.",
    icon: "BookOpenText",
    accent: "#fbbf24",
    depth: "light",
    kinds: ["episode outline", "season arc", "pilot cold open"],
  },
  {
    key: "social",
    name: "Social Studio",
    short: "Shorts, posts and a living content calendar",
    blurb: "Turn canon into a 30-day calendar of platform-native shorts and posts that build an audience.",
    icon: "Megaphone",
    accent: "#f87171",
    depth: "full",
    kinds: ["short-form post"],
  },
  {
    key: "animation",
    name: "Animation Studio",
    short: "Style frames, animatics and shorts",
    blurb: "Lock a visual style and storyboard the first animated shorts.",
    icon: "Clapperboard",
    accent: "#60a5fa",
    depth: "light",
    kinds: ["style frame brief", "animatic beat sheet", "short treatment"],
  },
  {
    key: "music",
    name: "Music & Sound",
    short: "Themes, leitmotifs and sonic identity",
    blurb: "Compose a main theme, character leitmotifs and a sound palette.",
    icon: "AudioLines",
    accent: "#2dd4bf",
    depth: "light",
    kinds: ["main theme brief", "leitmotif", "song lyric"],
  },
  {
    key: "games",
    name: "Game Studio",
    short: "Playable worlds and core loops",
    blurb: "Design game concepts, core loops and progression systems that fit the IP.",
    icon: "Gamepad2",
    accent: "#818cf8",
    depth: "light",
    kinds: ["game concept", "core loop", "level brief"],
  },
  {
    key: "publishing",
    name: "Publishing House",
    short: "Books, comics and serials",
    blurb: "Develop picture books, comics and middle-grade serials.",
    icon: "Library",
    accent: "#fb923c",
    depth: "light",
    kinds: ["picture book", "comic issue", "chapter outline"],
  },
  {
    key: "merch",
    name: "Merch & Licensing",
    short: "Products, partners and licensing",
    blurb: "Plan product lines, licensing categories and partner pitches.",
    icon: "Shirt",
    accent: "#e879f9",
    depth: "light",
    kinds: ["product line", "licensing deck", "toy brief"],
  },
  {
    key: "brand",
    name: "Brand Studio",
    short: "Identity, voice and style guide",
    blurb: "Name, logo brief, typography, colour and a brand voice the whole franchise shares.",
    icon: "Palette",
    accent: "#facc15",
    depth: "light",
    kinds: ["logo brief", "style guide", "brand voice"],
  },
  {
    key: "vault",
    name: "IP Vault",
    short: "Rights, protection and the canon ledger",
    blurb: "Track trademarks, copyrights and chain of title, and keep a hashed ledger of every canon version.",
    icon: "ShieldCheck",
    accent: "#94a3b8",
    depth: "full",
    kinds: [],
  },
];

export const STUDIO_BY_KEY: Record<StudioKey, StudioDef> = Object.fromEntries(
  STUDIOS.map((s) => [s.key, s]),
) as Record<StudioKey, StudioDef>;

export interface AgentDef {
  key: AgentKey;
  name: string;
  title: string;
  focus: string;
}

export const AGENTS: Record<AgentKey, AgentDef> = {
  director: { key: "director", name: "Atlas", title: "Studio Director", focus: "Plans the slate, routes work and guards canon." },
  "ip-lab": { key: "ip-lab", name: "Nova", title: "IP Strategist", focus: "Positioning, audience and format strategy." },
  characters: { key: "characters", name: "Juno", title: "Character Lead", focus: "Cast, arcs and voice consistency." },
  world: { key: "world", name: "Mercator", title: "World Architect", focus: "Geography, rules and lore." },
  story: { key: "story", name: "Quill", title: "Head Writer", focus: "Seasons, episodes and scripts." },
  social: { key: "social", name: "Pulse", title: "Social Producer", focus: "Shorts, hooks and the content calendar." },
  animation: { key: "animation", name: "Frame", title: "Animation Director", focus: "Style frames and animatics." },
  music: { key: "music", name: "Cadence", title: "Composer", focus: "Themes, leitmotifs and sound." },
  games: { key: "games", name: "Pixel", title: "Game Designer", focus: "Core loops and playable worlds." },
  publishing: { key: "publishing", name: "Folio", title: "Editor-in-Chief", focus: "Books, comics and serials." },
  merch: { key: "merch", name: "Mint", title: "Licensing Lead", focus: "Products and partners." },
  brand: { key: "brand", name: "Prism", title: "Brand Director", focus: "Identity and voice." },
  vault: { key: "vault", name: "Ledger", title: "Rights Counsel", focus: "Protection and chain of title." },
};

export const PIPELINE = [
  { key: "discovery", name: "Discovery", text: "One prompt becomes five distinct franchise concepts, scored for originality, market and reach." },
  { key: "development", name: "Creative development", text: "Department agents build the core, cast and world for the concept you pick." },
  { key: "canon", name: "Greenlight to canon", text: "You approve. The bible becomes canon v1, hashed into the IP Vault." },
  { key: "expansion", name: "Expansion", text: "The Studio Director plans the slate; every studio builds from the same canon." },
] as const;
