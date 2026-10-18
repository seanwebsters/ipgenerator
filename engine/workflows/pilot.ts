import path from "node:path";
import { readFile } from "node:fs/promises";
import { db, Prisma } from "../../lib/db";
import { PolicyError } from "../../lib/errors";
import { canonDigest, establishBible, validateScript } from "../canon";
import { publishToChannel, channelStatus } from "../channels";
import { assembleAnimatic, mixDialogue, probe, tempScore, type Cue } from "../media/ffmpeg";
import { toJpeg } from "../media/render";
import { generateImage } from "../providers/image";
import { speak, voiceConfigured } from "../providers/voice";
import { decide } from "../policy";
import { enqueue } from "../queue";
import { localFile, putObject, workDir } from "../storage";
import { writeBible, type Concepts } from "../tasks/ip";
import { critiqueScript, packageRelease, writePilot, type PilotScript } from "../tasks/production";
import { screenOriginality } from "../tasks/originality";
import { registerWorkflow, type StepContext, type WorkflowDef } from "../workflow";
import { buildDisclosure, releaseSteps } from "./release-steps";
import type { AssetKind, RightsStatus } from "../../generated/prisma/client";

export interface PilotInput {
  franchiseId: string;
  conceptId: string;
  /** 1 = pilot; later episodes reuse established canon. */
  episode?: number;
  /** Creative direction from Franchise Development. */
  direction?: string;
  opportunityId?: string;
}

const CROSSFADE = 0.6;
const LEARNING_DELAY_MIN = Number(process.env.LEARNING_REVIEW_DELAY_MIN ?? 10);

const meta = (ctx: StepContext<any>) => ({ runId: ctx.run.id, stepKey: ctx.stepKey, agentKey: ctx.agentKey });

/* ───────────── shot planning (deterministic) ───────────── */

export interface PlannedShot {
  index: number;
  scene: number;
  framing: string;
  characters: string[];
  description: string;
  caption: string | null;
  speaker: string | null;
  line: string | null;
  durationSec: number;
}

export function planShots(script: PilotScript, castNames: string[]): PlannedShot[] {
  const shots: PlannedShot[] = [];
  const resolve = (n: string) => castNames.find((c) => c.toLowerCase() === n.toLowerCase() || c.split(" ")[0].toLowerCase() === n.toLowerCase()) ?? n;
  script.scenes.forEach((s, si) => {
    const present = [...new Set(s.dialogue.map((d) => resolve(d.character)))];
    shots.push({ index: shots.length, scene: si + 1, framing: s.framing, characters: present, description: `${s.heading}. ${s.action}`, caption: null, speaker: null, line: null, durationSec: 3.4 });
    for (const d of s.dialogue) {
      const speaker = resolve(d.character);
      const words = d.line.split(/\s+/).length;
      const others = present.filter((p) => p !== speaker);
      shots.push({
        index: shots.length,
        scene: si + 1,
        framing: d.framing,
        characters: d.framing === "close" ? [speaker] : [speaker, ...others].slice(0, d.framing === "medium" ? 2 : 4),
        description: `${s.heading}. ${speaker} speaks.`,
        caption: `${speaker.split(" ")[0].toUpperCase()}: ${d.line}`,
        speaker,
        line: d.line,
        durationSec: Math.min(5.5, Math.max(2.6, 1.3 + words * 0.36)),
      });
    }
  });
  return shots;
}

export function cuesFor(shots: PlannedShot[]): Cue[] {
  const cues: Cue[] = [];
  let t = 0;
  shots.forEach((s, i) => {
    const start = t;
    if (s.caption) cues.push({ start: start + 0.35, end: start + s.durationSec - CROSSFADE - 0.1, text: s.caption });
    t += s.durationSec - (i < shots.length - 1 ? CROSSFADE : 0);
  });
  return cues;
}

/* ───────────── asset persistence ───────────── */

