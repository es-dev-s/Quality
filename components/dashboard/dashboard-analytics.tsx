"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Award, RefreshCw } from "lucide-react";
import { FilterChipBar } from "@/components/filters/filter-chip-bar";
import { FilterClearButton } from "@/components/filters/filter-clear-button";
import { FilterTriggerButton } from "@/components/filters/filter-trigger-button";
import {
  FilterSidebar,
  FilterSidebarGrid,
  FilterSidebarSection,
} from "@/components/filters/filter-sidebar";
import { useFilterSidebar } from "@/lib/hooks/use-filter-sidebar";
import { Badge } from "@/components/primitives/badge";
import { FilterSelect } from "@/components/filters/filter-select";
import { LoadingZone } from "@/components/primitives/loading-zone";
import { cn } from "@/lib/utils";
import { FatalOccurrencesModal } from "@/components/dashboard/fatal-occurrences-modal";
import { TargetCalendarFilter } from "@/components/dashboard/target-calendar-filter";
import { useDashboardShell } from "@/components/dashboard/shell";
import { HistoryFilterSection } from "@/components/audit/history-filter-section";
import type { DashboardAuditData } from "@/lib/audit/audit-records";
import {
  defaultAuditHistoryFilter,
  filterByAuditHistory,
  type AuditHistoryFilter,
} from "@/lib/audit/history-filter";
import { PASS_RATE_TARGET_PCT } from "@/lib/audit/metrics-config";
import {
  auditorInitials,
  computeAgentTargets,
  computeAuditorTargets,
  restrictAuditorTargetsToViewer,
  computePeriodStats,
  computeScoreDistribution,
  computeTopAgents,
  computeTopFatals,
  getFatalOccurrences,
  computeTrendData,
  EMPTY_INCLUDE_FILTERS,
  extractFilterOptions,
  mergeRosterIntoFilterOptions,
  filterByIncludeFilters,
  filterByPeriod,
  filterByCustomRange,
  filterCurrentMonth,
  filterRecordsByAuditSource,
  hasActiveIncludeFilters,
  resolveTrendRangeBounds,
  type DashboardIncludeFilters,
  type DashboardPeriod,
  type TrendGranularity,
} from "@/lib/audit/dashboard-metrics";
import {
  agentNamesForSelectedTeam,
  buildAgentFilterSelectOptions,
  canFilterByAgent,
} from "@/lib/audit/agent-filter-access";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import { DateRangePicker, type DateRangeValue } from "@/components/primitives/date-range-picker";
import { type AuditSourceKind } from "@/lib/audit/audit-source";

type DashboardAnalyticsProps = {
  data: DashboardAuditData;
  roleSlug: string;
  canEditAudits?: boolean;
  canEditSupervisorRemarks?: boolean;
};

const PERIODS: { id: DashboardPeriod; label: string; ariaLabel: string }[] = [
  { id: "today", label: "Today", ariaLabel: "Today" },
  { id: "yesterday", label: "Yesterday", ariaLabel: "Yesterday" },
  { id: "week", label: "Week", ariaLabel: "This week" },
  { id: "month", label: "Month", ariaLabel: "This month" },
  { id: "overall", label: "Overall", ariaLabel: "All time" },
];

const TREND_OPTIONS: { id: TrendGranularity; label: string }[] = [
  { id: "day", label: "Day by day" },
  { id: "week", label: "Week by week" },
  { id: "month", label: "Month by month" },
];

const DEFAULT_AGENT_TARGET = 20;

const AGENT_TARGET_SOURCE_OPTIONS: { value: AuditSourceKind | ""; label: string }[] = [
  { value: "", label: "Audit source" },
  { value: "supervisor", label: "Supervisor audits" },
  { value: "qa", label: "QA audits" },
];

