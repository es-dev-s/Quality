import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: React.ReactNode;
  context?: string;
  className?: string;
  valueClassName?: string;
};

export function StatCard({
  label,
  value,
  context,
  className,
  valueClassName,
}: StatCardProps) {
  return (
    <div className={cn("ui-stat-card", className)}>
      <p className="ui-stat-card__label">{label}</p>
      <p className={cn("ui-stat-card__value", valueClassName)}>{value}</p>
      {context ? <p className="ui-stat-card__context">{context}</p> : null}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="ui-stat-card">
      <div className="ui-skeleton" style={{ height: 12, width: "55%" }} />
      <div
        className="ui-skeleton"
        style={{ height: 32, width: "40%", marginTop: "var(--space-3)" }}
      />
      <div
        className="ui-skeleton"
        style={{ height: 10, width: "70%", marginTop: "var(--space-2)" }}
      />
    </div>
  );
}
