import "dotenv/config";
import { db } from "../lib/db";
import { hashPassword } from "../lib/crypto";
import { seedAgents } from "../engine/agents";
import { refreshChannels } from "../engine/channels";
import { ensureSchedules } from "../engine/jobs";

/**
 * Seeds configuration only: studio settings, the founder account, the agent
 * workforce, channels and schedules. No franchises, metrics or revenue are
 * seeded — those only exist once the studio produces and measures them.
 */
async function main() {
  await db.studioSettings.upsert({ where: { id: "studio" }, create: { id: "studio" }, update: {} });

  const email = process.env.WEBSTER_FOUNDER_EMAIL ?? "founder@webster.studio";
  const password = process.env.WEBSTER_FOUNDER_PASSWORD ?? "webster-dev";
  const existing = await db.user.findUnique({ where: { email } });
  if (!existing) {
    await db.user.create({ data: { email, name: process.env.WEBSTER_FOUNDER_NAME ?? "Founder", role: "FOUNDER", passwordHash: hashPassword(password) } });
    console.log(`Founder account created: ${email} / ${process.env.WEBSTER_FOUNDER_PASSWORD ? "(from WEBSTER_FOUNDER_PASSWORD)" : password}`);
  }

  await seedAgents();
  await refreshChannels();
  await ensureSchedules();
  console.log("Seed complete: settings, founder, agents, channels, schedules.");
}

main().finally(() => db.$disconnect());
