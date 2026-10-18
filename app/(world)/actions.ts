"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { currentViewer } from "@/lib/viewer";

export async function toggleFavorite(titleId: string): Promise<boolean> {
  const v = await currentViewer();
  if (!v) return false;
  const existing = await db.favorite.findUnique({ where: { viewerId_titleId: { viewerId: v.id, titleId } } });
  if (existing) await db.favorite.delete({ where: { id: existing.id } });
  else await db.favorite.create({ data: { viewerId: v.id, titleId } });
  revalidatePath("/library");
  return !existing;
}

export async function saveProgress(titleId: string, positionSec: number, durationSec: number) {
  const v = await currentViewer();
  if (!v || !Number.isFinite(positionSec) || !Number.isFinite(durationSec) || durationSec <= 0) return;
  const completed = positionSec / durationSec >= 0.9;
  await db.playbackProgress.upsert({
    where: { viewerId_titleId: { viewerId: v.id, titleId } },
    create: { viewerId: v.id, titleId, positionSec, durationSec, completed },
    update: { positionSec, durationSec, completed },
  });
}

export async function updateProfile(form: FormData) {
  const v = await currentViewer();
  if (!v) return;
  const limit = String(form.get("maturityLimit"));
  const allowed = ["ALL", "AGE_7", "AGE_13", "AGE_16", "AGE_18"];
  await db.viewer.update({
    where: { id: v.id },
    data: {
      displayName: String(form.get("displayName") ?? "").slice(0, 40) || null,
      maturityLimit: allowed.includes(limit) ? (limit as "ALL") : v.maturityLimit,
    },
  });
  revalidatePath("/", "layout");
}
