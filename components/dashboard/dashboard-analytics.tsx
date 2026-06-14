"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Award, RefreshCw, SlidersHorizontal, X } from "lucide-react";
import { Select } from "@/components/primitives/field";
import type { DashboardAuditData } from "@/lib/audit/audit-records";
import {
  auditorInitials,
  computeAgentTargets,
  computeAuditorTargets,
  computePeriodStats,
  computeScoreDistribution,
  computeTopAgents,
  computeTopFatals,
  computeTrendData,
  EMPTY_INCLUDE_FILTERS,
  extractFilterOptions,
  filterByIncludeFilters,
  filterByPeriod,
  filterCurrentMonth,
  hasActiveIncludeFilters,
  type DashboardIncludeFilters,
  type DashboardPeriod,
  type TrendGranularity,
} from "@/lib/audit/dashboard-metrics";

type DashboardAnalyticsProps = {
  data: DashboardAuditData;
};

const PERIODS: { id: DashboardPeriod; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "overall", label: "Overall" },
];

const TREND_OPTIONS: { id: TrendGranularity; label: string }[] = [
  { id: "day", label: "Day by day" },
  { id: "week", label: "Week by week" },
  { id: "month", label: "Month by month" },
];

const DEFAULT_AGENT_TARGET = 20;

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

