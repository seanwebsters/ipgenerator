import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap [&>svg]:size-3", {
  variants: {
    variant: {
      default: "border-transparent bg-primary/15 text-primary",
      outline: "border-border text-muted-foreground",
      success: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
      warning: "border-amber-400/30 bg-amber-400/10 text-amber-200",
      danger: "border-red-400/30 bg-red-400/10 text-red-200",
      brass: "border-brass/30 bg-brass/10 text-brass",
      demo: "border-fuchsia-300/40 bg-fuchsia-400/10 text-fuchsia-200 uppercase tracking-wider",
    },
  },
  defaultVariants: { variant: "default" },
});

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
