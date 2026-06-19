"use client";

import { CalendarRange, X } from "lucide-react";

export type DateRangeValue = { from: string; to: string };

type DateRangePickerProps = {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
  label?: string;
  className?: string;
};

export function DateRangePicker({
  value,
  onChange,
  label = "Date range",
  className = "",
}: DateRangePickerProps) {
  const isActive = !!(value.from || value.to);

  function clear() {
    onChange({ from: "", to: "" });
  }

  return (
    <div className={`drp ${className}`.trim()}>
      <span className="drp__label">
        <CalendarRange size={13} aria-hidden />
        {label}
      </span>
      <div className="drp__inputs">
        <input
          type="date"
          className="drp__input"
          value={value.from}
          max={value.to || undefined}
          aria-label="From date"
          onChange={(e) => onChange({ ...value, from: e.target.value })}
        />
        <span className="drp__sep" aria-hidden>—</span>
        <input
          type="date"
          className="drp__input"
          value={value.to}
          min={value.from || undefined}
          aria-label="To date"
          onChange={(e) => onChange({ ...value, to: e.target.value })}
        />
        {isActive && (
          <button
            type="button"
            className="drp__clear"
            onClick={clear}
            title="Clear date range"
            aria-label="Clear date range"
          >
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
