"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
} from "recharts";
import type { QmsParameterStat } from "@/lib/audit/analytics-metrics";
import { QmsEmpty } from "@/components/analytics/qms-primitives";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const TARGET_SCORE = 90;
const MIN_RADAR_PARAMS = 3;
const MAX_LABELED_PARAMS = 10;

const chartConfig = {
  score: {
    label: "Score",
    color: "#3b82f6",
  },
  target: {
    label: "90% target",
    color: "#94a3b8",
  },
} satisfies ChartConfig;

type RadarPoint = {
  subject: string;
  fullName: string;
  score: number;
  target: number;
};

function radarSubjectLabel(name: string, total: number): string {
  const maxLen =
    total <= 6 ? 16 : total <= MAX_LABELED_PARAMS ? 12 : 0;
  if (maxLen === 0) return name;
  if (name.length <= maxLen) return name;
  return `${name.slice(0, maxLen - 1)}…`;
}

function buildRadarData(params: QmsParameterStat[]): RadarPoint[] {
  return params.map((p) => ({
    subject: radarSubjectLabel(p.name, params.length),
    fullName: p.name,
    score: p.score,
    target: TARGET_SCORE,
  }));
}

export function ParameterRadarChart({ params }: { params: QmsParameterStat[] }) {
  if (params.length < MIN_RADAR_PARAMS) {
    return (
      <div className="qms-radar-chart qms-radar-chart--empty">
        <QmsEmpty message="Radar view needs at least 3 parameters to draw a coverage map." />
      </div>
    );
  }

  const chartData = buildRadarData(params);
  const showAxisLabels = params.length <= MAX_LABELED_PARAMS;
  const outerRadius =
    params.length <= 6 ? "72%" : params.length <= 10 ? "68%" : "64%";

  return (
    <ChartContainer
      config={chartConfig}
      className="qms-radar-chart aspect-square"
      initialDimension={{ width: 380, height: 380 }}
    >
      <RadarChart
        data={chartData}
        cx="50%"
        cy="50%"
        outerRadius={outerRadius}
        margin={{ top: 16, right: 24, bottom: 8, left: 24 }}
      >
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(_, items) =>
                (items?.[0]?.payload as RadarPoint | undefined)?.fullName
              }
              formatter={(value, name) => {
                const label =
                  chartConfig[name as keyof typeof chartConfig]?.label ?? name;
                return [
                  `${Number(value).toFixed(1)}%`,
                  label,
                ];
              }}
            />
          }
        />
        <PolarGrid radialLines strokeDasharray="3 3" />
        <PolarAngleAxis
          dataKey="subject"
          tick={
            showAxisLabels
              ? { fontSize: 10, fill: "var(--color-muted-fg)" }
              : false
          }
          tickLine={false}
          axisLine={false}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tickCount={5}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 9, fill: "var(--color-muted-fg)" }}
          tickFormatter={(value) => `${value}%`}
        />
        <Radar
          name="target"
          dataKey="target"
          stroke="var(--color-target)"
          fill="none"
          strokeWidth={1.5}
          strokeDasharray="5 5"
          isAnimationActive={false}
        />
        <Radar
          name="score"
          dataKey="score"
          stroke="var(--color-score)"
          fill="var(--color-score)"
          fillOpacity={0.22}
          strokeWidth={2}
          dot={{ r: 3, fillOpacity: 1, fill: "var(--color-score)" }}
          activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
          isAnimationActive={false}
        />
        <ChartLegend content={<ChartLegendContent />} />
      </RadarChart>
    </ChartContainer>
  );
}
