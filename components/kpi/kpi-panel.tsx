"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FilterSelect } from "@/components/filters/filter-select";
import { FilterClearButton } from "@/components/filters/filter-clear-button";
import {
  DateRangePicker,
  type DateRangeValue,
} from "@/components/primitives/date-range-picker";
import { KpiScoreboard } from "@/components/kpi/kpi-scoreboard";
import { useToast } from "@/components/primitives/toast";
import { computeKpiRows } from "@/lib/kpi/compute-kpi";
import type { KpiPageData } from "@/lib/kpi/records";
import { setAuditTargetPerAgent } from "@/lib/actions/audit-targets";
import {
  DEFAULT_KPI_FILTERS,
  KPI_TIME_OPTIONS,
  countActiveKpiFilters,
  type KpiFilterOptions,
  type KpiFiltersState,
} from "@/lib/kpi/filters";

type KpiPanelProps = {
  filterOptions: KpiFilterOptions;
  data: KpiPageData;
};

function toSelectOptions(
  values: string[] | null | undefined,
  allLabel: string
): { value: string; label: string }[] {
  const list = Array.isArray(values) ? values : [];
  return [
    { value: "", label: allLabel },
    ...list.map((value) => ({ value, label: value })),
  ];
}

export function KpiPanel({ filterOptions, data }: KpiPanelProps) {
  const { toast } = useToast();
  const [filters, setFilters] = useState<KpiFiltersState>(DEFAULT_KPI_FILTERS);
  const [targetPerAgent, setTargetPerAgent] = useState(data.targetPerAgent);
  const targetSaveSeq = useRef(0);
  const lastSavedTarget = useRef(data.targetPerAgent);
  const pendingTarget = useRef<number | null>(null);
  const targetTimer = useRef<number | null>(null);

  const qualityManagers = filterOptions.qualityManagers ?? [];
  const qualityAnalysts = filterOptions.qualityAnalysts ?? [];
  const qmAgentNamesByQm = filterOptions.qmAgentNamesByQm ?? {};

  const timeOptions = useMemo(
    () =>
      KPI_TIME_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
      })),
    []
  );

  const qmOptions = useMemo(
    () => toSelectOptions(qualityManagers, "All quality managers"),
    [qualityManagers]
  );
  const qaOptions = useMemo(
    () => toSelectOptions(qualityAnalysts, "All QA"),
    [qualityAnalysts]
  );

  const rows = useMemo(
    () =>
      computeKpiRows({
        records: data.records,
        filters,
        rosterAgentNames: data.rosterAgentNames,
        targetPerAgent,
        qmAgentNamesByQm,
      }),
    [
      data.records,
      data.rosterAgentNames,
      targetPerAgent,
      qmAgentNamesByQm,
      filters,
    ]
  );

  const summary = rows.find((row) => row.id === "overall") ?? null;
  const agentCount = Math.max(0, rows.length - 1);
  const qmRosterSize = filters.qm
    ? (qmAgentNamesByQm[filters.qm]?.length ?? 0)
    : null;
  const activeFilterCount = countActiveKpiFilters(filters);
  const showCustomRange = filters.time === "custom";

  function patchFilters(patch: Partial<KpiFiltersState>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  function handleTimeChange(value: string) {
    const time = value as KpiFiltersState["time"];
    patchFilters({
      time,
      ...(time !== "custom" ? { customFrom: "", customTo: "" } : {}),
    });
  }

  function handleCustomRangeChange(range: DateRangeValue) {
    patchFilters({
      time: "custom",
      customFrom: range.from,
      customTo: range.to,
    });
  }

  function clearFilters() {
    setFilters(DEFAULT_KPI_FILTERS);
  }

  function persistTarget(value: number) {
    const next = Math.max(1, Math.min(999, Math.round(value) || 1));
    setTargetPerAgent(next);
    pendingTarget.current = null;
    if (next === lastSavedTarget.current) return;
    const seq = ++targetSaveSeq.current;
    void (async () => {
      const result = await setAuditTargetPerAgent(next);
      if (seq !== targetSaveSeq.current) return;
      if ("error" in result && result.error) {
        toast(result.error, "error");
        return;
      }
      if ("success" in result && result.success) {
        lastSavedTarget.current = result.perAgent;
        setTargetPerAgent(result.perAgent);
        toast("Per-agent target saved.", "success");
      }
    })();
  }

  function scheduleTargetSave(value: number) {
    const next = Math.max(1, Math.min(999, Math.round(value) || 1));
    setTargetPerAgent(next);
    pendingTarget.current = next;
    if (targetTimer.current != null) window.clearTimeout(targetTimer.current);
    targetTimer.current = window.setTimeout(() => {
      persistTarget(next);
    }, 400);
  }

  useEffect(() => {
    if (pendingTarget.current == null) {
      setTargetPerAgent(data.targetPerAgent);
      lastSavedTarget.current = data.targetPerAgent;
    }
  }, [data.targetPerAgent]);

  useEffect(() => {
    return () => {
      if (targetTimer.current != null) window.clearTimeout(targetTimer.current);
      const pending = pendingTarget.current;
      if (pending != null && pending !== lastSavedTarget.current) {
        void setAuditTargetPerAgent(pending);
      }
    };
  }, []);

  return (
    <section className="kpi-workspace">
      <div className="kpi-toolbar" role="toolbar" aria-label="KPI filters">
        <div className="kpi-toolbar__filters">
          <label className="kpi-filter">
            <span className="kpi-filter__label">Time</span>
            <FilterSelect
              id="kpi-filter-time"
              value={filters.time}
              onChange={handleTimeChange}
              options={timeOptions}
              ariaLabel="Filter by time"
              className="dash-select dash-select--filter kpi-filter__control"
            />
          </label>

          <label className="kpi-filter">
            <span className="kpi-filter__label">QM</span>
            <FilterSelect
              id="kpi-filter-qm"
              value={filters.qm}
              onChange={(qm) => patchFilters({ qm })}
              options={qmOptions}
              ariaLabel="Filter by quality manager"
              className="dash-select dash-select--filter kpi-filter__control"
              searchable
              searchPlaceholder="Search quality managers…"
            />
          </label>

          <label className="kpi-filter">
            <span className="kpi-filter__label">QA</span>
            <FilterSelect
              id="kpi-filter-qa"
              value={filters.qa}
              onChange={(qa) => patchFilters({ qa })}
              options={qaOptions}
              ariaLabel="Filter by quality analyst"
              className="dash-select dash-select--filter kpi-filter__control"
              searchable
              searchPlaceholder="Search quality analysts…"
            />
          </label>

          {showCustomRange ? (
            <div className="kpi-filter kpi-filter--range">
              <span className="kpi-filter__label">Custom date</span>
              <DateRangePicker
                label=""
                value={{ from: filters.customFrom, to: filters.customTo }}
                onChange={handleCustomRangeChange}
                className="kpi-filter__range"
              />
            </div>
          ) : null}
        </div>

        <div className="kpi-toolbar__actions">
          {activeFilterCount > 0 ? (
            <FilterClearButton onClick={clearFilters} />
          ) : null}
        </div>
      </div>

      <KpiScoreboard
        summary={summary}
        targetPerAgent={targetPerAgent}
        agentCount={agentCount}
        qmName={filters.qm || null}
        qmRosterSize={qmRosterSize}
        canEditTarget
        onTargetChange={scheduleTargetSave}
        onTargetCommit={persistTarget}
      />
    </section>
  );
}
