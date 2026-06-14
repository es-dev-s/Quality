"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { QmsEmpty } from "@/components/analytics/qms-primitives";

type QmsChartFrameProps = {
  children: ReactNode;
  className?: string;
  empty?: boolean;
  emptyMessage?: string;
};

export function QmsChartFrame({
  children,
  className,
  empty = false,
  emptyMessage = "No data for this chart yet.",
}: QmsChartFrameProps) {
  if (empty) {
    return (
      <div className={cn("qms-chart qms-chart--empty", className)}>
        <QmsEmpty message={emptyMessage} />
      </div>
    );
  }

  return (
    <div className={cn("qms-chart qms-chart--ready", className)}>
      {children}
    </div>
  );
}
