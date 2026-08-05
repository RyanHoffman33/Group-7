"use client";

export const ANALYTICS_COLORS = {
  revenue: "#2f9a57",
  cost: "#e11d48",
  forecast: "#1a7a45",
  band: "rgba(47, 154, 87, 0.18)",
  actualStroke: "#2f9a57",
  forecastStroke: "#1a7a45",
  marginPos: "#2f9a57",
  marginNeg: "#e11d48",
} as const;

export function ChartLegend({
  variant = "full",
}: {
  variant?: "full" | "projection" | "history";
}) {
  const items =
    variant === "projection"
      ? [
          { color: ANALYTICS_COLORS.revenue, label: "Actual revenue (history)" },
          {
            color: ANALYTICS_COLORS.forecastStroke,
            label: "Projected revenue",
            dashed: true,
          },
          { color: ANALYTICS_COLORS.band, label: "Confidence band", swatch: "band" },
        ]
      : variant === "history"
        ? [
            { color: ANALYTICS_COLORS.revenue, label: "Revenue (positive)" },
            { color: ANALYTICS_COLORS.cost, label: "Costs / COGS" },
            { color: ANALYTICS_COLORS.marginPos, label: "Positive margin" },
            { color: ANALYTICS_COLORS.marginNeg, label: "Negative margin" },
          ]
        : [
            { color: ANALYTICS_COLORS.revenue, label: "Revenue / positive" },
            { color: ANALYTICS_COLORS.cost, label: "Costs / negative" },
            {
              color: ANALYTICS_COLORS.forecastStroke,
              label: "Projected revenue (dashed)",
              dashed: true,
            },
            { color: ANALYTICS_COLORS.band, label: "Forecast band", swatch: "band" },
          ];

  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-[var(--muted)]">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          <span
            className={`inline-block h-2.5 w-3.5 shrink-0 rounded-sm ${
              "dashed" in item && item.dashed
                ? "border border-dashed bg-transparent"
                : ""
            }`}
            style={
              "dashed" in item && item.dashed
                ? { borderColor: item.color }
                : "swatch" in item && item.swatch === "band"
                  ? {
                      background: ANALYTICS_COLORS.band,
                      border: "1px solid #2f9a57",
                    }
                  : { background: item.color }
            }
            aria-hidden
          />
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
