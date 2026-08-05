import type { AnalyticsMonth } from "./seed";

export type ForecastPoint = {
  month: string;
  revenue: number;
  cogs: number;
  margin: number;
  events: number;
  revenueLow: number;
  revenueHigh: number;
};

export type ForecastConfidence = {
  /** 0–100 score from residual CV, member agreement, and sample size. */
  score: number;
  label: "High" | "Medium" | "Low";
  /** Nominal prediction-interval coverage (e.g. 0.8). */
  intervalLevel: number;
  /** Holdout 1-step RMSE used to size bands. */
  residualRmse: number;
  /** Mean relative ensemble disagreement across the horizon (0–1+). */
  disagreement: number;
};

export type ForecastResult = {
  method: string;
  horizonMonths: number;
  points: ForecastPoint[];
  /** Implied month-over-month revenue change from the ensemble path. */
  revenueSlope: number;
  rmse: number;
  confidence: ForecastConfidence;
};

/** ~80% two-sided normal quantile for prediction intervals. */
const PI_Z = 1.2816;
const PI_LEVEL = 0.8;

function monthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function addMonths(iso: string, n: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return monthKey(d);
}

function monthIndex(iso: string): number {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

function monthOfYear(iso: string): number {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).getUTCMonth();
}

function mean(vals: number[]): number {
  if (!vals.length) return 0;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function median(vals: number[]): number {
  if (!vals.length) return 0;
  const s = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function rmseVec(actual: number[], pred: number[]): number {
  const n = Math.min(actual.length, pred.length);
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += (actual[i] - pred[i]) ** 2;
  return Math.sqrt(sum / n);
}

function mapeVec(actual: number[], pred: number[]): number {
  let n = 0;
  let sum = 0;
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] <= 0) continue;
    sum += Math.abs((actual[i] - pred[i]) / actual[i]);
    n++;
  }
  return n ? sum / n : Infinity;
}

/** OLS: y ~ a + b*x */
function ols(xs: number[], ys: number[]): { a: number; b: number } {
  const n = xs.length;
  if (n === 0) return { a: 0, b: 0 };
  const meanX = mean(xs);
  const meanY = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const b = den === 0 ? 0 : num / den;
  return { a: meanY - b * meanX, b };
}

/**
 * Huber IRLS robust regression — down-weights outliers common in
 * lumpy event-recognition months.
 */
function huberRegression(
  xs: number[],
  ys: number[],
  delta?: number,
): { a: number; b: number } {
  const n = xs.length;
  if (n < 2) return ols(xs, ys);
  let { a, b } = ols(xs, ys);
  const residuals0 = ys.map((y, i) => y - (a + b * xs[i]));
  const mad = median(residuals0.map(Math.abs)) || 1;
  const d = delta ?? Math.max(1.345 * mad, mean(ys.map(Math.abs)) * 0.05, 1);

  for (let iter = 0; iter < 12; iter++) {
    const w = ys.map((y, i) => {
      const r = Math.abs(y - (a + b * xs[i]));
      return r <= d ? 1 : d / r;
    });
    const sw = w.reduce((s, v) => s + v, 0);
    if (sw === 0) break;
    const meanX = w.reduce((s, wi, i) => s + wi * xs[i], 0) / sw;
    const meanY = w.reduce((s, wi, i) => s + wi * ys[i], 0) / sw;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += w[i] * (xs[i] - meanX) * (ys[i] - meanY);
      den += w[i] * (xs[i] - meanX) ** 2;
    }
    const nb = den === 0 ? 0 : num / den;
    const na = meanY - nb * meanX;
    if (Math.abs(na - a) + Math.abs(nb - b) < 1e-9) {
      a = na;
      b = nb;
      break;
    }
    a = na;
    b = nb;
  }
  return { a, b };
}

/** Trailing mean of positive observations (ignores recognition-lag zeros). */
function positiveTrailingMean(values: number[], window = 6): number {
  const pos = values.filter((v) => v > 0);
  if (!pos.length) return 0;
  return mean(pos.slice(-window));
}

