"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown, RefreshCw, SlidersHorizontal, X } from "lucide-react";
import { getAnalyticsData, type AnalyticsPageData } from "@/lib/actions/analytics";
import { summaryChipClass } from "@/lib/audit/analytics-metrics";
import { cn } from "@/lib/utils";
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isLoading, startTransition] = useTransition();
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
    startTransition(async () => {
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
    startTransition(async () => {
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

      {/* ── Filter panel ───────────────────────────────────── */}
      <div className={cn("pf-panel", filtersOpen && "pf-panel--open")}>

        {/* Bar row */}
        <div className="pf-bar">
          {/* Summary chips — always visible */}
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
          </div>

          {/* Right actions */}
          <div className="pf-bar__right">
            <button
              type="button"
              className={cn(
                "pf-toggle",
                filtersOpen && "pf-toggle--open",
                hasDateFilter && "pf-toggle--active"
              )}
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
            >
              <SlidersHorizontal size={14} aria-hidden />
              <span>Filters</span>
              {!filtersOpen && hasDateFilter && (
                <span className="pf-toggle__badge">1</span>
              )}
              <ChevronDown size={14} className="pf-toggle__chevron" aria-hidden />
            </button>
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

        {/* Active chip for date range */}
        {hasDateFilter && (
          <div className="pf-chips">
            <button type="button" className="pf-chip" onClick={clearDateRange}>
              {[dateRange.from, dateRange.to].filter(Boolean).join(" — ")}
              <X size={11} aria-hidden />
            </button>
            <button type="button" className="pf-chip-clear" onClick={clearDateRange}>
              Clear
            </button>
          </div>
        )}

        {/* Error */}
        {error && <p className="pf-error" role="alert">{error}</p>}

        {/* Expandable body — date range picker */}
        <div className="pf-body" aria-hidden={!filtersOpen}>
          <div className="pf-body-inner">
            <div className="pf-section">
              <span className="pf-section__label">Date range</span>
              <DateRangePicker
                value={dateRange}
                onChange={applyDateRange}
                label=""
              />
            </div>
          </div>
        </div>
      </div>

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
