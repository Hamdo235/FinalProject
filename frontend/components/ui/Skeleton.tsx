import { cn } from "@/lib/utils";

/**
 * Skeleton de chargement pour les cartes et lignes de tableau
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-gray-200", className)}
      {...props}
    />
  );
}
