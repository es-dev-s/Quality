"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { QmsParameterStat } from "@/lib/audit/analytics-metrics";
import { QmsEmpty } from "@/components/analytics/qms-primitives";

const TARGET_SCORE = 90;
const MIN_RADAR_PARAMS = 3;
const RINGS = [0.4, 0.6, 0.8, 1.0];

const C = {
  targetStroke: "#4a90d9",
  targetFill: "rgba(74,144,217,0.18)",
  scoreStroke: "#d45a5a",
  scoreFill: "rgba(212,90,90,0.22)",
  grid: "#ddd",
  spoke: "#ddd",
  label: "#555",
  ringLabel: "#bbb",
};

type HitPoint = {
  x: number;
  y: number;
  name: string;
  score: number;
};

type TooltipState = {
  clientX: number;
  clientY: number;
  name: string;
  score: number;
} | null;

function getCanvasCoords(containerWidth: number, n: number) {
  const w = containerWidth;
  const h = Math.round(w * 0.82);
  const cx = w / 2;
  const cy = h / 2 - 10;
  const R = Math.min(w, h) * 0.36;
  const startAngle = -Math.PI / 2;
  return { w, h, cx, cy, R, startAngle };
}

function radialPoint(
  i: number,
  val: number,
  cx: number,
  cy: number,
  R: number,
  startAngle: number,
  N: number
): { x: number; y: number } {
  const a = startAngle + (i * 2 * Math.PI) / N;
  return { x: cx + val * R * Math.cos(a), y: cy + val * R * Math.sin(a) };
}

