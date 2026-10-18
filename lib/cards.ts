import type { CardTitle } from "@/components/world/cards";
import type { CatalogTitle } from "./world";
import { media } from "./world";
import { RATING_LABEL, type Rating } from "./viewer";

export const toCard = (t: CatalogTitle, progress?: number): CardTitle => ({
  id: t.id,
  slug: t.slug,
  kind: t.kind,
  displayTitle: t.displayTitle,
  franchiseTitle: t.franchise.title,
  posterUrl: media(t.posterKey),
  ageLabel: RATING_LABEL[t.ageRating as Rating],
  runtimeSec: t.runtimeSec,
  isDemo: t.isDemo,
  progress,
});
