"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
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
  QmsBadge,
  QmsCard,
  QmsEmpty,
  QmsSectionTitle,
  QmsSparkline,
  scoreHex,
} from "@/components/analytics/qms-primitives";

export function ParametersTab({ data }: { data: QmsAnalyticsData }) {
  if (data.params.length === 0) {
    return (
      <QmsEmpty message="No parameter-level data yet. Submit audits to see parameter analytics." />
    );
  }

  const sorted = [...data.params].sort((a, b) => a.score - b.score);
  const radarData = data.params.map((p) => ({
    subject: p.name.length > 14 ? `${p.name.slice(0, 14)}…` : p.name,
    A: p.score,
  }));

  return (
    <div className="qms-tab">
      <div className="qms-panels qms-panels--2">
        <QmsCard className="qms-card--chart">
          <QmsSectionTitle
            title="Quality parameter scores"
            sub="All parameters vs 90% target"
          />
          <div className="qms-chart qms-chart--tall">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sorted} margin={{ top: 10, right: 20, left: 0, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: CHART_COLORS.text, fontSize: 10 }}
                  angle={-40}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  domain={[0, 110]}
                  tick={{ fill: CHART_COLORS.text, fontSize: 10 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<QmsChartTooltip suffix="%" />} />
                <ReferenceLine
                  y={90}
                  stroke={CHART_COLORS.accent}
                  strokeDasharray="5 5"
                />
                <Bar dataKey="score" name="Score" radius={[4, 4, 0, 0]}>
                  {sorted.map((row) => (
                    <Cell key={row.name} fill={scoreHex(row.score)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </QmsCard>

        <QmsCard className="qms-card--chart">
          <QmsSectionTitle title="Radar view" sub="Parameter coverage map" />
          <div className="qms-chart qms-chart--tall">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke={CHART_COLORS.grid} />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: CHART_COLORS.text, fontSize: 9 }}
                />
                <Radar
                  name="Score"
                  dataKey="A"
                  stroke={CHART_COLORS.accent}
                  fill={CHART_COLORS.accent}
                  fillOpacity={0.2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </QmsCard>
      </div>

      <QmsCard>
        <QmsSectionTitle title="Parameter detail table" />
        <div className="ui-table-wrap qms-table-scroll">
          <table className="ui-table qms-table">
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
              {data.params.map((p) => (
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
        </div>
      </QmsCard>
    </div>
  );
}
