import { execSync } from "node:child_process";

/**
 * `npm run build`. On Vercel, first bring the database up to date (migrations,
 * then the idempotent seed: settings, founder, agents, channels, schedules),
 * so a deploy needs no manual database step.
 */
const sh = (cmd) => execSync(cmd, { stdio: "inherit" });
if (process.env.VERCEL) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set. Add a Postgres database to the Vercel project (Storage → Prisma Postgres or Neon).");
  sh("npx prisma migrate deploy");
  sh("npx tsx prisma/seed.ts");
}
sh("npx next build");
