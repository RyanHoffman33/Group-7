/**
 * Static registry of MainEvent internal controls.
 *
 * Every entry was verified against the codebase or live schema before being
 * listed (file paths / constraints cited in `enforcement`). The registry is
 * display data only — enforcement itself lives where each entry says it does.
 * `primaryPolicy` / `alsoSupports` match gaap_policies.topic for policy linkage.
 */

export type ControlCategory =
  | "Authorization"
  | "Accounting Policy"
  | "Data Integrity"
  | "Monitoring / Detective"
  | "Access / SoD";

export type Assertion =
  | "existence"
  | "completeness"
  | "accuracy"
  | "cutoff"
  | "valuation";

export type EvidenceKey =
  | "recognition_flags"
  | "overbilling"
  | "cost_flags"
  | "dedup"
  | "pending_approvals"
  | "exceptions"
  | "payment_integrity";

export type Control = {
  id: string;
  name: string;
  category: ControlCategory;
  risk: string;
  /** One jargon-free sentence: what the control does and why it matters. */
  plainEnglish: string;
  /** gaap_policies.topic this control primarily enforces; omitted = cross-cutting. */
  primaryPolicy?: string;
  /** Additional gaap_policies.topic values this control also supports. */
  alsoSupports?: string[];
  assertions: Assertion[];
  enforcement: { point: string; mechanism: string }[];
  evidenceKey?: EvidenceKey;
};

