import type {
  BillableCost,
  BillableTimeEntry,
  BillingMethod,
  Contract,
  ContractMilestone,
} from "@/lib/supabase/types";

export const BILLING_METHODS: {
  id: BillingMethod;
  label: string;
  summary: string;
}[] = [
  {
    id: "fixed_price",
    label: "Fixed-price",
    summary: "Bill the contracted event fee (or remaining unbilled balance).",
  },
  {
    id: "hourly",
    label: "Hourly",
    summary: "Hours worked × contracted hourly rate.",
  },
  {
    id: "time_and_materials",
    label: "Time & materials",
    summary: "Billable hours plus materials/costs (optionally marked up).",
  },
  {
    id: "milestone",
    label: "Milestone",
    summary: "Bill completed but unbilled contract milestones.",
  },
  {
    id: "progress",
    label: "Progress billing",
    summary: "Contract value × % complete, less amounts already billed.",
  },
  {
    id: "retainer",
    label: "Retainer",
    summary: "Periodic retainer fee for standing production capacity.",
  },
  {
    id: "deposit",
    label: "Deposit",
    summary: "Up-front deposit % of contract value (unearned liability).",
  },
  {
    id: "recurring",
    label: "Recurring monthly",
    summary: "Standing monthly production/support charge.",
  },
  {
    id: "per_service",
    label: "Per-service",
    summary: "Quantity of discrete services × per-service rate.",
  },
  {
    id: "placement_fee",
    label: "Placement fee",
    summary: "% of placed talent/vendor contract value.",
  },
  {
    id: "reimbursable",
    label: "Reimbursable costs",
    summary: "Pass-through costs incurred for the event (no markup).",
  },
  {
    id: "cost_plus",
    label: "Cost-plus",
    summary: "Cost basis × (1 + markup %) per arrangement.",
  },
];

export type BillLineDraft = {
  description: string;
  amount: number;
  line_type: string;
  quantity?: number;
  unit_rate?: number;
  hours?: number;
  cost_basis?: number;
  markup_percent?: number;
  performance_obligation_ref?: string;
  source_ids?: { time?: string[]; costs?: string[]; milestones?: string[] };
};

export type BillDetermination = {
  method: BillingMethod;
  methodLabel: string;
  explanation: string[];
  lines: BillLineDraft[];
  subtotal: number;
  tax: number;
  total: number;
  milestone_key?: string;
  depositMode?: boolean;
};

