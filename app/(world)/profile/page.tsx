import { currentViewer, RATING_LABEL } from "@/lib/viewer";
import { updateProfile } from "../actions";

export const dynamic = "force-dynamic";

export default async function Profile() {
  const v = await currentViewer();
  return (
    <main className="mx-auto max-w-xl px-4 pt-14 sm:px-8">
      <div className="text-xs font-semibold uppercase tracking-[0.35em] text-brass">Profile</div>
      <h1 className="font-display mt-3 text-5xl">{v?.displayName ?? "Your profile"}</h1>
      <form action={updateProfile} className="mt-10 space-y-6 rounded-2xl border border-white/10 bg-card/60 p-6">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Display name</span>
          <input name="displayName" defaultValue={v?.displayName ?? ""} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/30 px-4 outline-none focus:border-brass" />
        </label>
        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Maturity</legend>
          <p className="mt-1 text-sm text-muted-foreground">Only titles rated at or below this level are shown on this device.</p>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {Object.entries(RATING_LABEL).map(([k, label]) => (
              <label key={k} className="cursor-pointer">
                <input type="radio" name="maturityLimit" value={k} defaultChecked={(v?.maturityLimit ?? "AGE_13") === k} className="peer sr-only" />
                <span className="block rounded-xl border border-white/10 py-2 text-center text-sm peer-checked:border-brass peer-checked:bg-brass/15">{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button className="h-11 rounded-full bg-foreground px-6 font-semibold text-background">Save</button>
      </form>
    </main>
  );
}
