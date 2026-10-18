import { db } from "../lib/db";
import type { AgentRole, Department } from "../generated/prisma/client";

export interface AgentSpec {
  key: string;
  name: string;
  title: string;
  department: Department;
  role: AgentRole;
  parentKey?: string;
  tools: string[];
  permissions: Record<string, unknown>;
}

export const DEPARTMENTS: { key: Department; name: string; blurb: string; phase: 1 | 2 }[] = [
  { key: "CHIEF_STUDIO", name: "Chief Studio", blurb: "Portfolio strategy, budgets, priorities and founder reporting.", phase: 1 },
  { key: "CULTURAL_INTELLIGENCE", name: "Cultural Intelligence", blurb: "Opportunity briefs with recorded evidence.", phase: 1 },
  { key: "ORIGINAL_IP_LAB", name: "Original IP Lab", blurb: "Original franchises, canon bibles and scoring.", phase: 1 },
  { key: "WRITERS_ROOM", name: "Writers' Room", blurb: "Scripts in every format, held to canon.", phase: 1 },
  { key: "VISUAL_DEVELOPMENT", name: "Visual Development", blurb: "Storyboards, key art and style references with provenance.", phase: 1 },
  { key: "ANIMATION_VIDEO", name: "Animation & Video", blurb: "Shot plans, timelines and FFmpeg assembly.", phase: 1 },
  { key: "MUSIC_AUDIO", name: "Music & Audio", blurb: "Themes, score and licensed voice performance.", phase: 1 },
  { key: "GAMES_INTERACTIVE", name: "Games & Interactive", blurb: "Playable prototypes with tests.", phase: 2 },
  { key: "MARKETING_DISTRIBUTION", name: "Marketing & Distribution", blurb: "Packages, disclosures and authorised publishing.", phase: 1 },
  { key: "AUDIENCE_INTELLIGENCE", name: "Audience Intelligence", blurb: "Real metrics, experiments and uncertainty.", phase: 1 },
  { key: "FRANCHISE_DEVELOPMENT", name: "Franchise Development", blurb: "Spin-offs, seasons and licensing business cases.", phase: 2 },
  { key: "QUALITY_SAFETY", name: "Quality & Safety", blurb: "Canon, technical, rights, suitability and originality checks.", phase: 1 },
  { key: "STUDIO_OPERATIONS", name: "Studio Operations", blurb: "Budgets, queues, provider health and audit.", phase: 1 },
];

const llm = ["llm"];
export const AGENTS: AgentSpec[] = [
  { key: "chief.studio", name: "Atlas", title: "Chief Studio Agent", department: "CHIEF_STUDIO", role: "CHIEF", tools: ["workflows", "approvals:request"], permissions: { publish: false, spend: "policy", bypassApprovals: false } },
  { key: "intel.lead", name: "Sable", title: "Head of Cultural Intelligence", department: "CULTURAL_INTELLIGENCE", role: "LEAD", parentKey: "chief.studio", tools: llm, permissions: { webAccess: false } },
  { key: "intel.trends", name: "Quarry", title: "Trend Analyst", department: "CULTURAL_INTELLIGENCE", role: "SPECIALIST", parentKey: "intel.lead", tools: llm, permissions: {} },
  { key: "iplab.lead", name: "Nova", title: "Head of the Original IP Lab", department: "ORIGINAL_IP_LAB", role: "LEAD", parentKey: "chief.studio", tools: [...llm, "canon:write"], permissions: { canon: "propose+establish-v1" } },
  { key: "iplab.scorer", name: "Ledger", title: "Greenlight Analyst", department: "ORIGINAL_IP_LAB", role: "SPECIALIST", parentKey: "iplab.lead", tools: llm, permissions: {} },
  { key: "writers.lead", name: "Quill", title: "Head Writer", department: "WRITERS_ROOM", role: "LEAD", parentKey: "chief.studio", tools: [...llm, "canon:read"], permissions: {} },
  { key: "visual.lead", name: "Iris", title: "Head of Visual Development", department: "VISUAL_DEVELOPMENT", role: "LEAD", parentKey: "chief.studio", tools: ["image", "canon:read"], permissions: {} },
  { key: "visual.keyart", name: "Vellum", title: "Key Art Designer", department: "VISUAL_DEVELOPMENT", role: "SPECIALIST", parentKey: "visual.lead", tools: ["image"], permissions: {} },
  { key: "animation.lead", name: "Frame", title: "Animation & Video Director", department: "ANIMATION_VIDEO", role: "LEAD", parentKey: "chief.studio", tools: ["ffmpeg", "storage"], permissions: {} },
  { key: "audio.lead", name: "Cadence", title: "Head of Music & Audio", department: "MUSIC_AUDIO", role: "LEAD", parentKey: "chief.studio", tools: ["ffmpeg", "voice:licensed-library"], permissions: { voiceCloning: false } },
  { key: "games.lead", name: "Pixel", title: "Head of Games & Interactive", department: "GAMES_INTERACTIVE", role: "LEAD", parentKey: "chief.studio", tools: llm, permissions: {} },
  { key: "marketing.lead", name: "Herald", title: "Head of Marketing & Distribution", department: "MARKETING_DISTRIBUTION", role: "LEAD", parentKey: "chief.studio", tools: [...llm, "publish:webster-world", "publish:youtube"], permissions: { publish: "after-approval" } },
  { key: "audience.lead", name: "Tally", title: "Head of Audience Intelligence", department: "AUDIENCE_INTELLIGENCE", role: "LEAD", parentKey: "chief.studio", tools: [...llm, "analytics:read", "experiments"], permissions: {} },
  { key: "franchise.lead", name: "Crown", title: "Head of Franchise Development", department: "FRANCHISE_DEVELOPMENT", role: "LEAD", parentKey: "chief.studio", tools: llm, permissions: {} },
  { key: "quality.lead", name: "Warden", title: "Head of Quality & Safety", department: "QUALITY_SAFETY", role: "LEAD", parentKey: "chief.studio", tools: [...llm, "ffprobe", "canon:read"], permissions: { canBlockRelease: true } },
  { key: "quality.canon", name: "Archivist", title: "Canon Validator", department: "QUALITY_SAFETY", role: "SPECIALIST", parentKey: "quality.lead", tools: ["canon:read"], permissions: {} },
  { key: "ops.lead", name: "Keel", title: "Head of Studio Operations", department: "STUDIO_OPERATIONS", role: "LEAD", parentKey: "chief.studio", tools: ["queues", "budgets", "audit"], permissions: {} },
];

export async function seedAgents() {
  for (const a of AGENTS) {
    await db.agent.upsert({
      where: { key: a.key },
      create: { ...a, tools: a.tools, permissions: a.permissions as object },
      update: { name: a.name, title: a.title, department: a.department, role: a.role, parentKey: a.parentKey, tools: a.tools, permissions: a.permissions as object },
    });
  }
}

/** Every active franchise gets a persistent director agent. */
export async function ensureFranchiseDirector(franchiseId: string, title: string) {
  const key = `director.${franchiseId}`;
  return db.agent.upsert({
    where: { key },
    create: {
      key,
      name: `${title.split(/\s+/).slice(-1)[0]} Director`,
      title: `Franchise Director — ${title}`,
      department: "FRANCHISE_DEVELOPMENT",
      role: "FRANCHISE_DIRECTOR",
      parentKey: "chief.studio",
      franchiseId,
      tools: ["llm", "canon:read", "workflows", "analytics:read"],
      permissions: { budgetUsd: 10, canonChanges: "propose" },
      memory: { notes: [] },
    },
    update: {},
  });
}
