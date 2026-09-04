import { KPI_COLUMNS, type KpiColumn } from "@/lib/kpi/columns";
import {
  KPI_METRIC_HINTS,
  KPI_PRIMARY_COLUMNS,
  formatKpiDisplay,
  isUnavailableKpiValue,
} from "@/lib/kpi/metric-meta";
import type { KpiTableRow } from "@/lib/kpi/compute-kpi";

type KpiScoreboardProps = {
  /** Filtered-scope summary row (overall). */
  summary: KpiTableRow | null;
  targetPerAgent: number;
  agentCount: number;
  qmName?: string | null;
  qmRosterSize?: number | null;
  canEditTarget?: boolean;
  onTargetChange?: (value: number) => void;
  onTargetCommit?: (value: number) => void;
};

function valueOf(
  summary: KpiTableRow | null,
  column: KpiColumn
): string {
  return formatKpiDisplay(summary?.values[column]);
}

export function KpiScoreboard({
  summary,
  targetPerAgent,
  agentCount,
  qmName = null,
  qmRosterSize = null,
  canEditTarget = false,
  onTargetChange,
  onTargetCommit,
}: KpiScoreboardProps) {
  const hasData = Boolean(summary);
  const scopeLine = qmName
    ? `QM portfolio · ${qmName}${
        qmRosterSize != null ? ` · ${qmRosterSize} agents on roster` : ""
      }`
    : `Platform view · ${agentCount} ${
        agentCount === 1 ? "agent" : "agents"
      } audited in period`;

  return (
    <div className="kpi-scoreboard">
      <div className="kpi-scoreboard__intro">
        <div>
          <h2 className="kpi-scoreboard__title">Performance summary</h2>
        </div>
        <div className="kpi-scoreboard__meta-block">
          <p className="kpi-scoreboard__meta">{scopeLine}</p>
          <label className="kpi-scoreboard__meta kpi-scoreboard__target">
            Target
            <input
              type="number"
              min={1}
              max={999}
              value={targetPerAgent}
              disabled={!canEditTarget}
              readOnly={!canEditTarget}
              aria-label="Audit target per agent"
              title={
                canEditTarget
                  ? "Set monthly audit target per agent"
                  : "Audit target per agent"
              }
              onChange={(event) => {
                if (!canEditTarget || !onTargetChange) return;
                onTargetChange(Math.max(1, Number(event.target.value) || 1));
              }}
              onBlur={() => {
                if (!canEditTarget || !onTargetCommit) return;
                onTargetCommit(targetPerAgent);
              }}
            />
            /agent
          </label>
        </div>
      </div>

      <div className="kpi-scoreboard__cards" role="list">
        {KPI_PRIMARY_COLUMNS.map((column) => {
          const display = valueOf(summary, column);
          const unavailable = isUnavailableKpiValue(summary?.values[column]);
          return (
            <article
              key={column}
              className={
                unavailable ? "kpi-card kpi-card--muted" : "kpi-card"
              }
              role="listitem"
            >
              <p className="kpi-card__label">{column}</p>
              <p className="kpi-card__value">{hasData ? display : "—"}</p>
              <p className="kpi-card__hint">{KPI_METRIC_HINTS[column]}</p>
            </article>
          );
        })}
      </div>

      <section className="kpi-detail-panel" aria-label="All KPI indicators">
        <div className="kpi-detail-panel__head">
          <h3 className="kpi-detail-panel__title">All indicators</h3>
        </div>

        <div className="kpi-detail-table__scroll">
          <table className="kpi-detail-table">
            <thead>
              <tr>
                <th scope="col">Indicator</th>
                <th scope="col">Result</th>
              </tr>
            </thead>
            <tbody>
              {!hasData ? (
                <tr>
                  <td colSpan={2} className="kpi-detail-table__empty">
                    No KPI data for the selected filters.
                  </td>
                </tr>
              ) : (
                KPI_COLUMNS.map((column) => {
                  const raw = summary?.values[column];
                  const unavailable = isUnavailableKpiValue(raw);
                  return (
                    <tr
                      key={column}
                      className={
                        unavailable
                          ? "kpi-detail-table__row--muted"
                          : undefined
                      }
                    >
                      <th scope="row">
                        <span className="kpi-detail-table__name">{column}</span>
                        <span className="kpi-detail-table__hint">
                          {KPI_METRIC_HINTS[column]}
                        </span>
                      </th>
                      <td>
                        <span
                          className={
                            unavailable
                              ? "kpi-detail-table__value kpi-detail-table__value--empty"
                              : "kpi-detail-table__value"
                          }
                        >
                          {formatKpiDisplay(raw)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
