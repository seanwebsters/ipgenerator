import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { catalog, media } from "@/lib/world";
import { toCard } from "@/lib/cards";
import { Row, TitleCard } from "@/components/world/cards";

export const dynamic = "force-dynamic";

export default async function FranchisePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const f = await db.franchise.findUnique({ where: { slug }, include: { entities: { where: { status: "ESTABLISHED" } }, universe: true } });
  if (!f) notFound();
  const { titles } = await catalog({ franchiseId: f.id });
  if (!titles.length) notFound(); // not released to this viewer
  const art = titles[0].backdropKey;
  const chars = f.entities.filter((e) => e.type === "CHARACTER");
  const places = f.entities.filter((e) => e.type === "LOCATION");
  return (
    <main>
      <section className="relative isolate min-h-[62vh] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={media(art) ?? ""} alt="" className="absolute inset-0 -z-10 size-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/40 to-background/20" />
        <div className="mx-auto flex min-h-[62vh] max-w-[1400px] items-end px-4 pb-12 sm:px-8">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-[0.35em] text-brass">{f.universe?.name ?? f.genre}</div>
            <h1 className="font-display mt-3 text-6xl leading-[0.9] sm:text-8xl">{f.title}</h1>
            <p className="mt-5 text-lg text-foreground/85">{f.synopsis || f.logline}</p>
            {f.isDemo && <p className="mt-3 inline-block rounded-full bg-fuchsia-500/20 px-3 py-1 text-xs text-fuchsia-200">DEMO world — produced with Studio's demo generator to show the pipeline</p>}
          </div>
        </div>
      </section>
      <Row title="Stories">
        {titles.map((t) => (
          <TitleCard key={t.id} t={toCard(t)} size="lg" />
        ))}
      </Row>
      {chars.length > 0 && (
        <section className="mt-14 px-4 sm:px-8">
          <h2 className="font-display mb-5 text-3xl">Characters</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {chars.map((c) => {
              const d = c.data as { color?: string; role?: string; appearance?: string; personality?: string[] };
              return (
                <div key={c.id} className="relative overflow-hidden rounded-2xl border border-white/10 bg-card p-5">
                  <div className="absolute -right-8 -top-8 size-28 rounded-full opacity-40 blur-2xl" style={{ background: d.color }} />
                  <div className="size-12 rounded-full" style={{ background: `radial-gradient(circle at 30% 30%, ${d.color}, ${d.color}55)` }} />
                  <div className="font-display mt-4 text-2xl">{c.name}</div>
                  <div className="text-xs uppercase tracking-wider text-brass">{d.role}</div>
                  <p className="mt-2 text-sm text-muted-foreground">{d.appearance}</p>
                  {d.personality && <div className="mt-3 text-xs text-foreground/70">{d.personality.join(" · ")}</div>}
                </div>
              );
            })}
          </div>
        </section>
      )}
      {places.length > 0 && (
        <section className="mt-14 px-4 sm:px-8">
          <h2 className="font-display mb-5 text-3xl">Places</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {places.map((p) => (
              <div key={p.id} className="rounded-2xl border border-white/10 bg-card/60 p-5">
                <div className="font-display text-2xl">{p.name}</div>
                <p className="mt-2 text-sm text-muted-foreground">{p.summary}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
