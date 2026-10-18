import { catalog } from "@/lib/world";
import { toCard } from "@/lib/cards";
import { GridPage } from "@/components/world/grid-page";

export const dynamic = "force-dynamic";

export default async function WatchIndex() {
  const { titles } = await catalog({ kind: "WATCH" });
  return <GridPage eyebrow="Watch" title="Films & series" cards={titles.map((t) => toCard(t))} empty="Nothing to watch yet. New releases appear here first." />;
}
