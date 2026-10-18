"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check, Sparkles, Crown, GitBranch, ShieldCheck } from "lucide-react";
import { AGENTS, PIPELINE, STUDIOS } from "@/lib/studios";
import { AgentAvatar, Logo } from "@/components/ui";
import { StudioIcon } from "@/components/StudioIcon";
import type { AgentKey } from "@/lib/types";

const fade = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5 },
};

const EXAMPLES = [
  "small forest creatures who look after children's lost dreams at night",
  "a lighthouse keeper who can talk to storms",
  "a robot that runs the last library on Mars",
];

const PLANS = [
  { name: "Creator", price: "$0", note: "forever", features: ["1 living franchise", "Discovery + development", "All 12 studios (light)", "IP Bible export"], cta: "Start free" },
  { name: "Studio", price: "$49", note: "per month", features: ["10 franchises", "Full-depth studios", "Studio Director plans", "Canon versioning + approvals", "Claude-powered generation"], cta: "Start Studio", featured: true },
  { name: "Franchise", price: "$199", note: "per month", features: ["Unlimited franchises", "Team seats & roles", "IP Vault filings tracker", "Franchise Simulator", "Priority generation"], cta: "Go Franchise" },
  { name: "Enterprise", price: "Custom", note: "for studios & brands", features: ["SSO & audit log", "Private canon storage", "Custom department agents", "Rights & legal workflows"], cta: "Talk to us" },
];

