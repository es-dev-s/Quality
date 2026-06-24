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
  QmsSectionTitle,
  QmsViewToggle,
} from "@/components/analytics/qms-primitives";
import { QmsChartFrame } from "@/components/analytics/qms-chart-frame";
import {
  DataTablePanel,
  usePaginatedRows,
} from "@/components/primitives/data-table-panel";

type AgentsTabProps = {
  data: QmsAnalyticsData;
  sortOrder: AnalyticsSortOrder;
};

export function AgentsTab({ data, sortOrder }: AgentsTabProps) {
  const [view, setView] = useState<"summary" | "parameter" | "category">(
    "summary"
  );
  const [performance, setPerformance] = useState<"bottom" | "top">("bottom");

  const agents = useMemo(() => {
    const source =
      performance === "bottom" ? data.bottom_agents : data.top_agents;
    return sortByNumber(source, (agent) => agent.count, sortOrder);
  }, [data.bottom_agents, data.top_agents, performance, sortOrder]);

  const pagination = usePaginatedRows(agents);

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

  if (view !== "summary") {
    if (
      (view === "parameter" && data.agent_param_breakdown.length === 0) ||
      (view === "category" && data.agent_cat_breakdown.length === 0)
    ) {
      return (
        <div className="qms-tab">
          {viewToggle}
          <QmsEmpty message="No agent breakdown data yet." />
        </div>
      );
    }

    return (
      <div className="qms-tab">
        {viewToggle}
        <EntityBreakdownTable
          rows={
            view === "parameter"
              ? data.agent_param_breakdown
              : data.agent_cat_breakdown
          }
          entityLabel="Agent"
          metricLabel={view === "parameter" ? "Parameter" : "Category"}
          sortOrder={sortOrder}
          title={
            view === "parameter"
              ? "Agent — parameter wise"
              : "Agent — category wise"
          }
          sub="Average score per agent and rubric segment"
        />
      </div>
    );
  }

  if (data.bottom_agents.length === 0 && data.top_agents.length === 0) {
    return (
      <QmsEmpty message="Need at least 3 audits per agent to rank performance." />
    );
  }

  const chartData =
    sortOrder === "asc" ? agents : [...agents].reverse();

  return (
    <div className="qms-tab">
      {viewToggle}

      <QmsViewToggle
        value={performance}
        onChange={(id) => setPerformance(id as "bottom" | "top")}
        options={[
          { id: "bottom", label: "Needs attention" },
          { id: "top", label: "Star performers" },
        ]}
      />

      <div
        className={
          performance === "bottom"
            ? "qms-alert qms-alert--danger"
            : "qms-alert qms-alert--success"
        }
      >
        <p className="qms-alert__title">
          {performance === "bottom"
            ? "Lowest audit volume"
            : "Highest audit volume"}
        </p>
        <p className="qms-alert__text">
          {performance === "bottom"
            ? `These ${data.bottom_agents.length} agents have the fewest completed audits in scope. Review coaching coverage and audit volume.`
            : "These agents have the highest audit volume in scope. Use their workload patterns as benchmarks."}
        </p>
      </div>

      <QmsCard className="qms-card--chart">
        <QmsSectionTitle
          title={
            performance === "bottom"
              ? "Bottom agents by audit volume"
              : "Top agents by audit volume"
          }
          sub={`Agents with ≥3 audits · ${sortOrder === "desc" ? "most to fewest" : "fewest to most"}`}
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
                domain={[0, "auto"]}
                tick={{ fill: CHART_COLORS.text, fontSize: 10 }}
                allowDecimals={false}
              />
              <Tooltip
                {...QMS_CHART_TOOLTIP}
                content={<QmsChartTooltip suffix=" audits" />}
              />
              <Bar dataKey="count" name="Audits" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {chartData.map((row, index) => (
                  <Cell
                    key={row.agent}
                    fill={
                      performance === "bottom"
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
        <DataTablePanel
          pagination={pagination}
          renderTable={(slice) => (
            <table className="ui-table qms-table platform-report-table platform-report-table--expanded">
              <thead>
                <tr>
                  {(performance === "bottom"
                    ? ["Agent", "Audits", "Avg score", "Priority"]
                    : ["Rank", "Agent", "Audits", "Avg score", "Award"]
                  ).map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slice.map((agent, index) => {
                  const rank = pagination.start + index - 1;
                  return (
                    <tr key={agent.agent}>
                      {performance === "top" && (
                        <td className={rank < 3 ? "qms-cell-rank" : undefined}>
                          {rank === 0
                            ? "1st"
                            : rank === 1
                              ? "2nd"
                              : rank === 2
                                ? "3rd"
                                : `#${rank + 1}`}
                        </td>
                      )}
                      <td className="qms-cell-strong">{agent.agent}</td>
                      <td>{agent.count}</td>
                      <td
                        className={
                          performance === "bottom"
                            ? "qms-cell-negative"
                            : "qms-cell-positive"
                        }
                      >
                        {agent.avg}%
                      </td>
                      <td>
                        <QmsBadge
                          label={
                            performance === "bottom"
                              ? agent.count <= 3
                                ? "Low volume"
                                : agent.count <= 5
                                  ? "Monitor"
                                  : "Review"
                              : agent.count >= 20
                                ? "High volume"
                                : "Active"
                          }
                          score={agent.avg}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        />
      </QmsCard>
    </div>
  );
}
