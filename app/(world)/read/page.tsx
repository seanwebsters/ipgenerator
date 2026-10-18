import { catalog } from "@/lib/world";
import { toCard } from "@/lib/cards";
import { GridPage } from "@/components/world/grid-page";

export const dynamic = "force-dynamic";

export default async function ReadIndex() {
  const { titles } = await catalog({ kind: "READ" });
  return <GridPage eyebrow="Read" title="Stories & comics" intro="Illustrated scripts, stories and comics from every WEBSTER world." cards={titles.map((t) => toCard(t))} empty="No stories to read yet." />;
}