async function saveAsset(input: {
  ctx: StepContext<PilotInput>;
  productionId?: string;
  kind: AssetKind;
  title: string;
  key: string;
  body: Buffer;
  mimeType: string;
  provider: string;
  model?: string;
  prompt?: string;
  seed?: number;
  params?: Prisma.InputJsonValue;
  width?: number;
  height?: number;
  durationSec?: number;
  rightsStatus: RightsStatus;
  rightsNotes: string;
  aiGenerated: boolean;
  entityIds?: string[];
}) {
  const stored = await putObject(input.key, input.body, input.mimeType);
  const f = await db.franchise.findUniqueOrThrow({ where: { id: input.ctx.input.franchiseId } });
  const prev = await db.asset.count({ where: { franchiseId: f.id, productionId: input.productionId, kind: input.kind, title: input.title } });
  return db.asset.create({
    data: {
      franchiseId: f.id,
      productionId: input.productionId,
      kind: input.kind,
      title: input.title,
      storageKey: stored.key,
      mimeType: input.mimeType,
      bytes: stored.bytes,
      checksum: stored.checksum,
      width: input.width,
      height: input.height,
      durationSec: input.durationSec,
      provider: input.provider,
      model: input.model,
      prompt: input.prompt,
      seed: input.seed,
      params: input.params ?? {},
      revision: prev + 1,
      rightsStatus: input.rightsStatus,
      rightsNotes: input.rightsNotes,
      aiGenerated: input.aiGenerated,
      status: "IN_REVIEW",
      canonVersion: f.canonVersion,
      isDemo: f.isDemo,
      runId: input.ctx.run.id,
      stepKey: input.ctx.stepKey,
      entities: input.entityIds?.length ? { create: input.entityIds.map((entityId) => ({ entityId })) } : undefined,
    },
  });
}

async function characterIndex(franchiseId: string) {
  const chars = await db.canonEntity.findMany({ where: { franchiseId, type: "CHARACTER", status: "ESTABLISHED" } });
  return chars.map((c) => ({ id: c.id, name: c.name, color: (c.data as { color?: string }).color ?? "#c9a35c", appearance: (c.data as { appearance?: string }).appearance ?? "" }));
}

/* ───────────── workflow ───────────── */

