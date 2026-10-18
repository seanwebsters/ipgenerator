"use client";

import { useEffect } from "react";
import { track } from "./track";

/** Reading counts as a play when opened and a completion when scrolled to the end. */
export function ReadTracker({ titleId }: { titleId: string }) {
  useEffect(() => {
    track("play", titleId);
    let done = false;
    const onScroll = () => {
      if (!done && window.innerHeight + window.scrollY >= document.body.scrollHeight - 300) {
        done = true;
        track("complete", titleId);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [titleId]);
  return null;
}
