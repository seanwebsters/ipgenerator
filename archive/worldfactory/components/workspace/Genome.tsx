"use client";

import { genome } from "@/lib/franchise";
import { Card, SectionTitle } from "@/components/ui";
import type { WorkspaceProps } from "./types";

export function Genome({ franchise: f }: WorkspaceProps) {
  const g = genome(f);
  const N = g.genes.length;
  const R = 130;
  const point = (i: number, v: number) => {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;
    return [160 + Math.cos(a) * R * (v / 100), 160 + Math.sin(a) * R * (v / 100)];
  };
  const poly = g.genes.map((x, i) => point(i, x.value).join(",")).join(" ");
  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">IP Genome</h1>
        <div className="text-sm text-muted">
          The traits that make {f.name} recognisable, scored from canon. Signature <code className="font-mono text-amber-200">{g.signature}</code>
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card className="p-5">
          <svg viewBox="0 0 320 320" className="w-full">
            {[25, 50, 75, 100].map((v) => (
              <polygon key={v} points={g.genes.map((_, i) => point(i, v).join(",")).join(" ")} fill="none" stroke="rgba(255,255,255,0.08)" />
            ))}
            <polygon points={poly} fill="rgba(167,139,250,0.25)" stroke="#a78bfa" strokeWidth={2} />
            {g.genes.map((x, i) => {
              const [lx, ly] = point(i, 118);
              return (
                <text key={x.key} x={lx} y={ly} fontSize="10" fill="rgba(255,255,255,0.7)" textAnchor="middle" dominantBaseline="middle">
                  {x.label}
                </text>
              );
            })}
          </svg>
        </Card>
        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle eyebrow="Eight genes" title="Trait profile" />
            <div className="grid gap-4 md:grid-cols-2">
              {g.genes.map((x) => (
                <div key={x.key} className="flex items-center gap-3">
                  <div className="font-display w-12 text-2xl font-bold tabular-nums text-violet-300">{x.value}</div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{x.label}</div>
                    <div className="text-xs text-muted">{x.note}</div>
                    <div className="mt-1 h-1 rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-violet-400" style={{ width: `${x.value}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <SectionTitle eyebrow="Shared DNA" title="Lineage" />
            <div className="space-y-2">
              {g.lineage.map((l) => (
                <div key={l.title} className="flex items-center gap-3 text-sm">
                  <span className="w-56 truncate">{l.title}</span>
                  <div className="h-1.5 flex-1 rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-amber-300" style={{ width: `${l.match}%` }} />
                  </div>
                  <span className="w-10 text-right tabular-nums text-muted">{l.match}%</span>
                </div>
              ))}
            </div>
            <div className="mt-3 text-[11px] text-muted">Similarity in tone and structure, not content. Scores are a deterministic model of the canon, refreshed with every version.</div>
          </Card>
        </div>
      </div>
    </div>
  );
}
