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
  QmsBadge,
  QmsCard,
  QmsEmpty,
  QmsKpiTile,
  QmsSectionTitle,
  QmsViewToggle,
  scoreHex,
} from "@/components/analytics/qms-primitives";

export function TeamsTab({ data }: { data: QmsAnalyticsData }) {
  const [view, setView] = useState("chart");

  if (data.teams.length === 0) {
    return (
      <QmsEmpty message="No team data yet. Audits need supervisor/team assignments." />
    );
  }

  const above90 = data.teams.filter((t) => t.avg >= 90).length;
  const below90 = data.teams.filter((t) => t.avg < 90).length;
  const topTeam = data.teams[0];
  const weakTeam = data.teams[data.teams.length - 1];
  const chartData = [...data.teams].reverse();

  return (
    <div className="qms-tab">
      <div className="qms-kpi-row">
        <QmsKpiTile
          label="Teams above target"
          value={above90}
          sub="≥ 90% quality score"
          tone="success"
        />
        <QmsKpiTile
          label="Teams below target"
          value={below90}
          sub="< 90% — needs coaching"
          tone="danger"
        />
        <QmsKpiTile
          label="Top team"
          value={topTeam.team}
          sub={`${topTeam.avg}% avg quality`}
          tone="warn"
          compact
        />
        <QmsKpiTile
          label="Weakest team"
          value={weakTeam.team}
          sub={`${weakTeam.avg}% avg quality`}
          tone="danger"
          compact
        />
      </div>

      <QmsViewToggle
        value={view}
        onChange={setView}
        options={[
          { id: "chart", label: "Chart view" },
          { id: "table", label: "Table view" },
        ]}
      />

      {view === "chart" ? (
        <QmsCard className="qms-card--chart">
          <QmsSectionTitle
            title="Team performance ranking"
            sub="Sorted by average quality score"
          />
          <div className="qms-chart qms-chart--xl">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 120, right: 50 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  domain={[70, 100]}
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="team"
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  width={115}
                />
                <Tooltip content={<QmsChartTooltip suffix="%" />} />
                <ReferenceLine
                  x={90}
                  stroke="#3b82f6"
                  strokeDasharray="5 5"
                />
                <Bar dataKey="avg" name="Avg score" radius={[0, 4, 4, 0]}>
                  {chartData.map((row) => (
                    <Cell key={row.team} fill={scoreHex(row.avg)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </QmsCard>
      ) : (
        <QmsCard>
          <QmsSectionTitle title="Team performance table" />
          <div className="ui-table-wrap qms-table-scroll">
            <table className="ui-table qms-table">
              <thead>
                <tr>
                  {["Rank", "Team", "Avg score", "Audits", "Status", "Gap"].map(
                    (h) => (
                      <th key={h}>{h}</th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {data.teams.map((team, index) => (
                  <tr key={team.team}>
                    <td className={index < 3 ? "qms-cell-rank" : undefined}>
                      {index === 0
                        ? "1st"
                        : index === 1
                          ? "2nd"
                          : index === 2
                            ? "3rd"
                            : `#${index + 1}`}
                    </td>
                    <td className="qms-cell-strong">{team.team}</td>
                    <td style={{ color: scoreHex(team.avg), fontWeight: 800 }}>
                      {team.avg}%
                    </td>
                    <td>{team.count}</td>
                    <td>
                      <QmsBadge
                        label={team.avg >= 90 ? "On target" : "Below target"}
                        score={team.avg}
                      />
                    </td>
                    <td
                      className={
                        team.avg >= 90
                          ? "qms-cell-positive"
                          : "qms-cell-negative"
                      }
                    >
                      {team.avg >= 90
                        ? `+${(team.avg - 90).toFixed(1)}%`
                        : `${(team.avg - 90).toFixed(1)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </QmsCard>
      )}
    </div>
  );
}
