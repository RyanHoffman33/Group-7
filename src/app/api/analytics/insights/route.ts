import {
  buildFallbackInsights,
  getAnalyticsBundle,
} from "@/features/analytics/queries";
import { rankingsFromSlices } from "@/features/analytics/rankings";
import { getSessionUser } from "@/features/users/session";
import { roleHasPermission } from "@/features/access/matrix";

export const runtime = "nodejs";

const INSIGHTS_SYSTEM = `You are a business-planning advisor for MainEvent, an event services company.
Given a compact JSON snapshot of what the user is viewing on the Analytics Center overview
(KPIs, top profitable segments by gross margin $, recent history), produce 4–6 DISTINCT
actionable business-plan ideas — not generic finance commentary.
Each bullet must cover a DIFFERENT angle: growth bet, margin defense, customer mix,
venue/vendor leverage, capacity, or risk.
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
              text: `Advise on business-plan ideas from this overview snapshot and return a JSON array of insight strings:\n${payload}`,
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

type ClientContext = {
  filterLabel?: string;
  rankings?: {
    vendors: { label: string; margin: number; count: number }[];
    eventGroups: { label: string; margin: number; count: number }[];
    customers: { label: string; margin: number; count: number }[];
    venues: { label: string; margin: number; count: number }[];
  };
  history?: {
    month: string;
    revenue: number;
    cogs: number;
    margin: number;
    events: number;
  }[];
  kpis?: {
    yoyRevenueGrowthPct: number | null;
    avgMarginPct: number;
    topCustomerSharePct: number | null;
    topCustomerName: string | null;
  };
};

function compactSnapshot(
  bundle: Awaited<ReturnType<typeof getAnalyticsBundle>>,
  ctx?: ClientContext,
) {
  const rankings =
    ctx?.rankings ??
    rankingsFromSlices(bundle.eventSlices, {
      year: "all",
      quarter: "all",
      month: "all",
    });

  const histSource = ctx?.history?.length
    ? ctx.history
    : bundle.history.slice(-12);

  const hist = histSource.slice(-12).map((m) => ({
    month: m.month.slice(0, 7),
    revenue: Math.round(m.revenue),
    cogs: Math.round("cogs" in m ? (m.cogs as number) : 0),
    margin: Math.round(m.margin),
    events: m.events,
  }));

  return {
    source: bundle.source,
    filter: ctx?.filterLabel ?? "all periods",
    purpose: "business_plan_ideas",
    overviewKpis: ctx?.kpis ?? null,
    kpis: {
      trailingRevenue: Math.round(bundle.kpis.trailingRevenue),
      trailingMarginPct: Number(bundle.kpis.trailingMarginPct.toFixed(4)),
      avgEvents: Number(bundle.kpis.avgEvents.toFixed(2)),
      revenueGrowthPct:
        bundle.kpis.revenueGrowthPct == null
          ? null
          : Number(bundle.kpis.revenueGrowthPct.toFixed(4)),
    },
    topByGrossMarginDollars: {
      vendors: rankings.vendors.slice(0, 5),
      eventGroups: rankings.eventGroups.slice(0, 5),
      customers: rankings.customers.slice(0, 5),
      venues: rankings.venues.slice(0, 5),
    },
    history: hist,
  };
}

export async function POST(req: Request) {
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

    let ctx: ClientContext | undefined;
    try {
      const body = (await req.json()) as { context?: ClientContext };
      ctx = body.context;
    } catch {
      ctx = undefined;
    }

    const bundle = await getAnalyticsBundle();
    const rankings =
      ctx?.rankings ??
      rankingsFromSlices(bundle.eventSlices, {
        year: "all",
        quarter: "all",
        month: "all",
      });

    const fallback = buildFallbackInsights({
      history: ctx?.history?.length
        ? ctx.history.map((m) => ({
            month: m.month,
            revenue: m.revenue,
            cogs: m.cogs ?? 0,
            margin: m.margin,
            events: m.events,
            arOutstanding: 0,
          }))
        : bundle.history,
      forecast: bundle.forecast,
      source: bundle.source,
      kpis: bundle.kpis,
      rankings,
      filterLabel: ctx?.filterLabel ?? "all periods",
    });

    const geminiKey = process.env.GEMINI_API_KEY;

    if (!geminiKey) {
      return Response.json({ insights: fallback, source: "fallback" as const });
    }

    try {
      const payload = JSON.stringify(compactSnapshot(bundle, ctx));
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
