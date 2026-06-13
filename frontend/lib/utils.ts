import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Fusionne les classes TailwindCSS de manière fiable
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

