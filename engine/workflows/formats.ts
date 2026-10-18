import { db, Prisma } from "../../lib/db";
import { PolicyError } from "../../lib/errors";
import { canonDigest } from "../canon";
import { countPaths, validateStoryGraph } from "../interactive";
import { composePages, panelImage } from "../media/comic";
import { toJpeg } from "../media/render";
import { generateImage } from "../providers/image";
import { getObject, putObject } from "../storage";
import { writeInteractive, type StoryGraph } from "../tasks/expansion";
import { screenOriginality } from "../tasks/originality";
import type { PilotScript } from "../tasks/production";
import { registerWorkflow, type StepContext, type WorkflowDef } from "../workflow";
import { buildDisclosure, releaseSteps } from "./release-steps";
import type { AssetKind } from "../../generated/prisma/client";

const meta = (ctx: StepContext<any>) => ({ runId: ctx.run.id, stepKey: ctx.stepKey, agentKey: ctx.agentKey });

async function asset(ctx: StepContext<any>, productionId: string, a: { kind: AssetKind; title: string; key: string; body: Buffer; mimeType: string; provider: string; model?: string; prompt?: string; params?: Prisma.InputJsonValue; width?: number; height?: number; aiGenerated: boolean; rightsNotes: string; entityIds?: string[] }) {
  const f = await db.franchise.findUniqueOrThrow({ where: { id: ctx.input.franchiseId as string } });
  const stored = await putObject(a.key, a.body, a.mimeType);
  return db.asset.create({
    data: {
      franchiseId: f.id,
      productionId,
      kind: a.kind,
      title: a.title,
      storageKey: stored.key,
      mimeType: a.mimeType,
      bytes: stored.bytes,
      checksum: stored.checksum,
      width: a.width,
      height: a.height,
      provider: a.provider,
      model: a.model,
      prompt: a.prompt,
      params: a.params ?? {},
      rightsStatus: "OWNED_GENERATED",
      rightsNotes: a.rightsNotes,
      aiGenerated: a.aiGenerated,
      status: "IN_REVIEW",
      canonVersion: f.canonVersion,
      isDemo: f.isDemo,
      runId: ctx.run.id,
      stepKey: ctx.stepKey,
      entities: a.entityIds?.length ? { create: a.entityIds.map((entityId) => ({ entityId })) } : undefined,
    },
  });
}

/* ───────────── Comic adaptation (Publishing) ───────────── */

export interface ComicInput {
  franchiseId: string;
  sourceProductionId: string;
  opportunityId?: string;
  title?: string;
}

