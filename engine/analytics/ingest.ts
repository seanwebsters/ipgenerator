import { db, Prisma } from "../../lib/db";
import { errorMessage } from "../../lib/errors";
import { log } from "../../lib/log";
import { videoMetrics, youtubeConfigured } from "../channels/youtube";
import { twoProportion, wilson } from "./stats";

/**
 * Aggregate raw WEBSTER WORLD events into per-title snapshots, and pull
 * YouTube Analytics for YouTube publications when connected. Nothing here
 * fabricates numbers: a title with no events gets a snapshot of zeros and
 * sampleSize 0, which downstream logic treats as "insufficient data".
 */

export interface TitleMetrics {
  impressions: number; // unique viewers shown the title
  plays: number; // unique viewers who pressed play
  completions: number; // unique viewers who finished
  playRate: number | null;
  playRateLow: number | null;
  playRateHigh: number | null;
  completionRate: number | null;
  avgWatchSec: number | null;
  favorites: number;
  shares: number;
  /** Unique viewers that were internal QA sessions (included in the counts above). */
  qaViewers: number;
}

export async function titleMetrics(titleId: string, since?: Date, filter: { experimentId?: string; variant?: string } = {}): Promise<TitleMetrics> {
  const where = { titleId, ...(since ? { occurredAt: { gte: since } } : {}), ...filter };
  const distinct = async (type: string) =>
    (await db.analyticsEvent.findMany({ where: { ...where, type }, distinct: ["viewerId"], select: { viewerId: true } })).length;
  const [impressions, plays, completions, favorites, shares] = await Promise.all([
    distinct("impression"),
    distinct("play"),
    distinct("complete"),
    distinct("favorite"),
    db.analyticsEvent.count({ where: { ...where, type: "share" } }),
  ]);
  const progress = await db.analyticsEvent.groupBy({ by: ["viewerId"], where: { ...where, type: "progress" }, _max: { value: true } });
  const watched = progress.map((p) => p._max.value ?? 0).filter((v) => v > 0);
  const qaViewers = (await db.analyticsEvent.findMany({ where: { ...where, viewerId: { startsWith: "qa-" } }, distinct: ["viewerId"], select: { viewerId: true } })).length;
  const pr = wilson(plays, impressions);
  return {
    impressions,
    plays,
    completions,
    playRate: pr.rate,
    playRateLow: pr.low,
    playRateHigh: pr.high,
    completionRate: plays ? completions / plays : null,
    avgWatchSec: watched.length ? watched.reduce((a, b) => a + b, 0) / watched.length : null,
    favorites,
    shares,
    qaViewers,
  };
}

export async function ingestAll() {
  const now = new Date();
  const titles = await db.worldTitle.findMany({ where: { kind: "WATCH" } });
  for (const t of titles) {
    const m = await titleMetrics(t.id);
    await db.metricSnapshot.create({
      data: { source: "webster-world", titleId: t.id, franchiseId: t.franchiseId, windowStart: t.publishedAt, windowEnd: now, metrics: m as unknown as Prisma.InputJsonValue, sampleSize: m.impressions },
    });
  }
  let youtube = 0;
  if (youtubeConfigured()) {
    const pubs = await db.publication.findMany({ where: { channelKey: "youtube", status: "PUBLISHED" }, include: { release: true } });
    for (const p of pubs) {
      try {
        const m = await videoMetrics(p.externalId!, p.publishedAt ?? p.createdAt);
        if (!m) continue;
        await db.metricSnapshot.create({
          data: { source: "youtube", publicationId: p.id, franchiseId: p.release.franchiseId, windowStart: p.publishedAt ?? p.createdAt, windowEnd: now, metrics: m as unknown as Prisma.InputJsonValue, sampleSize: m.views },
        });
        youtube++;
      } catch (err) {
        log("warn", "youtube analytics failed", { publication: p.id, error: errorMessage(err) });
      }
    }
  }
  return { titles: titles.length, youtube };
}

/** Per-arm counts for a running A/B experiment on a WEBSTER WORLD title. */
export async function experimentArms(experimentId: string, titleId: string, metric: "play_rate" | "completion_rate") {
  const arms: Record<string, { n: number; successes: number; rate: number | null; ciLow: number | null; ciHigh: number | null }> = {};
  for (const variant of ["A", "B"]) {
    const m = await titleMetrics(titleId, undefined, { experimentId, variant });
    const n = metric === "play_rate" ? m.impressions : m.plays;
    const successes = metric === "play_rate" ? m.plays : m.completions;
    const w = wilson(successes, n);
    arms[variant] = { n, successes, rate: w.rate, ciLow: w.low, ciHigh: w.high };
  }
  return { arms, test: twoProportion(arms.A.successes, arms.A.n, arms.B.successes, arms.B.n) };
}
