"use client";

import { useMemo, useState } from "react";
import { simulate } from "@/lib/franchise";
import { Card, SectionTitle } from "@/components/ui";
import { cx } from "@/lib/util";
import type { WorkspaceProps } from "./types";

const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}k` : String(Math.round(n)));
const money = (n: number) => `$${fmt(n)}`;

export function Simulator({ franchise: f }: WorkspaceProps) {
  const [budget, setBudget] = useState(40);
  const [cadence, setCadence] = useState(5);
  const [months, setMonths] = useState(24);
  const [hero, setHero] = useState(f.core.formats.find((x) => x.status === "core")?.name ?? f.core.formats[0]?.name ?? "Series");
  const r = useMemo(() => simulate(f, { budget, cadence, hero, months }), [f, budget, cadence, hero, months]);

  const W = 640;
  const H = 200;
  const max = Math.max(...r.audience);
  const path = r.audience.map((v, i) => `${i === 0 ? "M" : "L"}${(i / (r.audience.length - 1)) * W},${H - (v / max) * (H - 10)}`).join(" ");
  const maxRev = Math.max(...r.revenue.map((x) => x.value));

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">Franchise Simulator</h1>
        <div className="text-sm text-muted">A directional model of audience and revenue driven by the IP Genome. Use it to compare strategies, not to forecast.</div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
        <Card className="space-y-5 p-5">
          <Slider label="Monthly budget" value={budget} min={5} max={200} step={5} display={`$${budget}k`} onChange={setBudget} />
          <Slider label="Social cadence" value={cadence} min={0} max={14} display={`${cadence} posts/week`} onChange={setCadence} />
          <Slider label="Horizon" value={months} min={6} max={36} display={`${months} months`} onChange={setMonths} />
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Lead format</div>
            <div className="flex flex-wrap gap-1.5">
              {f.core.formats.map((x) => (
                <button key={x.name} onClick={() => setHero(x.name)} className={cx("rounded-full border px-2.5 py-1 text-xs", hero === x.name ? "border-amber-300 bg-amber-300 text-ink" : "border-line text-muted")}>
                  {x.name}
                </button>
              ))}
            </div>
          </div>
        </Card>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Audience at horizon" value={fmt(r.audience[r.audience.length - 1])} />
            <Kpi label="Projected revenue" value={money(r.totalRevenue)} />
            <Kpi label="Spend" value={money(r.totalCost)} />
            <Kpi label="Breakeven" value={r.breakevenMonth ? `Month ${r.breakevenMonth}` : "Beyond horizon"} tone={r.breakevenMonth ? "#34d399" : "#f87171"} />
          </div>
          <Card className="p-5">
            <SectionTitle eyebrow="Monthly" title="Audience" />
            <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full">
              <defs>
                <linearGradient id="aud" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={`${path} L${W},${H} L0,${H} Z`} fill="url(#aud)" />
              <path d={path} fill="none" stroke="#fbbf24" strokeWidth={2.5} />
              {r.breakevenMonth && <line x1={((r.breakevenMonth - 1) / (months - 1)) * W} x2={((r.breakevenMonth - 1) / (months - 1)) * W} y1={0} y2={H} stroke="#34d399" strokeDasharray="4 4" />}
              <text x={0} y={H + 16} fontSize="11" fill="rgba(255,255,255,0.5)">Month 1</text>
              <text x={W} y={H + 16} fontSize="11" fill="rgba(255,255,255,0.5)" textAnchor="end">Month {months}</text>
            </svg>
          </Card>
          <Card className="p-5">
            <SectionTitle eyebrow="Over the horizon" title="Revenue by stream" />
            <div className="space-y-3">
              {r.revenue.map((x) => (
                <div key={x.stream} className="flex items-center gap-3 text-sm">
                  <span className="w-40">{x.stream}</span>
                  <div className="h-2 flex-1 rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-violet-400" style={{ width: `${(x.value / maxRev) * 100}%` }} />
                  </div>
                  <span className="w-16 text-right tabular-nums text-muted">{money(x.value)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, display, onChange }: { label: string; value: number; min: number; max: number; step?: number; display: string; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <div className="mb-2 flex justify-between text-[11px] font-semibold uppercase tracking-wider text-muted">
        <span>{label}</span>
        <span className="text-white">{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-amber-300" />
    </label>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xl font-semibold tabular-nums" style={tone ? { color: tone } : undefined}>{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
    </Card>
  );
}
