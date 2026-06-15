"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, useEffect } from "react";
import { ChevronDown, Download, Eye, Pencil, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { AuditDetailModal } from "@/components/audit-logs/audit-detail-modal";
import {
  applyFeedbackDateTimeChange,
  applyFeedbackStatusChange,
  FeedbackStatusDateTimeCell,
} from "@/components/audit-logs/feedback-status-datetime";
import { formatFeedbackDateTime } from "@/lib/audit/feedback-datetime";
import { Input, Select } from "@/components/primitives/field";
import { useToast } from "@/components/primitives/toast";
import { cn } from "@/lib/utils";
import { deleteAuditSubmissions, updateAuditFeedback } from "@/lib/actions/audit";
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
import {
  FeedbackStatusSelect,
  feedbackStatusClass,
} from "@/components/audit-logs/feedback-status-select";
import { canEditFeedbackDateTimeForStatus } from "@/lib/audit/feedback-status-access";
import { resolveMetricDate } from "@/lib/audit/metric-dates";
import type { SessionRole } from "@/lib/rbac";

type AuditLogsTableProps = {
  submissions: AuditLogEntry[];
  showSectionHead?: boolean;
  enableFilters?: boolean;
  feedbackStatusRole?: SessionRole | null;
  canEditFeedbackFully?: boolean;
  canEditFeedbackDate?: boolean;
  canEditSupervisorRemarks?: boolean;
  canEditAudits?: boolean;
  canDeleteAudits?: boolean;
  isSuperAdmin?: boolean;
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

const DATE_RANGES: {
  value: DateRangeFilter;
  label: string;
  ariaLabel: string;
}[] = [
  { value: "all", label: "All", ariaLabel: "All time" },
  { value: "today", label: "Today", ariaLabel: "Today" },
  { value: "yesterday", label: "Yest.", ariaLabel: "Yesterday" },
  { value: "week", label: "Week", ariaLabel: "This week" },
  { value: "month", label: "Month", ariaLabel: "This month" },
  { value: "6m", label: "6 mo", ariaLabel: "Last 6 months" },
  { value: "1y", label: "1 yr", ariaLabel: "Last year" },
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
  return feedbackStatusClass(status);
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
    "Feedback Date & Time",
    "Acknowledged/Disputed Date & Time",
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
      r.feedbackDate ? formatFeedbackDateTime(r.feedbackDate) : "",
      r.feedbackStatusAt ? formatFeedbackDateTime(r.feedbackStatusAt) : "",
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
  feedbackStatusRole = null,
  canEditFeedbackFully = false,
  canEditFeedbackDate = false,
  canEditSupervisorRemarks = false,
  canEditAudits = false,
  canDeleteAudits = false,
  isSuperAdmin = false,
}: AuditLogsTableProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [scorePreset, setScorePreset] = useState<ScorePreset>("all");
  const [grade, setGrade] = useState("");
  const [type, setType] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [lob, setLob] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeFilter>("all");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [rows, setRows] = useState(submissions);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{
    ids: string[];
    label: string;
  } | null>(null);
  const [, startFeedback] = useTransition();
  const [deletePending, startDelete] = useTransition();

  const columnCount = canDeleteAudits ? 12 : 11;

  useEffect(() => {
    setRows(submissions);
  }, [submissions]);

  useEffect(() => {
    setSelectedIds((current) => {
      const rowIds = new Set(rows.map((row) => row.id));
      const next = new Set<string>();
      for (const id of current) {
        if (rowIds.has(id)) next.add(id);
      }
      return next.size === current.size ? current : next;
    });
  }, [rows]);

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
      if (!matchesDateRange(resolveMetricDate(row.auditDate, row.callDate), dateRange)) return false;
      if (grade && row.grade !== grade) return false;
      if (type && row.type !== type) return false;
      if (businessType && row.businessType !== businessType) return false;
      if (lob && row.lob !== lob) return false;
      if (feedbackStatus && row.feedbackStatus !== feedbackStatus) return false;
      return true;
    });
  }, [rows, search, scorePreset, dateRange, grade, type, businessType, lob, feedbackStatus]);

  const filteredIds = useMemo(() => filtered.map((row) => row.id), [filtered]);
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((row) => selectedIds.has(row.id));
  const someFilteredSelected =
    filtered.some((row) => selectedIds.has(row.id)) && !allFilteredSelected;
  const selectedCount = selectedIds.size;

  function toggleRowSelection(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleFilteredSelection(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of filteredIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function openDeleteConfirm(ids: string[]) {
    if (ids.length === 0) return;
    const label =
      ids.length === 1
        ? (rows.find((row) => row.id === ids[0])?.auditCode ?? "this audit")
        : `${ids.length} selected audits`;
    setDeleteConfirm({ ids, label });
  }

  function confirmDelete() {
    if (!deleteConfirm) return;
    const ids = deleteConfirm.ids;
    setDeleteConfirm(null);

    startDelete(async () => {
      const result = await deleteAuditSubmissions(ids);
      if ("error" in result && result.error) {
        toast(result.error, "error");
        return;
      }

      const deleted = "deleted" in result ? result.deleted : ids.length;
      setRows((current) => current.filter((row) => !ids.includes(row.id)));
      setSelectedIds((current) => {
        const next = new Set(current);
        for (const id of ids) next.delete(id);
        return next;
      });
      if (viewId && ids.includes(viewId)) {
        setViewId(null);
      }
      toast(
        deleted === 1
          ? "Audit deleted permanently."
          : `${deleted} audits deleted permanently.`,
        "success"
      );
    });
  }

  const hasActiveFilters =
    search.trim() !== "" ||
    scorePreset !== "all" ||
    dateRange !== "all" ||
    grade !== "" ||
    type !== "" ||
    businessType !== "" ||
    lob !== "" ||
    feedbackStatus !== "";

  const advancedFilterCount = useMemo(() => {
    let count = 0;
    if (dateRange !== "all") count++;
    if (scorePreset !== "all") count++;
    if (grade) count++;
    if (type) count++;
    if (businessType) count++;
    if (lob) count++;
    if (feedbackStatus) count++;
    return count;
  }, [dateRange, scorePreset, grade, type, businessType, lob, feedbackStatus]);

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];

    if (dateRange !== "all") {
      const item = DATE_RANGES.find((entry) => entry.value === dateRange);
      chips.push({
        key: "period",
        label: item?.ariaLabel ?? "Period",
        onRemove: () => setDateRange("all"),
      });
    }
    if (scorePreset !== "all") {
      const preset = SCORE_PRESETS.find((entry) => entry.value === scorePreset);
      chips.push({
        key: "score",
        label: preset?.label ?? "Score",
        onRemove: () => setScorePreset("all"),
      });
    }
    if (grade) {
      chips.push({
        key: "grade",
        label: `Grade: ${grade}`,
        onRemove: () => setGrade(""),
      });
    }
    if (type) {
      chips.push({
        key: "type",
        label: `Type: ${type}`,
        onRemove: () => setType(""),
      });
    }
    if (businessType) {
      chips.push({
        key: "business",
        label: businessType,
        onRemove: () => setBusinessType(""),
      });
    }
    if (lob) {
      chips.push({
        key: "lob",
        label: `LOB: ${lob}`,
        onRemove: () => setLob(""),
      });
    }
    if (feedbackStatus) {
      chips.push({
        key: "feedback",
        label: `Feedback: ${feedbackStatus}`,
        onRemove: () => setFeedbackStatus(""),
      });
    }

    return chips;
  }, [dateRange, scorePreset, grade, type, businessType, lob, feedbackStatus]);

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
        | "feedbackSecurity"
        | "feedbackStatus"
        | "feedbackDate"
        | "feedbackStatusAt"
      >
    >
  ) {
    let nextRow: AuditLogEntry | undefined;
    let previousRow: AuditLogEntry | undefined;

    setRows((current) =>
      current.map((row) => {
        if (row.id !== id) return row;
        previousRow = row;

        let next: AuditLogEntry = { ...row, ...patch };

        if (patch.feedbackStatus && patch.feedbackStatus !== row.feedbackStatus) {
          next = { ...next, ...applyFeedbackStatusChange(row, patch.feedbackStatus) };
        }

        if (patch.feedbackDate !== undefined || patch.feedbackStatusAt !== undefined) {
          const localValue =
            patch.feedbackStatusAt !== undefined
              ? (patch.feedbackStatusAt ?? "")
              : (patch.feedbackDate ?? "");
          next = {
            ...next,
            ...applyFeedbackDateTimeChange(next, localValue),
          };
        }

        nextRow = next;
        return next;
      })
    );

    if (!nextRow || !previousRow) return;

    startFeedback(async () => {
      const result = await updateAuditFeedback(id, {
        feedbackSecurity: nextRow!.feedbackSecurity,
        feedbackStatus: nextRow!.feedbackStatus,
        feedbackDate: nextRow!.feedbackDate ?? "",
        feedbackStatusAt: nextRow!.feedbackStatusAt ?? "",
      });

      if ("error" in result && result.error) {
        toast(result.error, "error");
        setRows((current) =>
          current.map((row) => (row.id === id ? previousRow! : row))
        );
        return;
      }

      if ("success" in result && result.success) {
        setRows((current) =>
          current.map((row) =>
            row.id === id
              ? {
                  ...row,
                  feedbackStatus: result.feedbackStatus ?? row.feedbackStatus,
                  feedbackDate: result.feedbackDate ?? null,
                  feedbackStatusAt: result.feedbackStatusAt ?? null,
                }
              : row
          )
        );
      }
    });
  }

  const canEditRowFeedbackDateTime = (row: AuditLogEntry) =>
    isSuperAdmin ||
    canEditFeedbackFully ||
    canEditFeedbackDateTimeForStatus(feedbackStatusRole, row.feedbackStatus);

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
            {canDeleteAudits && selectedCount > 0 ? (
              <>
                <span className="audit-logs__bulk-count">
                  {selectedCount} selected
                </span>
                <button
                  type="button"
                  className="ui-btn ui-btn--danger ui-btn--sm"
                  disabled={deletePending}
                  onClick={() => openDeleteConfirm(Array.from(selectedIds))}
                >
                  <Trash2 size={15} aria-hidden />
                  Delete selected
                </button>
                <button
                  type="button"
                  className="ui-btn ui-btn--secondary ui-btn--sm"
                  disabled={deletePending}
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear selection
                </button>
              </>
            ) : null}
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
        <section
          className={cn(
            "audit-logs__filters-panel",
            filtersExpanded && "audit-logs__filters-panel--expanded"
          )}
          aria-label="Audit log filters"
        >
          <div className="audit-logs__filters-bar">
            <div className="audit-logs__search">
              <Search size={16} className="audit-logs__search-icon" aria-hidden />
              <Input
                id="audit-logs-search"
                className="audit-logs__search-input"
                placeholder="Search agent, audit ID, LOB, reason, auditor…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search audit logs"
              />
            </div>
            <button
              type="button"
              className={cn(
                "audit-logs__filters-toggle",
                filtersExpanded && "audit-logs__filters-toggle--open",
                advancedFilterCount > 0 && "audit-logs__filters-toggle--active"
              )}
              onClick={() => setFiltersExpanded((open) => !open)}
              aria-expanded={filtersExpanded}
              aria-controls="audit-logs-filters-body"
            >
              <SlidersHorizontal size={15} aria-hidden />
              <span className="audit-logs__filters-toggle-text">
                {filtersExpanded ? "Hide filters" : "More filters"}
              </span>
              {!filtersExpanded && advancedFilterCount > 0 ? (
                <span className="audit-logs__filters-badge" aria-hidden>
                  {advancedFilterCount}
                </span>
              ) : null}
              <ChevronDown
                size={16}
                className={cn(
                  "audit-logs__filters-chevron",
                  filtersExpanded && "audit-logs__filters-chevron--open"
                )}
                aria-hidden
              />
            </button>
          </div>

          {activeFilterChips.length > 0 ? (
            <div className="audit-logs__active-filters">
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="audit-logs__filter-chip"
                  onClick={chip.onRemove}
                  title={`Remove ${chip.label} filter`}
                >
                  {chip.label}
                  <X size={12} aria-hidden />
                </button>
              ))}
              {hasActiveFilters ? (
                <button
                  type="button"
                  className="dash-filter-clear audit-logs__filter-clear"
                  onClick={clearFilters}
                >
                  Clear all
                </button>
              ) : null}
            </div>
          ) : null}

          <div
            id="audit-logs-filters-body"
            className="audit-logs__filters-body"
            aria-hidden={!filtersExpanded}
          >
            <div className="audit-logs__filters-body-inner">
              <div className="audit-logs__filters-section">
                <span className="audit-logs__filters-section-label">Period</span>
                <div
                  className="audit-logs__periods"
                  role="tablist"
                  aria-label="Audit date period"
                >
                  {DATE_RANGES.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      role="tab"
                      aria-selected={dateRange === item.value}
                      aria-label={item.ariaLabel}
                      title={item.ariaLabel}
                      className={cn(
                        "audit-logs__periods-btn",
                        dateRange === item.value &&
                          "audit-logs__periods-btn--active"
                      )}
                      onClick={() => setDateRange(item.value)}
                    >
                      <span className="audit-logs__periods-label">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="audit-logs__filters-grid">
                <label className="dash-filter">
                  <span>Score %</span>
                  <Select
                    id="audit-logs-score"
                    className="dash-select dash-select--filter"
                    value={scorePreset}
                    onChange={(e) => setScorePreset(e.target.value as ScorePreset)}
                  >
                    {SCORE_PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                  </Select>
                </label>

                <label className="dash-filter">
                  <span>Grade</span>
                  <Select
                    id="audit-logs-grade"
                    className="dash-select dash-select--filter"
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
                </label>

                <label className="dash-filter">
                  <span>Type</span>
                  <Select
                    id="audit-logs-type"
                    className="dash-select dash-select--filter"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option value="">All types</option>
                    <option value="Call">Call</option>
                    <option value="Chat">Chat</option>
                  </Select>
                </label>

                <label className="dash-filter">
                  <span>Business</span>
                  <Select
                    id="audit-logs-business"
                    className="dash-select dash-select--filter"
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                  >
                    <option value="">All business</option>
                    {businessTypeOptions.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </Select>
                </label>

                <label className="dash-filter">
                  <span>LOB</span>
                  <Select
                    id="audit-logs-lob"
                    className="dash-select dash-select--filter"
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
                </label>

                <label className="dash-filter">
                  <span>Feedback</span>
                  <Select
                    id="audit-logs-feedback"
                    className="dash-select dash-select--filter"
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
                </label>
              </div>
            </div>
          </div>
        </section>
      )}

      {!showSectionHead && enableFilters && rows.length > 0 && (
        <p className="audit-logs__result-count">{resultLabel}</p>
      )}

      <div className="ui-table-wrap audit-logs__table-wrap ui-scrollbar">
        <table className="ui-table audit-logs__table">
          <thead>
            <tr>
              {canDeleteAudits ? (
                <th className="audit-logs__select-col">
                  <input
                    type="checkbox"
                    className="audit-logs__checkbox"
                    checked={allFilteredSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = someFilteredSelected;
                    }}
                    onChange={(e) => toggleFilteredSelection(e.target.checked)}
                    disabled={filtered.length === 0 || deletePending}
                    aria-label="Select all visible audits"
                  />
                </th>
              ) : null}
              <th>Agent</th>
              <th>Type / LOB</th>
              <th>Audit date</th>
              <th>Auditor</th>
              <th>Score</th>
              <th>Grade</th>
              <th>Security</th>
              <th>Feedback</th>
              <th>Date &amp; time</th>
              <th>Feedback for the agent</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="ui-table__empty">
                  No audits yet.{" "}
                  <Link href="/forms/audit" className="audit-logs__empty-link">
                    Start your first audit
                  </Link>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="ui-table__empty">
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
                <tr
                  key={row.id}
                  className={cn(
                    selectedIds.has(row.id) && "audit-logs__row--selected"
                  )}
                >
                  {canDeleteAudits ? (
                    <td className="audit-logs__select-col">
                      <input
                        type="checkbox"
                        className="audit-logs__checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={(e) =>
                          toggleRowSelection(row.id, e.target.checked)
                        }
                        disabled={deletePending}
                        aria-label={`Select audit ${row.auditCode}`}
                      />
                    </td>
                  ) : null}
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
                  <td>{row.auditDate}</td>
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
                    {isSuperAdmin || canEditFeedbackFully ? (
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
                      <FeedbackStatusSelect
                        role={feedbackStatusRole}
                        value={row.feedbackStatus}
                        onChange={(feedbackStatus) =>
                          patchRowFeedback(row.id, { feedbackStatus })
                        }
                        ariaLabel={`Feedback status for ${row.agent}`}
                      />
                    )}
                  </td>
                  <td>
                    <FeedbackStatusDateTimeCell
                      row={row}
                      editable={canEditRowFeedbackDateTime(row)}
                      onChange={(datetimePatch) =>
                        patchRowFeedback(row.id, datetimePatch)
                      }
                    />
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
                      {canDeleteAudits ? (
                        <button
                          type="button"
                          className="audit-logs__action-btn audit-logs__action-btn--danger"
                          title="Delete audit"
                          disabled={deletePending}
                          onClick={() => openDeleteConfirm([row.id])}
                        >
                          <Trash2 size={15} aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AuditDetailModal
        auditId={viewId}
        canEditAudits={canEditAudits}
        canEditSupervisorRemarks={canEditSupervisorRemarks}
        onClose={() => setViewId(null)}
      />

      {deleteConfirm ? (
        <div className="platform-modal" role="dialog" aria-modal="true">
          <button
            type="button"
            className="platform-modal__backdrop"
            aria-label="Cancel delete"
            onClick={() => setDeleteConfirm(null)}
          />
          <div className="platform-modal__panel">
            <header className="platform-modal__head">
              <div>
                <h2 className="platform-modal__title">Delete audit record?</h2>
                <p className="platform-modal__sub">
                  {deleteConfirm.ids.length === 1
                    ? `Permanently delete ${deleteConfirm.label}. This cannot be undone.`
                    : `Permanently delete ${deleteConfirm.label}. This cannot be undone.`}
                </p>
              </div>
            </header>
            <div className="platform-modal__body">
              <div className="platform-settings__confirm-actions">
                <button
                  type="button"
                  className="ui-btn ui-btn--secondary"
                  disabled={deletePending}
                  onClick={() => setDeleteConfirm(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="ui-btn ui-btn--danger"
                  disabled={deletePending}
                  onClick={confirmDelete}
                >
                  {deletePending ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
