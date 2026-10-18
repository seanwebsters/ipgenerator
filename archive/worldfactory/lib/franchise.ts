import type {
  AgentKey,
  Approval,
  Asset,
  Character,
  Concept,
  Franchise,
  StudioKey,
  VaultRecord,
} from "./types";
import type { CharacterOutT, ConceptOutT, DevelopOutT, DirectorOutT, SocialOutT, StudioAssetsOutT, WorldExpandOutT } from "./ai/schemas";
import { AGENTS, STUDIO_BY_KEY } from "./studios";
import { clamp, hashString, nowIso, seeded, slug, uid } from "./util";

/* ---------- construction ---------- */

export function conceptFromOut(c: ConceptOutT): Concept {
  return { ...c, id: uid("concept"), palette: c.palette.slice(0, 4) };
}

function characterFromOut(c: CharacterOutT): Character {
  return {
    id: uid("char"),
    name: c.name,
    role: c.role,
    archetype: c.archetype,
    description: c.description,
    motivation: c.motivation,
    flaw: c.flaw,
    visualNotes: c.visualNotes,
    voice: c.voice,
    color: /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : "#a78bfa",
    relationships: [],
    revision: 1,
  };
}

/** Resolve relationships that reference characters by name into ids. */
function linkRelationships(chars: Character[], outs: CharacterOutT[]) {
  const byName = new Map(chars.map((c) => [c.name.toLowerCase(), c.id]));
  outs.forEach((o, i) => {
    chars[i].relationships = o.relationships
      .map((r) => ({ characterId: byName.get(r.with.toLowerCase()) ?? "", kind: r.kind }))
      .filter((r) => r.characterId && r.characterId !== chars[i].id);
  });
}

export function franchiseFromDevelopment(
  prompt: string,
  concept: Concept,
  alternates: Concept[],
  dev: DevelopOutT,
): Franchise {
  const characters = dev.characters.map(characterFromOut);
  linkRelationships(characters, dev.characters);
  const at = nowIso();
  const f: Franchise = {
    id: uid("fr"),
    name: dev.name,
    tagline: dev.tagline,
    prompt,
    createdAt: at,
    updatedAt: at,
    stage: "development",
    concept,
    alternates,
    core: dev.core,
    characters,
    world: {
      premise: dev.world.premise,
      setting: dev.world.setting,
      era: dev.world.era,
      locations: dev.world.locations.map((l) => ({ ...l, id: uid("loc") })),
      rules: dev.world.rules.map((r) => ({ ...r, id: uid("rule") })),
      factions: dev.world.factions.map((x) => ({ ...x, id: uid("fac") })),
      timeline: dev.world.timeline.map((t) => ({ ...t, id: uid("tl") })),
    },
    assets: [],
    vault: [],
    canon: { version: 0, history: [] },
    approvals: [],
    plan: null,
    activity: [],
  };
  log(f, "director", `Creative development finished for "${f.name}". Awaiting your greenlight.`);
  return f;
}

/* ---------- canon ---------- */

export function canonHash(f: Franchise): string {
  const snapshot = JSON.stringify({ core: f.core, characters: f.characters, world: f.world });
  // Two FNV passes with different salts -> 16 hex chars, enough for a readable ledger id.
  return hashString(snapshot) + hashString("wf:" + snapshot);
}

export function bumpCanon(f: Franchise, author: string, summary: string, changes: string[]) {
  const version = f.canon.version + 1;
  f.canon.version = version;
  f.canon.history.unshift({ version, createdAt: nowIso(), author, summary, changes, hash: canonHash(f) });
  f.updatedAt = nowIso();
}

