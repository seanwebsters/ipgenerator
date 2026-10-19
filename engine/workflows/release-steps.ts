import { db, Prisma } from "../../lib/db";
import { channelStatus, publishToChannel } from "../channels";
import { decide } from "../policy";
import { enqueue } from "../queue";
import type { StepDef } from "../workflow";

/**
 * Release steps shared by every production format:
 * publication approval (policy-aware) → publish via authorised integrations →
 * schedule measurement. The format's own `package` step must create the
 * Release and store its id in `ctx.state.releaseId`.
 */

const LEARNING_DELAY_MIN = () => Number(process.env.LEARNING_REVIEW_DELAY_MIN ?? 10);

/** Disclosure text derived from asset provenance, never hand-written. */
export function buildDisclosure(input: { writingProvider: string; writingIsDemo: boolean; assets: { kind: string; aiGenerated: boolean; provider: string }[]; format: string }) {
  const writing = input.writingIsDemo ? "DEMO placeholder writing from Studio's deterministic demo generator" : `AI-assisted writing (${input.writingProvider})`;
  const visualKinds = ["STORYBOARD_FRAME", "KEY_ART", "POSTER", "DOCUMENT"];
  const art = input.assets.some((a) => visualKinds.includes(a.kind) && a.aiGenerated) ? "AI-generated art" : "art rendered by Studio's in-house procedural renderer";
  const hasAudio = input.assets.some((a) => a.kind === "AUDIO");
  const audio = !hasAudio ? null : input.assets.some((a) => a.kind === "AUDIO" && a.aiGenerated) ? "synthetic voices from a licensed voice library" : "an in-house procedural temp score";
  return `Made by Studio with ${writing}, ${art}${audio ? ` and ${audio}` : ""}. ${input.format}`;
}

const releaseIdOf = (ctx: { state: Record<string, unknown>; outputs: Record<string, unknown> }) =>
  (ctx.state.releaseId as string | undefined) ?? (ctx.outputs.package as { releaseId?: string } | undefined)?.releaseId ?? "";

export function releaseSteps(noun: string): StepDef[] {
  return [
    {
      key: "publish_gate",
      agent: "chief.studio",
      title: "Publication approval",
      async run(ctx) {
        const releaseId = releaseIdOf(ctx);
        const release = await db.release.findUniqueOrThrow({ where: { id: releaseId }, include: { production: { include: { assets: true } } } });
        const channels = (release.channels as string[]).map((key) => ({ key, status: channelStatus(key) }));
        const policy = await decide({ kind: "PUBLISH", channels: channels.filter((c) => c.status === "CONNECTED").map((c) => c.key), isDemo: release.isDemo, ageRating: release.ageRating });
        const run = await db.workflowRun.findUniqueOrThrow({ where: { id: ctx.run.id } });
        const pick = (k: string) => release.production.assets.filter((a) => a.kind === k && a.mimeType !== "video/webm").sort((a, b) => b.revision - a.revision)[0]?.storageKey;
        const pages = release.production.assets.filter((a) => a.kind === "DOCUMENT").map((a) => a.storageKey);
        const outcome = await ctx.approval(
          {
            kind: "PUBLISH",
            title: `Publish "${release.title}"`,
            summary: `${release.description}\n\nDisclosure: ${release.aiDisclosure}`,
            payload: {
              releaseId,
              format: release.production.format,
              posterKey: pick("POSTER"),
              videoKey: pick("VIDEO"),
              pageKeys: pages,
              channels,
              runCostUsd: Number(run.costUsd),
              qa: release.production.qa,
              policy: policy.reason,
            } as Prisma.InputJsonValue,
            costEstimateUsd: Number(run.costUsd),
            franchiseId: release.franchiseId,
          },
          { autoApprove: !policy.requiresHuman, autoReason: policy.reason },
        );
        if (!outcome.approved) {
          await db.release.update({ where: { id: releaseId }, data: { status: "REJECTED" } });
          ctx.cancel(outcome.note ? `Publication declined: ${outcome.note}` : "Publication declined.");
        }
        await db.release.update({ where: { id: releaseId }, data: { status: "APPROVED" } });
        return { approvedBy: outcome.decidedBy, auto: outcome.auto, policy: policy.reason };
      },
    },
    {
      key: "publish",
      agent: "marketing.lead",
      title: "Publish via authorised integrations",
      maxAttempts: 4,
      async run(ctx) {
        const releaseId = releaseIdOf(ctx);
        const release = await db.release.findUniqueOrThrow({ where: { id: releaseId } });
        const settings = await db.studioSettings.findUniqueOrThrow({ where: { id: "studio" } });
        await db.release.update({ where: { id: releaseId }, data: { status: "PUBLISHING" } });
        const results: { channel: string; status: string; url?: string | null; error?: string | null }[] = [];
        for (const ch of release.channels as string[]) {
          // DEMO releases are never sent to external platforms.
          if (release.isDemo && ch !== "webster-world") {
            results.push({ channel: ch, status: "SKIPPED_DEMO", error: "DEMO content is not published externally." });
            continue;
          }
          try {
            const p = await publishToChannel(releaseId, ch, { runId: ctx.run.id, privacy: settings.externalPrivacy });
            results.push({ channel: ch, status: p.status, url: p.url, error: p.error });
          } catch (err) {
            results.push({ channel: ch, status: "FAILED", error: String(err instanceof Error ? err.message : err) });
          }
        }
        for (const r of results) await ctx.log(`${r.channel}: ${r.status}${r.error ? ` — ${r.error}` : ""}`, undefined, r.status === "FAILED" ? "error" : "info");
        const published = results.filter((r) => r.status === "PUBLISHED").length;
        const failed = results.filter((r) => r.status === "FAILED");
        if (!published && failed.length) throw new Error(`All publications failed: ${failed.map((f) => `${f.channel}: ${f.error}`).join("; ")}`);
        await db.release.update({ where: { id: releaseId }, data: { status: failed.length ? "PARTIAL" : "PUBLISHED" } });
        await db.production.update({ where: { id: release.productionId }, data: { status: "RELEASED" } });
        await db.auditLog.create({ data: { actor: `agent:${ctx.agentKey}`, action: "release.publish", targetType: "Release", targetId: releaseId, data: results as unknown as Prisma.InputJsonValue, traceId: ctx.run.traceId } });
        return { results };
      },
    },
    {
      key: "measure",
      agent: "audience.lead",
      title: "Schedule analytics ingestion and learning review",
      async run(ctx) {
        const releaseId = releaseIdOf(ctx);
        const title = await db.worldTitle.findUnique({ where: { releaseId } });
        await enqueue("analytics.ingest", {}, { idempotencyKey: `ingest:after:${releaseId}` });
        if (title) {
          const at = new Date(Date.now() + LEARNING_DELAY_MIN() * 60_000);
          await enqueue("learning.review", { titleId: title.id }, { runAt: at, idempotencyKey: `learning:${title.id}:first` });
          await ctx.log(`Learning review for this ${noun} scheduled for ${at.toISOString()}`);
        }
        return { titleId: title?.id ?? null };
      },
    },
  ];
}