function agentTargetSourceCopy(source: AuditSourceKind | "") {
  if (source === "supervisor") {
    return {
      desc: "Supervisor audits this month vs target per agent",
      summary: "Supervisor audits this month",
      empty: "No agents with supervisor audits this month yet.",
    };
  }
  if (source === "qa") {
    return {
      desc: "QA audits this month vs target per agent",
      summary: "QA audits this month",
      empty: "No agents with QA audits this month yet.",
    };
  }
  return {
    desc: "Cumulative audits this month vs target per agent",
    summary: "Cumulative this month",
    empty: "No agents in audit history yet.",
  };
}

function scoreTone(score: number): string {
  if (score >= 90) return "dash-kpi__value--success";
  if (score >= 75) return "dash-kpi__value--good";
  if (score > 0) return "dash-kpi__value--warn";
  return "";
}

function bucketTone(key: string): string {
  if (key === "excellent" || key === "good") return "dash-dist__count--success";
  if (key === "average") return "dash-dist__count--warn";
  return "dash-dist__count--muted";
}

function bucketBarTone(key: string): string {
  if (key === "excellent" || key === "good") return "dash-dist__bar-fill--success";
  if (key === "average") return "dash-dist__bar-fill--warn";
  return "dash-dist__bar-fill--muted";
}

