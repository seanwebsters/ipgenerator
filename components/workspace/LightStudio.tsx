"use client";

import { useState } from "react";
import { WandSparkles } from "lucide-react";
import type { StudioKey } from "@/lib/types";
import { STUDIO_BY_KEY } from "@/lib/studios";
import { addStudioAssets, briefOf } from "@/lib/franchise";
import { ai } from "@/lib/ai/client";
import { Button, Card, Empty, inputCls, SourceTag } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { cx } from "@/lib/util";
import { AssetGrid, StudioHeader } from "./shared";
import type { WorkspaceProps } from "./types";

/** Generate-and-approve panel used by every studio that produces assets. */
export function GeneratePanel({ franchise, update, studio, taskId }: WorkspaceProps & { studio: StudioKey; taskId?: string }) {
  const s = STUDIO_BY_KEY[studio];
  const [kind, setKind] = useState(s.kinds[0]);
  const [direction, setDirection] = useState("");
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<"claude" | "mock">();
  const toast = useToast();

  const run = async () => {
    setBusy(true);
    try {
      const res = await ai.studio({ ...briefOf(franchise), studio: s.name, kind, direction });
      setSource(res.source);
      await update((f) => addStudioAssets(f, studio, res.data, taskId));
      toast({ title: `${s.name} delivered a ${kind}`, body: "It's in your approvals queue." });
      setDirection("");
    } catch (e) {
      toast({ title: "Generation failed", body: e instanceof Error ? e.message : String(e), tone: "warn" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        {s.kinds.map((k) => (
          <button key={k} onClick={() => setKind(k)} className={cx("rounded-full border px-3 py-1 text-xs capitalize", k === kind ? "text-ink" : "border-line text-muted hover:text-white")} style={k === kind ? { background: s.accent, borderColor: s.accent } : undefined}>
            {k}
          </button>
        ))}
        <span className="ml-auto">
          <SourceTag source={source} />
        </span>
      </div>
      <div className="mt-3 flex gap-2">
        <input value={direction} onChange={(e) => setDirection(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} placeholder={`Direction for the ${kind} (optional)`} className={inputCls} />
        <Button onClick={run} loading={busy} className="shrink-0">
          <WandSparkles className="h-4 w-4" /> Generate
        </Button>
      </div>
    </Card>
  );
}

export function LightStudio(props: WorkspaceProps & { studio: StudioKey }) {
  const { franchise, update, studio } = props;
  const assets = franchise.assets.filter((a) => a.studio === studio);
  return (
    <div>
      <StudioHeader studio={studio} />
      <GeneratePanel {...props} />
      <div className="mt-6">
        {assets.length ? (
          <AssetGrid assets={assets} franchise={franchise} update={update} />
        ) : (
          <Empty title="Nothing here yet" body={`${STUDIO_BY_KEY[studio].blurb} Pick a deliverable above and generate the first one from canon.`} />
        )}
      </div>
    </div>
  );
}
