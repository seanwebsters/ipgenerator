import { redirect } from "next/navigation";
import { LoginForm } from "./form";
import { Mark } from "@/components/brand";
import { embeddedDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "Studio sign in" };

export default function Login() {
  if (embeddedDb()) redirect("/os"); // no sign-in on the temporary demo database
  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(80%_60%_at_50%_0%,#2b1a0f,#0d0b09_60%)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Mark className="size-12" />
          <div className="font-mark mt-4 text-2xl font-bold tracking-[0.32em]">WEBSTER</div>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-brass">Studio OS</div>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
