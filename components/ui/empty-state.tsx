import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("ui-empty-state", className)}>
      {Icon ? <Icon className="ui-empty-state__icon" size={40} strokeWidth={1.5} /> : null}
      <p className="ui-empty-state__title">{title}</p>
      {description ? <p className="ui-empty-state__desc">{description}</p> : null}
      {action}
    </div>
  );
}

type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorState({ message, onRetry, className }: ErrorStateProps) {
  return (
    <div className={cn("ui-empty-state", className)} role="alert">
      <p className="ui-empty-state__title">Something went wrong</p>
      <p className="ui-empty-state__desc">{message}</p>
      {onRetry ? (
        <button type="button" className="ui-btn ui-btn--secondary ui-btn--sm" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function TableSkeleton({
  rows = 5,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="ui-table-wrap">
      <table className="ui-table">
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}>
                <div className="ui-skeleton" style={{ height: 10, width: "70%" }} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, row) => (
            <tr key={row}>
              {Array.from({ length: cols }).map((_, col) => (
                <td key={col}>
                  <div
                    className="ui-skeleton"
                    style={{ height: 14, width: col === 0 ? "80%" : "60%" }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
