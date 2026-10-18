import { db } from "@/lib/db";
import { credentialStatus } from "@/engine/credentials";
import { ffmpegAvailable } from "@/engine/media/ffmpeg";
import { DEFAULT_MODEL } from "@/engine/providers/llm";
import { saveCredential, saveRoute, saveSettings, testYouTube } from "../../actions";
import { PageHeader, Section } from "@/components/os/bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export const dynamic = "force-dynamic";

const MODES = [
  { key: "ASSISTED", title: "Assisted", text: "Approval for all publishing, spending and experiments." },
  { key: "SUPERVISED", title: "Supervised", text: "Automatic production; pre-authorised publishing to WEBSTER WORLD within the daily limit; internal experiments run automatically." },
  { key: "HIGH", title: "High autonomy", text: "Bounded portfolio experimentation under strict policies. External publishing and DEMO content still need approval; new IP, rights and strategy always do." },
];

const TASKS = [
  { task: "intel.opportunities", kind: "llm" },
  { task: "iplab.concepts", kind: "llm" },
  { task: "iplab.score", kind: "llm" },
  { task: "iplab.bible", kind: "llm" },
  { task: "writers.pilot", kind: "llm" },
  { task: "quality.critique", kind: "llm" },
  { task: "marketing.package", kind: "llm" },
  { task: "learning.propose", kind: "llm" },
  { task: "copilot.intent", kind: "llm" },
  { task: "franchise.opportunities", kind: "llm" },
  { task: "games.interactive", kind: "llm" },
  { task: "visual.frames", kind: "image" },
  { task: "visual.keyart", kind: "image" },
];

