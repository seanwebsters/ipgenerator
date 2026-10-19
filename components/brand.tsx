import Link from "next/link";
import { cn } from "@/lib/cn";

/** The product name as plain text. */
export function Wordmark({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("text-lg font-semibold tracking-tight text-foreground", className)}>
      Studio
    </Link>
  );
}
