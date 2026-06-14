import { cn } from "@/lib/utils";

function Block({ className }: { className?: string }) {
  return (
    <div
      className={cn("page-skeleton__block animate-pulse", className)}
      aria-hidden
    />
  );
}

export function TablePageSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="page-skeleton page-skeleton--table" aria-busy aria-label="Loading">
      <div className="page-skeleton__toolbar">
        <Block className="page-skeleton__search" />
        <Block className="page-skeleton__btn" />
      </div>
      <div className="page-skeleton__table">
        <Block className="page-skeleton__table-head" />
        {Array.from({ length: rows }).map((_, i) => (
          <Block key={i} className="page-skeleton__table-row" />
        ))}
      </div>
    </div>
  );
}

export function CardsPageSkeleton() {
  return (
    <div className="page-skeleton page-skeleton--cards" aria-busy aria-label="Loading">
      <div className="page-skeleton__stat-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <Block key={i} className="page-skeleton__stat" />
        ))}
      </div>
      <div className="page-skeleton__chart-grid">
        <Block className="page-skeleton__chart page-skeleton__chart--wide" />
        <Block className="page-skeleton__chart" />
      </div>
      <Block className="page-skeleton__chart page-skeleton__chart--wide" />
    </div>
  );
}

export function SettingsPageSkeleton() {
  return (
    <div className="page-skeleton page-skeleton--settings" aria-busy aria-label="Loading">
      <div className="page-skeleton__tabs">
        {Array.from({ length: 4 }).map((_, i) => (
          <Block key={i} className="page-skeleton__tab" />
        ))}
      </div>
      <div className="page-skeleton__toolbar">
        <Block className="page-skeleton__search" />
        <Block className="page-skeleton__btn" />
      </div>
      <div className="page-skeleton__list">
        {Array.from({ length: 10 }).map((_, i) => (
          <Block key={i} className="page-skeleton__list-row" />
        ))}
      </div>
    </div>
  );
}

export function FormsHubSkeleton() {
  return (
    <div className="page-skeleton page-skeleton--forms" aria-busy aria-label="Loading">
      <div className="page-skeleton__form-grid">
        {Array.from({ length: 3 }).map((_, i) => (
          <Block key={i} className="page-skeleton__form-card" />
        ))}
      </div>
    </div>
  );
}

export function AuditFormSkeleton() {
  return (
    <div className="page-skeleton page-skeleton--audit-form" aria-busy aria-label="Loading">
      <Block className="page-skeleton__audit-template" />
      <div className="page-skeleton__audit-grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <Block key={i} className="page-skeleton__audit-field" />
        ))}
      </div>
      <Block className="page-skeleton__audit-panel" />
    </div>
  );
}
