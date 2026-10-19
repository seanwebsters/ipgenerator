import { catalog } from "@/lib/world";
import { toCard } from "@/lib/cards";
import { GridPage } from "@/components/world/grid-page";

export const dynamic = "force-dynamic";

export default async function PlayIndex() {
  const { titles } = await catalog({ kind: "PLAY" });
  return <GridPage eyebrow="Play" title="Interactive experiences" intro="Games and interactive stories set in Studio worlds." cards={titles.map((t) => toCard(t))} empty="No interactive experiences yet. They will appear here when they ship." />;
}