function positiveTrailingMedian(values: number[], window = 6): number {
  const pos = values.filter((v) => v > 0);
  if (!pos.length) return 0;
  return median(pos.slice(-window));
}

/**
 * Holt's linear method with optional damping (φ < 1).
 * Additive trend form; non-negative clip applied by caller.
 */
function holtDampedForecast(
  y: number[],
  horizon: number,
  opts: { alpha?: number; beta?: number; phi?: number } = {},
): { path: number[]; level: number; trend: number } {
  const n = y.length;
  if (n === 0) return { path: Array(horizon).fill(0), level: 0, trend: 0 };
  if (n === 1) {
    return { path: Array(horizon).fill(y[0]), level: y[0], trend: 0 };
  }

  const alpha = opts.alpha ?? 0.35;
  const beta = opts.beta ?? 0.15;
  const phi = opts.phi ?? 0.9;

  let level = y[0];
  let trend = y[1] - y[0];
  for (let t = 1; t < n; t++) {
    const prevLevel = level;
    level = alpha * y[t] + (1 - alpha) * (level + phi * trend);
    trend = beta * (level - prevLevel) + (1 - beta) * phi * trend;
  }

  const path: number[] = [];
  for (let h = 1; h <= horizon; h++) {
    let phiSum = 0;
    let p = 1;
    for (let i = 1; i <= h; i++) {
      p *= phi;
      phiSum += p;
    }
    path.push(level + trend * phiSum);
  }
  return { path, level, trend };
}

/**
 * Simple exponential smoothing level (no trend) — strong for noisy
 * short series where trend is unreliable.
 */
function sesForecast(
  y: number[],
  horizon: number,
  alpha = 0.4,
): { path: number[]; level: number } {
  if (!y.length) return { path: Array(horizon).fill(0), level: 0 };
  let level = y[0];
  for (let t = 1; t < y.length; t++) {
    level = alpha * y[t] + (1 - alpha) * level;
  }
  return { path: Array(horizon).fill(level), level };
}

/**
 * Croston / TSB-style intermittent demand: separate size & interval
 * smoothing. Useful when recognition lag creates sparse zeros.
 */
function crostonTsbForecast(
  y: number[],
  horizon: number,
  alpha = 0.2,
): number[] {
  const n = y.length;
  if (!n) return Array(horizon).fill(0);

  let z = 0;
  let p = 1;
  let q = 0;
  let seen = false;
  for (let t = 0; t < n; t++) {
    q++;
    if (y[t] > 0) {
      if (!seen) {
        z = y[t];
        p = q;
        seen = true;
      } else {
        z = alpha * y[t] + (1 - alpha) * z;
        p = alpha * q + (1 - alpha) * p;
      }
      q = 0;
    }
  }
  if (!seen) return Array(horizon).fill(0);
  const rate = z / Math.max(p, 1);
  return Array(horizon).fill(rate);
}

/** Multiplicative month-of-year factors from residuals around a trend. */
function seasonalFactors(
  months: string[],
  values: number[],
  trendPred: number[],
): number[] {
  const buckets: number[][] = Array.from({ length: 12 }, () => []);
  for (let i = 0; i < values.length; i++) {
    if (values[i] <= 0 || trendPred[i] <= 0) continue;
    buckets[monthOfYear(months[i])].push(values[i] / trendPred[i]);
  }
  return buckets.map((b) => (b.length ? mean(b) : 1));
}

type SeriesFit = {
  path: number[];
  /** Per-horizon std-dev of weighted ensemble member paths (disagreement). */
  memberSpread: number[];
  /** Walk-forward 1-step RMSE of the inverse-error ensemble. */
  residualRmse: number;
  /** Coefficient of variation of holdout residuals vs baseline level. */
  residualCv: number;
  slope: number;
  components: string[];
  n: number;
};

