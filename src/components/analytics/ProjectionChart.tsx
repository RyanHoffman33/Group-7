import type { AnalyticsMonth } from "@/features/analytics/seed";
import type {
  ForecastConfidence,
  ForecastPoint,
} from "@/features/analytics/forecast";
import { Money } from "@/components/billing/ui";
import { ANALYTICS_COLORS, ChartLegend } from "@/components/analytics/ChartLegend";

function formatMonth(iso: string) {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

type PlotPoint = {
  key: string;
  label: string;
  revenue: number;
  low?: number;
  high?: number;
  kind: "actual" | "forecast";
};

export function ProjectionChart({
  history,
  forecast,
  showLegend = true,
  confidence,
}: {
  history: AnalyticsMonth[];
  forecast: ForecastPoint[];
  showLegend?: boolean;
  confidence?: ForecastConfidence;
}) {
  const hist = history.slice(-8);
  const points: PlotPoint[] = [
    ...hist.map((m) => ({
      key: m.month,
      label: formatMonth(m.month),
      revenue: m.revenue,
      kind: "actual" as const,
    })),
    ...forecast.map((p) => ({
      key: p.month,
      label: formatMonth(p.month),
      revenue: p.revenue,
      low: p.revenueLow,
      high: p.revenueHigh,
      kind: "forecast" as const,
    })),
  ];

  if (points.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">No projection data for this period.</p>
    );
  }

  const width = 640;
  const height = 220;
  const padL = 44;
  const padR = 16;
  const padT = 16;
  const padB = 36;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxY = Math.max(
    1,
    ...points.map((p) => p.revenue),
    ...points.map((p) => p.high ?? 0),
  );
  const minY = 0;

  const xAt = (i: number) =>
    padL + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const yAt = (v: number) =>
    padT + plotH - ((v - minY) / (maxY - minY || 1)) * plotH;

  const actualPts = points.filter((p) => p.kind === "actual");
  const forecastPts = points.filter((p) => p.kind === "forecast");
  const spliceIdx = actualPts.length - 1;

  const linePath = (subset: PlotPoint[], offset: number) =>
    subset
      .map((p, i) => {
        const idx = offset + i;
        return `${i === 0 ? "M" : "L"} ${xAt(idx).toFixed(1)} ${yAt(p.revenue).toFixed(1)}`;
      })
      .join(" ");

  const bridge =
    spliceIdx >= 0 && forecastPts.length
      ? `M ${xAt(spliceIdx).toFixed(1)} ${yAt(points[spliceIdx].revenue).toFixed(1)} L ${xAt(spliceIdx + 1).toFixed(1)} ${yAt(forecastPts[0].revenue).toFixed(1)}`
      : "";

  const bandPath = (() => {
    if (!forecastPts.length) return "";
    const start = spliceIdx >= 0 ? spliceIdx : 0;
    const highs: string[] = [];
    const lows: string[] = [];
    for (let i = 0; i < forecastPts.length; i++) {
      const idx = start + (spliceIdx >= 0 ? 1 : 0) + i;
      const p = forecastPts[i];
      highs.push(
        `${i === 0 ? "M" : "L"} ${xAt(idx).toFixed(1)} ${yAt(p.high ?? p.revenue).toFixed(1)}`,
      );
      lows.push(
        `L ${xAt(idx).toFixed(1)} ${yAt(p.low ?? p.revenue).toFixed(1)}`,
      );
    }
    lows.reverse();
    return `${highs.join(" ")} ${lows.join(" ")} Z`;
  })();

  const lastForecast = forecast[forecast.length - 1];
  const firstHist = hist[0];
  const intervalPct = confidence
    ? Math.round(confidence.intervalLevel * 100)
    : 80;

  return (
    <div>
      {showLegend ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <ChartLegend variant="projection" />
          {confidence ? (
            <p className="text-xs text-[var(--muted)]">
              Confidence:{" "}
              <span className="font-medium text-[var(--ink)]">
                {confidence.label} ({confidence.score}%)
              </span>
              <span className="text-[var(--muted)]">
                {" "}
                · {intervalPct}% band
              </span>
            </p>
          ) : null}
        </div>
      ) : confidence ? (
        <p className="mb-2 text-xs text-[var(--muted)]">
          Confidence:{" "}
          <span className="font-medium text-[var(--ink)]">
            {confidence.label} ({confidence.score}%)
          </span>
          <span>
            {" "}
            · {intervalPct}% prediction interval
          </span>
        </p>
      ) : null}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label="Projected revenue line chart"
      >
        {[0.25, 0.5, 0.75, 1].map((t) => {
          const y = yAt(minY + (maxY - minY) * t);
          return (
            <g key={t}>
              <line
                x1={padL}
                x2={width - padR}
                y1={y}
                y2={y}
                stroke="#eef2f6"
                strokeWidth={1}
              />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-[var(--muted)]"
                fontSize={9}
              >
                {Math.round((minY + (maxY - minY) * t) / 1000)}k
              </text>
            </g>
          );
        })}
        {bandPath ? (
          <path d={bandPath} fill={ANALYTICS_COLORS.band} stroke="none" />
        ) : null}
        {actualPts.length ? (
          <path
            d={linePath(actualPts, 0)}
            fill="none"
            stroke={ANALYTICS_COLORS.actualStroke}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {bridge ? (
          <path
            d={bridge}
            fill="none"
            stroke={ANALYTICS_COLORS.forecastStroke}
            strokeWidth={2}
            strokeDasharray="5 4"
            strokeLinecap="round"
          />
        ) : null}
        {forecastPts.length ? (
          <path
            d={linePath(forecastPts, spliceIdx >= 0 ? spliceIdx + 1 : 0)}
            fill="none"
            stroke={ANALYTICS_COLORS.forecastStroke}
            strokeWidth={2.5}
            strokeDasharray="5 4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {points.map((p, i) => (
          <circle
            key={p.key}
            cx={xAt(i)}
            cy={yAt(p.revenue)}
            r={3}
            fill={
              p.kind === "actual"
                ? ANALYTICS_COLORS.revenue
                : ANALYTICS_COLORS.forecastStroke
            }
          />
        ))}
        {points.map((p, i) =>
          i % Math.ceil(points.length / 6) === 0 || i === points.length - 1 ? (
            <text
              key={`lbl-${p.key}`}
              x={xAt(i)}
              y={height - 10}
              textAnchor="middle"
              fontSize={9}
              className="fill-[var(--muted)]"
            >
              {p.label}
            </text>
          ) : null,
        )}
      </svg>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-[var(--muted)]">
        <span>
          {firstHist ? (
            <>
              History from {formatMonth(firstHist.month)} · Actual{" "}
              <span className="font-medium text-[#2f9a57]">
                <Money amount={hist[hist.length - 1]?.revenue ?? 0} />
              </span>
            </>
          ) : null}
        </span>
        <span>
          {lastForecast ? (
            <>
              Horizon end {formatMonth(lastForecast.month)} · Projected{" "}
              <span className="font-medium text-[#1a7a45]">
                <Money amount={lastForecast.revenue} />
              </span>
            </>
          ) : null}
        </span>
      </div>
    </div>
  );
}
