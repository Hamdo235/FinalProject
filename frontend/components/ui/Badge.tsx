import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "cyber-badge",
  {
    variants: {
      variant: {
        default:     "cyber-badge-low",
        destructive: "cyber-badge-high",
        warning:     "cyber-badge-medium",
        success:     "cyber-badge-low",
        info:        "",
        outline:     "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, style, ...props }: BadgeProps) {
  const infoStyle =
    variant === "info"
      ? {
          background: "rgba(55, 66, 250, 0.15)",
          color: "#3742fa",
          border: "1px solid rgba(55, 66, 250, 0.3)",
          ...style,
        }
      : variant === "outline"
      ? {
          background: "transparent",
          color: "#64748b",
          border: "1px solid rgba(100, 116, 139, 0.4)",
          ...style,
        }
      : style;

  return (
    <div
      className={cn(badgeVariants({ variant }), className)}
      style={infoStyle}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