export function greenlight(f: Franchise) {
  f.stage = "canon";
  bumpCanon(f, "You", "Greenlit to canon", [
    `${f.characters.length} characters`,
    `${f.world.locations.length} locations, ${f.world.rules.length} rules`,
    `${f.core.formats.length} formats planned`,
  ]);
  f.vault = seedVault(f);
  log(f, "vault", `Canon v1 hashed into the IP Vault (${f.canon.history[0].hash.slice(0, 8)}).`);
  log(f, "director", `"${f.name}" is canon. Ask me for a plan to start the slate.`);
}

/**
 * Commit a change to a canon entity. Every downstream asset that depends on
 * the entity is flagged for review and queued for the owning department.
 */
export function commitEntityChange(f: Franchise, entityId: string, label: string, changes: string[]): number {
  if (f.canon.version === 0) {
    f.updatedAt = nowIso();
    return 0;
  }
  bumpCanon(f, "You", `Edited ${label}`, changes);
  let flagged = 0;
  for (const a of f.assets) {
    if (!a.dependsOn.includes(entityId) || a.status === "draft") continue;
    a.status = "needs_review";
    a.reviewReason = `${label} changed in canon v${f.canon.version}: ${changes.join("; ")}`;
    flagged++;
    f.approvals = f.approvals.filter((p) => !(p.refId === a.id && p.status === "pending"));
    f.approvals.unshift(
      approval(a.studio, "review", `Review "${a.title}"`, `${label} changed (${changes.join("; ")}). Check this ${a.kind} still matches canon.`, a.id),
    );
  }
  if (flagged) log(f, "director", `${label} changed. ${flagged} downstream asset${flagged === 1 ? "" : "s"} flagged for review.`);
  return flagged;
}

const CHARACTER_FIELDS: (keyof Character)[] = ["name", "role", "archetype", "description", "motivation", "flaw", "visualNotes", "voice", "color"];

export function updateCharacter(f: Franchise, next: Character): number {
  const idx = f.characters.findIndex((c) => c.id === next.id);
  if (idx < 0) return 0;
  const prev = f.characters[idx];
  const changes = CHARACTER_FIELDS.filter((k) => prev[k] !== next[k]).map((k) =>
    k === "name" ? `renamed ${prev.name} -> ${next.name}` : `${k} updated`,
  );
  if (!changes.length) return 0;
  f.characters[idx] = { ...next, revision: prev.revision + 1 };
  return commitEntityChange(f, next.id, prev.name, changes);
}

export function addCharacter(f: Franchise, out: CharacterOutT): Character {
  const c = characterFromOut(out);
  const byName = new Map(f.characters.map((x) => [x.name.toLowerCase(), x.id]));
  c.relationships = out.relationships
    .map((r) => ({ characterId: byName.get(r.with.toLowerCase()) ?? "", kind: r.kind }))
    .filter((r) => r.characterId);
  f.characters.push(c);
  if (f.canon.version > 0) bumpCanon(f, "Juno (Character Lead)", `Added ${c.name}`, [`new ${c.role}`]);
  log(f, "characters", `Added ${c.name} to the cast.`);
  return c;
}

export function addWorld(f: Franchise, out: WorldExpandOutT) {
  f.world.locations.push(...out.locations.map((l) => ({ ...l, id: uid("loc") })));
  f.world.rules.push(...out.rules.map((r) => ({ ...r, id: uid("rule") })));
  f.world.factions.push(...out.factions.map((x) => ({ ...x, id: uid("fac") })));
  const names = [...out.locations, ...out.factions].map((x) => x.name);
  if (f.canon.version > 0) bumpCanon(f, "Mercator (World Architect)", "Expanded the world", names);
  log(f, "world", `Expanded the world: ${names.join(", ")}.`);
}

/* ---------- assets & approvals ---------- */

function approval(studio: StudioKey, kind: Approval["kind"], title: string, description: string, refId: string): Approval {
  return { id: uid("apr"), createdAt: nowIso(), agent: studio, studio, kind, title, description, refId, status: "pending" };
}