export default async function Settings() {
  const [s, creds, routes, channels, ffmpeg, states] = await Promise.all([
    db.studioSettings.findUniqueOrThrow({ where: { id: "studio" } }),
    credentialStatus(),
    db.modelRoute.findMany(),
    db.channel.findMany(),
    ffmpegAvailable(),
    db.providerState.findMany(),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Settings" title="Guardrails, budgets & integrations" intro="Founder-only. Secrets are encrypted server-side (AES-256-GCM) and never sent back to the browser." />

      <form action={saveSettings} className="space-y-6">
        <Section title="Autonomy mode">
          <div className="grid gap-3 md:grid-cols-3">
            {MODES.map((m) => (
              <label key={m.key} className="cursor-pointer">
                <input type="radio" name="autonomyMode" value={m.key} defaultChecked={s.autonomyMode === m.key} className="peer sr-only" />
                <div className="h-full rounded-xl border p-4 peer-checked:border-primary peer-checked:bg-primary/5">
                  <div className="font-display text-2xl">{m.title}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{m.text}</p>
                </div>
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Never available in any mode: unrestricted financial transactions, legal agreements, uncontrolled publishing, or publishing DEMO content externally.</p>
        </Section>
        <Section title="Budgets & limits">
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <Field label="Daily cap (USD)" name="dailyBudgetUsd" value={String(s.dailyBudgetUsd)} />
            <Field label="Monthly cap (USD)" name="monthlyBudgetUsd" value={String(s.monthlyBudgetUsd)} />
            <Field label="Per-run cap (USD)" name="perRunBudgetUsd" value={String(s.perRunBudgetUsd)} />
            <Field label="Auto-publish / day" name="autoPublishPerDay" value={String(s.autoPublishPerDay)} />
            <Field label="Concurrent jobs" name="maxConcurrentJobs" value={String(s.maxConcurrentJobs)} />
            <div className="space-y-1.5">
              <Label>External privacy</Label>
              <select name="externalPrivacy" defaultValue={s.externalPrivacy} className="h-9 w-full rounded-lg border border-input bg-black/20 px-2 text-sm">
                <option value="private">private</option>
                <option value="unlisted">unlisted</option>
                <option value="public">public</option>
              </select>
            </div>
          </div>
          <div className="mt-4 grid gap-4 rounded-lg border p-4 md:grid-cols-[1fr_200px]">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="flywheelEnabled" defaultChecked={s.flywheelEnabled} className="mt-1 accent-[var(--ember)]" />
              <span>
                <b>Autonomous flywheel.</b> The Chief Studio Agent starts a Franchise Development cycle for each idle live franchise. Every cycle ends at your strategy decision, and every production it commissions still passes QA and publication gates.
              </span>
            </label>
            <Field label="Cycle interval (minutes)" name="flywheelIntervalMin" value={String(s.flywheelIntervalMin)} />
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" name="allowDemoProvider" defaultChecked={s.allowDemoProvider} className="accent-[var(--ember)]" />
            Allow the deterministic DEMO provider when no LLM is configured (output is labelled DEMO everywhere)
          </label>
          <Button className="mt-4">Save guardrails</Button>
        </Section>
      </form>

      <Section title="Providers">
        <div className="space-y-3">
          {creds.map((c) => {
            const st = states.find((x) => x.provider === c.key);
            return (
              <div key={c.key} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  <Badge variant="outline">{c.category}</Badge>
                  <Badge variant={c.configured ? "success" : c.implemented ? "warning" : "outline"}>{c.configured ? `configured (${c.source}${c.last4 ? ` …${c.last4}` : ""})` : c.implemented ? "not configured" : "not implemented"}</Badge>
                  {st && st.circuit !== "CLOSED" && <Badge variant="danger">circuit {st.circuit.toLowerCase()}</Badge>}
                  <a href={c.docs} target="_blank" rel="noreferrer" className="ml-auto text-xs text-primary">API docs ↗</a>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{c.notes}</p>
                {!c.configured && <p className="mt-1 text-xs text-amber-200">Setup: {c.setup}</p>}
                {["anthropic", "openai", "elevenlabs"].includes(c.key) && (
                  <form action={saveCredential} className="mt-3 flex gap-2">
                    <input type="hidden" name="provider" value={c.key} />
                    <Input name="secret" type="password" placeholder={`${c.name} API key`} autoComplete="off" className="max-w-sm" />
                    <Button size="sm" variant="secondary">Store encrypted</Button>
                  </form>
                )}
                {c.key === "youtube" && (
                  <form action={testYouTube} className="mt-3"><Button size="sm" variant="secondary">Test connection</Button></form>
                )}
              </div>
            );
          })}
          <div className="rounded-lg border p-4 text-sm">
            <span className="font-medium">FFmpeg</span> <Badge variant={ffmpeg ? "success" : "danger"}>{ffmpeg ? "available" : "missing"}</Badge>
            <div className="mt-1 text-xs text-muted-foreground">{ffmpeg ?? "Install FFmpeg or set FFMPEG_PATH; video assembly and QA need it."}</div>
          </div>
        </div>
      </Section>

      <Section title="Model routing">
        <div className="space-y-2">
          {TASKS.map((t) => {
            const r = routes.find((x) => x.task === t.task);
            return (
              <form key={t.task} action={saveRoute} className="flex flex-wrap items-center gap-2 text-sm">
                <input type="hidden" name="task" value={t.task} />
                <span className="w-44 font-mono text-xs">{t.task}</span>
                <select name="provider" defaultValue={r?.provider ?? (t.kind === "llm" ? "anthropic" : "procedural")} className="h-8 rounded-lg border border-input bg-black/20 px-2 text-xs">
                  {t.kind === "llm" ? <option value="anthropic">anthropic</option> : <><option value="procedural">procedural (local)</option><option value="openai">openai</option></>}
                </select>
                <Input name="model" defaultValue={r?.model ?? (t.kind === "llm" ? DEFAULT_MODEL : t.kind === "image" && r?.provider === "openai" ? "gpt-image-1" : "")} placeholder={t.kind === "llm" ? DEFAULT_MODEL : "gpt-image-1"} className="h-8 w-48 text-xs" />
                <Button size="sm" variant="ghost">Save</Button>
              </form>
            );
          })}
        </div>
      </Section>

      <Section title="Distribution channels">
        <div className="grid gap-3 md:grid-cols-2">
          {channels.map((c) => (
            <div key={c.key} className="rounded-lg border p-3 text-sm">
              <div className="flex items-center gap-2"><span className="font-medium">{c.name}</span><Badge variant={c.status === "CONNECTED" ? "success" : "outline"}>{c.status.toLowerCase().replace("_", " ")}</Badge></div>
              <p className="mt-1 text-xs text-muted-foreground">{c.lastError ?? c.notes}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Field({ label, name, value }: { label: string; name: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={value} inputMode="decimal" />
    </div>
  );
}
