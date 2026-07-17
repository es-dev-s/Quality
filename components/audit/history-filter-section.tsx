"use client";

import {
  AUDIT_HISTORY_FILTER_OPTIONS,
  type AuditHistoryFilter,
} from "@/lib/audit/history-filter";
import { FilterSidebarSection } from "@/components/filters/filter-sidebar";

type HistoryFilterSectionProps = {
  value: AuditHistoryFilter;
  onChange: (value: AuditHistoryFilter) => void;
  show?: boolean;
};

export function HistoryFilterSection({
  value,
  onChange,
  show = true,
}: HistoryFilterSectionProps) {
  if (!show) return null;

  return (
    <FilterSidebarSection label="Data scope">
      <div className="segmented-tabs segmented-tabs--compact">
        {AUDIT_HISTORY_FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={
              value === option.value
                ? "segmented-tabs__btn segmented-tabs__btn--active"
                : "segmented-tabs__btn"
            }
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="ui-hint" style={{ marginTop: 8 }}>
        Working shows current team data. History shows audits retained after an
        agent transfer.
      </p>
    </FilterSidebarSection>
  );
}
