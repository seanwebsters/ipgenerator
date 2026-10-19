import Link from "next/link";
import { Wordmark } from "@/components/brand";

const NAV = [
  { href: "/", label: "Discover" },
  { href: "/watch", label: "Watch" },
  { href: "/read", label: "Read" },
  { href: "/listen", label: "Listen" },
  { href: "/play", label: "Play" },
  { href: "/library", label: "My Library" },
];

export function WorldShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(120%_60%_at_50%_-10%,#2a1a10_0%,#0d0b09_55%)]">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-8 px-4 sm:px-8">
          <Wordmark />
          <nav className="scrollbar-none hidden flex-1 items-center gap-1 overflow-x-auto text-sm md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-full px-3 py-1.5 text-foreground/70 transition hover:bg-white/5 hover:text-foreground">
                {n.label}
              </Link>
            ))}
          </nav>
          <Link href="/profile" className="ml-auto grid size-9 place-items-center rounded-full border border-white/10 bg-white/5 text-xs font-semibold md:ml-0">
            Me
          </Link>
        </div>
        <nav className="scrollbar-none flex gap-1 overflow-x-auto px-3 pb-2 text-sm md:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="shrink-0 rounded-full border border-white/10 px-3 py-1 text-foreground/75">
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
      <footer className="mt-24 border-t border-white/5">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-10 text-sm text-muted-foreground sm:px-8 md:flex-row md:items-center md:justify-between">
          <Wordmark />
          <div className="flex flex-wrap gap-5">
            <Link href="/about" className="hover:text-foreground">How Studio makes stories</Link>
            <Link href="/profile" className="hover:text-foreground">Profile & maturity settings</Link>
            <span>© {new Date().getFullYear()} Studio</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
