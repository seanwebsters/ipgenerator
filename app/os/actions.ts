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
