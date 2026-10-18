"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowUp, Sparkles } from "lucide-react";
import { runCommand } from "@/app/os/actions";

const EXAMPLES = [
  "Develop five original fantasy franchises for young adults and prototype the two strongest concepts.",
  "Develop three cozy adventure worlds for families and prototype the strongest.",
  "Give me a status report.",
];

export function CommandBar({ big = false }: { big?: boolean }) {
  const [state, action, pending] = useActionState(runCommand, null);
  return (
    <div>
      <form action={action} className="relative rounded-2xl border border-white/12 bg-[#120f0c] p-2 shadow-[0_30px_80px_-40px_rgba(226,120,60,0.5)]">
        <div className="flex items-start gap-3 p-2">
          <Sparkles className="mt-1 size-4 shrink-0 text-primary" />
          <textarea
            name="command"
            rows={big ? 3 : 2}
            placeholder={EXAMPLES[0]}
            className="flex-1 resize-none bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button disabled={pending} className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50">
            <ArrowUp className="size-4" />
          </button>
        </div>
      </form>
      {big && (
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <form key={e} action={action}>
              <input type="hidden" name="command" value={e} />
              <button className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:text-foreground">{e}</button>
            </form>
          ))}
        </div>
      )}
      {pending && <p className="mt-3 text-sm text-muted-foreground">Atlas is reading your instruction…</p>}
      {state && !pending && (
        <div className="mt-3 rounded-xl border bg-card px-4 py-3 text-sm">
          <span className="text-foreground/90">{state.reply}</span>
          {"runId" in state && state.runId && (
            <Link href={`/os/floor?run=${state.runId}`} className="ml-2 text-primary hover:underline">Follow it on the Studio Floor →</Link>
          )}
          {"provider" in state && state.provider === "demo" && <span className="ml-2 text-[11px] text-fuchsia-200">(parsed by the DEMO parser)</span>}
        </div>
      )}
    </div>
  );
}
