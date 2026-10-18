"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, Prisma } from "@/lib/db";
import { actorOf, createSession, requireRole } from "@/lib/auth";
import { verifyPassword } from "@/lib/crypto";
import { errorMessage } from "@/lib/errors";
import { storeSecret } from "@/engine/credentials";
import { decideApproval } from "@/engine/approvals";
import { cancelRun, resumeRun, startRun } from "@/engine/workflow";
import { enqueue } from "@/engine/queue";
import { refreshChannels } from "@/engine/channels";
import { accessToken, youtubeConfigured } from "@/engine/channels/youtube";
import { parseIntent } from "@/engine/tasks/learning";
import "@/engine/jobs";

export async function login(_: unknown, form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(String(form.get("password") ?? ""), user.passwordHash) || user.role === "VIEWER") {
    return { error: "Those credentials don't match a studio account." };
  }
  await createSession(user.id);
  redirect("/os");
}

/** Founder Copilot: natural language -> intent -> durable workflow. */
export async function runCommand(_: unknown, form: FormData) {
  const user = await requireRole("PRODUCER");
  const text = String(form.get("command") ?? "").trim();
  if (!text) return { reply: "Tell the studio what you want made." };
  try {
    const intent = await parseIntent(text);
    await db.auditLog.create({ data: { actor: actorOf(user), action: "copilot.command", data: { text, intent: intent.data, provider: intent.provider } as Prisma.InputJsonValue } });
    const i = intent.data;
    if (i.action === "status_report") {
      const [running, waiting, blocked] = await Promise.all([
        db.workflowRun.count({ where: { status: "RUNNING" } }),
        db.approval.count({ where: { status: "PENDING" } }),
        db.workflowRun.count({ where: { status: "BLOCKED" } }),
      ]);
      return { reply: `${running} production(s) running, ${waiting} decision(s) waiting on you, ${blocked} blocked.`, provider: intent.provider };
    }
    if (i.action === "pause_autonomy") {
      await requireRole("FOUNDER");
      await db.studioSettings.update({ where: { id: "studio" }, data: { autonomyMode: "ASSISTED" } });
      revalidatePath("/os", "layout");
      return { reply: "Autonomy set to Assisted: every publication, spend and experiment now needs your approval.", provider: intent.provider };
    }
    if (i.action !== "develop_franchises") return { reply: "I couldn't map that to a studio action yet. Try: “Develop five original fantasy franchises for young adults and prototype the two strongest.”", provider: intent.provider };
    const conceptCount = Math.min(8, Math.max(1, i.conceptCount || 5));
    const prototypeCount = Math.min(3, Math.max(1, i.prototypeCount || 1));
    const brief = await db.brief.create({ data: { text: i.brief || text, params: { conceptCount, prototypeCount }, createdBy: actorOf(user) } });
    const run = await startRun("ip.discovery", { briefId: brief.id, brief: brief.text, conceptCount, prototypeCount }, { createdBy: actorOf(user), briefId: brief.id, isDemo: intent.isDemo });
    revalidatePath("/os", "layout");
    return { reply: i.reply, runId: run.id, provider: intent.provider };
  } catch (err) {
    return { reply: `Couldn't start that: ${errorMessage(err)}` };
  }
}

export async function decide(form: FormData) {
  const user = await requireRole("FOUNDER");
  const id = String(form.get("id"));
  const approved = form.get("verdict") === "approve";
  const selected = form.getAll("selected").map(String);
  const note = String(form.get("note") ?? "").trim() || undefined;
  try {
    await decideApproval(id, { approved, decision: selected.length ? { selected } : undefined, note }, actorOf(user));
  } catch (err) {
    redirect(`/os/approvals?id=${id}&error=${encodeURIComponent(errorMessage(err))}`);
  }
  revalidatePath("/os", "layout");
  redirect("/os/approvals");
}

export async function resume(form: FormData) {
  const user = await requireRole("PRODUCER");
  await resumeRun(String(form.get("runId")), actorOf(user));
  revalidatePath("/os", "layout");
}

