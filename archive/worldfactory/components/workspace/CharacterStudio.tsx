"use client";

import { useEffect, useState } from "react";
import { GitBranch, Pencil, Plus, TriangleAlert, UserPlus } from "lucide-react";
import type { Character, Franchise } from "@/lib/types";
import { addCharacter, briefOf, updateCharacter } from "@/lib/franchise";
import { ai } from "@/lib/ai/client";
import { Badge, Button, Card, Field, inputCls, SectionTitle, StatusPill } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { cx } from "@/lib/util";
import { GeneratePanel } from "./LightStudio";
import { AssetGrid, StudioHeader } from "./shared";
import type { WorkspaceProps } from "./types";

export function CharacterStudio(props: WorkspaceProps) {
  const { franchise: f, update } = props;
  const [selected, setSelected] = useState(f.characters[0]?.id);
  const [idea, setIdea] = useState("");
  const [adding, setAdding] = useState(false);
  const toast = useToast();
  const ch = f.characters.find((c) => c.id === selected) ?? f.characters[0];

  const add = async () => {
    setAdding(true);
    try {
      const res = await ai.character({ ...briefOf(f), idea });
      const created = await update((d) => addCharacter(d, res.data));
      if (created) setSelected(created.id);
      setIdea("");
      toast({ title: `${res.data.name} joined the cast`, body: res.source === "claude" ? "Written by Claude." : "Mock generator." });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div>
      <StudioHeader studio="characters" subtitle={`${f.characters.length} characters in canon v${f.canon.version}`}>
        <input value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="New character idea..." className={cx(inputCls, "w-64")} />
        <Button onClick={add} loading={adding}>
          <UserPlus className="h-4 w-4" /> Add character
        </Button>
      </StudioHeader>

      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          {f.characters.map((c) => {
            const uses = f.assets.filter((a) => a.dependsOn.includes(c.id)).length;
            return (
              <button key={c.id} onClick={() => setSelected(c.id)} className={cx("flex w-full items-center gap-3 rounded-xl border p-3 text-left transition", c.id === ch?.id ? "border-white/25 bg-white/[0.06]" : "border-line hover:border-white/15")}>
                <span className="h-10 w-10 shrink-0 rounded-full" style={{ background: `radial-gradient(circle at 30% 30%, ${c.color}, ${c.color}44)` }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{c.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {c.role} · rev {c.revision} · used in {uses}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {ch && <CharacterDetail key={ch.id + ch.revision} c={ch} f={f} update={update} />}
      </div>

      <Card className="mt-6 p-6">
        <SectionTitle eyebrow="Who matters to whom" title="Relationship web" />
        <RelationshipWeb f={f} selected={ch?.id} onSelect={setSelected} />
      </Card>

      <div className="mt-6">
        <SectionTitle eyebrow="Juno's desk" title="Character deliverables" />
        <GeneratePanel {...props} studio="characters" />
        <div className="mt-4">
          <AssetGrid assets={f.assets.filter((a) => a.studio === "characters")} franchise={f} update={update} />
        </div>
      </div>
    </div>
  );
}

const FIELDS: { k: keyof Character; label: string; long?: boolean }[] = [
  { k: "name", label: "Name" },
  { k: "role", label: "Role" },
  { k: "archetype", label: "Archetype" },
  { k: "voice", label: "Voice" },
  { k: "description", label: "Description", long: true },
  { k: "motivation", label: "Motivation", long: true },
  { k: "flaw", label: "Flaw", long: true },
  { k: "visualNotes", label: "Visual notes", long: true },
];

function CharacterDetail({ c, f, update }: { c: Character; f: Franchise; update: WorkspaceProps["update"] }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c);
  const toast = useToast();
  useEffect(() => setDraft(c), [c]);

  const downstream = f.assets.filter((a) => a.dependsOn.includes(c.id));
  const willFlag = downstream.filter((a) => a.status !== "draft").length;
  const dirty = FIELDS.some(({ k }) => draft[k] !== c[k]) || draft.color !== c.color;

  const save = async () => {
    const flagged = await update((d) => updateCharacter(d, draft));
    setEditing(false);
    toast({
      title: `Canon v${f.canon.version + 1}: ${draft.name} updated`,
      body: flagged ? `${flagged} downstream asset${flagged === 1 ? "" : "s"} flagged for review.` : "No downstream assets affected.",
      tone: flagged ? "warn" : "default",
    });
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-5 p-6" style={{ background: `linear-gradient(120deg, ${c.color}30, transparent 60%)` }}>
        <span className="h-20 w-20 shrink-0 rounded-3xl" style={{ background: `radial-gradient(circle at 30% 30%, ${c.color}, ${c.color}33)`, boxShadow: `0 0 50px -10px ${c.color}` }} />
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wider text-muted">
            {c.role} · {c.archetype}
          </div>
          <div className="font-display text-3xl font-bold">{c.name}</div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted">
            <GitBranch className="h-3.5 w-3.5" /> Revision {c.revision} · {downstream.length} assets depend on {c.name}
          </div>
        </div>
        {!editing && (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        )}
      </div>

      <div className="p-6">
        {editing ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {FIELDS.map(({ k, label, long }) => (
                <div key={k} className={long ? "md:col-span-2" : undefined}>
                  <Field label={label}>
                    {long ? (
                      <textarea rows={2} value={String(draft[k])} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} className={inputCls} />
                    ) : (
                      <input value={String(draft[k])} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} className={inputCls} />
                    )}
                  </Field>
                </div>
              ))}
              <Field label="Signature colour">
                <input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} className="h-10 w-20 rounded-lg border border-line bg-transparent" />
              </Field>
            </div>
            {dirty && willFlag > 0 && (
              <div className="flex gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
                <TriangleAlert className="h-4 w-4 shrink-0" />
                Committing creates canon v{f.canon.version + 1} and flags {willFlag} downstream asset{willFlag === 1 ? "" : "s"} for review by their departments.
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => (setDraft(c), setEditing(false))}>
                Cancel
              </Button>
              <Button onClick={save} disabled={!dirty}>
                Commit to canon
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            <p className="md:col-span-2 text-white/85">{c.description}</p>
            {[
              ["Wants", c.motivation],
              ["Flaw", c.flaw],
              ["Look", c.visualNotes],
              ["Voice", c.voice],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="text-xs uppercase tracking-wider text-muted">{k}</div>
                <div className="mt-1 text-sm">{v}</div>
              </div>
            ))}
            <div className="md:col-span-2">
              <div className="text-xs uppercase tracking-wider text-muted">Relationships</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {c.relationships.map((r) => {
                  const o = f.characters.find((x) => x.id === r.characterId);
                  return o ? (
                    <Badge key={r.characterId} color={o.color}>
                      {r.kind} {o.name}
                    </Badge>
                  ) : null;
                })}
                {!c.relationships.length && <span className="text-sm text-muted">None yet.</span>}
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 border-t border-line pt-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Used downstream</div>
          <div className="grid gap-2 md:grid-cols-2">
            {downstream.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
                <span className="truncate">{a.title}</span>
                <StatusPill status={a.status} />
              </div>
            ))}
            {!downstream.length && (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Plus className="h-4 w-4" /> Not used by any asset yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function RelationshipWeb({ f, selected, onSelect }: { f: Franchise; selected?: string; onSelect: (id: string) => void }) {
  const W = 760;
  const H = 320;
  const n = f.characters.length;
  const pos = new Map(
    f.characters.map((c, i) => {
      const a = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2;
      return [c.id, { x: W / 2 + Math.cos(a) * 260, y: H / 2 + Math.sin(a) * 120 }];
    }),
  );
  // One edge per pair; the label reads from the selected character's side when it has one.
  const pairs = new Map<string, { from: string; to: string; kind: string }>();
  for (const c of f.characters)
    for (const r of c.relationships) {
      const key = [c.id, r.characterId].sort().join("|");
      if (!pairs.has(key) || c.id === selected) pairs.set(key, { from: c.id, to: r.characterId, kind: r.kind });
    }
  const edges = [...pairs.values()];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
      {edges.map((e, i) => {
        const a = pos.get(e.from);
        const b = pos.get(e.to);
        if (!a || !b) return null;
        const hot = e.from === selected || e.to === selected;
        return (
          <g key={i}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={hot ? "rgba(251,191,36,0.7)" : "rgba(255,255,255,0.12)"} strokeWidth={hot ? 2 : 1} />
            {hot && (
              <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 6} textAnchor="middle" fontSize="11" fill="#fde68a">
                {e.kind}
              </text>
            )}
          </g>
        );
      })}
      {f.characters.map((c) => {
        const p = pos.get(c.id)!;
        return (
          <g key={c.id} onClick={() => onSelect(c.id)} className="cursor-pointer">
            <circle cx={p.x} cy={p.y} r={c.id === selected ? 26 : 20} fill={c.color} opacity={0.9} />
            <text x={p.x} y={p.y + 42} textAnchor="middle" fontSize="13" fill="white" fontWeight={600}>
              {c.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
