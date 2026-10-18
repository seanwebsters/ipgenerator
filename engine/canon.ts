import { createHash } from "node:crypto";
import { db, Prisma } from "../lib/db";
import type { EntityType } from "../generated/prisma/client";
import { slugify } from "../lib/util";
import type { Bible } from "./tasks/ip";
import type { CanonDigest, PilotScript } from "./tasks/production";

/**
 * Canonical IP graph operations. Every department reads canon through
 * canonDigest(); writes go through establishBible() (v1) or applyChange()
 * (later versions), both of which validate, version and hash.
 */

export interface ValidationIssue {
  severity: "error" | "warning";
  message: string;
}

export function validateBible(b: Bible): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const names = b.characters.map((c) => c.name.trim().toLowerCase());
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  if (dupes.length) issues.push({ severity: "error", message: `Duplicate character names: ${[...new Set(dupes)].join(", ")}` });
  if (b.characters.length < 2) issues.push({ severity: "error", message: "A franchise needs at least two characters." });
  for (const c of b.characters) {
    if (!/^#[0-9a-f]{6}$/i.test(c.color)) issues.push({ severity: "warning", message: `${c.name} has an invalid colour "${c.color}"; using a default.` });
    for (const r of c.relationships)
      if (!names.includes(r.with.trim().toLowerCase())) issues.push({ severity: "warning", message: `${c.name}'s relationship target "${r.with}" is not a canon character; dropped.` });
  }
  if (!b.locations.length) issues.push({ severity: "error", message: "At least one location is required." });
  return issues;
}

export async function canonHash(franchiseId: string): Promise<string> {
  const entities = await db.canonEntity.findMany({
    where: { franchiseId, status: "ESTABLISHED" },
    orderBy: [{ type: "asc" }, { slug: "asc" }],
    select: { type: true, slug: true, name: true, data: true, revision: true },
  });
  return createHash("sha256").update(JSON.stringify(entities)).digest("hex");
}

/** Write the bible into the graph as ESTABLISHED canon v1. */
export async function establishBible(franchiseId: string, bible: Bible, actor: string) {
  const issues = validateBible(bible);
  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length) throw new Error(`Canon validation failed: ${errors.map((e) => e.message).join("; ")}`);

  const fallbackColors = ["#e07a3a", "#7fb7a6", "#c9a35c", "#b56a8f", "#6f8fd1", "#d4c46a"];
  const entity = (type: EntityType, name: string, summary: string, data: Prisma.InputJsonValue) =>
    db.canonEntity.upsert({
      where: { franchiseId_type_slug: { franchiseId, type, slug: slugify(name) } },
      create: { franchiseId, type, slug: slugify(name), name, summary, status: "ESTABLISHED", data },
      update: { name, summary, status: "ESTABLISHED", data },
    });

  const chars = [];
  for (const [i, c] of bible.characters.entries()) {
    const color = /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : fallbackColors[i % fallbackColors.length];
    chars.push(await entity("CHARACTER", c.name, `${c.role}. ${c.motivation}`, { ...c, color, relationships: undefined }));
  }
  for (const c of bible.characters) {
    const from = chars.find((x) => x.name === c.name)!;
    for (const r of c.relationships) {
      const to = chars.find((x) => x.name.toLowerCase() === r.with.trim().toLowerCase());
      if (!to || to.id === from.id) continue;
      await db.canonRelation.upsert({
        where: { fromId_toId_kind: { fromId: from.id, toId: to.id, kind: r.kind } },
        create: { fromId: from.id, toId: to.id, kind: r.kind, status: "ESTABLISHED" },
        update: {},
      });
    }
  }
  for (const l of bible.locations) await entity("LOCATION", l.name, l.description, l);
  for (const r of bible.rules) await entity("RULE", r.name, r.description, r);
  for (const a of bible.arcs) await entity("ARC", a.name, a.description, a);
  for (const t of bible.timeline) await entity("EVENT", t.name, t.description, t);
  await entity("STYLE_GUIDE", "Visual style guide", bible.styleGuide.shapeLanguage, bible.styleGuide);
  await entity("MUSIC_THEME", bible.musicTheme.name, bible.musicTheme.description, bible.musicTheme);
  for (const c of bible.characters) await entity("VOICE_PROFILE", `${c.name} voice`, c.voice, { character: c.name, description: c.voice });

  const hash = await canonHash(franchiseId);
  await db.$transaction([
    db.canonVersion.create({
      data: { franchiseId, version: 1, summary: "Canon v1 established from the greenlit bible", changes: issues.map((i) => i.message), hash, createdBy: actor },
    }),
    db.franchise.update({ where: { id: franchiseId }, data: { canonVersion: 1, synopsis: bible.synopsis } }),
  ]);
  return { characters: chars.length, issues, hash };
}

