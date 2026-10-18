import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db, embeddedDb } from "@/lib/db";
import { getSecret } from "@/engine/credentials";
import { budgetStatus } from "@/engine/metering";
import { engineInline } from "@/engine/runner";
import { Wordmark } from "@/components/brand";
import { EngineHeartbeat } from "@/components/os/live";
import { MobileNav, OsNav } from "@/components/os/nav";
import { Badge } from "@/components/ui/badge";
import { usd } from "@/lib/util";

export const dynamic = "force-dynamic";

const MODE_LABEL = { ASSISTED: "Assisted", SUPERVISED: "Supervised", HIGH: "High autonomy" };

export default async function HQLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("ANALYST");
  const [settings, pending, budget, llmKey, running] = await Promise.all([
    db.studioSettings.findUniqueOrThrow({ where: { id: "studio" } }),
    db.approval.count({ where: { status: "PENDING" } }),
    budgetStatus(),
    getSecret("anthropic"),
    db.workflowRun.count({ where: { status: "RUNNING" } }),
  ]);
  const demoMode = !llmKey && settings.allowDemoProvider;
  return (
    <div className="flex min-h-screen">
      {engineInline() && <EngineHeartbeat />}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-[#0f0c0a] px-3 py-5 lg:flex">
        <div className="px-2">
          <Wordmark href="/os" />
          <div className="ml-[38px] mt-0.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-brass">Studio OS</div>
        </div>
        <div className="mt-8 flex-1">
          <OsNav pending={pending} />
        </div>
        <div className="space-y-2 rounded-xl border bg-card p-3 text-xs">
          <div className="flex justify-between text-muted-foreground">
            <span>Today</span>
            <span className="tabular-nums text-foreground">{usd(budget.day)} / {usd(budget.dailyCap)}</span>
          </div>
          <div className="h-1 rounded-full bg-white/5">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (budget.day / Math.max(budget.dailyCap, 0.0001)) * 100)}%` }} />
          </div>
          <Link href="/" className="block pt-1 text-muted-foreground hover:text-foreground">Open WEBSTER WORLD ↗</Link>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-xl">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <div className="lg:hidden">
              <Wordmark href="/os" />
            </div>
            <div className="ml-auto flex items-center gap-2">
              {demoMode && (
                <Link href="/os/settings">
                  <Badge variant="demo">Demo provider active</Badge>
                </Link>
              )}
              {running > 0 && <Badge variant="success"><span className="size-1.5 animate-pulse rounded-full bg-emerald-300" /> {running} running</Badge>}
              <Link href="/os/settings"><Badge variant="brass">{MODE_LABEL[settings.autonomyMode]}</Badge></Link>
              <span className="hidden text-xs text-muted-foreground sm:inline">{user.name} · {user.role.toLowerCase()}</span>
              {!embeddedDb() && (
                <form action="/api/auth/logout" method="post">
                  <button className="text-xs text-muted-foreground hover:text-foreground">Sign out</button>
                </form>
              )}
            </div>
          </div>
          <MobileNav />
        </header>
        {embeddedDb() && (
          <div className="border-b border-amber-400/20 bg-amber-500/[0.07] px-4 py-2 text-xs text-amber-100 sm:px-6">
            Temporary demo database: everything here resets when the server restarts. To keep your work, connect a database (on Vercel: Storage → Prisma Postgres) and redeploy.
          </div>
        )}
        {demoMode && (
          <div className="border-b border-fuchsia-400/20 bg-fuchsia-500/[0.07] px-4 py-2 text-xs text-fuchsia-100 sm:px-6">
            No LLM provider is configured, so agents use the deterministic DEMO generator. Everything it produces is labelled DEMO and is never published outside WEBSTER WORLD.{" "}
            <Link href="/os/settings" className="underline">Connect Anthropic</Link>
          </div>
        )}
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