export type DeterminationInputs = {
  contract: Contract;
  method: BillingMethod;
  alreadyBilled: number;
  unbilledTime: BillableTimeEntry[];
  unbilledCosts: BillableCost[];
  openMilestones: ContractMilestone[];
  /** For per-service / placement scenarios */
  serviceQuantity?: number;
  placementBase?: number;
  taxRate?: number;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Determines what the customer should be billed for a given method + contract inputs.
 * Transparent calc steps are returned for the UI (ACCY demonstration).
 */
export function determineBill(input: DeterminationInputs): BillDetermination {
  const methodMeta = BILLING_METHODS.find((m) => m.id === input.method)!;
  const taxRate = input.taxRate ?? 0;
  const lines: BillLineDraft[] = [];
  const explanation: string[] = [];
  let milestone_key: string | undefined;
  let depositMode = false;

  const c = input.contract;
  const remaining = Math.max(0, Number(c.contract_value) - input.alreadyBilled);

  switch (input.method) {
    case "fixed_price": {
      const amt = remaining > 0 ? remaining : Number(c.contract_value);
      explanation.push(
        `Fixed-price contract value ${c.contract_value} − already billed ${input.alreadyBilled} = ${amt} to bill.`,
      );
      lines.push({
        description: `${c.event_name} — fixed-price fee`,
        amount: amt,
        line_type: "fixed",
        quantity: 1,
        unit_rate: amt,
        performance_obligation_ref: "PO-fixed",
      });
      break;
    }
    case "hourly": {
      const hours = input.unbilledTime.reduce((s, t) => s + Number(t.hours), 0);
      const rate = Number(c.hourly_rate) || 0;
      const amt = round2(hours * rate);
      explanation.push(
        `Unbilled hours ${hours} × hourly rate $${rate} = $${amt}.`,
      );
      if (hours === 0) {
        explanation.push("No unbilled time entries — add hours before issuing.");
      }
      lines.push({
        description: `Hourly production labor (${hours} hrs @ $${rate})`,
        amount: amt,
        line_type: "hourly",
        hours,
        unit_rate: rate,
        quantity: hours,
        source_ids: { time: input.unbilledTime.map((t) => t.id) },
        performance_obligation_ref: "PO-hourly",
      });
      break;
    }
    case "time_and_materials": {
      const hours = input.unbilledTime.reduce((s, t) => s + Number(t.hours), 0);
      const laborRate = Number(c.hourly_rate) || 0;
      const labor = round2(hours * laborRate);
      explanation.push(`Labor: ${hours} hrs × $${laborRate} = $${labor}.`);
      lines.push({
        description: `T&M labor (${hours} hrs)`,
        amount: labor,
        line_type: "hourly",
        hours,
        unit_rate: laborRate,
        quantity: hours,
        source_ids: { time: input.unbilledTime.map((t) => t.id) },
      });
      for (const cost of input.unbilledCosts) {
        const markup = Number(cost.markup_percent) || Number(c.markup_percent) || 0;
        const billAmt = round2(
          Number(cost.cost_amount) * (1 + markup / 100),
        );
        explanation.push(
          `Materials/cost "${cost.description}": $${cost.cost_amount} + ${markup}% = $${billAmt}.`,
        );
        lines.push({
          description: `T&M materials — ${cost.description}`,
          amount: billAmt,
          line_type: "materials",
          cost_basis: Number(cost.cost_amount),
          markup_percent: markup,
          quantity: 1,
          unit_rate: billAmt,
          source_ids: { costs: [cost.id] },
        });
      }
      break;
    }
    case "milestone": {
      const open = input.openMilestones.filter((m) => m.completed && !m.billed_invoice_id);
      if (open.length === 0) {
        explanation.push("No completed unbilled milestones available.");
      }
      for (const m of open) {
        explanation.push(`Milestone "${m.label}" (${m.milestone_key}) = $${m.amount}.`);
        lines.push({
          description: `Milestone — ${m.label}`,
          amount: Number(m.amount),
          line_type: "milestone",
          quantity: 1,
          unit_rate: Number(m.amount),
          performance_obligation_ref: m.milestone_key,
          source_ids: { milestones: [m.id] },
        });
        if (!milestone_key) milestone_key = m.milestone_key;
      }
      break;
    }
    case "progress": {
      const pct = Number(c.progress_percent) || 0;
      const earned = round2(Number(c.contract_value) * (pct / 100));
      const amt = round2(Math.max(0, earned - input.alreadyBilled));
      explanation.push(
        `Progress ${pct}% × contract $${c.contract_value} = earned $${earned}; less billed $${input.alreadyBilled} = $${amt}.`,
      );
      lines.push({
        description: `Progress billing — ${pct}% complete`,
        amount: amt,
        line_type: "progress",
        quantity: pct / 100,
        unit_rate: Number(c.contract_value),
        performance_obligation_ref: `progress-${pct}`,
      });
      milestone_key = `progress-${pct}`;
      break;
    }
    case "retainer": {
      const amt = Number(c.retainer_amount) || Number(c.recurring_amount) || 0;
      explanation.push(`Monthly retainer fee = $${amt}.`);
      lines.push({
        description: `Retainer — ${c.event_name}`,
        amount: amt,
        line_type: "retainer",
        quantity: 1,
        unit_rate: amt,
      });
      break;
    }
    case "deposit": {
      depositMode = true;
      const pct = Number(c.deposit_percent) || 0;
      const amt = round2(Number(c.contract_value) * (pct / 100));
      explanation.push(
        `Deposit ${pct}% × contract $${c.contract_value} = $${amt} (recorded as unearned liability until earned).`,
      );
      lines.push({
        description: `Customer deposit — ${pct}%`,
        amount: amt,
        line_type: "deposit",
        quantity: pct / 100,
        unit_rate: Number(c.contract_value),
      });
      break;
    }
    case "recurring": {
      const amt = Number(c.recurring_amount) || 0;
      explanation.push(`Recurring monthly charge = $${amt}.`);
      lines.push({
        description: `Recurring monthly production fee`,
        amount: amt,
        line_type: "recurring",
        quantity: 1,
        unit_rate: amt,
      });
      break;
    }
    case "per_service": {
      const qty = input.serviceQuantity ?? 1;
      const rate = Number(c.per_service_rate) || 0;
      const amt = round2(qty * rate);
      explanation.push(`Per-service: ${qty} × $${rate} = $${amt}.`);
      lines.push({
        description: `Per-service charges (${qty} services)`,
        amount: amt,
        line_type: "per_service",
        quantity: qty,
        unit_rate: rate,
      });
      break;
    }
    case "placement_fee": {
      const base = input.placementBase ?? Number(c.contract_value);
      const pct = Number(c.placement_fee_percent) || 0;
      const amt = round2(base * (pct / 100));
      explanation.push(
        `Placement fee ${pct}% × placed value $${base} = $${amt}.`,
      );
      lines.push({
        description: `Talent/vendor placement fee (${pct}%)`,
        amount: amt,
        line_type: "placement_fee",
        quantity: pct / 100,
        unit_rate: base,
      });
      break;
    }
    case "reimbursable": {
      const costs = input.unbilledCosts.filter((x) => x.is_reimbursable);
      if (costs.length === 0) {
        explanation.push("No unbilled reimbursable costs.");
      }
      for (const cost of costs) {
        explanation.push(
          `Reimburse "${cost.description}" at cost $${cost.cost_amount} (no markup).`,
        );
        lines.push({
          description: `Reimbursable — ${cost.description}`,
          amount: Number(cost.cost_amount),
          line_type: "reimbursable",
          cost_basis: Number(cost.cost_amount),
          markup_percent: 0,
          quantity: 1,
          unit_rate: Number(cost.cost_amount),
          source_ids: { costs: [cost.id] },
        });
      }
      break;
    }
    case "cost_plus": {
      const markup = Number(c.markup_percent) || 0;
      const costs = input.unbilledCosts;
      if (costs.length === 0) {
        explanation.push("No unbilled costs for cost-plus billing.");
      }
      for (const cost of costs) {
        const billAmt = round2(Number(cost.cost_amount) * (1 + markup / 100));
        explanation.push(
          `Cost-plus "${cost.description}": $${cost.cost_amount} × (1 + ${markup}%) = $${billAmt}.`,
        );
        lines.push({
          description: `Cost-plus — ${cost.description}`,
          amount: billAmt,
          line_type: "cost_plus",
          cost_basis: Number(cost.cost_amount),
          markup_percent: markup,
          quantity: 1,
          unit_rate: billAmt,
          source_ids: { costs: [cost.id] },
        });
      }
      break;
    }
  }

  const subtotal = round2(lines.reduce((s, l) => s + Number(l.amount), 0));
  const tax = round2(subtotal * taxRate);
  return {
    method: input.method,
    methodLabel: methodMeta.label,
    explanation,
    lines,
    subtotal,
    tax,
    total: round2(subtotal + tax),
    milestone_key,
    depositMode,
  };
}
