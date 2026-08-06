import { formatCurrency } from "@/features/billing/aging";
import {
  buildAgingReport,
  getDashboardMetrics,
  listAlerts,
  listDeposits,
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
  listDeferredInvoices,
  listGaapPolicies,
  listRecognitionEvidence,
} from "@/features/gaap/queries";
import { listEventProfits } from "@/features/profitability/queries";
import {
  getAnalyticsBundle,
} from "@/features/analytics/queries";
import {
  rankingsFromSlices,
} from "@/features/analytics/rankings";
import {
  vendorFavorabilityFromData,
} from "@/features/analytics/favorability";
import {
  listContractsDetailed,
  getDashboardMetrics as getContractDashboardMetrics,
} from "@/features/contracts/queries";
import {
  listAllInquiriesForStaff,
  listCustomerFacingOffers,
  listInquiriesForCustomerEmail,
  listRfqsForVendorIds,
  resolveVendorIdsForPortalEmail,
  countPendingApprovals as countEngagementApprovals,
} from "@/features/engagement/queries";
import {
  listApprovalItemsForCustomerContracts,
  listCustomerContractProposals,
  listCustomerFacingContracts,
  resolveCustomerIdForPortalSession,
} from "@/features/involvement/queries";
import {
  listPerformanceObligationsForContracts,
} from "@/features/performance-obligations/queries";
import { PO_STATUS_LABELS } from "@/features/performance-obligations/types";
import { listWorkEventStatuses } from "@/features/work/queries";
import { getDirectoryStats } from "@/features/users/queries";
import {
  canViewCompanyWideAr,
  roleHasAnyPermission,
  roleHasPermission,
} from "@/features/access/matrix";
import { navSectionsForRole } from "@/features/users/role-nav";
import type { AppRole, SessionUser } from "@/features/users/types";
import { createClient } from "@/lib/supabase/server";

