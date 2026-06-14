"use client";

type TooltipPayload = {
  name?: string;
  value?: number | string;
  fill?: string;
  stroke?: string;
};

export function QmsChartTooltip({
  active,
  payload,
  label,
  suffix = "",
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="qms-chart-tooltip">
      {label ? <p className="qms-chart-tooltip__label">{label}</p> : null}
      {payload.map((item, index) => (
        <p key={index} className="qms-chart-tooltip__row">
          <span style={{ color: item.fill || item.stroke || undefined }}>
            {item.name}:
          </span>{" "}
          <strong>
            {typeof item.value === "number"
              ? item.value.toFixed(1)
              : item.value}
            {suffix}
          </strong>
        </p>
      ))}
    </div>
  );
}