function idsForNames(f: Franchise, names: string[]): string[] {
  const set = new Set(names.map((n) => n.toLowerCase()));
  return f.characters.filter((c) => set.has(c.name.toLowerCase())).map((c) => c.id);
}

export function addStudioAssets(f: Franchise, studio: StudioKey, out: StudioAssetsOutT, taskId?: string): Asset[] {
  const created = out.assets.map<Asset>((a) => ({
    id: uid("asset"),
    studio,
    kind: a.kind,
    title: a.title,
    summary: a.summary,
    body: a.body,
    dependsOn: idsForNames(f, a.characters),
    status: "pending",
    canonVersion: f.canon.version,
    createdAt: nowIso(),
  }));
  f.assets.unshift(...created);
  for (const a of created) {
    f.approvals.unshift(approval(studio, "asset", a.title, `${AGENTS[studio].name} delivered a ${a.kind}: ${a.summary}`, a.id));
    if (taskId) markTask(f, taskId, "awaiting_approval", a.id);
  }
  log(f, studio, `Delivered ${created.map((a) => `"${a.title}"`).join(", ")} for approval.`);
  f.updatedAt = nowIso();
  return created;
}

export function addSocialPosts(f: Franchise, out: SocialOutT): Asset[] {
  const created = out.posts.map<Asset>((p) => ({
    id: uid("post"),
    studio: "social",
    kind: "short-form post",
    title: p.hook,
    summary: p.caption,
    body: `${p.hook}\n\n${p.caption}\n\n${p.hashtags.join(" ")}`,
    dependsOn: idsForNames(f, p.characters),
    status: "pending",
    canonVersion: f.canon.version,
    createdAt: nowIso(),
    meta: { platform: p.platform, format: p.format, day: clamp(p.day, 1, 30), hashtags: p.hashtags },
  }));
  f.assets.unshift(...created);
  for (const a of created.slice().reverse())
    f.approvals.unshift(approval("social", "asset", a.title, `Pulse scheduled a ${a.meta?.platform} ${a.meta?.format} for day ${a.meta?.day}.`, a.id));
  log(f, "social", `Planned a ${created.length}-post launch calendar.`);
  f.updatedAt = nowIso();
  return created;
}

export function markTask(f: Franchise, taskId: string, status: "awaiting_approval" | "done", assetId?: string) {
  for (const ph of f.plan?.phases ?? [])
    for (const t of ph.tasks)
      if (t.id === taskId) {
        t.status = status;
        if (assetId) t.assetId = assetId;
      }
}

export function decideApproval(f: Franchise, approvalId: string, decision: "approved" | "rejected") {
  const ap = f.approvals.find((a) => a.id === approvalId);
  if (!ap || ap.status !== "pending") return;
  ap.status = decision;
  const ids = ap.refId.split(",");
  for (const a of f.assets) {
    if (!ids.includes(a.id)) continue;
    if (decision === "approved") {
      a.status = "approved";
      a.canonVersion = f.canon.version;
      delete a.reviewReason;
    } else {
      a.status = "draft";
    }
  }
  for (const ph of f.plan?.phases ?? [])
    for (const t of ph.tasks)
      if (t.assetId && ids.includes(t.assetId)) t.status = decision === "approved" ? "done" : "queued";
  const verb = ap.kind === "review" ? (decision === "approved" ? "confirmed consistent with canon" : "sent back for rework") : decision;
  log(f, "you", `${cap(verb)}: ${ap.title}`);
  f.updatedAt = nowIso();
}

/** Approve or reject an asset directly, resolving its queue item if there is one. */
export function decideAsset(f: Franchise, assetId: string, decision: "approved" | "rejected") {
  const ap = f.approvals.find((a) => a.status === "pending" && a.refId.split(",").includes(assetId));
  if (ap) return decideApproval(f, ap.id, decision);
  const a = f.assets.find((x) => x.id === assetId);
  if (!a) return;
  a.status = decision === "approved" ? "approved" : "draft";
  if (decision === "approved") {
    a.canonVersion = f.canon.version;
    delete a.reviewReason;
  }
}

