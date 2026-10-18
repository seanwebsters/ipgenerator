import Link from "next/link";
import { notFound } from "next/navigation";
import { catalog, media } from "@/lib/world";
import { StoryPlayer } from "@/components/world/story-player";
import { Impression } from "@/components/world/track";
import { RATING_LABEL, type Rating } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export default async function Play({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { titles } = await catalog({ kind: "PLAY" });
  const t = titles.find((x) => x.slug === slug);
  if (!t?.playContent) notFound();
  const pc = t.playContent as { graph: { start: string; nodes: { id: string; location: string; text: string; choices: { label: string; to: string }[]; ending: "" | "triumph" | "bittersweet" | "lost" }[] }; nodeImages: Record<string, string> };
  const images = Object.fromEntries(Object.entries(pc.nodeImages).map(([k, v]) => [k, media(v)!]));
  return (
    <main className="mx-auto max-w-4xl px-4 pt-10 sm:px-8">
      <Impression titleId={t.id} />
      <Link href={`/f/${t.franchise.slug}`} className="text-xs font-semibold uppercase tracking-[0.35em] text-brass">{t.franchise.title}</Link>
      <h1 className="font-display mt-2 text-4xl sm:text-5xl">{t.displayTitle}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {t.isDemo && <span className="rounded-full bg-fuchsia-500/85 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Demo</span>}
        <span className="rounded border border-white/25 px-1.5 text-xs text-foreground/80">{RATING_LABEL[t.ageRating as Rating]}</span>
        <span>Interactive story · {pc.graph.nodes.filter((n) => n.ending).length} endings</span>
      </div>
      <p className="mt-4 max-w-2xl text-lg text-foreground/85">{t.synopsis}</p>
      <div className="mt-8">
        <StoryPlayer titleId={t.id} start={pc.graph.start} nodes={pc.graph.nodes} images={images} />
      </div>
      <p className="mt-6 text-sm text-muted-foreground">{t.disclosure}</p>
    </main>
  );
}
