import { formatCurrency } from "@/features/billing/aging";
import {
  buildAgingReport,
  getDashboardMetrics,
  listAlerts,
} from "@/features/billing/queries";
import {
  APPROVAL_THRESHOLD,
  COMMITMENT_VARIANCE_DOLLAR_CAP,
  COMMITMENT_VARIANCE_PCT,
  categoryLabel,
} from "@/features/costs/config";
import { flagReasons } from "@/features/costs/flags";
import {
  getAverageCostPerProjectByCategory,
  getCategoryBreakdown,
  getCostDashboardStats,
  listCommittedCosts,
  listExceptionCosts,
  listPendingApprovals,
} from "@/features/costs/queries";
import {
  getPositionTotals,
  listContractModifications,
  listContractPositions,
  listCostClassifications,
  listGaapPolicies,
  listProfitabilityInputs,
  listRecognitionEvidence,
} from "@/features/gaap/queries";
import { createClient } from "@/lib/supabase/server";

/** id (UUID) → human contract_number (ME-…) for assistant lookups. */
async function contractNumberById(): Promise<Map<string, string>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contracts")
    .select("id, contract_number");
  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const id = row.id as string;
    const num = (row.contract_number as string | null)?.trim();
    if (id && num) map.set(id, num);
  }
  return map;
}

function contractLabel(
  contractId: string | undefined,
  eventName: string | undefined,
  numbers: Map<string, string>,
): string {
  const me = contractId ? numbers.get(contractId) : undefined;
  const name = eventName?.trim() || "Unknown event";
  if (me) return `${me} | ${name}`;
  if (contractId) return `${name} (id ${contractId})`;
  return name;
}

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
    costStats,
    costBreakdown,
    avgCostByCategory,
    costFlags,
    costCommitments,
    costApprovals,
    contractNumbers,
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
    getCostDashboardStats(),
    getCategoryBreakdown(),
    getAverageCostPerProjectByCategory(),
    listExceptionCosts(),
    listCommittedCosts(),
    listPendingApprovals(),
    contractNumberById(),
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
    .map((p) => {
      const label = contractLabel(p.contract_id, p.event_name, contractNumbers);
      return `- ${label} (${p.customer_name}): contract ${formatCurrency(p.contract_value)}, earned ${formatCurrency(p.earned_to_date)}, billed ${formatCurrency(p.billed_to_date)}, recognized ${formatCurrency(p.recognized_revenue_billed)}, asset ${formatCurrency(p.contract_asset)}, liability ${formatCurrency(p.total_contract_liability)}, open AR ${formatCurrency(p.open_ar)}, perf ${p.performance_complete ? "complete" : "in progress"}`;
    })
    .join("\n");

  const profitLines = profitability
    .filter(
      (p) =>
        p.recognized_revenue > 0 ||
        p.direct_event_cogs > 0 ||
        p.reimbursable_passthrough > 0,
    )
    .map((p) => {
      const label = contractLabel(p.contract_id, p.event_name, contractNumbers);
      return `- ${label}: recognized rev ${formatCurrency(p.recognized_revenue)}, direct COGS ${formatCurrency(p.direct_event_cogs)}, passthrough ${formatCurrency(p.reimbursable_passthrough)}, implied margin ${formatCurrency(p.recognized_revenue - p.direct_event_cogs)}`;
    })
    .join("\n");

  const policyLines = policies
    .slice(0, 8)
    .map((p) => `- ${p.topic} (${p.asc_reference}): ${p.mainevent_rule}`)
    .join("\n");

  const modLines = mods
    .map((m) => {
      const label = contractLabel(
        m.contract_id,
        m.event_name,
        contractNumbers,
      );
      return `- ${m.mod_number} on ${label}: Δ ${formatCurrency(m.price_change)}, ${m.accounting_treatment}, status ${m.status}`;
    })
    .join("\n");

  const costLines = costs
    .slice(0, 12)
    .map((c) => {
      const label = contractLabel(c.contract_id, c.event_name, contractNumbers);
      return `- ${label}: ${c.classification} ${formatCurrency(c.amount)} (${c.notes ?? "no note"})`;
    })
    .join("\n");

  const costCategoryLines = costBreakdown
    .slice(0, 12)
    .map((r) => `- ${categoryLabel(r.category)}: ${formatCurrency(r.amount)}`)
    .join("\n");

  const avgCostLines = avgCostByCategory
    .slice(0, 10)
    .map(
      (r) =>
        `- ${categoryLabel(r.category)}: avg ${formatCurrency(r.average)} across ${r.projectCount} project(s) (total ${formatCurrency(r.total)})`,
    )
    .join("\n");

  const commitmentLines = costCommitments
    .slice(0, 8)
    .map(
      (e) =>
        `- ${e.event_name ?? "Event"} | ${categoryLabel(e.category)} | ${formatCurrency(e.amount)} | ${e.vendor_name ?? e.worker_label ?? "—"}`,
    )
    .join("\n");

  const approvalLines = costApprovals
    .slice(0, 8)
    .map(
      (e) =>
        `- ${e.event_name ?? "Event"} | ${categoryLabel(e.category)} | ${formatCurrency(e.amount)} | awaiting approval (≥ $${APPROVAL_THRESHOLD.toLocaleString()})`,
    )
    .join("\n");

  const flagLines = costFlags
    .slice(0, 10)
    .map((e) => {
      const reasons = flagReasons(e).join("; ") || "flagged";
      return `- ${e.event_name ?? "Event"} | ${categoryLabel(e.category)} | ${formatCurrency(e.amount)} | ${reasons}`;
    })
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

