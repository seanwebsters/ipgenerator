import { catalog } from "@/lib/world";
import { toCard } from "@/lib/cards";
import { GridPage } from "@/components/world/grid-page";

export const dynamic = "force-dynamic";

export default async function Listen() {
  const { titles } = await catalog({ kind: "LISTEN" });
  return <GridPage eyebrow="Listen" title="Music & audio stories" intro="Soundtracks, audio dramas and themes from Studio worlds." cards={titles.map((t) => toCard(t))} empty="No audio releases yet. Soundtracks and audio dramas will appear here when they ship." />;
}
