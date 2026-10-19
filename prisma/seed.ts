import "dotenv/config";
import { db } from "../lib/db";
import { seedStudio } from "../lib/seed";

async function main() {
  const email = process.env.WEBSTER_FOUNDER_EMAIL ?? "admin@studio.local";
  const password = process.env.WEBSTER_FOUNDER_PASSWORD;
  // A public deployment must never get the well-known development password.
  if (!password && (process.env.VERCEL || process.env.NODE_ENV === "production") && !(await db.user.findUnique({ where: { email } }))) {
    throw new Error("Set WEBSTER_FOUNDER_PASSWORD (and WEBSTER_FOUNDER_EMAIL) before the first deploy.");
  }
  const { createdFounder } = await seedStudio({ email, password: password ?? "studio-dev", name: process.env.WEBSTER_FOUNDER_NAME });
  if (createdFounder) console.log(`Founder account created: ${email} / ${password ? "(from WEBSTER_FOUNDER_PASSWORD)" : "studio-dev"}`);
  console.log("Seed complete: settings, founder, agents, channels, schedules.");
}

main().finally(() => db.$disconnect());
