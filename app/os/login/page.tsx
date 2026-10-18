import { LoginForm } from "./form";
import { Mark } from "@/components/brand";
import { DEMO_FOUNDER, embeddedDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "Studio sign in" };

export default function Login() {
  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(80%_60%_at_50%_0%,#2b1a0f,#0d0b09_60%)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Mark className="size-12" />
          <div className="font-mark mt-4 text-2xl font-bold tracking-[0.32em]">WEBSTER</div>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-brass">Studio OS</div>
        </div>
        {embeddedDb() && (
          <p className="mb-4 rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/[0.07] p-3 text-sm text-fuchsia-100">
            Temporary demo: sign in as <b>{DEMO_FOUNDER.email}</b> / <b>{DEMO_FOUNDER.password}</b> (filled in below). Anything you make resets when the server restarts.
          </p>
        )}
        <LoginForm demo={embeddedDb() ? DEMO_FOUNDER : undefined} />
      </div>
    </main>
  );
}
