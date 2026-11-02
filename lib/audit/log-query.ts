import type { AuditLogEntry } from "@/lib/audit/audit-records";
import { auditSourceWhere } from "@/lib/audit/audit-source";
import { parseCallDuration } from "@/lib/audit/call-duration";
import type { AuditHistoryFilter } from "@/lib/audit/history-filter";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

export function localAuditDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const date = z.union([z.literal(""), z.iso.date()]);
const text = z.string().trim().max(200).default("");
export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().pipe(z.union([z.literal(20), z.literal(50)])).default(20),
  search: text,
  scorePreset: z.enum(["all", "90+", "75-89", "50-74", "1-49", "0"]).default("all"),
  grade: text,
  type: z.enum(["", "Call", "Chat"]).default(""),
  businessType: text,
  auditType: text,
  agent: text,
  feedbackStatus: text,
  auditSource: z.enum(["", "supervisor", "qa", "other"]).default(""),
  dateSort: z.enum(["asc", "desc"]).default("desc"),
  historyFilter: z.enum(["working", "history", "all"]).optional(),
  dateRange: z.enum(["all", "today", "yesterday", "week", "month", "3m", "6m", "1y", "custom"]).default("all"),
  customFrom: date.default(""),
  customTo: date.default(""),
  today: z.iso.date().default(() => localAuditDate()),
}).refine((query) => !query.customFrom || !query.customTo || query.customFrom <= query.customTo, {
  message: "Start date must be on or before end date.", path: ["customTo"],
});

export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>;
export type AuditLogQuery = AuditLogQueryInput & { historyFilter: AuditHistoryFilter };
export type AuditLogPage = {
  query: AuditLogQuery;
  submissions: AuditLogEntry[];
  totalCount: number;
  filteredCount: number;
  totalPages: number;
  defaultHistoryFilter: AuditHistoryFilter;
  filterOptions: { agents: string[]; businessTypes: string[] };
  fetchedAt: number;
};

export function auditLogQueryString(query: AuditLogQueryInput): string {
  return new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)])).toString();
}

export function auditLogDateBounds(query: AuditLogQueryInput): { gte?: string; lte?: string; lt?: string } | undefined {
  if (query.customFrom || query.customTo) {
    return { ...(query.customFrom ? { gte: query.customFrom } : {}), ...(query.customTo ? { lte: query.customTo } : {}) };
  }
  const today = new Date(`${query.today}T12:00:00`);
  const shifted = (days: number) => {
    const value = new Date(today);
    value.setDate(value.getDate() + days);
    return localAuditDate(value);
  };
  switch (query.dateRange) {
    case "today": return { gte: query.today, lte: query.today };
    case "yesterday": return { gte: shifted(-1), lte: shifted(-1) };
    case "week": {
      const monday = today.getDay() === 0 ? -6 : 1 - today.getDay();
      return { gte: shifted(monday), lt: shifted(monday + 7) };
    }
    case "month": return { gte: `${query.today.slice(0, 7)}-01`, lt: localAuditDate(new Date(today.getFullYear(), today.getMonth() + 1, 1)) };
    case "3m": case "6m": case "1y": {
      today.setMonth(today.getMonth() - (query.dateRange === "3m" ? 3 : query.dateRange === "6m" ? 6 : 12));
      return { gte: localAuditDate(today) };
    }
    default: return undefined;
  }
}

/** Every filter is ANDed with the server-derived row scope. */
export function auditLogWhere(scope: Prisma.AuditSubmissionWhereInput, query: AuditLogQuery): Prisma.AuditSubmissionWhereInput {
  const and: Prisma.AuditSubmissionWhereInput[] = [scope];
  if (query.historyFilter !== "all") and.push({ isHistory: query.historyFilter === "history" });
  for (const field of ["grade", "type", "businessType", "auditType", "agent", "feedbackStatus"] as const) {
    if (query[field]) and.push({ [field]: query[field] });
  }
  const source = auditSourceWhere(query.auditSource);
  if (source) and.push(source);
  const bounds = auditLogDateBounds(query);
  if (bounds) and.push({ OR: [{ auditDate: { not: "", ...bounds } }, { auditDate: "", callDate: bounds }] });
  if (query.scorePreset !== "all") {
    const ranges = { "90+": [90, 100], "75-89": [75, 89], "50-74": [50, 74], "1-49": [1, 49], "0": [0, 0] } as const;
    const [gte, lte] = ranges[query.scorePreset];
    const score = { hasFatal: false, finalPct: { gte, lte } };
    and.push(query.scorePreset === "0" ? { OR: [{ hasFatal: true }, score] } : score);
  }
  if (query.search) {
    const contains = { contains: query.search, mode: "insensitive" as const };
    const or: Prisma.AuditSubmissionWhereInput[] = [
      ...(["auditCode", "agent", "supervisor", "lob", "sublob", "reason", "auditor", "grade", "type", "businessType", "auditType", "feedbackSecurity", "feedbackStatus", "feedbackDate", "agentFeedback", "mobile", "referenceUrl"] as const).map((field) => ({ [field]: contains })),
      { submittedBy: { OR: [{ name: contains }, { email: contains }] } },
    ];
    const scores = Array.from({ length: 101 }, (_, score) => score).filter((score) => String(score).includes(query.search));
    if (scores.length) or.push({ finalPct: { in: scores } });
    const duration = parseCallDuration(query.search);
    if (duration !== null) or.push({ type: "Call", callDurationSec: duration });
    for (const source of ["supervisor", "qa", "other"] as const) {
      if (source.includes(query.search.toLowerCase())) or.push(auditSourceWhere(source)!);
    }
    and.push({ OR: or });
  }
  return { AND: and };
}

export function auditLogOrderBy(query: Pick<AuditLogQuery, "dateSort">): Prisma.AuditSubmissionOrderByWithRelationInput[] {
  return [{ auditDate: query.dateSort }, { createdAt: query.dateSort }, { auditCode: query.dateSort }, { id: query.dateSort }];
}
