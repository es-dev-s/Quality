"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { QmsAnalyticsData } from "@/lib/audit/analytics-metrics";
import { PASS_RATE_TARGET_PCT } from "@/lib/audit/metrics-config";
import {
  sortByNumber,
  type AnalyticsSortOrder,
} from "@/lib/audit/analytics-sort";
import { EntityBreakdownTable } from "@/components/analytics/entity-breakdown-table";
import { QmsChartTooltip } from "@/components/analytics/qms-chart-tooltip";
import {
  CHART_COLORS,
  QMS_CHART_TOOLTIP,
  QmsBadge,
  QmsCard,
  QmsEmpty,
  QmsKpiTile,
  QmsSectionTitle,
  QmsViewToggle,
  scoreHex,
} from "@/components/analytics/qms-primitives";
import { QmsChartFrame } from "@/components/analytics/qms-chart-frame";
import {
  DataTablePanel,
  usePaginatedRows,
} from "@/components/primitives/data-table-panel";

const AUDITOR_COLORS = [
  CHART_COLORS.accent,
  CHART_COLORS.purple,
  CHART_COLORS.green,
  CHART_COLORS.amber,
  CHART_COLORS.red,
  CHART_COLORS.accent,
  CHART_COLORS.purple,
];

type AuditorsTabProps = {
  data: QmsAnalyticsData;
  sortOrder: AnalyticsSortOrder;
};

export function AuditorsTab({ data, sortOrder }: AuditorsTabProps) {
  const [view, setView] = useState<"summary" | "parameter" | "category">(
    "summary"
  );

  const auditors = useMemo(
    () => sortByNumber(data.auditors, (row) => row.avg, sortOrder),
    [data.auditors, sortOrder]
  );
  const pagination = usePaginatedRows(auditors);

  const viewToggle = (
    <QmsViewToggle
      value={view}
      onChange={(id) => setView(id as "summary" | "parameter" | "category")}
      options={[
        { id: "summary", label: "Summary" },
        { id: "parameter", label: "Parameter wise" },
        { id: "category", label: "Category wise" },
      ]}
    />
  );

  if (data.auditors.length === 0) {
    return <QmsEmpty message="No auditor workload data yet." />;
  }

  if (view !== "summary") {
    return (
      <div className="qms-tab">
        {viewToggle}
        <EntityBreakdownTable
          rows={
            view === "parameter"
              ? data.auditor_param_breakdown
              : data.auditor_cat_breakdown
          }
          entityLabel="Quality analyst (QA)"
          metricLabel={view === "parameter" ? "Parameter" : "Category"}
          sortOrder={sortOrder}
          title={
            view === "parameter"
              ? "QA — parameter wise"
              : "QA — category wise"
          }
          sub="Average score per quality analyst and rubric segment"
        />
      </div>
    );
  }

  const total = auditors.reduce((sum, a) => sum + a.count, 0);
  const top = sortByNumber(auditors, (a) => a.avg, "desc")[0];
  const avgQuality =
    auditors.length > 0
      ? Math.round(auditors.reduce((sum, a) => sum + a.avg, 0) / auditors.length)
      : 0;

  return (
    <div className="qms-tab">
      {viewToggle}

      <div className="qms-kpi-row">
        <QmsKpiTile
          label="Active auditors"
          value={auditors.length}
          sub="Quality team members"
          tone="accent"
        />
        <QmsKpiTile
          label="Total audits done"
          value={total.toLocaleString()}
          sub="Across all auditors"
          tone="default"
        />
        <QmsKpiTile
          label="Avg QA score"
          value={`${avgQuality}%`}
          sub={`Target ≥${PASS_RATE_TARGET_PCT}% pass rate`}
          tone="success"
        />
        <QmsKpiTile
          label="Top auditor"
          value={top?.name.split(" ")[0] ?? "—"}
          sub={top ? `${top.count} audits · ${top.avg}% avg` : undefined}
          tone="warn"
        />
      </div>

      <div className="qms-tab qms-tab--split">
        <QmsCard className="qms-card--chart">
          <QmsSectionTitle
            title="Auditor workload"
            sub="Total audits completed by each QA analyst"
          />
          <QmsChartFrame>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={auditors}
                margin={{ bottom: 48, left: 4, right: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={CHART_COLORS.grid}
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fill: CHART_COLORS.text, fontSize: 10 }}
                  angle={-20}
                  textAnchor="end"
                  interval={0}
                  height={48}
                />
                <YAxis tick={{ fill: CHART_COLORS.text, fontSize: 10 }} />
                <Tooltip {...QMS_CHART_TOOLTIP} content={<QmsChartTooltip />} />
                <Bar
                  dataKey="count"
                  name="Audits"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                >
                  {auditors.map((_, index) => (
                    <Cell
                      key={index}
                      fill={AUDITOR_COLORS[index % AUDITOR_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </QmsChartFrame>
        </QmsCard>

        <QmsCard className="qms-card--chart">
          <QmsSectionTitle
            title="QA-wise quality score"
            sub={`Average quality % · ${sortOrder === "desc" ? "high to low" : "low to high"}`}
          />
          <QmsChartFrame>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={auditors}
                margin={{ bottom: 48, left: 4, right: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={CHART_COLORS.grid}
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fill: CHART_COLORS.text, fontSize: 10 }}
                  angle={-20}
                  textAnchor="end"
                  interval={0}
                  height={48}
                />
                <YAxis
                  domain={[70, 100]}
                  tick={{ fill: CHART_COLORS.text, fontSize: 10 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  {...QMS_CHART_TOOLTIP}
                  content={<QmsChartTooltip suffix="%" />}
                />
                <Bar
                  dataKey="avg"
                  name="Avg quality"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                >
                  {auditors.map((row) => (
                    <Cell key={row.name} fill={scoreHex(row.avg)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </QmsChartFrame>
        </QmsCard>
      </div>

      <QmsCard>
        <QmsSectionTitle title="Auditor details" />
        <DataTablePanel
          pagination={pagination}
          renderTable={(slice) => (
            <table className="ui-table qms-table platform-report-table platform-report-table--expanded">
              <thead>
                <tr>
                  {[
                    "Auditor",
                    "Audits",
                    "Avg QA score",
                    "Pass rate",
                    "Status",
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slice.map((auditor) => (
                  <tr key={auditor.name}>
                    <td className="qms-cell-strong">{auditor.name}</td>
                    <td className="qms-cell-accent">{auditor.count}</td>
                    <td style={{ color: scoreHex(auditor.avg), fontWeight: 800 }}>
                      {auditor.avg}%
                    </td>
                    <td>{auditor.passRate}%</td>
                    <td>
                      <QmsBadge
                        label={
                          auditor.avg >= PASS_RATE_TARGET_PCT
                            ? "On target"
                            : "Below target"
                        }
                        score={auditor.avg}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        />
      </QmsCard>
    </div>
  );
}
