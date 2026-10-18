import Link from "next/link";
import { db } from "@/lib/db";
import { refreshChannelStatus } from "../../actions";
import { DemoTag, Empty, PageHeader, Section } from "@/components/os/bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function Calendar() {
  const [channels, pubs, scheduled, schedules] = await Promise.all([
    db.channel.findMany({ orderBy: { key: "asc" } }),
    db.publication.findMany({ include: { release: { include: { franchise: true } } }, orderBy: { createdAt: "desc" }, take: 60 }),
    db.job.findMany({ where: { status: "QUEUED", runAt: { gt: new Date() } }, orderBy: { runAt: "asc" }, take: 20 }),
    db.schedule.findMany(),
  ]);
  // 14-day grid: 7 days back, 7 forward.
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 7 + i);
    return d;
  });
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Content calendar" title="Releases across every channel" intro="Publications only happen through authorised integrations. Unconnected channels are skipped and recorded, never faked." actions={<form action={refreshChannelStatus}><Button variant="secondary" size="sm">Re-check channels</Button></form>} />
      <div className="grid gap-3 md:grid-cols-4">
        {channels.map((c) => (
          <div key={c.key} className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between"><span className="font-medium">{c.name}</span><Badge variant={c.status === "CONNECTED" ? "success" : c.status === "ERROR" ? "danger" : "outline"}>{c.status.replace("_", " ").toLowerCase()}</Badge></div>
            <p className="mt-2 text-xs text-muted-foreground">{c.lastError ?? c.notes}</p>
          </div>
        ))}
      </div>
      <Section title="Two-week view">
        <div className="grid grid-cols-7 gap-2">
          {days.map((d) => {
            const items = pubs.filter((p) => sameDay(p.publishedAt ?? p.createdAt, d));
            const today = sameDay(d, new Date());
            return (
              <div key={d.toISOString()} className={`min-h-28 rounded-lg border p-2 ${today ? "border-primary/50 bg-primary/5" : "bg-black/10"}`}>
                <div className="text-[11px] text-muted-foreground">{d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}</div>
                {items.map((p) => (
                  <div key={p.id} className={`mt-1 truncate rounded px-1.5 py-0.5 text-[10px] ${p.status === "PUBLISHED" ? "bg-emerald-400/15 text-emerald-200" : "bg-white/5 text-muted-foreground"}`} title={`${p.channelKey}: ${p.release.title} (${p.status})`}>
                    {p.channelKey === "webster-world" ? "World" : p.channelKey} · {p.release.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </Section>
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Publication log">
          {pubs.length ? (
            <div className="space-y-2 text-sm">
              {pubs.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <Badge variant={p.status === "PUBLISHED" ? "success" : p.status === "FAILED" ? "danger" : "outline"}>{p.status.replace(/_/g, " ").toLowerCase()}</Badge>
                  <span className="w-28 shrink-0 text-xs text-muted-foreground">{p.channelKey}</span>
                  <span className="flex-1 truncate">{p.release.title} <DemoTag show={p.release.isDemo} /></span>
                  {p.url && <Link href={p.url} className="text-xs text-primary">open</Link>}
                </div>
              ))}
            </div>
          ) : <Empty>No publications yet.</Empty>}
        </Section>
        <Section title="Scheduled engine work">
          <div className="space-y-2 text-sm">
            {scheduled.map((j) => <div key={j.id} className="flex justify-between"><span className="font-mono text-xs">{j.kind}</span><span className="text-xs text-muted-foreground">{j.runAt.toLocaleString()}</span></div>)}
            {schedules.map((s) => <div key={s.key} className="flex justify-between text-muted-foreground"><span className="font-mono text-xs">{s.jobKind} (every {Math.round(s.intervalSec / 60)} min)</span><span className="text-xs">next {s.nextRunAt.toLocaleTimeString()}</span></div>)}
          </div>
        </Section>
      </div>
    </div>
  );
}
