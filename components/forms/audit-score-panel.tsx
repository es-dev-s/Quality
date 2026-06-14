import type { AuditRecord } from "@/lib/audit/types";
import { getGradeKey } from "@/lib/audit/score-visual";
import { cn } from "@/lib/utils";

type AuditScorePanelProps = {
  result: AuditRecord | null;
  ratedCount: number;
  totalScoringParams: number;
  canCalculate: boolean;
  fixed?: boolean;
};

export function AuditScorePanel({
  result,
  ratedCount,
  totalScoringParams,
  canCalculate,
  fixed = false,
}: AuditScorePanelProps) {
  const gradeKey = getGradeKey(result);
  const improveAreas = result
    ? Object.entries(result.catScores).filter(([, cat]) => {
        const pct =
          cat.max > 0 ? Math.round((cat.scored / cat.max) * 100) : 100;
        return pct < 75 && cat.max > 0;
      })
    : [];

  const unrated = result && result.totalMax === 0 && !result.hasFatal;
  const progressPct =
    totalScoringParams > 0
      ? Math.round((ratedCount / totalScoringParams) * 100)
      : 0;

  return (
    <aside
      className={cn(
        "audit-score-panel",
        fixed && "audit-score-panel--fixed",
        result && `audit-score-panel--${gradeKey}`
      )}
    >
      <div className="audit-score-panel__inner">
        <header className="audit-score-panel__header">
          <h3 className="audit-score-panel__title">Quality Output</h3>
          <p className="audit-score-panel__subtitle">
            {!canCalculate
              ? "Agent and LOB required"
              : result
                ? unrated
                  ? "Score parameters to calculate quality %"
                  : `${result.finalPct}% — ${result.grade}`
                : "Calculate score to generate output"}
          </p>
        </header>

        {!canCalculate || !result ? (
          <div className="audit-score-panel__empty">
            <div className="audit-score-panel__ring audit-score-panel__ring--empty">
              <span aria-hidden>—</span>
            </div>
            <p className="audit-score-panel__empty-text">
              {!canCalculate
                ? "Fill in Agent and LOB, then score parameters."
                : "Select scores for each parameter, then use Calculate score."}
            </p>
            <div className="audit-score-panel__progress">
              <div className="audit-score-panel__progress-top">
                <span>Parameters rated</span>
                <span>
                  {ratedCount} / {totalScoringParams}
                </span>
              </div>
              <div className="audit-score-panel__progress-bar">
                <div style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="audit-score-panel__hero">
              <div
                className={cn(
                  "audit-score-panel__ring",
                  gradeKey === "failed" && "audit-score-panel__ring--fatal",
                  gradeKey === "excellent" && "audit-score-panel__ring--excellent",
                  gradeKey === "good" && "audit-score-panel__ring--good",
                  gradeKey === "needs" && "audit-score-panel__ring--needs",
                  unrated && "audit-score-panel__ring--empty"
                )}
              >
                <span className="audit-score-panel__ring-value">
                  {unrated ? "—" : result.finalPct}
                </span>
                {!unrated && (
                  <span className="audit-score-panel__ring-unit">%</span>
                )}
              </div>
              <span
                className={cn(
                  "audit-grade audit-score-panel__grade",
                  unrated
                    ? "audit-grade--pending"
                    : gradeKey === "needs"
                      ? "audit-grade--needs"
                      : gradeKey === "failed"
                        ? "audit-grade--failed"
                        : gradeKey === "excellent"
                          ? "audit-grade--excellent"
                          : "audit-grade--good"
                )}
              >
                {unrated ? "Unrated" : result.grade}
              </span>
            </div>

            {!unrated && (
              <dl className="audit-score-panel__dl">
                <div>
                  <dt>Quality</dt>
                  <dd>{result.qualityPct}%</dd>
                </div>
                <div>
                  <dt>Points</dt>
                  <dd>
                    {result.totalScored}/{result.totalMax}
                  </dd>
                </div>
              </dl>
            )}

            {result.hasFatal && result.fatalList.length > 0 && (
              <div className="audit-score-panel__notice audit-score-panel__notice--fatal">
                <p className="audit-score-panel__notice-title">Fatal — final 0%</p>
                <ul>
                  {result.fatalList.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                {result.qualityPct > 0 && (
                  <p className="audit-score-panel__notice-note">
                    Behavioral quality was {result.qualityPct}% before fatal
                    override.
                  </p>
                )}
              </div>
            )}

            {!unrated && (
              <div className="audit-score-panel__section">
                <p className="audit-score-panel__section-label">By category</p>
                <ul className="audit-score-panel__cats">
                  {Object.entries(result.catScores).map(([name, cat]) => {
                    const pct =
                      cat.max > 0
                        ? Math.round((cat.scored / cat.max) * 100)
                        : 0;
                    const weak = pct < 75 && cat.max > 0;

                    return (
                      <li
                        key={name}
                        className={cn(
                          "audit-score-panel__cat",
                          weak && "audit-score-panel__cat--weak"
                        )}
                      >
                        <div className="audit-score-panel__cat-top">
                          <span className="audit-score-panel__cat-name">
                            {name}
                          </span>
                          <span className="audit-score-panel__cat-pct">
                            {pct}%
                          </span>
                        </div>
                        <div className="audit-score-panel__cat-bar">
                          <div style={{ width: `${pct}%` }} />
                        </div>
                        <span className="audit-score-panel__cat-pts">
                          {cat.scored}/{cat.max} pts
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {improveAreas.length > 0 && !unrated && (
              <div className="audit-score-panel__notice audit-score-panel__notice--warn">
                <p className="audit-score-panel__notice-title">Focus areas</p>
                <ul>
                  {improveAreas.map(([name, cat]) => {
                    const pct = Math.round((cat.scored / cat.max) * 100);
                    return (
                      <li key={name}>
                        {name} · {pct}%
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
