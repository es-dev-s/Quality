"use client";

import Link from "next/link";
import { useMemo, useState, useEffect, useOptimistic, useCallback, useRef, startTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, Pencil, Trash2 } from "lucide-react";
import {
  FilterSidebar,
  FilterSidebarGrid,
  FilterSidebarSection,
} from "@/components/filters/filter-sidebar";
import { FilterSelect } from "@/components/filters/filter-select";
import { useFilterSidebar } from "@/lib/hooks/use-filter-sidebar";
import { useBusyAction } from "@/lib/hooks/use-busy-action";
import { AuditDetailModal } from "@/components/audit-logs/audit-detail-modal";
import {
  ReferenceAttachmentView,
  referenceAttachmentSearchText,
} from "@/components/audit-logs/reference-attachment-view";
import {
  applyFeedbackDateTimeChange,
  applyFeedbackStatusChange,
  FeedbackStatusDateTimeCell,
} from "@/components/audit-logs/feedback-status-datetime";
import { formatFeedbackDateTime } from "@/lib/audit/feedback-datetime";
import { Select } from "@/components/primitives/field";
import {
  DataTablePanel,
  usePaginatedRows,
} from "@/components/primitives/data-table-panel";
import { useToast } from "@/components/primitives/toast";
import { LoadingZone } from "@/components/primitives/loading-zone";
import { ConfirmModal } from "@/components/primitives/confirm-modal";
import { cn } from "@/lib/utils";
import { deleteAuditSubmissions, updateAuditFeedback } from "@/lib/actions/audit";
import type { AuditLogEntry } from "@/lib/audit/audit-records";
import {
  FEEDBACK_SECURITY_OPTIONS,
  FEEDBACK_SEVERITY_LABEL,
  FEEDBACK_STATUS_OPTIONS,
  type FeedbackSecurity,
  type FeedbackStatus,
} from "@/lib/audit/feedback";
import {
  matchesDateRange,
  matchesCustomDateRange,
  type DateRangeFilter,
} from "@/lib/audit/date-filters";
import { DateRangePicker, type DateRangeValue } from "@/components/primitives/date-range-picker";
import {
  FeedbackStatusSelect,
  feedbackStatusClass,
} from "@/components/audit-logs/feedback-status-select";
import { canEditFeedbackDateTimeForStatus } from "@/lib/audit/feedback-status-access";
import { resolveMetricDate } from "@/lib/audit/metric-dates";
import type { SessionRole } from "@/lib/rbac";
import { formatSecondsAgo } from "@/lib/format-relative-time";
import { useRealtime } from "@/lib/hooks/use-realtime";
import { isAuditSSEEvent } from "@/lib/sse-events";

