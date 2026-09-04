"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { DateRangeValue } from "@/components/primitives/date-range-picker";
import { Z_INDEX } from "@/lib/ui/z-index";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const CALENDAR_WIDTH = 288;

type TargetCalendarFilterProps = {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  monthlyTarget: number;
  onMonthlyTargetChange: (value: number) => void;
  canEditMonthlyTarget: boolean;
  showMonthlyTarget?: boolean;
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

function orderedRange(a: string, b: string) {
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

export function TargetCalendarFilter({
  value,
  onChange,
  monthlyTarget,
  onMonthlyTargetChange,
  canEditMonthlyTarget,
  showMonthlyTarget = true,
}: TargetCalendarFilterProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hoverIso, setHoverIso] = useState<string | null>(null);
  const [anchorIso, setAnchorIso] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null
  );
  const [view, setView] = useState(() => {
    const start = parseIso(value.from) ?? new Date();
    return { year: start.getFullYear(), month: start.getMonth() };
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const active = Boolean(value.from || value.to);
  const pickingEnd = Boolean(anchorIso);

  useEffect(() => {
    setMounted(true);
  }, []);

  function positionMenu() {
    const trigger = rootRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const left = Math.min(
      Math.max(8, rect.right - CALENDAR_WIDTH),
      window.innerWidth - CALENDAR_WIDTH - 8
    );
    setMenuPos({ top: rect.bottom + 8, left });
  }

  useEffect(() => {
    if (!open) return;
    const start = parseIso(anchorIso || value.from) ?? new Date();
    setView({ year: start.getFullYear(), month: start.getMonth() });
    setHoverIso(null);
    positionMenu();

    function onScrollOrResize() {
      positionMenu();
    }

    window.addEventListener("resize", onScrollOrResize);
    document.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      document.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- snap month only when opening

  useEffect(() => {
    if (!open) return;

    function onMouseDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
      setAnchorIso(null);
      setHoverIso(null);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        setAnchorIso(null);
        setHoverIso(null);
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
    if (anchorIso) {
      const end = hoverIso || anchorIso;
      return orderedRange(anchorIso, end);
    }
    return { from: value.from, to: value.to || value.from };
  }, [anchorIso, hoverIso, value.from, value.to]);

  const displayFrom = preview.from;
  const displayTo = preview.to;

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
      const isEnd = Boolean(to && iso === to);
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
        isPreview: Boolean(pickingEnd && inRange),
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
  }, [view.year, view.month, preview.from, preview.to, pickingEnd]);

  function pickDay(iso: string) {
    if (!anchorIso) {
      setAnchorIso(iso);
      setHoverIso(iso);
      return;
    }
    const next = orderedRange(anchorIso, iso);
    onChange(next);
    setAnchorIso(null);
    setHoverIso(null);
  }

  function shiftMonth(delta: number) {
    const next = new Date(view.year, view.month + delta, 1);
    setView({ year: next.getFullYear(), month: next.getMonth() });
  }

  function toggleOpen() {
    setOpen((current) => {
      const next = !current;
      if (!next) {
        setAnchorIso(null);
        setHoverIso(null);
      }
      return next;
    });
  }

  const prompt = pickingEnd
    ? "Select end date"
    : displayFrom
      ? `${formatShort(displayFrom)}${
          displayTo && displayTo !== displayFrom
            ? ` – ${formatShort(displayTo)}`
            : ""
        }`
      : "Select start date";

  const calendar = open && menuPos ? (
    <div
      ref={menuRef}
      id={menuId}
      className="dash-mini-cal dash-mini-cal--portal"
      role="dialog"
      aria-label="Choose date range"
      style={{
        top: menuPos.top,
        left: menuPos.left,
        zIndex: Z_INDEX.dropdownPortal,
      }}
    >
      <div className="dash-mini-cal__top">
        <span className="dash-mini-cal__selected">{prompt}</span>
        <button
          type="button"
          className={cn(
            "dash-mini-cal__clear",
            !active && !pickingEnd && "dash-mini-cal__clear--hidden"
          )}
          tabIndex={active || pickingEnd ? 0 : -1}
          onClick={() => {
            onChange({ from: "", to: "" });
            setAnchorIso(null);
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
        onMouseLeave={() => pickingEnd && setHoverIso(anchorIso)}
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
      {showMonthlyTarget ? (
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
      ) : null}
    </div>
  ) : null;

  return (
    <div ref={rootRef} className="dash-target-cal">
      <button
        type="button"
        className={cn(
          "dash-target-cal__dates",
          (active || pickingEnd) && "dash-target-cal__dates--active"
        )}
        aria-label="Filter auditor targets by date range"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={toggleOpen}
      >
        <span
          className={cn(
            "dash-target-cal__date",
            !displayFrom && "dash-target-cal__date--empty"
          )}
        >
          <em>From</em>
          <strong>{displayFrom ? formatShort(displayFrom) : "Select"}</strong>
        </span>
        <span className="dash-target-cal__sep" aria-hidden>
          →
        </span>
        <span
          className={cn(
            "dash-target-cal__date",
            (!displayTo ||
              (pickingEnd && (!hoverIso || hoverIso === anchorIso))) &&
              "dash-target-cal__date--empty"
          )}
        >
          <em>To</em>
          <strong>
            {pickingEnd && (!hoverIso || hoverIso === anchorIso)
              ? "Select"
              : displayTo
                ? formatShort(displayTo)
                : "Select"}
          </strong>
        </span>
      </button>
      <button
        type="button"
        className={cn(
          "dash-target-cal__btn",
          active && "dash-target-cal__btn--active",
          open && "dash-target-cal__btn--open"
        )}
        aria-label="Open date calendar"
        aria-expanded={open}
        aria-controls={menuId}
        title="Filter by date"
        onClick={toggleOpen}
      >
        <Calendar size={16} aria-hidden />
      </button>
      {mounted && calendar ? createPortal(calendar, document.body) : null}
    </div>
  );
}
