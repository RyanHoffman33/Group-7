import { formatCurrency } from "@/features/billing/aging";
import {
  buildAgingReport,
  getDashboardMetrics,
  listAlerts,
} from "@/features/billing/queries";
import {
  getPositionTotals,
  listContractModifications,
  listContractPositions,
  listCostClassifications,
  listGaapPolicies,
  listProfitabilityInputs,
  listRecognitionEvidence,
} from "@/features/gaap/queries";

/**
 * Live MainEvent snapshot for the assistant — numbers come from Supabase,
 * not from the model. Keep this compact so free-tier prompts stay small.
 */
export async function buildCompanySnapshot(): Promise<string> {
  const [
    metrics,
    positions,
    aging,
    alerts,
    evidence,
    mods,
    costs,
    profitability,
    policies,
  ] = await Promise.all([
    getDashboardMetrics(),
    listContractPositions(),
    buildAgingReport(),
    listAlerts(false),
    listRecognitionEvidence(),
    listContractModifications(),
    listCostClassifications(),
    listProfitabilityInputs(),
    listGaapPolicies(),
  ]);

  const totals = await getPositionTotals(positions);

  const topAging = [...aging]
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 8)
    .map(
      (r) =>
        `- ${r.invoice_number} | ${r.customer_name} | ${r.event_name} | ${formatCurrency(r.outstanding)} | bucket ${r.bucket} | recognition ${r.recognition_status} | P(collect) ${(r.p_collect * 100).toFixed(0)}%`,
    )
    .join("\n");

  const positionLines = positions
    .map(
      (p) =>
        `- ${p.event_name} (${p.customer_name}): contract ${formatCurrency(p.contract_value)}, earned ${formatCurrency(p.earned_to_date)}, billed ${formatCurrency(p.billed_to_date)}, asset ${formatCurrency(p.contract_asset)}, liability ${formatCurrency(p.total_contract_liability)}, open AR ${formatCurrency(p.open_ar)}, perf ${p.performance_complete ? "complete" : "in progress"}`,
    )
    .join("\n");

  const profitLines = profitability
    .filter(
      (p) =>
        p.recognized_revenue > 0 ||
        p.direct_event_cogs > 0 ||
        p.reimbursable_passthrough > 0,
    )
    .map(
      (p) =>
        `- ${p.event_name}: recognized rev ${formatCurrency(p.recognized_revenue)}, direct COGS ${formatCurrency(p.direct_event_cogs)}, passthrough ${formatCurrency(p.reimbursable_passthrough)}, implied margin ${formatCurrency(p.recognized_revenue - p.direct_event_cogs)}`,
    )
    .join("\n");

  const policyLines = policies
    .slice(0, 8)
    .map((p) => `- ${p.topic} (${p.asc_reference}): ${p.mainevent_rule}`)
    .join("\n");

  const modLines = mods
    .map(
      (m) =>
        `- ${m.mod_number} on ${m.event_name}: Δ ${formatCurrency(m.price_change)}, ${m.accounting_treatment}, status ${m.status}`,
    )
    .join("\n");

  const costLines = costs
    .slice(0, 12)
    .map(
      (c) =>
        `- ${c.event_name}: ${c.classification} ${formatCurrency(c.amount)} (${c.notes ?? "no note"})`,
    )
    .join("\n");

  return `
COMPANY: MainEvent — event production (ACCY 628 Contract-to-Cash demo).
AS OF: ${new Date().toISOString().slice(0, 10)}

PORTFOLIO TOTALS
- Total outstanding A/R: ${formatCurrency(metrics.totalOutstanding)}
- Expected collections (A/R × P(collect)): ${formatCurrency(metrics.expectedCollections)}
- Unearned deposits (liability): ${formatCurrency(metrics.unearnedDeposits)}
- Deferred open A/R (billed, not yet recognized): ${formatCurrency(metrics.deferredRevenue)}
- Recognized open A/R: ${formatCurrency(metrics.recognizedOpenAr)}
- Open billing alerts: ${metrics.openAlertCount}
- Aging mix: current ${formatCurrency(metrics.byBucket.current)}; 1-30 ${formatCurrency(metrics.byBucket["1-30"])}; 31-60 ${formatCurrency(metrics.byBucket["31-60"])}; 61-90 ${formatCurrency(metrics.byBucket["61-90"])}; 90+ ${formatCurrency(metrics.byBucket["90+"])}

ASC 606 CONTRACT POSITION (from v_gaap_contract_position)
- Contract assets (earned not billed): ${formatCurrency(totals.contractAsset)}
- Contract liabilities (unearned deposits + deferred billed): ${formatCurrency(totals.contractLiability)}
- Unearned deposits: ${formatCurrency(totals.unearnedDeposits)}
- Deferred billed outstanding: ${formatCurrency(totals.deferredBilled)}
- Recognized revenue (billed & recognized): ${formatCurrency(totals.recognizedBilled)}
- Open A/R (position view): ${formatCurrency(totals.openAr)}

PER-CONTRACT POSITION
${positionLines || "(none)"}

TOP OPEN INVOICES BY OUTSTANDING
${topAging || "(none)"}

PROFITABILITY INPUTS (recognized rev − direct COGS; passthrough excluded from margin)
${profitLines || "(none with activity)"}

COST CLASSIFICATIONS (sample)
${costLines || "(none)"}

CONTRACT MODIFICATIONS
${modLines || "(none)"}

RECOGNITION EVIDENCE COUNT: ${evidence.length}
OPEN ALERTS: ${alerts.length}

KEY MAINEVENT GAAP POLICIES
${policyLines || "(none)"}

RULES FOR ANSWERS
- Use ONLY the numbers above. Do not invent invoices, customers, or dollar amounts.
- If something is not in the snapshot, say you do not have that detail in the live data.
- Prefer plain business language; mention ASC 606 / liability / asset when relevant.
- Keep answers concise (2–6 short paragraphs or bullets).
`.trim();
}

export const ASSISTANT_SYSTEM = `You are MainEvent's internal finance assistant for an event-production Contract-to-Cash system.
You help students and teammates understand Billing & A/R and ASC 606 Compliance using a live data snapshot.
Be accurate, concise, and educational. Never invent financial figures.`;