export async function cancel(form: FormData) {
  const user = await requireRole("FOUNDER");
  await cancelRun(String(form.get("runId")), actorOf(user));
  revalidatePath("/os", "layout");
}

export async function saveSettings(form: FormData) {
  const user = await requireRole("FOUNDER");
  const num = (k: string, min: number, max: number) => Math.min(max, Math.max(min, Number(form.get(k))));
  const mode = String(form.get("autonomyMode"));
  const data = {
    autonomyMode: (["ASSISTED", "SUPERVISED", "HIGH"].includes(mode) ? mode : "ASSISTED") as "ASSISTED",
    dailyBudgetUsd: num("dailyBudgetUsd", 0, 10_000),
    monthlyBudgetUsd: num("monthlyBudgetUsd", 0, 100_000),
    perRunBudgetUsd: num("perRunBudgetUsd", 0, 1_000),
    autoPublishPerDay: Math.round(num("autoPublishPerDay", 0, 50)),
    maxConcurrentJobs: Math.round(num("maxConcurrentJobs", 1, 16)),
    allowDemoProvider: form.get("allowDemoProvider") === "on",
    externalPrivacy: ["private", "unlisted", "public"].includes(String(form.get("externalPrivacy"))) ? String(form.get("externalPrivacy")) : "private",
    flywheelEnabled: form.get("flywheelEnabled") === "on",
    flywheelIntervalMin: Math.round(num("flywheelIntervalMin", 15, 43_200)),
  };
  await db.studioSettings.update({ where: { id: "studio" }, data });
  await db.auditLog.create({ data: { actor: actorOf(user), action: "settings.update", data: data as unknown as Prisma.InputJsonValue } });
  revalidatePath("/os", "layout");
}

export async function saveCredential(form: FormData) {
  const user = await requireRole("FOUNDER");
  const provider = String(form.get("provider"));
  const secret = String(form.get("secret") ?? "").trim();
  if (!["anthropic", "openai", "elevenlabs"].includes(provider) || secret.length < 8) return;
  await storeSecret(provider, secret);
  await db.providerState.upsert({ where: { provider }, create: { provider }, update: { circuit: "CLOSED", failures: 0, openedUntil: null } });
  await db.auditLog.create({ data: { actor: actorOf(user), action: "credential.store", targetId: provider } });
  revalidatePath("/os/settings");
}

export async function saveRoute(form: FormData) {
  const user = await requireRole("FOUNDER");
  const task = String(form.get("task"));
  const provider = String(form.get("provider"));
  const model = String(form.get("model") ?? "").trim();
  await db.modelRoute.upsert({ where: { task }, create: { task, provider, model }, update: { provider, model } });
  await db.auditLog.create({ data: { actor: actorOf(user), action: "route.update", targetId: task, data: { provider, model } } });
  revalidatePath("/os/settings");
}

export async function testYouTube() {
  await requireRole("FOUNDER");
  if (!youtubeConfigured()) {
    await db.channel.update({ where: { key: "youtube" }, data: { status: "NOT_CONFIGURED", lastError: "YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / YOUTUBE_REFRESH_TOKEN are not set.", lastCheckedAt: new Date() } });
  } else {
    try {
      await accessToken();
      await db.channel.update({ where: { key: "youtube" }, data: { status: "CONNECTED", lastError: null, lastCheckedAt: new Date() } });
    } catch (err) {
      await db.channel.update({ where: { key: "youtube" }, data: { status: "ERROR", lastError: errorMessage(err), lastCheckedAt: new Date() } });
    }
  }
  revalidatePath("/os/settings");
}

export async function runNow(form: FormData) {
  await requireRole("PRODUCER");
  const kind = String(form.get("kind"));
  const allowed = ["analytics.ingest", "experiments.evaluate", "learning.review"];
  if (!allowed.includes(kind)) return;
  const titleId = form.get("titleId") ? String(form.get("titleId")) : undefined;
  await enqueue(kind, titleId ? { titleId } : {}, {});
  revalidatePath("/os", "layout");
}

