"use client";

import { QmsSortToggle } from "@/components/analytics/analytics-controls";
import { FatalIncidentsByTeamCard } from "@/components/analytics/fatal-incidents-by-team";
import { AnalyticsPaginationProvider } from "@/components/analytics/pagination-context";
import { AgentsTab } from "@/components/analytics/tabs/agents-tab";
import { AuditorsTab } from "@/components/analytics/tabs/auditors-tab";
import { ComplianceTab } from "@/components/analytics/tabs/compliance-tab";
import { LeaderboardsTab } from "@/components/analytics/tabs/leaderboards-tab";
import { OverviewTab } from "@/components/analytics/tabs/overview-tab";
import { ParametersTab } from "@/components/analytics/tabs/parameters-tab";
import { TeamsTab } from "@/components/analytics/tabs/teams-tab";
import { HistoryFilterSection } from "@/components/audit/history-filter-section";
import { FatalOccurrencesModal } from "@/components/dashboard/fatal-occurrences-modal";
import { FilterChipBar } from "@/components/filters/filter-chip-bar";
import { FilterClearButton } from "@/components/filters/filter-clear-button";
import { FilterSelect } from "@/components/filters/filter-select";
import {
	FilterSidebar,
	FilterSidebarGrid,
	FilterSidebarSection,
} from "@/components/filters/filter-sidebar";
import { FilterTriggerButton } from "@/components/filters/filter-trigger-button";
import { DateRangePicker,type DateRangeValue } from "@/components/primitives/date-range-picker";
import { LoadingZone } from "@/components/primitives/loading-zone";
import type { AnalyticsPageData } from "@/lib/actions/analytics";
import {
	agentNamesForSelectedTeam,
	buildAgentFilterSelectOptions,
} from "@/lib/audit/agent-filter-access";
import {
	ANALYTICS_INTERACTION_PRESETS,
	ANALYTICS_PERIOD_PRESETS,
	DEFAULT_ANALYTICS_INTERACTION_FILTER,
	EMPTY_ANALYTICS_INCLUDE_FILTERS,
	hasActiveAnalyticsIncludeFilters,
	hasActiveAnalyticsInteractionFilter,
	type AnalyticsIncludeFilters,
	type AnalyticsInteractionFilter
} from "@/lib/audit/analytics-filters";
import {
	summaryChipClass
} from "@/lib/audit/analytics-metrics";
import { analyticsQuerySchema } from "@/lib/audit/analytics-query";
import {
	ANALYTICS_TAB_LABELS,
	analyticsFilterVisibility,
	analyticsTabsForRole,
	getAnalyticsScopeDescription,
	type AnalyticsTabId,
} from "@/lib/audit/analytics-role-config";
import type { AnalyticsSortOrder } from "@/lib/audit/analytics-sort";
import {
	AUDIT_SOURCE_FILTER_OPTIONS,
	auditSourceChipLabel,
	type AuditSourceKind,
} from "@/lib/audit/audit-source";
import type { DashboardPeriod } from "@/lib/audit/dashboard-metrics";
import {
	viewerCanAccessTransferHistory,
	type AuditHistoryFilter
} from "@/lib/audit/history-filter";
import { useFilterSidebar } from "@/lib/hooks/use-filter-sidebar";
import { useServerResource } from "@/lib/hooks/use-server-resource";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import { useCallback,useMemo,useState } from "react";

type QmsAnalyticsProps = {
  data: AnalyticsPageData;
  roleSlug: string;
  viewerUserId?: string;
};

