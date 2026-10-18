export type StudioKey =
  | "ip-lab"
  | "characters"
  | "world"
  | "story"
  | "social"
  | "animation"
  | "music"
  | "games"
  | "publishing"
  | "merch"
  | "brand"
  | "vault";

export type AgentKey = "director" | StudioKey;

export type Stage = "discovery" | "development" | "canon" | "expansion";

export interface ConceptScores {
  originality: number;
  marketability: number;
  expandability: number;
  merchability: number;
}

export interface Concept {
  id: string;
  title: string;
  logline: string;
  genre: string;
  tone: string;
  audience: string;
  hook: string;
  formats: string[];
  comparables: string[];
  palette: string[];
  scores: ConceptScores;
}

export interface Relationship {
  characterId: string;
  kind: string;
}

export interface Character {
  id: string;
  name: string;
  role: string;
  archetype: string;
  description: string;
  motivation: string;
  flaw: string;
  visualNotes: string;
  voice: string;
  color: string;
  relationships: Relationship[];
  revision: number;
}

export interface Location {
  id: string;
  name: string;
  kind: string;
  description: string;
  mood: string;
}

export interface WorldRule {
  id: string;
  title: string;
  description: string;
}

export interface Faction {
  id: string;
  name: string;
  ideology: string;
  description: string;
}

export interface TimelineEvent {
  id: string;
  when: string;
  event: string;
}

export interface World {
  premise: string;
  setting: string;
  era: string;
  locations: Location[];
  rules: WorldRule[];
  factions: Faction[];
  timeline: TimelineEvent[];
}

export type FormatStatus = "core" | "planned" | "exploring";

export interface FormatPlan {
  name: string;
  status: FormatStatus;
  note: string;
}

export interface FranchiseCore {
  logline: string;
  premise: string;
  themes: string[];
  pillars: string[];
  audience: string;
  tone: string;
  comparables: string[];
  formats: FormatPlan[];
}

export type AssetStatus = "draft" | "pending" | "approved" | "needs_review";

export interface Asset {
  id: string;
  studio: StudioKey;
  kind: string;
  title: string;
  summary: string;
  body: string;
  /** Canon entity ids (characters, locations, rules) this asset depends on. */
  dependsOn: string[];
  status: AssetStatus;
  reviewReason?: string;
  canonVersion: number;
  createdAt: string;
  meta?: Record<string, string | number | string[]>;
}

export type VaultKind = "trademark" | "copyright" | "domain" | "design" | "chain-of-title";
export type VaultStatus = "idea" | "cleared" | "filed" | "registered" | "flagged";

export interface VaultRecord {
  id: string;
  kind: VaultKind;
  title: string;
  jurisdiction: string;
  classes: string;
  status: VaultStatus;
  notes: string;
  updatedAt: string;
}

export interface CanonVersion {
  version: number;
  createdAt: string;
  author: string;
  summary: string;
  changes: string[];
  hash: string;
}

export type ApprovalKind = "asset" | "review" | "canon";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface Approval {
  id: string;
  createdAt: string;
  agent: AgentKey;
  studio: StudioKey;
  kind: ApprovalKind;
  title: string;
  description: string;
  refId: string;
  status: ApprovalStatus;
}

export type TaskStatus = "queued" | "awaiting_approval" | "done";

export interface PlanTask {
  id: string;
  studio: StudioKey;
  title: string;
  deliverable: string;
  status: TaskStatus;
  assetId?: string;
}

export interface PlanPhase {
  name: string;
  tasks: PlanTask[];
}

export interface DirectorPlan {
  objective: string;
  createdAt: string;
  phases: PlanPhase[];
}

export interface ActivityItem {
  id: string;
  at: string;
  agent: AgentKey | "you";
  text: string;
}

export interface Franchise {
  id: string;
  name: string;
  tagline: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
  stage: Stage;
  concept: Concept;
  alternates: Concept[];
  core: FranchiseCore;
  characters: Character[];
  world: World;
  assets: Asset[];
  vault: VaultRecord[];
  canon: { version: number; history: CanonVersion[] };
  approvals: Approval[];
  plan: DirectorPlan | null;
  activity: ActivityItem[];
}
