"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, useEffect } from "react";
import { Download, Eye, Pencil, Search, X } from "lucide-react";
import { AuditDetailModal } from "@/components/audit-logs/audit-detail-modal";
import { Field, Input, Label, Select } from "@/components/primitives/field";
import { cn } from "@/lib/utils";
import { updateAuditFeedback } from "@/lib/actions/audit";
import type { AuditLogEntry } from "@/lib/audit/audit-records";
import {
  FEEDBACK_SECURITY_OPTIONS,
  FEEDBACK_STATUS_OPTIONS,
  type FeedbackSecurity,
  type FeedbackStatus,
} from "@/lib/audit/feedback";
import {
  matchesDateRange,
  type DateRangeFilter,
} from "@/lib/audit/date-filters";

type AuditLogsTableProps = {
  submissions: AuditLogEntry[];
  showSectionHead?: boolean;
  enableFilters?: boolean;
  canEditFeedbackStatus?: boolean;
  canEditFeedbackFully?: boolean;
  canEditAudits?: boolean;
};

type ScorePreset = "all" | "90+" | "75-89" | "50-74" | "1-49" | "0";

const SCORE_PRESETS: { value: ScorePreset; label: string; min: number; max: number }[] =
  [
    { value: "all", label: "All scores", min: 0, max: 100 },
    { value: "90+", label: "90%+", min: 90, max: 100 },
    { value: "75-89", label: "75–89%", min: 75, max: 89 },
    { value: "50-74", label: "50–74%", min: 50, max: 74 },
    { value: "1-49", label: "Below 50%", min: 1, max: 49 },
    { value: "0", label: "0% (Fatal)", min: 0, max: 0 },
  ];

const GRADES = ["Excellent", "Good", "Needs Improvement", "Failed"] as const;

const DATE_RANGES: { value: DateRangeFilter; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "6m", label: "Last 6 months" },
  { value: "1y", label: "Last year" },
];

const FEEDBACK_STATUSES = FEEDBACK_STATUS_OPTIONS;
const FEEDBACK_SECURITY_LEVELS = FEEDBACK_SECURITY_OPTIONS;

function securityClass(security: FeedbackSecurity) {
  if (security === "Critical") return "audit-logs__security--critical";
  if (security === "Medium") return "audit-logs__security--medium";
  if (security === "Low") return "audit-logs__security--low";
  return "audit-logs__security--na";
}

function gradeClass(grade: string) {
  if (grade === "Failed") return "dash-grade dash-grade--failed";
  if (grade === "Excellent") return "dash-grade dash-grade--excellent";
  if (grade === "Good") return "dash-grade dash-grade--good";
  return "dash-grade dash-grade--needs";
}

function feedbackClass(status: FeedbackStatus) {
  if (status === "Pending") return "audit-logs__feedback--pending";
  if (status === "Shared") return "audit-logs__feedback--shared";
  if (status === "Acknowledged") return "audit-logs__feedback--acknowledged";
  return "audit-logs__feedback--disputed";
}

function agentInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function matchesSearch(row: AuditLogEntry, query: string) {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  const haystack = [
    row.auditCode,
    row.agent,
    row.supervisor,
    row.lob,
    row.sublob,
    row.reason,
    row.auditor,
    row.grade,
    row.type,
    row.businessType,
    String(row.finalPct),
    row.feedbackSecurity,
    row.feedbackStatus,
    row.feedbackDate ?? "",
    row.agentFeedback,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function matchesScore(row: AuditLogEntry, preset: ScorePreset) {
  const range = SCORE_PRESETS.find((p) => p.value === preset) ?? SCORE_PRESETS[0];
  const score = row.hasFatal ? 0 : row.finalPct;
  return score >= range.min && score <= range.max;
}

function exportCsv(rows: AuditLogEntry[]) {
  const headers = [
    "Audit ID",
    "Agent",
    "Supervisor",
    "Type",
    "LOB",
    "Call Date",
    "Auditor",
    "Quality %",
    "Final %",
    "Grade",
    "Security",
    "Feedback Status",
    "Feedback Date",
    "Feedback for the agent",
  ];
  const lines = rows.map((r) =>
    [
      r.auditCode,
      r.agent,
      r.supervisor ?? "",
      r.type,
      r.lob,
      r.callDate,
      r.auditor ?? "",
      r.qualityPct,
      r.hasFatal ? 0 : r.finalPct,
      r.grade,
      r.feedbackSecurity,
      r.feedbackStatus,
      r.feedbackDate ?? "",
      r.agentFeedback,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  const blob = new Blob([[headers.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `audit-logs-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function AuditLogsTable({
  submissions,
  showSectionHead = true,
  enableFilters = true,
  canEditFeedbackStatus = false,
  canEditFeedbackFully = false,
  canEditAudits = false,
}: AuditLogsTableProps) {
  const [search, setSearch] = useState("");
  const [scorePreset, setScorePreset] = useState<ScorePreset>("all");
  const [grade, setGrade] = useState("");
  const [type, setType] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [lob, setLob] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeFilter>("all");
  const [viewId, setViewId] = useState<string | null>(null);
  const [rows, setRows] = useState(submissions);
  const [, startFeedback] = useTransition();

  useEffect(() => {
    setRows(submissions);
  }, [submissions]);

  const lobs = useMemo(
    () => [...new Set(rows.map((s) => s.lob))].sort(),
    [rows]
  );

  const businessTypeOptions = useMemo(
    () =>
      [...new Set(rows.map((row) => row.businessType))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [rows]
  );

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (!matchesSearch(row, search)) return false;
      if (!matchesScore(row, scorePreset)) return false;
      if (!matchesDateRange(row.callDate, dateRange)) return false;
      if (grade && row.grade !== grade) return false;
      if (type && row.type !== type) return false;
      if (businessType && row.businessType !== businessType) return false;
      if (lob && row.lob !== lob) return false;
      if (feedbackStatus && row.feedbackStatus !== feedbackStatus) return false;
      return true;
    });
  }, [rows, search, scorePreset, dateRange, grade, type, businessType, lob, feedbackStatus]);

  const hasActiveFilters =
    search.trim() !== "" ||
    scorePreset !== "all" ||
    dateRange !== "all" ||
    grade !== "" ||
    type !== "" ||
    businessType !== "" ||
    lob !== "" ||
    feedbackStatus !== "";

  const clearFilters = () => {
    setSearch("");
    setScorePreset("all");
    setDateRange("all");
    setGrade("");
    setType("");
    setBusinessType("");
    setLob("");
    setFeedbackStatus("");
  };

  function patchRowFeedback(
    id: string,
    patch: Partial<
      Pick<
        AuditLogEntry,
        "feedbackSecurity" | "feedbackStatus" | "feedbackDate"
      >
    >
  ) {
    let nextRow: AuditLogEntry | undefined;

    setRows((current) =>
      current.map((row) => {
        if (row.id !== id) return row;

        const feedbackStatus = patch.feedbackStatus ?? row.feedbackStatus;
        let feedbackDate =
          patch.feedbackDate !== undefined ? patch.feedbackDate : row.feedbackDate;

        if (feedbackStatus === "Pending") {
          feedbackDate = null;
        } else if (
          patch.feedbackStatus &&
          patch.feedbackStatus !== "Pending" &&
          !feedbackDate
        ) {
          feedbackDate = new Date().toISOString().slice(0, 10);
        }

        nextRow = {
          ...row,
          ...patch,
          feedbackStatus,
          feedbackDate,
        };
        return nextRow;
      })
    );

    if (!nextRow) return;

    startFeedback(async () => {
      await updateAuditFeedback(id, {
        feedbackSecurity: nextRow!.feedbackSecurity,
        feedbackStatus: nextRow!.feedbackStatus,
        feedbackDate: nextRow!.feedbackDate ?? "",
      });
    });
  }

  const resultLabel =
    rows.length === 0
      ? "Saved audits will appear here after you complete a form."
      : hasActiveFilters
        ? `Showing ${filtered.length} of ${rows.length} audit${
            rows.length === 1 ? "" : "s"
          }.`
        : `Showing ${rows.length} saved audit${rows.length === 1 ? "" : "s"}.`;

  return (
    <div className="audit-logs">
      {showSectionHead && (
        <div className="audit-logs__head">
          <div>
            <h2 className="audit-logs__title">Audit history</h2>
            <p className="audit-logs__desc">{resultLabel}</p>
          </div>
          <div className="audit-logs__head-actions">
            {filtered.length > 0 && (
              <button
                type="button"
                className="ui-btn ui-btn--secondary ui-btn--sm"
                onClick={() => exportCsv(filtered)}
              >
                <Download size={15} aria-hidden />
                Export CSV
              </button>
            )}
            <Link href="/forms/audit" className="ui-btn ui-btn--primary ui-btn--sm">
              New audit
            </Link>
          </div>
        </div>
      )}

      {enableFilters && rows.length > 0 && (
        <div className="audit-logs__filters">
          <Field className="audit-logs__filter audit-logs__filter--search">
            <Label htmlFor="audit-logs-search" className="audit-logs__filter-label">
              Search
            </Label>
            <div className="audit-logs__search-wrap">
              <Search size={16} className="audit-logs__search-icon" aria-hidden />
              <Input
                id="audit-logs-search"
                className="audit-logs__search-input"
                placeholder="Agent, ID, LOB, reason, auditor…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </Field>

          <Field className="audit-logs__filter">
            <Label htmlFor="audit-logs-period" className="audit-logs__filter-label">
              Period
            </Label>
            <Select
              id="audit-logs-period"
              value={dateRange}
              onChange={(e) =>
                setDateRange(e.target.value as DateRangeFilter)
              }
            >
              {DATE_RANGES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field className="audit-logs__filter">
            <Label htmlFor="audit-logs-score" className="audit-logs__filter-label">
              Score %
            </Label>
            <Select
              id="audit-logs-score"
              value={scorePreset}
              onChange={(e) => setScorePreset(e.target.value as ScorePreset)}
            >
              {SCORE_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field className="audit-logs__filter">
            <Label htmlFor="audit-logs-grade" className="audit-logs__filter-label">
              Grade
            </Label>
            <Select
              id="audit-logs-grade"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
            >
              <option value="">All grades</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </Field>

          <Field className="audit-logs__filter">
            <Label htmlFor="audit-logs-type" className="audit-logs__filter-label">
              Type
            </Label>
            <Select
              id="audit-logs-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="">All types</option>
              <option value="Call">Call</option>
              <option value="Chat">Chat</option>
            </Select>
          </Field>

          <Field className="audit-logs__filter">
            <Label
              htmlFor="audit-logs-business"
              className="audit-logs__filter-label"
            >
              Business
            </Label>
            <Select
              id="audit-logs-business"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
            >
              <option value="">All</option>
              {businessTypeOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>

          <Field className="audit-logs__filter">
            <Label htmlFor="audit-logs-lob" className="audit-logs__filter-label">
              LOB
            </Label>
            <Select
              id="audit-logs-lob"
              value={lob}
              onChange={(e) => setLob(e.target.value)}
            >
              <option value="">All LOBs</option>
              {lobs.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>

          <Field className="audit-logs__filter">
            <Label
              htmlFor="audit-logs-feedback"
              className="audit-logs__filter-label"
            >
              Feedback
            </Label>
            <Select
              id="audit-logs-feedback"
              value={feedbackStatus}
              onChange={(e) => setFeedbackStatus(e.target.value)}
            >
              <option value="">All feedback</option>
              {FEEDBACK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </Field>

          {hasActiveFilters && (
            <button
              type="button"
              className="audit-logs__clear"
              onClick={clearFilters}
            >
              <X size={14} aria-hidden />
              Clear
            </button>
          )}
        </div>
      )}

      {!showSectionHead && enableFilters && rows.length > 0 && (
        <p className="audit-logs__result-count">{resultLabel}</p>
      )}

      <div className="ui-table-wrap audit-logs__table-wrap ui-scrollbar">
        <table className="ui-table audit-logs__table">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Type / LOB</th>
              <th>Call date</th>
              <th>Auditor</th>
              <th>Score</th>
              <th>Grade</th>
              <th>Security</th>
              <th>Feedback</th>
              <th>Feedback date</th>
              <th>Feedback for the agent</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="ui-table__empty">
                  No audits yet.{" "}
                  <Link href="/forms/audit" className="audit-logs__empty-link">
                    Start your first audit
                  </Link>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="ui-table__empty">
                  No audits match your filters.{" "}
                  <button
                    type="button"
                    className="audit-logs__empty-link"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </button>
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="audit-logs__agent-cell">
                      <span className="audit-logs__avatar" aria-hidden>
                        {agentInitials(row.agent)}
                      </span>
                      <div className="audit-logs__agent-meta">
                        <span className="audit-logs__agent-name">{row.agent}</span>
                        <span className="audit-logs__agent-sub">
                          {row.auditCode}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="audit-logs__type">
                      {row.type}
                      <span className="audit-logs__type-meta">
                        {row.businessType}
                      </span>
                    </span>
                    <div className="dash-cell-muted">{row.lob}</div>
                  </td>
                  <td>{row.callDate}</td>
                  <td>{row.auditor ?? "—"}</td>
                  <td>
                    <span
                      className={cn(
                        "audit-logs__score",
                        row.hasFatal && "dash-score dash-score--fatal"
                      )}
                    >
                      {row.hasFatal ? "FAILED" : `${row.finalPct}%`}
                    </span>
                  </td>
                  <td>
                    <span className={gradeClass(row.grade)}>{row.grade}</span>
                  </td>
                  <td>
                    {canEditFeedbackFully ? (
                      <Select
                        className={cn(
                          "audit-logs__feedback audit-logs__security",
                          securityClass(row.feedbackSecurity)
                        )}
                        value={row.feedbackSecurity}
                        onChange={(e) =>
                          patchRowFeedback(row.id, {
                            feedbackSecurity: e.target.value as FeedbackSecurity,
                          })
                        }
                        aria-label={`Security for ${row.agent}`}
                      >
                        {FEEDBACK_SECURITY_LEVELS.map((level) => (
                          <option key={level} value={level}>
                            {level}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <span
                        className={cn(
                          "audit-logs__feedback audit-logs__security",
                          securityClass(row.feedbackSecurity)
                        )}
                      >
                        {row.feedbackSecurity}
                      </span>
                    )}
                  </td>
                  <td>
                    {canEditFeedbackStatus || canEditFeedbackFully ? (
                      <Select
                        className={cn(
                          "audit-logs__feedback",
                          feedbackClass(row.feedbackStatus)
                        )}
                        value={row.feedbackStatus}
                        onChange={(e) =>
                          patchRowFeedback(row.id, {
                            feedbackStatus: e.target.value as FeedbackStatus,
                          })
                        }
                        aria-label={`Feedback status for ${row.agent}`}
                      >
                        {FEEDBACK_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <span
                        className={cn(
                          "audit-logs__feedback",
                          feedbackClass(row.feedbackStatus)
                        )}
                      >
                        {row.feedbackStatus}
                      </span>
                    )}
                  </td>
                  <td>
                    {canEditFeedbackStatus || canEditFeedbackFully ? (
                      <Input
                        className="audit-logs__feedback-date"
                        type="date"
                        value={row.feedbackDate ?? ""}
                        disabled={row.feedbackStatus === "Pending"}
                        onChange={(e) =>
                          patchRowFeedback(row.id, {
                            feedbackDate: e.target.value || null,
                          })
                        }
                        aria-label={`Feedback date for ${row.agent}`}
                      />
                    ) : (
                      <span>{row.feedbackDate ?? "—"}</span>
                    )}
                  </td>
                  <td>
                    <span
                      className="audit-logs__agent-feedback"
                      title={row.agentFeedback || undefined}
                    >
                      {row.agentFeedback.trim() || "—"}
                    </span>
                  </td>
                  <td>
                    <div className="audit-logs__actions">
                      <button
                        type="button"
                        className="audit-logs__action-btn"
                        onClick={() => setViewId(row.id)}
                        title="View details"
                      >
                        <Eye size={15} aria-hidden />
                      </button>
                      {canEditAudits ? (
                        <Link
                          href={`/audit-logs/${row.id}/edit`}
                          className="audit-logs__action-btn"
                          title="Edit audit"
                        >
                          <Pencil size={15} aria-hidden />
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AuditDetailModal auditId={viewId} onClose={() => setViewId(null)} />
    </div>
  );
}
