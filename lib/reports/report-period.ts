export const REPORT_PERIODS = [
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
  "custom",
] as const;

export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export const REPORT_PERIOD_OPTIONS: {
  id: ReportPeriod;
  label: string;
  ariaLabel: string;
}[] = [
  { id: "weekly", label: "Weekly", ariaLabel: "This week, Monday to today" },
  { id: "monthly", label: "Monthly", ariaLabel: "This calendar month" },
  { id: "quarterly", label: "Quarterly", ariaLabel: "This calendar quarter" },
  { id: "yearly", label: "Yearly", ariaLabel: "This calendar year" },
  { id: "custom", label: "Custom", ariaLabel: "Custom audit date range" },
];

export type ReportInteractionType = "" | "Call" | "Chat";

export const REPORT_TYPE_OPTIONS: {
  id: ReportInteractionType;
  label: string;
  ariaLabel: string;
}[] = [
  { id: "", label: "Both", ariaLabel: "Call and chat combined" },
  { id: "Call", label: "Call", ariaLabel: "Call audits only" },
  { id: "Chat", label: "Chat", ariaLabel: "Chat audits only" },
];

export const REPORT_MAX_RANGE_DAYS = 366 * 5;

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function daysInclusive(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00`);
  const end = Date.parse(`${endDate}T00:00:00`);
  if (Number.isNaN(start) || Number.isNaN(end)) return Number.NaN;
  return Math.floor((end - start) / 86_400_000) + 1;
}

export function defaultReportFilters(now = new Date()): {
  startDate: string;
  endDate: string;
  agent: string;
  supervisor: string;
  type: ReportInteractionType;
  period: ReportPeriod;
} {
  const range = defaultReportDateRange(now);
  return {
    startDate: range.start,
    endDate: range.end,
    agent: "",
    supervisor: "",
    type: "",
    period: "custom",
  };
}

export function isDefaultReportDateRange(
  startDate: string,
  endDate: string,
  now = new Date()
): boolean {
  const range = defaultReportDateRange(now);
  return startDate === range.start && endDate === range.end;
}

export function periodMatchesRange(
  period: ReportPeriod,
  startDate: string,
  endDate: string,
  now = new Date()
): boolean {
  if (period === "custom") return true;
  const range = rangeForReportPeriod(period, now);
  return range.start === startDate && range.end === endDate;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfWeekMonday(now = new Date()): Date {
  const dayStart = startOfLocalDay(now);
  const weekday = dayStart.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  dayStart.setDate(dayStart.getDate() + diff);
  return dayStart;
}

/** Last 30 days including today — the Reports page default. */
export function defaultReportDateRange(now = new Date()): {
  start: string;
  end: string;
} {
  const today = startOfLocalDay(now);
  const start = new Date(today);
  start.setDate(start.getDate() - 30);
  return { start: toIsoDate(start), end: toIsoDate(today) };
}

export function rangeForReportPeriod(
  period: ReportPeriod,
  now = new Date()
): { start: string; end: string } {
  const today = startOfLocalDay(now);
  const end = toIsoDate(today);

  if (period === "weekly") {
    return { start: toIsoDate(startOfWeekMonday(today)), end };
  }

  if (period === "monthly") {
    return {
      start: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      end,
    };
  }

  if (period === "quarterly") {
    const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
    return {
      start: toIsoDate(new Date(today.getFullYear(), quarterStartMonth, 1)),
      end,
    };
  }

  if (period === "yearly") {
    return { start: toIsoDate(new Date(today.getFullYear(), 0, 1)), end };
  }

  return defaultReportDateRange(today);
}