export const pilot: WorkflowDef<PilotInput> = {
  type: "franchise.pilot",
  title: (i) => ((i.episode ?? 1) > 1 ? `Episode ${i.episode} production` : "Pilot production"),
  steps: [
    {
      key: "bible",
      agent: "iplab.lead",
      title: "Write and establish the canon bible (v1)",
      async run(ctx) {
        const f = await db.franchise.findUniqueOrThrow({ where: { id: ctx.input.franchiseId } });
        if (f.canonVersion > 0) return { reused: true, canonVersion: f.canonVersion };
        const c = await db.concept.findUniqueOrThrow({ where: { id: ctx.input.conceptId } });
        const concept: Concepts["concepts"][number] = {
          title: c.title,
          logline: c.logline,
          genre: c.genre,
          audience: c.audience,
          tone: c.tone,
          hook: c.hook,
          ageRating: c.ageRating,
          comparables: c.comparables as string[],
          formats: c.formats as string[],
          palette: c.palette as string[],
          leadCharacter: String((c.scores as { leadCharacter?: string }).leadCharacter ?? "The Lead"),
        };
        const res = await writeBible(concept, meta(ctx));
        const universe = await db.universe.upsert({
          where: { slug: `${f.slug}-universe` },
          create: { slug: `${f.slug}-universe`, name: res.data.universe.name, description: res.data.universe.description, status: "ESTABLISHED", isDemo: res.isDemo },
          update: {},
        });
        await db.franchise.update({ where: { id: f.id }, data: { universeId: universe.id } });
        const established = await establishBible(f.id, res.data, `agent:${ctx.agentKey}`);
        for (const i of established.issues) await ctx.log(`Canon validation: ${i.message}`, undefined, i.severity === "error" ? "error" : "warn");
        await ctx.log(`Canon v1 established: ${established.characters} characters, hash ${established.hash.slice(0, 12)}`);
        return { canonVersion: 1, hash: established.hash, provider: res.provider, isDemo: res.isDemo };
      },
    },
    {
      key: "script",
      agent: "writers.lead",
      title: "Writers' Room: pilot short script",
      async run(ctx) {
        const canon = await canonDigest(ctx.input.franchiseId);
        const feedback = (ctx.state.feedback as string[] | undefined) ?? undefined;
        const previously = (await db.script.findMany({ where: { franchiseId: ctx.input.franchiseId, production: { status: "RELEASED" } }, orderBy: { createdAt: "asc" } })).map((x) => `${x.title}: ${x.logline}`);
        const res = await writePilot({ canon, franchiseId: ctx.input.franchiseId, feedback, episode: ctx.input.episode ?? 1, direction: ctx.input.direction, previously }, meta(ctx));
        const f = await db.franchise.findUniqueOrThrow({ where: { id: ctx.input.franchiseId } });
        const existing = ctx.state.productionId ? await db.production.findUnique({ where: { id: ctx.state.productionId as string } }) : null;
        const production =
          existing ?? (await db.production.create({ data: { franchiseId: f.id, title: res.data.title, format: (ctx.input.episode ?? 1) > 1 ? "EPISODE" : "SHORT", status: "PRE_PRODUCTION", ageRating: f.ageRating, isDemo: f.isDemo } }));
        ctx.state.productionId = production.id;
        const revision = (await db.script.count({ where: { productionId: production.id } })) + 1;
        const script = await db.script.create({
          data: {
            franchiseId: f.id,
            productionId: production.id,
            title: res.data.title,
            format: "pilot-short",
            logline: res.data.logline,
            content: res.data as unknown as Prisma.InputJsonValue,
            revision,
            canonVersion: f.canonVersion,
            provider: res.provider,
            isDemo: res.isDemo,
          },
        });
        await db.production.update({ where: { id: production.id }, data: { title: res.data.title } });
        await ctx.log(`Script r${revision}: "${res.data.title}" — ${res.data.scenes.length} scenes`);
        return { scriptId: script.id, productionId: production.id, revision };
      },
    },
    {
      key: "continuity",
      agent: "quality.canon",
      title: "Canon continuity check",
      async run(ctx) {
        const { scriptId } = ctx.outputs.script as { scriptId: string };
        const script = await db.script.findUniqueOrThrow({ where: { id: scriptId } });
        const canon = await canonDigest(ctx.input.franchiseId);
        const issues = validateScript(script.content as unknown as PilotScript, canon);
        await db.script.update({ where: { id: scriptId }, data: { validation: { issues } as unknown as Prisma.InputJsonValue } });
        const errors = issues.filter((i) => i.severity === "error");
        for (const i of issues) await ctx.log(`Continuity: ${i.message}`, undefined, i.severity === "error" ? "error" : "warn");
        if (errors.length) {
          const revisions = Number(ctx.state.revisions ?? 0);
          if (revisions < 2) {
            ctx.state.revisions = revisions + 1;
            ctx.state.feedback = errors.map((e) => e.message);
            ctx.goto("script", "canon continuity errors");
          }
          throw new PolicyError(`Script still breaks canon after ${revisions} revisions: ${errors.map((e) => e.message).join("; ")}`);
        }
        return { issues };
      },
    },
    {
      key: "storyboard",
      agent: "visual.lead",
      title: "Visual Development: storyboard frames",
      async run(ctx) {
        const { scriptId, productionId } = ctx.outputs.script as { scriptId: string; productionId: string };
        const script = (await db.script.findUniqueOrThrow({ where: { id: scriptId } })).content as unknown as PilotScript;
        const f = await db.franchise.findUniqueOrThrow({ where: { id: ctx.input.franchiseId } });
        const cast = await characterIndex(f.id);
        const style = await db.canonEntity.findFirst({ where: { franchiseId: f.id, type: "STYLE_GUIDE" } });
        const styleText = style ? Object.values(style.data as Record<string, unknown>).flat().join("; ") : "";
        const shots = planShots(script, cast.map((c) => c.name));
        const frames: { assetId: string; key: string; durationSec: number }[] = [];
        for (const s of shots) {
          const present = cast.filter((c) => s.characters.includes(c.name));
          const prompt = `Storyboard frame, ${s.framing} shot. ${s.description} Characters: ${present.map((c) => `${c.name} (${c.appearance})`).join(", ") || "none"}. Style: ${styleText}`;
          const img = await generateImage({
            ...meta(ctx),
            task: "visual.frames",
            prompt,
            scene: { seed: `${f.id}:${scriptId}:${s.index}`, width: 1280, height: 720, palette: f.palette as string[], cast: present.map((c) => ({ name: c.name, color: c.color })), framing: s.framing, slug: `SC ${s.scene} · SHOT ${s.index + 1} · ${s.framing}` },
          });
          const a = await saveAsset({
            ctx,
            productionId,
            kind: "STORYBOARD_FRAME",
            title: `Shot ${s.index + 1}`,
            key: `franchises/${f.id}/${productionId}/frames/${String(s.index + 1).padStart(2, "0")}-r${ctx.attempt}.png`,
            body: img.png,
            mimeType: "image/png",
            provider: img.provider,
            model: img.model,
            prompt,
            params: { index: s.index, framing: s.framing, scene: s.scene, durationSec: s.durationSec, caption: s.caption },
            width: 1280,
            height: 720,
            rightsStatus: "OWNED_GENERATED",
            rightsNotes: img.rightsNotes,
            aiGenerated: img.aiGenerated,
            entityIds: present.map((c) => c.id),
          });
          frames.push({ assetId: a.id, key: a.storageKey, durationSec: s.durationSec });
        }
        await ctx.log(`${frames.length} storyboard frames rendered`);
        return { frames, shots };
      },
    },
    {
      key: "keyart",
      agent: "visual.keyart",
      title: "Key art and poster",
      async run(ctx) {
        const { productionId } = ctx.outputs.script as { productionId: string };
        const f = await db.franchise.findUniqueOrThrow({ where: { id: ctx.input.franchiseId } });
        const cast = await characterIndex(f.id);
        const castSpec = cast.slice(0, 4).map((c) => ({ name: c.name, color: c.color }));
        const prompt = `Key art for "${f.title}": ${f.logline} Cast: ${cast.map((c) => `${c.name} (${c.appearance})`).join(", ")}.`;
        const poster = await generateImage({ ...meta(ctx), task: "visual.keyart", prompt: `${prompt} Vertical poster with title.`, scene: { seed: `${f.id}:poster`, width: 800, height: 1200, palette: f.palette as string[], cast: castSpec, framing: "wide", title: f.title, tagline: f.tone.split(",")[0] } });
        const backdrop = await generateImage({ ...meta(ctx), task: "visual.keyart", prompt: `${prompt} Wide cinematic backdrop, no text.`, scene: { seed: `${f.id}:backdrop`, width: 1600, height: 900, palette: f.palette as string[], cast: castSpec, framing: "establishing" } });
        const common = { ctx, productionId, rightsStatus: "OWNED_GENERATED" as const, entityIds: cast.slice(0, 4).map((c) => c.id) };
        const p = await saveAsset({ ...common, kind: "POSTER", title: "Poster", key: `franchises/${f.id}/${productionId}/poster-r${ctx.attempt}.jpg`, body: await toJpeg(poster.png), mimeType: "image/jpeg", provider: poster.provider, model: poster.model, prompt, width: 800, height: 1200, rightsNotes: poster.rightsNotes, aiGenerated: poster.aiGenerated });
        const b = await saveAsset({ ...common, kind: "KEY_ART", title: "Backdrop", key: `franchises/${f.id}/${productionId}/backdrop-r${ctx.attempt}.jpg`, body: await toJpeg(backdrop.png), mimeType: "image/jpeg", provider: backdrop.provider, model: backdrop.model, prompt, width: 1600, height: 900, rightsNotes: backdrop.rightsNotes, aiGenerated: backdrop.aiGenerated });
        return { posterId: p.id, backdropId: b.id };
      },
    },
    {
      key: "audio",
      agent: "audio.lead",
      title: "Music & Audio: score and voices",
      async run(ctx) {
        const { productionId } = ctx.outputs.script as { productionId: string };
        const { shots } = ctx.outputs.storyboard as { shots: PlannedShot[] };
        const total = shots.reduce((n, s) => n + s.durationSec, 0) - CROSSFADE * (shots.length - 1);
        const dir = await workDir(`franchises/${ctx.input.franchiseId}/${productionId}/audio-r${ctx.attempt}`);
        const score = path.join(dir, "score.m4a");
        await tempScore(score, total + 0.5, ctx.input.franchiseId);
        let bed = score;
        let voiced = 0;
        if (await voiceConfigured()) {
          const cues = cuesFor(shots);
          const lines: { file: string; start: number }[] = [];
          for (const [i, s] of shots.filter((x) => x.line).entries()) {
            const mp3 = await speak(s.line!, meta(ctx));
            if (!mp3) break;
            const file = path.join(dir, `line-${i}.mp3`);
            await import("node:fs/promises").then((fs) => fs.writeFile(file, mp3));
            lines.push({ file, start: cues[i]?.start ?? 0 });
          }
          if (lines.length) {
            bed = await mixDialogue(score, lines, path.join(dir, "mix.m4a"));
            voiced = lines.length;
          }
        }
        await ctx.log(voiced ? `Mixed ${voiced} voiced lines over the temp score` : "No licensed voice configured: temp score only, dialogue carried by captions");
        const f = await db.franchise.findUniqueOrThrow({ where: { id: ctx.input.franchiseId } });
        const a = await saveAsset({
          ctx,
          productionId,
          kind: "AUDIO",
          title: voiced ? "Dialogue mix" : "Temp score",
          key: `franchises/${f.id}/${productionId}/audio-r${ctx.attempt}.m4a`,
          body: await readFile(bed),
          mimeType: "audio/mp4",
          provider: voiced ? "elevenlabs+ffmpeg" : "ffmpeg-procedural",
          model: voiced ? process.env.ELEVENLABS_MODEL ?? "eleven_flash_v2_5" : "temp-score-v1",
          durationSec: total,
          rightsStatus: voiced ? "LICENSED" : "OWNED_GENERATED",
          rightsNotes: voiced ? "Voice from the studio's licensed ElevenLabs library voice; score synthesised in-house." : "Procedural temp score synthesised by FFmpeg in-house.",
          aiGenerated: voiced > 0,
        });
        return { assetId: a.id, voiced };
      },
    },
    {
      key: "animatic",
      agent: "animation.lead",
      title: "Animation & Video: assemble animatic",
      async run(ctx) {
        const { productionId } = ctx.outputs.script as { productionId: string };
        const { frames, shots } = ctx.outputs.storyboard as { frames: { key: string; durationSec: number }[]; shots: PlannedShot[] };
        const { assetId: audioId, voiced } = ctx.outputs.audio as { assetId: string; voiced: number };
        const f = await db.franchise.findUniqueOrThrow({ where: { id: ctx.input.franchiseId } });
        const dir = await workDir(`franchises/${f.id}/${productionId}/animatic-r${ctx.attempt}`);
        // Inputs come from storage, not the earlier step's disk: steps may run on different machines.
        const audio = await localFile((await db.asset.findUniqueOrThrow({ where: { id: audioId } })).storageKey);
        const images = await Promise.all(frames.map((fr) => localFile(fr.key)));
        const out = await assembleAnimatic({ shots: frames.map((fr, i) => ({ image: images[i], durationSec: fr.durationSec })), cues: cuesFor(shots), audio, dir, seed: f.id });
        const cast = await characterIndex(f.id);
        const video = await saveAsset({
          ctx,
          productionId,
          kind: "VIDEO",
          title: "Animatic pilot",
          key: `franchises/${f.id}/${productionId}/animatic-r${ctx.attempt}.mp4`,
          body: await readFile(out.video),
          mimeType: "video/mp4",
          provider: "ffmpeg",
          model: "animatic-assembler-v1",
          params: { shots: frames.length, voiced },
          width: 1280,
          height: 720,
          durationSec: out.durationSec,
          rightsStatus: "OWNED_GENERATED",
          rightsNotes: "Assembled in-house from studio-owned frames and audio.",
          aiGenerated: false,
          entityIds: cast.map((c) => c.id),
        });
        await saveAsset({
          ctx,
          productionId,
          kind: "VIDEO",
          title: "Animatic pilot (WebM)",
          key: `franchises/${f.id}/${productionId}/animatic-r${ctx.attempt}.webm`,
          body: await readFile(out.webm),
          mimeType: "video/webm",
          provider: "ffmpeg",
          model: "animatic-assembler-v1",
          width: 1280,
          height: 720,
          durationSec: out.durationSec,
          rightsStatus: "OWNED_GENERATED",
          rightsNotes: "Open-codec rendition of the studio-owned animatic.",
          aiGenerated: false,
        });
        const captions = await saveAsset({
          ctx,
          productionId,
          kind: "CAPTIONS",
          title: "Captions (WebVTT)",
          key: `franchises/${f.id}/${productionId}/captions-r${ctx.attempt}.vtt`,
          body: await readFile(out.vtt),
          mimeType: "text/vtt",
          provider: "ffmpeg",
          rightsStatus: "OWNED_GENERATED",
          rightsNotes: "Derived from the studio script.",
          aiGenerated: false,
        });
        await db.production.update({ where: { id: productionId }, data: { status: "QA", runtimeSec: Math.round(out.durationSec) } });
        await ctx.log(`Animatic rendered: ${out.durationSec.toFixed(1)}s, ${frames.length} shots`);
        return { videoId: video.id, captionsId: captions.id, durationSec: out.durationSec };
      },
    },
    {
      key: "qa",
      agent: "quality.lead",
      title: "Quality & Safety review",
      async run(ctx) {
        const { scriptId, productionId } = ctx.outputs.script as { scriptId: string; productionId: string };
        const { videoId } = ctx.outputs.animatic as { videoId: string };
        const f = await db.franchise.findUniqueOrThrow({ where: { id: ctx.input.franchiseId } });
        const video = await db.asset.findUniqueOrThrow({ where: { id: videoId } });
        const tech = await probe(await localFile(video.storageKey));
        const technical = [
          { check: "Duration 20-240s", pass: tech.durationSec >= 20 && tech.durationSec <= 240, value: `${tech.durationSec.toFixed(1)}s` },
          { check: "1280x720", pass: tech.width === 1280 && tech.height === 720, value: `${tech.width}x${tech.height}` },
          { check: "H.264 video", pass: tech.videoCodec === "h264", value: tech.videoCodec },
          { check: "AAC audio", pass: tech.audioCodec === "aac", value: tech.audioCodec },
          { check: "Audible, not clipping (-50 to -6 dB mean)", pass: tech.meanVolumeDb != null && tech.meanVolumeDb > -50 && tech.meanVolumeDb < -6, value: `${tech.meanVolumeDb} dB` },
        ];
        const script = (await db.script.findUniqueOrThrow({ where: { id: scriptId } })).content as unknown as PilotScript;
        const canon = await canonDigest(f.id);
        const critique = await critiqueScript({ script, canon }, meta(ctx));
        const order = ["ALL", "AGE_7", "AGE_13", "AGE_16", "AGE_18"];
        const suitabilityOk = order.indexOf(critique.data.suitability) <= order.indexOf(f.ageRating);
        const assets = await db.asset.findMany({ where: { productionId } });
        const rightsProblems = assets.filter((a) => a.rightsStatus === "NEEDS_REVIEW" || a.rightsStatus === "RESTRICTED");
        const originality = screenOriginality([{ field: "title", text: script.title, isName: true }, ...canon.characters.map((c) => ({ field: "character", text: c.name, isName: true }))]);

        const blocking = [
          ...technical.filter((t) => !t.pass).map((t) => `Technical: ${t.check} (got ${t.value})`),
          ...critique.data.issues.filter((i) => i.severity === "blocking").map((i) => `Story: ${i.note}`),
          ...(suitabilityOk ? [] : [`Suitability: script reads as ${critique.data.suitability}, franchise is ${f.ageRating}`]),
          ...rightsProblems.map((a) => `Rights: ${a.kind} "${a.title}" is ${a.rightsStatus}`),
          ...originality.map((o) => `Originality: ${o.field} "${o.text}" resembles ${o.matches}`),
        ];
        const report = { technical, critique: critique.data, suitabilityOk, rights: { checked: assets.length, problems: rightsProblems.length }, originality, blocking, critiqueProvider: critique.provider };
        await db.production.update({ where: { id: productionId }, data: { qa: report as unknown as Prisma.InputJsonValue } });
        await ctx.log(`QA: ${technical.filter((t) => t.pass).length}/${technical.length} technical checks, craft ${critique.data.score}/100, ${blocking.length} blocking`);

        if (blocking.length) {
          const revisions = Number(ctx.state.qaRevisions ?? 0);
          const storyOnly = blocking.every((b) => b.startsWith("Story:") || b.startsWith("Suitability:"));
          if (storyOnly && revisions < 1) {
            ctx.state.qaRevisions = revisions + 1;
            ctx.state.feedback = blocking;
            ctx.goto("script", "QA requested a story revision");
          }
          throw new PolicyError(`QA blocked the release: ${blocking.join("; ")}`);
        }
        await db.asset.updateMany({ where: { productionId, status: "IN_REVIEW" }, data: { status: "APPROVED" } });
        await db.production.update({ where: { id: productionId }, data: { status: "READY" } });
        return report;
      },
    },
    {
      key: "package",
      agent: "marketing.lead",
      title: "Marketing: release package and disclosure",
      async run(ctx) {
        const { scriptId, productionId } = ctx.outputs.script as { scriptId: string; productionId: string };
        const f = await db.franchise.findUniqueOrThrow({ where: { id: ctx.input.franchiseId } });
        const script = await db.script.findUniqueOrThrow({ where: { id: scriptId } });
        const pkg = await packageRelease({ franchise: f.title, script: script.content as unknown as PilotScript, ageRating: f.ageRating, audience: f.audience }, meta(ctx));
        const assets = await db.asset.findMany({ where: { productionId } });
        const episode = Number(ctx.input.episode ?? 1);
        const disclosure = buildDisclosure({ writingProvider: script.provider, writingIsDemo: script.isDemo, assets, format: episode > 1 ? `Presented as an animatic, episode ${episode}.` : "Presented as an animatic pilot." });
        const channels = ["webster-world", "youtube"];
        const release = await db.release.create({
          data: {
            franchiseId: f.id,
            productionId,
            title: pkg.data.title,
            description: pkg.data.description,
            tags: pkg.data.tags,
            ageRating: f.ageRating,
            aiDisclosure: disclosure,
            containsSyntheticMedia: true,
            channels,
            status: "PENDING_APPROVAL",
            isDemo: f.isDemo || script.isDemo,
          },
        });
        ctx.state.releaseId = release.id;
        return { releaseId: release.id, package: pkg.data, disclosure };
      },
    },
    ...releaseSteps("pilot"),
  ],
  async onComplete(run) {
    const f = run.franchiseId ? await db.franchise.findUnique({ where: { id: run.franchiseId } }) : null;
    await db.notification.create({ data: { kind: "release", title: `${f?.title ?? "Pilot"} pilot is live on WEBSTER WORLD`, body: "Real audience data will be ingested as viewers watch.", href: f ? `/os/universe/${f.slug}` : "/os" } });
  },
};

registerWorkflow(pilot);
