"use client";

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
import { QmsChartTooltip } from "@/components/analytics/qms-chart-tooltip";
import {
  CHART_COLORS,
  QMS_CHART_TOOLTIP,
  QmsBadge,
  QmsCard,
  QmsEmpty,
  QmsKpiTile,
  QmsSectionTitle,
  scoreHex,
} from "@/components/analytics/qms-primitives";
import { QmsChartFrame } from "@/components/analytics/qms-chart-frame";

const AUDITOR_COLORS = [
  CHART_COLORS.accent,
  CHART_COLORS.purple,
  CHART_COLORS.green,
  CHART_COLORS.amber,
  CHART_COLORS.red,
  CHART_COLORS.accent,
  CHART_COLORS.purple,
];

export function AuditorsTab({ data }: { data: QmsAnalyticsData }) {
  if (data.auditors.length === 0) {
    return <QmsEmpty message="No auditor workload data yet." />;
  }

  const total = data.auditors.reduce((sum, a) => sum + a.count, 0);
  const top = data.auditors[0];
  const avgQuality =
    data.auditors.length > 0
      ? Math.round(
          data.auditors.reduce((sum, a) => sum + a.avg, 0) /
            data.auditors.length
        )
      : 0;

  return (
    <div className="qms-tab">
      <div className="qms-kpi-row">
        <QmsKpiTile
          label="Active auditors"
          value={data.auditors.length}
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
          value={top.name.split(" ")[0]}
          sub={`${top.count} audits · ${top.avg}% avg`}
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
                data={data.auditors}
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
                  {data.auditors.map((_, index) => (
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
            sub="Average quality % per auditor"
          />
          <QmsChartFrame>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.auditors}
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
                  {data.auditors.map((row) => (
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
        <div className="ui-table-wrap qms-table-scroll">
          <table className="ui-table qms-table">
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
              {data.auditors.map((auditor) => (
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
        </div>
      </QmsCard>
    </div>
  );
}
