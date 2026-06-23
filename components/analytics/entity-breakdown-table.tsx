"use client";

import { useMemo } from "react";
import type { QmsEntityMetricRow } from "@/lib/audit/analytics-metrics";
import {
  sortBreakdownRows,
  type AnalyticsSortOrder,
} from "@/lib/audit/analytics-sort";
import {
  QmsBadge,
  QmsCard,
  QmsEmpty,
  QmsSectionTitle,
  scoreHex,
} from "@/components/analytics/qms-primitives";
import {
  DataTablePanel,
  usePaginatedRows,
} from "@/components/primitives/data-table-panel";

type EntityBreakdownTableProps = {
  rows: QmsEntityMetricRow[];
  entityLabel: string;
  metricLabel: string;
  sortOrder: AnalyticsSortOrder;
  title: string;
  sub?: string;
};

export function EntityBreakdownTable({
  rows,
  entityLabel,
  metricLabel,
  sortOrder,
  title,
  sub,
}: EntityBreakdownTableProps) {
  const sortedRows = useMemo(
    () => sortBreakdownRows(rows, sortOrder),
    [rows, sortOrder]
  );
  const pagination = usePaginatedRows(sortedRows);

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
      <DataTablePanel
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