function confidenceFromFit(
  residualCv: number,
  disagreement: number,
  n: number,
  residualRmse: number,
): ForecastConfidence {
  // Low relative error → high score (CV of 0 → 1; CV ≥ 45% → 0).
  const accuracy = clamp(1 - residualCv / 0.45, 0, 1);
  // Models agreeing → high score.
  const agreement = clamp(1 - disagreement / 0.35, 0, 1);
  // More history → modest bump (saturates ~24 months).
  const sample = clamp((n - 4) / 20, 0, 1);
  const score = Math.round(
    100 * (0.5 * accuracy + 0.35 * agreement + 0.15 * sample),
  );
  const label: ForecastConfidence["label"] =
    score >= 72 ? "High" : score >= 48 ? "Medium" : "Low";
  return {
    score,
    label,
    intervalLevel: PI_LEVEL,
    residualRmse,
    disagreement,
  };
}

/**
 * Ensemble one numeric series (revenue / cogs / events).
 * Combines damped Holt, SES, Huber trend, positive run-rate, and
 * intermittent Croston when zeros are common — weights from
 * expanding-window 1-step holdout error on the available history.
 */
function ensembleSeries(
  months: string[],
  values: number[],
  horizon: number,
  opts: { nonNegative: boolean; dampDecline: boolean },
): SeriesFit {
  const n = values.length;
  if (n === 0) {
    return {
      path: Array(horizon).fill(0),
      memberSpread: Array(horizon).fill(0),
      residualRmse: 0,
      residualCv: 0,
      slope: 0,
      components: [],
      n: 0,
    };
  }

  const posMean = positiveTrailingMean(values, 6);
  const posMedian = positiveTrailingMedian(values, 6);
  const zeroShare = values.filter((v) => v <= 0).length / n;
  const intermittent = zeroShare >= 0.2 && values.some((v) => v > 0);
  const baseline = Math.max(posMean, posMedian, 1);

  // Fit primarily on positive observations for trend models.
  const posIdx: number[] = [];
  for (let i = 0; i < n; i++) if (values[i] > 0) posIdx.push(i);
  const fitIdx = posIdx.length >= 2 ? posIdx : values.map((_, i) => i);

  const x0 = monthIndex(months[fitIdx[0]]);
  const xs = fitIdx.map((i) => monthIndex(months[i]) - x0);
  const ys = fitIdx.map((i) => values[i]);

  const useSeasonal = fitIdx.length >= 12;
  let season = Array(12).fill(1) as number[];
  if (useSeasonal) {
    const rough = ols(xs, ys);
    const trendPred = fitIdx.map(
      (i) => rough.a + rough.b * (monthIndex(months[i]) - x0),
    );
    season = seasonalFactors(
      fitIdx.map((i) => months[i]),
      ys,
      trendPred,
    );
  }

  const deseas = ys.map((y, j) => {
    const f = season[monthOfYear(months[fitIdx[j]])] || 1;
    return f === 0 ? y : y / f;
  });
  const huber = huberRegression(xs, deseas);

  // Dense calendar path for Holt/SES: fill gaps with 0 (recognition absence).
  const firstIdx = monthIndex(months[0]);
  const lastIdx = monthIndex(months[n - 1]);
  const denseLen = lastIdx - firstIdx + 1;
  const dense = Array(denseLen).fill(0);
  for (let i = 0; i < n; i++) {
    dense[monthIndex(months[i]) - firstIdx] = values[i];
  }
  // For Holt, replace trailing pure zeros with last positive to avoid
  // collapsing level — still keep interior zeros for intermittency signal.
  const denseForHolt = [...dense];
  if (posMean > 0) {
    let t = denseForHolt.length - 1;
    while (t >= 0 && denseForHolt[t] <= 0) {
      denseForHolt[t] = posMedian > 0 ? posMedian : posMean;
      t--;
    }
  }

  const holt = holtDampedForecast(denseForHolt, horizon, {
    alpha: 0.4,
    beta: 0.12,
    phi: 0.88,
  });
  const ses = sesForecast(
    values.filter((v) => v > 0).length >= 2
      ? values.filter((v) => v > 0)
      : values,
    horizon,
    0.45,
  );
  const croston = crostonTsbForecast(dense, horizon);
  const runRate = Array(horizon).fill(
    posMedian * 0.55 + posMean * 0.45,
  );

  const lastRelX = monthIndex(months[n - 1]) - x0;
  const huberPath: number[] = [];
  for (let h = 1; h <= horizon; h++) {
    const idx = lastRelX + h;
    const month = addMonths(months[n - 1], h);
    const s = season[monthOfYear(month)] || 1;
    let b = huber.b;
    if (opts.dampDecline && posMean > 0) {
      b = Math.max(b, -posMean * 0.035);
    }
    huberPath.push((huber.a + b * idx) * s);
  }

  // Candidate matrix for weighting via expanding-window 1-step MAPE.
  type Cand = { name: string; path: number[]; weight: number };
  const cands: Cand[] = [
    { name: "holt-damped", path: holt.path, weight: 0 },
    { name: "SES level", path: ses.path, weight: 0 },
    { name: "Huber trend", path: huberPath, weight: 0 },
    { name: "positive run-rate", path: runRate, weight: 0 },
  ];
  if (intermittent) {
    cands.push({ name: "Croston/TSB", path: croston, weight: 0 });
  }

  // Walk-forward: for each origin t in [minTrain, n-1], forecast 1 step,
  // score each candidate. Prefer recent origins (recency weights).
  const minTrain = Math.min(4, Math.max(2, n - 3));
  const errors = cands.map(() => 0);
  const errW = cands.map(() => 0);
  // Collect ensemble (equal-then-reweighted) holdout residuals for PI sizing.
  const holdoutResid: number[] = [];
  for (let t = minTrain; t < n; t++) {
    const histY = values.slice(0, t);
    const histM = months.slice(0, t);
    const actual = values[t];
    // Rebuild lightweight 1-step candidates on prefix.
    const posH = histY.filter((v) => v > 0);
    const pm = positiveTrailingMean(histY, 6);
    const pmed = positiveTrailingMedian(histY, 6);
    const f0 = monthIndex(histM[0]);
    const dLen = monthIndex(histM[histM.length - 1]) - f0 + 1;
    const d = Array(dLen).fill(0);
    for (let i = 0; i < histY.length; i++) {
      d[monthIndex(histM[i]) - f0] = histY[i];
    }
    const dHolt = [...d];
    if (pm > 0) {
      let k = dHolt.length - 1;
      while (k >= 0 && dHolt[k] <= 0) {
        dHolt[k] = pmed || pm;
        k--;
      }
    }
    const h1 = holtDampedForecast(dHolt, 1, {
      alpha: 0.4,
      beta: 0.12,
      phi: 0.88,
    }).path[0];
    const s1 = sesForecast(posH.length >= 2 ? posH : histY, 1, 0.45).path[0];
    const c1 = crostonTsbForecast(d, 1)[0];
    const r1 = pmed * 0.55 + pm * 0.45;

    const fitI =
      posH.length >= 2
        ? histY.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0)
        : histY.map((_, i) => i);
    const x00 = monthIndex(histM[fitI[0]]);
    const xsH = fitI.map((i) => monthIndex(histM[i]) - x00);
    const ysH = fitI.map((i) => histY[i]);
    const hb = huberRegression(xsH, ysH);
    const nextX = monthIndex(months[t]) - x00;
    let hb1 = hb.a + hb.b * nextX;
    if (opts.dampDecline && pm > 0) {
      const b = Math.max(hb.b, -pm * 0.035);
      hb1 = hb.a + b * nextX;
    }

    const preds = intermittent
      ? [h1, s1, hb1, r1, c1]
      : [h1, s1, hb1, r1];
    const recency = 1 + (t - minTrain) * 0.35;
    for (let c = 0; c < preds.length; c++) {
      const e =
        actual > 0
          ? Math.abs(preds[c] - actual) / actual
          : Math.abs(preds[c] - actual) / Math.max(pm, 1);
      errors[c] += e * recency;
      errW[c] += recency;
    }

    // Preliminary inverse-error ensemble residual at this origin
    // (weights from errors accumulated so far — expanding).
    let ensPred = 0;
    let wSumT = 0;
    for (let c = 0; c < preds.length; c++) {
      const avgErr = errW[c] > 0 ? errors[c] / errW[c] : 1;
      const w = 1 / Math.max(avgErr, 0.05);
      ensPred += w * preds[c];
      wSumT += w;
    }
    ensPred /= wSumT || 1;
    // Skip pure recognition-lag zeros when we have a positive baseline —
    // they inflate residual scale without reflecting forecast skill.
    if (!(actual <= 0 && pm > 0)) {
      holdoutResid.push(actual - ensPred);
    }
  }

  for (let c = 0; c < cands.length; c++) {
    const avgErr = errW[c] > 0 ? errors[c] / errW[c] : 1;
    // Inverse-error weights; floor so no model is fully dropped.
    cands[c].weight = 1 / Math.max(avgErr, 0.05);
  }
  // Favor run-rate / SES slightly when series is very short or intermittent.
  if (n < 8) {
    const rr = cands.find((c) => c.name === "positive run-rate");
    const ss = cands.find((c) => c.name === "SES level");
    if (rr) rr.weight *= 1.35;
    if (ss) ss.weight *= 1.2;
  }
  if (intermittent) {
    const cr = cands.find((c) => c.name === "Croston/TSB");
    if (cr) cr.weight *= 1.25;
  }

  const wSum = cands.reduce((s, c) => s + c.weight, 0) || 1;
  for (const c of cands) c.weight /= wSum;

  const path: number[] = [];
  const memberSpread: number[] = [];
  for (let h = 0; h < horizon; h++) {
    let meanV = 0;
    for (const c of cands) meanV += c.weight * c.path[h];
    // Weighted std vs unfloored mean (honest disagreement signal).
    let varSum = 0;
    for (const c of cands) {
      const d = c.path[h] - meanV;
      varSum += c.weight * d * d;
    }
    memberSpread.push(Math.sqrt(Math.max(0, varSum)));

    let v = meanV;
    // Soft floor toward positive run-rate (recognition-lag protection).
    if (posMean > 0) {
      const floor = posMedian * 0.55;
      v = Math.max(v, floor);
      if (v < posMean) v = v * 0.75 + posMean * 0.25;
    }
    if (opts.nonNegative) v = Math.max(0, v);
    path.push(v);
  }

  // Holdout residual RMSE — primary scale for prediction intervals.
  let residualRmse = 0;
  if (holdoutResid.length > 0) {
    residualRmse = Math.sqrt(
      holdoutResid.reduce((s, r) => s + r * r, 0) / holdoutResid.length,
    );
  } else {
    // Fallback: robust in-sample blend residual when series is too short.
    let residSum = 0;
    let residN = 0;
    for (let i = 0; i < n; i++) {
      if (values[i] <= 0 && posMean > 0) continue;
      const xi = monthIndex(months[i]) - x0;
      const s = season[monthOfYear(months[i])] || 1;
      const trendV = (huber.a + huber.b * xi) * s;
      const blend =
        0.35 * trendV +
        0.35 * (posMedian || posMean) +
        0.3 * ses.level;
      residSum += (values[i] - blend) ** 2;
      residN++;
    }
    residualRmse = residN > 0 ? Math.sqrt(residSum / residN) : baseline * 0.12;
  }

  const residualCv = residualRmse / baseline;
  const slope =
    horizon >= 2 ? (path[horizon - 1] - path[0]) / (horizon - 1) : 0;

  return {
    path,
    memberSpread,
    residualRmse,
    residualCv,
    slope,
    components: cands.map(
      (c) => `${c.name} ${(c.weight * 100).toFixed(0)}%`,
    ),
    n,
  };
}

