"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Crown, LoaderCircle, Sparkles } from "lucide-react";
import { ai } from "@/lib/ai/client";
import type { ConceptOutT, DevelopOutT } from "@/lib/ai/schemas";
import { conceptFromOut, franchiseFromDevelopment, greenlight } from "@/lib/franchise";
import { getRepository } from "@/lib/repository";
import { AgentAvatar, Badge, Button, Card, ScoreBar, SourceTag } from "@/components/ui";
import type { AgentKey } from "@/lib/types";
import { cx } from "@/lib/util";

type Step = "prompt" | "discovering" | "concepts" | "developing" | "review";

const STEPS = [
  { key: "discovery", label: "Discovery" },
  { key: "pick", label: "Pick a concept" },
  { key: "develop", label: "Creative development" },
  { key: "greenlight", label: "Greenlight to canon" },
];

const DEV_CREW: { agent: AgentKey; task: string }[] = [
  { agent: "ip-lab", task: "Writing the franchise thesis and format plan" },
  { agent: "characters", task: "Casting five characters and their relationships" },
  { agent: "world", task: "Mapping locations, rules and factions" },
  { agent: "story", task: "Stress-testing the premise for 52 episodes" },
  { agent: "vault", task: "Running a first-pass name clearance" },
];

export default function NewFranchisePage() {
  return (
    <Suspense fallback={null}>
      <LaunchFlow />
    </Suspense>
  );
}

