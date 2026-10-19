"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-renders the server page on an interval so live runs stay current. */
export function LiveRefresh({ ms = 3000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => document.visibilityState === "visible" && router.refresh(), ms);
    return () => clearInterval(id);
  }, [router, ms]);
  return null;
}

/**
 * Inline engine heartbeat: while the Studio console is open, keeps asking the server
 * to process queued work, one request at a time (see /api/engine/tick).
 */
export function EngineHeartbeat() {
  const router = useRouter();
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const beat = async () => {
      let busy = false;
      try {
        const res = await fetch("/api/engine/tick", { method: "POST" });
        if (res.ok) {
          const { done, pending } = (await res.json()) as { done: number; pending: number };
          if (done) router.refresh();
          busy = pending > 0;
        }
      } catch {
        // Network blip: try again on the next beat.
      }
      if (!stopped) timer = setTimeout(beat, busy ? 250 : 5000);
    };
    beat();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [router]);
  return null;
}
