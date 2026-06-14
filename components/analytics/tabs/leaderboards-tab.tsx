"use client";

import { useState } from "react";
import type { LeaderboardAnalytics } from "@/lib/audit/leaderboard-metrics";
import {
  QmsCard,
  QmsEmpty,
  QmsSectionTitle,
  QmsViewToggle,
  scoreHex,
} from "@/components/analytics/qms-primitives";

type LeaderboardsTabProps = {
  data: LeaderboardAnalytics;
};

const VIEWS = [
  { id: "overview", label: "Overview" },
  { id: "agents", label: "Agents" },
  { id: "supervisors", label: "Teams" },
  { id: "auditors", label: "Auditors" },
  { id: "reasons", label: "Reasons" },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];

function LeaderboardTable({
  rows,
  title,
}: {
  rows: LeaderboardAnalytics["agents"];
  title: string;
}) {
  if (rows.length === 0) {
    return <QmsEmpty message={`No ${title.toLowerCase()} data available yet.`} />;
  }

  return (
    <QmsCard>
      <QmsSectionTitle
        title={`${title} rankings`}
        sub="Sorted by average quality score"
      />
      <div className="ui-table-wrap qms-table-scroll">
        <table className="ui-table qms-table platform-leaderboard">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Name</th>
              <th>Avg quality</th>
              <th>Fatal rate</th>
              <th>Fatals</th>
              <th>Audits</th>
              <th>Top fatal reasons</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.name}>
                <td className="qms-cell-rank">
                  {index < 3 ? `${index + 1}` : `#${index + 1}`}
                </td>
                <td className="qms-cell-strong">{row.name}</td>
                <td
                  className="qms-cell-accent"
                  style={{ color: scoreHex(row.quality) }}
                >
                  {row.quality}%
                </td>
                <td
                  className={
                    row.fatalRate > 10
                      ? "qms-cell-negative"
                      : undefined
                  }
                >
                  {row.fatalRate}%
                </td>
                <td className="qms-cell-negative">{row.fatals}</td>
                <td>{row.count}</td>
                <td>
                  <div className="platform-tag-list">
                    {row.fatalDetails.length > 0 ? (
                      row.fatalDetails.slice(0, 2).map((detail) => (
                        <span key={detail} className="platform-tag platform-tag--danger">
                          {detail}
                        </span>
                      ))
                    ) : (
                      <span className="platform-tag platform-tag--muted">
                        Clean
                      </span>
                    )}
                    {row.fatalDetails.length > 2 && (
                      <span className="platform-tag platform-tag--muted">
                        +{row.fatalDetails.length - 2}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </QmsCard>
  );
}

function ParamAreas({
  items,
  tone,
  title,
  sub,
}: {
  items: LeaderboardAnalytics["weakParams"];
  tone: "danger" | "success";
  title: string;
  sub: string;
}) {
  return (
    <QmsCard className={`platform-param-card platform-param-card--${tone}`}>
      <QmsSectionTitle title={title} sub={sub} />
      <div className="platform-param-list">
        {items.length === 0 ? (
          <p className="platform-empty platform-empty--inline">
            No parameter data yet.
          </p>
        ) : (
          items.map((item) => (
            <div key={item.name} className="platform-param-row">
              <div className="platform-param-row__head">
                <span className="platform-param-row__name">
                  {item.name}
                  <em>{item.cat}</em>
                </span>
                <strong
                  style={{
                    color: scoreHex(item.pct),
                  }}
                >
                  {item.pct}%
                </strong>
              </div>
              <div className="platform-param-row__track">
                <div
                  className={`platform-param-row__fill platform-param-row__fill--${tone}`}
                  style={{ width: `${item.pct}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </QmsCard>
  );
}

export function LeaderboardsTab({ data }: LeaderboardsTabProps) {
  const [view, setView] = useState<ViewId>("overview");

  const dataset =
    view === "agents"
      ? data.agents
      : view === "supervisors"
        ? data.supervisors
        : view === "auditors"
          ? data.auditors
          : view === "reasons"
            ? data.reasons
            : [];

  const title =
    view === "agents"
      ? "Agent"
      : view === "supervisors"
        ? "Team"
        : view === "auditors"
          ? "Auditor"
          : view === "reasons"
            ? "Reason"
            : "";

  return (
    <div className="qms-tab">
      <QmsViewToggle
        value={view}
        onChange={(id) => setView(id as ViewId)}
        options={[...VIEWS]}
      />

      {view === "overview" ? (
        <>
          <div className="qms-panels qms-panels--2">
            <ParamAreas
              items={data.weakParams}
              tone="danger"
              title="Parameter drill-down"
              sub="Bottom 5 performing categories"
            />
            <ParamAreas
              items={data.strongParams}
              tone="success"
              title="Excellence zone"
              sub="Top performing compliance parameters"
            />
          </div>
          <LeaderboardTable rows={data.agents} title="Agent" />
        </>
      ) : (
        <LeaderboardTable rows={dataset} title={title} />
      )}
    </div>
  );
}