function LaunchFlow() {
  const params = useSearchParams();
  const router = useRouter();
  const [prompt, setPrompt] = useState(params.get("prompt") ?? "");
  const [step, setStep] = useState<Step>("prompt");
  const [concepts, setConcepts] = useState<ConceptOutT[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [dev, setDev] = useState<DevelopOutT | null>(null);
  const [source, setSource] = useState<"claude" | "mock">();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const started = useRef(false);

  const runDiscovery = async (p: string) => {
    if (!p.trim()) return;
    setError(null);
    setStep("discovering");
    try {
      const res = await ai.discovery({ prompt: p.trim() });
      setConcepts(res.data.concepts.slice(0, 5));
      setSource(res.source);
      setStep("concepts");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Discovery failed");
      setStep("prompt");
    }
  };

  useEffect(() => {
    const p = params.get("prompt");
    if (p && !started.current) {
      started.current = true;
      runDiscovery(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const develop = async (i: number) => {
    setPicked(i);
    setStep("developing");
    const minDelay = new Promise((r) => setTimeout(r, 2600));
    try {
      const [res] = await Promise.all([ai.develop({ prompt, concept: concepts[i] }), minDelay]);
      setDev(res.data);
      setSource(res.source);
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Development failed");
      setStep("concepts");
    }
  };

  const doGreenlight = async () => {
    if (!dev || picked === null) return;
    setSaving(true);
    const chosen = conceptFromOut(concepts[picked]);
    const alternates = concepts.filter((_, i) => i !== picked).map(conceptFromOut);
    const f = franchiseFromDevelopment(prompt, chosen, alternates, dev);
    greenlight(f);
    await getRepository().save(f);
    router.push(`/studio/f/${f.id}`);
  };

  const stepIndex = { prompt: 0, discovering: 0, concepts: 1, developing: 2, review: 3 }[step];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <ol className="mb-10 flex flex-wrap items-center gap-2 text-xs">
        {STEPS.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className={cx("flex items-center gap-2 rounded-full border px-3 py-1", i < stepIndex ? "border-emerald-400/30 text-emerald-300" : i === stepIndex ? "border-amber-300/50 bg-amber-300/10 text-amber-200" : "border-line text-muted")}>
              {i < stepIndex ? <Check className="h-3 w-3" /> : <span className="tabular-nums">{i + 1}</span>}
              {s.label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px w-6 bg-line" />}
          </li>
        ))}
        <span className="ml-auto">
          <SourceTag source={source} />
        </span>
      </ol>

      <AnimatePresence mode="wait">
        {step === "prompt" && (
          <motion.section key="prompt" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto max-w-2xl py-12 text-center">
            <h1 className="font-display text-5xl font-bold">What world should we build?</h1>
            <p className="mt-3 text-muted">One sentence is enough. Discovery returns five distinct franchise directions.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runDiscovery(prompt);
              }}
              className="mt-8 rounded-2xl border border-white/15 bg-panel p-2 text-left"
            >
              <textarea
                autoFocus
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    runDiscovery(prompt);
                  }
                }}
                rows={3}
                placeholder="a lighthouse keeper who can talk to storms"
                className="w-full resize-none bg-transparent p-3 text-lg outline-none placeholder:text-white/25"
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={!prompt.trim()}>
                  Run Discovery <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
            {error && <div className="mt-4 text-sm text-rose-300">{error}</div>}
          </motion.section>
        )}

        {step === "discovering" && (
          <motion.section key="disc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid place-items-center py-24 text-center">
            <div className="relative h-24 w-24">
              <motion.div className="absolute inset-0 rounded-full border-2 border-amber-300/40 border-t-amber-300" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }} />
              <Sparkles className="absolute inset-0 m-auto h-8 w-8 text-amber-300" />
            </div>
            <div className="font-display mt-6 text-2xl font-semibold">Nova is running Discovery</div>
            <div className="mt-1 max-w-md text-sm text-muted">&ldquo;{prompt}&rdquo;: exploring genres, audiences and tones for five directions.</div>
          </motion.section>
        )}

        {step === "concepts" && (
          <motion.section key="concepts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="mb-6">
              <h1 className="font-display text-3xl font-bold">Five directions for one idea</h1>
              <p className="mt-1 text-muted">&ldquo;{prompt}&rdquo;. Pick the one to develop. The others stay in the IP Lab as alternates.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {concepts.map((c, i) => (
                <ConceptCard key={i} c={c} onPick={() => develop(i)} />
              ))}
            </div>
          </motion.section>
        )}

        {step === "developing" && picked !== null && (
          <motion.section key="dev" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mx-auto max-w-xl py-10">
            <h1 className="font-display text-3xl font-bold">Developing {concepts[picked].title}</h1>
            <p className="mt-1 text-muted">Atlas has assigned the concept to five departments.</p>
            <div className="mt-8 space-y-3">
              {DEV_CREW.map((d, i) => (
                <motion.div key={d.agent} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.35 }} className="flex items-center gap-3 rounded-xl border border-line bg-panel p-3">
                  <AgentAvatar agent={d.agent} />
                  <div className="flex-1 text-sm">{d.task}</div>
                  <LoaderCircle className="h-4 w-4 animate-spin text-muted" />
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {step === "review" && dev && picked !== null && (
          <motion.section key="review" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <DevelopmentReview dev={dev} concept={concepts[picked]} onGreenlight={doGreenlight} saving={saving} onBack={() => setStep("concepts")} />
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}

function ConceptCard({ c, onPick }: { c: ConceptOutT; onPick: () => void }) {
  const [a, b, d] = c.palette;
  return (
    <Card className="group flex flex-col overflow-hidden transition hover:border-white/25">
      <div className="h-24" style={{ background: `radial-gradient(90% 120% at 90% 0%, ${b ?? "#6d28d9"}, transparent 60%), linear-gradient(135deg, ${a ?? "#1e1b4b"}, #07070c)` }}>
        <div className="flex h-full items-end gap-1 p-3">
          {c.palette.map((p) => (
            <span key={p} className="h-3 w-3 rounded-full border border-white/20" style={{ background: p }} />
          ))}
          <span className="ml-auto h-6 w-6 rounded-full" style={{ background: d ?? "#fbbf24", boxShadow: `0 0 24px ${d ?? "#fbbf24"}` }} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="text-[11px] uppercase tracking-wider text-amber-300">{c.genre}</div>
        <div className="font-display mt-1 text-2xl font-bold">{c.title}</div>
        <p className="mt-2 text-sm text-white/80">{c.logline}</p>
        <p className="mt-2 text-xs italic text-muted">{c.hook}</p>
        <div className="mt-3 flex flex-wrap gap-1">
          {c.formats.map((f) => (
            <Badge key={f} className="border-line text-muted">
              {f}
            </Badge>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <ScoreBar label="Originality" value={c.scores.originality} color="#a78bfa" />
          <ScoreBar label="Market" value={c.scores.marketability} color="#fbbf24" />
          <ScoreBar label="Expandability" value={c.scores.expandability} color="#34d399" />
          <ScoreBar label="Merch" value={c.scores.merchability} color="#f472b6" />
        </div>
        <div className="mt-3 text-[11px] text-muted">Like {c.comparables.join(" · ")}</div>
        <div className="mt-auto pt-5">
          <Button className="w-full" variant="secondary" onClick={onPick}>
            Develop this <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function DevelopmentReview({ dev, concept, onGreenlight, saving, onBack }: { dev: DevelopOutT; concept: ConceptOutT; onGreenlight: () => void; saving: boolean; onBack: () => void }) {
  return (
    <div>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-amber-300">Development draft · {concept.genre}</div>
          <h1 className="font-display mt-1 text-4xl font-bold">{dev.name}</h1>
          <p className="mt-1 max-w-2xl text-muted">{dev.tagline}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onBack}>
            Back to concepts
          </Button>
          <Button size="lg" onClick={onGreenlight} loading={saving}>
            <Crown className="h-4 w-4" /> Greenlight to canon
          </Button>
        </div>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Core</div>
          <p className="mt-2 font-medium">{dev.core.logline}</p>
          <p className="mt-3 text-sm text-white/75">{dev.core.premise}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs text-muted">Themes</div>
              <ul className="mt-1 text-sm">{dev.core.themes.map((t) => <li key={t}>· {t}</li>)}</ul>
            </div>
            <div>
              <div className="text-xs text-muted">Pillars</div>
              <ul className="mt-1 text-sm">{dev.core.pillars.map((t) => <li key={t}>· {t}</li>)}</ul>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Formats</div>
          <div className="mt-3 space-y-2">
            {dev.core.formats.map((f) => (
              <div key={f.name} className="flex items-center justify-between text-sm">
                <span>{f.name}</span>
                <Badge color={f.status === "core" ? "#fbbf24" : f.status === "planned" ? "#34d399" : "#9b9bb4"}>{f.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Cast</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {dev.characters.map((c) => (
              <div key={c.name} className="flex gap-3 rounded-xl bg-white/[0.03] p-3">
                <span className="mt-1 h-8 w-8 shrink-0 rounded-full" style={{ background: c.color }} />
                <div>
                  <div className="font-medium">
                    {c.name} <span className="text-xs text-muted">· {c.role}</span>
                  </div>
                  <div className="text-xs text-muted">{c.description}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">World</div>
          <p className="mt-2 text-sm">{dev.world.premise}</p>
          <div className="mt-3 space-y-1 text-sm">
            {dev.world.locations.map((l) => (
              <div key={l.name}>
                <span className="text-white">{l.name}</span> <span className="text-muted">· {l.kind}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-muted">{dev.world.rules.length} rules · {dev.world.factions.length} factions · {dev.world.timeline.length} timeline events</div>
        </Card>
      </div>
    </div>
  );
}
