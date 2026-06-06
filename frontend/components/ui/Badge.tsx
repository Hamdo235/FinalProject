import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-[0.06em] font-mono",
  {
    variants: {
      variant: {
        default:     "bg-[#EBF3EE] text-[#5B8A6E]  border border-[#B8D8C4]",
        destructive: "bg-[#FDF0E8] text-[#C4714A]  border border-[#F0C4A8]",
        warning:     "bg-[#FDF8E0] text-[#B8960A]  border border-[#F0E090]",
        success:     "bg-[#EBF3EE] text-[#5B8A6E]  border border-[#B8D8C4]",
        violet:      "bg-[#EAF2F8] text-[#4A7B9D]  border border-[#A8C8E0]",
        info:        "bg-[#EAF2F8] text-[#4A7B9D]  border border-[#A8C8E0]",
        outline:     "bg-transparent text-text-secondary border border-[#E8E5E0]",
        cyan:        "bg-[#EAF2F8] text-[#4A7B9D]  border border-[#A8C8E0]",
        amber:       "bg-[#FDF8E8] text-[#A07800]  border border-[#ECD870]",
        subtle:      "bg-[#F5F3EE] text-text-muted  border border-[#E8E5E0]",
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
