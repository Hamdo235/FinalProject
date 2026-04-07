import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("cyber-badge", {
  variants: {
    variant: {
      default:     "cyber-badge-low",
      destructive: "cyber-badge-high",
      warning:     "cyber-badge-medium",
      success:     "cyber-badge-low",
      info:        "",
      outline:     "",
      cyan:        "",
      amber:       "",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, style, ...props }: BadgeProps) {
  const extraStyle: React.CSSProperties =
    variant === "info"
      ? { background: "rgba(56,189,248,0.12)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.3)", ...style }
      : variant === "outline"
      ? { background: "transparent", color: "#64748b", border: "1px solid rgba(100,116,139,0.35)", ...style }
      : variant === "cyan"
      ? { background: "rgba(34,211,238,0.1)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.25)", ...style }
      : variant === "amber"
      ? { background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)", ...style }
      : (style ?? {});

  return (
    <div className={cn(badgeVariants({ variant }), className)} style={extraStyle} {...props} />
  );
}

export { Badge, badgeVariants };
