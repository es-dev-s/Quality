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
import { QmsChartTooltip } from "@/components/analytics/qms-chart-tooltip";
import {
  CHART_COLORS,
  QmsBadge,
  QmsCard,
  QmsEmpty,
  QmsKpiTile,
  QmsSectionTitle,
} from "@/components/analytics/qms-primitives";

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
  const maxCount = top?.count || 1;

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
          label="Avg per auditor"
          value={Math.round(total / data.auditors.length)}
          sub="Audits per person"
          tone="warn"
        />
        <QmsKpiTile
          label="Top auditor"
          value={top.name.split(" ")[0]}
          sub={`${top.count} audits completed`}
          tone="success"
        />
      </div>

      <QmsCard className="qms-card--chart">
        <QmsSectionTitle
          title="Auditor workload distribution"
          sub="Total audits completed by each QA analyst"
        />
        <div className="qms-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.auditors} margin={{ bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis
                dataKey="name"
                tick={{ fill: CHART_COLORS.text, fontSize: 10 }}
                angle={-20}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fill: CHART_COLORS.text, fontSize: 10 }} />
              <Tooltip content={<QmsChartTooltip />} />
              <Bar dataKey="count" name="Audits" radius={[4, 4, 0, 0]}>
                {data.auditors.map((_, index) => (
                  <Cell
                    key={index}
                    fill={AUDITOR_COLORS[index % AUDITOR_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </QmsCard>

      <QmsCard>
        <QmsSectionTitle title="Auditor details" />
        <div className="ui-table-wrap qms-table-scroll">
          <table className="ui-table qms-table">
            <thead>
              <tr>
                {[
                  "Auditor",
                  "Audits completed",
                  "% of total",
                  "Workload share",
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
                  <td>{((auditor.count / total) * 100).toFixed(1)}%</td>
                  <td className="qms-cell-bar">
                    <div className="qms-inline-bar">
                      <div
                        className="qms-inline-bar__fill"
                        style={{
                          width: `${(auditor.count / maxCount) * 100}%`,
                        }}
                      />
                    </div>
                  </td>
                  <td>
                    <QmsBadge
                      label={
                        auditor.count > 160
                          ? "Heavy"
                          : auditor.count > 120
                            ? "Normal"
                            : "Light"
                      }
                      score={auditor.count > 120 ? 90 : 75}
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
