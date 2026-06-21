"use client";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type LoadingIndicatorProps = {
  label?: string;
  size?: "sm" | "md" | "lg";
  inline?: boolean;
  className?: string;
};

export function LoadingIndicator({
  label = "Loading…",
  size = "md",
  inline = false,
  className,
}: LoadingIndicatorProps) {
  return (
    <div
      className={cn(
        "loading-indicator",
        inline && "loading-indicator--inline",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Spinner size={size} />
      {label ? <span className="loading-indicator__label">{label}</span> : null}
    </div>
  );
}

type LoadingZoneProps = {
  loading?: boolean;
  label?: string;
  className?: string;
  children: React.ReactNode;
};

/** Frosted overlay for sections while async work runs (tables, panels, pages). */
export function LoadingZone({
  loading = false,
  label = "Loading…",
  className,
  children,
}: LoadingZoneProps) {
  return (
    <div
      className={cn(
        "loading-zone",
        loading && "loading-zone--active",
        className
      )}
      aria-busy={loading || undefined}
    >
      <div className="loading-zone__content">{children}</div>
      {loading ? (
        <div className="loading-zone__overlay" role="status" aria-live="polite">
          <Spinner size="lg" />
          <span className="loading-zone__label">{label}</span>
        </div>
      ) : null}
    </div>
  );
}
