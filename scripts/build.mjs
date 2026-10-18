import { execSync } from "node:child_process";

/**
 * `npm run build`. On Vercel, first bring the database up to date (migrations,
 * then the idempotent seed: settings, founder, agents, channels, schedules),
 * so a deploy needs no manual database step.
 */
const sh = (cmd) => execSync(cmd, { stdio: "inherit" });
if (process.env.VERCEL && !process.env.DATABASE_URL) {
  // Still build, so the project exists and can have a database attached; the
  // app shows setup instructions until then. Redeploy after connecting one.
  console.warn("\n⚠  DATABASE_URL is not set: skipping migrations and seed. Connect a database (Storage → Prisma Postgres), then redeploy.\n");
} else if (process.env.VERCEL) {
  sh("npx prisma migrate deploy");
  sh("npx tsx prisma/seed.ts");
}
sh("npx next build");