COST & RESOURCE TRACKING (operational cost_entries — commitments vs actuals)
- Total actual costs: ${formatCurrency(costStats.totalActual)}
- Open commitments: ${formatCurrency(costStats.totalCommitted)}
- Pending cost approvals: ${costStats.pendingApprovals}
- Open cost control flags: ${costStats.openFlags}
- Approval threshold: any single cost ≥ $${APPROVAL_THRESHOLD.toLocaleString()} requires manager approval (Approvals queue only — not duplicated as a flag)
- Commitment variance flag: actual exceeds committed by more than min(${(COMMITMENT_VARIANCE_PCT * 100).toFixed(0)}% of committed, $${COMMITMENT_VARIANCE_DOLLAR_CAP})
- No-commitment flag: actual cost entered with no prior committed amount on file
- Costs ≠ revenue; paid ≠ incurred. Track by contract / customer / event.

COSTS BY CATEGORY
${costCategoryLines || "(none)"}

AVERAGE COST PER PROJECT (by category)
${avgCostLines || "(none)"}

OPEN COST COMMITMENTS (sample)
${commitmentLines || "(none)"}

PENDING COST APPROVALS (sample)
${approvalLines || "(none)"}

COST FLAGS & EXCEPTIONS (sample; excludes pending approval)
${flagLines || "(none)"}

GAAP COST CLASSIFICATIONS (compliance board sample — separate from Cost & Resources tracking)
${costLines || "(none)"}

CONTRACT MODIFICATIONS
${modLines || "(none)"}

RECOGNITION EVIDENCE COUNT: ${evidence.length}
OPEN ALERTS: ${alerts.length}

KEY MAINEVENT GAAP POLICIES
${policyLines || "(none)"}

RULES FOR ANSWERS
- Use ONLY the numbers above. Do not invent invoices, customers, costs, or dollar amounts.
- If something is not in the snapshot, say you do not have that detail in the live data.
- Contract keys: lines are labeled with human contract_number (ME-YYYY-…) then event name. When the user cites ME-…, match that contract_number — it is NOT a UUID primary key. Prefer PER-CONTRACT POSITION "recognized" and PROFITABILITY INPUTS "recognized rev" for recognition questions.
- Prefer plain business language; mention ASC 606 / liability / asset when relevant.
- For costs: distinguish commitments vs actuals, approvals vs control flags, and Cost & Resources tracking vs GAAP cost classification.
- Keep answers concise (2–6 short paragraphs or bullets).
`.trim();
}

export const ASSISTANT_SYSTEM = `You are MainEvent's internal finance assistant for an event-production Contract-to-Cash system.
You help students and teammates understand Billing & A/R, ASC 606 Compliance, and Cost & Resource Tracking using a live data snapshot.
Be accurate, concise, and educational. Never invent financial figures.
Contracts are identified by human contract_number (e.g. ME-2026-222222222220) and/or event name; ME- numbers are contract_number values, not UUIDs.
When asked about costs, use the COST & RESOURCE TRACKING section (actuals, commitments, approvals, flags by category) — not only GAAP cost classifications.`;
