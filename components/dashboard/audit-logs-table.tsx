"use client";

import { AuditDetailModal } from "@/components/audit-logs/audit-detail-modal";
import {
	applyFeedbackDateTimeChange,
	applyFeedbackStatusChange,
	FeedbackStatusDateTimeCell,
} from "@/components/audit-logs/feedback-status-datetime";
import {
	feedbackStatusClass,
	FeedbackStatusSelect,
} from "@/components/audit-logs/feedback-status-select";
import {
	ReferenceAttachmentView,
} from "@/components/audit-logs/reference-attachment-view";
import { HistoryBadge } from "@/components/audit/history-badge";
import { HistoryFilterSection } from "@/components/audit/history-filter-section";
import { FilterSelect } from "@/components/filters/filter-select";
import {
	FilterSidebar,
	FilterSidebarGrid,
	FilterSidebarSection,
} from "@/components/filters/filter-sidebar";
import { ConfirmModal } from "@/components/primitives/confirm-modal";
import {
	DataTablePanel,
} from "@/components/primitives/data-table-panel";
import { DateRangePicker,type DateRangeValue } from "@/components/primitives/date-range-picker";
import { Select } from "@/components/primitives/field";
import { LoadingZone } from "@/components/primitives/loading-zone";
import { useToast } from "@/components/primitives/toast";
import { deleteAuditSubmissions,updateAuditFeedback } from "@/lib/actions/audit";
import {
	buildAgentFilterSelectOptions,
	canFilterByAgent,
} from "@/lib/audit/agent-filter-access";
import type { AuditLogEntry } from "@/lib/audit/audit-records";
import {
	AUDIT_SOURCE_FILTER_OPTIONS,
	auditSourceChipLabel,
	type AuditSourceKind,
} from "@/lib/audit/audit-source";
import { AUDIT_TYPE_OPTIONS } from "@/lib/audit/audit-type";
import { formatCallDurationForType } from "@/lib/audit/call-duration";
import {
	type DateRangeFilter,
} from "@/lib/audit/date-filters";
import {
	FEEDBACK_SECURITY_OPTIONS,
	FEEDBACK_SEVERITY_LABEL,
	FEEDBACK_STATUS_OPTIONS,
	type FeedbackSecurity,
	type FeedbackStatus,
} from "@/lib/audit/feedback";
import { canEditFeedbackDateTimeForStatus } from "@/lib/audit/feedback-status-access";
import {
	viewerCanAccessTransferHistory,
	type AuditHistoryFilter,
} from "@/lib/audit/history-filter";
import { auditLogQueryString,localAuditDate,type AuditLogPage } from "@/lib/audit/log-query";
import type { MemberFeedbackMode } from "@/lib/audit/member-access";
import { formatSecondsAgo } from "@/lib/format-relative-time";
import { useAuditLogPage } from "@/lib/hooks/use-audit-log-page";
import { useBusyAction } from "@/lib/hooks/use-busy-action";
import { useFilterSidebar } from "@/lib/hooks/use-filter-sidebar";
import { useRealtime } from "@/lib/hooks/use-realtime";
import { SYSTEM_ROLE_SLUGS } from "@/lib/permissions";
import type { SessionRole } from "@/lib/rbac";
import { isAuditSSEEvent } from "@/lib/sse-events";
import type { TablePageSize } from "@/lib/ui/paginate-rows";
import { cn } from "@/lib/utils";
import { ArrowDownWideNarrow,ArrowUpNarrowWide,Download,Eye,Pencil,Trash2 } from "lucide-react";
import Link from "next/link";
import { startTransition,useCallback,useEffect,useMemo,useOptimistic,useRef,useState,type SetStateAction } from "react";

function rowIdsKey(rows: AuditLogEntry[]): string {
  if (rows.length === 0) return "";
  return rows
    .map((row) => row.id)
    .sort()
    .join("|");
}

