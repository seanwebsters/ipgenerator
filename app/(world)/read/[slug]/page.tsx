import Link from "next/link";
import { notFound } from "next/navigation";
import { catalog, media } from "@/lib/world";
import { ReadTracker } from "@/components/world/read-tracker";

export const dynamic = "force-dynamic";

interface Page {
  heading: string;
  body: string;
  dialogue: { character: string; line: string }[];
  imageKey: string | null;
}

export default async function Read({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { titles } = await catalog();
  const t = titles.find((x) => x.slug === slug && x.kind === "READ");
  if (!t) notFound();
  const pages = ((t.readContent as { pages?: Page[] })?.pages ?? []) as Page[];
  return (
    <main className="mx-auto max-w-3xl px-4 pt-14 sm:px-8">
      <ReadTracker titleId={t.id} />
      <Link href={`/f/${t.franchise.slug}`} className="text-xs font-semibold uppercase tracking-[0.35em] text-brass">{t.franchise.title}</Link>
      <h1 className="font-display mt-3 text-5xl leading-tight">{t.displayTitle}</h1>
      {t.isDemo && <span className="mt-3 inline-block rounded-full bg-fuchsia-500/85 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Demo</span>}
      <p className="mt-4 text-lg text-muted-foreground">{t.synopsis}</p>
      <div className="mt-12 space-y-16">
        {pages.map((p, i) => (
          <article key={i}>
            {p.imageKey && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={media(p.imageKey) ?? ""} alt="" className="aspect-video w-full rounded-2xl border border-white/10 object-cover" />
            )}
            <div className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-brass">{p.heading}</div>
            <p className="font-display mt-3 text-2xl leading-relaxed text-foreground/90">{p.body}</p>
            <div className="mt-6 space-y-4">
              {p.dialogue.map((d, j) => (
                <div key={j} className="grid grid-cols-[120px_1fr] gap-4 text-lg">
                  <div className="pt-0.5 text-right text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{d.character}</div>
                  <div className="text-foreground/90">{d.line}</div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
      <p className="mt-16 border-t border-white/10 pt-6 text-sm text-muted-foreground">{t.disclosure}</p>
    </main>
  );
}
