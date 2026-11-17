import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-muted-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        // Method tags, matching the analysis they label.
        // Method tags separate by TONE, not hue — Coke red, deep red, black,
        // grey. Four unrelated colours would have been easier to tell apart
        // and would have put three non-brand hues on a Coca-Cola deliverable.
        maxdiff: "border-transparent bg-coke-red text-white",
        latent: "border-transparent bg-coke-black text-white",
        assoc: "border-transparent bg-coke-grey text-white",
        turf: "border-transparent bg-coke-deep text-white",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
