"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw } from "lucide-react";
import { track } from "./track";

interface Node {
  id: string;
  location: string;
  text: string;
  choices: { label: string; to: string }[];
  ending: "" | "triumph" | "bittersweet" | "lost";
}

const ENDING_LABEL = { triumph: "A bright ending", bittersweet: "A bittersweet ending", lost: "A lost ending" };

/** Plays a validated branching story. Events: play on first choice, progress per step, complete on any ending. */
export function StoryPlayer({ titleId, start, nodes, images }: { titleId: string; start: string; nodes: Node[]; images: Record<string, string> }) {
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const [path, setPath] = useState<string[]>([start]);
  const started = useRef(false);
  const node = byId.get(path[path.length - 1])!;
  const endings = nodes.filter((n) => n.ending).length;

  const choose = (to: string) => {
    if (!started.current) {
      started.current = true;
      track("play", titleId);
    }
    const next = [...path, to];
    setPath(next);
    track("progress", titleId, next.length);
    if (byId.get(to)?.ending) track("complete", titleId);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-card shadow-[0_40px_120px_-40px_rgba(226,120,60,0.35)]">
      <AnimatePresence mode="wait">
        <motion.div key={node.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
          {images[node.id] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={images[node.id]} alt="" className="aspect-video w-full object-cover" />
          )}
          <div className="p-6 sm:p-10">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-brass">{node.location}</div>
            <p className="font-display mt-4 text-2xl leading-relaxed sm:text-3xl">{node.text}</p>
            {node.ending ? (
              <div className="mt-8">
                <div className="text-sm text-muted-foreground">{ENDING_LABEL[node.ending]} · {path.length - 1} choices · one of {endings} endings</div>
                <button onClick={() => setPath([start])} className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-6 font-semibold text-background">
                  <RotateCcw className="size-4" /> Play again
                </button>
              </div>
            ) : (
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {node.choices.map((c) => (
                  <button key={c.label + c.to} onClick={() => choose(c.to)} className="rounded-xl border border-white/15 bg-white/5 px-5 py-4 text-left text-lg transition hover:border-brass hover:bg-brass/10">
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
