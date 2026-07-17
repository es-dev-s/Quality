"use client";

import { cn } from "@/lib/utils";

export function HistoryBadge({ className }: { className?: string }) {
  return (
    <span className={cn("audit-history-badge", className)} title="Transferred agent history">
      History
    </span>
  );
}
