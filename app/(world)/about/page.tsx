export const metadata = { title: "How WEBSTER makes stories" };

export default function About() {
  return (
    <main className="mx-auto max-w-2xl px-4 pt-14 sm:px-8">
      <div className="text-xs font-semibold uppercase tracking-[0.35em] text-brass">Transparency</div>
      <h1 className="font-display mt-3 text-5xl">How WEBSTER makes stories</h1>
      <div className="mt-8 space-y-5 text-lg leading-relaxed text-foreground/85">
        <p>WEBSTER is an entertainment studio. Our worlds, characters and stories are original, and a small human team sets their creative direction, approves every new world and approves what we release.</p>
        <p>Much of the production work — drafting, storyboarding, editing, scoring — is done with AI-assisted tools and in-house software. We don&rsquo;t present that work as hand-made. Every title has an &ldquo;About this title&rdquo; note describing how it was produced, and when we publish on other platforms we use their AI-content disclosure labels.</p>
        <p>We never clone a real person&rsquo;s voice or likeness without documented permission, and we screen new worlds for resemblance to existing properties before they are released.</p>
        <p>Titles marked <span className="rounded-full bg-fuchsia-500/85 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-white">Demo</span> were produced while setting up the studio, using placeholder writing from a deterministic demo generator rather than our full creative pipeline.</p>
      </div>
    </main>
  );
}
