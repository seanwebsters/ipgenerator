"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Badge, Logo } from "./ui";
import { cx } from "@/lib/util";

export function useAIMode() {
  const [mode, setMode] = useState<{ ai: "claude" | "mock"; model: string } | null>(null);
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setMode)
      .catch(() => setMode({ ai: "mock", model: "" }));
  }, []);
  return mode;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const mode = useAIMode();
  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-30 border-b border-line bg-ink/80 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-5">
          <div className="flex items-center gap-8">
            <Logo href="/studio" />
            <nav className="hidden items-center gap-1 text-sm md:flex">
              <Link href="/studio" className={cx("rounded-lg px-3 py-1.5", path === "/studio" ? "bg-white/10 text-white" : "text-muted hover:text-white")}>
                Portfolio
              </Link>
              <Link href="/" className="rounded-lg px-3 py-1.5 text-muted hover:text-white">
                Product
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {mode && (
              <Badge color={mode.ai === "claude" ? "#c4b5fd" : "#9b9bb4"}>
                <span className={cx("h-1.5 w-1.5 rounded-full", mode.ai === "claude" ? "bg-violet-300" : "bg-white/40")} />
                {mode.ai === "claude" ? `Claude · ${mode.model}` : "Mock AI (no API key)"}
              </Badge>
            )}
            <Link href="/studio/new" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-amber-300 px-3 text-xs font-semibold text-ink hover:bg-amber-200">
              <Plus className="h-3.5 w-3.5" /> New franchise
            </Link>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
