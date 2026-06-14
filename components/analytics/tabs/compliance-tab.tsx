"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { QmsAnalyticsData } from "@/lib/audit/analytics-metrics";
import { QmsChartTooltip } from "@/components/analytics/qms-chart-tooltip";
import {
  CHART_COLORS,
  QmsCard,
  QmsKpiTile,
  QmsSectionTitle,
  QmsSparkline,
} from "@/components/analytics/qms-primitives";

export function ComplianceTab({ data }: { data: QmsAnalyticsData }) {
  const { kpis } = data;
  const feedbackTotal = kpis.fb_done + kpis.fb_pending || 1;
  const complianceRate = Math.round((kpis.fb_done / feedbackTotal) * 100);
  const fatalRate =
    kpis.total_audits > 0
      ? ((kpis.fatal_count / kpis.total_audits) * 100).toFixed(1)
      : "0.0";

  const sevData = [
    { name: "Low", value: kpis.low_count, color: CHART_COLORS.green },
    { name: "Medium", value: kpis.medium_count, color: CHART_COLORS.amber },
    { name: "Critical", value: kpis.critical_count, color: CHART_COLORS.red },
  ].filter((d) => d.value > 0);

  const fbData = [
    { name: "Done", value: kpis.fb_done, color: CHART_COLORS.green },
    { name: "Pending", value: kpis.fb_pending, color: CHART_COLORS.amber },
  ].filter((d) => d.value > 0);

  const criticalParams = data.params.filter((p) => p.score < 80);

  return (
    <div className="qms-tab">
      <div className="qms-kpi-row">
        <QmsKpiTile
          label="Fatal incidents"
          value={kpis.fatal_count}
          sub="Requires root cause analysis"
          tone="danger"
        />
        <QmsKpiTile
          label="Critical issues"
          value={kpis.critical_count}
          sub="Escalate immediately"
          tone="danger"
        />
        <QmsKpiTile
          label="Feedback compliance"
          value={`${complianceRate}%`}
          sub={`${kpis.fb_pending} still pending`}
          tone={complianceRate >= 90 ? "success" : "warn"}
        />
        <QmsKpiTile
          label="Fatal rate"
          value={`${fatalRate}%`}
          sub="Of total audited interactions"
          tone="danger"
        />
      </div>

      <div className="qms-panels qms-panels--3">
        <QmsCard className="qms-card--chart">
          <QmsSectionTitle title="Issue severity breakdown" />
          <div className="qms-chart qms-chart--pie">
            {sevData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sevData}
                    cx="50%"
                    cy="45%"
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {sevData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<QmsChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="qms-empty">No severity data available.</p>
            )}
          </div>
        </QmsCard>

        <QmsCard className="qms-card--chart">
          <QmsSectionTitle title="Feedback completion status" />
          <div className="qms-chart qms-chart--pie">
            {fbData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={fbData}
                    cx="50%"
                    cy="45%"
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {fbData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<QmsChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="qms-empty">No feedback data available.</p>
            )}
          </div>
        </QmsCard>

        <QmsCard>
          <QmsSectionTitle title="Fatal incidents by team" />
          <div className="qms-fatal-list">
            {data.fatal_by_team.length === 0 ? (
              <p className="qms-empty">No fatal incidents recorded.</p>
            ) : (
              data.fatal_by_team.map((item) => (
                <div key={item.team} className="qms-fatal-list__row">
                  <span className="qms-fatal-list__count">{item.count}</span>
                  <div className="qms-fatal-list__body">
                    <p className="qms-fatal-list__team">{item.team}</p>
                    <div className="qms-fatal-list__track">
                      <div
                        className="qms-fatal-list__fill"
                        style={{
                          width: `${(item.count / (data.fatal_by_team[0]?.count || 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </QmsCard>
      </div>

      {criticalParams.length > 0 && (
        <QmsCard>
          <QmsSectionTitle
            title="Parameters needing immediate attention"
            sub="Scored below 80% — critical coaching areas"
          />
          <div className="qms-param-alert-grid">
            {criticalParams.map((p) => (
              <div key={p.name} className="qms-param-alert">
                <p className="qms-param-alert__score">{p.score}%</p>
                <p className="qms-param-alert__name">{p.name}</p>
                <p className="qms-param-alert__gap">
                  Gap: {(p.score - 90).toFixed(1)}%
                </p>
                <QmsSparkline value={p.score} />
              </div>
            ))}
          </div>
        </QmsCard>
      )}
    </div>
  );
}
