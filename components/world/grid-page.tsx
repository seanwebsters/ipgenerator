import { TitleCard, type CardTitle } from "./cards";

export function GridPage({ eyebrow, title, intro, cards, empty }: { eyebrow: string; title: string; intro?: string; cards: CardTitle[]; empty: string }) {
  return (
    <main className="mx-auto max-w-[1400px] px-4 pt-14 sm:px-8">
      <div className="text-xs font-semibold uppercase tracking-[0.35em] text-brass">{eyebrow}</div>
      <h1 className="font-display mt-3 text-5xl sm:text-6xl">{title}</h1>
      {intro && <p className="mt-3 max-w-2xl text-muted-foreground">{intro}</p>}
      {cards.length ? (
        <div className="mt-10 flex flex-wrap gap-5">
          {cards.map((c) => (
            <TitleCard key={c.id} t={c} />
          ))}
        </div>
      ) : (
        <div className="mt-10 rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center text-muted-foreground">{empty}</div>
      )}
    </main>
  );
}
