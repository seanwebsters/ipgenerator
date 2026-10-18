import Link from "next/link";
import { db } from "@/lib/db";
import { CommandBar } from "@/components/os/command-bar";
import { ago, PageHeader, Section, StatusBadge } from "@/components/os/bits";

export const dynamic = "force-dynamic";

export default async function Copilot() {
  const history = await db.auditLog.findMany({ where: { action: "copilot.command" }, orderBy: { createdAt: "desc" }, take: 20 });
  const briefs = await db.brief.findMany({ include: { runs: true, concepts: true }, orderBy: { createdAt: "desc" }, take: 10 });
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader eyebrow="Founder copilot" title="Direct the studio in plain language" intro="Commands become durable workflows owned by the Chief Studio Agent. They still pass every budget cap and approval gate — the copilot cannot grant itself permissions." />
      <CommandBar big />
      <Section title="Briefs">
        <div className="space-y-3">
          {briefs.map((b) => (
            <div key={b.id} className="rounded-lg border p-3">
              <div className="text-sm">“{b.text}”</div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{ago(b.createdAt)} · {b.concepts.length} concepts</span>
                {b.runs.map((r) => (
                  <Link key={r.id} href={`/os/floor?run=${r.id}`} className="inline-flex items-center gap-1 hover:text-foreground">{r.type} <StatusBadge status={r.status} /></Link>
                ))}
              </div>
            </div>
          ))}
          {!briefs.length && <div className="text-sm text-muted-foreground">No briefs yet.</div>}
        </div>
      </Section>
      <Section title="Command history">
        <div className="space-y-2 font-mono text-xs">
          {history.map((h) => {
            const d = h.data as { text: string; intent: { action: string }; provider: string };
            return <div key={h.id} className="flex gap-3"><span className="text-muted-foreground">{h.createdAt.toISOString().slice(0, 16).replace("T", " ")}</span><span className="text-brass">{d.intent?.action}</span><span className="truncate">{d.text}</span></div>;
          })}
        </div>
      </Section>
    </div>
  );
}