export default function Landing() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const launch = (p: string) => router.push(`/studio/new?prompt=${encodeURIComponent(p)}`);

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[640px] w-[1100px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[140px]" />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm text-muted md:flex">
          <a href="#studios" className="hover:text-white">Studios</a>
          <a href="#team" className="hover:text-white">Studio team</a>
          <a href="#pipeline" className="hover:text-white">Pipeline</a>
          <a href="#pricing" className="hover:text-white">Pricing</a>
        </nav>
        <Link href="/studio" className="rounded-xl border border-line bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10">
          Open the studio
        </Link>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-24 pt-16 text-center md:pt-24">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-white/5 px-3 py-1 text-xs text-muted">
          <Sparkles className="h-3.5 w-3.5 text-amber-300" /> An AI entertainment studio with twelve departments and one canon
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="font-display mx-auto max-w-4xl text-5xl font-bold leading-[1.02] md:text-7xl">
          One prompt.<br />
          <span className="glow-text">A living franchise.</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="mx-auto mt-6 max-w-2xl text-lg text-muted">
          WorldFactory turns an idea into an original IP: concepts, cast, world, stories, music, games, merch and the rights to protect it. A virtual studio team builds every format from the same versioned canon.
        </motion.p>

        <motion.form
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onSubmit={(e) => {
            e.preventDefault();
            launch(prompt || EXAMPLES[0]);
          }}
          className="mx-auto mt-10 flex max-w-2xl items-center gap-2 rounded-2xl border border-white/15 bg-panel/90 p-2 shadow-[0_20px_80px_-20px_rgba(139,92,246,0.5)] backdrop-blur"
        >
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={EXAMPLES[0]}
            className="h-12 flex-1 bg-transparent px-4 text-base outline-none placeholder:text-white/30"
          />
          <button className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-amber-400 px-5 font-semibold text-ink">
            Launch <ArrowRight className="h-4 w-4" />
          </button>
        </motion.form>
        <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
          {EXAMPLES.slice(1).map((ex) => (
            <button key={ex} onClick={() => launch(ex)} className="rounded-full border border-line px-3 py-1 text-muted hover:border-white/30 hover:text-white">
              {ex}
            </button>
          ))}
        </div>

        {/* Orbit of studios */}
        <div className="relative mx-auto mt-20 h-[340px] max-w-3xl">
          <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/10" />
          <div className="absolute left-1/2 top-1/2 h-[180px] w-[180px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5" />
          <div className="absolute left-1/2 top-1/2 grid h-28 w-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-3xl border border-amber-300/30 bg-gradient-to-br from-violet-700/60 to-indigo-950 text-center shadow-[0_0_80px_-10px_rgba(251,191,36,0.5)]">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-amber-200/80">Canon</div>
              <div className="font-display text-2xl font-bold">v1</div>
            </div>
          </div>
          <motion.div className="absolute inset-0" animate={{ rotate: 360 }} transition={{ duration: 90, repeat: Infinity, ease: "linear" }}>
            {STUDIOS.map((s, i) => {
              const angle = (i / STUDIOS.length) * Math.PI * 2;
              return (
                <div
                  key={s.key}
                  className="absolute left-1/2 top-1/2"
                  style={{ transform: `translate(-50%, -50%) translate(${Math.cos(angle) * 150}px, ${Math.sin(angle) * 150}px)` }}
                >
                  <motion.div animate={{ rotate: -360 }} transition={{ duration: 90, repeat: Infinity, ease: "linear" }} className="grid h-12 w-12 place-items-center rounded-2xl border border-line bg-panel-2" style={{ boxShadow: `0 0 24px -8px ${s.accent}` }}>
                    <StudioIcon studio={s.key} className="h-5 w-5" />
                  </motion.div>
                </div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Studios */}
      <section id="studios" className="relative z-10 mx-auto max-w-7xl px-6 py-24">
        <motion.div {...fade} className="mb-12 max-w-2xl">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">12 studios</div>
          <h2 className="font-display mt-3 text-4xl font-bold">Every department a franchise needs, under one roof.</h2>
          <p className="mt-4 text-muted">Each studio reads from the same canon and writes back through approvals, so your series, books, game and plush never contradict each other.</p>
        </motion.div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STUDIOS.map((s, i) => (
            <motion.div key={s.key} {...fade} transition={{ duration: 0.4, delay: i * 0.03 }} className="group relative overflow-hidden rounded-2xl border border-line bg-panel/70 p-5 hover:border-white/20">
              <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-20 blur-2xl transition group-hover:opacity-40" style={{ background: s.accent }} />
              <div className="mb-4 flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${s.accent}22`, color: s.accent }}>
                  <StudioIcon studio={s.key} className="h-5 w-5" />
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted">{AGENTS[s.key].name}</span>
              </div>
              <div className="font-semibold">{s.name}</div>
              <div className="mt-1 text-sm text-muted">{s.blurb}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Team */}
      <section id="team" className="relative z-10 border-y border-line bg-panel/40 py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[1fr_1.4fr]">
          <motion.div {...fade}>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Virtual studio team</div>
            <h2 className="font-display mt-3 text-4xl font-bold">A director and twelve department agents. You make the calls.</h2>
            <p className="mt-4 text-muted">Atlas, your Studio Director, turns an objective into a phased plan and routes tasks to departments. Every deliverable lands in your approvals queue. Nothing becomes canon without you.</p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                [Crown, "Director plans with phases, owners and deliverables"],
                [GitBranch, "Canon versioning: edit a character, downstream assets flag for review"],
                [ShieldCheck, "IP Vault keeps a hashed ledger of every canon version"],
              ].map(([Icon, text], i) => {
                const I = Icon as typeof Crown;
                return (
                  <li key={i} className="flex items-start gap-3">
                    <I className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /> <span>{text as string}</span>
                  </li>
                );
              })}
            </ul>
          </motion.div>
          <motion.div {...fade} className="rounded-3xl border border-line bg-ink/60 p-6">
            <div className="flex items-center gap-4 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4">
              <AgentAvatar agent="director" size={48} />
              <div>
                <div className="font-semibold">Atlas <span className="text-muted">· Studio Director</span></div>
                <div className="text-sm text-muted">&ldquo;Phase 2 is live. Pulse has 12 posts for you; Pixel&rsquo;s game concept is waiting.&rdquo;</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(Object.keys(AGENTS) as AgentKey[])
                .filter((k) => k !== "director")
                .map((k) => (
                  <div key={k} className="flex items-center gap-3 rounded-xl border border-line bg-panel/60 p-3">
                    <AgentAvatar agent={k} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{AGENTS[k].name}</div>
                      <div className="truncate text-[11px] text-muted">{AGENTS[k].title}</div>
                    </div>
                  </div>
                ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pipeline */}
      <section id="pipeline" className="relative z-10 mx-auto max-w-7xl px-6 py-24">
        <motion.div {...fade} className="mb-12 max-w-2xl">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">The pipeline</div>
          <h2 className="font-display mt-3 text-4xl font-bold">From a sentence to a slate in four moves.</h2>
        </motion.div>
        <div className="grid gap-4 md:grid-cols-4">
          {PIPELINE.map((p, i) => (
            <motion.div key={p.key} {...fade} transition={{ duration: 0.4, delay: i * 0.08 }} className="relative rounded-2xl border border-line bg-panel/70 p-6">
              <div className="font-display text-5xl font-bold text-white/10">0{i + 1}</div>
              <div className="mt-2 font-semibold">{p.name}</div>
              <div className="mt-2 text-sm text-muted">{p.text}</div>
              {i < PIPELINE.length - 1 && <ArrowRight className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 text-amber-300/60 md:block" />}
            </motion.div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 mx-auto max-w-7xl px-6 pb-28 pt-8">
        <motion.div {...fade} className="mb-12 text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Pricing</div>
          <h2 className="font-display mt-3 text-4xl font-bold">Start with one world. Scale to a slate.</h2>
        </motion.div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p) => (
            <motion.div
              key={p.name}
              {...fade}
              className={`relative flex flex-col rounded-2xl border p-6 ${p.featured ? "border-amber-300/40 bg-gradient-to-b from-amber-300/10 to-panel" : "border-line bg-panel/70"}`}
            >
              {p.featured && <div className="absolute -top-3 left-6 rounded-full bg-amber-300 px-2 py-0.5 text-[11px] font-semibold text-ink">Most popular</div>}
              <div className="font-semibold">{p.name}</div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-display text-4xl font-bold">{p.price}</span>
                <span className="text-sm text-muted">{p.note}</span>
              </div>
              <ul className="mt-6 flex-1 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/studio"
                className={`mt-6 inline-flex h-10 items-center justify-center rounded-xl text-sm font-medium ${p.featured ? "bg-amber-300 text-ink" : "border border-line bg-white/5 hover:bg-white/10"}`}
              >
                {p.cta}
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted md:flex-row">
          <Logo />
          <div>Original IP, built with a virtual studio. Demo franchise: Moonwilders.</div>
        </div>
      </footer>
    </div>
  );
}
