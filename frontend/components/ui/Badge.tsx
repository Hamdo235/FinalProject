import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-[0.06em] font-mono",
  {
    variants: {
      variant: {
        default:     "bg-[#15241C] text-[#6FB894]  border border-[#2C4A39]",
        destructive: "bg-[#2A1A12] text-[#D98862]  border border-[#4D3122]",
        warning:     "bg-[#262017] text-[#E0B83A]  border border-[#4A3F1C]",
        success:     "bg-[#15241C] text-[#6FB894]  border border-[#2C4A39]",
        violet:      "bg-[#13202C] text-[#6BA3C9]  border border-[#2A4357]",
        info:        "bg-[#13202C] text-[#6BA3C9]  border border-[#2A4357]",
        outline:     "bg-transparent text-text-secondary border border-[#262D38]",
        cyan:        "bg-[#13202C] text-[#6BA3C9]  border border-[#2A4357]",
        amber:       "bg-[#262017] text-[#C9A02E]  border border-[#4A3F1C]",
        subtle:      "bg-[#1C222B] text-text-muted  border border-[#262D38]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
