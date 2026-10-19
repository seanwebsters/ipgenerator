import Link from "next/link";
import { Play, Info } from "lucide-react";
import { db } from "@/lib/db";
import { catalog, media } from "@/lib/world";
import { toCard } from "@/lib/cards";
import { Row, TitleCard } from "@/components/world/cards";
import { RATING_LABEL, type Rating } from "@/lib/viewer";
import { Impression } from "@/components/world/track";

export const dynamic = "force-dynamic";

export default async function Discover() {
  const { viewer, titles } = await catalog();
  const watch = titles.filter((t) => t.kind === "WATCH");
  const hero = watch[0];
  const progress = viewer ? await db.playbackProgress.findMany({ where: { viewerId: viewer.id, completed: false }, orderBy: { updatedAt: "desc" } }) : [];
  const continuing = progress.map((p) => ({ p, t: titles.find((t) => t.id === p.titleId) })).filter((x) => x.t);
  const franchises = [...new Map(titles.map((t) => [t.franchiseId, t.franchise])).values()];

  if (!hero) {
    return (
      <main className="relative mx-auto grid min-h-[70vh] max-w-3xl place-items-center px-6 text-center">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.35em] text-brass">Coming soon</div>
          <h1 className="font-display mt-4 text-5xl sm:text-7xl">The first worlds are being made.</h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">New stories from Studio will appear here as soon as they are released.</p>
        </div>
      </main>
    );
  }

  return (
    <main>
      <section className="relative isolate min-h-[78vh] overflow-hidden">
        <Impression titleId={hero.id} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={media(hero.backdropKey) ?? ""} alt="" className="absolute inset-0 -z-10 size-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/70 to-transparent" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-transparent to-background/30" />
        <div className="mx-auto flex min-h-[78vh] max-w-[1400px] items-end px-4 pb-16 sm:px-8">
          <div className="max-w-2xl">
            <Link href={`/f/${hero.franchise.slug}`} className="text-xs font-semibold uppercase tracking-[0.35em] text-brass">
              {hero.franchise.title}
            </Link>
            <h1 className="font-display mt-3 text-5xl leading-[0.95] sm:text-7xl">{hero.displayTitle}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-foreground/75">
              {hero.isDemo && <span className="rounded-full bg-fuchsia-500/85 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Demo</span>}
              <span className="rounded border border-white/25 px-1.5 text-xs">{RATING_LABEL[hero.ageRating as Rating]}</span>
              <span>{hero.franchise.genre}</span>
              {hero.runtimeSec && <span>· {Math.max(1, Math.round(hero.runtimeSec / 60))} min</span>}
            </div>
            <p className="mt-5 text-lg leading-relaxed text-foreground/85">{hero.synopsis}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={`/watch/${hero.slug}`} className="inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-7 font-semibold text-background hover:bg-foreground/90">
                <Play className="size-5 fill-current" /> Watch now
              </Link>
              <Link href={`/f/${hero.franchise.slug}`} className="inline-flex h-12 items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 font-medium backdrop-blur hover:bg-white/10">
                <Info className="size-5" /> Explore the world
              </Link>
            </div>
          </div>
        </div>
      </section>

      {continuing.length > 0 && (
        <Row title="Continue watching">
          {continuing.map(({ p, t }) => (
            <TitleCard key={t!.id} t={toCard(t!, p.positionSec / p.durationSec)} />
          ))}
        </Row>
      )}
      <Row title="New from Studio">
        {watch.map((t) => (
          <TitleCard key={t.id} t={toCard(t)} size="lg" />
        ))}
      </Row>
      {titles.some((t) => t.kind === "PLAY") && (
        <Row title="Play the story">
          {titles.filter((t) => t.kind === "PLAY").map((t) => (
            <TitleCard key={t.id} t={toCard(t)} size="lg" />
          ))}
        </Row>
      )}
      {titles.some((t) => t.kind === "READ") && (
        <Row title="Read the worlds">
          {titles.filter((t) => t.kind === "READ").map((t) => (
            <TitleCard key={t.id} t={toCard(t)} />
          ))}
        </Row>
      )}

      <section className="mt-16 px-4 sm:px-8">
        <h2 className="font-display mb-5 text-3xl">Worlds</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {franchises.map((f) => {
            const art = titles.find((t) => t.franchiseId === f.id)?.backdropKey;
            return (
              <Link key={f.id} href={`/f/${f.slug}`} className="group relative block aspect-[16/9] overflow-hidden rounded-2xl border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={media(art) ?? ""} alt="" className="absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                <div className="absolute bottom-0 p-5">
                  <div className="font-display text-3xl">{f.title}</div>
                  <div className="mt-1 line-clamp-2 text-sm text-foreground/75">{f.logline}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
