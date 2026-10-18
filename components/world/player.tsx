"use client";

import { useRef, useState } from "react";
import { Heart, Share2, Check } from "lucide-react";
import { track } from "./track";
import { toggleFavorite, saveProgress } from "@/app/(world)/actions";

export function Player({ titleId, src, altSrc, poster, startAt }: { titleId: string; src: string; altSrc?: string | null; poster?: string | null; startAt?: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  const started = useRef(false);
  const done = useRef(false);
  const lastBeat = useRef(0);
  return (
    <video
      ref={ref}
      poster={poster ?? undefined}
      controls
      playsInline
      preload="metadata"
      className="aspect-video w-full rounded-2xl border border-white/10 bg-black shadow-[0_40px_120px_-40px_rgba(226,120,60,0.35)]"
      onLoadedMetadata={(e) => {
        if (startAt && startAt < e.currentTarget.duration - 3) e.currentTarget.currentTime = startAt;
      }}
      onPlay={() => {
        if (!started.current) {
          started.current = true;
          track("play", titleId);
        }
      }}
      onTimeUpdate={(e) => {
        const v = e.currentTarget;
        if (v.currentTime - lastBeat.current >= 5) {
          lastBeat.current = v.currentTime;
          track("progress", titleId, Math.round(v.currentTime));
          saveProgress(titleId, v.currentTime, v.duration);
        }
        if (!done.current && v.duration && v.currentTime / v.duration >= 0.9) {
          done.current = true;
          track("complete", titleId);
          saveProgress(titleId, v.duration, v.duration);
        }
      }}
    >
      <source src={src} type="video/mp4" />
      {altSrc && <source src={altSrc} type="video/webm" />}
    </video>
  );
}

export function TitleActions({ titleId, favorited }: { titleId: string; favorited: boolean }) {
  const [fav, setFav] = useState(favorited);
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <button
        onClick={async () => {
          const next = await toggleFavorite(titleId);
          setFav(next);
          if (next) track("favorite", titleId);
        }}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 text-sm hover:bg-white/10"
      >
        <Heart className={fav ? "size-4 fill-primary text-primary" : "size-4"} /> {fav ? "In your library" : "Add to library"}
      </button>
      <button
        onClick={async () => {
          await navigator.clipboard?.writeText(window.location.href).catch(() => {});
          track("share", titleId);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 text-sm hover:bg-white/10"
      >
        {copied ? <Check className="size-4" /> : <Share2 className="size-4" />} {copied ? "Link copied" : "Share"}
      </button>
    </div>
  );
}
