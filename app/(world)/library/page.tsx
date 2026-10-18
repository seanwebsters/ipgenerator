import { db } from "@/lib/db";
import { catalog } from "@/lib/world";
import { toCard } from "@/lib/cards";
import { Row, TitleCard } from "@/components/world/cards";

export const dynamic = "force-dynamic";

export default async function Library() {
  const { viewer, titles } = await catalog();
  const [favs, progress] = viewer
    ? await Promise.all([db.favorite.findMany({ where: { viewerId: viewer.id, titleId: { not: null } } }), db.playbackProgress.findMany({ where: { viewerId: viewer.id }, orderBy: { updatedAt: "desc" } })])
    : [[], []];
  const byId = new Map(titles.map((t) => [t.id, t]));
  const saved = favs.map((f) => byId.get(f.titleId!)).filter(Boolean);
  const cont = progress.filter((p) => !p.completed && byId.has(p.titleId));
  const done = progress.filter((p) => p.completed && byId.has(p.titleId));
  return (
    <main className="pt-14">
      <div className="px-4 sm:px-8">
        <div className="text-xs font-semibold uppercase tracking-[0.35em] text-brass">My Library</div>
        <h1 className="font-display mt-3 text-5xl sm:text-6xl">Everything you love, in one place</h1>
      </div>
      {!saved.length && !cont.length && !done.length && <p className="mt-10 px-4 text-muted-foreground sm:px-8">Titles you save or start watching will appear here.</p>}
      {cont.length > 0 && (
        <Row title="Continue">
          {cont.map((p) => (
            <TitleCard key={p.titleId} t={toCard(byId.get(p.titleId)!, p.positionSec / p.durationSec)} />
          ))}
        </Row>
      )}
      {saved.length > 0 && (
        <Row title="Saved">
          {saved.map((t) => (
            <TitleCard key={t!.id} t={toCard(t!)} />
          ))}
        </Row>
      )}
      {done.length > 0 && (
        <Row title="Watched">
          {done.map((p) => (
            <TitleCard key={p.titleId} t={toCard(byId.get(p.titleId)!)} />
          ))}
        </Row>
      )}
    </main>
  );
}
