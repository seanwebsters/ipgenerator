import { currentUser } from "@/lib/auth";
import { tick } from "@/engine/runner";

/**
 * Inline engine (WEBSTER_ENGINE=inline, the default on Vercel): each call
 * processes due jobs for up to ~50s. the Studio console calls POST while a signed-in
 * user has it open; a scheduler can call GET with `Authorization: Bearer
 * $CRON_SECRET` so schedules and delayed reviews also fire when nobody is.
 * No per-route maxDuration: routes with identical settings share one Vercel
 * function, which the built-in database (no DATABASE_URL) relies on.
 */
export const dynamic = "force-dynamic";

const BUDGET_MS = 50_000;

export async function POST() {
  if (!(await currentUser())) return Response.json({ error: "Sign in to the Studio console" }, { status: 401 });
  return Response.json(await tick(BUDGET_MS));
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(await tick(BUDGET_MS));
}
