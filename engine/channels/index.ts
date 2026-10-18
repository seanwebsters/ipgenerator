import { db, Prisma } from "../../lib/db";
import { errorMessage } from "../../lib/errors";
import { slugify } from "../../lib/util";
import { meter } from "../metering";
import { uploadVideo, youtubeConfigured } from "./youtube";

export const CHANNELS = [
  { key: "webster-world", name: "WEBSTER WORLD", notes: "First-party destination. Always available." },
  { key: "youtube", name: "YouTube", notes: "YouTube Data API v3 resumable upload. Needs OAuth env vars." },
  { key: "tiktok", name: "TikTok", notes: "Content Posting API needs an audited app. Not implemented." },
  { key: "instagram", name: "Instagram", notes: "Graph API content publishing needs a Meta app review. Not implemented." },
] as const;

export function channelStatus(key: string): "CONNECTED" | "NOT_CONFIGURED" | "UNSUPPORTED" {
  if (key === "webster-world") return "CONNECTED";
  if (key === "youtube") return youtubeConfigured() ? "CONNECTED" : "NOT_CONFIGURED";
  return "UNSUPPORTED";
}

export async function refreshChannels() {
  for (const c of CHANNELS) {
    await db.channel.upsert({
      where: { key: c.key },
      create: { key: c.key, name: c.name, notes: c.notes, status: channelStatus(c.key), lastCheckedAt: new Date() },
      update: { status: channelStatus(c.key), lastCheckedAt: new Date(), notes: c.notes },
    });
  }
}

/**
 * Publish a release to one channel. Idempotent per (release, channel):
 * an existing PUBLISHED publication is returned untouched, so retries never
 * double-post. Unconnected channels are recorded as SKIPPED_NOT_CONNECTED
 * with setup instructions — never as a fake success.
 */
export async function publishToChannel(releaseId: string, channelKey: string, opts: { runId?: string; privacy: string }) {
  const idempotencyKey = `publish:${releaseId}:${channelKey}`;
  const existing = await db.publication.findUnique({ where: { idempotencyKey } });
  if (existing?.status === "PUBLISHED") return existing;
  const pub = existing ?? (await db.publication.create({ data: { releaseId, channelKey, idempotencyKey } }));
  const release = await db.release.findUniqueOrThrow({ where: { id: releaseId }, include: { production: { include: { assets: true } }, franchise: true } });
  const latest = (list: typeof release.production.assets) => list.sort((a, b) => b.revision - a.revision)[0];
  const asset = (kind: string) => latest(release.production.assets.filter((a) => a.kind === kind && a.mimeType !== "video/webm"));
  const video = asset("VIDEO");
  const webm = latest(release.production.assets.filter((a) => a.kind === "VIDEO" && a.mimeType === "video/webm"));

  const status = channelStatus(channelKey);
  if (status !== "CONNECTED") {
    const info = CHANNELS.find((c) => c.key === channelKey);
    return db.publication.update({
      where: { id: pub.id },
      data: { status: "SKIPPED_NOT_CONNECTED", error: `${info?.name ?? channelKey} is not connected. ${info?.notes ?? ""}` },
    });
  }

  try {
    if (channelKey === "webster-world") {
      const poster = asset("POSTER");
      const backdrop = asset("KEY_ART");
      const captions = asset("CAPTIONS");
      const slugBase = slugify(release.title);
      const title = await db.worldTitle.upsert({
        where: { releaseId },
        create: {
          slug: `${slugBase}-${release.id.slice(-5)}`,
          franchiseId: release.franchiseId,
          releaseId,
          kind: "WATCH",
          title: release.title,
          synopsis: release.description,
          ageRating: release.ageRating,
          runtimeSec: video?.durationSec ? Math.round(video.durationSec) : null,
          posterKey: poster?.storageKey,
          backdropKey: backdrop?.storageKey,
          mediaKey: video?.storageKey,
          mediaAltKey: webm?.storageKey,
          captionsKey: captions?.storageKey,
          disclosure: release.aiDisclosure,
          isDemo: release.isDemo,
        },
        update: {},
      });
      // The illustrated script becomes a READ title in the same franchise.
      const script = await db.script.findFirst({ where: { productionId: release.productionId }, orderBy: { revision: "desc" } });
      if (script) {
        const frames = release.production.assets.filter((a) => a.kind === "STORYBOARD_FRAME").sort((a, b) => (a.params as { index: number }).index - (b.params as { index: number }).index);
        const content = script.content as { scenes: { heading: string; action: string; dialogue: { character: string; line: string }[] }[] };
        let fi = 0;
        const pages = content.scenes.map((s) => {
          const frame = frames[fi]?.storageKey;
          fi += 1 + s.dialogue.length;
          return { heading: s.heading, body: s.action, dialogue: s.dialogue, imageKey: frame ?? null };
        });
        await db.worldTitle.upsert({
          where: { slug: `${slugBase}-script-${release.id.slice(-5)}` },
          create: {
            slug: `${slugBase}-script-${release.id.slice(-5)}`,
            franchiseId: release.franchiseId,
            kind: "READ",
            title: `${release.title} — The Illustrated Script`,
            synopsis: release.description,
            ageRating: release.ageRating,
            posterKey: poster?.storageKey,
            backdropKey: backdrop?.storageKey,
            readContent: { pages } as Prisma.InputJsonValue,
            disclosure: release.aiDisclosure,
            isDemo: release.isDemo,
          },
          update: {},
        });
      }
      await db.franchise.update({ where: { id: release.franchiseId }, data: { status: "ACTIVE" } });
      return db.publication.update({
        where: { id: pub.id },
        data: { status: "PUBLISHED", externalId: title.id, url: `/watch/${title.slug}`, publishedAt: new Date(), error: null },
      });
    }

    if (channelKey === "youtube") {
      if (!video) throw new Error("No video asset to upload.");
      const result = await meter({ provider: "youtube", model: "videos.insert", task: "distribution.youtube", runId: opts.runId, estimateUsd: 0 }, async () => ({
        result: await uploadVideo({
          videoKey: video.storageKey,
          title: release.title,
          description: `${release.description}\n\n${release.aiDisclosure}`,
          tags: release.tags as string[],
          privacyStatus: (opts.privacy as "private" | "unlisted" | "public") ?? "private",
          madeForKids: release.ageRating === "ALL" || release.ageRating === "AGE_7",
        }),
        costUsd: 0,
      }));
      return db.publication.update({
        where: { id: pub.id },
        data: { status: "PUBLISHED", externalId: result.id, url: result.url, response: result.raw as Prisma.InputJsonValue, publishedAt: new Date(), error: null },
      });
    }
    throw new Error(`No publisher for ${channelKey}`);
  } catch (err) {
    await db.publication.update({ where: { id: pub.id }, data: { status: "FAILED", error: errorMessage(err).slice(0, 1000) } });
    throw err;
  }
}
