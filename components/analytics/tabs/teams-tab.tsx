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

type TeamsTabProps = {
  data: QmsAnalyticsData;
  sortOrder: AnalyticsSortOrder;
};

export function TeamsTab({ data, sortOrder }: TeamsTabProps) {
  const [view, setView] = useState<"summary" | "parameter" | "category">(
    "summary"
  );
  const [layout, setLayout] = useState<"chart" | "table">("chart");

  const teams = useMemo(
    () => sortByNumber(data.teams, (team) => team.count, sortOrder),
    [data.teams, sortOrder]
  );
  const pagination = usePaginatedRows(teams);

  const topTeam = useMemo(
    () => sortByNumber(data.teams, (team) => team.count, "desc")[0],
    [data.teams]
  );
  const weakTeam = useMemo(
    () => sortByNumber(data.teams, (team) => team.count, "asc")[0],
    [data.teams]
  );

  if (data.teams.length === 0) {
    return (
      <QmsEmpty message="No team data yet. Audits need supervisor/team assignments." />
    );
  }

  if (view !== "summary") {
    return (
      <div className="qms-tab">
        <QmsViewToggle
          value={view}
          onChange={(id) => setView(id as "summary" | "parameter" | "category")}
          options={[
            { id: "summary", label: "Summary" },
            { id: "parameter", label: "Parameter wise" },
            { id: "category", label: "Category wise" },
          ]}
        />
        <EntityBreakdownTable
          rows={
            view === "parameter"
              ? data.team_param_breakdown
              : data.team_cat_breakdown
          }
          entityLabel="Team lead (TL)"
          metricLabel={view === "parameter" ? "Parameter" : "Category"}
          sortOrder={sortOrder}
          title={
            view === "parameter"
              ? "Team lead — parameter wise"
              : "Team lead — category wise"
          }
          sub="Average score per supervisor and rubric segment"
        />
      </div>
    );
  }

  const above90 = teams.filter((t) => t.avg >= 90).length;
  const below90 = teams.filter((t) => t.avg < 90).length;

  return (
    <div className="qms-tab">
      <QmsViewToggle
        value={view}
        onChange={(id) => setView(id as "summary" | "parameter" | "category")}
        options={[
          { id: "summary", label: "Summary" },
          { id: "parameter", label: "Parameter wise" },
          { id: "category", label: "Category wise" },
        ]}
      />

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
          value={topTeam?.team ?? "—"}
          sub={topTeam ? `${topTeam.count} audit${topTeam.count === 1 ? "" : "s"}` : undefined}
          tone="warn"
          compact
        />
        <QmsKpiTile
          label="Weakest team"
          value={weakTeam?.team ?? "—"}
          sub={
            weakTeam
              ? `${weakTeam.count} audit${weakTeam.count === 1 ? "" : "s"}`
              : undefined
          }
          tone="danger"
          compact
        />
      </div>

      <QmsViewToggle
        value={layout}
        onChange={(id) => setLayout(id as "chart" | "table")}
        options={[
          { id: "chart", label: "Chart view" },
          { id: "table", label: "Table view" },
        ]}
      />

      {layout === "chart" ? (
        <QmsCard className="qms-card--chart">
          <QmsSectionTitle
            title="Team audit volume ranking"
            sub={`Sorted ${sortOrder === "desc" ? "most to fewest audits" : "fewest to most audits"}`}
          />
          <QmsChartFrame className="qms-chart--xl">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teams} margin={{ bottom: 48, left: 4, right: 8 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={CHART_COLORS.grid}
                  vertical={false}
                />
                <XAxis
                  dataKey="team"
                  tick={{ fill: CHART_COLORS.text, fontSize: 10 }}
                  angle={-25}
                  textAnchor="end"
                  interval={0}
                  height={56}
                />
                <YAxis
                  domain={[0, "auto"]}
                  tick={{ fill: CHART_COLORS.text, fontSize: 10 }}
                  allowDecimals={false}
                />
                <Tooltip
                  {...QMS_CHART_TOOLTIP}
                  content={<QmsChartTooltip suffix=" audits" />}
                />
                <Bar
                  dataKey="count"
                  name="Audits"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                >
                  {teams.map((row) => (
                    <Cell key={row.team} fill={CHART_COLORS.green} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </QmsChartFrame>
        </QmsCard>
      ) : (
        <QmsCard>
          <QmsSectionTitle title="Team audit volume table" />
          <DataTablePanel
            pagination={pagination}
            renderTable={(slice) => (
              <table className="ui-table qms-table platform-report-table platform-report-table--expanded">
                <thead>
                  <tr>
                    {["Rank", "Team", "Audits", "Avg score", "Status", "Gap"].map(
                      (h) => (
                        <th key={h}>{h}</th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {slice.map((team, index) => {
                    const rank = pagination.start + index - 1;
                    return (
                      <tr key={team.team}>
                        <td className={rank < 3 ? "qms-cell-rank" : undefined}>
                          {rank === 0
                            ? "1st"
                            : rank === 1
                              ? "2nd"
                              : rank === 2
                                ? "3rd"
                                : `#${rank + 1}`}
                        </td>
                        <td className="qms-cell-strong">{team.team}</td>
                        <td>{team.count}</td>
                        <td style={{ color: scoreHex(team.avg), fontWeight: 800 }}>
                          {team.avg}%
                        </td>
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
                    );
                  })}
                </tbody>
              </table>
            )}
          />
        </QmsCard>
      )}
    </div>
  );
}
