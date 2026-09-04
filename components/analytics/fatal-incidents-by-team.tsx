"use client";

import type { AnalyticsSortOrder } from "@/lib/audit/analytics-sort";
import { sortByNumber } from "@/lib/audit/analytics-sort";
import { QmsCard, QmsEmpty, QmsSectionTitle } from "@/components/analytics/qms-primitives";

type FatalTeamCount = {
  team: string;
  count: number;
};

export function FatalIncidentsByTeamCard({
  items,
  sortOrder,
  onSelectTeam,
  className = "",
}: {
  items: FatalTeamCount[];
  sortOrder: AnalyticsSortOrder;
  onSelectTeam: (team: string) => void;
  className?: string;
}) {
  const fatalByTeam = sortByNumber(items, (item) => item.count, sortOrder);

  return (
    <QmsCard className={className}>
      <QmsSectionTitle
        title="Fatal incidents by team"
        sub="Click a count to open the fatal audits"
      />
      {fatalByTeam.length === 0 ? (
        <QmsEmpty message="No fatal incidents recorded." />
      ) : (
        <div className="qms-fatal-grid">
          {fatalByTeam.map((item) => (
            <button
              key={item.team}
              type="button"
              className="qms-fatal-chip qms-fatal-chip--action"
              onClick={() => onSelectTeam(item.team)}
              aria-label={`View ${item.count} fatal audit${item.count === 1 ? "" : "s"} for ${item.team}`}
            >
              <p className="qms-fatal-chip__count">{item.count}</p>
              <p className="qms-fatal-chip__team">{item.team}</p>
            </button>
          ))}
        </div>
      )}
    </QmsCard>
  );
}
