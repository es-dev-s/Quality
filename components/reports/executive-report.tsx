"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Calendar, Download, Maximize2, Minimize2, Printer } from "lucide-react";
import { FilterChipBar } from "@/components/filters/filter-chip-bar";
import { FilterClearButton } from "@/components/filters/filter-clear-button";
import { FilterSelect } from "@/components/filters/filter-select";
import { FilterTriggerButton } from "@/components/filters/filter-trigger-button";
import {
  FilterSidebar,
  FilterSidebarGrid,
  FilterSidebarSection,
} from "@/components/filters/filter-sidebar";
import { useFilterSidebar } from "@/lib/hooks/use-filter-sidebar";
import {
  DataTablePanel,
  usePaginatedRows,
} from "@/components/primitives/data-table-panel";
import { LoadingZone } from "@/components/primitives/loading-zone";
import { PASS_RATE_TARGET_PCT } from "@/lib/audit/metrics-config";
import { useStaleRequestGuard } from "@/lib/hooks/use-stale-request-guard";
import {
  getReportData,
  getReportExportData,
  type ReportFilterOptions,
  type ReportPageData,
} from "@/lib/actions/reports";
import { exportReportCsv } from "@/lib/reports/export-csv";
import {
  relatedNames,
  reportPeopleSelectOptions,
} from "@/lib/reports/report-filter-options";
import {
  defaultReportFilters,
  isDefaultReportDateRange,
  periodMatchesRange,
  rangeForReportPeriod,
  REPORT_PERIOD_OPTIONS,
  REPORT_TYPE_OPTIONS,
  toIsoDate,
  type ReportPeriod,
} from "@/lib/reports/report-period";
import {
  reportFiltersSchema,
  type ReportFilters,
} from "@/lib/validation/reports";
import { cn } from "@/lib/utils";

type ReportTableDensity = "compact" | "standard" | "expanded";

const DENSITY_OPTIONS: { id: ReportTableDensity; label: string }[] = [
  { id: "compact", label: "Compact" },
  { id: "standard", label: "Standard" },
  { id: "expanded", label: "Expanded" },
];

const EMPTY_FILTER_OPTIONS: ReportFilterOptions = {
  agents: [],
  supervisors: [],
  agentsBySupervisor: {},
  supervisorsByAgent: {},
};

function gradeClass(grade: string) {
  if (grade === "Failed") return "dash-grade dash-grade--failed";
  if (grade === "Excellent") return "dash-grade dash-grade--excellent";
  if (grade === "Good") return "dash-grade dash-grade--good";
  return "dash-grade dash-grade--needs";
}

function queryKey(filters: ReportFilters) {
  return [
    filters.startDate,
    filters.endDate,
    filters.agent,
    filters.supervisor,
    filters.type,
  ].join("|");
}

function normalizeApplied(filters: ReportFilters): ReportFilters {
  if (filters.period === "custom") return filters;
  if (periodMatchesRange(filters.period, filters.startDate, filters.endDate)) {
    return filters;
  }
  return { ...filters, period: "custom" };
}

function withPerson(
  filters: ReportFilters,
  options: ReportFilterOptions,
  next: { agent?: string; supervisor?: string }
): ReportFilters {
  const agent = next.agent ?? filters.agent;
  const supervisor = next.supervisor ?? filters.supervisor;

  if (next.agent !== undefined && agent && supervisor) {
    const allowed = relatedNames(
      options.supervisors,
      options.supervisorsByAgent,
      agent
    );
    return {
      ...filters,
      agent,
      supervisor: allowed.includes(supervisor) ? supervisor : "",
    };
  }

  if (next.supervisor !== undefined && supervisor && agent) {
    const allowed = relatedNames(
      options.agents,
      options.agentsBySupervisor,
      supervisor
    );
    return {
      ...filters,
      agent: allowed.includes(agent) ? agent : "",
      supervisor,
    };
  }

  return { ...filters, agent, supervisor };
}

function emptyStateMessage(data: ReportPageData, filters: ReportFilters) {
  const parts: string[] = [];
  if (filters.agent) parts.push(`agent ${filters.agent}`);
  if (filters.supervisor) parts.push(`supervisor ${filters.supervisor}`);
  if (filters.type) parts.push(filters.type.toLowerCase());
  const who = parts.length ? ` for ${parts.join(", ")}` : "";
  return `No audits found${who} between ${data.startDate} and ${data.endDate} (by audit date).`;
}

