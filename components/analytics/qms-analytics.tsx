"use client";

import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { FilterChipBar } from "@/components/filters/filter-chip-bar";
import { FilterClearButton } from "@/components/filters/filter-clear-button";
import { FilterTriggerButton } from "@/components/filters/filter-trigger-button";
import {
  FilterSidebar,
  FilterSidebarSection,
} from "@/components/filters/filter-sidebar";
import { useFilterSidebar } from "@/lib/hooks/use-filter-sidebar";
import { useBusyAction } from "@/lib/hooks/use-busy-action";
import { getAnalyticsData, type AnalyticsPageData } from "@/lib/actions/analytics";
import { summaryChipClass } from "@/lib/audit/analytics-metrics";
import { LoadingZone } from "@/components/primitives/loading-zone";
import { DateRangePicker, type DateRangeValue } from "@/components/primitives/date-range-picker";
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

export function QmsAnalytics({ data: initialData }: QmsAnalyticsProps) {
  const [tab, setTab] = useState<TabId>("overview");
  const [liveData, setLiveData] = useState<AnalyticsPageData | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeValue>({ from: "", to: "" });
  const filterSidebar = useFilterSidebar();
  const { busy: isLoading, run: runBusy } = useBusyAction();
  const [error, setError] = useState<string | null>(null);

  const data = liveData ?? initialData;
  const hasDateFilter = !!(dateRange.from || dateRange.to);

  function applyDateRange(range: DateRangeValue) {
    setDateRange(range);
    if (!range.from && !range.to) {
      setLiveData(null);
      setError(null);
      return;
    }
    setError(null);
    runBusy(async () => {
      try {
        const result = await getAnalyticsData(range.from || undefined, range.to || undefined);
        setLiveData(result);
      } catch {
        setError("Failed to load analytics for this date range.");
      }
    });
  }

  function clearDateRange() {
    applyDateRange({ from: "", to: "" });
  }

  function handleRefresh() {
    runBusy(async () => {
      try {
        const result = await getAnalyticsData(
          dateRange.from || undefined,
          dateRange.to || undefined
        );
        setLiveData(result);
        setError(null);
      } catch {
        setError("Refresh failed.");
      }
    });
  }

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

  return (
    <div className="qms-analytics">

      <div className="pf-panel">
        <div className="pf-bar">
          <div className="pf-bar__left">
            <span className={`qms-summary-chip ${summaryChipClass(data.kpis.overall_avg)}`}>
              {data.kpis.overall_avg}% overall
            </span>
            <span className="qms-summary-chip qms-summary-chip--danger">
              {data.kpis.fatal_count} fatals
            </span>
            <span className="qms-summary-chip qms-summary-chip--muted">
              {data.kpis.total_audits.toLocaleString()} audits
              {hasDateFilter && <span style={{ fontWeight: 500, opacity: 0.75 }}> (filtered)</span>}
            </span>
            <div className="pf-bar__chips">
              <FilterChipBar
                inline
                showClearButton={false}
                chips={
                  hasDateFilter
                    ? [
                        {
                          key: "date",
                          label: [dateRange.from, dateRange.to].filter(Boolean).join(" — "),
                          onRemove: clearDateRange,
                        },
                      ]
                    : []
                }
              />
            </div>
          </div>

          <div className="pf-bar__right">
            <div className="pf-bar__filter-actions">
              {hasDateFilter ? <FilterClearButton onClick={clearDateRange} /> : null}
              <FilterTriggerButton
                activeCount={hasDateFilter ? 1 : 0}
                onClick={filterSidebar.openFilters}
              />
            </div>
            <button
              type="button"
              className="pf-refresh"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw
                className={isLoading ? "pf-refresh__icon--spin" : undefined}
                size={14}
                aria-hidden
              />
              {isLoading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        {error ? <p className="pf-error" role="alert">{error}</p> : null}
      </div>

      <FilterSidebar
        open={filterSidebar.open}
        onOpenChange={filterSidebar.onOpenChange}
        title="Analytics filters"
        description="Choose a date range for all analytics tabs."
        activeCount={hasDateFilter ? 1 : 0}
        onClearAll={clearDateRange}
        clearDisabled={!hasDateFilter}
        footer={
          <button
            type="button"
            className="ui-btn ui-btn--primary ui-btn--sm"
            onClick={() => filterSidebar.closeFilters()}
          >
            Done
          </button>
        }
      >
        <FilterSidebarSection label="Date range">
          <DateRangePicker value={dateRange} onChange={applyDateRange} label="" />
        </FilterSidebarSection>
      </FilterSidebar>

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div className="qms-toolbar">
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

      <LoadingZone
        loading={isLoading}
        label="Loading analytics…"
        className="qms-analytics__body loading-zone--min"
      >
        {tab === "overview" && <OverviewTab data={analytics} />}
        {tab === "parameters" && <ParametersTab data={analytics} />}
        {tab === "teams" && <TeamsTab data={analytics} />}
        {tab === "agents" && <AgentsTab data={analytics} />}
        {tab === "compliance" && <ComplianceTab data={analytics} />}
        {tab === "auditors" && <AuditorsTab data={analytics} />}
        {tab === "leaderboards" && (
          <LeaderboardsTab data={analytics.leaderboards} />
        )}
      </LoadingZone>

      <footer className="qms-analytics__footer">
        Quality analytics · {data.kpis.total_audits.toLocaleString()} audits
        · {data.auditors.length} auditors
        {hasDateFilter && ` · ${dateRange.from || "…"} → ${dateRange.to || "…"}`}
        {" · "}Internal use only
      </footer>
    </div>
  );
}
