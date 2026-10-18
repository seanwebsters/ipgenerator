import { execSync } from "node:child_process";

/**
 * `npm run build`. On Vercel, first bring the database up to date (migrations,
 * then the idempotent seed: settings, founder, agents, channels, schedules),
 * so a deploy needs no manual database step.
 */
const sh = (cmd) => execSync(cmd, { stdio: "inherit" });
if (process.env.VERCEL && !process.env.DATABASE_URL) {
  // The app runs on its built-in, temporary database until one is connected.
  console.warn("\n⚠  DATABASE_URL is not set: the app will use its built-in temporary database (data resets on restart). Connect one (Storage → Prisma Postgres) and redeploy to keep data.\n");
} else if (process.env.VERCEL) {
  sh("npx prisma migrate deploy");
  sh("npx tsx prisma/seed.ts");
}
sh("npx next build");
