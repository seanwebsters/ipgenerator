import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { media } from "@/lib/world";
import { usd } from "@/lib/util";
import { ago, DemoTag, Empty, pct, Section, Stat, StatusBadge } from "@/components/os/bits";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { proposeCanonChange, reviewAsset, startDevelopment } from "../../../actions";

export const dynamic = "force-dynamic";

const CANON_MSG: Record<string, string> = { unchanged: "Nothing changed — no proposal created.", "bad-color": "Colour must be a hex value like #c9a35c.", "duplicate-name": "Another character already has that name." };

export default async function FranchiseWorkspace({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ canon?: string }> }) {
  const { slug } = await params;
  const { canon: canonMsg } = await searchParams;
  const f = await db.franchise.findUnique({
    where: { slug },
    include: {
      universe: true,
      concept: true,
      entities: { orderBy: { createdAt: "asc" }, include: { outgoing: { include: { to: true } } } },
      versions: { orderBy: { version: "desc" } },
      productions: { include: { assets: { orderBy: { createdAt: "asc" } }, scripts: { orderBy: { revision: "desc" } }, releases: { include: { publications: true } } }, orderBy: { createdAt: "desc" } },
      agents: true,
      titles: true,
      experiments: { include: { variants: true, results: { orderBy: { computedAt: "desc" }, take: 1 } }, orderBy: { createdAt: "desc" } },
      learnings: { orderBy: { createdAt: "desc" }, take: 10 },
      opportunities: { orderBy: { createdAt: "desc" } },
      runs: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!f) notFound();
  const spend = await db.generationRecord.aggregate({ where: { runId: { in: f.runs.map((r) => r.id) } }, _sum: { costUsd: true } });
  const spent = Number(spend._sum.costUsd ?? 0);
  const of = (t: string) => f.entities.filter((e) => e.type === t);
  const chars = of("CHARACTER");
  const backdrop = f.productions.flatMap((p) => p.assets).filter((a) => a.kind === "KEY_ART").pop();
  const director = f.agents.find((a) => a.role === "FRANCHISE_DIRECTOR");
  const snapshots = await db.metricSnapshot.findMany({ where: { franchiseId: f.id, source: "webster-world" }, orderBy: { windowEnd: "desc" }, take: f.titles.length || 1 });
  const style = of("STYLE_GUIDE")[0]?.data as Record<string, string | string[]> | undefined;
  const theme = of("MUSIC_THEME")[0];

  return (
    <div className="space-y-6">
      <div className="relative isolate overflow-hidden rounded-2xl border">
        {backdrop && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media(backdrop.storageKey) ?? ""} alt="" className="absolute inset-0 -z-10 size-full object-cover" />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/80 to-background/20" />
        <div className="p-8 sm:p-10">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="brass">{f.universe?.name ?? "Universe pending"}</Badge>
            <Badge variant={f.status === "ACTIVE" ? "success" : "outline"}>{f.status.toLowerCase()}</Badge>
            <Badge variant="outline">canon v{f.canonVersion}</Badge>
            <DemoTag show={f.isDemo} />
          </div>
          <h1 className="font-display mt-3 text-5xl sm:text-6xl">{f.title}</h1>
          <p className="mt-3 max-w-2xl text-foreground/85">{f.synopsis || f.logline}</p>
          <div className="mt-2 text-sm text-muted-foreground">{f.genre} · {f.audience} · {f.tone}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Characters" value={chars.length} />
        <Stat label="Productions" value={f.productions.length} />
        <Stat label="Released" value={f.titles.length} />
        <Stat label="Spend" value={usd(spent)} hint={`budget ${usd(f.budgetUsd)}`} />
        <Stat label="Experiments" value={f.experiments.length} />
      </div>

      {canonMsg && CANON_MSG[canonMsg] && <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">{CANON_MSG[canonMsg]}</div>}
      {(() => {
        const flagged = f.productions.flatMap((p) => p.assets.filter((a) => a.status === "NEEDS_REVIEW"));
        if (!flagged.length) return null;
        return (
          <Section title={`Quality review: ${flagged.length} asset(s) depend on changed canon`}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {flagged.slice(0, 12).map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-lg border border-amber-400/25 bg-amber-400/5 p-2">
                  {a.mimeType.startsWith("image/") && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={media(a.storageKey) ?? ""} alt="" className="h-12 w-20 rounded object-cover" />
                  )}
                  <div className="min-w-0 flex-1 text-xs"><div className="truncate font-medium">{a.title}</div><div className="text-muted-foreground">{a.kind.toLowerCase().replace("_", " ")} · approved at canon v{a.canonVersion}</div></div>
                  <form action={reviewAsset}><input type="hidden" name="assetId" value={a.id} /><Button size="sm" variant="secondary" name="verdict" value="keep">Still canon</Button></form>
                  <form action={reviewAsset}><input type="hidden" name="assetId" value={a.id} /><Button size="sm" variant="ghost" name="verdict" value="retire">Retire</Button></form>
                </div>
              ))}
            </div>
            {flagged.length > 12 && <p className="mt-2 text-xs text-muted-foreground">…and {flagged.length - 12} more.</p>}
          </Section>
        );
      })()}

      <Tabs defaultValue="canon">
        <TabsList>
          <TabsTrigger value="canon">Canon</TabsTrigger>
          <TabsTrigger value="assets">Productions & assets</TabsTrigger>
          <TabsTrigger value="releases">Releases</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="ledger">Canon ledger</TabsTrigger>
          <TabsTrigger value="director">Director & roadmap</TabsTrigger>
        </TabsList>

        <TabsContent value="canon" className="space-y-6">
          <Section title={`Characters (${chars.length})`}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {chars.map((c) => {
                const d = c.data as { color?: string; role?: string; age?: string; personality?: string[]; motivation?: string; flaw?: string; appearance?: string; voice?: string };
                return (
                  <div key={c.id} className="rounded-xl border bg-black/10 p-4">
                    <div className="flex items-center gap-3">
                      <span className="size-10 shrink-0 rounded-full" style={{ background: `radial-gradient(circle at 30% 30%, ${d.color}, ${d.color}44)` }} />
                      <div className="min-w-0">
                        <div className="font-display text-xl">{c.name}</div>
                        <div className="text-[11px] uppercase tracking-wider text-brass">{d.role} · {d.age}</div>
                      </div>
                      <Badge variant={c.status === "ESTABLISHED" ? "success" : "outline"} className="ml-auto">{c.status.toLowerCase()}</Badge>
                    </div>
                    <dl className="mt-3 space-y-1.5 text-sm">
                      <div><dt className="inline text-muted-foreground">Wants </dt><dd className="inline">{d.motivation}</dd></div>
                      <div><dt className="inline text-muted-foreground">Flaw </dt><dd className="inline">{d.flaw}</dd></div>
                      <div><dt className="inline text-muted-foreground">Look </dt><dd className="inline">{d.appearance}</dd></div>
                      <div><dt className="inline text-muted-foreground">Voice </dt><dd className="inline">{d.voice}</dd></div>
                    </dl>
                    {c.outgoing.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {c.outgoing.map((r) => <Badge key={r.id} variant="outline">{r.kind} {r.to.name}</Badge>)}
                      </div>
                    )}
                    <div className="mt-2 text-[11px] text-muted-foreground">revision {c.revision}</div>
                    <details className="mt-3 rounded-lg border bg-black/20 p-3 text-sm">
                      <summary className="cursor-pointer text-xs text-primary">Propose canon change</summary>
                      <form action={proposeCanonChange} className="mt-3 space-y-2">
                        <input type="hidden" name="entityId" value={c.id} />
                        <Input name="name" defaultValue={c.name} aria-label="Name" />
                        <Textarea name="appearance" defaultValue={d.appearance} rows={2} aria-label="Appearance" />
                        <Textarea name="motivation" defaultValue={d.motivation} rows={2} aria-label="Motivation" />
                        <Input name="flaw" defaultValue={d.flaw} aria-label="Flaw" />
                        <Input name="voice" defaultValue={d.voice} aria-label="Voice" />
                        <Input name="color" defaultValue={d.color} aria-label="Colour" />
                        <Input name="reason" placeholder="Why? (recorded in the canon ledger)" />
                        <Button size="sm">Submit for approval</Button>
                      </form>
                    </details>
                  </div>
                );
              })}
            </div>
          </Section>
          <div className="grid gap-6 xl:grid-cols-2">
            <Section title="Locations">
              <div className="space-y-3">{of("LOCATION").map((l) => <div key={l.id}><div className="font-medium">{l.name} <span className="text-xs text-muted-foreground">· {(l.data as { mood?: string }).mood}</span></div><div className="text-sm text-muted-foreground">{l.summary}</div></div>)}</div>
            </Section>
            <Section title="World rules">
              <div className="space-y-3">{of("RULE").map((r) => <div key={r.id}><div className="font-medium">{r.name}</div><div className="text-sm text-muted-foreground">{r.summary}</div></div>)}</div>
            </Section>
            <Section title="Story arcs">
              <div className="space-y-3">{of("ARC").map((r) => <div key={r.id}><div className="font-medium">{r.name}</div><div className="text-sm text-muted-foreground">{r.summary}</div></div>)}</div>
            </Section>
            <Section title="Timeline">
              <ol className="space-y-2 border-l pl-4">{of("EVENT").map((e) => <li key={e.id} className="text-sm"><span className="text-xs uppercase tracking-wider text-brass">{(e.data as { when?: string }).when}</span> — <b className="font-medium">{e.name}</b>: <span className="text-muted-foreground">{e.summary}</span></li>)}</ol>
            </Section>
            <Section title="Visual style guide">
              {style ? (
                <dl className="space-y-2 text-sm">
                  {Object.entries(style).map(([k, v]) => <div key={k}><dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</dt><dd>{Array.isArray(v) ? v.join(" · ") : v}</dd></div>)}
                  <div className="flex gap-1.5 pt-1">{(f.palette as string[]).map((c) => <span key={c} title={c} className="size-6 rounded-full border" style={{ background: c }} />)}</div>
                </dl>
              ) : <Empty>No style guide yet.</Empty>}
            </Section>
            <Section title="Music theme & voices">
              {theme && <div className="text-sm"><div className="font-medium">{theme.name}</div><div className="text-muted-foreground">{theme.summary} · {(theme.data as { instrumentation?: string }).instrumentation}</div></div>}
              <div className="mt-3 space-y-1 text-sm">{of("VOICE_PROFILE").map((v) => <div key={v.id}><span className="text-muted-foreground">{v.name}:</span> {v.summary}</div>)}</div>
              <p className="mt-3 text-xs text-muted-foreground">Voice profiles describe performance only. Real-person voice cloning is never used without documented authorisation.</p>
            </Section>
          </div>
        </TabsContent>

        <TabsContent value="assets" className="space-y-6">
          {f.productions.length ? f.productions.map((p) => {
            const video = [...p.assets].reverse().find((a) => a.kind === "VIDEO");
            const frames = p.assets.filter((a) => a.kind === "STORYBOARD_FRAME");
            const latestRev = Math.max(0, ...frames.map((a) => a.revision));
            const script = p.scripts[0];
            return (
              <Section key={p.id} title={`${p.title} · ${p.format.toLowerCase()} · ${p.status.toLowerCase().replace("_", " ")}`} action={<span className="text-xs text-muted-foreground">{p.assets.length} assets</span>}>
                <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
                  <div>
                    {video ? (
                      <video src={media(video.storageKey) ?? undefined} controls className="aspect-video w-full rounded-lg border bg-black" />
                    ) : p.format === "COMIC" ? (
                      <div className="grid grid-cols-3 gap-2">
                        {p.assets.filter((a) => a.kind === "DOCUMENT").map((a) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={a.id} src={media(a.storageKey) ?? ""} alt={a.title} className="w-full rounded border" />
                        ))}
                      </div>
                    ) : p.format === "GAME" ? null : (
                      <Empty>No cut yet.</Empty>
                    )}
                    <div className="mt-3 grid grid-cols-4 gap-2 md:grid-cols-6">
                      {frames.filter((a) => a.revision === latestRev || latestRev === 0).map((a) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={a.id} src={media(a.storageKey) ?? ""} alt={a.title} title={`${a.title} · ${a.provider} · ${a.rightsStatus}`} className="aspect-video w-full rounded border object-cover" />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    {script && (
                      <div className="max-h-72 overflow-y-auto rounded-lg border bg-black/20 p-4 text-sm">
                        <div className="mb-2 text-xs text-muted-foreground">Script r{script.revision} · canon v{script.canonVersion} · {script.provider}{script.isDemo ? " · DEMO" : ""}</div>
                        {(script.content as { nodes?: { id: string; text: string; ending: string; choices: { label: string; to: string }[] }[] }).nodes?.map((n) => (
                          <div key={n.id} className="mb-2">
                            <span className="font-mono text-xs text-brass">{n.id}{n.ending ? ` · ${n.ending} ending` : ""}</span> <span className="text-muted-foreground">{n.text}</span>
                            {n.choices.length > 0 && <div className="text-xs">{n.choices.map((c) => `“${c.label}” → ${c.to}`).join(" · ")}</div>}
                          </div>
                        ))}
                        {((script.content as { scenes?: { heading: string; action: string; dialogue: { character: string; line: string }[] }[] }).scenes ?? []).map((s, i) => (
                          <div key={i} className="mb-3">
                            <div className="font-mono text-xs text-brass">{s.heading}</div>
                            <div className="text-muted-foreground">{s.action}</div>
                            {s.dialogue.map((d, j) => <div key={j}><b className="text-xs uppercase tracking-wider">{d.character}</b> {d.line}</div>)}
                          </div>
                        ))}
                      </div>
                    )}
                    <table className="w-full text-xs">
                      <thead className="text-left text-muted-foreground"><tr><th className="py-1 font-medium">Asset</th><th className="font-medium">Provider</th><th className="font-medium">Rights</th><th className="font-medium">Status</th></tr></thead>
                      <tbody>
                        {p.assets.filter((a) => a.kind !== "STORYBOARD_FRAME").map((a) => (
                          <tr key={a.id} className="border-t">
                            <td className="py-1.5">{a.kind.toLowerCase().replace("_", " ")} r{a.revision}</td>
                            <td>{a.provider}{a.aiGenerated ? " (AI)" : ""}</td>
                            <td>{a.rightsStatus.toLowerCase().replace("_", " ")}</td>
                            <td><Badge variant={a.status === "APPROVED" ? "success" : a.status === "NEEDS_REVIEW" ? "warning" : "outline"}>{a.status.toLowerCase().replace("_", " ")}</Badge></td>
                          </tr>
                        ))}
                        <tr className="border-t"><td className="py-1.5">storyboard frames</td><td colSpan={3} className="text-muted-foreground">{frames.length} across {latestRev || 1} revision(s) · {frames[0]?.provider}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </Section>
            );
          }) : <Empty>No productions yet.</Empty>}
        </TabsContent>

        <TabsContent value="releases">
          <Section title="Releases & distribution">
            {f.productions.flatMap((p) => p.releases).length ? (
              <div className="space-y-4">
                {f.productions.flatMap((p) => p.releases).map((r) => (
                  <div key={r.id} className="rounded-lg border p-4">
                    <div className="flex items-center gap-2"><span className="font-medium">{r.title}</span><Badge variant={r.status === "PUBLISHED" ? "success" : "outline"}>{r.status.toLowerCase().replace("_", " ")}</Badge><DemoTag show={r.isDemo} /></div>
                    <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Disclosure: {r.aiDisclosure}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.publications.map((p) => (
                        <div key={p.id} className="rounded-lg border px-3 py-2 text-xs">
                          <div className="flex items-center gap-2"><b>{p.channelKey}</b><Badge variant={p.status === "PUBLISHED" ? "success" : p.status === "FAILED" ? "danger" : "outline"}>{p.status.toLowerCase().replace(/_/g, " ")}</Badge></div>
                          {p.url && <Link href={p.url} className="text-primary">{p.url}</Link>}
                          {p.error && <div className="max-w-xs text-muted-foreground">{p.error}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : <Empty>Nothing released yet.</Empty>}
          </Section>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <Section title="Measured on Studio">
            {snapshots.length ? (
              <div className="space-y-2 text-sm">
                {snapshots.map((s) => {
                  const m = s.metrics as { impressions: number; plays: number; completions: number; playRate: number | null; playRateLow: number | null; playRateHigh: number | null; completionRate: number | null; avgWatchSec: number | null };
                  const t = f.titles.find((x) => x.id === s.titleId);
                  return (
                    <div key={s.id} className="grid grid-cols-2 gap-3 rounded-lg border p-3 md:grid-cols-6">
                      <div className="col-span-2 font-medium">{t?.title}</div>
                      <div>{m.impressions} viewers</div>
                      <div>{m.plays} plays</div>
                      <div>play {pct(m.playRate)} <span className="text-xs text-muted-foreground">({pct(m.playRateLow)}–{pct(m.playRateHigh)})</span></div>
                      <div>completion {pct(m.completionRate)}</div>
                    </div>
                  );
                })}
                <p className="text-xs text-muted-foreground">Intervals are 95% Wilson intervals. Small samples are wide by design.</p>
              </div>
            ) : <Empty>No measurements yet. Ingestion runs every 2 minutes once a title is live.</Empty>}
          </Section>
          <Section title="Experiments">
            {f.experiments.length ? f.experiments.map((e) => (
              <div key={e.id} className="mb-3 rounded-lg border p-3 text-sm">
                <div className="flex items-center gap-2"><Badge variant="brass">{e.status.toLowerCase()}</Badge><span>{e.hypothesis}</span></div>
                <div className="mt-1 text-xs text-muted-foreground">{e.variants.map((v) => `${v.key}: “${(v.payload as { title?: string }).title}”`).join(" vs ")}{e.results[0] ? ` · latest: ${e.results[0].conclusion.toLowerCase().replace(/_/g, " ")}` : ""}</div>
              </div>
            )) : <Empty>No experiments yet.</Empty>}
          </Section>
          <Section title="Learnings">
            {f.learnings.length ? f.learnings.map((l) => (
              <div key={l.id} className="mb-3 text-sm"><Badge variant={l.confidence === "HIGH" ? "success" : l.confidence === "MEDIUM" ? "warning" : "outline"}>{l.confidence.toLowerCase()} confidence</Badge> {l.statement} <span className="text-muted-foreground">→ {l.decision}</span></div>
            )) : <Empty>No learnings recorded yet.</Empty>}
          </Section>
        </TabsContent>

        <TabsContent value="ledger">
          <Section title="Canon versions (hashed)">
            <div className="space-y-2">
              {f.versions.map((v) => (
                <div key={v.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                  <span className="font-display text-2xl">v{v.version}</span>
                  <div className="flex-1"><div>{v.summary}</div><div className="text-xs text-muted-foreground">{v.createdBy} · {ago(v.createdAt)}{(v.changes as string[]).length ? ` · ${(v.changes as string[]).join("; ")}` : ""}</div></div>
                  <code className="rounded bg-black/40 px-2 py-0.5 font-mono text-[11px] text-emerald-300">{v.hash.slice(0, 16)}</code>
                </div>
              ))}
              {!f.versions.length && <Empty>Canon not established yet.</Empty>}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Established canon, proposed additions and non-canon experiments are tracked per entity. Changes create a new version and flag dependent assets for review.</p>
          </Section>
        </TabsContent>

        <TabsContent value="director" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <Section title="Franchise Director">
              {director ? (
                <div className="text-sm">
                  <div className="font-display text-2xl">{director.name}</div>
                  <div className="text-muted-foreground">{director.title}</div>
                  <div className="mt-3 flex flex-wrap gap-1.5">{(director.tools as string[]).map((t) => <Badge key={t} variant="outline">{t}</Badge>)}</div>
                  <pre className="mt-3 rounded bg-black/30 p-3 text-xs text-muted-foreground">{JSON.stringify(director.permissions, null, 2)}</pre>
                </div>
              ) : <Empty>Assigned when the franchise is greenlit.</Empty>}
            </Section>
            <Section title="Production runs">
              <div className="space-y-2">
                {f.runs.map((r) => (
                  <Link key={r.id} href={`/os/floor?run=${r.id}`} className="flex items-center gap-2 text-sm hover:text-primary">
                    <span className="flex-1">{r.type}</span><span className="text-xs text-muted-foreground">{usd(r.costUsd)}</span><StatusBadge status={r.status} />
                  </Link>
                ))}
              </div>
            </Section>
          </div>
          <Section
            title="Growth opportunities"
            action={
              <form action={startDevelopment}>
                <input type="hidden" name="franchiseId" value={f.id} />
                <Button size="sm" variant="secondary">Start development cycle</Button>
              </form>
            }
          >
            {f.opportunities.length ? (
              <div className="space-y-2">
                {f.opportunities.map((o) => (
                  <div key={o.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
                    <Badge variant="outline">{o.kind.toLowerCase()}</Badge>
                    <span className="flex-1 font-medium">{o.title}</span>
                    <span className="text-xs text-muted-foreground">{o.estCostUsd == null ? "cost unknown" : `est. ${usd(o.estCostUsd)}`}</span>
                    <Badge variant={o.status === "IN_PRODUCTION" ? "success" : o.status === "DECLINED" ? "outline" : "brass"}>{o.status.toLowerCase().replace("_", " ")}</Badge>
                    {o.runId && <Link href={`/os/floor?run=${o.runId}`} className="text-xs text-primary">run →</Link>}
                  </div>
                ))}
              </div>
            ) : (
              <Empty>No proposals yet. Start a development cycle, or enable the flywheel in Settings.</Empty>
            )}
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