/** id (UUID) → human contract_number (ME-…) for assistant lookups. */
async function contractNumberById(
  ids?: string[],
): Promise<Map<string, string>> {
  const supabase = createClient();
  let q = supabase.from("contracts").select("id, contract_number");
  if (ids?.length) q = q.in("id", ids);
  const { data, error } = await q;
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

function section(title: string, body: string | null | undefined): string {
  if (!body?.trim()) return "";
  return `\n${title}\n${body.trim()}\n`;
}

function canSeeInternalFinance(role: AppRole): boolean {
  return roleHasAnyPermission(role, [
    "billing.read",
    "compliance.read",
    "ar.read",
    "costs.read",
    "profitability.read",
    "analytics.read",
    "dashboards.executive",
    "contracts.read",
  ]) && role !== "customer" && role !== "vendor" && role !== "attendee";
}

async function buildCustomerSnapshot(session: SessionUser): Promise<string> {
  const customerId = await resolveCustomerIdForPortalSession({
    organization: session.organization,
    email: session.email,
  });

  const [contracts, proposals, inquiries, offers] = await Promise.all([
    customerId
      ? listCustomerFacingContracts(customerId)
      : Promise.resolve([]),
    customerId
      ? listCustomerContractProposals(customerId)
      : Promise.resolve([]),
    listInquiriesForCustomerEmail(session.email).catch(() => []),
    listCustomerFacingOffers(session.email).catch(() => []),
  ]);

  const contractIds = contracts.map((c) => c.id);
  const [approvals, detailed, pos, numbers] = await Promise.all([
    listApprovalItemsForCustomerContracts(contractIds).catch(() => []),
    contractIds.length
      ? listContractsDetailed({ contractIds }).catch(() => [])
      : Promise.resolve([]),
    listPerformanceObligationsForContracts(contractIds).catch(() => []),
    contractNumberById(contractIds),
  ]);

  const contractLines = contracts
    .slice(0, 20)
    .map((c) => {
      const cash = detailed.find((d) => d.id === c.id);
      const bits = [
        `${c.contract_number || numbers.get(c.id) || c.id} | ${c.event_name}`,
        `status ${c.status}`,
        `involvement ${c.involvement_model}`,
        `value ${formatCurrency(c.contract_value)}`,
      ];
      if (cash) {
        bits.push(
          `billed ${formatCurrency(cash.billed_to_date)}`,
          `paid ${formatCurrency(cash.paid_to_date)}`,
          `open AR ${formatCurrency(cash.open_ar)}`,
          `deposits ${formatCurrency(cash.deposits_received_total)} (${cash.deposit_status})`,
        );
      }
      if (c.event_start) bits.push(`starts ${c.event_start.slice(0, 10)}`);
      return `- ${bits.join(" | ")}`;
    })
    .join("\n");

  const proposalLines = proposals
    .slice(0, 10)
    .map(
      (p) =>
        `- ${p.contract_number} | ${p.event_name} | status ${p.status} | value ${formatCurrency(p.contract_value)}`,
    )
    .join("\n");

  const pendingApprovals = approvals.filter((a) =>
    ["pending", "sent", "awaiting"].some((s) =>
      a.status.toLowerCase().includes(s),
    ) || a.status === "open",
  );
  const approvalLines = approvals
    .slice(0, 12)
    .map(
      (a) =>
        `- ${a.contract_number} | ${a.event_name} | ${a.title ?? a.checkpoint_type ?? "approval"} | status ${a.status}${a.due_date ? ` | due ${String(a.due_date).slice(0, 10)}` : ""}`,
    )
    .join("\n");

  const inquiryLines = inquiries
    .slice(0, 10)
    .map(
      (i) =>
        `- ${i.event_name} | status ${i.status} | budget ${i.budget_range || "n/a"} | ${i.preferred_start?.slice(0, 10) || "dates TBD"}`,
    )
    .join("\n");

  const offerLines = offers
    .slice(0, 10)
    .map(
      (o) =>
        `- ${o.event_name ?? "Inquiry"} | customer price ${formatCurrency(o.customer_price)} | status ${o.status}`,
    )
    .join("\n");

  const poByContract = new Map<string, typeof pos>();
  for (const p of pos) {
    const list = poByContract.get(p.contract_id) ?? [];
    list.push(p);
    poByContract.set(p.contract_id, list);
  }
  const poLines = [...poByContract.entries()]
    .slice(0, 12)
    .map(([cid, list]) => {
      const label = contractLabel(
        cid,
        contracts.find((c) => c.id === cid)?.event_name,
        numbers,
      );
      const summary = list
        .map(
          (p) =>
            `${p.seq}. ${p.title} (${PO_STATUS_LABELS[p.status] ?? p.status}, ${formatCurrency(p.amount)})`,
        )
        .join("; ");
      return `- ${label}: ${summary || "no POs"}`;
    })
    .join("\n");

  return `
COMPANY: MainEvent — customer portal view (scoped to your organization only).
AS OF: ${new Date().toISOString().slice(0, 10)}
SESSION: ${session.fullName} | role customer | org ${session.organization} | email ${session.email}
SCOPE: Only your contracts, proposals, approvals, inquiries, and customer-facing pricing. No internal costs, margins, other customers, or vendor markups.

YOUR CONTRACTS (${contracts.length})
${contractLines || "(none)"}

PENDING / OPEN PROPOSALS (${proposals.length})
${proposalLines || "(none)"}

CUSTOMER INVOLVEMENT APPROVALS (${approvals.length}; open-ish ${pendingApprovals.length})
${approvalLines || "(none)"}

PERFORMANCE OBLIGATIONS / POs (your contracts)
${poLines || "(none)"}

ENGAGEMENT INQUIRIES (${inquiries.length})
${inquiryLines || "(none)"}

VENDOR SERVICE OFFERS SENT TO YOU (${offers.length}) — customer price only
${offerLines || "(none)"}

RULES FOR ANSWERS
- Use ONLY the numbers above. Do not invent invoices, contracts, or dollar amounts.
- Never discuss MainEvent internal costs, COGS, profitability, other customers, or vendor cost/markup.
- Contract keys use human contract_number (ME-YYYY-…). Prefer ME-… over UUIDs.
- If something is not in this snapshot, say you do not have that detail for your portal.
- Keep answers concise (2–6 short paragraphs or bullets).
`.trim();
}

async function buildVendorSnapshot(session: SessionUser): Promise<string> {
  const vendorIds = await resolveVendorIdsForPortalEmail(session.email).catch(
    () => [] as string[],
  );
  const rfqs = await listRfqsForVendorIds(vendorIds).catch(() => []);

  const rfqLines = rfqs
    .slice(0, 15)
    .map(
      (r) =>
        `- ${r.title} | event ${r.inquiry_event_name ?? "n/a"} | status ${r.status} | sent ${r.sent_at?.slice(0, 10) ?? "n/a"}`,
    )
    .join("\n");

  return `
COMPANY: MainEvent — vendor portal view (scoped to your vendor account).
AS OF: ${new Date().toISOString().slice(0, 10)}
SESSION: ${session.fullName} | role vendor | org ${session.organization} | email ${session.email}
SCOPE: Only your RFQs and related assignment context. No company P&L, customer A/R, or other vendors' costs.

YOUR RFQs (${rfqs.length}; vendor ids linked: ${vendorIds.length})
${rfqLines || "(none linked to this portal email)"}

RULES FOR ANSWERS
- Use ONLY the numbers above. Do not invent RFQs or amounts.
- Refuse questions about company-wide revenue, profitability, other vendors, or customer billing.
- If something is not in this snapshot, say you do not have that detail in the vendor portal data.
- Keep answers concise.
`.trim();
}

async function buildStaffSnapshot(session: SessionUser): Promise<string> {
  const role = session.roleKey;
  const sections = navSectionsForRole(role);
  const parts: string[] = [];

  parts.push(`COMPANY: MainEvent — event production (ACCY 628 Contract-to-Cash demo).
AS OF: ${new Date().toISOString().slice(0, 10)}
SESSION: ${session.fullName} | role ${session.roleName} (${role}) | org ${session.organization}
NAV SECTIONS FOR ROLE: ${sections.join(", ") || "home_only"}
PERMISSION NOTE: Snapshot includes only domains allowed for this role. Refuse out-of-scope asks.`);

  const needContracts =
    roleHasPermission(role, "contracts.read") && role !== "customer";
  const needBilling =
    (roleHasPermission(role, "billing.read") ||
      roleHasPermission(role, "ar.read")) &&
    canSeeInternalFinance(role);
  const needCompliance =
    roleHasPermission(role, "compliance.read") ||
    roleHasPermission(role, "recognition.read");
  const needCosts = roleHasPermission(role, "costs.read");
  const needProfit = roleHasPermission(role, "profitability.read");
  const needAnalytics = roleHasPermission(role, "analytics.read");
  const needWork =
    roleHasPermission(role, "events.operate") ||
    roleHasPermission(role, "ready_for_billing") ||
    roleHasPermission(role, "events.assigned_only");
  const needIntake =
    roleHasPermission(role, "contracts.read") &&
    sections.includes("intake");
  const needUsersMeta =
    roleHasPermission(role, "users.read") &&
    (role === "executive" ||
      role === "system_admin" ||
      role === "department_manager");
  const companyAr = canViewCompanyWideAr(role);

  const fetches: Promise<unknown>[] = [];
  const keys: string[] = [];

  const track = <T,>(key: string, p: Promise<T>) => {
    keys.push(key);
    fetches.push(p);
  };

  if (needContracts || needBilling || needCompliance || needProfit) {
    track("contractNumbers", contractNumberById());
  }
  if (needContracts) {
    track("contractsDetailed", listContractsDetailed());
    track("contractDash", getContractDashboardMetrics());
  }
  if (needBilling) {
    track("billingMetrics", getDashboardMetrics());
    track("aging", buildAgingReport());
    track("alerts", listAlerts(false));
    track("deposits", listDeposits());
  }
  if (needCompliance) {
    track("positions", listContractPositions());
    track("evidence", listRecognitionEvidence());
    track("mods", listContractModifications());
    track("policies", listGaapPolicies());
    track("gaapCosts", listCostClassifications());
    track("deferred", listDeferredInvoices());
  }
  if (needCosts) {
    track("costStats", getCostDashboardStats());
    track("costBreakdown", getCategoryBreakdown());
    track("avgCost", getAverageCostPerProjectByCategory());
    track("costFlags", listExceptionCosts());
    track("costCommitments", listCommittedCosts());
    track("costApprovals", listPendingApprovals());
  }
  if (needProfit) {
    track("profitability", listEventProfits());
  }
  if (needAnalytics) {
    track("analytics", getAnalyticsBundle());
  }
  if (needWork) {
    track("work", listWorkEventStatuses());
  }
  if (needIntake) {
    track("inquiries", listAllInquiriesForStaff());
    track("pendingEng", countEngagementApprovals());
  }
  if (needUsersMeta) {
    track("dirStats", getDirectoryStats());
  }

  const results = await Promise.allSettled(fetches);
  const byKey = new Map<string, unknown>();
  keys.forEach((k, i) => {
    const r = results[i];
    if (r.status === "fulfilled") byKey.set(k, r.value);
  });

  const numbers =
    (byKey.get("contractNumbers") as Map<string, string> | undefined) ??
    new Map<string, string>();

  if (needContracts) {
    const rows =
      (byKey.get("contractsDetailed") as Awaited<
        ReturnType<typeof listContractsDetailed>
      >) ?? [];
    const dash = byKey.get("contractDash") as Awaited<
      ReturnType<typeof getContractDashboardMetrics>
    > | undefined;

    const open = rows.filter((r) => !["closed", "canceled"].includes(r.status));
    const top = open
      .slice(0, 15)
      .map((r) => {
        const me = r.contract_number || numbers.get(r.id) || r.id.slice(0, 8);
        return `- ${me} | ${r.event_name} | ${r.customer_name} | status ${r.status} | involvement ${r.involvement_model ?? "n/a"} | CV ${formatCurrency(r.contract_value)} | billed ${formatCurrency(r.billed_to_date)} | paid ${formatCurrency(r.paid_to_date)} | AR ${formatCurrency(r.open_ar)} | deposit ${r.deposit_status}`;
      })
      .join("\n");

    const poSampleIds = open.slice(0, 10).map((r) => r.id);
    const pos = await listPerformanceObligationsForContracts(poSampleIds).catch(
      () => [],
    );
    const poStatusCounts = new Map<string, number>();
    for (const p of pos) {
      poStatusCounts.set(p.status, (poStatusCounts.get(p.status) ?? 0) + 1);
    }
    const poCountLine = [...poStatusCounts.entries()]
      .map(([s, n]) => `${s}: ${n}`)
      .join(", ");
    const poLines = pos
      .filter((p) =>
        ["awaiting_approval", "active", "draft"].includes(p.status),
      )
      .slice(0, 12)
      .map((p) => {
        const row = rows.find((r) => r.id === p.contract_id);
        const label = contractLabel(p.contract_id, row?.event_name, numbers);
        return `- ${label}: PO ${p.seq} ${p.title} | ${PO_STATUS_LABELS[p.status] ?? p.status} | ${formatCurrency(p.amount)}`;
      })
      .join("\n");

    parts.push(
      section(
        "CONTRACTS PORTFOLIO",
        [
          dash
            ? `- Active: ${dash.activeCount}; pending approval: ${dash.pendingApprovalCount}; deposit pending: ${dash.depositPendingCount}; open CV total: ${formatCurrency(dash.totalCurrentValue)}; CO value: ${formatCurrency(dash.totalChangeOrderValue)}`
            : null,
          `- Open contracts listed: ${open.length} of ${rows.length} total`,
          top || "(none)",
        ]
          .filter(Boolean)
          .join("\n"),
      ),
    );
    parts.push(
      section(
        "PERFORMANCE OBLIGATIONS / POs (sample of open contracts)",
        [
          poCountLine ? `- Status mix (sample): ${poCountLine}` : null,
          poLines || "(none material)",
        ]
          .filter(Boolean)
          .join("\n"),
      ),
    );
  }

  if (needBilling) {
    const metrics = byKey.get("billingMetrics") as Awaited<
      ReturnType<typeof getDashboardMetrics>
    > | undefined;
    const aging =
      (byKey.get("aging") as Awaited<ReturnType<typeof buildAgingReport>>) ??
      [];
    const alerts =
      (byKey.get("alerts") as Awaited<ReturnType<typeof listAlerts>>) ?? [];
    const deposits =
      (byKey.get("deposits") as Awaited<ReturnType<typeof listDeposits>>) ?? [];

    if (metrics && companyAr) {
      const topAging = [...aging]
        .sort((a, b) => b.outstanding - a.outstanding)
        .slice(0, 8)
        .map(
          (r) =>
            `- ${r.invoice_number} | ${r.customer_name} | ${r.event_name} | ${formatCurrency(r.outstanding)} | aging ${r.bucket} | revenue status ${r.recognition_status} | p(collect) ${(r.p_collect * 100).toFixed(0)}%`,
        )
        .join("\n");

      const unearned = deposits
        .filter((d) => d.status === "unearned")
        .slice(0, 8)
        .map(
          (d) =>
            `- ${formatCurrency(Number(d.amount))} | status ${d.status} | received ${String(d.received_at ?? "").slice(0, 10)}`,
        )
        .join("\n");

      parts.push(
        section(
          "BILLING & A/R (portfolio)",
          `- Total outstanding A/R: ${formatCurrency(metrics.totalOutstanding)}
- Expected collections: ${formatCurrency(metrics.expectedCollections)}
- Unearned deposits (liability): ${formatCurrency(metrics.unearnedDeposits)}
- Deferred open A/R (billed, not yet recognized): ${formatCurrency(metrics.deferredRevenue)}
- Recognized open A/R: ${formatCurrency(metrics.recognizedOpenAr)}
- Open billing alerts: ${metrics.openAlertCount}
- Aging mix: current ${formatCurrency(metrics.byBucket.current)}; 1-30 ${formatCurrency(metrics.byBucket["1-30"])}; 31-60 ${formatCurrency(metrics.byBucket["31-60"])}; 61-90 ${formatCurrency(metrics.byBucket["61-90"])}; 90+ ${formatCurrency(metrics.byBucket["90+"])}`,
        ),
      );
      parts.push(section("TOP OPEN INVOICES BY OUTSTANDING", topAging || "(none)"));
      parts.push(
        section(
          "UNEARNED DEPOSITS SAMPLE",
          unearned || "(none)",
        ),
      );
      parts.push(
        section(
          "OPEN BILLING ALERTS",
          alerts.length
            ? alerts
                .slice(0, 8)
                .map(
                  (a) =>
                    `- ${a.invoice_number ?? a.invoice_id} | ${a.customer_name ?? "customer"} | ${a.from_bucket}→${a.to_bucket} | ${formatCurrency(a.outstanding_amount)}`,
                )
                .join("\n")
            : "(none)",
        ),
      );
    } else if (metrics && !companyAr) {
      parts.push(
        section(
          "BILLING SUMMARY (event-level; not company-wide AR posting)",
          `- Portfolio metrics available at a high level: outstanding ${formatCurrency(metrics.totalOutstanding)}; unearned deposits ${formatCurrency(metrics.unearnedDeposits)}. Prefer contract/event questions over company AR posting.`,
        ),
      );
    }
  }

  if (needCompliance) {
    const positions =
      (byKey.get("positions") as Awaited<
        ReturnType<typeof listContractPositions>
      >) ?? [];
    const totals = await getPositionTotals(positions).catch(() => null);
    const evidence =
      (byKey.get("evidence") as Awaited<
        ReturnType<typeof listRecognitionEvidence>
      >) ?? [];
    const mods =
      (byKey.get("mods") as Awaited<
        ReturnType<typeof listContractModifications>
      >) ?? [];
    const policies =
      (byKey.get("policies") as Awaited<ReturnType<typeof listGaapPolicies>>) ??
      [];
    const gaapCosts =
      (byKey.get("gaapCosts") as Awaited<
        ReturnType<typeof listCostClassifications>
      >) ?? [];
    const deferred =
      (byKey.get("deferred") as Awaited<
        ReturnType<typeof listDeferredInvoices>
      >) ?? [];

    if (totals) {
      parts.push(
        section(
          "ASC 606 CONTRACT POSITION (from v_gaap_contract_position)",
          `- Contract assets (earned not billed): ${formatCurrency(totals.contractAsset)}
- Contract liabilities (unearned deposits + deferred billed): ${formatCurrency(totals.contractLiability)}
- Unearned deposits: ${formatCurrency(totals.unearnedDeposits)}
- Deferred billed outstanding: ${formatCurrency(totals.deferredBilled)}
- Recognized revenue (billed & recognized): ${formatCurrency(totals.recognizedBilled)}
- Open A/R (position view): ${formatCurrency(totals.openAr)}`,
        ),
      );
    }

    const positionLines = positions
      .slice(0, 12)
      .map((p) => {
        const label = contractLabel(p.contract_id, p.event_name, numbers);
        return `- ${label} (${p.customer_name}): contract ${formatCurrency(p.contract_value)}, earned ${formatCurrency(p.earned_to_date)}, billed ${formatCurrency(p.billed_to_date)}, recognized ${formatCurrency(p.recognized_revenue_billed)}, asset ${formatCurrency(p.contract_asset)}, liability ${formatCurrency(p.total_contract_liability)}, open AR ${formatCurrency(p.open_ar)}, perf ${p.performance_complete ? "complete" : "in progress"}`;
      })
      .join("\n");
    parts.push(section("PER-CONTRACT POSITION", positionLines || "(none)"));

    const modLines = mods
      .slice(0, 10)
      .map((m) => {
        const label = contractLabel(m.contract_id, m.event_name, numbers);
        return `- ${m.mod_number} on ${label}: Δ ${formatCurrency(m.price_change)}, ${m.accounting_treatment}, status ${m.status}`;
      })
      .join("\n");
    parts.push(section("CONTRACT MODIFICATIONS", modLines || "(none)"));

    const deferredLines = deferred
      .slice(0, 8)
      .map(
        (d) =>
          `- ${d.invoice_number} | ${d.customer_name ?? "?"} | ${d.event_name ?? "?"} | ${formatCurrency(d.total)} | ${d.timing_badge}`,
      )
      .join("\n");
    parts.push(
      section(
        "GAAP RECOGNITION / EXCEPTIONS HIGHLIGHTS",
        [
          `- Recognition evidence rows: ${evidence.length}`,
          deferredLines
            ? `Deferred invoices (sample):\n${deferredLines}`
            : "- No deferred invoice exceptions in sample",
          gaapCosts.length
            ? `Cost classifications sample:\n${gaapCosts
                .slice(0, 8)
                .map((c) => {
                  const label = contractLabel(
                    c.contract_id,
                    c.event_name,
                    numbers,
                  );
                  return `- ${label}: ${c.classification} ${formatCurrency(c.amount)}`;
                })
                .join("\n")}`
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
      ),
    );

    const policyLines = policies
      .slice(0, 8)
      .map((p) => `- ${p.topic} (${p.asc_reference}): ${p.mainevent_rule}`)
      .join("\n");
    parts.push(section("KEY MAINEVENT GAAP POLICIES", policyLines || "(none)"));
  }

  if (needCosts) {
    const costStats = byKey.get("costStats") as Awaited<
      ReturnType<typeof getCostDashboardStats>
    > | undefined;
    const costBreakdown =
      (byKey.get("costBreakdown") as Awaited<
        ReturnType<typeof getCategoryBreakdown>
      >) ?? [];
    const avgCost =
      (byKey.get("avgCost") as Awaited<
        ReturnType<typeof getAverageCostPerProjectByCategory>
      >) ?? [];
    const costFlags =
      (byKey.get("costFlags") as Awaited<
        ReturnType<typeof listExceptionCosts>
      >) ?? [];
    const costCommitments =
      (byKey.get("costCommitments") as Awaited<
        ReturnType<typeof listCommittedCosts>
      >) ?? [];
    const costApprovals =
      (byKey.get("costApprovals") as Awaited<
        ReturnType<typeof listPendingApprovals>
      >) ?? [];

    if (costStats) {
      parts.push(
        section(
          "COST & RESOURCE TRACKING",
          `- Total actual costs: ${formatCurrency(costStats.totalActual)}
- Open commitments: ${formatCurrency(costStats.totalCommitted)}
- Pending cost approvals: ${costStats.pendingApprovals}
- Open cost control flags: ${costStats.openFlags}
- Approval threshold: any single cost ≥ $${APPROVAL_THRESHOLD.toLocaleString()} requires manager approval
- Commitment variance flag: actual exceeds committed by more than min(${(COMMITMENT_VARIANCE_PCT * 100).toFixed(0)}% of committed, $${COMMITMENT_VARIANCE_DOLLAR_CAP})
- No-commitment flag: actual cost entered with no prior committed amount
- Costs ≠ revenue; paid ≠ incurred.`,
        ),
      );
    }
    parts.push(
      section(
        "COSTS BY CATEGORY",
        costBreakdown
          .slice(0, 12)
          .map(
            (r) =>
              `- ${categoryLabel(r.category)}: ${formatCurrency(r.amount)}`,
          )
          .join("\n") || "(none)",
      ),
    );
    parts.push(
      section(
        "AVERAGE COST PER PROJECT (by category)",
        avgCost
          .slice(0, 10)
          .map(
            (r) =>
              `- ${categoryLabel(r.category)}: avg ${formatCurrency(r.average)} across ${r.projectCount} project(s)`,
          )
          .join("\n") || "(none)",
      ),
    );
    parts.push(
      section(
        "OPEN COST COMMITMENTS (sample)",
        costCommitments
          .slice(0, 8)
          .map(
            (e) =>
              `- ${e.event_name ?? "Event"} | ${categoryLabel(e.category)} | ${formatCurrency(e.amount)} | ${e.vendor_name ?? e.worker_label ?? "—"}`,
          )
          .join("\n") || "(none)",
      ),
    );
    parts.push(
      section(
        "PENDING COST APPROVALS (sample)",
        costApprovals
          .slice(0, 8)
          .map(
            (e) =>
              `- ${e.event_name ?? "Event"} | ${categoryLabel(e.category)} | ${formatCurrency(e.amount)} | awaiting approval`,
          )
          .join("\n") || "(none)",
      ),
    );
    parts.push(
      section(
        "COST FLAGS & EXCEPTIONS (sample)",
        costFlags
          .slice(0, 10)
          .map((e) => {
            const reasons = flagReasons(e).join("; ") || "flagged";
            return `- ${e.event_name ?? "Event"} | ${categoryLabel(e.category)} | ${formatCurrency(e.amount)} | ${reasons}`;
          })
          .join("\n") || "(none)",
      ),
    );
  }

  if (needProfit) {
    const profitability =
      (byKey.get("profitability") as Awaited<
        ReturnType<typeof listEventProfits>
      >) ?? [];
    const profitLines = profitability
      .filter(
        (p) =>
          p.recognized_revenue > 0 ||
          p.direct_cogs > 0 ||
          p.reimbursable_passthrough > 0,
      )
      .slice(0, 15)
      .map((p) => {
        const label = contractLabel(p.contract_id, p.event_name, numbers);
        return `- ${label}: recognized rev ${formatCurrency(p.recognized_revenue)}, direct COGS ${formatCurrency(p.direct_cogs)}, passthrough ${formatCurrency(p.reimbursable_passthrough)}, implied margin ${formatCurrency(p.gross_margin)}`;
      })
      .join("\n");
    parts.push(
      section(
        "PROFITABILITY BY EVENT (v_profit_event)",
        profitLines || "(none with activity)",
      ),
    );
  }

  if (needAnalytics) {
    const bundle = byKey.get("analytics") as Awaited<
      ReturnType<typeof getAnalyticsBundle>
    > | undefined;
    if (bundle) {
      const { kpis, history } = bundle;
      const last3 = history.slice(-3);
      const rankings = rankingsFromSlices(bundle.eventSlices, {
        year: "all",
        quarter: "all",
        month: "all",
      });
      const fav = vendorFavorabilityFromData(
        bundle.eventSlices,
        bundle.vendorHealth,
        { year: "all", quarter: "all", month: "all" },
        5,
      );
      const monthly = last3
        .map(
          (m) =>
            `- ${m.month.slice(0, 7)}: rev ${formatCurrency(m.revenue)}, COGS ${formatCurrency(m.cogs)}, margin ${formatCurrency(m.margin)}`,
        )
        .join("\n");
      const topCust = rankings.customers
        .slice(0, 5)
        .map(
          (c) =>
            `- ${c.label}: margin ${formatCurrency(c.margin)} (${c.count} events)`,
        )
        .join("\n");
      const topGroups = rankings.eventGroups
        .slice(0, 5)
        .map(
          (g) =>
            `- ${g.label}: margin ${formatCurrency(g.margin)} (${g.count})`,
        )
        .join("\n");
      const favLines = fav
        .map(
          (v) =>
            `- ${v.label}: favorability ${v.score.toFixed(0)}/100 | margin ${formatCurrency(v.margin)} | clean ${(v.cleanPct * 100).toFixed(0)}%`,
        )
        .join("\n");

      parts.push(
        section(
          "ANALYTICS HIGHLIGHTS",
          `- Source: ${bundle.source}
- Trailing ~6mo revenue: ${formatCurrency(kpis.trailingRevenue)}
- Trailing margin: ${formatCurrency(kpis.trailingMargin)} (${(kpis.trailingMarginPct * 100).toFixed(1)}%)
- YoY / half growth: ${kpis.revenueGrowthPct == null ? "n/a" : `${(kpis.revenueGrowthPct * 100).toFixed(1)}%`}
- Avg events / month (trailing): ${kpis.avgEvents.toFixed(1)}
- AR outstanding (analytics): ${formatCurrency(kpis.arOutstanding)}
Recent months:
${monthly || "(none)"}
Top customers by margin:
${topCust || "(none)"}
Top event groups:
${topGroups || "(none)"}
Vendor favorability (top):
${favLines || "(none)"}`,
        ),
      );
    }
  }

  if (needWork) {
    const work =
      (byKey.get("work") as Awaited<ReturnType<typeof listWorkEventStatuses>>) ??
      [];
    const attention = work
      .filter((w) => w.outstanding_count > 0 || w.pending_exceptions > 0)
      .slice(0, 12);
    const lines = (attention.length ? attention : work.slice(0, 10))
      .map((w) => {
        const me = numbers.get(w.contract_id);
        const label = me
          ? `${me} | ${w.event_name}`
          : `${w.event_name}`;
        return `- ${label} (${w.customer_name}): status ${w.contract_status} | deliverables ${w.completed_count}/${w.promised_count} | assignments ${w.assignment_completed}/${w.assignment_total} | outstanding ${w.outstanding_count} | exceptions ${w.pending_exceptions}`;
      })
      .join("\n");
    parts.push(
      section(
        "WORK / PROGRESS / ASSIGNMENTS",
        [
          `- Events with work status rows: ${work.length}`,
          lines || "(none)",
        ].join("\n"),
      ),
    );
  }

  if (needIntake) {
    const inquiries =
      (byKey.get("inquiries") as Awaited<
        ReturnType<typeof listAllInquiriesForStaff>
      >) ?? [];
    const pendingEng = (byKey.get("pendingEng") as number | undefined) ?? 0;
    const byStatus = new Map<string, number>();
    for (const i of inquiries) {
      byStatus.set(i.status, (byStatus.get(i.status) ?? 0) + 1);
    }
    const statusLine = [...byStatus.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([s, n]) => `${s}: ${n}`)
      .join("; ");
    const recent = inquiries
      .slice(0, 12)
      .map(
        (i) =>
          `- ${i.event_name} | ${i.organization || i.contact_name} | status ${i.status} | ${i.preferred_start?.slice(0, 10) || "TBD"}`,
      )
      .join("\n");
    parts.push(
      section(
        "ENGAGEMENT PIPELINE (inquiries / quotes / sourcing)",
        [
          `- Total inquiries: ${inquiries.length}; pending approval queue: ${pendingEng}`,
          statusLine ? `- By status: ${statusLine}` : null,
          recent || "(none)",
        ]
          .filter(Boolean)
          .join("\n"),
      ),
    );
  }

  if (needUsersMeta) {
    const dir = byKey.get("dirStats") as Awaited<
      ReturnType<typeof getDirectoryStats>
    > | undefined;
    if (dir) {
      parts.push(
        section(
          "USERS / ROLES (meta only — no credentials)",
          `- Users: ${dir.totalUsers} total, ${dir.activeUsers} active, ${dir.invitedUsers} invited, ${dir.disabledUsers} disabled
- Roles defined: ${dir.roleCount}; permission keys: ${dir.permissionCount}
- Do not expose passwords, API keys, or session secrets.`,
        ),
      );
    }
  }

  // Dashboard KPIs for roles that land on /home with manager board
  if (
    roleHasAnyPermission(role, [
      "dashboards.executive",
      "events.operate",
      "billing.read",
    ]) &&
    role !== "event_coordinator"
  ) {
    const dash = byKey.get("contractDash") as Awaited<
      ReturnType<typeof getContractDashboardMetrics>
    > | undefined;
    const billing = byKey.get("billingMetrics") as Awaited<
      ReturnType<typeof getDashboardMetrics>
    > | undefined;
    const work =
      (byKey.get("work") as Awaited<ReturnType<typeof listWorkEventStatuses>>) ??
      [];
    parts.push(
      section(
        "DASHBOARD KPIs",
        [
          dash
            ? `- Active contracts: ${dash.activeCount}; upcoming events (45d): ${dash.upcomingEvents.length}; at-risk / action: ${dash.atRisk.length}`
            : null,
          billing && companyAr
            ? `- Outstanding A/R: ${formatCurrency(billing.totalOutstanding)}; open alerts: ${billing.openAlertCount}`
            : null,
          work.length
            ? `- Work events tracked: ${work.length}; with outstanding deliverables: ${work.filter((w) => w.outstanding_count > 0).length}`
            : null,
        ]
          .filter(Boolean)
          .join("\n") || "(limited KPIs for this role)",
      ),
    );
  }

  parts.push(`
RULES FOR ANSWERS
- Use ONLY the numbers in this snapshot. Do not invent invoices, customers, costs, or dollar amounts.
- If something is not in the snapshot, say you do not have that detail in the live data for this role.
- Never reveal API keys, cron secrets, passwords, or env vars.
- Contract keys: human contract_number (ME-YYYY-…) then event name — ME-… is NOT a UUID.
- Prefer plain business language; keep answers concise (2–6 short paragraphs or bullets).
- Refuse questions outside this role's permitted domains (see SESSION / NAV SECTIONS).
`.trim());

  return parts.filter(Boolean).join("\n").trim();
}

async function buildMinimalSnapshot(session: SessionUser): Promise<string> {
  return `
COMPANY: MainEvent
AS OF: ${new Date().toISOString().slice(0, 10)}
SESSION: ${session.fullName} | role ${session.roleName} (${session.roleKey})
SCOPE: This role has no finance or portal data domains in the assistant snapshot.

RULES FOR ANSWERS
- Explain that you cannot access internal financial or other users' data for this role.
- Do not invent figures. Suggest signing in with an appropriate role for Billing, Contracts, or portal questions.
`.trim();
}

/**
 * Live MainEvent snapshot for the assistant — numbers from Supabase,
 * filtered strictly by the signed-in session role.
 */
export async function buildRoleScopedSnapshot(
  session: SessionUser,
): Promise<string> {
  if (session.roleKey === "customer") {
    return buildCustomerSnapshot(session);
  }
  if (session.roleKey === "vendor") {
    return buildVendorSnapshot(session);
  }
  if (session.roleKey === "attendee") {
    return buildMinimalSnapshot(session);
  }
  if (
    canSeeInternalFinance(session.roleKey) ||
    roleHasAnyPermission(session.roleKey, [
      "events.operate",
      "events.assigned_only",
      "contracts.read",
      "costs.read",
      "expenses.submit",
    ])
  ) {
    return buildStaffSnapshot(session);
  }
  return buildMinimalSnapshot(session);
}

/** @deprecated Use buildRoleScopedSnapshot(session) */
export async function buildCompanySnapshot(): Promise<string> {
  return buildRoleScopedSnapshot({
    id: "system",
    email: "system@mainevent.local",
    fullName: "System",
    roleKey: "system_admin",
    roleName: "System Admin",
    organization: "MainEvent",
  });
}

export function buildAssistantSystemPrompt(session: SessionUser): string {
  const role = session.roleKey;
  const sections = navSectionsForRole(role).join(", ");

  if (role === "customer") {
    return `You are Ask MainEvent for a customer portal user (${session.organization}).
Answer only from the LIVE SNAPSHOT about their contracts, proposals, approvals, inquiries, POs, and customer-facing prices.
Refuse any request for MainEvent internal costs, profitability, other customers, vendor markups, or secrets.
Never invent figures. Prefer ME- contract numbers. Be concise and practical.`;
  }
  if (role === "vendor") {
    return `You are Ask MainEvent for a vendor portal user (${session.organization}).
Answer only from the LIVE SNAPSHOT about their RFQs/assignments.
Refuse company P&L, other vendors' data, customer A/R, and secrets.
Never invent figures. Be concise.`;
  }
  if (role === "attendee") {
    return `You are Ask MainEvent. This attendee role has no finance snapshot — explain the limitation politely and do not invent data.`;
  }

  return `You are MainEvent's internal Ask MainEvent assistant for role ${session.roleName} (${role}).
Nav domains for this role: ${sections || "limited"}.
Help with Billing & A/R, Compliance/GAAP, Contracts, Costs, Work, Engagement, Analytics, and Profitability — but ONLY using domains present in the LIVE SNAPSHOT for this role.
Be accurate, concise, and practical. Never invent financial figures.
Refuse out-of-scope asks (e.g. customer-only portal data when not applicable, or domains not in the snapshot).
Never reveal API keys, cron secrets, passwords, or environment variables.
Contracts are identified by human contract number (e.g. ME-2026-…) and/or event name.
When asked about costs, use COST & RESOURCE TRACKING (actuals, commitments, approvals, flags).`;
}

/** @deprecated Use buildAssistantSystemPrompt(session) */
export const ASSISTANT_SYSTEM = `You are MainEvent's internal finance assistant for an event-production Contract-to-Cash system.
You help teammates understand Billing & A/R, Compliance, and Cost & Resource Tracking using a live data snapshot.
Be accurate, concise, and practical. Never invent financial figures.
Contracts are identified by human contract number (e.g. ME-2026-…) and/or event name.
When asked about costs, use the COST & RESOURCE TRACKING section (actuals, commitments, approvals, flags by category).`;