/**
 * Horizon half-width for an ~80% prediction interval.
 * Combines holdout residual variance (grows with √h) and ensemble
 * member disagreement. Soft floors/caps keep bands honest but readable.
 */
function predictionHalfWidth(
  point: number,
  h: number,
  residualRmse: number,
  memberStd: number,
  baseline: number,
): number {
  // Residual component: widens with horizon (√h for random-walk-like growth).
  const residHalf = PI_Z * residualRmse * Math.sqrt(h);
  // Disagreement: models diverge further out — use as additive variance.
  const disagreeHalf = PI_Z * memberStd * 0.85;
  const combined = Math.sqrt(residHalf * residHalf + disagreeHalf * disagreeHalf);

  // Soft floor: never thinner than ~3% of level when we have signal.
  const floor = Math.max(point * 0.03, baseline * 0.025);
  // Cap: avoid absurdly wide bands that look like "no confidence".
  const cap = Math.max(point * 0.42, baseline * 0.35);
  return clamp(Math.max(combined, floor), floor, cap);
}

/**
 * Ensemble projection for the next `horizon` months.
 *
 * Tuned for short business monthly series (≈12–36 pts): inverse-error
 * blend of damped Holt, SES, Huber robust trend (± seasonality),
 * positive run-rate, and Croston/TSB when zeros are intermittent.
 * Always non-negative for revenue/COGS/events; floors against
 * recognition-lag collapse.
 *
 * Prediction intervals (~80%) are sized from walk-forward residual RMSE
 * plus ensemble member spread, growing with horizon. A confidence score
 * reflects residual CV, member agreement, and sample size.
 */
