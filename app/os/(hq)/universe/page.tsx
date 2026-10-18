import Link from "next/link";
import { db } from "@/lib/db";
import { media } from "@/lib/world";
import { DemoTag, Empty, PageHeader } from "@/components/os/bits";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function Universe() {
  const franchises = await db.franchise.findMany({
    include: { assets: { where: { kind: { in: ["POSTER", "KEY_ART"] } }, orderBy: { createdAt: "desc" } }, entities: { where: { type: "CHARACTER" } }, titles: true, universe: true },
    orderBy: { updatedAt: "desc" },
  });
  const concepts = await db.concept.findMany({ where: { status: "PROPOSED" }, orderBy: { createdAt: "desc" }, take: 8 });
  return (
    <div>
      <PageHeader eyebrow="IP Universe" title="Every world we own" intro="Each franchise has its own canon, Franchise Director, asset library, budget and roadmap." />
      {franchises.length ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {franchises.map((f) => {
            const art = f.assets.find((a) => a.kind === "KEY_ART") ?? f.assets[0];
            return (
              <Link key={f.id} href={`/os/universe/${f.slug}`} className="group overflow-hidden rounded-2xl border bg-card transition hover:-translate-y-0.5 hover:border-white/20">
                <div className="relative aspect-[16/9] bg-gradient-to-br from-wine/40 to-background">
                  {art && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={media(art.storageKey) ?? ""} alt="" className="absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-105" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent" />
                  <div className="absolute left-3 top-3 flex gap-1.5">
                    <Badge variant={f.status === "ACTIVE" ? "success" : "outline"} className="bg-black/50">{f.status.toLowerCase()}</Badge>
                    <DemoTag show={f.isDemo} />
                  </div>
                </div>
                <div className="p-5">
                  <div className="text-[11px] uppercase tracking-wider text-brass">{f.universe?.name ?? f.genre}</div>
                  <div className="font-display text-3xl">{f.title}</div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{f.logline}</p>
                  <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>canon v{f.canonVersion}</span>·<span>{f.entities.length} characters</span>·<span>{f.titles.length} released</span>
                    <div className="ml-auto flex -space-x-1.5">
                      {f.entities.slice(0, 5).map((e) => (
                        <span key={e.id} title={e.name} className="size-5 rounded-full border border-card" style={{ background: (e.data as { color?: string }).color }} />
                      ))}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <Empty>No franchises yet. Greenlit concepts become franchises here.</Empty>
      )}
      {concepts.length > 0 && (
        <div className="mt-10">
          <h2 className="font-display mb-3 text-2xl">Proposed concepts awaiting a decision</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {concepts.map((c) => (
              <Link key={c.id} href="/os/approvals" className="rounded-xl border bg-card p-4 hover:border-white/20">
                <div className="text-[11px] uppercase tracking-wider text-brass">{c.genre}</div>
                <div className="font-display text-xl">{c.title}</div>
                <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.logline}</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