export async function applyWinner(form: FormData) {
  const user = await requireRole("FOUNDER");
  const exp = await db.experiment.findUniqueOrThrow({ where: { id: String(form.get("experimentId")) }, include: { variants: true } });
  const b = exp.variants.find((v) => v.key === "B");
  if (!exp.titleId || !b) return;
  await db.worldTitle.update({ where: { id: exp.titleId }, data: { title: String((b.payload as { title?: string }).title) } });
  await db.auditLog.create({ data: { actor: actorOf(user), action: "experiment.apply", targetId: exp.id } });
  revalidatePath("/os/intelligence");
}

export async function refreshChannelStatus() {
  await requireRole("PRODUCER");
  await refreshChannels();
  revalidatePath("/os/calendar");
}

const EDITABLE = ["name", "appearance", "motivation", "flaw", "voice", "color"] as const;

/** Propose a change to an established canon character. Applying it needs founder approval. */
export async function proposeCanonChange(form: FormData) {
  const user = await requireRole("PRODUCER");
  const entity = await db.canonEntity.findUniqueOrThrow({ where: { id: String(form.get("entityId")) }, include: { franchise: true, assets: true } });
  const current = entity.data as Record<string, unknown>;
  const changes: Record<string, string> = {};
  for (const k of EDITABLE) {
    const v = String(form.get(k) ?? "").trim();
    const before = k === "name" ? entity.name : String(current[k] ?? "");
    if (v && v !== before) changes[k] = v;
  }
  const back = `/os/universe/${entity.franchise.slug}`;
  if (!Object.keys(changes).length) redirect(`${back}?canon=unchanged`);
  if (changes.color && !/^#[0-9a-f]{6}$/i.test(changes.color)) redirect(`${back}?canon=bad-color`);
  if (changes.name) {
    const clash = await db.canonEntity.findFirst({ where: { franchiseId: entity.franchiseId, type: entity.type, name: { equals: changes.name, mode: "insensitive" }, id: { not: entity.id } } });
    if (clash) redirect(`${back}?canon=duplicate-name`);
  }
  const reason = String(form.get("reason") ?? "").trim() || "Founder edit";
  await db.approval.create({
    data: {
      kind: "CANON_CHANGE",
      title: `Canon change: ${entity.name}`,
      summary: `${reason}. ${entity.assets.length} existing asset(s) depend on ${entity.name} and will be flagged for review.`,
      payload: { entityId: entity.id, entityName: entity.name, changes, before: Object.fromEntries(Object.keys(changes).map((k) => [k, k === "name" ? entity.name : current[k] ?? ""])), reason, impacted: entity.assets.length } as Prisma.InputJsonValue,
      requestedBy: actorOf(user),
      franchiseId: entity.franchiseId,
    },
  });
  await db.auditLog.create({ data: { actor: actorOf(user), action: "canon.propose", targetType: "CanonEntity", targetId: entity.id, data: changes } });
  revalidatePath("/os", "layout");
  redirect("/os/approvals");
}

/** Quality review of an asset flagged after a canon change. */
export async function reviewAsset(form: FormData) {
  const user = await requireRole("PRODUCER");
  const asset = await db.asset.findUniqueOrThrow({ where: { id: String(form.get("assetId")) }, include: { franchise: true } });
  const keep = form.get("verdict") === "keep";
  await db.asset.update({ where: { id: asset.id }, data: keep ? { status: "APPROVED", canonVersion: asset.franchise?.canonVersion ?? asset.canonVersion } : { status: "REJECTED" } });
  await db.auditLog.create({ data: { actor: actorOf(user), action: keep ? "asset.reapprove" : "asset.retire", targetType: "Asset", targetId: asset.id } });
  revalidatePath(`/os/universe/${asset.franchise?.slug}`);
}

export async function startDevelopment(form: FormData) {
  const user = await requireRole("PRODUCER");
  const f = await db.franchise.findUniqueOrThrow({ where: { id: String(form.get("franchiseId")) } });
  const run = await startRun("franchise.develop", { franchiseId: f.id, trigger: `requested by ${user.name}` }, { createdBy: actorOf(user), franchiseId: f.id, isDemo: f.isDemo });
  revalidatePath("/os", "layout");
  redirect(`/os/floor?run=${run.id}`);
}