export function forecastSeries(
  history: AnalyticsMonth[],
  horizon = 6,
): ForecastResult {
  const emptyConfidence: ForecastConfidence = {
    score: 0,
    label: "Low",
    intervalLevel: PI_LEVEL,
    residualRmse: 0,
    disagreement: 0,
  };

  const series = [...history].sort((a, b) => a.month.localeCompare(b.month));
  const n = series.length;
  if (n === 0) {
    return {
      method: "insufficient data",
      horizonMonths: horizon,
      points: [],
      revenueSlope: 0,
      rmse: 0,
      confidence: emptyConfidence,
    };
  }

  const months = series.map((m) => m.month);
  const revenues = series.map((m) => m.revenue);
  const cogs = series.map((m) => m.cogs);
  const events = series.map((m) => m.events);

  const revFit = ensembleSeries(months, revenues, horizon, {
    nonNegative: true,
    dampDecline: true,
  });
  const cogsFit = ensembleSeries(months, cogs, horizon, {
    nonNegative: true,
    dampDecline: true,
  });
  const evtFit = ensembleSeries(months, events, horizon, {
    nonNegative: true,
    dampDecline: false,
  });

  const baselineRev = positiveTrailingMean(revenues, 6);
  const last = months[n - 1];
  const points: ForecastPoint[] = [];

  for (let h = 1; h <= horizon; h++) {
    const revenue = revFit.path[h - 1];
    const cogsVal = cogsFit.path[h - 1];
    const eventsVal = evtFit.path[h - 1];
    const band = predictionHalfWidth(
      revenue,
      h,
      revFit.residualRmse,
      revFit.memberSpread[h - 1] ?? 0,
      baselineRev,
    );
    points.push({
      month: addMonths(last, h),
      revenue: Math.round(revenue),
      cogs: Math.round(cogsVal),
      margin: Math.round(revenue - cogsVal),
      events: Math.max(0, Math.round(eventsVal)),
      revenueLow: Math.round(Math.max(0, revenue - band)),
      revenueHigh: Math.round(revenue + band),
    });
  }

  const meanPath =
    points.reduce((s, p) => s + p.revenue, 0) / Math.max(points.length, 1);
  const meanDisagree =
    revFit.memberSpread.reduce((s, v) => s + v, 0) /
    Math.max(revFit.memberSpread.length, 1);
  const relDisagree = meanDisagree / Math.max(meanPath, baselineRev, 1);
  const confidence = confidenceFromFit(
    revFit.residualCv,
    relDisagree,
    revFit.n,
    revFit.residualRmse,
  );

  const method = `ensemble forecast (${revFit.components.join(", ")})`;

  return {
    method,
    horizonMonths: horizon,
    points,
    revenueSlope: revFit.slope,
    rmse: revFit.residualRmse,
    confidence,
  };
}

/** Exported helpers for evaluation / unit self-checks. */
export const __forecastInternals = {
  ols,
  huberRegression,
  holtDampedForecast,
  sesForecast,
  crostonTsbForecast,
  mapeVec,
  rmseVec,
  positiveTrailingMean,
  ensembleSeries,
  predictionHalfWidth,
  confidenceFromFit,
};
