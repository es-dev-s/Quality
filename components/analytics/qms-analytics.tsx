"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { FilterChipBar } from "@/components/filters/filter-chip-bar";
import { FilterClearButton } from "@/components/filters/filter-clear-button";
import { FilterTriggerButton } from "@/components/filters/filter-trigger-button";
import { FilterSelect } from "@/components/filters/filter-select";
import {
  FilterSidebar,
  FilterSidebarGrid,
  FilterSidebarSection,
} from "@/components/filters/filter-sidebar";
import { useFilterSidebar } from "@/lib/hooks/use-filter-sidebar";
import { useBusyAction } from "@/lib/hooks/use-busy-action";
import { getAnalyticsData, type AnalyticsPageData } from "@/lib/actions/analytics";
import {
  ANALYTICS_INTERACTION_PRESETS,
  ANALYTICS_PERIOD_PRESETS,
  applyAnalyticsFilters,
  DEFAULT_ANALYTICS_INTERACTION_FILTER,
  EMPTY_ANALYTICS_INCLUDE_FILTERS,
  extractAnalyticsFilterOptions,
  hasActiveAnalyticsIncludeFilters,
  hasActiveAnalyticsInteractionFilter,
  type AnalyticsIncludeFilters,
  type AnalyticsInteractionFilter,
} from "@/lib/audit/analytics-filters";
import { buildAgentFilterSelectOptions } from "@/lib/audit/agent-filter-access";
import { summaryChipClass } from "@/lib/audit/analytics-metrics";
import type { DashboardPeriod } from "@/lib/audit/dashboard-metrics";
import { LoadingZone } from "@/components/primitives/loading-zone";
import { DateRangePicker, type DateRangeValue } from "@/components/primitives/date-range-picker";
import { cn } from "@/lib/utils";
import { AgentsTab } from "@/components/analytics/tabs/agents-tab";
import { AuditorsTab } from "@/components/analytics/tabs/auditors-tab";
import { ComplianceTab } from "@/components/analytics/tabs/compliance-tab";
import { OverviewTab } from "@/components/analytics/tabs/overview-tab";
import { ParametersTab } from "@/components/analytics/tabs/parameters-tab";
import { TeamsTab } from "@/components/analytics/tabs/teams-tab";
import { LeaderboardsTab } from "@/components/analytics/tabs/leaderboards-tab";
import {
  ANALYTICS_TAB_LABELS,
  analyticsFilterVisibility,
  analyticsTabsForRole,
  getAnalyticsScopeDescription,
  type AnalyticsTabId,
} from "@/lib/audit/analytics-role-config";
import type { AnalyticsSortOrder } from "@/lib/audit/analytics-sort";
import { QmsSortToggle } from "@/components/analytics/analytics-controls";

type QmsAnalyticsProps = {
  data: AnalyticsPageData;
  roleSlug: string;
};

