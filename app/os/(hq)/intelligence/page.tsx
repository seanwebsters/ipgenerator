import { db } from "@/lib/db";
import { applyWinner, runNow } from "../../actions";
import { titleMetrics } from "@/engine/analytics/ingest";
import { DemoTag, Empty, PageHeader, pct, Section } from "@/components/os/bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function Intelligence() {
  const [titles, experiments, learnings, research, events] = await Promise.all([
    db.worldTitle.findMany({ where: { kind: "WATCH" }, include: { franchise: true }, orderBy: { publishedAt: "desc" } }),
    db.experiment.findMany({ include: { variants: true, results: { orderBy: { computedAt: "desc" }, take: 1 }, franchise: true }, orderBy: { createdAt: "desc" } }),
    db.learning.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    db.opportunityBrief.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
    db.analyticsEvent.count(),
  ]);
  const measured = await Promise.all(titles.map(async (t) => ({ t, m: await titleMetrics(t.id) })));
  measured.sort((a, b) => b.m.impressions - a.m.impressions);
  titles.splice(0, titles.length, ...measured.map((x) => x.t));
  const live = measured.map((x) => x.m);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Intelligence"
        title="What audiences actually do"
        intro={`Built only from real events (${events} recorded). Every rate carries a 95% interval; small samples are labelled as such. Correlation is never reported as cause.`}
        actions={
          <>
            <form action={runNow}><input type="hidden" name="kind" value="analytics.ingest" /><Button size="sm" variant="secondary">Ingest now</Button></form>
            <form action={runNow}><input type="hidden" name="kind" value="experiments.evaluate" /><Button size="sm" variant="secondary">Evaluate experiments</Button></form>
          </>
        }
      />
      <Section title="Title performance (Studio, live)">
        {titles.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr><th className="pb-2 font-medium">Title</th><th className="font-medium">Viewers</th><th className="font-medium">Plays</th><th className="font-medium">Play rate (95% CI)</th><th className="font-medium">Completion</th><th className="font-medium">Avg watch</th><th className="font-medium">Saves</th><th /></tr>
              </thead>
              <tbody>
                {titles.map((t, i) => {
                  const m = live[i];
                  return (
                    <tr key={t.id} className="border-t">
                      <td className="py-2.5"><div className="font-medium">{t.title} <DemoTag show={t.isDemo} /></div><div className="text-xs text-muted-foreground">{t.franchise.title}</div></td>
                      <td className="tabular-nums">{m.impressions}</td>
                      <td className="tabular-nums">{m.plays}</td>
                      <td className="tabular-nums">{pct(m.playRate)} <span className="text-xs text-muted-foreground">{m.playRate == null ? "" : `(${pct(m.playRateLow)}–${pct(m.playRateHigh)})`}</span>{m.impressions > 0 && m.impressions < 30 && <Badge variant="outline" className="ml-2">small sample</Badge>}{m.qaViewers > 0 && <Badge variant="warning" className="ml-1">{m.qaViewers} QA sessions</Badge>}</td>
                      <td className="tabular-nums">{pct(m.completionRate)}</td>
                      <td className="tabular-nums">{m.avgWatchSec == null ? "—" : `${m.avgWatchSec.toFixed(0)}s`}</td>
                      <td className="tabular-nums">{m.favorites}</td>
                      <td><form action={runNow}><input type="hidden" name="kind" value="learning.review" /><input type="hidden" name="titleId" value={t.id} /><Button size="sm" variant="ghost">Review now</Button></form></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty>No released titles yet.</Empty>}
      </Section>

      <Section title="Experiments">
        {experiments.length ? (
          <div className="space-y-4">
            {experiments.map((e) => {
              const r = e.results[0];
              const arms = r?.arms as Record<string, { n: number; successes: number; rate: number | null; ciLow: number | null; ciHigh: number | null }> | undefined;
              const d = e.design as { metric: string; minSamplePerArm: number };
              return (
                <div key={e.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={e.status === "RUNNING" ? "default" : e.status === "CONCLUDED" ? "success" : "outline"}>{e.status.toLowerCase()}</Badge>
                    <span className="text-xs text-muted-foreground">{e.franchise?.title} · {d.metric} · target {d.minSamplePerArm}/arm</span>
                  </div>
                  <div className="mt-2 text-sm">{e.hypothesis}</div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {e.variants.map((v) => {
                      const a = arms?.[v.key];
                      return (
                        <div key={v.id} className="rounded-lg bg-black/20 p-3 text-sm">
                          <div className="text-xs text-muted-foreground">Arm {v.key}</div>
                          <div className="font-medium">“{(v.payload as { title?: string }).title}”</div>
                          <div className="mt-1 text-xs tabular-nums text-muted-foreground">{a ? `${a.successes}/${a.n} · ${pct(a.rate, 1)} (${pct(a.ciLow)}–${pct(a.ciHigh)})` : "no data yet"}</div>
                        </div>
                      );
                    })}
                  </div>
                  {r && <div className="mt-3 text-xs text-muted-foreground">Latest evaluation: <b className="text-foreground">{r.conclusion.toLowerCase().replace(/_/g, " ")}</b>{r.pValue != null ? ` · effect ${((r.effect ?? 0) * 100).toFixed(1)} pts · p=${r.pValue.toFixed(3)}` : ""}</div>}
                  {r?.conclusion === "VARIANT_BETTER" && <form action={applyWinner} className="mt-3"><input type="hidden" name="experimentId" value={e.id} /><Button size="sm">Apply winning title</Button></form>}
                  <div className="mt-2 text-[11px] text-muted-foreground">Confounders: {(e.confounders as string[]).join("; ")}</div>
                </div>
              );
            })}
          </div>
        ) : <Empty>No experiments yet. The learning agent proposes one after a title has real viewers.</Empty>}
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Learning records">
          {learnings.length ? (
            <div className="space-y-3 text-sm">
              {learnings.map((l) => (
                <div key={l.id}>
                  <Badge variant={l.confidence === "HIGH" ? "success" : l.confidence === "MEDIUM" ? "warning" : "outline"}>{l.confidence.toLowerCase()}</Badge> {l.statement}
                  <div className="text-xs text-muted-foreground">Decision: {l.decision}{l.followUp ? ` · Next: ${l.followUp}` : ""}</div>
                </div>
              ))}
            </div>
          ) : <Empty>Nothing learned yet — no data has been measured.</Empty>}
        </Section>
        <Section title="Cultural Intelligence: opportunity briefs">
          {research.length ? (
            <div className="space-y-4 text-sm">
              {research.map((o) => (
                <div key={o.id}>
                  <div className="font-medium">{o.title} <span className="text-xs text-muted-foreground">· {o.audience} · score {o.score}</span> <DemoTag show={o.isDemo} /></div>
                  <div className="text-muted-foreground">{o.summary}</div>
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {(o.evidence as { claim: string; source: string; sourceKind: string; verified: boolean }[]).map((e, i) => (
                      <li key={i}>· {e.claim} <span className={e.verified ? "text-emerald-300" : "text-amber-200"}>[{e.sourceKind} · {e.verified ? "verified" : "unverified"} · {e.source.replace(/\s*\(unverified\)/i, "")}]</span></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : <Empty>No research yet.</Empty>}
        </Section>
      </div>
    </div>
  );
}