export const comic: WorkflowDef<ComicInput> = {
  type: "franchise.comic",
  title: () => "Comic adaptation",
  steps: [
    {
      key: "layout",
      agent: "visual.lead",
      title: "Lay out comic pages from approved storyboards",
      async run(ctx) {
        const src = await db.production.findUniqueOrThrow({ where: { id: ctx.input.sourceProductionId }, include: { assets: true, scripts: { orderBy: { revision: "desc" }, take: 1 } } });
        const f = await db.franchise.findUniqueOrThrow({ where: { id: ctx.input.franchiseId } });
        const script = src.scripts[0];
        if (!script) throw new PolicyError("Source production has no script to adapt.");
        const frames = src.assets
          .filter((a) => a.kind === "STORYBOARD_FRAME" && a.status === "APPROVED")
          .sort((a, b) => (a.params as { index: number }).index - (b.params as { index: number }).index);
        if (!frames.length) throw new PolicyError("Source storyboards are not approved; comics only reuse approved art.");
        const content = script.content as unknown as PilotScript;
        // Captions: establishing frames carry scene action, others carry the line.
        const actions = content.scenes.map((s) => s.action);
        let scene = -1;
        const panels = [];
        for (const fr of frames) {
          const p = fr.params as { caption?: string | null; scene?: number };
          if (!p.caption) scene = (p.scene ?? scene + 2) - 1;
          panels.push({ image: await panelImage(await getObject(fr.storageKey)), caption: p.caption ?? actions[Math.max(0, scene)] ?? "", isDialogue: !!p.caption });
        }
        const title = ctx.input.title ?? `${f.title}: The Comic`;
        const pages = await composePages({ title: f.title, subtitle: script.title.replace(`${f.title}: `, ""), panels });
        const production = await db.production.create({ data: { franchiseId: f.id, title, format: "COMIC", status: "PRODUCTION", ageRating: f.ageRating, isDemo: f.isDemo } });
        ctx.state.productionId = production.id;
        const cast = await db.canonEntity.findMany({ where: { franchiseId: f.id, type: "CHARACTER" }, select: { id: true } });
        for (const [i, page] of pages.entries()) {
          await asset(ctx, production.id, {
            kind: "DOCUMENT",
            title: `Page ${i + 1}`,
            key: `franchises/${f.id}/${production.id}/page-${String(i + 1).padStart(2, "0")}.jpg`,
            body: page,
            mimeType: "image/jpeg",
            provider: "comic-compositor",
            model: "comic-layout-v1",
            params: { page: i + 1, sourceProductionId: src.id },
            width: 1200,
            height: 1800,
            aiGenerated: frames.some((f2) => f2.aiGenerated),
            rightsNotes: "Composed in-house from approved, studio-owned storyboard frames.",
            entityIds: cast.map((c) => c.id),
          });
        }
        await asset(ctx, production.id, { kind: "POSTER", title: "Cover", key: `franchises/${f.id}/${production.id}/cover.jpg`, body: await toJpeg(pages[0], 800), mimeType: "image/jpeg", provider: "comic-compositor", aiGenerated: false, rightsNotes: "First page used as cover." });
        const backdrop = src.assets.filter((a) => a.kind === "KEY_ART").pop();
        if (backdrop) await asset(ctx, production.id, { kind: "KEY_ART", title: "Backdrop", key: `franchises/${f.id}/${production.id}/backdrop.jpg`, body: await getObject(backdrop.storageKey), mimeType: "image/jpeg", provider: backdrop.provider, aiGenerated: backdrop.aiGenerated, rightsNotes: backdrop.rightsNotes });
        ctx.state.writingProvider = script.provider;
        ctx.state.writingIsDemo = script.isDemo;
        ctx.state.logline = script.logline;
        await ctx.log(`${pages.length} comic pages from ${frames.length} approved frames`);
        return { pages: pages.length, productionId: production.id };
      },
    },
    {
      key: "qa",
      agent: "quality.lead",
      title: "Quality & Safety: comic review",
      async run(ctx) {
        const productionId = ctx.state.productionId as string;
        const assets = await db.asset.findMany({ where: { productionId } });
        const pages = assets.filter((a) => a.kind === "DOCUMENT");
        const technical = [
          { check: "At least one page", pass: pages.length > 0, value: String(pages.length) },
          { check: "Pages 1200×1800", pass: pages.every((p) => p.width === 1200 && p.height === 1800), value: "1200×1800" },
          { check: "Every source frame was approved", pass: true, value: "enforced at layout" },
        ];
        const rightsProblems = assets.filter((a) => a.rightsStatus === "NEEDS_REVIEW" || a.rightsStatus === "RESTRICTED");
        const blocking = [...technical.filter((t) => !t.pass).map((t) => `Technical: ${t.check}`), ...rightsProblems.map((a) => `Rights: ${a.title}`)];
        const report = { technical, rights: { checked: assets.length, problems: rightsProblems.length }, originality: [], blocking, critique: { score: null, issues: [], strengths: ["Adapts an already-approved, canon-validated script."] } };
        await db.production.update({ where: { id: productionId }, data: { qa: report as unknown as Prisma.InputJsonValue, status: blocking.length ? "QA" : "READY" } });
        if (blocking.length) throw new PolicyError(`QA blocked the comic: ${blocking.join("; ")}`);
        await db.asset.updateMany({ where: { productionId, status: "IN_REVIEW" }, data: { status: "APPROVED" } });
        return report;
      },
    },
    {
      key: "package",
      agent: "marketing.lead",
      title: "Marketing: release package",
      async run(ctx) {
        const productionId = ctx.state.productionId as string;
        const p = await db.production.findUniqueOrThrow({ where: { id: productionId }, include: { assets: true, franchise: true } });
        const release = await db.release.create({
          data: {
            franchiseId: p.franchiseId,
            productionId,
            title: p.title,
            description: `${String(ctx.state.logline ?? p.franchise.logline)} The comic edition, drawn from the animatic's storyboards.`,
            tags: [p.franchise.title.toLowerCase(), "comic"],
            ageRating: p.ageRating,
            aiDisclosure: buildDisclosure({ writingProvider: String(ctx.state.writingProvider), writingIsDemo: !!ctx.state.writingIsDemo, assets: p.assets, format: "Comic adapted from the animatic storyboards." }),
            channels: ["webster-world"],
            status: "PENDING_APPROVAL",
            isDemo: p.isDemo || !!ctx.state.writingIsDemo,
          },
        });
        ctx.state.releaseId = release.id;
        return { releaseId: release.id };
      },
    },
    ...releaseSteps("comic"),
  ],
};

/* ───────────── Interactive story (Games & Interactive) ───────────── */

export interface InteractiveInput {
  franchiseId: string;
  direction: string;
  opportunityId?: string;
}

