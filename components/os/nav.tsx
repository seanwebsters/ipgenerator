"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, CalendarDays, Coins, Factory, Gauge, Inbox, LineChart, MessageSquareText, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

export const OS_NAV = [
  { href: "/os", label: "Home", icon: Gauge },
  { href: "/os/universe", label: "IP Universe", icon: Sparkles },
  { href: "/os/floor", label: "Studio Floor", icon: Factory },
  { href: "/os/agents", label: "Agent Workforce", icon: Bot },
  { href: "/os/calendar", label: "Content Calendar", icon: CalendarDays },
  { href: "/os/intelligence", label: "Intelligence", icon: LineChart },
  { href: "/os/commercial", label: "Commercial", icon: Coins },
  { href: "/os/copilot", label: "Copilot", icon: MessageSquareText },
  { href: "/os/approvals", label: "Approval Inbox", icon: Inbox },
  { href: "/os/settings", label: "Settings", icon: Settings },
];

export function OsNav({ pending }: { pending: number }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {OS_NAV.map((n) => {
        const active = n.href === "/os" ? path === "/os" : path.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition", active ? "bg-foreground/[0.08] text-foreground" : "text-foreground/60 hover:bg-white/[0.04] hover:text-foreground")}>
            <n.icon className={cn("size-4", active && "text-primary")} />
            <span className="flex-1">{n.label}</span>
            {n.href === "/os/approvals" && pending > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{pending}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav() {
  const path = usePathname();
  return (
    <nav className="scrollbar-none flex gap-1 overflow-x-auto border-b px-3 py-2 lg:hidden">
      {OS_NAV.map((n) => (
        <Link key={n.href} href={n.href} className={cn("shrink-0 rounded-full px-3 py-1 text-xs", (n.href === "/os" ? path === "/os" : path.startsWith(n.href)) ? "bg-foreground text-background" : "border text-foreground/70")}>
          {n.label}
        </Link>
      ))}
    </nav>
  );
}
