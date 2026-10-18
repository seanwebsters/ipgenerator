import * as React from "react";
import { cn } from "@/lib/cn";

function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(
        "h-9 w-full rounded-lg border border-input bg-black/20 px-3 text-sm placeholder:text-muted-foreground/60 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "w-full rounded-lg border border-input bg-black/20 px-3 py-2 text-sm placeholder:text-muted-foreground/60 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30",
        className,
      )}
      {...props}
    />
  );
}

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground", className)} {...props} />;
}

export { Input, Textarea, Label };
