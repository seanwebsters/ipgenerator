"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChartLine, Crown, FileDown, GitCommitVertical, Inbox, LayoutGrid, Dna } from "lucide-react";
import { useFranchise } from "@/lib/store";
import { STUDIOS, STUDIO_BY_KEY } from "@/lib/studios";
import type { StudioKey } from "@/lib/types";
import { cx } from "@/lib/util";
import { StudioIcon } from "@/components/StudioIcon";
import { Overview } from "@/components/workspace/Overview";
import { IPLab } from "@/components/workspace/IPLab";
import { CharacterStudio } from "@/components/workspace/CharacterStudio";
import { WorldBuilder } from "@/components/workspace/WorldBuilder";
import { SocialStudio } from "@/components/workspace/SocialStudio";
import { Vault } from "@/components/workspace/Vault";
import { LightStudio } from "@/components/workspace/LightStudio";
import { Director } from "@/components/workspace/Director";
import { Approvals } from "@/components/workspace/Approvals";
import { Canon } from "@/components/workspace/Canon";
import { Genome } from "@/components/workspace/Genome";
import { Simulator } from "@/components/workspace/Simulator";
import { Bible } from "@/components/workspace/Bible";
import type { WorkspaceProps } from "@/components/workspace/types";

const TOOLS = [
  { key: "director", label: "Studio Director", icon: Crown },
  { key: "approvals", label: "Approvals", icon: Inbox },
  { key: "canon", label: "Canon history", icon: GitCommitVertical },
  { key: "genome", label: "IP Genome", icon: Dna },
  { key: "simulator", label: "Franchise Simulator", icon: ChartLine },
  { key: "bible", label: "IP Bible export", icon: FileDown },
] as const;

export default function WorkspacePage() {
  const params = useParams<{ id: string; section?: string[] }>();
  const section = params.section?.[0] ?? "overview";
  const { franchise, update } = useFranchise(params.id);

  if (franchise === undefined) return <div className="p-10 text-muted">Loading franchise...</div>;
  if (franchise === null)
    return (
      <div className="p-10">
        Franchise not found. <Link href="/studio" className="text-amber-300 underline">Back to portfolio</Link>
      </div>
    );

  const props: WorkspaceProps = { franchise, update, base: `/studio/f/${franchise.id}` };
  const pending = franchise.approvals.filter((a) => a.status === "pending").length;
  const counts = franchise.assets.reduce<Record<string, number>>((m, a) => ((m[a.studio] = (m[a.studio] ?? 0) + 1), m), {});
  const flagged = new Set(franchise.assets.filter((a) => a.status === "needs_review").map((a) => a.studio));

  let body: React.ReactNode;
  switch (section) {
    case "overview": body = <Overview {...props} />; break;
    case "ip-lab": body = <IPLab {...props} />; break;
    case "characters": body = <CharacterStudio {...props} />; break;
    case "world": body = <WorldBuilder {...props} />; break;
    case "social": body = <SocialStudio {...props} />; break;
    case "vault": body = <Vault {...props} />; break;
    case "director": body = <Director {...props} />; break;
    case "approvals": body = <Approvals {...props} />; break;
    case "canon": body = <Canon {...props} />; break;
    case "genome": body = <Genome {...props} />; break;
    case "simulator": body = <Simulator {...props} />; break;
    case "bible": body = <Bible {...props} />; break;
    default:
      body = section in STUDIO_BY_KEY ? <LightStudio {...props} studio={section as StudioKey} /> : <Overview {...props} />;
  }

  const link = (key: string) => `${props.base}${key === "overview" ? "" : `/${key}`}`;

  return (
    <div className="flex">
      <aside className="no-print sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r border-line bg-panel/40 px-3 py-5 scrollbar-thin lg:block">
        <Link href={props.base} className="mb-4 block rounded-xl px-3 py-2 hover:bg-white/5">
          <div className="font-display text-lg font-bold leading-tight">{franchise.name}</div>
          <div className="text-[11px] text-muted">Canon v{franchise.canon.version} · {franchise.stage}</div>
        </Link>
        <NavItem href={link("overview")} active={section === "overview"} icon={<LayoutGrid className="h-4 w-4" />} label="Overview" />
        <div className="mb-1 mt-4 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Studios</div>
        {STUDIOS.map((s) => (
          <NavItem
            key={s.key}
            href={link(s.key)}
            active={section === s.key}
            icon={<StudioIcon studio={s.key} className="h-4 w-4" />}
            color={s.accent}
            label={s.name}
            count={counts[s.key]}
            alert={flagged.has(s.key)}
          />
        ))}
        <div className="mb-1 mt-4 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Studio tools</div>
        {TOOLS.map((t) => (
          <NavItem key={t.key} href={link(t.key)} active={section === t.key} icon={<t.icon className="h-4 w-4" />} label={t.label} count={t.key === "approvals" ? pending : undefined} />
        ))}
      </aside>
      <main className="min-w-0 flex-1 px-6 py-8 lg:px-10">{body}</main>
    </div>
  );
}

function NavItem({ href, active, icon, label, count, color, alert }: { href: string; active: boolean; icon: React.ReactNode; label: string; count?: number; color?: string; alert?: boolean }) {
  return (
    <Link href={href} className={cx("flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm", active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white")}>
      <span style={color ? { color } : undefined}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {alert && <span className="h-1.5 w-1.5 rounded-full bg-rose-400" title="Needs review" />}
      {!!count && <span className="text-[11px] tabular-nums text-muted">{count}</span>}
    </Link>
  );
}