export function QmsAnalytics({
  data: initialData,
  roleSlug,
}: QmsAnalyticsProps) {
  const visibleTabs = useMemo(() => analyticsTabsForRole(roleSlug), [roleSlug]);
  const scopeDescription = useMemo(
    () => getAnalyticsScopeDescription(roleSlug),
    [roleSlug]
  );
  const filterVisibility = useMemo(
    () => analyticsFilterVisibility(roleSlug),
    [roleSlug]
  );
  const [requestedTab, setTab] = useState<AnalyticsTabId>("overview");
  const tab = visibleTabs.includes(requestedTab) ? requestedTab : visibleTabs[0] ?? "overview";
  const [sortOrder, setSortOrder] = useState<AnalyticsSortOrder>("desc");
  const [period, setPeriod] = useState<DashboardPeriod>("overall");
  const [customRange, setCustomRange] = useState<DateRangeValue>({ from: "", to: "" });
  const [includeFilters, setIncludeFilters] = useState<AnalyticsIncludeFilters>(
    EMPTY_ANALYTICS_INCLUDE_FILTERS
  );
  const [interactionFilter, setInteractionFilter] =
    useState<AnalyticsInteractionFilter>(DEFAULT_ANALYTICS_INTERACTION_FILTER);
  const [historyFilter, setHistoryFilter] = useState<AuditHistoryFilter>(() =>
    initialData.defaultHistoryFilter
  );
  const filterSidebar = useFilterSidebar();
  const [fatalTeam, setFatalTeam] = useState<string | null>(null);

  const [fatalPage, setFatalPage] = useState(1);
  const request = useMemo(() => analyticsQuerySchema.parse({ period, customRange, includeFilters, interactionFilter, historyFilter, sortOrder, fatalTeam, fatalPage }), [period, customRange, includeFilters, interactionFilter, historyFilter, sortOrder, fatalTeam, fatalPage]);
  const initialQuery = useMemo(() => analyticsQuerySchema.parse({ historyFilter: initialData.defaultHistoryFilter }), [initialData]);
  const resource = useServerResource("analytics", request, initialData, initialQuery);
  const baseData = resource.data;
  const analytics = baseData.analytics;
  const filterOptions = baseData.filterOptions;
  const fatalOccurrences = baseData.fatalOccurrences;
  const isLoading = resource.loading;
  const error = resource.error;
  const hasCustomRange = !!(customRange.from || customRange.to);
  const hasActiveFilters =
    hasCustomRange ||
    period !== "overall" ||
    hasActiveAnalyticsIncludeFilters(includeFilters) ||
    hasActiveAnalyticsInteractionFilter(interactionFilter);

  const updateFilter = useCallback(function updateFilter<K extends keyof AnalyticsIncludeFilters>(
    key: K,
    value: AnalyticsIncludeFilters[K]
  ) {
    setIncludeFilters((current) => {
      const next = { ...current, [key]: value };
      if (key === "teamName") {
        const allowed = agentNamesForSelectedTeam(
          filterOptions.agents,
          filterOptions.agentsByTeam,
          String(value)
        );
        if (next.agent && !allowed.includes(next.agent)) {
          next.agent = "";
        }
      }
      return next;
    });
  }, [filterOptions]);

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
    if (includeFilters.businessType) {
      chips.push({
        key: "business",
        label: `Business: ${includeFilters.businessType}`,
        onRemove: () => updateFilter("businessType", ""),
      });
    }
    if (includeFilters.auditSource) {
      chips.push({
        key: "auditSource",
        label: auditSourceChipLabel(includeFilters.auditSource),
        onRemove: () => updateFilter("auditSource", ""),
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
  }, [customRange, period, includeFilters, interactionFilter, hasCustomRange, updateFilter]);

  const sidebarFilterCount = filterChips.filter(
    (chip) => chip.key !== "business"
  ).length;
  const hasAnyAnalyticsFilters = filterChips.length > 0;

  const agentFilterOptions = useMemo(
    () =>
      buildAgentFilterSelectOptions(
        agentNamesForSelectedTeam(
          filterOptions.agents,
          filterOptions.agentsByTeam,
          includeFilters.teamName
        )
      ),
    [filterOptions.agents, filterOptions.agentsByTeam, includeFilters.teamName]
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

  const businessTypeFilterOptions = useMemo(
    () => [
      { value: "", label: "All business types" },
      ...filterOptions.businessTypes.map((value) => ({
        value,
        label: value,
      })),
    ],
    [filterOptions.businessTypes]
  );

  function handleRefresh() { resource.refresh(); }

  return (
    <AnalyticsPaginationProvider query={request} data={baseData}>
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
            <div className="pf-bar__chips">
              <FilterChipBar inline showClearButton={false} chips={filterChips} />
            </div>
          </div>

          <div className="pf-bar__right">
            <label className="pf-inline-filter">
              <span className="pf-inline-filter__label">Business type</span>
              <FilterSelect
                value={includeFilters.businessType}
                onChange={(value) => updateFilter("businessType", value)}
                options={businessTypeFilterOptions}
                ariaLabel="Filter by business type"
              />
            </label>
            <div className="pf-bar__filter-actions">
              {hasAnyAnalyticsFilters ? (
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
        description="Set the timeline, segment, and audit source filters for all analytics tabs."
        activeCount={sidebarFilterCount}
        onClearAll={clearFilters}
        clearDisabled={!hasAnyAnalyticsFilters}
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

        <HistoryFilterSection
          value={historyFilter}
          onChange={setHistoryFilter}
          show={
            viewerCanAccessTransferHistory(roleSlug) &&
            baseData.hasHistory
          }
        />

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
            Both merges call and chat parameters that share the same name.
          </p>
        </FilterSidebarSection>

        <FilterSidebarSection label="Segment">
          <FilterSidebarGrid>
            {filterVisibility.teamName ? (
              <label className="dash-filter">
                <span>Team</span>
                <FilterSelect
                  value={includeFilters.teamName}
                  onChange={(value) => updateFilter("teamName", value)}
                  options={teamFilterOptions}
                  ariaLabel="Filter by team"
                  searchable
                  searchPlaceholder="Search teams…"
                />
              </label>
            ) : null}
            {filterVisibility.agent ? (
              <label className="dash-filter">
                <span>Agent</span>
                <FilterSelect
                  value={includeFilters.agent}
                  onChange={(value) => updateFilter("agent", value)}
                  options={agentFilterOptions}
                  ariaLabel="Filter by agent"
                  searchable
                  searchPlaceholder="Search agents…"
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
                  searchable
                  searchPlaceholder="Search quality analysts…"
                />
              </label>
            ) : null}
            <label className="dash-filter">
              <span>Audit source</span>
              <FilterSelect
                value={includeFilters.auditSource}
                onChange={(value) =>
                  updateFilter("auditSource", value as AuditSourceKind | "")
                }
                options={AUDIT_SOURCE_FILTER_OPTIONS}
                ariaLabel="Filter by audit source"
              />
            </label>
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
        {tab === "overview" && (
          <OverviewTab
            data={analytics}
            sortOrder={sortOrder}
            onOpenFatalIncidents={setFatalTeam}
          />
        )}
        {tab === "parameters" && (
          <ParametersTab data={analytics} sortOrder={sortOrder} />
        )}
        {tab === "teams" && <TeamsTab data={analytics} sortOrder={sortOrder} />}
        {tab === "agents" && <AgentsTab data={analytics} sortOrder={sortOrder} />}
        {tab === "compliance" && (
          <ComplianceTab
            data={analytics}
            sortOrder={sortOrder}
            onOpenFatalIncidents={setFatalTeam}
          />
        )}
        {tab === "auditors" && (
          <AuditorsTab data={analytics} sortOrder={sortOrder} />
        )}
        {tab === "leaderboards" && (
          <LeaderboardsTab data={analytics.leaderboards} sortOrder={sortOrder} />
        )}
        <FatalIncidentsByTeamCard
          className="qms-fatal-footer"
          items={analytics.fatal_by_team}
          sortOrder={sortOrder}
          onSelectTeam={setFatalTeam}
        />
      </LoadingZone>

      <FatalOccurrencesModal
        fatalName={
          fatalTeam === null
            ? null
            : fatalTeam
              ? `Fatal incidents — ${fatalTeam}`
              : "Fatal incidents"
        }
        description={
          fatalTeam === null
            ? undefined
            : `${baseData.fatalPagination.total} fatal audit${
                baseData.fatalPagination.total === 1 ? "" : "s"
              } in the selected period`
        }
        occurrences={fatalOccurrences}
        pagination={baseData.fatalPagination}
        onPage={setFatalPage}
        loading={resource.loading}
        onClose={() => { setFatalTeam(null); setFatalPage(1); }}
      />

      <footer className="qms-analytics__footer">
        Quality analytics · {analytics.kpis.total_audits.toLocaleString()} audits in view
        {hasActiveFilters
          ? ` · ${baseData.filteredCount} of ${baseData.recordCount} scoped`
          : null}
        {" · "}
        {scopeDescription}
        {" · "}Internal use only
      </footer>
    </div>
    </AnalyticsPaginationProvider>
  );
}