export function DashboardAnalytics({
  data,
  roleSlug,
  canEditAudits = false,
  canEditSupervisorRemarks = false,
}: DashboardAnalyticsProps) {
  const { user } = useDashboardShell();
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [period, setPeriod] = useState<DashboardPeriod>("overall");
  const [customRange, setCustomRange] = useState<DateRangeValue>({ from: "", to: "" });
  const [trendGranularity, setTrendGranularity] =
    useState<TrendGranularity>("week");
  const [includeFilters, setIncludeFilters] =
    useState<DashboardIncludeFilters>(EMPTY_INCLUDE_FILTERS);
  const [historyFilter, setHistoryFilter] = useState<AuditHistoryFilter>(() =>
    defaultAuditHistoryFilter(data.records ?? [])
  );
  const [agentTarget, setAgentTarget] = useState(DEFAULT_AGENT_TARGET);
  const [totalMonthlyTarget, setTotalMonthlyTarget] = useState<number | null>(
    null
  );
  const [selectedFatal, setSelectedFatal] = useState<string | null>(null);
  const [targetAuditSource, setTargetAuditSource] = useState<
    AuditSourceKind | ""
  >("");
  const [auditorTargetRange, setAuditorTargetRange] = useState<DateRangeValue>({
    from: "",
    to: "",
  });
  const filterSidebar = useFilterSidebar();
  const canEditAuditTargets =
    roleSlug === SYSTEM_ROLE_SLUGS.SUPERADMIN ||
    roleSlug === SYSTEM_ROLE_SLUGS.QUALITY_MANAGER;
  const showTargetPanelFilters = canEditAuditTargets;

  const records = data.records ?? [];
  const referenceNow = useMemo(
    () => new Date(data.fetchedAt),
    [data.fetchedAt]
  );

  const filterOptions = useMemo(
    () =>
      mergeRosterIntoFilterOptions(
        extractFilterOptions(records),
        data.rosterAgentNames ?? []
      ),
    [records, data.rosterAgentNames]
  );
  const showAgentFilter =
    canFilterByAgent(roleSlug) &&
    (filterOptions.agents.length > 0 || (data.rosterAgentNames?.length ?? 0) > 0);

  const historyScopedRecords = useMemo(
    () => filterByAuditHistory(records, historyFilter),
    [records, historyFilter]
  );

  const scopedRecords = useMemo(
    () => filterByIncludeFilters(historyScopedRecords, includeFilters),
    [historyScopedRecords, includeFilters]
  );

  const filtered = useMemo(() => {
    if (customRange.from || customRange.to) {
      return filterByCustomRange(scopedRecords, customRange.from, customRange.to);
    }
    return filterByPeriod(scopedRecords, period, referenceNow);
  }, [scopedRecords, period, customRange, referenceNow]);

  const trendRangeBounds = useMemo(
    () =>
      resolveTrendRangeBounds(
        {
          period: customRange.from || customRange.to ? "custom" : period,
          customFrom: customRange.from,
          customTo: customRange.to,
        },
        referenceNow
      ),
    [period, customRange, referenceNow]
  );

  const trendGranularityLabel =
    TREND_OPTIONS.find((option) => option.id === trendGranularity)?.label ??
    "Week by week";

  const monthRecords = useMemo(
    () => filterCurrentMonth(scopedRecords, referenceNow),
    [scopedRecords, referenceNow]
  );

  const agentTargetRecords = useMemo(() => {
    if (!targetAuditSource) {
      return { all: scopedRecords, month: monthRecords };
    }
    const bySource = filterRecordsByAuditSource(monthRecords, targetAuditSource);
    return { all: bySource, month: bySource };
  }, [scopedRecords, monthRecords, targetAuditSource]);

  const auditorTargetSource = useMemo(() => {
    if (
      showTargetPanelFilters &&
      (auditorTargetRange.from || auditorTargetRange.to)
    ) {
      const ranged = filterByCustomRange(
        scopedRecords,
        auditorTargetRange.from,
        auditorTargetRange.to
      );
      return { all: ranged, counts: ranged };
    }
    return { all: scopedRecords, counts: monthRecords };
  }, [
    scopedRecords,
    monthRecords,
    showTargetPanelFilters,
    auditorTargetRange.from,
    auditorTargetRange.to,
  ]);

  const stats = useMemo(() => computePeriodStats(filtered), [filtered]);
  const monthStats = useMemo(
    () => computePeriodStats(monthRecords),
    [monthRecords]
  );

  const distribution = useMemo(
    () => computeScoreDistribution(filtered),
    [filtered]
  );

  const trendData = useMemo(
    () =>
      computeTrendData(
        filtered,
        trendGranularity,
        referenceNow,
        trendRangeBounds
      ),
    [filtered, trendGranularity, referenceNow, trendRangeBounds]
  );

  const agentTargets = useMemo(
    () =>
      computeAgentTargets(
        agentTargetRecords.all,
        agentTargetRecords.month,
        agentTarget
      ),
    [agentTargetRecords, agentTarget]
  );

  const resolvedMonthlyTarget =
    totalMonthlyTarget ?? agentTargets.cumulativeTarget;

  const auditorTargets = useMemo(() => {
    const computed = computeAuditorTargets(
      auditorTargetSource.all,
      auditorTargetSource.counts,
      resolvedMonthlyTarget
    );
    if (roleSlug !== SYSTEM_ROLE_SLUGS.QUALITY_ANALYST) {
      return computed;
    }
    return restrictAuditorTargetsToViewer(computed, {
      name: user.name,
      email: user.email,
    });
  }, [
    auditorTargetSource,
    resolvedMonthlyTarget,
    roleSlug,
    user.name,
    user.email,
  ]);
  const isQualityAnalyst = roleSlug === SYSTEM_ROLE_SLUGS.QUALITY_ANALYST;
  const agentTargetCopy = agentTargetSourceCopy(targetAuditSource);

  const topAgents = useMemo(() => computeTopAgents(filtered), [filtered]);
  const topFatals = useMemo(() => computeTopFatals(filtered), [filtered]);
  const selectedFatalOccurrences = useMemo(
    () =>
      selectedFatal ? getFatalOccurrences(filtered, selectedFatal) : [],
    [filtered, selectedFatal]
  );

  const distMax = Math.max(1, ...distribution.map((b) => b.count));
  const filtersActive = hasActiveIncludeFilters(includeFilters);

  function scoreValueClass(score: number): string {
    if (score >= 90) return "score-value--success";
    if (score >= 70) return "score-value--warning";
    return "score-value--error";
  }

  const recentSubmissions = useMemo(() => {
    return [...filtered]
      .sort((a, b) => b.auditDate.localeCompare(a.auditDate))
      .slice(0, 5);
  }, [filtered]);

  function handleRefresh() {
    startRefresh(() => {
      router.refresh();
    });
  }

  function updateFilter<K extends keyof DashboardIncludeFilters>(
    key: K,
    value: DashboardIncludeFilters[K]
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
  }

  function clearFilters() {
    setIncludeFilters(EMPTY_INCLUDE_FILTERS);
    setCustomRange({ from: "", to: "" });
    setPeriod("overall");
    setTrendGranularity("week");
  }

  const dashboardFilterChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    if (customRange.from || customRange.to) {
      chips.push({
        key: "range",
        label: [customRange.from, customRange.to].filter(Boolean).join(" — "),
        onRemove: () => setCustomRange({ from: "", to: "" }),
      });
    } else if (period !== "overall") {
      const item = PERIODS.find((entry) => entry.id === period);
      chips.push({
        key: "period",
        label: item?.ariaLabel ?? "Period",
        onRemove: () => setPeriod("overall"),
      });
    }
    if (includeFilters.teamName) {
      chips.push({
        key: "team",
        label: `Team: ${includeFilters.teamName}`,
        onRemove: () => updateFilter("teamName", ""),
      });
    }
    if (includeFilters.agent) {
      chips.push({
        key: "agent",
        label: `Agent: ${includeFilters.agent}`,
        onRemove: () => updateFilter("agent", ""),
      });
    }
    if (includeFilters.businessType) {
      chips.push({
        key: "business",
        label: `Business: ${includeFilters.businessType}`,
        onRemove: () => updateFilter("businessType", ""),
      });
    }
    if (includeFilters.auditor) {
      chips.push({
        key: "auditor",
        label: `Auditor: ${includeFilters.auditor}`,
        onRemove: () => updateFilter("auditor", ""),
      });
    }
    if (includeFilters.auditType) {
      chips.push({
        key: "type",
        label: `Type: ${includeFilters.auditType}`,
        onRemove: () => updateFilter("auditType", ""),
      });
    }
    if (trendGranularity !== "week") {
      chips.push({
        key: "trend",
        label: trendGranularityLabel,
        onRemove: () => setTrendGranularity("week"),
      });
    }
    return chips;
  }, [customRange, period, includeFilters, trendGranularity, trendGranularityLabel]);

  const sidebarFilterCount = dashboardFilterChips.filter(
    (chip) => chip.key !== "business"
  ).length;
  const hasAnyDashboardFilters = dashboardFilterChips.length > 0;

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

  const auditorFilterOptions = useMemo(
    () => [
      { value: "", label: "All auditors" },
      ...filterOptions.auditors.map((auditor) => ({ value: auditor, label: auditor })),
    ],
    [filterOptions.auditors]
  );

  const auditTypeFilterOptions = useMemo(
    () => [
      { value: "", label: "All types" },
      ...filterOptions.auditTypes.map((type) => ({ value: type, label: type })),
    ],
    [filterOptions.auditTypes]
  );

  return (
    <div className="dash-analytics">
      {data.dbError ? (
        <div className="ui-alert" role="alert">
          {data.dbError}
        </div>
      ) : null}

      <div className="pf-panel">
        <div className="pf-bar">
          <div className="pf-bar__left">
            <span className="table-filter-bar__meta">
              {stats.total} audit{stats.total === 1 ? "" : "s"} in view
            </span>
            <div className="pf-bar__chips">
              <FilterChipBar
                inline
                showClearButton={false}
                chips={dashboardFilterChips}
              />
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
              {hasAnyDashboardFilters ? (
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
              disabled={isRefreshing}
            >
              <RefreshCw
                className={isRefreshing ? "pf-refresh__icon--spin" : undefined}
                size={14}
                aria-hidden
              />
              {isRefreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      <FilterSidebar
        open={filterSidebar.open}
        onOpenChange={filterSidebar.onOpenChange}
        title="Dashboard filters"
        description="Set the time period, trend view, and segment filters for KPIs and charts."
        activeCount={sidebarFilterCount}
        onClearAll={clearFilters}
        clearDisabled={!hasAnyDashboardFilters}
      >
        <FilterSidebarSection label="Period">
          <div className="filter-sidebar-periods pf-periods" role="tablist" aria-label="Time period">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={period === p.id && !(customRange.from || customRange.to)}
                aria-label={p.ariaLabel}
                title={p.ariaLabel}
                className={cn(
                  "pf-period-btn",
                  period === p.id && !(customRange.from || customRange.to) && "pf-period-btn--active"
                )}
                onClick={() => {
                  setCustomRange({ from: "", to: "" });
                  setPeriod(p.id);
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <DateRangePicker
            value={customRange}
            onChange={(v) => {
              setCustomRange(v);
              if (v.from || v.to) setPeriod("custom");
            }}
            label="Custom date range"
          />
        </FilterSidebarSection>

        <HistoryFilterSection
          value={historyFilter}
          onChange={setHistoryFilter}
          show={records.some((row) => row.isHistory)}
        />

        <FilterSidebarSection label="Trend view">
          <label className="dash-filter">
            <span>Avg quality score chart</span>
            <FilterSelect
              value={trendGranularity}
              onChange={(value) =>
                setTrendGranularity(value as TrendGranularity)
              }
              options={TREND_OPTIONS.map((option) => ({
                value: option.id,
                label: option.label,
              }))}
              ariaLabel="Trend chart granularity"
            />
          </label>
          <p className="ui-hint dash-filter__hint">
            Uses the same period and segment filters as the dashboard KPIs.
          </p>
        </FilterSidebarSection>

        <FilterSidebarSection label="Segment">
          <FilterSidebarGrid>
            <label className="dash-filter">
              <span>Team name</span>
              <FilterSelect
                value={includeFilters.teamName}
                onChange={(value) => updateFilter("teamName", value)}
                options={teamFilterOptions}
                ariaLabel="Filter by team"
                searchable
                searchPlaceholder="Search teams…"
              />
            </label>
            {showAgentFilter ? (
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
            <label className="dash-filter">
              <span>Quality auditor</span>
              <FilterSelect
                value={includeFilters.auditor}
                onChange={(value) => updateFilter("auditor", value)}
                options={auditorFilterOptions}
                ariaLabel="Filter by auditor"
                searchable
                searchPlaceholder="Search auditors…"
              />
            </label>
            <label className="dash-filter">
              <span>Audit type</span>
              <FilterSelect
                value={includeFilters.auditType}
                onChange={(value) => updateFilter("auditType", value)}
                options={auditTypeFilterOptions}
                ariaLabel="Filter by audit type"
              />
            </label>
          </FilterSidebarGrid>
        </FilterSidebarSection>
      </FilterSidebar>

      <LoadingZone
        loading={isRefreshing}
        label="Refreshing dashboard…"
        className="dash-sections loading-zone--stack"
      >
      <div className="dash-kpi-grid">
        <article className="dash-kpi">
          <p className="dash-kpi__label">Total audits</p>
          <p className="dash-kpi__value">{stats.total}</p>
          <p className="dash-kpi__hint">in selected period</p>
        </article>
        <article className="dash-kpi">
          <p className="dash-kpi__label">Pass rate</p>
          <p className={`dash-kpi__value ${scoreTone(stats.passRate)}`}>
            {stats.passRate}%
          </p>
          <p className="dash-kpi__hint">quality ≥{PASS_RATE_TARGET_PCT}%</p>
        </article>
        <article className="dash-kpi">
          <p className="dash-kpi__label">Avg final score</p>
          <p className={`dash-kpi__value ${scoreTone(stats.avgFinalInclFatal)}`}>
            {stats.avgFinalInclFatal}%
          </p>
          <p className="dash-kpi__hint">incl. fatal impact</p>
        </article>
        <article className="dash-kpi">
          <p className="dash-kpi__label">Fatal errors</p>
          <p className="dash-kpi__value dash-kpi__value--danger">
            {stats.fatals}
          </p>
          <p className="dash-kpi__hint">
            {stats.fatalRate}% of audits · auto-fail
          </p>
        </article>
        <article className="dash-kpi">
          <p className="dash-kpi__label">Agents audited</p>
          <p className="dash-kpi__value dash-kpi__value--accent">
            {stats.uniqueAgents}
          </p>
          <p className="dash-kpi__hint">unique agents</p>
        </article>
        <article className="dash-kpi">
          <p className="dash-kpi__label">Month audits</p>
          <p className="dash-kpi__value">{monthStats.total}</p>
          <p className="dash-kpi__hint">this calendar month</p>
        </article>
        <article className="dash-kpi">
          <p className="dash-kpi__label">Excellent (≥{PASS_RATE_TARGET_PCT}%)</p>
          <p className="dash-kpi__value dash-kpi__value--success">
            {stats.excellentCount}
          </p>
          <p className="dash-kpi__hint">quality score</p>
        </article>
      </div>

      <div className="dash-panels dash-panels--2">
        <section className="dash-panel dash-panel--scroll">
          <div className="dash-panel__head">
            <div>
              <h2 className="dash-panel__title">Avg quality score</h2>
              <p className="dash-panel__desc">
                {trendGranularityLabel} · filtered period
              </p>
            </div>
          </div>
          <div className="dash-trend">
            {trendData.map((point) => {
              const barHeight = Math.max(
                6,
                Math.round((point.score / 100) * 132)
              );
              return (
                <div key={point.id} className="dash-trend__col">
                  <span className="dash-trend__score">
                    {point.score > 0 ? `${point.score}%` : "—"}
                  </span>
                  <div className="dash-trend__bar-wrap">
                    <div
                      className="dash-trend__bar"
                      style={{ height: `${barHeight}px` }}
                      title={`${point.count} audit${point.count === 1 ? "" : "s"}`}
                    />
                  </div>
                  <span className="dash-trend__label">{point.name}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="dash-panel">
          <div className="dash-panel__head">
            <div>
              <h2 className="dash-panel__title">Score distribution</h2>
              <p className="dash-panel__desc">
                Quality score bands in selected period (FATAL = 0%)
              </p>
            </div>
          </div>
          <div className="dash-dist">
            {distribution.map((bucket) => (
              <div key={bucket.key} className="dash-dist__row">
                <div className="dash-dist__meta">
                  <span className="dash-dist__name">
                    {bucket.label} {bucket.range}
                  </span>
                </div>
                <div className="dash-dist__bar-track">
                  <div
                    className={`dash-dist__bar-fill ${bucketBarTone(bucket.key)}`}
                    style={{
                      width: `${Math.round((bucket.count / distMax) * 100)}%`,
                    }}
                  />
                </div>
                <div className="dash-dist__stats">
                  <span className={bucketTone(bucket.key)}>{bucket.count}</span>
                  <span className="dash-dist__pct">{bucket.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="dash-panels dash-panels--2">
        <section className="dash-panel dash-panel--targets">
          <div className="dash-panel__head dash-panel__head--split">
            <div>
              <h2 className="dash-panel__title">Audit target — per agent</h2>
              <p className="dash-panel__desc">{agentTargetCopy.desc}</p>
            </div>
            <div className="dash-target-head-actions">
              <div className="dash-target-auditor-filter">
                <FilterSelect
                  value={targetAuditSource}
                  onChange={(value) =>
                    setTargetAuditSource(value as AuditSourceKind | "")
                  }
                  options={AGENT_TARGET_SOURCE_OPTIONS}
                  ariaLabel="Audit source"
                />
              </div>
              <label className="dash-target-input">
              <span>Target/month:</span>
              <input
                type="number"
                min={1}
                max={999}
                value={agentTarget}
                disabled={!canEditAuditTargets}
                readOnly={!canEditAuditTargets}
                title={
                  canEditAuditTargets
                    ? "Set monthly audit target per agent"
                    : "Only Quality Manager and Superadmin can change this"
                }
                aria-label="Monthly audit target per agent"
                onChange={(e) => {
                  if (!canEditAuditTargets) return;
                  setAgentTarget(Math.max(1, Number(e.target.value) || 1));
                }}
              />
            </label>
            </div>
          </div>

          <div className="dash-target-summary dash-target-summary--agent">
            <span>{agentTargetCopy.summary}</span>
            <strong>
              {agentTargets.cumulativeAchieved} / {agentTargets.cumulativeTarget}{" "}
              ({agentTargets.cumulativePct}%)
            </strong>
          </div>

          <div className="dash-target-list">
            {agentTargets.agents.length === 0 ? (
              <p className="dash-empty">{agentTargetCopy.empty}</p>
            ) : (
              agentTargets.agents.map((agent) => (
                <div key={agent.name} className="dash-target-row">
                  <span className="dash-target-row__name">{agent.name}</span>
                  <div className="dash-target-row__bar-track">
                    <div
                      className="dash-target-row__bar-fill dash-target-row__bar-fill--agent"
                      style={{
                        width: `${Math.min(100, agent.pct)}%`,
                      }}
                    />
                  </div>
                  <span className="dash-target-row__stat">
                    <strong>
                      {agent.achieved}/{agent.target}
                    </strong>
                    <em>{agent.pct}%</em>
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="dash-panel dash-panel--targets">
          <div className="dash-panel__head dash-panel__head--split">
            <div>
              <h2 className="dash-panel__title">Audit target — per auditor</h2>
              <p className="dash-panel__desc">
                {isQualityAnalyst
                  ? "Your audits this month vs your monthly target"
                  : showTargetPanelFilters &&
                      (auditorTargetRange.from || auditorTargetRange.to)
                    ? "Audits in the selected dates vs allocated target"
                    : "Total target ÷ active auditors = per-auditor allocation"}
              </p>
            </div>
            <div className="dash-target-head-actions">
              {showTargetPanelFilters ? (
                <TargetCalendarFilter
                  value={auditorTargetRange}
                  onChange={setAuditorTargetRange}
                  monthlyTarget={resolvedMonthlyTarget}
                  canEditMonthlyTarget={canEditAuditTargets}
                  onMonthlyTargetChange={setTotalMonthlyTarget}
                />
              ) : null}
              {showTargetPanelFilters ? null : (
                <label className="dash-target-input">
                  <span>Total monthly target:</span>
                  <input
                    type="number"
                    min={1}
                    max={99999}
                    value={resolvedMonthlyTarget}
                    disabled={!canEditAuditTargets}
                    readOnly={!canEditAuditTargets}
                    title={
                      canEditAuditTargets
                        ? "Set total monthly audit target for auditors"
                        : "Only Quality Manager and Superadmin can change this"
                    }
                    aria-label="Total monthly audit target for auditors"
                    onChange={(e) => {
                      if (!canEditAuditTargets) return;
                      setTotalMonthlyTarget(
                        Math.max(1, Number(e.target.value) || 1)
                      );
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          <div className="dash-target-summary dash-target-summary--auditor">
            <span>
              {isQualityAnalyst
                ? "Your monthly target"
                : `Target per auditor (${auditorTargets.activeAuditors} auditors)`}
            </span>
            <strong>{auditorTargets.perAuditorTarget} / month</strong>
          </div>

          <div className="dash-target-list">
            {auditorTargets.auditors.length === 0 ? (
              <p className="dash-empty">
                {showTargetPanelFilters &&
                (auditorTargetRange.from || auditorTargetRange.to)
                  ? "No auditors in the selected dates."
                  : "No auditors in audit history yet."}
              </p>
            ) : (
              auditorTargets.auditors.map((auditor) => (
                <div
                  key={auditor.name}
                  className="dash-target-row dash-target-row--auditor"
                >
                  <div className="dash-target-row__identity">
                    <span className="dash-target-row__avatar" aria-hidden>
                      {auditorInitials(auditor.name)}
                    </span>
                    <div>
                      <span className="dash-target-row__name">
                        {auditor.name}
                      </span>
                      <span className="dash-target-row__role">Auditor</span>
                    </div>
                  </div>
                  <div className="dash-target-row__bar-track">
                    <div
                      className="dash-target-row__bar-fill dash-target-row__bar-fill--auditor"
                      style={{
                        width: `${Math.min(100, auditor.pct)}%`,
                      }}
                    />
                  </div>
                  <span className="dash-target-row__stat">
                    <strong>
                      {auditor.achieved}/{auditor.target}
                    </strong>
                    <em>{auditor.pct}%</em>
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="dash-performers">
        <section className="dash-panel">
          <div className="dash-panel__head">
            <div>
              <h2 className="dash-panel__title">
                <Award size={18} aria-hidden />
                Top performing agents
              </h2>
              <p className="dash-panel__desc">
                Highest average quality in selected period (FATAL = 0%)
              </p>
            </div>
          </div>
          <div className="dash-performer-list">
            {topAgents.length === 0 ? (
              <p className="dash-empty">No agent data in this period yet.</p>
            ) : (
              topAgents.map((agent, index) => (
                <div key={agent.name} className="dash-performer-row">
                  <span className="dash-performer-row__rank">{index + 1}</span>
                  <div>
                    <p className="dash-performer-row__name">{agent.name}</p>
                    <p className="dash-performer-row__meta">
                      {agent.count} audit{agent.count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span
                    className={`dash-performer-row__score ${scoreTone(agent.avg)}`}
                  >
                    {agent.avg}%
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="dash-panel">
          <div className="dash-panel__head">
            <div>
              <h2 className="dash-panel__title dash-panel__title--danger">
                <AlertTriangle size={18} aria-hidden />
                Top fatal errors
              </h2>
              <p className="dash-panel__desc">
                Most frequent fatal parameters in selected period
              </p>
            </div>
          </div>
          <div className="dash-performer-list">
            {topFatals.length === 0 ? (
              <p className="dash-empty">No fatal errors in this period.</p>
            ) : (
              topFatals.map((fatal) => (
                <div
                  key={fatal.name}
                  className="dash-performer-row dash-performer-row--fatal"
                >
                  <span className="dash-performer-row__name">{fatal.name}</span>
                  <button
                    type="button"
                    className="dash-performer-row__badge dash-performer-row__badge--action"
                    aria-label={`View ${fatal.count} occurrence${fatal.count === 1 ? "" : "s"} of ${fatal.name}`}
                    onClick={() => setSelectedFatal(fatal.name)}
                  >
                    {fatal.count} occurrence{fatal.count === 1 ? "" : "s"}
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="recent-submissions">
        <div className="recent-submissions__head">
          <h2 className="recent-submissions__title">Recent submissions</h2>
          <Link href="/audit-logs" className="recent-submissions__link">
            View all →
          </Link>
        </div>
        <div className="ui-table-wrap">
          <table className="ui-table platform-report-table">
            <thead>
              <tr>
                <th className="col-agent">Agent</th>
                <th className="col-template">Type</th>
                <th className="col-date">Date</th>
                <th className="col-status">Status</th>
                <th className="col-score">Score</th>
              </tr>
            </thead>
            <tbody>
              {recentSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <p className="ui-empty-state__desc" style={{ padding: "var(--space-8)" }}>
                      {roleSlug === SYSTEM_ROLE_SLUGS.MEMBER
                        ? "No access assigned yet. Ask a Quality Manager to grant Agent or QA visibility."
                        : "No submissions in your scope yet."}
                    </p>
                  </td>
                </tr>
              ) : (
                recentSubmissions.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="user-cell__name">{row.agent}</span>
                    </td>
                    <td>{row.type}</td>
                    <td>{row.auditDate}</td>
                    <td>
                      <Badge variant={row.hasFatal ? "error" : "success"} dot>
                        {row.hasFatal ? "Flagged" : "Complete"}
                      </Badge>
                    </td>
                    <td>
                      <span className={scoreValueClass(row.finalPct)}>
                        {row.finalPct}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      </LoadingZone>

      <FatalOccurrencesModal
        fatalName={selectedFatal}
        occurrences={selectedFatalOccurrences}
        canEditAudits={canEditAudits}
        canEditSupervisorRemarks={canEditSupervisorRemarks}
        onClose={() => setSelectedFatal(null)}
      />
    </div>
  );
}
