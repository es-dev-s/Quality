"use client";

import { useState } from "react";
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
  QmsViewToggle,
} from "@/components/analytics/qms-primitives";
import { QmsChartFrame } from "@/components/analytics/qms-chart-frame";

export function AgentsTab({ data }: { data: QmsAnalyticsData }) {
  const [view, setView] = useState<"bottom" | "top">("bottom");

  if (data.bottom_agents.length === 0 && data.top_agents.length === 0) {
    return (
      <QmsEmpty message="Need at least 3 audits per agent to rank performance." />
    );
  }

  const agents = view === "bottom" ? data.bottom_agents : data.top_agents;
  const chartData =
    view === "top" ? [...data.top_agents].reverse() : data.bottom_agents;

  return (
    <div className="qms-tab">
      <QmsViewToggle
        value={view}
        onChange={(id) => setView(id as "bottom" | "top")}
        options={[
          { id: "bottom", label: "Needs attention" },
          { id: "top", label: "Star performers" },
        ]}
      />

      <div
        className={
          view === "bottom" ? "qms-alert qms-alert--danger" : "qms-alert qms-alert--success"
        }
      >
        <p className="qms-alert__title">
          {view === "bottom"
            ? "Immediate coaching required"
            : "Recognition & best practice sharing"}
        </p>
        <p className="qms-alert__text">
          {view === "bottom"
            ? `These ${data.bottom_agents.length} agents are below the 90% quality target. Schedule targeted coaching sessions.`
            : "These agents consistently deliver outstanding quality. Use their techniques as training benchmarks."}
        </p>
      </div>

      <QmsCard className="qms-card--chart">
        <QmsSectionTitle
          title={
            view === "bottom"
              ? "Bottom agents by quality score"
              : "Top agents by quality score"
          }
          sub="Agents with ≥3 audits"
        />
        <QmsChartFrame>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: 10, right: 60, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
              <XAxis
                dataKey="agent"
                tick={{ fill: CHART_COLORS.text, fontSize: 9 }}
                angle={-30}
                textAnchor="end"
                interval={0}
                height={60}
              />
              <YAxis
                domain={view === "top" ? [88, 100] : [0, 100]}
                tick={{ fill: CHART_COLORS.text, fontSize: 10 }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                {...QMS_CHART_TOOLTIP}
                content={<QmsChartTooltip suffix="%" />}
              />
              {view === "bottom" && (
                <ReferenceLine
                  y={90}
                  stroke={CHART_COLORS.accent}
                  strokeDasharray="5 5"
                />
              )}
              <Bar dataKey="avg" name="Avg score" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {chartData.map((row, index) => (
                  <Cell
                    key={row.agent}
                    fill={
                      view === "bottom"
                        ? CHART_COLORS.red
                        : index === chartData.length - 1
                          ? CHART_COLORS.amber
                          : CHART_COLORS.green
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </QmsChartFrame>
      </QmsCard>

      <QmsCard>
        <div className="ui-table-wrap qms-table-scroll">
          <table className="ui-table qms-table">
            <thead>
              <tr>
                {(view === "bottom"
                  ? ["Agent", "Avg score", "Audits", "Gap to target", "Priority"]
                  : ["Rank", "Agent", "Avg score", "Audits", "Above target", "Award"]
                ).map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agents.map((agent, index) => (
                <tr key={agent.agent}>
                  {view === "top" && (
                    <td className={index < 3 ? "qms-cell-rank" : undefined}>
                      {index === 0
                        ? "1st"
                        : index === 1
                          ? "2nd"
                          : index === 2
                            ? "3rd"
                            : `#${index + 1}`}
                    </td>
                  )}
                  <td className="qms-cell-strong">{agent.agent}</td>
                  <td
                    className={
                      view === "bottom"
                        ? "qms-cell-negative"
                        : "qms-cell-positive"
                    }
                  >
                    {agent.avg}%
                  </td>
                  <td>{agent.count}</td>
                  <td
                    className={
                      view === "bottom"
                        ? "qms-cell-negative"
                        : "qms-cell-positive"
                    }
                  >
                    {view === "bottom"
                      ? `${(agent.avg - 90).toFixed(1)}%`
                      : `+${(agent.avg - 90).toFixed(1)}%`}
                  </td>
                  <td>
                    <QmsBadge
                      label={
                        view === "bottom"
                          ? agent.avg < 60
                            ? "Urgent"
                            : agent.avg < 75
                              ? "High"
                              : "Medium"
                          : agent.avg >= 96
                            ? "Elite"
                            : "Star"
                      }
                      score={agent.avg}
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
