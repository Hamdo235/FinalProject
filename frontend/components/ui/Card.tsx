import * as React from "react";
import { cn } from "@/lib/utils";

type CardVariant    = "default" | "elevated" | "glass";
type CardAccent     = "sage" | "terra" | "amber" | "slate" | "red" | "violet" | "teal" | "cyan";

const accentBorder: Record<CardAccent, string> = {
  sage:   "border-t-2 border-t-accent-sage",
  terra:  "border-t-2 border-t-accent-terra",
  amber:  "border-t-2 border-t-accent-amber",
  slate:  "border-t-2 border-t-accent-slate",
  red:    "border-t-2 border-t-accent-terra",
  violet: "border-t-2 border-t-accent-sage",
  teal:   "border-t-2 border-t-accent-sage",
  cyan:   "border-t-2 border-t-accent-slate",
};

const variantClass: Record<CardVariant, string> = {
  default:  "cyber-card",
  elevated: "cyber-card shadow-card-hover",
  glass:    "bg-bg-card/90 backdrop-blur-sm border border-bg-border rounded-2xl",
};

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:     CardVariant;
  accentColor?: CardAccent;
}

export function Card({ className, style, variant = "default", accentColor, ...props }: CardProps) {
  return (
    <div
      className={cn(
        variantClass[variant],
        accentColor ? accentBorder[accentColor] : undefined,
        className,
      )}
      style={style}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-5 py-4 border-b border-bg-border", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-sm font-semibold text-text-primary", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-5 py-4 border-t border-bg-border", className)}
      {...props}
    />
  );
}