export const interactive: WorkflowDef<InteractiveInput> = {
  type: "franchise.interactive",
  title: () => "Interactive story",
  steps: [
    {
      key: "design",
      agent: "games.lead",
      title: "Design the branching story",
      async run(ctx) {
        const canon = await canonDigest(ctx.input.franchiseId);
        const feedback = ctx.state.feedback as string[] | undefined;
        const res = await writeInteractive({ canon, direction: ctx.input.direction, feedback }, meta(ctx));
        const f = await db.franchise.findUniqueOrThrow({ where: { id: ctx.input.franchiseId } });
        const production =
          (ctx.state.productionId ? await db.production.findUnique({ where: { id: ctx.state.productionId as string } }) : null) ??
          (await db.production.create({ data: { franchiseId: f.id, title: res.data.title, format: "GAME", status: "DEVELOPMENT", ageRating: f.ageRating, isDemo: f.isDemo } }));
        ctx.state.productionId = production.id;
        const revision = (await db.script.count({ where: { productionId: production.id } })) + 1;
        const script = await db.script.create({
          data: { franchiseId: f.id, productionId: production.id, title: res.data.title, format: "interactive-graph", logline: res.data.synopsis, content: res.data as unknown as Prisma.InputJsonValue, revision, canonVersion: f.canonVersion, provider: res.provider, isDemo: res.isDemo },
        });
        ctx.state.writingProvider = res.provider;
        ctx.state.writingIsDemo = res.isDemo;
        ctx.state.logline = res.data.synopsis;
        return { scriptId: script.id, nodes: res.data.nodes.length };
      },
    },
    {
      key: "validate",
      agent: "quality.canon",
      title: "Validate the story graph (tests)",
      async run(ctx) {
        const { scriptId } = ctx.outputs.design as { scriptId: string };
        const script = await db.script.findUniqueOrThrow({ where: { id: scriptId } });
        const graph = script.content as unknown as StoryGraph;
        const canon = await canonDigest(ctx.input.franchiseId);
        const issues = validateStoryGraph(graph, { characters: canon.characters.map((c) => c.name), locations: canon.locations });
        const paths = countPaths(graph);
        await db.script.update({ where: { id: scriptId }, data: { validation: { issues, paths } as unknown as Prisma.InputJsonValue } });
        for (const i of issues) await ctx.log(`Graph: ${i.message}`, undefined, i.severity === "error" ? "error" : "warn");
        const errors = issues.filter((i) => i.severity === "error");
        if (errors.length) {
          const rev = Number(ctx.state.revisions ?? 0);
          if (rev < 2) {
            ctx.state.revisions = rev + 1;
            ctx.state.feedback = errors.map((e) => e.message);
            ctx.goto("design", "story graph failed validation");
          }
          throw new PolicyError(`Story graph still invalid after ${rev} revisions: ${errors.map((e) => e.message).join("; ")}`);
        }
        await ctx.log(`Graph valid: ${graph.nodes.length} nodes, ${paths} distinct playthroughs, ${graph.nodes.filter((n) => n.ending).length} endings`);
        return { issues, paths };
      },
    },
    {
      key: "art",
      agent: "visual.lead",
      title: "Illustrate each story node",
      async run(ctx) {
        const { scriptId } = ctx.outputs.design as { scriptId: string };
        const productionId = ctx.state.productionId as string;
        const graph = (await db.script.findUniqueOrThrow({ where: { id: scriptId } })).content as unknown as StoryGraph;
        const f = await db.franchise.findUniqueOrThrow({ where: { id: ctx.input.franchiseId } });
        const cast = await db.canonEntity.findMany({ where: { franchiseId: f.id, type: "CHARACTER", status: "ESTABLISHED" } });
        const castInfo = cast.map((c) => ({ id: c.id, name: c.name, color: (c.data as { color?: string }).color ?? "#c9a35c" }));
        for (const n of graph.nodes) {
          const present = castInfo.filter((c) => n.characters.some((x) => x.toLowerCase() === c.name.toLowerCase() || x.toLowerCase() === c.name.split(" ")[0].toLowerCase()));
          const prompt = `${n.location}. ${n.text}`;
          const img = await generateImage({ ...meta(ctx), task: "visual.frames", prompt, scene: { seed: `${f.id}:${scriptId}:${n.id}`, width: 1280, height: 720, palette: f.palette as string[], cast: present, framing: present.length > 2 ? "wide" : present.length === 1 ? "medium" : "wide", timeOfDay: n.ending === "triumph" ? "dusk" : "night" } });
          await asset(ctx, productionId, { kind: "STORYBOARD_FRAME", title: `Node ${n.id}`, key: `franchises/${f.id}/${productionId}/node-${n.id}.jpg`, body: await toJpeg(img.png), mimeType: "image/jpeg", provider: img.provider, model: img.model, prompt, params: { nodeId: n.id }, width: 1280, height: 720, aiGenerated: img.aiGenerated, rightsNotes: img.rightsNotes, entityIds: present.map((c) => c.id) });
        }
        const keyFrame = await generateImage({ ...meta(ctx), task: "visual.keyart", prompt: graph.synopsis, scene: { seed: `${f.id}:${scriptId}:poster`, width: 800, height: 1200, palette: f.palette as string[], cast: castInfo.slice(0, 4), framing: "wide", title: f.title, tagline: "An interactive story" } });
        await asset(ctx, productionId, { kind: "POSTER", title: "Poster", key: `franchises/${f.id}/${productionId}/poster.jpg`, body: await toJpeg(keyFrame.png), mimeType: "image/jpeg", provider: keyFrame.provider, model: keyFrame.model, width: 800, height: 1200, aiGenerated: keyFrame.aiGenerated, rightsNotes: keyFrame.rightsNotes });
        await ctx.log(`${graph.nodes.length} node illustrations`);
        return { nodes: graph.nodes.length };
      },
    },
    {
      key: "qa",
      agent: "quality.lead",
      title: "Quality & Safety: interactive review",
      async run(ctx) {
        const { scriptId } = ctx.outputs.design as { scriptId: string };
        const { paths } = ctx.outputs.validate as { paths: number };
        const productionId = ctx.state.productionId as string;
        const graph = (await db.script.findUniqueOrThrow({ where: { id: scriptId } })).content as unknown as StoryGraph;
        const assets = await db.asset.findMany({ where: { productionId } });
        const illustrated = new Set(assets.filter((a) => a.kind === "STORYBOARD_FRAME").map((a) => (a.params as { nodeId?: string }).nodeId));
        const technical = [
          { check: "Every node illustrated", pass: graph.nodes.every((n) => illustrated.has(n.id)), value: `${illustrated.size}/${graph.nodes.length}` },
          { check: "At least 2 endings", pass: graph.nodes.filter((n) => n.ending).length >= 2, value: String(graph.nodes.filter((n) => n.ending).length) },
          { check: "At least 3 playthroughs", pass: paths >= 3, value: String(paths) },
        ];
        const originality = screenOriginality([{ field: "title", text: graph.title, isName: true }]);
        const rightsProblems = assets.filter((a) => a.rightsStatus === "NEEDS_REVIEW" || a.rightsStatus === "RESTRICTED");
        const blocking = [...technical.filter((t) => !t.pass).map((t) => `Technical: ${t.check} (got ${t.value})`), ...originality.map((o) => `Originality: resembles ${o.matches}`), ...rightsProblems.map((a) => `Rights: ${a.title}`)];
        const report = { technical, rights: { checked: assets.length, problems: rightsProblems.length }, originality, blocking, critique: { score: null, issues: [], strengths: [`${paths} distinct playthroughs validated`] } };
        await db.production.update({ where: { id: productionId }, data: { qa: report as unknown as Prisma.InputJsonValue, status: blocking.length ? "QA" : "READY" } });
        if (blocking.length) throw new PolicyError(`QA blocked the interactive story: ${blocking.join("; ")}`);
        await db.asset.updateMany({ where: { productionId, status: "IN_REVIEW" }, data: { status: "APPROVED" } });
        return report;
      },
    },
    {
      key: "package",
      agent: "marketing.lead",
      title: "Marketing: release package",
      async run(ctx) {
        const productionId = ctx.state.productionId as string;
        const p = await db.production.findUniqueOrThrow({ where: { id: productionId }, include: { assets: true, franchise: true } });
        const release = await db.release.create({
          data: {
            franchiseId: p.franchiseId,
            productionId,
            title: p.title,
            description: String(ctx.state.logline ?? p.franchise.logline),
            tags: [p.franchise.title.toLowerCase(), "interactive story"],
            ageRating: p.ageRating,
            aiDisclosure: buildDisclosure({ writingProvider: String(ctx.state.writingProvider), writingIsDemo: !!ctx.state.writingIsDemo, assets: p.assets, format: "An interactive story whose structure was validated by automated tests." }),
            channels: ["webster-world"],
            status: "PENDING_APPROVAL",
            isDemo: p.isDemo || !!ctx.state.writingIsDemo,
          },
        });
        ctx.state.releaseId = release.id;
        return { releaseId: release.id };
      },
    },
    ...releaseSteps("interactive story"),
  ],
};

registerWorkflow(comic);
registerWorkflow(interactive);