function rowIdsKey(rows: AuditLogEntry[]): string {
  if (rows.length === 0) return "";
  return rows
    .map((row) => row.id)
    .sort()
    .join("|");
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) {
    if (!b.has(id)) return false;
  }
  return true;
}

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
  canCreateAudit?: boolean;
  canExport?: boolean;
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
    row.mobile,
    referenceAttachmentSearchText(row.referenceUrl),
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
    FEEDBACK_SEVERITY_LABEL,
    "Feedback Status",
    "Feedback Date & Time",
    "Acknowledged/Disputed Date & Time",
    "Feedback for the agent",
    "Number / client name",
    "Reference",
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
      r.mobile ?? "",
      r.referenceUrl ?? "",
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
  canCreateAudit = false,
  canExport = false,
  isSuperAdmin = false,
}: AuditLogsTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [lastSyncedAt, setLastSyncedAt] = useState(() => Date.now());
  const [secondsSinceSync, setSecondsSinceSync] = useState(0);
  const [search, setSearch] = useState("");
  const [scorePreset, setScorePreset] = useState<ScorePreset>("all");
  const [grade, setGrade] = useState("");
  const [type, setType] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [lob, setLob] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeFilter>("all");
  const [customRange, setCustomRange] = useState<DateRangeValue>({ from: "", to: "" });
  const filterSidebar = useFilterSidebar();
  const [viewId, setViewId] = useState<string | null>(null);
  const [optimisticRows, applyOptimisticRows] = useOptimistic(
    submissions,
    (
      current: AuditLogEntry[],
      action:
        | { type: "delete"; ids: string[] }
        | { type: "patch"; id: string; patch: Partial<AuditLogEntry> }
        | { type: "replace"; rows: AuditLogEntry[] }
    ) => {
      if (action.type === "delete") {
        const idSet = new Set(action.ids);
        return current.filter((row) => !idSet.has(row.id));
      }
      if (action.type === "replace") {
        return action.rows;
      }
      return current.map((row) =>
        row.id === action.id ? { ...row, ...action.patch } : row
      );
    }
  );
  const rows = optimisticRows;
  const visibleRowIdsKey = rowIdsKey(rows);
  const rowIdsRef = useRef(new Set<string>());
  const reconcileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    rowIdsRef.current = new Set(
      visibleRowIdsKey ? visibleRowIdsKey.split("|") : []
    );
  }, [visibleRowIdsKey]);

  const scheduleAuditLogsReconcile = useCallback(() => {
    if (reconcileTimerRef.current) {
      clearTimeout(reconcileTimerRef.current);
    }
    reconcileTimerRef.current = setTimeout(() => {
      router.refresh();
      reconcileTimerRef.current = null;
    }, 800);
  }, [router]);

  useEffect(() => {
    return () => {
      if (reconcileTimerRef.current) {
        clearTimeout(reconcileTimerRef.current);
      }
    };
  }, []);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{
    ids: string[];
    label: string;
  } | null>(null);
  const { busy: deletePending, run: runDelete } = useBusyAction();
  const { busy: feedbackPending, run: runFeedback } = useBusyAction();
  const tableBusy = deletePending;

  const columnCount = canDeleteAudits ? 14 : 13;

  useEffect(() => {
    setLastSyncedAt(Date.now());
  }, [submissions]);

  const handleRealtime = useCallback(
    (event: Parameters<typeof isAuditSSEEvent>[0]) => {
      if (!isAuditSSEEvent(event)) return;

      switch (event.type) {
        case "audit:created":
        case "invalidate":
          router.refresh();
          setLastSyncedAt(Date.now());
          break;
        case "audit:updated":
          if (event.changes) {
            const rowKnown = rowIdsRef.current.has(event.auditId);
            startTransition(() => {
              applyOptimisticRows({
                type: "patch",
                id: event.auditId,
                patch: event.changes as Partial<AuditLogEntry>,
              });
            });
            if (!rowKnown) {
              scheduleAuditLogsReconcile();
            }
          } else {
            router.refresh();
          }
          setLastSyncedAt(Date.now());
          break;
        case "audit:deleted":
          startTransition(() => {
            applyOptimisticRows({ type: "delete", ids: [event.auditId] });
          });
          setLastSyncedAt(Date.now());
          break;
      }
    },
    [router, applyOptimisticRows, scheduleAuditLogsReconcile]
  );

  useRealtime(handleRealtime);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setSecondsSinceSync(Math.floor((Date.now() - lastSyncedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(tick);
  }, [lastSyncedAt]);

  useEffect(() => {
    const rowIds = new Set(
      visibleRowIdsKey ? visibleRowIdsKey.split("|") : []
    );
    setSelectedIds((current) => {
      if (current.size === 0) return current;
      const next = new Set<string>();
      for (const id of current) {
        if (rowIds.has(id)) next.add(id);
      }
      return setsEqual(current, next) ? current : next;
    });
  }, [visibleRowIdsKey]);

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

  const scoreFilterOptions = useMemo(
    () => SCORE_PRESETS.map((preset) => ({ value: preset.value, label: preset.label })),
    []
  );

  const gradeFilterOptions = useMemo(
    () => [
      { value: "", label: "All grades" },
      ...GRADES.map((g) => ({ value: g, label: g })),
    ],
    []
  );

  const typeFilterOptions = useMemo(
    () => [
      { value: "", label: "All types" },
      { value: "Call", label: "Call" },
      { value: "Chat", label: "Chat" },
    ],
    []
  );

  const businessFilterOptions = useMemo(
    () => [
      { value: "", label: "All business" },
      ...businessTypeOptions.map((value) => ({ value, label: value })),
    ],
    [businessTypeOptions]
  );

  const lobFilterOptions = useMemo(
    () => [
      { value: "", label: "All LOBs" },
      ...lobs.map((name) => ({ value: name, label: name })),
    ],
    [lobs]
  );

  const feedbackFilterOptions = useMemo(
    () => [
      { value: "", label: "All feedback" },
      ...FEEDBACK_STATUSES.map((status) => ({ value: status, label: status })),
    ],
    []
  );

  const filtered = useMemo(() => {
    const hasCustom = !!(customRange.from || customRange.to);
    return rows.filter((row) => {
      if (!matchesSearch(row, search)) return false;
      if (!matchesScore(row, scorePreset)) return false;
      const metricDate = resolveMetricDate(row.auditDate, row.callDate);
      if (hasCustom) {
        if (!matchesCustomDateRange(metricDate, customRange.from, customRange.to)) return false;
      } else {
        if (!matchesDateRange(metricDate, dateRange)) return false;
      }
      if (grade && row.grade !== grade) return false;
      if (type && row.type !== type) return false;
      if (businessType && row.businessType !== businessType) return false;
      if (lob && row.lob !== lob) return false;
      if (feedbackStatus && row.feedbackStatus !== feedbackStatus) return false;
      return true;
    });
  }, [rows, search, scorePreset, dateRange, customRange, grade, type, businessType, lob, feedbackStatus]);

  const paginationResetKey = useMemo(
    () =>
      [
        search,
        scorePreset,
        dateRange,
        customRange.from,
        customRange.to,
        grade,
        type,
        businessType,
        lob,
        feedbackStatus,
        filtered.length,
      ].join("|"),
    [
      search,
      scorePreset,
      dateRange,
      customRange.from,
      customRange.to,
      grade,
      type,
      businessType,
      lob,
      feedbackStatus,
      filtered.length,
    ]
  );

  const pagination = usePaginatedRows(filtered, 20, paginationResetKey);
  const pageRows = pagination.slice;
  const pageIds = useMemo(() => pageRows.map((row) => row.id), [pageRows]);

  const allPageSelected =
    pageRows.length > 0 && pageRows.every((row) => selectedIds.has(row.id));
  const somePageSelected =
    pageRows.some((row) => selectedIds.has(row.id)) && !allPageSelected;
  const selectedCount = selectedIds.size;

  function toggleRowSelection(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function togglePageSelection(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of pageIds) {
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

    runDelete(async () => {
      startTransition(() => {
        applyOptimisticRows({ type: "delete", ids });
      });
      const result = await deleteAuditSubmissions(ids);
      if ("error" in result && result.error) {
        toast(result.error, "error");
        router.refresh();
        return;
      }

      const deleted = "deleted" in result ? result.deleted : ids.length;
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
    if (customRange.from || customRange.to) count++;
    else if (dateRange !== "all") count++;
    if (scorePreset !== "all") count++;
    if (grade) count++;
    if (type) count++;
    if (businessType) count++;
    if (lob) count++;
    if (feedbackStatus) count++;
    return count;
  }, [dateRange, customRange, scorePreset, grade, type, businessType, lob, feedbackStatus]);

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];

    if (customRange.from || customRange.to) {
      const label = [customRange.from, customRange.to].filter(Boolean).join(" — ");
      chips.push({
        key: "period",
        label,
        onRemove: () => setCustomRange({ from: "", to: "" }),
      });
    } else if (dateRange !== "all") {
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
  }, [dateRange, customRange, scorePreset, grade, type, businessType, lob, feedbackStatus]);

  const clearFilters = () => {
    setSearch("");
    setScorePreset("all");
    setDateRange("all");
    setCustomRange({ from: "", to: "" });
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

    const currentRow = rows.find((row) => row.id === id);
    if (!currentRow) return;
    previousRow = currentRow;

    let next: AuditLogEntry = { ...currentRow, ...patch };

    if (patch.feedbackStatus && patch.feedbackStatus !== currentRow.feedbackStatus) {
      next = { ...next, ...applyFeedbackStatusChange(currentRow, patch.feedbackStatus) };
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
    startTransition(() => {
      applyOptimisticRows({ type: "patch", id, patch: nextRow! });
    });

    runFeedback(async () => {
      const result = await updateAuditFeedback(id, {
        feedbackSecurity: nextRow!.feedbackSecurity,
        feedbackStatus: nextRow!.feedbackStatus,
        feedbackDate: nextRow!.feedbackDate ?? "",
        feedbackStatusAt: nextRow!.feedbackStatusAt ?? "",
      });

      if ("error" in result && result.error) {
        toast(result.error, "error");
        startTransition(() => {
          applyOptimisticRows({ type: "patch", id, patch: previousRow! });
        });
        return;
      }

      if ("success" in result && result.success) {
        const serverPatch = {
          feedbackStatus: result.feedbackStatus ?? nextRow!.feedbackStatus,
          feedbackDate: result.feedbackDate ?? null,
          feedbackStatusAt: result.feedbackStatusAt ?? null,
        };
        const needsSync =
          serverPatch.feedbackStatus !== nextRow!.feedbackStatus ||
          serverPatch.feedbackDate !== nextRow!.feedbackDate ||
          serverPatch.feedbackStatusAt !== nextRow!.feedbackStatusAt;
        if (needsSync) {
          startTransition(() => {
            applyOptimisticRows({
              type: "patch",
              id,
              patch: serverPatch,
            });
          });
        }
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
        ? filtered.length === 0
          ? "No audits match your filters."
          : `Showing ${pagination.start}–${pagination.end} of ${filtered.length} filtered audit${
              filtered.length === 1 ? "" : "s"
            } (${rows.length} total).`
        : filtered.length === 0
          ? "No audits to display."
          : `Showing ${pagination.start}–${pagination.end} of ${filtered.length} saved audit${
              filtered.length === 1 ? "" : "s"
            }.`;

  const toolbarActions = (
    <>
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
      {canExport && filtered.length > 0 ? (
        <button
          type="button"
          className="ui-btn ui-btn--secondary ui-btn--sm"
          onClick={() => exportCsv(filtered)}
        >
          <Download size={15} aria-hidden />
          Export CSV ({filtered.length})
        </button>
      ) : null}
      {canCreateAudit ? (
        <Link href="/forms/audit" className="ui-btn ui-btn--primary ui-btn--sm">
          New audit
        </Link>
      ) : null}
    </>
  );

  const showToolbarActions =
    rows.length > 0 &&
    (canExport || canCreateAudit || (canDeleteAudits && selectedCount > 0));

  return (
    <div className="audit-logs audit-logs-page">
      {showSectionHead && (
        <div className="audit-logs__head">
          <div>
            <h2 className="audit-logs__title">Audit history</h2>
            <p className="audit-logs__desc">{resultLabel}</p>
          </div>
          <div className="audit-logs__head-actions">
            <span className="table-meta" style={{ marginRight: "auto" }}>
              Updated {formatSecondsAgo(secondsSinceSync)}
            </span>
            {toolbarActions}
          </div>
        </div>
      )}


      {enableFilters && rows.length > 0 ? (
        <FilterSidebar
          open={filterSidebar.open}
          onOpenChange={filterSidebar.onOpenChange}
          title="Audit filters"
          description="Refine by period, score, grade, type, business, LOB, or feedback status."
          activeCount={advancedFilterCount}
          onClearAll={clearFilters}
          clearDisabled={!hasActiveFilters}
        >
          <FilterSidebarSection label="Period">
            <div
              className="filter-sidebar-periods audit-logs__periods"
              role="tablist"
              aria-label="Audit date period"
            >
              {DATE_RANGES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={
                    dateRange === item.value && !(customRange.from || customRange.to)
                  }
                  aria-label={item.ariaLabel}
                  title={item.ariaLabel}
                  className={cn(
                    "audit-logs__periods-btn",
                    dateRange === item.value &&
                      !(customRange.from || customRange.to) &&
                      "audit-logs__periods-btn--active"
                  )}
                  onClick={() => {
                    setCustomRange({ from: "", to: "" });
                    setDateRange(item.value);
                  }}
                >
                  <span className="audit-logs__periods-label">{item.label}</span>
                </button>
              ))}
            </div>
            <DateRangePicker
              value={customRange}
              onChange={(v) => {
                setCustomRange(v);
                if (v.from || v.to) setDateRange("all");
              }}
              label="Custom range"
              className="audit-logs__drp"
            />
          </FilterSidebarSection>

          <FilterSidebarSection label="Details">
            <FilterSidebarGrid>
              <label className="dash-filter">
                <span>Score %</span>
                <FilterSelect
                  id="audit-logs-score"
                  value={scorePreset}
                  onChange={(value) => setScorePreset(value as ScorePreset)}
                  options={scoreFilterOptions}
                  ariaLabel="Filter by score"
                />
              </label>

              <label className="dash-filter">
                <span>Grade</span>
                <FilterSelect
                  id="audit-logs-grade"
                  value={grade}
                  onChange={setGrade}
                  options={gradeFilterOptions}
                  ariaLabel="Filter by grade"
                />
              </label>

              <label className="dash-filter">
                <span>Type</span>
                <FilterSelect
                  id="audit-logs-type"
                  value={type}
                  onChange={setType}
                  options={typeFilterOptions}
                  ariaLabel="Filter by interaction type"
                />
              </label>

              <label className="dash-filter">
                <span>Business</span>
                <FilterSelect
                  id="audit-logs-business"
                  value={businessType}
                  onChange={setBusinessType}
                  options={businessFilterOptions}
                  ariaLabel="Filter by business type"
                />
              </label>

              <label className="dash-filter">
                <span>LOB</span>
                <FilterSelect
                  id="audit-logs-lob"
                  value={lob}
                  onChange={setLob}
                  options={lobFilterOptions}
                  ariaLabel="Filter by LOB"
                />
              </label>

              <label className="dash-filter">
                <span>Feedback</span>
                <FilterSelect
                  id="audit-logs-feedback"
                  value={feedbackStatus}
                  onChange={setFeedbackStatus}
                  options={feedbackFilterOptions}
                  ariaLabel="Filter by feedback status"
                />
              </label>
            </FilterSidebarGrid>
          </FilterSidebarSection>
        </FilterSidebar>
      ) : null}

      <LoadingZone
        loading={tableBusy}
        label={
          deletePending
            ? "Deleting audits…"
            : feedbackPending
              ? "Saving feedback…"
              : "Updating…"
        }
        className="audit-logs-page__table-zone loading-zone--fill"
      >
        {rows.length === 0 ? (
          <div className="platform-report-table-empty">
            No audits yet.
            {canCreateAudit ? (
              <>
                {" "}
                <Link href="/forms/audit" className="audit-logs__empty-link">
                  Start your first audit
                </Link>
              </>
            ) : null}
          </div>
        ) : (
          <DataTablePanel
            pagination={pagination}
            fillViewport
            scrollClassName="audit-logs-page__table-scroll"
            summaryLabel={
              rows.length > 0
                ? `${filtered.length} audit${filtered.length === 1 ? "" : "s"}`
                : undefined
            }
            search={
              enableFilters
                ? {
                    value: search,
                    onChange: setSearch,
                    placeholder: "Search agent, audit ID, LOB, reason, auditor…",
                    ariaLabel: "Search audit logs",
                  }
                : undefined
            }
            filterControl={
              enableFilters
                ? {
                    activeCount: advancedFilterCount,
                    onOpen: filterSidebar.openFilters,
                  }
                : undefined
            }
            filterChips={enableFilters ? activeFilterChips : undefined}
            onClearFilters={enableFilters ? clearFilters : undefined}
            headerActions={showToolbarActions ? toolbarActions : undefined}
            emptyState={
              <>
                No audits match your filters.{" "}
                <button
                  type="button"
                  className="audit-logs__empty-link"
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              </>
            }
            renderTable={(slice) => (
              <table className="ui-table audit-logs__table platform-report-table">
                <thead>
                  <tr>
                    {canDeleteAudits ? (
                      <th className="audit-logs__select-col">
                        <input
                          type="checkbox"
                          className="audit-logs__checkbox"
                          checked={allPageSelected}
                          ref={(input) => {
                            if (input) input.indeterminate = somePageSelected;
                          }}
                          onChange={(e) => togglePageSelection(e.target.checked)}
                          disabled={slice.length === 0 || deletePending}
                          aria-label="Select all audits on this page"
                        />
                      </th>
                    ) : null}
                    <th className="col-agent">Agent</th>
                    <th className="col-type-lob">Type / LOB</th>
                    <th className="col-contact">Number / client name</th>
                    <th>Audit date</th>
                    <th>Auditor</th>
                    <th>Score</th>
                    <th>Grade</th>
                    <th>{FEEDBACK_SEVERITY_LABEL}</th>
                    <th className="col-feedback-status">Feedback</th>
                    <th className="col-feedback-datetime">Date &amp; time</th>
                    <th className="col-agent-feedback">Feedback for the agent</th>
                    <th className="col-reference">Reference</th>
                    <th className="col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "audit-logs__row",
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
                  <td className="col-agent">
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
                  <td className="col-type-lob">
                    <span className="audit-logs__type">
                      {row.type}
                      <span className="audit-logs__type-meta">
                        {row.businessType}
                      </span>
                    </span>
                    <div className="dash-cell-muted">{row.lob}</div>
                  </td>
                  <td className="col-contact">
                    {row.mobile ? (
                      <span className="audit-logs__contact" title={row.mobile}>
                        {row.mobile}
                      </span>
                    ) : (
                      "—"
                    )}
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
                        aria-label={`${FEEDBACK_SEVERITY_LABEL} for ${row.agent}`}
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
                  <td className="col-feedback-status">
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
                  <td className="col-feedback-datetime">
                    <FeedbackStatusDateTimeCell
                      row={row}
                      editable={canEditRowFeedbackDateTime(row)}
                      onChange={(datetimePatch) =>
                        patchRowFeedback(row.id, datetimePatch)
                      }
                    />
                  </td>
                    <td className="col-agent-feedback">
                    <span
                      className="audit-logs__agent-feedback"
                      title={row.agentFeedback.trim() || undefined}
                    >
                      {row.agentFeedback.trim() || "—"}
                    </span>
                    </td>
                  <td className="col-reference">
                    <ReferenceAttachmentView
                      referenceUrl={row.referenceUrl}
                      interactionType={row.type}
                      variant="compact"
                    />
                  </td>
                  <td className="col-actions audit-logs__actions-cell">
                    <div
                      className="audit-logs__actions-bar"
                      role="group"
                      aria-label={`Actions for ${row.agent}`}
                    >
                      <button
                        type="button"
                        className="audit-logs__icon-action"
                        title="View audit"
                        aria-label={`View audit for ${row.agent}`}
                        onClick={() => setViewId(row.id)}
                      >
                        <Eye size={15} aria-hidden />
                      </button>
                      {canEditAudits ? (
                        <Link
                          href={`/audit-logs/${row.id}/edit`}
                          className="audit-logs__icon-action"
                          title="Edit audit"
                          aria-label={`Edit audit for ${row.agent}`}
                        >
                          <Pencil size={15} aria-hidden />
                        </Link>
                      ) : null}
                      {canDeleteAudits ? (
                        <button
                          type="button"
                          className="audit-logs__icon-action audit-logs__icon-action--danger"
                          title="Delete audit"
                          aria-label={`Delete audit for ${row.agent}`}
                          disabled={deletePending}
                          onClick={() => openDeleteConfirm([row.id])}
                        >
                          <Trash2 size={15} aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
                  ))}
                </tbody>
              </table>
            )}
          />
        )}
      </LoadingZone>

      <AuditDetailModal
        auditId={viewId}
        canEditAudits={canEditAudits}
        canEditSupervisorRemarks={canEditSupervisorRemarks}
        onClose={() => setViewId(null)}
      />

      <ConfirmModal
        open={Boolean(deleteConfirm)}
        onClose={() => setDeleteConfirm(null)}
        title="Delete audit record?"
        description={
          deleteConfirm
            ? `Permanently delete ${deleteConfirm.label}. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        loading={deletePending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
