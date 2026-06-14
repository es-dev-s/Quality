export type DateRangeFilter =
  | "all"
  | "today"
  | "yesterday"
  | "week"
  | "month"
  | "6m"
  | "1y";

function parseYmd(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfWeekMonday(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

export function matchesDateRange(
  callDate: string,
  range: DateRangeFilter,
  now = new Date()
): boolean {
  if (range === "all") return true;

  const date = parseYmd(callDate);
  const today = startOfDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (range === "today") return isSameDay(date, today);
  if (range === "yesterday") return isSameDay(date, yesterday);

  if (range === "week") {
    const weekStart = startOfWeekMonday(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return date >= weekStart && date < weekEnd;
  }

  if (range === "month") {
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
  }

  if (range === "6m") return date >= addMonths(now, -6);
  if (range === "1y") return date >= addMonths(now, -12);

  return true;
}