export function ExecutiveReport({
  canExport = false,
  filterOptions = EMPTY_FILTER_OPTIONS,
}: {
  canExport?: boolean;
  filterOptions?: ReportFilterOptions;
}) {
  const [draft, setDraft] = useState<ReportFilters>(defaultReportFilters);
  const [applied, setApplied] = useState<ReportFilters>(defaultReportFilters);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [data, setData] = useState<ReportPageData | null>(null);
  const [tableDensity, setTableDensity] = useState<ReportTableDensity>("expanded");
  const [isPending, startTransition] = useTransition();
  const [isExporting, startExport] = useTransition();
  const filterSidebar = useFilterSidebar();
  const { beginRequest } = useStaleRequestGuard();

  const pagination = usePaginatedRows(data?.rows ?? [], 20, queryKey(applied));
  const todayIso = toIsoDate(new Date());

  function commitFilters(next: ReportFilters) {
    const normalized = normalizeApplied(next);
    setDraft(normalized);
    setApplied(normalized);
    setDraftError(null);
    setExportError(null);
  }

  function load(filters: ReportFilters) {
    const request = beginRequest();
    startTransition(async () => {
      const result = await getReportData(filters);
      if (request.isStale()) return;
      setData(result);
    });
  }

  const appliedQueryKey = queryKey(applied);

  useEffect(() => {
    load(applied);
    // appliedQueryKey encodes start/end/agent/supervisor/type.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedQueryKey]);

  const draftPeopleOptions = useMemo(
    () => reportPeopleSelectOptions(filterOptions, draft.agent, draft.supervisor),
    [filterOptions, draft.agent, draft.supervisor]
  );

  const appliedPeopleOptions = useMemo(
    () =>
      reportPeopleSelectOptions(filterOptions, applied.agent, applied.supervisor),
    [filterOptions, applied.agent, applied.supervisor]
  );

  const filterChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];

    if (applied.period !== "custom") {
      const item = REPORT_PERIOD_OPTIONS.find((entry) => entry.id === applied.period);
      chips.push({
        key: "period",
        label: item?.ariaLabel ?? "Period",
        onRemove: () => {
          const defaults = defaultReportFilters();
          commitFilters({
            ...applied,
            startDate: defaults.startDate,
            endDate: defaults.endDate,
            period: "custom",
          });
        },
      });
    } else if (!isDefaultReportDateRange(applied.startDate, applied.endDate)) {
      chips.push({
        key: "range",
        label: `${applied.startDate} — ${applied.endDate}`,
        onRemove: () => {
          const defaults = defaultReportFilters();
          commitFilters({
            ...applied,
            startDate: defaults.startDate,
            endDate: defaults.endDate,
            period: "custom",
          });
        },
      });
    }

    if (applied.agent) {
      chips.push({
        key: "agent",
        label: `Agent: ${applied.agent}`,
        onRemove: () => commitFilters({ ...applied, agent: "" }),
      });
    }
    if (applied.supervisor) {
      chips.push({
        key: "supervisor",
        label: `Supervisor: ${applied.supervisor}`,
        onRemove: () => commitFilters({ ...applied, supervisor: "" }),
      });
    }
    if (applied.type) {
      const item = REPORT_TYPE_OPTIONS.find((entry) => entry.id === applied.type);
      chips.push({
        key: "type",
        label: item?.ariaLabel ?? applied.type,
        onRemove: () => commitFilters({ ...applied, type: "" }),
      });
    }

    return chips;
  }, [applied]);

  const hasActiveFilters = filterChips.length > 0;

  function openFilters() {
    setDraft(applied);
    setDraftError(null);
    filterSidebar.openFilters();
  }

  function handleSidebarOpenChange(open: boolean) {
    if (open) {
      setDraft(applied);
      setDraftError(null);
    }
    filterSidebar.onOpenChange(open);
  }

  function handleCancel() {
    setDraft(applied);
    setDraftError(null);
    filterSidebar.closeFilters();
  }

  function handleClearAll() {
    commitFilters(defaultReportFilters());
    filterSidebar.closeFilters();
  }

  function handleApply() {
    const parsed = reportFiltersSchema.safeParse(draft);
    if (!parsed.success) {
      setDraftError(parsed.error.issues[0]?.message ?? "Invalid report filters.");
      return;
    }
    commitFilters(parsed.data);
    filterSidebar.closeFilters();
  }

  function handlePeriod(period: ReportPeriod) {
    if (period === "custom") {
      commitFilters({ ...applied, period: "custom" });
      return;
    }
    const range = rangeForReportPeriod(period);
    commitFilters({
      ...applied,
      period,
      startDate: range.start,
      endDate: range.end,
    });
  }

  function setDraftAgent(agent: string) {
    setDraft((current) => withPerson(current, filterOptions, { agent }));
  }

  function setDraftSupervisor(supervisor: string) {
    setDraft((current) => withPerson(current, filterOptions, { supervisor }));
  }

  function handleExport() {
    if (!data?.rows.length) return;
    setExportError(null);
    startExport(async () => {
      const result = await getReportExportData(applied);
      if (result.error) {
        setExportError(result.error);
        return;
      }
      if (!result.rows.length) {
        setExportError("No rows match the current filters.");
        return;
      }
      exportReportCsv(result.rows);
    });
  }

  const periodLabel =
    applied.period === "custom"
      ? `${applied.startDate} to ${applied.endDate}`
      : (REPORT_PERIOD_OPTIONS.find((entry) => entry.id === applied.period)?.label ??
        `${applied.startDate} to ${applied.endDate}`);

  return (
    <div className="platform-report" id="executive-report">
      <div className="platform-report__toolbar platform-report__toolbar--compact">
        <div className="platform-report__toolbar-row platform-report__toolbar-row--meta">
          <div className="platform-report__toolbar-summary">
            <span className="table-filter-bar__meta">
              {data
                ? `${data.stats.total} audit${data.stats.total === 1 ? "" : "s"} · ${periodLabel}`
                : "Executive report"}
            </span>
            {hasActiveFilters ? (
              <FilterClearButton onClick={handleClearAll} />
            ) : null}
            <FilterTriggerButton
              activeCount={filterChips.length}
              onClick={openFilters}
            />
          </div>
          <div className="platform-report__actions">
            <div
              className="pf-periods platform-report-density"
              role="group"
              aria-label="Table detail density"
            >
              {DENSITY_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={cn(
                    "pf-period-btn",
                    tableDensity === option.id && "pf-period-btn--active"
                  )}
                  onClick={() => setTableDensity(option.id)}
                  title={
                    option.id === "expanded"
                      ? "Stretch columns for full detail visibility"
                      : option.label
                  }
                >
                  {option.id === "expanded" ? (
                    <>
                      <Maximize2 size={13} aria-hidden />
                      {option.label}
                    </>
                  ) : option.id === "compact" ? (
                    <>
                      <Minimize2 size={13} aria-hidden />
                      {option.label}
                    </>
                  ) : (
                    option.label
                  )}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="ui-btn ui-btn--secondary ui-btn--sm"
              onClick={() => window.print()}
              disabled={!data?.rows.length}
            >
              <Printer size={15} aria-hidden />
              Print
            </button>
            {canExport ? (
              <button
                type="button"
                className="ui-btn ui-btn--primary ui-btn--sm"
                onClick={handleExport}
                disabled={!data?.rows.length || isExporting}
              >
                <Download size={15} aria-hidden />
                Export CSV ({data?.rows.length ?? 0})
              </button>
            ) : null}
          </div>
        </div>

        <div className="platform-report__toolbar-row platform-report__toolbar-row--presets">
          <div className="platform-report__preset platform-report__preset--pills">
            <span className="platform-report__preset-label">Period</span>
            <div className="pf-periods" role="tablist" aria-label="Report period">
              {REPORT_PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={applied.period === option.id}
                  aria-label={option.ariaLabel}
                  title={option.ariaLabel}
                  className={cn(
                    "pf-period-btn",
                    applied.period === option.id && "pf-period-btn--active"
                  )}
                  onClick={() => handlePeriod(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="platform-report__preset platform-report__preset--pills">
            <span className="platform-report__preset-label">Type</span>
            <div
              className="pf-periods"
              role="tablist"
              aria-label="Call or chat"
            >
              {REPORT_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.id || "both"}
                  type="button"
                  role="tab"
                  aria-selected={applied.type === option.id}
                  aria-label={option.ariaLabel}
                  title={option.ariaLabel}
                  className={cn(
                    "pf-period-btn",
                    applied.type === option.id && "pf-period-btn--active"
                  )}
                  onClick={() => commitFilters({ ...applied, type: option.id })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <label className="platform-report__preset platform-report__preset--select">
            <span className="platform-report__preset-label">Agent</span>
            <FilterSelect
              value={applied.agent}
              onChange={(agent) =>
                commitFilters(withPerson(applied, filterOptions, { agent }))
              }
              options={appliedPeopleOptions.agents}
              ariaLabel="Filter by agent"
              searchable
              searchPlaceholder="Search agents…"
            />
          </label>
          <label className="platform-report__preset platform-report__preset--select">
            <span className="platform-report__preset-label">Supervisor</span>
            <FilterSelect
              value={applied.supervisor}
              onChange={(supervisor) =>
                commitFilters(withPerson(applied, filterOptions, { supervisor }))
              }
              options={appliedPeopleOptions.supervisors}
              ariaLabel="Filter by supervisor"
              searchable
              searchPlaceholder="Search supervisors…"
            />
          </label>
        </div>

        {hasActiveFilters ? (
          <div className="platform-report__toolbar-row platform-report__toolbar-row--chips">
            <FilterChipBar inline showClearButton={false} chips={filterChips} />
          </div>
        ) : null}
      </div>

      <FilterSidebar
        open={filterSidebar.open}
        onOpenChange={handleSidebarOpenChange}
        title="Report filters"
        description="Narrow the report by agent, supervisor, call or chat, and audit date. Changes apply when you click Apply filters."
        activeCount={filterChips.length}
        onClearAll={handleClearAll}
        clearDisabled={!hasActiveFilters}
        footer={
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <button
              type="button"
              className="ui-btn ui-btn--secondary ui-btn--sm"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="ui-btn ui-btn--primary ui-btn--sm"
              disabled={isPending}
              onClick={handleApply}
            >
              Apply filters
            </button>
          </div>
        }
      >
        <FilterSidebarSection label="Period">
          <div
            className="filter-sidebar-periods pf-periods"
            role="tablist"
            aria-label="Report period"
          >
            {REPORT_PERIOD_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={draft.period === option.id}
                aria-label={option.ariaLabel}
                title={option.ariaLabel}
                className={cn(
                  "pf-period-btn",
                  draft.period === option.id && "pf-period-btn--active"
                )}
                onClick={() => {
                  if (option.id === "custom") {
                    setDraft((current) => ({ ...current, period: "custom" }));
                    return;
                  }
                  const range = rangeForReportPeriod(option.id);
                  setDraft((current) => ({
                    ...current,
                    period: option.id,
                    startDate: range.start,
                    endDate: range.end,
                  }));
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </FilterSidebarSection>

        <FilterSidebarSection label="Audit date range">
          <label className="platform-report__date-field">
            <span>Start date (audit)</span>
            <div className="platform-report__date-input">
              <Calendar size={15} aria-hidden />
              <input
                type="date"
                max={todayIso}
                value={draft.startDate}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    startDate: event.target.value,
                    period: "custom",
                  }))
                }
              />
            </div>
          </label>
          <label className="platform-report__date-field">
            <span>End date (audit)</span>
            <div className="platform-report__date-input">
              <Calendar size={15} aria-hidden />
              <input
                type="date"
                max={todayIso}
                min={draft.startDate || undefined}
                value={draft.endDate}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    endDate: event.target.value,
                    period: "custom",
                  }))
                }
              />
            </div>
          </label>
        </FilterSidebarSection>

        <FilterSidebarSection label="Interaction type">
          <div
            className="filter-sidebar-periods pf-periods"
            role="tablist"
            aria-label="Call or chat"
          >
            {REPORT_TYPE_OPTIONS.map((option) => (
              <button
                key={option.id || "both"}
                type="button"
                role="tab"
                aria-selected={draft.type === option.id}
                aria-label={option.ariaLabel}
                title={option.ariaLabel}
                className={cn(
                  "pf-period-btn",
                  draft.type === option.id && "pf-period-btn--active"
                )}
                onClick={() =>
                  setDraft((current) => ({ ...current, type: option.id }))
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </FilterSidebarSection>

        <FilterSidebarSection label="People">
          <FilterSidebarGrid>
            <label className="dash-filter">
              <span>Agent</span>
              <FilterSelect
                value={draft.agent}
                onChange={setDraftAgent}
                options={draftPeopleOptions.agents}
                ariaLabel="Filter by agent"
                searchable
                searchPlaceholder="Search agents…"
              />
            </label>
            <label className="dash-filter">
              <span>Supervisor</span>
              <FilterSelect
                value={draft.supervisor}
                onChange={setDraftSupervisor}
                options={draftPeopleOptions.supervisors}
                ariaLabel="Filter by supervisor"
                searchable
                searchPlaceholder="Search supervisors…"
              />
            </label>
          </FilterSidebarGrid>
        </FilterSidebarSection>

        {draftError ? (
          <p className="ui-alert" role="alert">
            {draftError}
          </p>
        ) : null}
      </FilterSidebar>

      {data?.error ? (
        <p className="ui-alert" role="alert">
          {data.error}
        </p>
      ) : null}
      {exportError ? (
        <p className="ui-alert" role="alert">
          {exportError}
        </p>
      ) : null}

      <LoadingZone
        loading={isPending}
        label={data ? "Refreshing report…" : "Loading report…"}
        className="loading-zone--min loading-zone--stack"
      >
        {data && !data.error && data.stats.total === 0 ? (
          <p className="platform-empty">{emptyStateMessage(data, applied)}</p>
        ) : null}

        {data && data.stats.total > 0 ? (
          <>
            <div className="platform-kpi-row">
              <article className="platform-kpi">
                <p className="platform-kpi__label">Total audits</p>
                <p className="platform-kpi__value">{data.stats.total}</p>
              </article>
              <article className="platform-kpi">
                <p className="platform-kpi__label">Avg quality</p>
                <p className="platform-kpi__value platform-kpi__value--accent">
                  {data.stats.avgQuality}%
                </p>
                <p className="platform-kpi__hint">incl. fatal as 0%</p>
              </article>
              <article className="platform-kpi">
                <p className="platform-kpi__label">Pass rate</p>
                <p className="platform-kpi__value platform-kpi__value--success">
                  {data.stats.passRate}%
                </p>
                <p className="platform-kpi__hint">
                  target ≥{PASS_RATE_TARGET_PCT}%
                </p>
              </article>
              <article className="platform-kpi">
                <p className="platform-kpi__label">Fatal audits</p>
                <p className="platform-kpi__value platform-kpi__value--danger">
                  {data.stats.fatals}
                </p>
              </article>
            </div>

            <DataTablePanel
              pagination={pagination}
              scrollClassName={cn(
                tableDensity === "expanded" &&
                  "platform-report-table__scroll--expanded",
                tableDensity === "compact" &&
                  "platform-report-table__scroll--compact"
              )}
              renderTable={(slice) => (
                <table
                  className={cn(
                    "ui-table platform-table platform-report-table",
                    tableDensity === "compact" && "platform-report-table--compact",
                    tableDensity === "expanded" && "platform-report-table--expanded"
                  )}
                >
                  <thead>
                    <tr>
                      <th>Audit ID</th>
                      <th>Agent</th>
                      <th>Supervisor</th>
                      <th>Auditor</th>
                      <th>Audit date</th>
                      <th>Call date</th>
                      <th>Type</th>
                      <th>LOB</th>
                      <th>Reason</th>
                      <th>Number / client name</th>
                      <th>Quality</th>
                      <th>Final</th>
                      <th>Grade</th>
                      <th>Feedback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slice.map((row) => (
                      <tr key={row.id}>
                        <td className="platform-report-table__code">{row.auditCode}</td>
                        <td className="platform-cell-strong">{row.agent}</td>
                        <td>{row.supervisor ?? "—"}</td>
                        <td>{row.auditor ?? "—"}</td>
                        <td>{row.auditDate}</td>
                        <td>{row.callDate}</td>
                        <td>
                          {row.type}
                          <span className="dash-cell-muted"> · {row.businessType}</span>
                        </td>
                        <td>
                          {row.lob}
                          {row.sublob ? (
                            <span className="dash-cell-muted"> / {row.sublob}</span>
                          ) : null}
                        </td>
                        <td className="platform-report-table__reason">
                          {row.reason ?? "—"}
                        </td>
                        <td>{row.mobile ?? "—"}</td>
                        <td className="platform-cell-accent">{row.qualityPct}%</td>
                        <td>
                          {row.hasFatal ? (
                            <span className="platform-cell-danger">FAILED</span>
                          ) : (
                            `${row.finalPct}%`
                          )}
                        </td>
                        <td>
                          <span className={gradeClass(row.grade)}>{row.grade}</span>
                        </td>
                        <td>{row.feedbackStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            />
          </>
        ) : null}
      </LoadingZone>
    </div>
  );
}
