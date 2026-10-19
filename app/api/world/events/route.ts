import { cookies } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { assignVariant } from "@/engine/learning";
import { engineInline, tick } from "@/engine/runner";

const Event = z.object({
  type: z.enum(["impression", "play", "progress", "complete", "share", "favorite"]),
  titleId: z.string().min(1).max(40),
  value: z.number().min(0).max(100_000).optional(),
});
const Body = z.object({ events: z.array(Event).max(50) });

let lastTick = 0;

/**
 * Real audience events from Studio. The viewer id comes from the
 * httpOnly cookie, never from the client body, and experiment variants are
 * re-derived server-side so they can't be spoofed.
 */
export async function POST(req: Request) {
  const viewerId = (await cookies()).get("wb_viewer")?.value;
  if (!viewerId) return Response.json({ error: "no viewer" }, { status: 400 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid events" }, { status: 400 });

  const titleIds = [...new Set(parsed.data.events.map((e) => e.titleId))];
  const titles = await db.worldTitle.findMany({ where: { id: { in: titleIds } }, select: { id: true, franchiseId: true } });
  const exps = await db.experiment.findMany({ where: { titleId: { in: titleIds }, status: "RUNNING" }, select: { id: true, titleId: true } });
  const now = new Date();
  const rows = parsed.data.events
    .filter((e) => titles.some((t) => t.id === e.titleId))
    .map((e) => {
      const t = titles.find((x) => x.id === e.titleId)!;
      const exp = exps.find((x) => x.titleId === e.titleId);
      return {
        source: "webster-world",
        type: e.type,
        titleId: e.titleId,
        franchiseId: t.franchiseId,
        viewerId,
        value: e.value ?? null,
        experimentId: exp?.id ?? null,
        variant: exp ? assignVariant(viewerId, exp.id) : null,
        // Internal automated QA sessions (viewer ids prefixed "qa-") are tagged so
        // they can never be mistaken for audience behaviour.
        props: viewerId.startsWith("qa-") ? { qa: true } : {},
        occurredAt: now,
      };
    });
  if (rows.length) await db.analyticsEvent.createMany({ data: rows });
  await db.viewer.upsert({ where: { id: viewerId }, create: { id: viewerId }, update: {} });
  // Inline engine: audience traffic also moves due work along (scheduled
  // ingests, learning reviews), at most once a minute per instance.
  if (engineInline() && Date.now() - lastTick > 60_000) {
    lastTick = Date.now();
    after(() => tick(20_000).catch(() => {}));
  }
  return Response.json({ accepted: rows.length });
}
