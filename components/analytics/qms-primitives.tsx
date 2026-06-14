"use client";

import type { ReactNode } from "react";
import { BarChart3 } from "lucide-react";
import {
  scoreColorClass,
  scoreStatusLabel,
} from "@/lib/audit/analytics-metrics";

/** Shared Recharts tooltip config — prevents clip and animation flicker. */
export const QMS_CHART_TOOLTIP = {
  wrapperStyle: { zIndex: 500, outline: "none" },
  isAnimationActive: false,
} as const;

/** Hex values aligned with design tokens — Recharts SVG requires literal colors. */
export const CHART_COLORS = {
  grid: "#e2e8f0",
  text: "#64748b",
  label: "#475569",
  accent: "#3b82f6",
  green: "#16a34a",
  amber: "#d97706",
  red: "#dc2626",
  purple: "#7c3aed",
};

export function scoreHex(score: number): string {
  if (score >= 95) return CHART_COLORS.green;
  if (score >= 90) return CHART_COLORS.accent;
  if (score >= 80) return CHART_COLORS.amber;
  return CHART_COLORS.red;
}

export function QmsCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`qms-card ${className}`.trim()}>{children}</section>;
}

export function QmsSectionTitle({
  title,
  sub,
}: {
  title: string;
  sub?: string;
}) {
  return (
    <div className="qms-section-title">
      <h3 className="qms-section-title__heading">{title}</h3>
      {sub ? <p className="qms-section-title__sub">{sub}</p> : null}
    </div>
  );
}

export function QmsBadge({
  label,
  score,
}: {
  label?: string;
  score: number;
}) {
  return (
    <span className={`qms-badge ${scoreColorClass(score)}`}>
      {label ?? scoreStatusLabel(score)}
    </span>
  );
}

export function QmsSparkline({ value }: { value: number }) {
  const width = Math.min(Math.max(value, 0), 100);
  return (
    <div className="qms-sparkline">
      <div
        className={`qms-sparkline__fill ${scoreColorClass(value)}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function QmsKpiTile({
  label,
  value,
  sub,
  tone = "default",
  compact = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "success" | "warn" | "danger" | "accent";
  compact?: boolean;
}) {
  const valueClass =
    tone === "default"
      ? "qms-kpi__value"
      : `qms-kpi__value qms-kpi__value--${tone}`;

  return (
    <article className="qms-kpi">
      <p className="qms-kpi__label">{label}</p>
      <p
        className={
          compact ? `${valueClass} qms-kpi__value--compact` : valueClass
        }
      >
        {value}
      </p>
      {sub ? <p className="qms-kpi__sub">{sub}</p> : null}
    </article>
  );
}

export function QmsGauge({ value, label }: { value: number; label: string }) {
  const r = 52;
  const cx = 60;
  const cy = 60;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(value / 100, 1);
  const dash = circumference * pct;
  const color = scoreHex(value);

  return (
    <div className="qms-gauge">
      <svg width={120} height={90} viewBox="0 0 120 100" aria-hidden>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={10}
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        <text
          x={cx}
          y={cy + 6}
          textAnchor="middle"
          fill={color}
          fontSize={18}
          fontWeight={800}
        >
          {value}%
        </text>
      </svg>
      <p className="qms-gauge__label">{label}</p>
    </div>
  );
}

export function QmsEmpty({ message }: { message: string }) {
  return (
    <div className="qms-empty" role="status">
      <BarChart3 className="qms-empty__icon" size={26} strokeWidth={1.75} aria-hidden />
      <p className="qms-empty__text">{message}</p>
    </div>
  );
}

export function QmsViewToggle({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="qms-view-toggle" role="tablist">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="tab"
          aria-selected={value === opt.id}
          className={
            value === opt.id
              ? "qms-view-toggle__btn qms-view-toggle__btn--active"
              : "qms-view-toggle__btn"
          }
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