export function DashboardAnalytics({ data }: DashboardAnalyticsProps) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [period, setPeriod] = useState<DashboardPeriod>("overall");
  const [trendGranularity, setTrendGranularity] =
    useState<TrendGranularity>("week");
  const [includeFilters, setIncludeFilters] =
    useState<DashboardIncludeFilters>(EMPTY_INCLUDE_FILTERS);
  const [agentTarget, setAgentTarget] = useState(DEFAULT_AGENT_TARGET);
  const [totalMonthlyTarget, setTotalMonthlyTarget] = useState<number | null>(
    null
  );

  const records = data.records ?? [];
  const referenceNow = useMemo(
    () => new Date(data.fetchedAt),
    [data.fetchedAt]
  );

  const filterOptions = useMemo(
    () => extractFilterOptions(records),
    [records]
  );

  const scopedRecords = useMemo(
    () => filterByIncludeFilters(records, includeFilters),
    [records, includeFilters]
  );

  const filtered = useMemo(
    () => filterByPeriod(scopedRecords, period, referenceNow),
    [scopedRecords, period, referenceNow]
  );

  const monthRecords = useMemo(
    () => filterCurrentMonth(scopedRecords, referenceNow),
    [scopedRecords, referenceNow]
  );

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
    () => computeTrendData(scopedRecords, trendGranularity, referenceNow),
    [scopedRecords, trendGranularity, referenceNow]
  );

  const agentTargets = useMemo(
    () => computeAgentTargets(scopedRecords, monthRecords, agentTarget),
    [scopedRecords, monthRecords, agentTarget]
  );

  const resolvedMonthlyTarget =
    totalMonthlyTarget ?? agentTargets.cumulativeTarget;

  const auditorTargets = useMemo(
    () =>
      computeAuditorTargets(scopedRecords, monthRecords, resolvedMonthlyTarget),
    [scopedRecords, monthRecords, resolvedMonthlyTarget]
  );

  const topAgents = useMemo(() => computeTopAgents(filtered), [filtered]);
  const topFatals = useMemo(() => computeTopFatals(filtered), [filtered]);

  const distMax = Math.max(1, ...distribution.map((b) => b.count));
  const filtersActive = hasActiveIncludeFilters(includeFilters);

  function handleRefresh() {
    startRefresh(() => {
      router.refresh();
    });
  }

  function updateFilter<K extends keyof DashboardIncludeFilters>(
    key: K,
    value: DashboardIncludeFilters[K]
  ) {
    setIncludeFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setIncludeFilters(EMPTY_INCLUDE_FILTERS);
  }

  return (
    <div className="dash-analytics">
      {data.dbError ? (
        <div className="ui-alert" role="alert">
          {data.dbError}
        </div>
      ) : null}

      <div className="dash-topbar">
        <div className="dash-topbar__panel dash-topbar__panel--periods">
          <div className="dash-topbar__label">Period</div>
          <div className="dash-topbar__controls">
            <div
              className="dash-periods"
              role="tablist"
              aria-label="Time period"
            >
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={period === p.id}
                  className={
                    period === p.id
                      ? "dash-periods__btn dash-periods__btn--active"
                      : "dash-periods__btn"
                  }
                  onClick={() => setPeriod(p.id)}
                >
                  {p.label}
                </button>
              ))}
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
        </div>

        <div className="dash-topbar__panel dash-topbar__panel--filters">
          <div className="dash-topbar__label-row">
            <div className="dash-topbar__label">
              <SlidersHorizontal size={14} aria-hidden />
              Include filter
            </div>
            {filtersActive && (
              <button
                type="button"
                className="dash-filter-clear"
                onClick={clearFilters}
              >
                <X size={14} aria-hidden />
                Clear
              </button>
            )}
          </div>
          <div className="dash-filters">
            <label className="dash-filter">
              <span>Team name</span>
              <Select
                className="dash-select dash-select--filter"
                value={includeFilters.teamName}
                onChange={(e) => updateFilter("teamName", e.target.value)}
              >
                <option value="">All teams</option>
                {filterOptions.teamNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="dash-filter">
              <span>LOB</span>
              <Select
                className="dash-select dash-select--filter"
                value={includeFilters.lob}
                onChange={(e) => updateFilter("lob", e.target.value)}
              >
                <option value="">All LOBs</option>
                {filterOptions.lobs.map((lob) => (
                  <option key={lob} value={lob}>
                    {lob}
                  </option>
                ))}
              </Select>
            </label>
            <label className="dash-filter">
              <span>Quality auditor</span>
              <Select
                className="dash-select dash-select--filter"
                value={includeFilters.auditor}
                onChange={(e) => updateFilter("auditor", e.target.value)}
              >
                <option value="">All auditors</option>
                {filterOptions.auditors.map((auditor) => (
                  <option key={auditor} value={auditor}>
                    {auditor}
                  </option>
                ))}
              </Select>
            </label>
            <label className="dash-filter">
              <span>Audit type</span>
              <Select
                className="dash-select dash-select--filter"
                value={includeFilters.auditType}
                onChange={(e) => updateFilter("auditType", e.target.value)}
              >
                <option value="">All types</option>
                {filterOptions.auditTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </div>
      </div>

      <div className="dash-kpi-grid">
        <article className="dash-kpi">
          <p className="dash-kpi__label">Total audits</p>
          <p className="dash-kpi__value">{stats.total}</p>
          <p className="dash-kpi__hint">in selected period</p>
        </article>
        <article className="dash-kpi">
          <p className="dash-kpi__label">Avg quality score</p>
          <p className={`dash-kpi__value ${scoreTone(stats.avgQualityExclFatal)}`}>
            {stats.avgQualityExclFatal}%
          </p>
          <p className="dash-kpi__hint">excl. fatal override</p>
        </article>
        <article className="dash-kpi">
          <p className="dash-kpi__label">Pass rate</p>
          <p className={`dash-kpi__value ${scoreTone(stats.passRate)}`}>
            {stats.passRate}%
          </p>
          <p className="dash-kpi__hint">quality ≥75%</p>
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
          <p className="dash-kpi__label">Excellent (≥90%)</p>
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
                Rolling average by day, week, or month
              </p>
            </div>
            <Select
              className="dash-select"
              value={trendGranularity}
              onChange={(e) =>
                setTrendGranularity(e.target.value as TrendGranularity)
              }
              aria-label="Trend granularity"
            >
              {TREND_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </Select>
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
                Quality score bands in selected period
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
              <p className="dash-panel__desc">
                Cumulative audits this month vs target per agent
              </p>
            </div>
            <label className="dash-target-input">
              <span>Target/month:</span>
              <input
                type="number"
                min={1}
                max={999}
                value={agentTarget}
                onChange={(e) =>
                  setAgentTarget(Math.max(1, Number(e.target.value) || 1))
                }
              />
            </label>
          </div>

          <div className="dash-target-summary dash-target-summary--agent">
            <span>Cumulative this month</span>
            <strong>
              {agentTargets.cumulativeAchieved} / {agentTargets.cumulativeTarget}{" "}
              ({agentTargets.cumulativePct}%)
            </strong>
          </div>

          <div className="dash-target-list">
            {agentTargets.agents.length === 0 ? (
              <p className="dash-empty">No agents in audit history yet.</p>
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
                Total target ÷ active auditors = per-auditor allocation
              </p>
            </div>
            <label className="dash-target-input">
              <span>Total monthly target:</span>
              <input
                type="number"
                min={1}
                max={99999}
                value={resolvedMonthlyTarget}
                onChange={(e) =>
                  setTotalMonthlyTarget(
                    Math.max(1, Number(e.target.value) || 1)
                  )
                }
              />
            </label>
          </div>

          <div className="dash-target-summary dash-target-summary--auditor">
            <span>
              Target per auditor ({auditorTargets.activeAuditors} auditors)
            </span>
            <strong>{auditorTargets.perAuditorTarget} / month</strong>
          </div>

          <div className="dash-target-list">
            {auditorTargets.auditors.length === 0 ? (
              <p className="dash-empty">No auditors in audit history yet.</p>
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
                Highest average quality score in selected period
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
                  <span className="dash-performer-row__badge">
                    {fatal.count} occurrence{fatal.count === 1 ? "" : "s"}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
