import Link from "next/link";
import { cn } from "@/lib/cn";

/** The WEBSTER mark: a proscenium arch — a doorway into a world. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <defs>
        <linearGradient id="wm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3c98b" />
          <stop offset="1" stopColor="#e2783c" />
        </linearGradient>
      </defs>
      <path d="M4 29V14C4 7.4 9.4 2 16 2s12 5.4 12 12v15" fill="none" stroke="url(#wm)" strokeWidth="2.4" />
      <path d="M9.5 29V15.5a6.5 6.5 0 0 1 13 0V29" fill="none" stroke="url(#wm)" strokeWidth="1.4" opacity="0.7" />
      <circle cx="16" cy="12" r="1.8" fill="#f3c98b" />
    </svg>
  );
}

export function Wordmark({ href = "/", className, suffix }: { href?: string; className?: string; suffix?: string }) {
  return (
    <Link href={href} className={cn("group flex items-center gap-2.5", className)}>
      <Mark />
      <span className="font-mark text-[19px] font-bold tracking-[0.28em] text-foreground">WEBSTER</span>
      {suffix && <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-brass">{suffix}</span>}
    </Link>
  );
}