type AuditLogsTableProps = {
  initialPage: AuditLogPage;
  roleSlug: string;
  showSectionHead?: boolean;
  enableFilters?: boolean;
  feedbackStatusRole?: SessionRole | null;
  memberFeedbackMode?: MemberFeedbackMode;
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

/** Updating this label must not re-render the table every second. */
function AuditLogSyncStatus({ fetchedAt }: { fetchedAt: number }) {
  const [now, setNow] = useState(fetchedAt);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return <>Updated {formatSecondsAgo(Math.max(0, Math.floor((now - fetchedAt) / 1000)))}</>;
}

const AUDIT_PAGE_SIZES: { value: TablePageSize; label: string }[] = [
  { value: 20, label: "20" }, { value: 50, label: "50" },
];

export function AuditLogsTable({
  initialPage,
  roleSlug,
  showSectionHead = true,
  enableFilters = true,
  feedbackStatusRole = null,
  memberFeedbackMode,
  canEditFeedbackFully = false,
  canEditSupervisorRemarks = false,
  canEditAudits = false,
  canDeleteAudits = false,
  canCreateAudit = false,
  canExport = false,
  isSuperAdmin = false,
}: AuditLogsTableProps) {
  const { toast } = useToast();
  const { query, setQuery, data: page, loading: pageLoading, error: pageError, refresh: refreshPage, changeFilters } = useAuditLogPage(initialPage);
  const [search, setSearch] = useState(query.search);
  const { scorePreset, grade, type, businessType, auditType, agent, feedbackStatus, auditSource, dateSort, historyFilter, dateRange } = query;
  const customRange = useMemo(() => ({ from: query.customFrom, to: query.customTo }), [query.customFrom, query.customTo]);
  const setScorePreset = useCallback((value: ScorePreset) => changeFilters({ scorePreset: value }), [changeFilters]);
  const setGrade = useCallback((value: string) => changeFilters({ grade: value }), [changeFilters]);
  const setType = useCallback((value: string) => changeFilters({ type: value as "" | "Call" | "Chat" }), [changeFilters]);
  const setBusinessType = useCallback((value: string) => changeFilters({ businessType: value }), [changeFilters]);
  const setAuditType = useCallback((value: string) => changeFilters({ auditType: value }), [changeFilters]);
  const setAgent = useCallback((value: string) => changeFilters({ agent: value }), [changeFilters]);
  const setFeedbackStatus = useCallback((value: string) => changeFilters({ feedbackStatus: value }), [changeFilters]);
  const setAuditSource = useCallback((value: AuditSourceKind | "") => changeFilters({ auditSource: value }), [changeFilters]);
  const setDateSort = useCallback((value: SetStateAction<"asc" | "desc">) => {
    setQuery((current) => ({ ...current, page: 1, dateSort: typeof value === "function" ? value(current.dateSort) : value }));
  }, [setQuery]);
  const setHistoryFilter = useCallback((value: AuditHistoryFilter) => changeFilters({ historyFilter: value }), [changeFilters]);
  const setDateRange = useCallback((value: DateRangeFilter) => changeFilters({ dateRange: value, today: localAuditDate() }), [changeFilters]);
  const setCustomRange = useCallback((value: DateRangeValue) => changeFilters({ customFrom: value.from, customTo: value.to }), [changeFilters]);

  useEffect(() => {
    const value = search.trim().slice(0, 200);
    if (value === query.search) return;
    const timer = window.setTimeout(() => changeFilters({ search: value }), 300);
    return () => window.clearTimeout(timer);
  }, [search, query.search, changeFilters]);
  const filterSidebar = useFilterSidebar();
  const [viewId, setViewId] = useState<string | null>(null);
  const [optimisticRows, applyOptimisticRows] = useOptimistic(
    page.submissions,
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
  const dbTotal = page.totalCount;
  const visibleRowIdsKey = useMemo(() => rowIdsKey(rows), [rows]);
  const reconcileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshCurrentPage = useCallback(() => {
    if (reconcileTimerRef.current) clearTimeout(reconcileTimerRef.current);
    reconcileTimerRef.current = null;
    refreshPage();
  }, [refreshPage]);
  const scheduleAuditLogsReconcile = useCallback(() => {
    if (reconcileTimerRef.current) clearTimeout(reconcileTimerRef.current);
    reconcileTimerRef.current = setTimeout(() => {
      reconcileTimerRef.current = null;
      refreshPage();
    }, 500);
  }, [refreshPage]);
  useEffect(() => () => {
    if (reconcileTimerRef.current) clearTimeout(reconcileTimerRef.current);
  }, []);
  const [selection, setSelection] = useState(() => ({ key: visibleRowIdsKey, ids: new Set<string>() }));
  const selectedIds = useMemo(() => selection.key === visibleRowIdsKey ? selection.ids : new Set<string>(), [selection, visibleRowIdsKey]);
  const setSelectedIds = useCallback((next: SetStateAction<Set<string>>) => {
    setSelection((current) => {
      const ids = current.key === visibleRowIdsKey ? current.ids : new Set<string>();
      return { key: visibleRowIdsKey, ids: typeof next === "function" ? next(ids) : next };
    });
  }, [visibleRowIdsKey]);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    ids: string[];
    label: string;
  } | null>(null);
  const { busy: deletePending, run: runDelete } = useBusyAction();
  const { busy: feedbackPending, run: runFeedback } = useBusyAction();
  const { busy: exportPending, run: runExport } = useBusyAction();
  const tableBusy = pageLoading || deletePending || exportPending;


  const handleRealtime = useCallback((event: Parameters<typeof isAuditSSEEvent>[0]) => {
    if (isAuditSSEEvent(event)) scheduleAuditLogsReconcile();
  }, [scheduleAuditLogsReconcile]);
  useRealtime(handleRealtime);

  const agentNames = page.filterOptions.agents;
  const showAgentFilter = canFilterByAgent(roleSlug) && agentNames.length > 0;
  const businessTypeOptions = page.filterOptions.businessTypes;

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
      { value: "", label: "All business types" },
      ...businessTypeOptions.map((value) => ({ value, label: value })),
    ],
    [businessTypeOptions]
  );

  const auditTypeFilterOptions = useMemo(
    () => [
      { value: "", label: "All audit types" },
      ...AUDIT_TYPE_OPTIONS.map((value) => ({ value, label: value })),
    ],
    []
  );

  const agentFilterOptions = useMemo(
    () => buildAgentFilterSelectOptions(agentNames),
    [agentNames]
  );

  const feedbackFilterOptions = useMemo(
    () => [
      { value: "", label: "All feedback" },
      ...FEEDBACK_STATUSES.map((status) => ({ value: status, label: status })),
    ],
    []
  );

  const sourceFilterOptions = useMemo(() => AUDIT_SOURCE_FILTER_OPTIONS, []);

  const setPage = (next: SetStateAction<number>) => setQuery((current) => ({
    ...current, page: typeof next === "function" ? next(current.page) : next,
  }));
  const setPageSize = (next: SetStateAction<TablePageSize>) => setQuery((current) => {
    const size = typeof next === "function" ? next(current.pageSize) : next;
    return { ...current, page: 1, pageSize: size === 50 ? 50 : 20 };
  });
  const handlePageSizeChange = (size: TablePageSize) => setPageSize(size);
  const pageStart = page.filteredCount ? (page.query.page - 1) * page.query.pageSize + 1 : 0;
  const pagination = {
    slice: rows, total: page.filteredCount, totalPages: page.totalPages,
    start: pageStart, end: page.filteredCount ? Math.min(pageStart + rows.length - 1, page.filteredCount) : 0,
    page: page.query.page, pageSize: query.pageSize,
    setPage, setPageSize, handlePageSizeChange,
  };
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
        refreshCurrentPage();
        return;
      }

      refreshCurrentPage();
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
    auditType !== "" ||
    agent !== "" ||
    feedbackStatus !== "" ||
    auditSource !== "" ||
    Boolean(customRange.from || customRange.to) ||
    historyFilter !== page.defaultHistoryFilter;

  const advancedFilterCount = useMemo(() => {
    let count = 0;
    if (customRange.from || customRange.to) count++;
    else if (dateRange !== "all") count++;
    if (scorePreset !== "all") count++;
    if (grade) count++;
    if (type) count++;
    if (agent) count++;
    if (feedbackStatus) count++;
    if (auditSource) count++;
    return count;
  }, [dateRange, customRange, scorePreset, grade, type, agent, feedbackStatus, auditSource]);

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
        label: `Business: ${businessType}`,
        onRemove: () => setBusinessType(""),
      });
    }
    if (auditType) {
      chips.push({
        key: "auditType",
        label: `Audit type: ${auditType}`,
        onRemove: () => setAuditType(""),
      });
    }
    if (agent) {
      chips.push({
        key: "agent",
        label: `Agent: ${agent}`,
        onRemove: () => setAgent(""),
      });
    }
    if (feedbackStatus) {
      chips.push({
        key: "feedback",
        label: `Feedback: ${feedbackStatus}`,
        onRemove: () => setFeedbackStatus(""),
      });
    }
    if (auditSource) {
      chips.push({
        key: "source",
        label: auditSourceChipLabel(auditSource),
        onRemove: () => setAuditSource(""),
      });
    }

    return chips;
  }, [dateRange, customRange, scorePreset, grade, type, businessType, auditType, agent, feedbackStatus, auditSource, setCustomRange, setDateRange, setScorePreset, setGrade, setType, setBusinessType, setAuditType, setAgent, setFeedbackStatus, setAuditSource]);

  const clearFilters = () => {
    setSearch("");
    changeFilters({ search: "", scorePreset: "all", dateRange: "all", customFrom: "", customTo: "", grade: "", type: "", businessType: "", auditType: "", agent: "", feedbackStatus: "", auditSource: "", historyFilter: page.defaultHistoryFilter });
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
    const current = rows.find((row) => row.id === id);
    if (current?.isHistory) return;

    const currentRow = rows.find((row) => row.id === id);
    if (!currentRow) return;
    const previousRow = currentRow;

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

    const nextRow = next;
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
        refreshCurrentPage();
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
    !row.isHistory &&
    (isSuperAdmin ||
      canEditFeedbackFully ||
      canEditFeedbackDateTimeForStatus(
        feedbackStatusRole,
        row.feedbackStatus,
        memberFeedbackMode
      ));

  const resultLabel =
    rows.length === 0
      ? "Saved audits will appear here after you complete a form."
      : hasActiveFilters
        ? page.filteredCount === 0
          ? "No audits match your filters."
          : `Showing ${pagination.start}–${pagination.end} of ${page.filteredCount} filtered audit${
              page.filteredCount === 1 ? "" : "s"
            } (${dbTotal} saved).`
        : page.filteredCount === 0
          ? "No audits to display."
          : `Showing ${pagination.start}–${pagination.end} of ${dbTotal} saved audit${
              dbTotal === 1 ? "" : "s"
            }.`;

  function handleExportCsv() {
    if (page.filteredCount === 0) return;
    void runExport(async () => {
      try {
        const response = await fetch(`/api/audit-logs/export?${auditLogQueryString(page.query)}`, { cache: "no-store" });
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error ?? "Could not export audit logs.");
        }
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement("a");
        link.href = url;
        link.download = `audit-logs-${Date.now()}.csv`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast("Exported matching audits with full details.", "success");
      } catch (error) {
        toast(error instanceof Error ? error.message : "Could not export audit logs.", "error");
      }
    });
  }

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
      {canExport && page.filteredCount > 0 ? (
        <button
          type="button"
          className="ui-btn ui-btn--secondary ui-btn--sm"
          disabled={exportPending || pageLoading}
          onClick={handleExportCsv}
        >
          <Download size={15} aria-hidden />
          Export CSV ({page.filteredCount})
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
              <AuditLogSyncStatus fetchedAt={page.fetchedAt} />
            </span>
            {toolbarActions}
          </div>
        </div>
      )}


      {enableFilters && dbTotal > 0 ? (
        <FilterSidebar
          open={filterSidebar.open}
          onOpenChange={filterSidebar.onOpenChange}
          title="Audit filters"
          description="Refine by period, score, grade, type, agent, feedback status, or audit source."
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

          <HistoryFilterSection
            value={historyFilter}
            onChange={setHistoryFilter}
            show={
              viewerCanAccessTransferHistory(roleSlug) &&
              rows.some((row) => row.isHistory)
            }
          />

          <FilterSidebarSection label="Details">
            <FilterSidebarGrid>
              {showAgentFilter ? (
                <label className="dash-filter">
                  <span>Agent</span>
                  <FilterSelect
                    id="audit-logs-agent"
                    value={agent}
                    onChange={setAgent}
                    options={agentFilterOptions}
                    ariaLabel="Filter by agent"
                    searchable
                    searchPlaceholder="Search agents…"
                  />
                </label>
              ) : null}
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
                <span>Feedback</span>
                <FilterSelect
                  id="audit-logs-feedback"
                  value={feedbackStatus}
                  onChange={setFeedbackStatus}
                  options={feedbackFilterOptions}
                  ariaLabel="Filter by feedback status"
                />
              </label>

              <label className="dash-filter">
                <span>Audit source</span>
                <FilterSelect
                  id="audit-logs-source"
                  value={auditSource}
                  onChange={(value) =>
                    setAuditSource(value as AuditSourceKind | "")
                  }
                  options={sourceFilterOptions}
                  ariaLabel="Filter by audit source"
                />
              </label>
            </FilterSidebarGrid>
          </FilterSidebarSection>
        </FilterSidebar>
      ) : null}

      {pageError ? <p role="alert" className="platform-empty platform-empty--error">{pageError} <button type="button" className="ui-btn ui-btn--secondary ui-btn--sm" onClick={refreshCurrentPage}>Try again</button></p> : null}
      <LoadingZone
        loading={tableBusy}
        label={
          deletePending
            ? "Deleting audits…"
            : exportPending
              ? "Exporting audits…"
              : feedbackPending
                ? "Saving feedback…"
                : "Updating…"
        }
        className="audit-logs-page__table-zone loading-zone--fill"
      >
        {dbTotal === 0 ? (
          <div className="platform-report-table-empty">
            {roleSlug === SYSTEM_ROLE_SLUGS.MEMBER ? (
              <>
                No access assigned yet. Ask a Quality Manager to grant Agent or
                QA visibility.
              </>
            ) : (
              <>
                No audits yet.
                {canCreateAudit ? (
                  <>
                    {" "}
                    <Link href="/forms/audit" className="audit-logs__empty-link">
                      Start your first audit
                    </Link>
                  </>
                ) : null}
              </>
            )}
          </div>
        ) : (
          <DataTablePanel
            pagination={pagination}
            pageSizeOptions={AUDIT_PAGE_SIZES}
            paginationPending={pageLoading}
            fillViewport
            scrollClassName="audit-logs-page__table-scroll"
            summaryLabel={
              dbTotal > 0
                ? hasActiveFilters
                  ? `${page.filteredCount} of ${dbTotal} audit${dbTotal === 1 ? "" : "s"}`
                  : `${dbTotal} audit${dbTotal === 1 ? "" : "s"}`
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
            toolbarFilters={
              enableFilters ? (
                <>
                  <label className="pf-inline-filter">
                    <span className="pf-inline-filter__label">Audit type</span>
                    <FilterSelect
                      id="audit-logs-audit-type"
                      value={auditType}
                      onChange={setAuditType}
                      options={auditTypeFilterOptions}
                      ariaLabel="Filter by audit type"
                    />
                  </label>
                  <label className="pf-inline-filter">
                    <span className="pf-inline-filter__label">Business type</span>
                    <FilterSelect
                      id="audit-logs-business"
                      value={businessType}
                      onChange={setBusinessType}
                      options={businessFilterOptions}
                      ariaLabel="Filter by business type"
                    />
                  </label>
                </>
              ) : undefined
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
                    <th className="col-duration">Call duration</th>
                    <th>
                      <button
                        type="button"
                        className="audit-logs__date-sort"
                        onClick={() =>
                          setDateSort((current) =>
                            current === "desc" ? "asc" : "desc"
                          )
                        }
                        aria-label={
                          dateSort === "desc"
                            ? "Sort by audit date ascending"
                            : "Sort by audit date descending"
                        }
                        title={
                          dateSort === "desc"
                            ? "Newest first — click for oldest first"
                            : "Oldest first — click for newest first"
                        }
                      >
                        Audit date
                        {dateSort === "desc" ? (
                          <ArrowDownWideNarrow
                            size={14}
                            className="audit-logs__date-sort-icon"
                            aria-hidden
                          />
                        ) : (
                          <ArrowUpNarrowWide
                            size={14}
                            className="audit-logs__date-sort-icon"
                            aria-hidden
                          />
                        )}
                      </button>
                    </th>
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
                        disabled={deletePending || row.isHistory}
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
                          {row.isHistory ? (
                            <>
                              {" "}
                              <HistoryBadge />
                            </>
                          ) : null}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="col-type-lob">
                    <span className="audit-logs__type">
                      {row.type}
                      <span className="audit-logs__type-meta">
                        {row.businessType}
                        {row.auditType?.trim() ? ` · ${row.auditType}` : ""}
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
                  <td className="col-duration">
                    {formatCallDurationForType(row.type, row.callDurationSec) ? (
                      <span className="audit-logs__duration">
                        {formatCallDurationForType(row.type, row.callDurationSec)}
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
                    {canEditFeedbackFully && !row.isHistory ? (
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
                    {row.isHistory ? (
                      <span
                        className={cn(
                          "audit-logs__feedback",
                          feedbackClass(row.feedbackStatus)
                        )}
                      >
                        {row.feedbackStatus}
                      </span>
                    ) : isSuperAdmin || canEditFeedbackFully ? (
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
                        key={`${row.id}-${row.feedbackStatus}`}
                        role={feedbackStatusRole}
                        memberFeedbackMode={memberFeedbackMode}
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
                      {canEditAudits && !row.isHistory ? (
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
                          disabled={deletePending || row.isHistory}
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