export const controls: Control[] = [
  {
    id: "rbac-sod",
    name: "Role-based access & segregation of duties",
    category: "Access / SoD",
    risk: "Users viewing or acting on financial data outside their role; one person controlling both sides of a transaction.",
    plainEnglish: "Each person only sees and does what their job requires, and no single person can control both sides of the same transaction.",
    assertions: ["existence", "accuracy"],
    enforcement: [
      { point: "Every route", mechanism: "middleware.ts — direct-URL blocking with /access-denied redirect" },
      { point: "Sidebar navigation", mechanism: "role-nav + access matrix (features/access/matrix.ts) — role-scoped sections" },
      { point: "Duty separation", mechanism: "features/access/sod.ts — segregation-of-duties rules" },
    ],
  },
  {
    id: "contract-approval",
    name: "Contract approval workflow",
    category: "Authorization",
    risk: "Contracts becoming billable without management authorization.",
    plainEnglish: "A contract cannot start generating work or bills until someone other than its creator approves it.",
    primaryPolicy: "Auditability and financial reporting support",
    assertions: ["existence", "cutoff"],
    enforcement: [
      { point: "/contracts/approvals", mechanism: "Status workflow draft → pending_approval → active; create and approve are separate actions" },
      { point: "contract_audit_events", mechanism: "Append-only audit trail of every status transition" },
    ],
  },
  {
    id: "deposit-gate",
    name: "Deposit-before-work gate",
    category: "Authorization",
    risk: "Incurring event costs before the customer has financial commitment.",
    plainEnglish: "We do not start working an event until the customer's deposit is in.",
    primaryPolicy: "Deposits and retainers",
    assertions: ["existence"],
    enforcement: [
      { point: "/work (Event Board)", mechanism: "deposit_pending contracts are blocked from work start (app/work — depositBlocked)" },
      { point: "contracts", mechanism: "requires_deposit_before_work flag on the contract" },
    ],
  },
  {
    id: "deposits-liability",
    name: "Deposits recorded as liabilities",
    category: "Accounting Policy",
    risk: "Customer deposits recognized as revenue before performance (overstated revenue, understated liabilities).",
    plainEnglish: "Money customers pay up front is treated as money we owe them until we deliver the event.",
    primaryPolicy: "Deposits and retainers",
    alsoSupports: ["Billed before vs after performance"],
    assertions: ["completeness", "valuation", "cutoff"],
    enforcement: [
      { point: "deposits table", mechanism: "CHECK constraint: status ∈ unearned | applied | refunded" },
      { point: "/compliance/deposits-retainers", mechanism: "Unearned register; liability split in v_contract_liability" },
    ],
  },
  {
    id: "recognition-evidence",
    name: "Revenue recognition evidence requirement",
    category: "Accounting Policy",
    risk: "Revenue recognized without documented transfer of control (ASC 606).",
    plainEnglish: "We only count revenue as earned when there is a document proving we delivered — cash alone does not count.",
    primaryPolicy: "Evidence supporting recognition",
    alsoSupports: ["When revenue is recognized"],
    assertions: ["existence", "cutoff"],
    enforcement: [
      { point: "recognition_evidence", mechanism: "Evidence register linked to contract/invoice with typed evidence" },
      { point: "v_profit_exceptions", mechanism: "recognized_without_evidence detective flag for any gap" },
    ],
    evidenceKey: "recognition_flags",
  },
  {
    id: "overbilling",
    name: "Over-billing prevention",
    category: "Monitoring / Detective",
    risk: "Invoicing beyond authorized contract value plus approved change orders.",
    plainEnglish: "The system will not let us invoice a customer for more than the contract (plus approved changes) says they owe.",
    primaryPolicy: "Contract modifications",
    assertions: ["accuracy", "valuation"],
    enforcement: [
      { point: "Billing determine flow", mechanism: "Charges derived from contract terms and milestones" },
      { point: "Reconciliation", mechanism: "billed ≤ contract_value + approved modifications, monitored continuously" },
    ],
    evidenceKey: "overbilling",
  },
  {
    id: "cost-flags",
    name: "Cost data-quality flags at entry",
    category: "Data Integrity",
    risk: "Late, duplicate, or unauthorized costs distorting event margins.",
    plainEnglish: "Costs that arrive late, twice, or bigger than promised get flagged automatically the moment they are entered.",
    primaryPolicy: "Cost classification",
    assertions: ["accuracy", "cutoff", "completeness"],
    enforcement: [
      { point: "cost_entries", mechanism: "Automatic flags: late entry, after billing, duplicate invoice, over-committed, actual-exceeds-committed (features/costs/flags.ts)" },
      { point: "/costs/flags", mechanism: "Flag review queue" },
    ],
    evidenceKey: "cost_flags",
  },
  {
    id: "cost-dedup",
    name: "Cross-source cost deduplication",
    category: "Data Integrity",
    risk: "The same economic cost counted twice across cost_entries and GAAP-classified billable costs.",
    plainEnglish: "If the same cost shows up in two places, it only counts once — and borderline cases get shown to a human.",
    primaryPolicy: "Cost classification",
    alsoSupports: ["Profitability measurement"],
    assertions: ["accuracy", "valuation"],
    enforcement: [
      { point: "v_profit_contract_costs", mechanism: "Documented match rule (contract, amount, reimbursable flag) — classified source wins" },
      { point: "v_profit_exceptions", mechanism: "Near-matches surfaced as suspected_duplicate_cost, never silently dropped" },
    ],
    evidenceKey: "dedup",
  },
  {
    id: "expense-approval",
    name: "Expense approval thresholds",
    category: "Authorization",
    risk: "Costs committed without appropriate spending authority.",
    plainEnglish: "Spending over a set amount has to be approved by someone with the authority to sign off on it.",
    assertions: ["existence", "accuracy"],
    enforcement: [
      { point: "/costs/approvals", mechanism: "Pending-approval queue; amount authority rules in features/access/thresholds.ts" },
      { point: "cost_entries.approval_status", mechanism: "approved / pending_approval / not_required states" },
    ],
    evidenceKey: "pending_approvals",
  },
  {
    id: "change-order-history",
    name: "Change-order history preservation",
    category: "Data Integrity",
    risk: "Contract value changes overwriting history; retroactive rewrites of billed periods.",
    plainEnglish: "Every price change keeps a record of what the contract said before, so history cannot be quietly rewritten.",
    primaryPolicy: "Contract modifications",
    assertions: ["completeness", "accuracy"],
    enforcement: [
      { point: "contract_modifications", mechanism: "prior_contract_value retained on every mod; approved vs applied are distinct states" },
      { point: "/compliance/modifications", mechanism: "Modification register with accounting treatment" },
    ],
  },
  {
    id: "exception-monitoring",
    name: "Profitability exception monitoring",
    category: "Monitoring / Detective",
    risk: "Margin, billing, and integrity anomalies going unnoticed until period close.",
    plainEnglish: "One inbox lists everything that looks wrong — losing money, unbilled work, missing paperwork — so nothing waits until year-end to be noticed.",
    primaryPolicy: "Profitability measurement",
    alsoSupports: ["Auditability and financial reporting support"],
    assertions: ["completeness", "accuracy", "valuation"],
    enforcement: [
      { point: "/profitability/exceptions", mechanism: "v_profit_exceptions — ten typed detective flags with plain-English risk statements" },
    ],
    evidenceKey: "exceptions",
  },
  {
    id: "ar-ledger",
    name: "Append-only A/R audit ledger",
    category: "Data Integrity",
    risk: "Billing history edited after the fact; unauditable receivables.",
    plainEnglish: "Every bill and payment is written to a permanent log that can be added to but never edited.",
    primaryPolicy: "Auditability and financial reporting support",
    assertions: ["completeness", "existence"],
    enforcement: [
      { point: "ar_ledger_entries", mechanism: "Append-only issue/payment entries; CHECK constraints debit ≥ 0, credit ≥ 0" },
      { point: "/compliance/audit", mechanism: "Audit pack export includes the full ledger" },
    ],
  },
  {
    id: "payment-integrity",
    name: "Payment application integrity",
    category: "Data Integrity",
    risk: "Payments applied beyond invoice balances or split beyond the cash received.",
    plainEnglish: "A payment cannot be applied for more than the invoice asks or more cash than we actually received.",
    primaryPolicy: "Unpaid customer balances",
    assertions: ["accuracy", "existence"],
    enforcement: [
      { point: "features/billing/actions.ts", mechanism: "Apply amount validated against invoice outstanding and payment amount before write" },
    ],
    evidenceKey: "payment_integrity",
  },
];

export const categoryOrder: ControlCategory[] = [
  "Access / SoD",
  "Authorization",
  "Accounting Policy",
  "Data Integrity",
  "Monitoring / Detective",
];