export function QmsAnalytics({ data: initialData, roleSlug }: QmsAnalyticsProps) {
  const visibleTabs = useMemo(() => analyticsTabsForRole(roleSlug), [roleSlug]);
  const scopeDescription = useMemo(
    () => getAnalyticsScopeDescription(roleSlug),
    [roleSlug]
  );
  const filterVisibility = useMemo(
    () => analyticsFilterVisibility(roleSlug),
    [roleSlug]
  );
  const [tab, setTab] = useState<AnalyticsTabId>("overview");
  const [sortOrder, setSortOrder] = useState<AnalyticsSortOrder>("desc");
  const [liveBase, setLiveBase] = useState<AnalyticsPageData | null>(null);
  const [period, setPeriod] = useState<DashboardPeriod>("overall");
  const [customRange, setCustomRange] = useState<DateRangeValue>({ from: "", to: "" });
  const [includeFilters, setIncludeFilters] = useState<AnalyticsIncludeFilters>(
    EMPTY_ANALYTICS_INCLUDE_FILTERS
  );
  const [interactionFilter, setInteractionFilter] =
    useState<AnalyticsInteractionFilter>(DEFAULT_ANALYTICS_INTERACTION_FILTER);
  const filterSidebar = useFilterSidebar();
  const { busy: isLoading, run: runBusy } = useBusyAction();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visibleTabs.includes(tab)) {
      setTab(visibleTabs[0] ?? "overview");
    }
  }, [tab, visibleTabs]);

  const baseData = liveBase ?? initialData;
  const records = baseData.records;
  const referenceNow = useMemo(
    () => new Date(baseData.fetchedAt),
    [baseData.fetchedAt]
  );

  const filterOptions = useMemo(
    () => extractAnalyticsFilterOptions(records),
    [records]
  );

  const analyticsView = useMemo(
    () =>
      applyAnalyticsFilters(records, {
        period,
        customRange,
        includeFilters,
        interactionFilter,
        referenceNow,
      }),
    [records, period, customRange, includeFilters, interactionFilter, referenceNow]
  );

  const analytics = useMemo(
    () => ({
      kpis: analyticsView.kpis,
      params: analyticsView.params,
      categories: analyticsView.categories,
      teams: analyticsView.teams,
      bottom_agents: analyticsView.bottom_agents,
      top_agents: analyticsView.top_agents,
      auditors: analyticsView.auditors,
      fatal_by_team: analyticsView.fatal_by_team,
      leaderboards: analyticsView.leaderboards,
      team_param_breakdown: analyticsView.team_param_breakdown,
      team_cat_breakdown: analyticsView.team_cat_breakdown,
      agent_param_breakdown: analyticsView.agent_param_breakdown,
      agent_cat_breakdown: analyticsView.agent_cat_breakdown,
      auditor_param_breakdown: analyticsView.auditor_param_breakdown,
      auditor_cat_breakdown: analyticsView.auditor_cat_breakdown,
    }),
    [analyticsView]
  );

  const hasCustomRange = !!(customRange.from || customRange.to);
  const hasActiveFilters =
    hasCustomRange ||
    period !== "overall" ||
    hasActiveAnalyticsIncludeFilters(includeFilters) ||
    hasActiveAnalyticsInteractionFilter(interactionFilter);

  function updateFilter<K extends keyof AnalyticsIncludeFilters>(
    key: K,
    value: AnalyticsIncludeFilters[K]
  ) {
    setIncludeFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setIncludeFilters(EMPTY_ANALYTICS_INCLUDE_FILTERS);
    setCustomRange({ from: "", to: "" });
    setPeriod("overall");
    setInteractionFilter(DEFAULT_ANALYTICS_INTERACTION_FILTER);
  }

  const filterChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];

    if (hasCustomRange) {
      chips.push({
        key: "range",
        label: [customRange.from, customRange.to].filter(Boolean).join(" — "),
        onRemove: () => setCustomRange({ from: "", to: "" }),
      });
    } else if (period !== "overall") {
      const item = ANALYTICS_PERIOD_PRESETS.find((entry) => entry.id === period);
      chips.push({
        key: "period",
        label: item?.ariaLabel ?? "Period",
        onRemove: () => setPeriod("overall"),
      });
    }

    if (includeFilters.agent) {
      chips.push({
        key: "agent",
        label: `Agent: ${includeFilters.agent}`,
        onRemove: () => updateFilter("agent", ""),
      });
    }
    if (includeFilters.teamName) {
      chips.push({
        key: "team",
        label: `Team: ${includeFilters.teamName}`,
        onRemove: () => updateFilter("teamName", ""),
      });
    }
    if (includeFilters.auditor) {
      chips.push({
        key: "auditor",
        label: `QA: ${includeFilters.auditor}`,
        onRemove: () => updateFilter("auditor", ""),
      });
    }
    if (hasActiveAnalyticsInteractionFilter(interactionFilter)) {
      const preset = ANALYTICS_INTERACTION_PRESETS.find(
        (entry) => entry.id === interactionFilter
      );
      chips.push({
        key: "interaction",
        label: preset?.ariaLabel ?? "Interaction type",
        onRemove: () =>
          setInteractionFilter(DEFAULT_ANALYTICS_INTERACTION_FILTER),
      });
    }

    return chips;
  }, [customRange, period, includeFilters, interactionFilter, hasCustomRange]);

  const sidebarFilterCount = filterChips.length;

  const agentFilterOptions = useMemo(
    () => buildAgentFilterSelectOptions(filterOptions.agents),
    [filterOptions.agents]
  );

  const teamFilterOptions = useMemo(
    () => [
      { value: "", label: "All teams" },
      ...filterOptions.teamNames.map((name) => ({ value: name, label: name })),
    ],
    [filterOptions.teamNames]
  );

  const auditorFilterOptions = useMemo(
    () => [
      { value: "", label: "All quality analysts" },
      ...filterOptions.auditors.map((name) => ({ value: name, label: name })),
    ],
    [filterOptions.auditors]
  );

  function handleRefresh() {
    setError(null);
    runBusy(async () => {
      try {
        const result = await getAnalyticsData();
        setLiveBase(result);
      } catch {
        setError("Refresh failed.");
      }
    });
  }

  return (
    <div className="qms-analytics">
      <div className="pf-panel">
        <div className="pf-bar">
          <div className="pf-bar__left">
            <span className={`qms-summary-chip ${summaryChipClass(analytics.kpis.overall_avg)}`}>
              {analytics.kpis.overall_avg}% overall
            </span>
            <span className="qms-summary-chip qms-summary-chip--danger">
              {analytics.kpis.fatal_count} fatals
            </span>
            <span className="qms-summary-chip qms-summary-chip--muted">
              {analytics.kpis.total_audits.toLocaleString()} audits
              {analytics.kpis.call_count > 0 && analytics.kpis.chat_count > 0 ? (
                <span style={{ fontWeight: 500, opacity: 0.75 }}>
                  {" "}
                  ({analytics.kpis.call_count} call · {analytics.kpis.chat_count}{" "}
                  chat)
                </span>
              ) : null}
              {hasActiveFilters ? (
                <span style={{ fontWeight: 500, opacity: 0.75 }}> (filtered)</span>
              ) : null}
            </span>
            <span
              className="qms-summary-chip qms-summary-chip--muted qms-summary-chip--scope"
              title={scopeDescription}
            >
              {scopeDescription}
            </span>
            <div className="pf-bar__chips">
              <FilterChipBar inline showClearButton={false} chips={filterChips} />
            </div>
          </div>

          <div className="pf-bar__right">
            <div className="pf-bar__filter-actions">
              {sidebarFilterCount > 0 ? (
                <FilterClearButton onClick={clearFilters} />
              ) : null}
              <FilterTriggerButton
                activeCount={sidebarFilterCount}
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

        {error ? (
          <p className="pf-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <FilterSidebar
        open={filterSidebar.open}
        onOpenChange={filterSidebar.onOpenChange}
        title="Analytics filters"
        description="Set the timeline and segment filters for all analytics tabs."
        activeCount={sidebarFilterCount}
        onClearAll={clearFilters}
        clearDisabled={sidebarFilterCount === 0}
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
        <FilterSidebarSection label="Timeline">
          <div
            className="filter-sidebar-periods pf-periods"
            role="tablist"
            aria-label="Analytics time period"
          >
            {ANALYTICS_PERIOD_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                role="tab"
                aria-selected={period === preset.id && !hasCustomRange}
                aria-label={preset.ariaLabel}
                title={preset.ariaLabel}
                className={cn(
                  "pf-period-btn",
                  period === preset.id &&
                    !hasCustomRange &&
                    "pf-period-btn--active"
                )}
                onClick={() => {
                  setCustomRange({ from: "", to: "" });
                  setPeriod(preset.id);
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <DateRangePicker
            value={customRange}
            onChange={(value) => {
              setCustomRange(value);
              if (value.from || value.to) setPeriod("custom");
            }}
            label="Custom date range"
          />
        </FilterSidebarSection>

        <FilterSidebarSection label="Interaction type">
          <div
            className="filter-sidebar-periods pf-periods"
            role="tablist"
            aria-label="Interaction type filter"
          >
            {ANALYTICS_INTERACTION_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                role="tab"
                aria-selected={interactionFilter === preset.id}
                aria-label={preset.ariaLabel}
                title={preset.ariaLabel}
                className={cn(
                  "pf-period-btn",
                  interactionFilter === preset.id && "pf-period-btn--active"
                )}
                onClick={() => setInteractionFilter(preset.id)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <p className="ui-hint" style={{ marginTop: 8 }}>
            Both combines call and chat parameters with matching names and
            merged counts.
          </p>
        </FilterSidebarSection>

        <FilterSidebarSection label="Segment">
          <FilterSidebarGrid>
            {filterVisibility.agent ? (
              <label className="dash-filter">
                <span>Agent</span>
                <FilterSelect
                  value={includeFilters.agent}
                  onChange={(value) => updateFilter("agent", value)}
                  options={agentFilterOptions}
                  ariaLabel="Filter by agent"
                />
              </label>
            ) : null}
            {filterVisibility.teamName ? (
              <label className="dash-filter">
                <span>Team</span>
                <FilterSelect
                  value={includeFilters.teamName}
                  onChange={(value) => updateFilter("teamName", value)}
                  options={teamFilterOptions}
                  ariaLabel="Filter by team"
                />
              </label>
            ) : null}
            {filterVisibility.auditor ? (
              <label className="dash-filter">
                <span>Quality analyst</span>
                <FilterSelect
                  value={includeFilters.auditor}
                  onChange={(value) => updateFilter("auditor", value)}
                  options={auditorFilterOptions}
                  ariaLabel="Filter by quality analyst"
                />
              </label>
            ) : null}
          </FilterSidebarGrid>
        </FilterSidebarSection>
      </FilterSidebar>

      <div className="qms-toolbar">
        <div className="qms-toolbar__row">
          <div className="qms-tabs" role="tablist" aria-label="Analytics sections">
            {visibleTabs.map((itemId) => (
              <button
                key={itemId}
                type="button"
                role="tab"
                aria-selected={tab === itemId}
                className={
                  tab === itemId
                    ? "qms-tabs__btn qms-tabs__btn--active"
                    : "qms-tabs__btn"
                }
                onClick={() => setTab(itemId)}
              >
                {ANALYTICS_TAB_LABELS[itemId]}
              </button>
            ))}
          </div>
          <QmsSortToggle value={sortOrder} onChange={setSortOrder} />
        </div>
      </div>

      <LoadingZone
        loading={isLoading}
        label="Loading analytics…"
        className="qms-analytics__body loading-zone--min"
      >
        {tab === "overview" && <OverviewTab data={analytics} sortOrder={sortOrder} />}
        {tab === "parameters" && (
          <ParametersTab data={analytics} sortOrder={sortOrder} />
        )}
        {tab === "teams" && <TeamsTab data={analytics} sortOrder={sortOrder} />}
        {tab === "agents" && <AgentsTab data={analytics} sortOrder={sortOrder} />}
        {tab === "compliance" && (
          <ComplianceTab data={analytics} sortOrder={sortOrder} />
        )}
        {tab === "auditors" && (
          <AuditorsTab data={analytics} sortOrder={sortOrder} />
        )}
        {tab === "leaderboards" && (
          <LeaderboardsTab data={analytics.leaderboards} sortOrder={sortOrder} />
        )}
      </LoadingZone>

      <footer className="qms-analytics__footer">
        Quality analytics · {analytics.kpis.total_audits.toLocaleString()} audits in view
        {hasActiveFilters
          ? ` · ${analyticsView.filteredCount} of ${records.length} scoped`
          : null}
        {" · "}
        {scopeDescription}
        {" · "}Internal use only
      </footer>
    </div>
  );
}