export async function canonDigest(franchiseId: string): Promise<CanonDigest> {
  const f = await db.franchise.findUniqueOrThrow({ where: { id: franchiseId } });
  const ents = await db.canonEntity.findMany({ where: { franchiseId, status: "ESTABLISHED" }, orderBy: { createdAt: "asc" } });
  const of = (t: EntityType) => ents.filter((e) => e.type === t);
  return {
    title: f.title,
    ageRating: f.ageRating,
    synopsis: f.synopsis || f.logline,
    characters: of("CHARACTER").map((e) => {
      const d = e.data as { role?: string; motivation?: string; voice?: string };
      return { name: e.name, role: d.role ?? "", motivation: d.motivation ?? "", voice: d.voice ?? "" };
    }),
    locations: of("LOCATION").map((e) => e.name),
    rules: of("RULE").map((e) => `${e.name}: ${e.summary}`),
  };
}

const looseMatch = (a: string, b: string) => {
  const n = (s: string) => s.toLowerCase().replace(/^(the|a)\s+/, "").replace(/[^a-z0-9]+/g, "");
  return n(a) === n(b) || n(a).includes(n(b)) || n(b).includes(n(a));
};

/** Deterministic continuity check of a script against canon. */
export function validateScript(script: PilotScript, canon: CanonDigest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const names = canon.characters.map((c) => c.name);
  for (const s of script.scenes) {
    if (!canon.locations.some((l) => looseMatch(l, s.location)))
      issues.push({ severity: "warning", message: `Scene "${s.heading}" uses non-canon location "${s.location}".` });
    for (const d of s.dialogue) {
      if (!names.some((n) => looseMatch(n, d.character) || looseMatch(n.split(" ")[0], d.character)))
        issues.push({ severity: "error", message: `"${d.character}" speaks but is not a canon character.` });
      if (d.line.split(/\s+/).length > 20) issues.push({ severity: "warning", message: `Line too long for captions: "${d.line.slice(0, 40)}…"` });
    }
  }
  if (!script.scenes.length) issues.push({ severity: "error", message: "Script has no scenes." });
  return issues;
}

/**
 * Apply an approved change to a canon entity: new revision, new franchise
 * canon version, hashed, and every dependent asset flagged NEEDS_REVIEW.
 */
export async function applyChange(entityId: string, data: Record<string, unknown>, actor: string, reason: string) {
  const e = await db.canonEntity.findUniqueOrThrow({ where: { id: entityId } });
  const merged = { ...(e.data as Record<string, unknown>), ...data };
  await db.$transaction([
    db.canonRevision.create({ data: { entityId, revision: e.revision, data: e.data as Prisma.InputJsonValue, changedBy: actor, reason } }),
    db.canonEntity.update({
      where: { id: entityId },
      data: { data: merged as Prisma.InputJsonValue, revision: { increment: 1 }, name: typeof data.name === "string" && data.name.trim() ? data.name.trim() : e.name, summary: String(merged.summary ?? e.summary) },
    }),
  ]);
  const f = await db.franchise.update({ where: { id: e.franchiseId }, data: { canonVersion: { increment: 1 } } });
  const hash = await canonHash(e.franchiseId);
  await db.canonVersion.create({
    data: { franchiseId: e.franchiseId, version: f.canonVersion, summary: `${e.name}: ${reason}`, changes: Object.keys(data), hash, createdBy: actor },
  });
  const flagged = await db.asset.updateMany({
    where: { entities: { some: { entityId } }, status: { in: ["APPROVED", "IN_REVIEW", "DRAFT"] } },
    data: { status: "NEEDS_REVIEW" },
  });
  return { version: f.canonVersion, flagged: flagged.count, hash };
}
