"use client";

import { useEffect, useRef } from "react";

type EventType = "impression" | "play" | "progress" | "complete" | "share" | "favorite";
let queue: { type: EventType; titleId: string; value?: number }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
const seen = new Set<string>();

function flush() {
  timer = null;
  if (!queue.length) return;
  const body = JSON.stringify({ events: queue.splice(0, 50) });
  if (navigator.sendBeacon) navigator.sendBeacon("/api/world/events", new Blob([body], { type: "application/json" }));
  else fetch("/api/world/events", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true });
}

/** Queue a real audience event. Batched; flushed on a short timer and on page hide. */
export function track(type: EventType, titleId: string, value?: number) {
  queue.push({ type, titleId, value });
  if (!timer) timer = setTimeout(flush, 1500);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
}

/** Fires one impression per title per page view once at least half the card is visible. */
export function useImpression(titleId: string) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !seen.has(titleId)) {
          seen.add(titleId);
          track("impression", titleId);
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [titleId]);
  return ref;
}

/** Records that a title was shown (hero banners, title pages). Once per page view. */
export function Impression({ titleId }: { titleId: string }) {
  useEffect(() => {
    if (seen.has(titleId)) return;
    seen.add(titleId);
    track("impression", titleId);
  }, [titleId]);
  return null;
}
