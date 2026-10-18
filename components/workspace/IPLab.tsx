"use client";

import { useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import type { FormatStatus, FranchiseCore } from "@/lib/types";
import { commitEntityChange } from "@/lib/franchise";
import { Badge, Button, Card, Field, inputCls, ScoreBar, SectionTitle } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { GeneratePanel } from "./LightStudio";
import { AssetGrid, StudioHeader } from "./shared";
import type { WorkspaceProps } from "./types";

const NEXT_STATUS: Record<FormatStatus, FormatStatus> = { exploring: "planned", planned: "core", core: "exploring" };
const STATUS_COLOR: Record<FormatStatus, string> = { core: "#fbbf24", planned: "#34d399", exploring: "#9b9bb4" };

export function IPLab(props: WorkspaceProps) {
  const { franchise: f, update } = props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<FranchiseCore>(f.core);
  const [newFormat, setNewFormat] = useState("");
  const toast = useToast();

  const saveCore = async () => {
    const changed = (Object.keys(draft) as (keyof FranchiseCore)[]).filter((k) => JSON.stringify(draft[k]) !== JSON.stringify(f.core[k]));
    if (!changed.length) return setEditing(false);
    const flagged = await update((d) => {
      d.core = draft;
      return commitEntityChange(d, "core", "Franchise core", changed.map((k) => `${k} updated`));
    });
    setEditing(false);
    toast({ title: `Canon v${f.canon.version + 1} committed`, body: flagged ? `${flagged} assets flagged for review.` : "Franchise core updated." });
  };

  const setFormats = (formats: FranchiseCore["formats"], note: string) =>
    update((d) => {
      d.core.formats = formats;
      commitEntityChange(d, "core", "Format roadmap", [note]);
    });

  const s = f.concept.scores;
  const list = (k: "themes" | "pillars" | "comparables") => (
    <textarea rows={4} value={draft[k].join("\n")} onChange={(e) => setDraft({ ...draft, [k]: e.target.value.split("\n") })} className={inputCls} />
  );

  return (
    <div>
      <StudioHeader studio="ip-lab">
        {editing ? (
          <>
            <Button variant="ghost" onClick={() => (setDraft(f.core), setEditing(false))}>
              Cancel
            </Button>
            <Button onClick={saveCore}>Commit to canon</Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => (setDraft(f.core), setEditing(true))}>
            <Pencil className="h-4 w-4" /> Edit core
          </Button>
        )}
      </StudioHeader>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="p-6 xl:col-span-2">
          <SectionTitle eyebrow="Franchise thesis" title="Core" />
          {editing ? (
            <div className="space-y-4">
              <Field label="Logline">
                <textarea rows={2} value={draft.logline} onChange={(e) => setDraft({ ...draft, logline: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Premise">
                <textarea rows={5} value={draft.premise} onChange={(e) => setDraft({ ...draft, premise: e.target.value })} className={inputCls} />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Audience">
                  <input value={draft.audience} onChange={(e) => setDraft({ ...draft, audience: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Tone">
                  <input value={draft.tone} onChange={(e) => setDraft({ ...draft, tone: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Themes (one per line)">{list("themes")}</Field>
                <Field label="Pillars (one per line)">{list("pillars")}</Field>
              </div>
              <Field label="Comparables (one per line)">{list("comparables")}</Field>
            </div>
          ) : (
            <>
              <p className="font-display text-xl leading-snug">{f.core.logline}</p>
              <p className="mt-4 text-white/75">{f.core.premise}</p>
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted">Themes</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {f.core.themes.map((t) => (
                      <Badge key={t} color="#a78bfa">{t}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted">Audience & tone</div>
                  <div className="mt-2 text-sm">{f.core.audience}</div>
                  <div className="text-sm text-muted">{f.core.tone}</div>
                </div>
                <div className="md:col-span-2">
                  <div className="text-xs uppercase tracking-wider text-muted">Pillars</div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {f.core.pillars.map((p, i) => (
                      <div key={p} className="flex gap-3 rounded-xl bg-white/[0.03] p-3 text-sm">
                        <span className="font-display text-lg font-bold text-amber-300">{i + 1}</span> {p}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-2 text-sm text-muted">Comparables: {f.core.comparables.join(" · ")}</div>
              </div>
            </>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle eyebrow="Discovery" title="Concept scorecard" />
            <div className="space-y-3">
              <ScoreBar label="Originality" value={s.originality} color="#a78bfa" />
              <ScoreBar label="Marketability" value={s.marketability} color="#fbbf24" />
              <ScoreBar label="Expandability" value={s.expandability} color="#34d399" />
              <ScoreBar label="Merchability" value={s.merchability} color="#f472b6" />
            </div>
            <div className="mt-4 text-xs text-muted">Original prompt: &ldquo;{f.prompt}&rdquo;</div>
          </Card>
          {f.alternates.length > 0 && (
            <Card className="p-5">
              <SectionTitle eyebrow="Kept from Discovery" title="Alternate directions" />
              <div className="space-y-3">
                {f.alternates.map((c) => (
                  <div key={c.id} className="rounded-xl bg-white/[0.03] p-3">
                    <div className="text-sm font-medium">{c.title}</div>
                    <div className="text-[11px] text-amber-300/80">{c.genre}</div>
                    <div className="mt-1 text-xs text-muted">{c.logline}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      <Card className="mt-6 p-6">
        <SectionTitle eyebrow="Where the IP lives" title="Format roadmap" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {f.core.formats.map((fm, i) => (
            <div key={fm.name + i} className="group flex items-start gap-3 rounded-xl border border-line p-4">
              <div className="flex-1">
                <div className="font-medium">{fm.name}</div>
                <div className="text-xs text-muted">{fm.note}</div>
              </div>
              <button
                title="Click to change status"
                onClick={() => setFormats(f.core.formats.map((x, j) => (j === i ? { ...x, status: NEXT_STATUS[x.status] } : x)), `${fm.name} -> ${NEXT_STATUS[fm.status]}`)}
              >
                <Badge color={STATUS_COLOR[fm.status]}>{fm.status}</Badge>
              </button>
              <button onClick={() => setFormats(f.core.formats.filter((_, j) => j !== i), `removed ${fm.name}`)} className="text-muted opacity-0 hover:text-white group-hover:opacity-100">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newFormat.trim()) return;
              setFormats([...f.core.formats, { name: newFormat.trim(), status: "exploring", note: "Added in the IP Lab." }], `added ${newFormat.trim()}`);
              setNewFormat("");
            }}
            className="flex items-center gap-2 rounded-xl border border-dashed border-line p-3"
          >
            <input value={newFormat} onChange={(e) => setNewFormat(e.target.value)} placeholder="Add a format, e.g. Stage musical" className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/30" />
            <Button size="sm" variant="secondary" type="submit">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </form>
        </div>
      </Card>

      <div className="mt-6">
        <SectionTitle eyebrow="Nova's desk" title="Strategy documents" />
        <GeneratePanel {...props} studio="ip-lab" />
        <div className="mt-4">
          <AssetGrid assets={f.assets.filter((a) => a.studio === "ip-lab")} franchise={f} update={update} />
        </div>
      </div>
    </div>
  );
}
