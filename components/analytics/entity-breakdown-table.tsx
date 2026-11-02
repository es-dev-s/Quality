"use client";

import { useAnalyticsBreakdown } from "@/components/analytics/pagination-context";
import {
	QmsBadge,
	QmsCard,
	QmsEmpty,
	QmsSectionTitle,
	scoreHex,
} from "@/components/analytics/qms-primitives";
import {
	DataTablePanel
} from "@/components/primitives/data-table-panel";
import type { QmsEntityMetricRow } from "@/lib/audit/analytics-metrics";
import type { BreakdownKey } from "@/lib/audit/analytics-query";
import {
	type AnalyticsSortOrder
} from "@/lib/audit/analytics-sort";

type EntityBreakdownTableProps = {
  rows: QmsEntityMetricRow[];
  dataKey: BreakdownKey;
  entityLabel: string;
  metricLabel: string;
  sortOrder: AnalyticsSortOrder;
  title: string;
  sub?: string;
};

export function EntityBreakdownTable({
  dataKey,
  entityLabel,
  metricLabel,
  title,
  sub,
}: EntityBreakdownTableProps) {
  const resource = useAnalyticsBreakdown(dataKey);
  const pagination = resource.pagination;
  const rows = pagination.slice;
  if (rows.length === 0) {
    return (
      <QmsEmpty
        message={`No ${metricLabel.toLowerCase()} breakdown data yet. Submit scored audits to populate this view.`}
      />
    );
  }

  return (
    <QmsCard>
      <QmsSectionTitle title={title} sub={sub} />
      {resource.error ? <p role="alert">{resource.error}</p> : null}
      <DataTablePanel
        paginationPending={resource.loading}
        pagination={pagination}
        renderTable={(slice) => (
          <table className="ui-table qms-table platform-report-table platform-report-table--expanded">
            <thead>
              <tr>
                <th>{entityLabel}</th>
                <th>{metricLabel}</th>
                <th>Score %</th>
                <th>Samples</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((row) => (
                <tr key={`${row.entity}-${row.metric}`}>
                  <td className="qms-cell-strong">{row.entity}</td>
                  <td>{row.metric}</td>
                  <td style={{ color: scoreHex(row.score), fontWeight: 800 }}>
                    {row.score}%
                  </td>
                  <td>{row.samples}</td>
                  <td>
                    <QmsBadge score={row.score} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      />
    </QmsCard>
  );
}