function drawRadarChart(
  canvas: HTMLCanvasElement,
  params: QmsParameterStat[]
): HitPoint[] {
  const N = params.length;
  const dpr = window.devicePixelRatio || 1;
  const containerWidth = (canvas.parentElement?.clientWidth ?? 480);
  const { w, h, cx, cy, R, startAngle } = getCanvasCoords(containerWidth, N);

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const pt = (i: number, val: number) =>
    radialPoint(i, val, cx, cy, R, startAngle, N);

  // ── Grid rings (polygon shaped, matching reference) ──────────────────────
  RINGS.forEach((v) => {
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const p = pt(i, v);
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Ring label near top spoke
    const lx = cx + v * R * Math.cos(startAngle) - 4;
    const ly = cy + v * R * Math.sin(startAngle) - 4;
    ctx.fillStyle = C.ringLabel;
    ctx.font = `${Math.round(R * 0.055)}px sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`${Math.round(v * 100)}%`, lx, ly);
  });

  // ── Spoke lines from centre to each vertex ────────────────────────────────
  for (let i = 0; i < N; i++) {
    const p = pt(i, 1.0);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = C.spoke;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // ── Filled polygon helper ─────────────────────────────────────────────────
  function drawPoly(
    context: CanvasRenderingContext2D,
    values: number[],
    fillColor: string,
    strokeColor: string,
    dot: "circle" | "square"
  ) {
    context.beginPath();
    for (let i = 0; i < N; i++) {
      const p = pt(i, values[i]);
      i === 0 ? context.moveTo(p.x, p.y) : context.lineTo(p.x, p.y);
    }
    context.closePath();
    context.fillStyle = fillColor;
    context.fill();
    context.strokeStyle = strokeColor;
    context.lineWidth = 1.5;
    context.stroke();

    for (let i = 0; i < N; i++) {
      const p = pt(i, values[i]);
      context.fillStyle = strokeColor;
      if (dot === "circle") {
        context.beginPath();
        context.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        context.fill();
      } else {
        context.fillRect(p.x - 3.5, p.y - 3.5, 7, 7);
      }
    }
  }

  // Blue = 90% target (constant); Red = actual score
  const targetVals = params.map(() => TARGET_SCORE / 100);
  const scoreVals = params.map((p) => Math.min(p.score, 100) / 100);

  drawPoly(ctx, targetVals, C.targetFill, C.targetStroke, "circle");
  drawPoly(ctx, scoreVals, C.scoreFill, C.scoreStroke, "square");

  // ── Axis labels ───────────────────────────────────────────────────────────
  const fontSize = Math.max(10, Math.round(R * 0.057));
  const PAD = R * 0.095;

  ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
  ctx.fillStyle = C.label;

  for (let i = 0; i < N; i++) {
    const angle = startAngle + (i * 2 * Math.PI) / N;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const lx = cx + (R + PAD) * cosA;
    const ly = cy + (R + PAD) * sinA;

    let align: CanvasTextAlign = "center";
    if (cosA < -0.15) align = "right";
    else if (cosA > 0.15) align = "left";
    ctx.textAlign = align;
    ctx.textBaseline = "middle";

    const label = params[i].name;
    const words = label.split(" ");

    // Wrap at a natural midpoint if the name is long
    if (label.length > 14 && words.length >= 2) {
      const mid = Math.ceil(words.length / 2);
      const line1 = words.slice(0, mid).join(" ");
      const line2 = words.slice(mid).join(" ");
      const lh = fontSize * 1.3;
      if (line2) {
        ctx.fillText(line1, lx, ly - lh / 2);
        ctx.fillText(line2, lx, ly + lh / 2);
      } else {
        ctx.fillText(line1, lx, ly);
      }
    } else {
      ctx.fillText(label, lx, ly);
    }
  }

  // Return score hit points for tooltip
  return params.map((p, i) => ({
    ...pt(i, scoreVals[i]),
    name: p.name,
    score: p.score,
  }));
}

export function ParameterRadarChart({ params }: { params: QmsParameterStat[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hitsRef = useRef<HitPoint[]>([]);
  const [tooltip, setTooltip] = useState<TooltipState>(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || params.length < MIN_RADAR_PARAMS) return;
    hitsRef.current = drawRadarChart(canvas, params);
  }, [params]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => redraw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [redraw]);

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const logicalW = parseFloat(canvas.style.width) || rect.width;
    const logicalH = parseFloat(canvas.style.height) || rect.height;
    const lx = (e.clientX - rect.left) * (logicalW / rect.width);
    const ly = (e.clientY - rect.top) * (logicalH / rect.height);

    let nearest: HitPoint | null = null;
    let minDist = 22;

    for (const hp of hitsRef.current) {
      const d = Math.hypot(hp.x - lx, hp.y - ly);
      if (d < minDist) {
        minDist = d;
        nearest = hp;
      }
    }

    if (nearest) {
      setTooltip({ clientX: e.clientX, clientY: e.clientY, name: nearest.name, score: nearest.score });
    } else {
      setTooltip(null);
    }
  }

  if (params.length < MIN_RADAR_PARAMS) {
    return (
      <div className="qms-radar-chart qms-radar-chart--empty">
        <QmsEmpty message="Radar view needs at least 3 parameters to draw a coverage map." />
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="qms-radar-chart qms-radar-canvas-wrap">
      {/* Legend — top-right, matching reference */}
      <div className="qms-radar-canvas-legend">
        <div className="qms-radar-canvas-legend__item">
          <svg width="22" height="12" aria-hidden>
            <line x1="0" y1="6" x2="22" y2="6" stroke="#4a90d9" strokeWidth="1.5" />
            <circle cx="11" cy="6" r="3" fill="#4a90d9" />
          </svg>
          <span>90% target</span>
        </div>
        <div className="qms-radar-canvas-legend__item">
          <svg width="22" height="12" aria-hidden>
            <line x1="0" y1="6" x2="22" y2="6" stroke="#d45a5a" strokeWidth="1.5" />
            <rect x="8" y="3" width="6" height="6" fill="#d45a5a" />
          </svg>
          <span>Parameter score</span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="qms-radar-canvas"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
        aria-label="Parameter coverage radar chart"
      />

      {tooltip ? (
        <div
          className="qms-radar-canvas-tooltip"
          style={{ left: tooltip.clientX + 14, top: tooltip.clientY - 44 }}
          role="tooltip"
        >
          <p className="qms-radar-canvas-tooltip__title">{tooltip.name}</p>
          <p className="qms-radar-canvas-tooltip__row">
            <span className="qms-radar-canvas-tooltip__swatch" style={{ background: "#d45a5a" }} />
            Score: <strong>{tooltip.score.toFixed(1)}%</strong>
          </p>
          <p className="qms-radar-canvas-tooltip__row">
            <span className="qms-radar-canvas-tooltip__swatch" style={{ background: "#4a90d9" }} />
            Target: <strong>{TARGET_SCORE}%</strong>
          </p>
        </div>
      ) : null}
    </div>
  );
}
