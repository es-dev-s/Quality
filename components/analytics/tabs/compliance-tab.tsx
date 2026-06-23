"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { QmsAnalyticsData } from "@/lib/audit/analytics-metrics";
import type { AnalyticsSortOrder } from "@/lib/audit/analytics-sort";
import { QmsChartTooltip } from "@/components/analytics/qms-chart-tooltip";
import {
  CHART_COLORS,
  QMS_CHART_TOOLTIP,
  QmsCard,
  QmsEmpty,
  QmsKpiTile,
  QmsSectionTitle,
  QmsSparkline,
} from "@/components/analytics/qms-primitives";
import { QmsChartFrame } from "@/components/analytics/qms-chart-frame";

export function ComplianceTab({
  data,
  sortOrder: _sortOrder,
}: {
  data: QmsAnalyticsData;
  sortOrder: AnalyticsSortOrder;
}) {
  const { kpis } = data;
  const feedbackTotal = kpis.fb_done + kpis.fb_pending + kpis.fb_disputed;
  const complianceRate =
    feedbackTotal > 0
      ? Math.round((kpis.fb_done / feedbackTotal) * 100)
      : 0;
  const fatalRate =
    kpis.total_audits > 0
      ? ((kpis.fatal_count / kpis.total_audits) * 100).toFixed(1)
      : "0.0";

  const sevData = [
    { name: "Critical", value: kpis.issue_sev_critical, color: CHART_COLORS.red },
    { name: "Medium", value: kpis.issue_sev_medium, color: CHART_COLORS.amber },
    { name: "Low", value: kpis.issue_sev_low, color: CHART_COLORS.green },
  ].filter((d) => d.value > 0);

  const fbData = [
    { name: "Completed", value: kpis.fb_done, color: CHART_COLORS.green },
    { name: "Pending", value: kpis.fb_pending, color: CHART_COLORS.amber },
    { name: "Disputed", value: kpis.fb_disputed, color: CHART_COLORS.red },
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
          label="Critical severity"
          value={kpis.issue_sev_critical}
          sub={`Medium: ${kpis.issue_sev_medium} · Low: ${kpis.issue_sev_low}`}
          tone="danger"
        />
        <QmsKpiTile
          label="Feedback compliance"
          value={`${complianceRate}%`}
          sub={`${kpis.fb_pending} pending · ${kpis.fb_disputed} disputed`}
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
          <QmsChartFrame
            className="qms-chart--pie"
            empty={sevData.length === 0}
            emptyMessage={
              kpis.issue_sev_na > 0
                ? "No Low/Medium/Critical ratings yet — audits are marked N/A."
                : "No severity data available."
            }
          >
            <ResponsiveContainer width="100%" height="100%" minHeight={220}>
              <PieChart>
                <Pie
                  data={sevData}
                  cx="50%"
                  cy="45%"
                  outerRadius={90}
                  dataKey="value"
                  minAngle={8}
                  label={({ name, percent }) =>
                    (percent ?? 0) >= 0.08
                      ? `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                      : ""
                  }
                  labelLine={false}
                  isAnimationActive={false}
                >
                  {sevData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  {...QMS_CHART_TOOLTIP}
                  content={<QmsChartTooltip />}
                />
              </PieChart>
            </ResponsiveContainer>
          </QmsChartFrame>
        </QmsCard>

        <QmsCard className="qms-card--chart">
          <QmsSectionTitle title="Feedback completion status" />
          <QmsChartFrame
            className="qms-chart--pie"
            empty={fbData.length === 0}
            emptyMessage="No feedback data available."
          >
            <ResponsiveContainer width="100%" height="100%" minHeight={220}>
              <PieChart>
                <Pie
                  data={fbData}
                  cx="50%"
                  cy="45%"
                  outerRadius={90}
                  dataKey="value"
                  minAngle={8}
                  label={({ name, percent }) =>
                    (percent ?? 0) >= 0.08
                      ? `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                      : ""
                  }
                  labelLine={false}
                  isAnimationActive={false}
                >
                  {fbData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  {...QMS_CHART_TOOLTIP}
                  content={<QmsChartTooltip />}
                />
              </PieChart>
            </ResponsiveContainer>
          </QmsChartFrame>
        </QmsCard>

        <QmsCard>
          <QmsSectionTitle title="Fatal incidents by team" />
          <div className="qms-fatal-list">
            {data.fatal_by_team.length === 0 ? (
              <QmsEmpty message="No fatal incidents recorded." />
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