export function setAssetStatus(f: Franchise, assetId: string, status: Asset["status"]) {
  const a = f.assets.find((x) => x.id === assetId);
  if (a) a.status = status;
}

/* ---------- director ---------- */

export function applyPlan(f: Franchise, out: DirectorOutT) {
  f.plan = {
    objective: out.objective,
    createdAt: nowIso(),
    phases: out.phases.map((p) => ({
      name: p.name,
      tasks: p.tasks.map((t) => ({ id: uid("task"), studio: t.studio, title: t.title, deliverable: t.deliverable, status: "queued" as const })),
    })),
  };
  if (f.stage === "canon") f.stage = "expansion";
  const count = f.plan.phases.reduce((n, p) => n + p.tasks.length, 0);
  log(f, "director", `New plan: ${count} tasks across ${f.plan.phases.length} phases.`);
}

/* ---------- brief / log ---------- */

export function briefOf(f: Franchise) {
  const chars = f.characters.map((c) => `- ${c.name} (${c.role}, ${c.archetype}): ${c.description} Wants: ${c.motivation} Flaw: ${c.flaw}`).join("\n");
  const locs = f.world.locations.map((l) => `- ${l.name}: ${l.description}`).join("\n");
  const rules = f.world.rules.map((r) => `- ${r.title}: ${r.description}`).join("\n");
  const brief = `${f.name} - ${f.tagline}\nLogline: ${f.core.logline}\nTone: ${f.core.tone}. Audience: ${f.core.audience}.\nCharacters:\n${chars}\nLocations:\n${locs}\nRules:\n${rules}`;
  return { brief, name: f.name, characters: f.characters.map((c) => c.name) };
}

