"use client";

import type { AnalyticsSortOrder } from "@/lib/audit/analytics-sort";
import { QmsViewToggle } from "@/components/analytics/qms-primitives";

export function QmsSortToggle({
  value,
  onChange,
}: {
  value: AnalyticsSortOrder;
  onChange: (value: AnalyticsSortOrder) => void;
}) {
  return (
    <QmsViewToggle
      value={value}
      onChange={(id) => onChange(id as AnalyticsSortOrder)}
      options={[
        { id: "asc", label: "Ascending" },
        { id: "desc", label: "Descending" },
      ]}
    />
  );
}

export function QmsMetricDimensionToggle({
  value,
  onChange,
}: {
  value: "parameter" | "category";
  onChange: (value: "parameter" | "category") => void;
}) {
  return (
    <QmsViewToggle
      value={value}
      onChange={(id) => onChange(id as "parameter" | "category")}
      options={[
        { id: "parameter", label: "Parameter wise" },
        { id: "category", label: "Category wise" },
      ]}
    />
  );
}
