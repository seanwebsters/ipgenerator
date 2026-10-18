"use client";

import { useState } from "react";
import { Check, Pencil, WandSparkles } from "lucide-react";
import type { Franchise } from "@/lib/types";
import { addWorld, briefOf, commitEntityChange } from "@/lib/franchise";
import { ai } from "@/lib/ai/client";
import { Badge, Button, Card, inputCls, SectionTitle } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { seeded } from "@/lib/util";
import { GeneratePanel } from "./LightStudio";
import { AssetGrid, StudioHeader } from "./shared";
import type { WorkspaceProps } from "./types";

type Collection = "locations" | "rules" | "factions";

export function WorldBuilder(props: WorkspaceProps) {
  const { franchise: f, update } = props;
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const expand = async () => {
    setBusy(true);
    try {
      const res = await ai.world(briefOf(f));
      await update((d) => addWorld(d, res.data));
      toast({ title: "Mercator expanded the world", body: [...res.data.locations, ...res.data.factions].map((x) => x.name).join(", ") });
    } finally {
      setBusy(false);
    }
  };

  /** Edit the main text of a world entity and commit it to canon. */
  const edit = (col: Collection, id: string, label: string, text: string) =>
    update((d) => {
      const list = d.world[col] as { id: string; description: string }[];
      const item = list.find((x) => x.id === id);
      if (!item || item.description === text) return 0;
      item.description = text;
      return commitEntityChange(d, id, label, ["description updated"]);
    }).then((n) => toast({ title: `Canon v${f.canon.version + 1}: ${label} updated`, body: n ? `${n} assets flagged for review.` : undefined }));

  return (
    <div>
      <StudioHeader studio="world" subtitle={f.world.setting}>
        <Button onClick={expand} loading={busy}>
          <WandSparkles className="h-4 w-4" /> Expand the world
        </Button>
      </StudioHeader>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card className="overflow-hidden">
          <WorldMap f={f} />
        </Card>
        <Card className="p-6">
          <SectionTitle eyebrow={f.world.era} title="World premise" />
          <p className="text-white/85">{f.world.premise}</p>
          <div className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted">Rules of the world</div>
          <div className="mt-3 space-y-3">
            {f.world.rules.map((r, i) => (
              <EditableRow key={r.id} title={`${i + 1}. ${r.title}`} text={r.description} onSave={(t) => edit("rules", r.id, `Rule "${r.title}"`, t)} />
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <SectionTitle eyebrow={`${f.world.locations.length} places`} title="Locations" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {f.world.locations.map((l) => (
            <Card key={l.id} className="p-5">
              <div className="flex items-center justify-between">
                <Badge color="#34d399">{l.kind}</Badge>
                <span className="text-[11px] text-muted">{l.mood}</span>
              </div>
              <div className="font-display mt-2 text-lg font-semibold">{l.name}</div>
              <EditableRow text={l.description} onSave={(t) => edit("locations", l.id, l.name, t)} />
            </Card>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <SectionTitle eyebrow="Who wants what" title="Factions" />
          <div className="space-y-3">
            {f.world.factions.map((x) => (
              <div key={x.id} className="rounded-xl bg-white/[0.03] p-3">
                <div className="font-medium">{x.name}</div>
                <div className="text-xs text-amber-300/80">{x.ideology}</div>
                <EditableRow text={x.description} onSave={(t) => edit("factions", x.id, x.name, t)} />
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6">
          <SectionTitle eyebrow="History" title="Timeline" />
          <ol className="relative ml-2 border-l border-line">
            {f.world.timeline.map((t) => (
              <li key={t.id} className="mb-5 ml-5">
                <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <div className="text-xs font-semibold uppercase tracking-wider text-emerald-300">{t.when}</div>
                <div className="text-sm">{t.event}</div>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <div className="mt-6">
        <SectionTitle eyebrow="Mercator's desk" title="Lore & reference" />
        <GeneratePanel {...props} studio="world" />
        <div className="mt-4">
          <AssetGrid assets={f.assets.filter((a) => a.studio === "world")} franchise={f} update={update} />
        </div>
      </div>
    </div>
  );
}

function EditableRow({ title, text, onSave }: { title?: string; text: string; onSave: (t: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(text);
  return (
    <div className="group mt-1">
      {title && <div className="text-sm font-medium">{title}</div>}
      {editing ? (
        <div className="mt-1 flex gap-2">
          <textarea rows={2} value={v} onChange={(e) => setV(e.target.value)} className={inputCls} />
          <Button
            size="sm"
            onClick={() => {
              onSave(v);
              setEditing(false);
            }}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-start gap-2 text-sm text-muted">
          <span className="flex-1">{text}</span>
          <button onClick={() => (setV(text), setEditing(true))} className="opacity-0 transition hover:text-white group-hover:opacity-100" title="Edit canon">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

const KIND_COLOR: Record<string, string> = { "Home base": "#fbbf24", Gateway: "#60a5fa", "Danger zone": "#f87171", Wonder: "#a78bfa" };

/** Stylised illustrated map: places laid out deterministically per franchise. */
function WorldMap({ f }: { f: Franchise }) {
  const r = seeded(`map:${f.id}`);
  const W = 640;
  const H = 360;
  const pts = f.world.locations.map((l, i) => {
    const a = (i / Math.max(1, f.world.locations.length)) * Math.PI * 2 + r.next() * 0.6;
    const rad = i === 0 ? 0 : 110 + r.next() * 50;
    return { l, x: W / 2 + Math.cos(a) * rad * 1.5, y: H / 2 + Math.sin(a) * rad * 0.8 };
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full min-h-[320px] w-full" style={{ background: "radial-gradient(80% 80% at 50% 50%, #0f2a22 0%, #07070c 100%)" }}>
      {Array.from({ length: 70 }).map((_, i) => (
        <circle key={i} cx={r.next() * W} cy={r.next() * H} r={r.next() * 1.4} fill="white" opacity={0.25} />
      ))}
      {[0.9, 0.65, 0.4].map((s, i) => (
        <ellipse key={i} cx={W / 2} cy={H / 2} rx={(W / 2) * s} ry={(H / 2) * s} fill="none" stroke="rgba(52,211,153,0.12)" strokeDasharray="4 6" />
      ))}
      {pts.slice(1).map((p, i) => (
        <path key={i} d={`M${pts[0].x},${pts[0].y} Q${(pts[0].x + p.x) / 2},${(pts[0].y + p.y) / 2 - 40} ${p.x},${p.y}`} fill="none" stroke="rgba(255,255,255,0.15)" strokeDasharray="2 5" />
      ))}
      {pts.map(({ l, x, y }) => {
        const c = KIND_COLOR[l.kind] ?? "#34d399";
        return (
          <g key={l.id}>
            <circle cx={x} cy={y} r={18} fill={c} opacity={0.15} />
            <circle cx={x} cy={y} r={6} fill={c} />
            <text x={x} y={y + 30} textAnchor="middle" fontSize="13" fill="white" fontWeight={600}>
              {l.name}
            </text>
            <text x={x} y={y + 45} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.5)">
              {l.kind}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