export function log(f: Franchise, agent: AgentKey | "you", text: string) {
  f.activity.unshift({ id: uid("act"), at: nowIso(), agent, text });
  f.activity = f.activity.slice(0, 80);
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- vault ---------- */

export function seedVault(f: Franchise): VaultRecord[] {
  const at = nowIso();
  const rec = (r: Omit<VaultRecord, "id" | "updatedAt">): VaultRecord => ({ ...r, id: uid("vault"), updatedAt: at });
  const hero = f.characters[0];
  return [
    rec({ kind: "trademark", title: f.name, jurisdiction: "US (USPTO)", classes: "9, 16, 25, 28, 41", status: "cleared", notes: "Word mark. Knock-out search clear in core classes." }),
    rec({ kind: "trademark", title: f.name, jurisdiction: "EU (EUIPO)", classes: "9, 16, 25, 28, 41", status: "idea", notes: "File within 6 months of US for priority." }),
    ...(hero ? [rec({ kind: "trademark", title: hero.name, jurisdiction: "US (USPTO)", classes: "28", status: "idea", notes: "Hero character name for toys." })] : []),
    rec({ kind: "copyright", title: `${f.name} series bible (canon v1)`, jurisdiction: "US Copyright Office", classes: "Literary work", status: "idea", notes: "Register once canon is stable." }),
    rec({ kind: "domain", title: `${slug(f.name)}.com`, jurisdiction: "Global", classes: "-", status: "cleared", notes: "Available at time of check (simulated)." }),
    rec({ kind: "chain-of-title", title: "Creator assignment & AI-assist disclosure", jurisdiction: "Contract", classes: "-", status: "idea", notes: "Document human authorship of canon decisions and AI assistance." }),
  ];
}

/** Simulated name clearance: deterministic risk score. Not legal advice. */
export function clearanceCheck(name: string) {
  const r = seeded(`clear:${name.toLowerCase()}`);
  const risk = r.int(4, 62);
  const level = risk < 20 ? "low" : risk < 45 ? "medium" : "high";
  return {
    risk,
    level,
    notes:
      level === "low"
        ? "No close marks found in the simulated index."
        : level === "medium"
          ? "Similar marks exist in adjacent classes. Consider a distinctive logo."
          : "Close marks in core classes. Consider a variant name.",
  };
}

/* ---------- genome ---------- */

export interface Gene {
  key: string;
  label: string;
  value: number;
  note: string;
}

export function genome(f: Franchise): { genes: Gene[]; lineage: { title: string; match: number }[]; signature: string } {
  const r = seeded(`genome:${f.id}:${f.canon.version}`);
  const text = `${f.core.tone} ${f.concept.genre} ${f.core.themes.join(" ")}`.toLowerCase();
  const has = (...w: string[]) => w.some((x) => text.includes(x));
  const s = f.concept.scores;
  const g = (key: string, label: string, base: number, note: string): Gene => ({ key, label, value: clamp(Math.round(base + r.int(-6, 6)), 5, 99), note });
  const genes = [
    g("wonder", "Wonder", has("wond", "fantasy", "magic", "myth") ? 86 : 60, "How much awe each story delivers"),
    g("heart", "Heart", has("warm", "heart", "belong", "home", "kind") ? 88 : 62, "Emotional pull of the cast"),
    g("humor", "Humour", has("funny", "comedy", "chaotic") ? 85 : 50, "Laugh density"),
    g("peril", "Peril", has("danger", "epic", "thriller", "eerie") ? 78 : 45, "Stakes and threat"),
    g("mystery", "Mystery", has("myster", "secret", "clever", "eerie") ? 82 : 55, "Questions that keep audiences coming back"),
    g("scale", "World scale", 40 + f.world.locations.length * 6 + f.world.factions.length * 4, "Room for new stories"),
    g("collect", "Collectibility", s.merchability, "Toy, card and plush potential"),
    g("play", "Playability", 45 + f.world.rules.length * 9, "Rules that become game systems"),
  ];
  const lineage = f.core.comparables.map((title, i) => ({ title, match: clamp(78 - i * 11 + r.int(-5, 5), 20, 95) }));
  const signature = genes.map((x) => "ACGT"[x.value % 4]).join("") + "-" + canonHash(f).slice(0, 6).toUpperCase();
  return { genes, lineage, signature };
}

/* ---------- simulator ---------- */

export interface SimParams {
  budget: number; // $k per month
  cadence: number; // posts per week
  hero: string; // lead format
  months: number;
}

export interface SimResult {
  audience: number[];
  revenue: { stream: string; value: number }[];
  totalRevenue: number;
  totalCost: number;
  breakevenMonth: number | null;
}

export function simulate(f: Franchise, p: SimParams): SimResult {
  const gen = genome(f).genes;
  const avg = gen.reduce((n, x) => n + x.value, 0) / gen.length / 100;
  const formatBoost: Record<string, number> = { series: 1.35, film: 1.25, game: 1.2, short: 1.15, book: 0.9 };
  const boost = Object.entries(formatBoost).find(([k]) => p.hero.toLowerCase().includes(k))?.[1] ?? 1;
  const audience: number[] = [];
  let a = 2000 * (0.5 + avg);
  for (let m = 0; m < p.months; m++) {
    const growth = 1 + (0.04 + p.cadence * 0.012 + p.budget * 0.0009) * avg * boost * Math.exp(-m / 30);
    a = a * growth + p.budget * 40 * avg;
    audience.push(Math.round(a));
  }
  const reach = audience[audience.length - 1];
  const collect = gen.find((x) => x.key === "collect")!.value / 100;
  const play = gen.find((x) => x.key === "play")!.value / 100;
  const revenue = [
    { stream: "Licensing & merch", value: reach * 1.6 * collect },
    { stream: "Streaming & series", value: reach * 0.9 * boost },
    { stream: "Games", value: reach * 0.8 * play },
    { stream: "Publishing", value: reach * 0.45 },
    { stream: "Social & ads", value: reach * 0.12 * p.cadence },
  ].map((x) => ({ ...x, value: Math.round(x.value) }));
  const totalRevenue = revenue.reduce((n, x) => n + x.value, 0);
  const totalCost = p.budget * 1000 * p.months;
  // Revenue ramps with audience; find first month cumulative revenue covers cumulative cost.
  const sumAud = audience.reduce((n, x) => n + x, 0);
  let cumRev = 0;
  let breakevenMonth: number | null = null;
  for (let m = 0; m < p.months; m++) {
    cumRev += (totalRevenue * audience[m]) / sumAud;
    if (breakevenMonth === null && cumRev >= p.budget * 1000 * (m + 1)) breakevenMonth = m + 1;
  }
  return { audience, revenue, totalRevenue, totalCost, breakevenMonth };
}

/* ---------- bible ---------- */

export function bibleMarkdown(f: Franchise): string {
  const L: string[] = [];
  const latest = f.canon.history[0];
  L.push(`# ${f.name} - IP Bible`, "", `> ${f.tagline}`, "");
  L.push(`Canon v${f.canon.version}${latest ? ` - ledger hash \`${latest.hash}\`` : ""} - exported ${new Date().toISOString().slice(0, 10)}`, "");
  L.push("## Core", "", `**Logline.** ${f.core.logline}`, "", f.core.premise, "");
  L.push(`**Audience.** ${f.core.audience}  `, `**Tone.** ${f.core.tone}  `, `**Comparables.** ${f.core.comparables.join(", ")}`, "");
  L.push("**Themes**", ...f.core.themes.map((t) => `- ${t}`), "", "**Pillars**", ...f.core.pillars.map((t) => `- ${t}`), "");
  L.push("**Formats**", ...f.core.formats.map((x) => `- ${x.name} (${x.status}) - ${x.note}`), "");
  L.push("## Characters", "");
  for (const c of f.characters) {
    L.push(`### ${c.name} - ${c.role}`, "", `*${c.archetype}.* ${c.description}`, "", `- **Wants:** ${c.motivation}`, `- **Flaw:** ${c.flaw}`, `- **Look:** ${c.visualNotes}`, `- **Voice:** ${c.voice}`);
    const rel = c.relationships.map((r) => `${f.characters.find((x) => x.id === r.characterId)?.name ?? "?"} (${r.kind})`);
    if (rel.length) L.push(`- **Relationships:** ${rel.join(", ")}`);
    L.push("");
  }
  L.push("## World", "", f.world.premise, "", `**Setting.** ${f.world.setting}. **Era.** ${f.world.era}.`, "");
  L.push("### Locations", ...f.world.locations.map((l) => `- **${l.name}** (${l.kind}) - ${l.description} *Mood: ${l.mood}.*`), "");
  L.push("### Rules", ...f.world.rules.map((r) => `- **${r.title}.** ${r.description}`), "");
  L.push("### Factions", ...f.world.factions.map((x) => `- **${x.name}** - ${x.ideology}. ${x.description}`), "");
  L.push("### Timeline", ...f.world.timeline.map((t) => `- **${t.when}:** ${t.event}`), "");
  const approved = f.assets.filter((a) => a.status === "approved");
  if (approved.length) {
    L.push("## Approved assets", "");
    for (const a of approved) L.push(`- **${STUDIO_BY_KEY[a.studio].name} / ${a.kind}:** ${a.title} - ${a.summary}`);
    L.push("");
  }
  L.push("## Canon history", ...f.canon.history.map((h) => `- v${h.version} (${h.createdAt.slice(0, 10)}, ${h.author}): ${h.summary} - \`${h.hash.slice(0, 12)}\``), "");
  L.push("## Rights", ...f.vault.map((v) => `- ${v.kind}: ${v.title} - ${v.jurisdiction} - ${v.status}`), "");
  return L.join("\n");
}
