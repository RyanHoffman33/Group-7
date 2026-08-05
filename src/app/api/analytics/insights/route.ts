import {
  buildFallbackInsights,
  getAnalyticsBundle,
} from "@/features/analytics/queries";
import { getSessionUser } from "@/features/users/session";
import { roleHasPermission } from "@/features/access/matrix";

export const runtime = "nodejs";

const INSIGHTS_SYSTEM = `You are a financial analytics advisor for MainEvent, an event services company.
Given a compact JSON snapshot of historical KPIs and a short-horizon forecast, produce 4–6 DISTINCT actionable insights for executives.
Each bullet must cover a DIFFERENT angle — do not restate the same revenue total in multiple bullets.
Prefer: (1) trend direction vs prior period, (2) projected vs recent actual variance, (3) margin/cost pressure months, (4) A/R or cash-conversion risk, (5) what to watch next quarter.
Be concrete with numbers from the JSON. Do not invent accounts. Return ONLY a JSON array of strings.`;

function parseInsightList(text: string): string[] | null {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1].trim() : trimmed;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      return parsed.map((s) => s.trim()).filter(Boolean).slice(0, 8);
    }
  } catch {
    /* fall through */
  }
  const lines = trimmed
    .split("\n")
    .map((l) => l.replace(/^[-*•]\s+/, "").replace(/^\d+\.\s+/, "").trim())
    .filter((l) => l.length > 20);
  return lines.length ? lines.slice(0, 8) : null;
}

async function callGeminiInsights(
  apiKey: string,
  payload: string,
): Promise<string[]> {
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: INSIGHTS_SYSTEM }] },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Analyze this analytics snapshot and return a JSON array of insight strings:\n${payload}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini error ${res.status}: ${errText.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("Gemini returned an empty response.");
  const insights = parseInsightList(text);
  if (!insights?.length) throw new Error("Could not parse Gemini insights.");
  return insights;
}

function compactSnapshot(bundle: Awaited<ReturnType<typeof getAnalyticsBundle>>) {
  const hist = bundle.history.slice(-12).map((m) => ({
    month: m.month.slice(0, 7),
    revenue: Math.round(m.revenue),
    cogs: Math.round(m.cogs),
    margin: Math.round(m.margin),
    events: m.events,
    ar: Math.round(m.arOutstanding),
  }));
  const forecast = bundle.forecast.points.map((p) => ({
    month: p.month.slice(0, 7),
    revenue: p.revenue,
    low: p.revenueLow,
    high: p.revenueHigh,
    events: p.events,
  }));
  return {
    source: bundle.source,
    method: bundle.forecast.method,
    revenueSlope: Math.round(bundle.forecast.revenueSlope),
    kpis: {
      trailingRevenue: Math.round(bundle.kpis.trailingRevenue),
      trailingMarginPct: Number(bundle.kpis.trailingMarginPct.toFixed(4)),
      avgEvents: Number(bundle.kpis.avgEvents.toFixed(2)),
      arOutstanding: Math.round(bundle.kpis.arOutstanding),
      revenueGrowthPct:
        bundle.kpis.revenueGrowthPct == null
          ? null
          : Number(bundle.kpis.revenueGrowthPct.toFixed(4)),
    },
    history: hist,
    forecast,
  };
}

export async function POST() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!roleHasPermission(session.roleKey, "analytics.read")) {
      return Response.json(
        { error: "Access denied — analytics.read required." },
        { status: 403 },
      );
    }

    const bundle = await getAnalyticsBundle();
    const fallback = buildFallbackInsights(bundle);
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!geminiKey) {
      return Response.json({ insights: fallback, source: "fallback" as const });
    }

    try {
      const payload = JSON.stringify(compactSnapshot(bundle));
      const insights = await callGeminiInsights(geminiKey, payload);
      return Response.json({ insights, source: "gemini" as const });
    } catch {
      return Response.json({ insights: fallback, source: "fallback" as const });
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: `Insights failed: ${detail.slice(0, 200)}` },
      { status: 500 },
    );
  }
}
