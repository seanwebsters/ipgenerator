import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";

export const VIEWER_COOKIE = "wb_viewer";
const ORDER = ["ALL", "AGE_7", "AGE_13", "AGE_16", "AGE_18"] as const;
export type Rating = (typeof ORDER)[number];

/** Studio viewer (anonymous cookie set by proxy.ts). */
export async function currentViewer() {
  const id = (await cookies()).get(VIEWER_COOKIE)?.value;
  if (!id) return null;
  return db.viewer.upsert({ where: { id }, create: { id }, update: {} });
}

export function allowedRatings(limit: Rating): Rating[] {
  return ORDER.slice(0, ORDER.indexOf(limit) + 1) as Rating[];
}

export const RATING_LABEL: Record<Rating, string> = { ALL: "All ages", AGE_7: "7+", AGE_13: "13+", AGE_16: "16+", AGE_18: "18+" };
