import "server-only";
import { db } from "./db";
import { assignVariant } from "../engine/learning";
import { allowedRatings, currentViewer, type Rating } from "./viewer";
import type { WorldTitle, Franchise } from "../generated/prisma/client";

export type CatalogTitle = WorldTitle & { franchise: Franchise; displayTitle: string };

/**
 * Titles this viewer may see (maturity limit applied), with any running
 * title experiment's variant resolved for this viewer.
 */
export async function catalog(opts: { franchiseId?: string; kind?: WorldTitle["kind"] } = {}) {
  const viewer = await currentViewer();
  const limit = (viewer?.maturityLimit ?? "AGE_13") as Rating;
  const titles = await db.worldTitle.findMany({
    where: { ageRating: { in: allowedRatings(limit) }, ...(opts.franchiseId ? { franchiseId: opts.franchiseId } : {}), ...(opts.kind ? { kind: opts.kind } : {}) },
    include: { franchise: true },
    orderBy: { publishedAt: "desc" },
  });
  return { viewer, limit, titles: await withVariants(titles, viewer?.id) };
}

export async function withVariants<T extends WorldTitle & { franchise: Franchise }>(titles: T[], viewerId?: string): Promise<(T & { displayTitle: string })[]> {
  const exps = await db.experiment.findMany({ where: { status: "RUNNING", titleId: { in: titles.map((t) => t.id) } }, include: { variants: true } });
  return titles.map((t) => {
    const e = exps.find((x) => x.titleId === t.id);
    if (!e || !viewerId) return { ...t, displayTitle: t.title };
    const v = e.variants.find((x) => x.key === assignVariant(viewerId, e.id));
    return { ...t, displayTitle: (v?.payload as { title?: string })?.title ?? t.title };
  });
}

export const media = (key?: string | null) => (key ? `/api/media/${key.split("/").map(encodeURIComponent).join("/")}` : null);
