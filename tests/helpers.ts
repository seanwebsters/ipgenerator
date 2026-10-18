import { db } from "../lib/db";
import { seedAgents } from "../engine/agents";
import { refreshChannels } from "../engine/channels";

const TABLES = [
  "AnalyticsEvent", "MetricSnapshot", "ExperimentResult", "ExperimentVariant", "Learning", "Experiment", "Favorite", "PlaybackProgress", "Viewer",
  "WorldTitle", "Publication", "Release", "AssetEntity", "Asset", "Script", "Production", "CanonRevision", "CanonRelation", "CanonEntity", "CanonVersion",
  "Opportunity", "Revenue", "Approval", "RunEvent", "WorkflowStep", "WorkflowRun", "Agent", "Franchise", "Universe", "Concept", "OpportunityBrief", "Brief",
  "Job", "Schedule", "GenerationRecord", "SpendReservation", "ProviderState", "ProviderCredential", "ModelRoute", "AuditLog", "Notification", "Channel", "StudioSettings",
];

export async function resetDb(settings: Record<string, unknown> = {}) {
  await db.$executeRawUnsafe(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`);
  await db.studioSettings.create({ data: { id: "studio", ...settings } });
  await seedAgents();
  await refreshChannels();
}
