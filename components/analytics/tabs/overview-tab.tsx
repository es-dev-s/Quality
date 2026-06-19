"use client";

import type { QmsAnalyticsData } from "@/lib/audit/analytics-metrics";
import {
  CHART_COLORS,
  QmsCard,
  QmsGauge,
  QmsKpiTile,
  QmsSectionTitle,
} from "@/components/analytics/qms-primitives";

export function OverviewTab({ data }: { data: QmsAnalyticsData }) {
  const { kpis } = data;
  const agentTotal =
    kpis.below_80 + kpis.btw_80_90 + kpis.btw_90_95 + kpis.above_95;

  const distData = [
    { label: "≥ 95%", value: kpis.above_95, tone: "success" as const },
    { label: "90–95%", value: kpis.btw_90_95, tone: "accent" as const },
    { label: "80–90%", value: kpis.btw_80_90, tone: "warn" as const },
    { label: "< 80%", value: kpis.below_80, tone: "danger" as const },
  ];

  const coverageTotal = kpis.week1 + kpis.week2 || 1;
  const auditTotal = kpis.total_audits || 1;

  return (
    <div className="qms-tab">
      <div className="qms-kpi-row">
        <QmsKpiTile
          label="Total audits"
          value={kpis.total_audits.toLocaleString()}
          sub={`${kpis.call_count} calls · ${kpis.chat_count} chats`}
          tone="accent"
        />
        <QmsKpiTile
          label="Overall quality"
          value={`${kpis.overall_avg}%`}
          sub={
            kpis.overall_avg >= 90 ? "Target met (≥90%)" : "Below 90% target"
          }
          tone={kpis.overall_avg >= 90 ? "success" : "warn"}
        />
        <QmsKpiTile
          label="Fatal incidents"
          value={kpis.fatal_count}
          sub="Immediate action required"
          tone="danger"
        />
        <QmsKpiTile
          label="Issue severity"
          value={kpis.issue_sev_critical}
          sub={`Medium: ${kpis.issue_sev_medium} · Low: ${kpis.issue_sev_low}`}
          tone="warn"
        />
        <QmsKpiTile
          label="Feedback done"
          value={kpis.fb_done}
          sub={`${kpis.fb_pending} pending`}
          tone="success"
        />
      </div>

      <div className="qms-panels qms-panels--3">
        <QmsCard className="qms-card--gauges">
          <QmsSectionTitle title="Quality score gauges" />
          <div className="qms-gauges">
            <QmsGauge value={kpis.overall_avg} label="Overall" />
            <QmsGauge value={kpis.call_score} label="Calls" />
            <QmsGauge value={kpis.chat_score} label="Chats" />
          </div>
        </QmsCard>

        <QmsCard>
          <QmsSectionTitle
            title="Agent score distribution"
            sub="Agents with ≥3 audits"
          />
          <div className="qms-dist-list">
            {distData.map((item) => (
              <div key={item.label} className="qms-dist-list__row">
                <div className="qms-dist-list__head">
                  <span className={`qms-dist-list__label qms-tone--${item.tone}`}>
                    {item.label}
                  </span>
                  <span className="qms-dist-list__count">
                    {item.value} agents
                  </span>
                </div>
                <div className="qms-dist-list__track">
                  <div
                    className={`qms-dist-list__fill qms-bar--${item.tone}`}
                    style={{
                      width: `${
                        agentTotal > 0
                          ? Math.round((item.value / agentTotal) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </QmsCard>

        <QmsCard>
          <QmsSectionTitle title="Audit coverage" />
          <div className="qms-dist-list">
            {[
              {
                label: "Week 1",
                value: kpis.week1,
                total: coverageTotal,
                color: CHART_COLORS.accent,
              },
              {
                label: "Week 2",
                value: kpis.week2,
                total: coverageTotal,
                color: CHART_COLORS.purple,
              },
              {
                label: "Calls",
                value: kpis.call_count,
                total: auditTotal,
                color: CHART_COLORS.green,
              },
              {
                label: "Chats",
                value: kpis.chat_count,
                total: auditTotal,
                color: CHART_COLORS.amber,
              },
            ].map((item) => (
              <div key={item.label} className="qms-dist-list__row">
                <div className="qms-dist-list__head">
                  <span className="qms-dist-list__label qms-dist-list__label--muted">
                    {item.label}
                  </span>
                  <span className="qms-dist-list__count">
                    {item.value} ({Math.round((item.value / item.total) * 100)}
                    %)
                  </span>
                </div>
                <div className="qms-dist-list__track">
                  <div
                    className="qms-dist-list__fill"
                    style={{
                      width: `${(item.value / item.total) * 100}%`,
                      background: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </QmsCard>
      </div>

      {data.fatal_by_team.length > 0 && (
        <QmsCard>
          <QmsSectionTitle
            title="Fatal incidents by team"
            sub="Teams requiring immediate escalation"
          />
          <div className="qms-fatal-grid">
            {data.fatal_by_team.map((item) => (
              <div key={item.team} className="qms-fatal-chip">
                <p className="qms-fatal-chip__count">{item.count}</p>
                <p className="qms-fatal-chip__team">{item.team}</p>
              </div>
            ))}
          </div>
        </QmsCard>
      )}
    </div>
  );
}
