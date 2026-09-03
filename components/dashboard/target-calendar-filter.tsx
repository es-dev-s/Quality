"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { DateRangeValue } from "@/components/primitives/date-range-picker";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

type TargetCalendarFilterProps = {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  monthlyTarget: number;
  onMonthlyTargetChange: (value: number) => void;
  canEditMonthlyTarget: boolean;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toIso(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function parseIso(value: string) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function monthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function formatShort(value: string) {
  const date = parseIso(value);
  if (!date) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function rangeText(from: string, to: string) {
  if (!from && !to) return "";
  if (from && to && from !== to) {
    return `${formatShort(from)} – ${formatShort(to)}`;
  }
  return formatShort(from || to);
}

export function TargetCalendarFilter({
  value,
  onChange,
  monthlyTarget,
  onMonthlyTargetChange,
  canEditMonthlyTarget,
}: TargetCalendarFilterProps) {
  const [open, setOpen] = useState(false);
  const [hoverIso, setHoverIso] = useState<string | null>(null);
  const [view, setView] = useState(() => {
    const start = parseIso(value.from) ?? new Date();
    return { year: start.getFullYear(), month: start.getMonth() };
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const active = Boolean(value.from || value.to);
  const pickingEnd = Boolean(value.from && value.to && value.from === value.to);

  useEffect(() => {
    if (!open) return;
    const start = parseIso(value.from) ?? new Date();
    setView({ year: start.getFullYear(), month: start.getMonth() });
    setHoverIso(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- only snap month when opening

  useEffect(() => {
    if (!open) return;

    function onMouseDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const preview = useMemo(() => {
    if (pickingEnd && hoverIso) {
      return hoverIso < value.from
        ? { from: hoverIso, to: value.from }
        : { from: value.from, to: hoverIso };
    }
    return { from: value.from, to: value.to || value.from };
  }, [pickingEnd, hoverIso, value.from, value.to]);

  const cells = useMemo(() => {
    const first = new Date(view.year, view.month, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
    const todayIso = toIso(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate()
    );
    const from = preview.from;
    const to = preview.to || preview.from;

    const items: Array<{
      key: string;
      iso?: string;
      day?: number;
      inMonth: boolean;
      isToday: boolean;
      isStart: boolean;
      isEnd: boolean;
      inRange: boolean;
      isPreview: boolean;
    }> = [];

    for (let i = 0; i < startPad; i++) {
      items.push({
        key: `pad-${i}`,
        inMonth: false,
        isToday: false,
        isStart: false,
        isEnd: false,
        inRange: false,
        isPreview: false,
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = toIso(view.year, view.month, day);
      const isStart = Boolean(from && iso === from);
      const isEnd = Boolean(from && to && iso === to);
      const inRange = Boolean(from && to && iso >= from && iso <= to);
      items.push({
        key: iso,
        iso,
        day,
        inMonth: true,
        isToday: iso === todayIso,
        isStart,
        isEnd,
        inRange,
        isPreview: Boolean(pickingEnd && hoverIso && inRange),
      });
    }

    while (items.length % 7 !== 0) {
      items.push({
        key: `trail-${items.length}`,
        inMonth: false,
        isToday: false,
        isStart: false,
        isEnd: false,
        inRange: false,
        isPreview: false,
      });
    }

    return items;
  }, [view.year, view.month, preview.from, preview.to, pickingEnd, hoverIso]);

  function pickDay(iso: string) {
    const hasCompleteRange = Boolean(
      value.from && value.to && value.from !== value.to
    );
    if (!value.from || hasCompleteRange) {
      onChange({ from: iso, to: iso });
      setHoverIso(null);
      return;
    }
    if (iso === value.from) {
      onChange({ from: iso, to: iso });
      setHoverIso(null);
      return;
    }
    if (iso < value.from) {
      onChange({ from: iso, to: value.from });
    } else {
      onChange({ from: value.from, to: iso });
    }
    setHoverIso(null);
  }

  function shiftMonth(delta: number) {
    const next = new Date(view.year, view.month + delta, 1);
    setView({ year: next.getFullYear(), month: next.getMonth() });
  }

  const selectedLabel = rangeText(value.from, value.to);
  const hoverLabel =
    pickingEnd && hoverIso ? rangeText(preview.from, preview.to) : "";

  return (
    <div ref={rootRef} className="dash-target-cal">
      <div className="dash-target-cal__tools">
        {selectedLabel ? (
          <span className="dash-target-cal__range">{selectedLabel}</span>
        ) : null}
        <button
          type="button"
          className={cn(
            "dash-target-cal__btn",
            active && "dash-target-cal__btn--active",
            open && "dash-target-cal__btn--open"
          )}
          aria-label="Filter auditor targets by date"
          aria-expanded={open}
          aria-controls={menuId}
          title={selectedLabel || "Filter by date"}
          onClick={() => setOpen((current) => !current)}
        >
          <Calendar size={16} aria-hidden />
        </button>
      </div>
      {open ? (
        <div
          id={menuId}
          className="dash-mini-cal"
          role="dialog"
          aria-label="Choose dates"
        >
          <div className="dash-mini-cal__top">
            <span className="dash-mini-cal__selected">
              {hoverLabel || selectedLabel || "Pick a date"}
            </span>
            <button
              type="button"
              className={cn(
                "dash-mini-cal__clear",
                !active && "dash-mini-cal__clear--hidden"
              )}
              tabIndex={active ? 0 : -1}
              onClick={() => {
                onChange({ from: "", to: "" });
                setHoverIso(null);
              }}
            >
              <X size={12} aria-hidden />
              Clear
            </button>
          </div>
          <div className="dash-mini-cal__nav">
            <button
              type="button"
              className="dash-mini-cal__nav-btn"
              aria-label="Previous month"
              onClick={() => shiftMonth(-1)}
            >
              <ChevronLeft size={16} />
            </button>
            <p className="dash-mini-cal__month">
              {monthLabel(view.year, view.month)}
            </p>
            <button
              type="button"
              className="dash-mini-cal__nav-btn"
              aria-label="Next month"
              onClick={() => shiftMonth(1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="dash-mini-cal__week" aria-hidden>
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div
            className="dash-mini-cal__grid"
            onMouseLeave={() => setHoverIso(null)}
          >
            {cells.map((cell) =>
              cell.inMonth && cell.iso ? (
                <button
                  key={cell.key}
                  type="button"
                  className={cn(
                    "dash-mini-cal__day",
                    cell.isToday && "dash-mini-cal__day--today",
                    cell.inRange && "dash-mini-cal__day--range",
                    cell.isPreview && "dash-mini-cal__day--preview",
                    cell.isStart && "dash-mini-cal__day--start",
                    cell.isEnd && "dash-mini-cal__day--end"
                  )}
                  onMouseEnter={() => pickingEnd && setHoverIso(cell.iso!)}
                  onClick={() => pickDay(cell.iso!)}
                >
                  {cell.day}
                </button>
              ) : (
                <span
                  key={cell.key}
                  className="dash-mini-cal__day dash-mini-cal__day--empty"
                />
              )
            )}
          </div>
          <label className="dash-mini-cal__target">
            <span>Total monthly target</span>
            <input
              type="number"
              min={1}
              max={99999}
              value={monthlyTarget}
              disabled={!canEditMonthlyTarget}
              readOnly={!canEditMonthlyTarget}
              title={
                canEditMonthlyTarget
                  ? "Set total monthly audit target for auditors"
                  : "Only Quality Manager and Superadmin can change this"
              }
              aria-label="Total monthly audit target for auditors"
              onChange={(e) => {
                if (!canEditMonthlyTarget) return;
                onMonthlyTargetChange(Math.max(1, Number(e.target.value) || 1));
              }}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
