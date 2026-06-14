import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names using clsx and tailwind-merge
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format score colors
 */
export function getScoreColor(pct: number, hasFatal: boolean) {
  if (hasFatal) return "text-red-600";
  if (pct >= 90) return "text-green-600";
  if (pct >= 75) return "text-green-500";
  if (pct >= 60) return "text-amber-500";
  return "text-red-500";
}

export function getGrade(pct: number, hasFatal: boolean) {
  if (hasFatal) return "Failed";
  if (pct >= 90) return "Excellent";
  if (pct >= 75) return "Good";
  if (pct >= 60) return "Needs Improvement";
  return "Poor";
}

export function getBadgeClass(pct: number, hasFatal: boolean) {
  if (hasFatal) return "bg-red-100 text-red-700 border-red-200";
  if (pct >= 90) return "bg-green-100 text-green-800 border-green-200";
  if (pct >= 75) return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (pct >= 60) return "bg-amber-50 text-amber-700 border-amber-100";
  return "bg-red-50 text-red-700 border-red-100";
}
