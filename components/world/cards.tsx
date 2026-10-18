"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen, Gamepad2, Play } from "lucide-react";
import { useImpression } from "./track";

export interface CardTitle {
  id: string;
  slug: string;
  kind: "WATCH" | "READ" | "LISTEN" | "PLAY";
  displayTitle: string;
  franchiseTitle: string;
  posterUrl: string | null;
  ageLabel: string;
  runtimeSec: number | null;
  isDemo: boolean;
  progress?: number;
}

export function TitleCard({ t, size = "md" }: { t: CardTitle; size?: "md" | "lg" }) {
  const ref = useImpression(t.id);
  const href = t.kind === "READ" ? `/read/${t.slug}` : t.kind === "PLAY" ? `/play/${t.slug}` : `/watch/${t.slug}`;
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 300, damping: 24 }} className={size === "lg" ? "w-56 shrink-0 sm:w-64" : "w-40 shrink-0 sm:w-48"}>
      <Link ref={ref} href={href} className="group block">
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10 bg-card shadow-[0_20px_50px_-25px_rgba(0,0,0,0.9)]">
          {t.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.posterUrl} alt="" className="size-full object-cover transition duration-700 group-hover:scale-[1.04]" />
          ) : (
            <div className="size-full bg-gradient-to-br from-wine/40 to-background" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
          <div className="absolute left-2 top-2 flex gap-1">
            {t.isDemo && <span className="rounded-full bg-fuchsia-500/85 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">Demo</span>}
            <span className="rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white/90">{t.ageLabel}</span>
          </div>
          <div className="absolute bottom-2 right-2 grid size-9 place-items-center rounded-full bg-foreground text-background opacity-0 transition group-hover:opacity-100">
            {t.kind === "READ" ? <BookOpen className="size-4" /> : t.kind === "PLAY" ? <Gamepad2 className="size-4" /> : <Play className="size-4 fill-current" />}
          </div>
          {t.progress != null && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
              <div className="h-full bg-primary" style={{ width: `${Math.round(t.progress * 100)}%` }} />
            </div>
          )}
        </div>
        <div className="mt-2.5 px-0.5">
          <div className="line-clamp-1 text-sm font-medium text-foreground/95">{t.displayTitle}</div>
          <div className="text-xs text-muted-foreground">
            {t.franchiseTitle} · {t.kind === "READ" ? "Read" : t.kind === "PLAY" ? "Play" : t.runtimeSec ? `${Math.max(1, Math.round(t.runtimeSec / 60))} min` : "Watch"}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="font-display mb-4 px-4 text-2xl sm:px-8 sm:text-3xl">{title}</h2>
      <div className="scrollbar-none flex gap-4 overflow-x-auto px-4 pb-4 sm:px-8">{children}</div>
    </section>
  );
}
