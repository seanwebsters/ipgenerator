"use client";

import { useState } from "react";
import { Plus, Search, ShieldCheck } from "lucide-react";
import type { VaultKind, VaultRecord, VaultStatus } from "@/lib/types";
import { canonHash, clearanceCheck, log } from "@/lib/franchise";
import { Badge, Button, Card, inputCls, SectionTitle } from "@/components/ui";
import { cx, nowIso, uid } from "@/lib/util";
import { StudioHeader } from "./shared";
import type { WorkspaceProps } from "./types";

const STATUSES: VaultStatus[] = ["idea", "cleared", "filed", "registered", "flagged"];
const SCOLOR: Record<VaultStatus, string> = { idea: "#9b9bb4", cleared: "#60a5fa", filed: "#fbbf24", registered: "#34d399", flagged: "#f87171" };
const KINDS: VaultKind[] = ["trademark", "copyright", "design", "domain", "chain-of-title"];

export function Vault({ franchise: f, update }: WorkspaceProps) {
  const [query, setQuery] = useState(f.characters[0]?.name ?? f.name);
  const [checked, setChecked] = useState<ReturnType<typeof clearanceCheck> & { name: string }>();
  const [kind, setKind] = useState<VaultKind>("trademark");
  const [title, setTitle] = useState("");
  const live = canonHash(f);
  const ledgerOk = f.canon.history[0]?.hash === live;

  const setStatus = (id: string, status: VaultStatus) =>
    update((d) => {
      const r = d.vault.find((x) => x.id === id);
      if (!r) return;
      r.status = status;
      r.updatedAt = nowIso();
      log(d, "vault", `${r.title} (${r.kind}) -> ${status}.`);
    });

  const add = () => {
    if (!title.trim()) return;
    const rec: VaultRecord = { id: uid("vault"), kind, title: title.trim(), jurisdiction: kind === "domain" ? "Global" : "US", classes: "-", status: "idea", notes: "Added manually.", updatedAt: nowIso() };
    update((d) => {
      d.vault.unshift(rec);
      log(d, "vault", `New ${kind} record: ${rec.title}.`);
    });
    setTitle("");
  };

  const counts = STATUSES.map((s) => [s, f.vault.filter((v) => v.status === s).length] as const);

  return (
    <div>
      <StudioHeader studio="vault" subtitle={`${f.vault.length} rights records · canon v${f.canon.version}`} />
      <div className="mb-6 rounded-xl border border-line bg-white/[0.02] px-4 py-2 text-xs text-muted">
        Filings, searches and registrations here are simulated trackers for planning. They are not legal advice and nothing is filed with any office.
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {counts.map(([s, n]) => (
          <Card key={s} className="p-4">
            <div className="text-2xl font-semibold tabular-nums" style={{ color: SCOLOR[s] }}>{n}</div>
            <div className="text-[11px] uppercase tracking-wider text-muted">{s}</div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <div className="font-semibold">Protection register</div>
          <div className="flex gap-2">
            <select value={kind} onChange={(e) => setKind(e.target.value as VaultKind)} className={cx(inputCls, "w-40")}>
              {KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mark, work or domain" className={cx(inputCls, "w-56")} />
            <Button variant="secondary" onClick={add}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Right</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Jurisdiction</th>
                <th className="px-4 py-2 font-medium">Classes</th>
                <th className="px-4 py-2 font-medium">Notes</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {f.vault.map((v) => (
                <tr key={v.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium">{v.title}</td>
                  <td className="px-4 py-3 text-muted">{v.kind}</td>
                  <td className="px-4 py-3 text-muted">{v.jurisdiction}</td>
                  <td className="px-4 py-3 text-muted">{v.classes}</td>
                  <td className="max-w-xs px-4 py-3 text-xs text-muted">{v.notes}</td>
                  <td className="px-4 py-3">
                    <select value={v.status} onChange={(e) => setStatus(v.id, e.target.value as VaultStatus)} className="rounded-full border bg-transparent px-2 py-0.5 text-xs" style={{ borderColor: `${SCOLOR[v.status]}66`, color: SCOLOR[v.status] }}>
                      {STATUSES.map((s) => (
                        <option key={s} value={s} className="bg-panel text-white">
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <SectionTitle eyebrow="Before you fall in love with a name" title="Name clearance" />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setChecked({ ...clearanceCheck(query), name: query });
            }}
            className="flex gap-2"
          >
            <input value={query} onChange={(e) => setQuery(e.target.value)} className={inputCls} />
            <Button type="submit" variant="secondary">
              <Search className="h-4 w-4" /> Check
            </Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[f.name, ...f.characters.map((c) => c.name), ...f.world.locations.map((l) => l.name)].slice(0, 9).map((n) => (
              <button key={n} onClick={() => (setQuery(n), setChecked({ ...clearanceCheck(n), name: n }))} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted hover:text-white">
                {n}
              </button>
            ))}
          </div>
          {checked && (
            <div className="mt-4 rounded-xl bg-white/[0.03] p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">{checked.name}</div>
                <Badge color={checked.level === "low" ? "#34d399" : checked.level === "medium" ? "#fbbf24" : "#f87171"}>
                  {checked.level} risk · {checked.risk}
                </Badge>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/5">
                <div className="h-full rounded-full" style={{ width: `${checked.risk}%`, background: checked.level === "low" ? "#34d399" : checked.level === "medium" ? "#fbbf24" : "#f87171" }} />
              </div>
              <div className="mt-2 text-sm text-muted">{checked.notes}</div>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <SectionTitle eyebrow="Proof of authorship" title="Canon ledger" action={<Badge color={ledgerOk ? "#34d399" : "#fbbf24"}>{ledgerOk ? "Head verified" : "Uncommitted changes"}</Badge>} />
          <div className="space-y-2">
            {f.canon.history.map((h, i) => (
              <div key={h.version} className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3">
                <ShieldCheck className={cx("h-4 w-4 shrink-0", i === 0 ? "text-emerald-400" : "text-muted")} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm">
                    v{h.version} · {h.summary}
                  </div>
                  <div className="text-[11px] text-muted">
                    {new Date(h.createdAt).toLocaleDateString()} · {h.author}
                  </div>
                </div>
                <code className="rounded bg-black/40 px-2 py-0.5 font-mono text-[11px] text-emerald-300">{h.hash.slice(0, 12)}</code>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[11px] text-muted">Each version hashes the full canon (core, cast and world). Current head: <code className="font-mono">{live.slice(0, 12)}</code></div>
        </Card>
      </div>
    </div>
  );
}
