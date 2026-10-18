"use client";

import { useState } from "react";
import { Check, Crown, Play, WandSparkles } from "lucide-react";
import type { AgentKey, PlanTask, StudioKey } from "@/lib/types";
import { AGENTS, STUDIO_BY_KEY } from "@/lib/studios";
import { addSocialPosts, addStudioAssets, applyPlan, briefOf, log, markTask } from "@/lib/franchise";
import { ai } from "@/lib/ai/client";
import { AgentAvatar, Badge, Button, Card, Empty, inputCls, SectionTitle, SourceTag } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { StudioIcon } from "@/components/StudioIcon";
import type { WorkspaceProps } from "./types";

const TSTATUS: Record<PlanTask["status"], { label: string; color: string }> = {
  queued: { label: "Queued", color: "#9b9bb4" },
  awaiting_approval: { label: "Awaiting you", color: "#fbbf24" },
  done: { label: "Done", color: "#34d399" },
};

export function Director({ franchise: f, update }: WorkspaceProps) {
  const [objective, setObjective] = useState("");
  const [planning, setPlanning] = useState(false);
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [source, setSource] = useState<"claude" | "mock">();
  const toast = useToast();

  const makePlan = async () => {
    setPlanning(true);
    try {
      const res = await ai.director({ ...briefOf(f), objective });
      setSource(res.source);
      await update((d) => applyPlan(d, res.data));
      toast({ title: "Atlas drafted a new plan", body: res.data.objective });
    } finally {
      setPlanning(false);
    }
  };

  const runTask = async (t: PlanTask) => {
    setRunning((s) => new Set(s).add(t.id));
    try {
      if (t.studio === "social") {
        const res = await ai.social(briefOf(f));
        await update((d) => {
          const posts = addSocialPosts(d, res.data);
          markTask(d, t.id, "awaiting_approval", posts[0]?.id);
        });
      } else if (t.studio === "vault") {
        await update((d) => {
          markTask(d, t.id, "done");
          log(d, "vault", `${t.title}: tracked in the protection register.`);
        });
      } else {
        const res = await ai.studio({ ...briefOf(f), studio: STUDIO_BY_KEY[t.studio].name, kind: t.deliverable, direction: t.title });
        await update((d) => addStudioAssets(d, t.studio, res.data, t.id));
      }
      toast({ title: `${AGENTS[t.studio].name} finished "${t.title}"`, body: t.studio === "vault" ? undefined : "Waiting in your approvals queue." });
    } finally {
      setRunning((s) => {
        const n = new Set(s);
        n.delete(t.id);
        return n;
      });
    }
  };

  const tasks = f.plan?.phases.flatMap((p) => p.tasks) ?? [];
  const load = tasks.reduce<Partial<Record<StudioKey, number>>>((m, t) => (t.status !== "done" ? { ...m, [t.studio]: (m[t.studio] ?? 0) + 1 } : m), {});

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="flex items-center gap-4">
          <AgentAvatar agent="director" size={56} />
          <div>
            <h1 className="font-display text-3xl font-bold">Studio Director</h1>
            <div className="text-sm text-muted">Atlas plans the slate, routes work to departments and guards canon. You approve.</div>
          </div>
        </div>
        <SourceTag source={source} />
      </div>

      <Card className="p-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">Objective</div>
        <div className="mt-2 flex gap-2">
          <input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder={f.plan?.objective ?? `Take ${f.name} from canon v1 to a proven audience in 90 days`} className={inputCls} />
          <Button onClick={makePlan} loading={planning} className="shrink-0">
            <WandSparkles className="h-4 w-4" /> {f.plan ? "Re-plan" : "Draft plan"}
          </Button>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          {!f.plan && <Empty title="No plan yet" body="Give Atlas an objective. The plan breaks it into phases and assigns each task to a department agent." />}
          {f.plan?.phases.map((ph, pi) => {
            const done = ph.tasks.filter((t) => t.status === "done").length;
            return (
              <Card key={pi} className="p-5">
                <SectionTitle
                  eyebrow={`Phase ${pi + 1} · ${done}/${ph.tasks.length} done`}
                  title={ph.name}
                  action={
                    ph.tasks.some((t) => t.status === "queued") && (
                      <Button size="sm" variant="secondary" onClick={() => ph.tasks.filter((t) => t.status === "queued").forEach(runTask)}>
                        <Play className="h-3.5 w-3.5" /> Run phase
                      </Button>
                    )
                  }
                />
                <div className="space-y-2">
                  {ph.tasks.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.02] p-3">
                      <AgentAvatar agent={t.studio} size={30} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{t.title}</div>
                        <div className="text-[11px] text-muted">
                          {AGENTS[t.studio].name} · {STUDIO_BY_KEY[t.studio].name} · deliverable: {t.deliverable}
                        </div>
                      </div>
                      <Badge color={TSTATUS[t.status].color}>{TSTATUS[t.status].label}</Badge>
                      {t.status === "queued" ? (
                        <Button size="sm" onClick={() => runTask(t)} loading={running.has(t.id)}>
                          <Play className="h-3.5 w-3.5" /> Run
                        </Button>
                      ) : t.status === "done" ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : null}
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="h-fit p-5">
          <div className="mb-3 flex items-center gap-2 font-semibold">
            <Crown className="h-4 w-4 text-amber-300" /> Department agents
          </div>
          <div className="space-y-2">
            {(Object.keys(AGENTS) as AgentKey[])
              .filter((k): k is StudioKey => k !== "director")
              .map((k) => (
                <div key={k} className="flex items-center gap-3 rounded-lg p-1.5">
                  <AgentAvatar agent={k} size={26} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">{AGENTS[k].name}</div>
                    <div className="flex items-center gap-1 text-[11px] text-muted">
                      <StudioIcon studio={k} className="h-3 w-3" /> {AGENTS[k].title}
                    </div>
                  </div>
                  <span className="text-[11px] tabular-nums text-muted">{load[k] ? `${load[k]} open` : "idle"}</span>
                </div>
              ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
