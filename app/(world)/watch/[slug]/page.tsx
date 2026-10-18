import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { catalog, media } from "@/lib/world";
import { toCard } from "@/lib/cards";
import { Player, TitleActions } from "@/components/world/player";
import { Row, TitleCard } from "@/components/world/cards";
import { RATING_LABEL, type Rating } from "@/lib/viewer";
import { Impression } from "@/components/world/track";

export const dynamic = "force-dynamic";

export default async function Watch({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { viewer, titles } = await catalog();
  const t = titles.find((x) => x.slug === slug);
  if (!t || !t.mediaKey) notFound();
  const [fav, prog] = viewer
    ? await Promise.all([
        db.favorite.findUnique({ where: { viewerId_titleId: { viewerId: viewer.id, titleId: t.id } } }),
        db.playbackProgress.findUnique({ where: { viewerId_titleId: { viewerId: viewer.id, titleId: t.id } } }),
      ])
    : [null, null];
  const more = titles.filter((x) => x.id !== t.id && x.franchiseId === t.franchiseId);
  return (
    <main className="mx-auto max-w-[1200px] px-4 pt-8 sm:px-8">
      <Impression titleId={t.id} />
      <Player titleId={t.id} src={media(t.mediaKey)!} altSrc={media(t.mediaAltKey)} poster={media(t.backdropKey)} startAt={prog && !prog.completed ? prog.positionSec : undefined} />
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_320px]">
        <div>
          <Link href={`/f/${t.franchise.slug}`} className="text-xs font-semibold uppercase tracking-[0.35em] text-brass">{t.franchise.title}</Link>
          <h1 className="font-display mt-2 text-4xl sm:text-5xl">{t.displayTitle}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {t.isDemo && <span className="rounded-full bg-fuchsia-500/85 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Demo</span>}
            <span className="rounded border border-white/25 px-1.5 text-xs text-foreground/80">{RATING_LABEL[t.ageRating as Rating]}</span>
            {t.runtimeSec && <span>{Math.max(1, Math.round(t.runtimeSec / 60))} min</span>}
            <span>· Animatic pilot</span>
          </div>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-foreground/85">{t.synopsis}</p>
          <div className="mt-6">
            <TitleActions titleId={t.id} favorited={!!fav} />
          </div>
        </div>
        <aside className="h-fit rounded-2xl border border-white/10 bg-card/60 p-5 text-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">About this title</div>
          <p className="mt-2 text-foreground/80">{t.disclosure}</p>
          <Link href="/about" className="mt-3 inline-block text-xs text-brass hover:underline">How WEBSTER makes stories</Link>
        </aside>
      </div>
      {more.length > 0 && (
        <div className="-mx-4 sm:-mx-8">
          <Row title={`More from ${t.franchise.title}`}>
            {more.map((x) => (
              <TitleCard key={x.id} t={toCard(x)} />
            ))}
          </Row>
        </div>
      )}
    </main>
  );
}
