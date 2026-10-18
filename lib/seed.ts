import { db } from "./db";
import { hashPassword } from "./crypto";
import { seedAgents } from "../engine/agents";
import { refreshChannels } from "../engine/channels";
import { ensureSchedules } from "../engine/jobs";

/**
 * Configuration only: studio settings, the founder account, the agent
 * workforce, channels and schedules. No franchises, metrics or revenue —
 * those only exist once the studio produces and measures them. Idempotent.
 */
export async function seedStudio(founder: { email: string; password: string; name?: string }) {
  await db.studioSettings.upsert({ where: { id: "studio" }, create: { id: "studio" }, update: {} });
  const existing = await db.user.findUnique({ where: { email: founder.email } });
  if (!existing) {
    await db.user.create({ data: { email: founder.email, name: founder.name ?? "Founder", role: "FOUNDER", passwordHash: hashPassword(founder.password) } });
  }
  await seedAgents();
  await refreshChannels();
  await ensureSchedules();
  return { createdFounder: !existing };
}
