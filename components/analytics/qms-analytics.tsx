"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import type { AnalyticsPageData } from "@/lib/actions/analytics";
import { summaryChipClass } from "@/lib/audit/analytics-metrics";
import { AgentsTab } from "@/components/analytics/tabs/agents-tab";
import { AuditorsTab } from "@/components/analytics/tabs/auditors-tab";
import { ComplianceTab } from "@/components/analytics/tabs/compliance-tab";
import { OverviewTab } from "@/components/analytics/tabs/overview-tab";
import { ParametersTab } from "@/components/analytics/tabs/parameters-tab";
import { TeamsTab } from "@/components/analytics/tabs/teams-tab";
import { LeaderboardsTab } from "@/components/analytics/tabs/leaderboards-tab";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "parameters", label: "Parameters" },
  { id: "teams", label: "Teams" },
  { id: "agents", label: "Agents" },
  { id: "compliance", label: "Compliance" },
  { id: "auditors", label: "Auditors" },
  { id: "leaderboards", label: "Leaderboards" },
] as const;

type TabId = (typeof TABS)[number]["id"];

type QmsAnalyticsProps = {
  data: AnalyticsPageData;
};

export function QmsAnalytics({ data }: QmsAnalyticsProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("overview");
  const [isRefreshing, startRefresh] = useTransition();

  const analytics = useMemo(
    () => ({
      kpis: data.kpis,
      params: data.params,
      teams: data.teams,
      bottom_agents: data.bottom_agents,
      top_agents: data.top_agents,
      auditors: data.auditors,
      fatal_by_team: data.fatal_by_team,
      leaderboards: data.leaderboards,
    }),
    [data]
  );

  function handleRefresh() {
    startRefresh(() => router.refresh());
  }

  return (
    <div className="qms-analytics">
      <div className="qms-toolbar">
        <div className="qms-toolbar__row">
          <div className="qms-analytics__summary">
            <span
              className={`qms-summary-chip ${summaryChipClass(data.kpis.overall_avg)}`}
            >
              {data.kpis.overall_avg}% overall
            </span>
            <span className="qms-summary-chip qms-summary-chip--danger">
              {data.kpis.fatal_count} fatals
            </span>
            <span className="qms-summary-chip qms-summary-chip--muted">
              {data.kpis.total_audits.toLocaleString()} audits
            </span>
          </div>
          <button
            type="button"
            className="dash-refresh"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={isRefreshing ? "dash-refresh__icon--spin" : undefined}
              size={15}
              aria-hidden
            />
            Refresh
          </button>
        </div>
        <div className="qms-tabs" role="tablist" aria-label="Analytics sections">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={
                tab === item.id
                  ? "qms-tabs__btn qms-tabs__btn--active"
                  : "qms-tabs__btn"
              }
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="qms-analytics__body">
        {tab === "overview" && <OverviewTab data={analytics} />}
        {tab === "parameters" && <ParametersTab data={analytics} />}
        {tab === "teams" && <TeamsTab data={analytics} />}
        {tab === "agents" && <AgentsTab data={analytics} />}
        {tab === "compliance" && <ComplianceTab data={analytics} />}
        {tab === "auditors" && <AuditorsTab data={analytics} />}
        {tab === "leaderboards" && (
          <LeaderboardsTab data={analytics.leaderboards} />
        )}
      </div>

      <footer className="qms-analytics__footer">
        Quality analytics · {data.kpis.total_audits.toLocaleString()} audits
        analyzed · {data.auditors.length} auditors · Internal use only
      </footer>
    </div>
  );
}
