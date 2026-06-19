"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { QmsAnalyticsData } from "@/lib/audit/analytics-metrics";
import { QmsChartTooltip } from "@/components/analytics/qms-chart-tooltip";
import {
  CHART_COLORS,
  QMS_CHART_TOOLTIP,
  QmsBadge,
  QmsCard,
  QmsEmpty,
  QmsSectionTitle,
  QmsSparkline,
  scoreHex,
} from "@/components/analytics/qms-primitives";
import { QmsChartFrame } from "@/components/analytics/qms-chart-frame";
import { ParameterRadarChart } from "@/components/analytics/parameter-radar-chart";
import {
  DataTablePanel,
  usePaginatedRows,
} from "@/components/primitives/data-table-panel";

export function ParametersTab({ data }: { data: QmsAnalyticsData }) {
  const pagination = usePaginatedRows(data.params);
  if (data.params.length === 0) {
    return (
      <QmsEmpty message="No parameter-level data yet. Submit audits to see parameter analytics." />
    );
  }

  const sorted = [...data.params].sort((a, b) => a.score - b.score);
  const avgScore =
    sorted.length > 0
      ? Math.round(
          (sorted.reduce((sum, row) => sum + row.score, 0) / sorted.length) * 10
        ) / 10
      : 0;
  const belowTarget = sorted.filter((row) => row.score < 90).length;
  const chartBottomMargin = sorted.length > 10 ? 108 : sorted.length > 6 ? 88 : 72;

  return (
    <div className="qms-tab qms-params-tab">
      <QmsCard className="qms-card--chart qms-card--radar-featured">
        <QmsSectionTitle
          title="Radar view"
          sub="Parameter coverage map — actual scores vs 90% target"
        />
        <div className="qms-radar-featured__canvas">
          <ParameterRadarChart params={data.params} />
        </div>
      </QmsCard>

      <QmsCard className="qms-card--chart qms-card--param-scores">
        <div className="qms-param-scores__head">
          <QmsSectionTitle
            title="Quality parameter scores"
            sub="All parameters compared against the 90% quality target"
          />
          <div className="qms-param-scores__stats" aria-label="Parameter score summary">
            <div className="qms-param-scores__stat">
              <span className="qms-param-scores__stat-value">{sorted.length}</span>
              <span className="qms-param-scores__stat-label">Parameters</span>
            </div>
            <div className="qms-param-scores__stat">
              <span className="qms-param-scores__stat-value">{avgScore}%</span>
              <span className="qms-param-scores__stat-label">Average score</span>
            </div>
            <div className="qms-param-scores__stat">
              <span
                className="qms-param-scores__stat-value"
                data-tone={belowTarget > 0 ? "warn" : "success"}
              >
                {belowTarget}
              </span>
              <span className="qms-param-scores__stat-label">Below 90%</span>
            </div>
          </div>
        </div>

        <div className="qms-param-scores__legend" aria-hidden>
          <span className="qms-param-scores__legend-item">
            <span className="qms-param-scores__legend-swatch qms-param-scores__legend-swatch--bars" />
            Parameter score
          </span>
          <span className="qms-param-scores__legend-item">
            <span className="qms-param-scores__legend-swatch qms-param-scores__legend-swatch--target" />
            90% target
          </span>
        </div>

        <QmsChartFrame
          className="qms-chart--parameters"
          empty={sorted.length === 0}
          emptyMessage="No scored parameters in this date range."
        >
          <ResponsiveContainer width="100%" height="100%" minHeight={400}>
            <BarChart
              data={sorted}
              margin={{ top: 16, right: 24, left: 4, bottom: chartBottomMargin }}
              barCategoryGap={sorted.length > 14 ? "12%" : "18%"}
              maxBarSize={sorted.length > 16 ? 36 : 48}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={CHART_COLORS.grid}
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
                angle={sorted.length > 8 ? -38 : -28}
                textAnchor="end"
                interval={0}
                height={chartBottomMargin - 8}
                tickMargin={8}
              />
              <YAxis
                domain={[0, 110]}
                width={44}
                tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
                tickCount={6}
              />
              <Tooltip
                {...QMS_CHART_TOOLTIP}
                content={<QmsChartTooltip suffix="%" />}
              />
              <ReferenceLine
                y={90}
                stroke={CHART_COLORS.accent}
                strokeWidth={2}
                strokeDasharray="6 4"
                label={{
                  value: "90% target",
                  position: "insideTopRight",
                  fill: CHART_COLORS.accent,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              />
              <Bar
                dataKey="score"
                name="Score"
                radius={[6, 6, 0, 0]}
                isAnimationActive={false}
              >
                {sorted.map((row) => (
                  <Cell key={row.name} fill={scoreHex(row.score)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </QmsChartFrame>
      </QmsCard>

      <QmsCard>
        <QmsSectionTitle title="Parameter detail table" />
        <DataTablePanel
          pagination={pagination}
          renderTable={(slice) => (
          <table className="ui-table qms-table platform-report-table">
            <thead>
              <tr>
                {[
                  "Parameter",
                  "Avg raw",
                  "Max",
                  "Score %",
                  "Status",
                  "Gap to target",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slice.map((p) => (
                <tr key={p.name}>
                  <td className="qms-cell-strong">{p.name}</td>
                  <td>{p.avg}</td>
                  <td>{p.max}</td>
                  <td>
                    <div className="qms-cell-score">
                      <span style={{ color: scoreHex(p.score), fontWeight: 800 }}>
                        {p.score}%
                      </span>
                      <QmsSparkline value={p.score} />
                    </div>
                  </td>
                  <td>
                    <QmsBadge score={p.score} />
                  </td>
                  <td
                    className={
                      p.score >= 90 ? "qms-cell-positive" : "qms-cell-negative"
                    }
                  >
                    {p.score >= 90
                      ? `+${(p.score - 90).toFixed(1)}%`
                      : `${(p.score - 90).toFixed(1)}%`}
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
