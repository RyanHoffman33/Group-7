import { createClient } from "@/lib/supabase/server";
import type {
  ContractDeliverable,
  DeliverablePhase,
  ObligationWithResources,
  WorkAssignment,
  WorkAssignmentDetail,
  WorkAttachment,
  WorkCompletion,
  WorkContractDocument,
  WorkEventStatus,
  WorkException,
  WorkExceptionRow,
  WorkObligationHandoff,
  WorkObligationResource,
  WorkParty,
  WorkPerformanceObligation,
  WorkTimeMaterial,
} from "./types";

function num(v: unknown): number {
  return Number(v ?? 0);
}

/**
 * Optional party filter hooks for a future role split.
 * Pass assigneePartyId / partyType later — no table rewrite required.
 */
export type WorkQueryFilter = {
  assigneePartyId?: string;
  partyType?: string;
  submitterPartyId?: string;
  approverPartyId?: string;
};

export async function listWorkEventStatuses(): Promise<WorkEventStatus[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_work_event_status")
    .select("*")
    .gt("promised_count", 0)
    .order("event_end", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...(r as WorkEventStatus),
    promised_count: num(r.promised_count),
    scheduled_count: num(r.scheduled_count),
    completed_count: num(r.completed_count),
    outstanding_count: num(r.outstanding_count),
    assignment_total: num(r.assignment_total),
    assignment_completed: num(r.assignment_completed),
    pending_exceptions: num(r.pending_exceptions),
    outstanding_pct: num(r.outstanding_pct),
    has_contract: Boolean(r.has_contract),
    ai_obligation_count: num(r.ai_obligation_count),
    manual_obligation_count: num(r.manual_obligation_count),
  }));
}

export async function getWorkEventStatus(
  contractId: string,
): Promise<WorkEventStatus | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_work_event_status")
    .select("*")
    .eq("contract_id", contractId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...(data as WorkEventStatus),
    promised_count: num(data.promised_count),
    scheduled_count: num(data.scheduled_count),
    completed_count: num(data.completed_count),
    outstanding_count: num(data.outstanding_count),
    assignment_total: num(data.assignment_total),
    assignment_completed: num(data.assignment_completed),
    pending_exceptions: num(data.pending_exceptions),
    outstanding_pct: num(data.outstanding_pct),
    has_contract: Boolean(data.has_contract),
    ai_obligation_count: num(data.ai_obligation_count),
    manual_obligation_count: num(data.manual_obligation_count),
  };
}

export async function listDeliverablesForContract(
  contractId: string,
): Promise<ContractDeliverable[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contract_deliverables")
    .select("*")
    .eq("contract_id", contractId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as ContractDeliverable[];
}

export async function listAssignmentsForContract(
  contractId: string,
  filter?: WorkQueryFilter,
): Promise<(WorkAssignment & { assignee_name: string | null })[]> {
  const supabase = createClient();
  let q = supabase
    .from("work_assignments")
    .select("*, work_parties!assignee_party_id(display_name)")
    .eq("contract_id", contractId)
    .order("scheduled_start", { ascending: true });

  // Future role filter — kept as a single WHERE, not separate tables.
  if (filter?.assigneePartyId) {
    q = q.eq("assignee_party_id", filter.assigneePartyId);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as WorkAssignment & {
      work_parties?: { display_name: string } | null;
    };
    return {
      id: r.id,
      contract_id: r.contract_id,
      deliverable_id: r.deliverable_id,
      assignee_party_id: r.assignee_party_id,
      title: r.title,
      instructions: r.instructions,
      location: r.location,
      scheduled_start: r.scheduled_start,
      scheduled_end: r.scheduled_end,
      status: r.status,
      created_at: r.created_at,
      assignee_name: r.work_parties?.display_name ?? null,
    };
  });
}

/** Vendor-facing assignments + linked cost invoice refs for portal accuracy. */
export async function listVendorFacingWork(): Promise<
  {
    id: string;
    title: string;
    status: string;
    event_name: string | null;
    scheduled_start: string | null;
    scheduled_end: string | null;
    location: string | null;
    invoice_ref: string | null;
    cost_amount: number | null;
  }[]
> {
  const supabase = createClient();
  const { data: parties } = await supabase
    .from("work_parties")
    .select("id")
    .eq("party_type", "vendor")
    .eq("active", true);
  const partyIds = (parties ?? []).map((p) => p.id as string);
  if (!partyIds.length) return [];

  const { data, error } = await supabase
    .from("work_assignments")
    .select(
      "id, title, status, scheduled_start, scheduled_end, location, contract_id, contracts(event_name)",
    )
    .in("assignee_party_id", partyIds)
    .order("scheduled_start", { ascending: true });
  if (error) throw error;

  const contractIds = [
    ...new Set((data ?? []).map((r) => r.contract_id as string).filter(Boolean)),
  ];
  const { data: costs } = contractIds.length
    ? await supabase
        .from("cost_entries")
        .select("contract_id, invoice_ref, amount, vendor_name")
        .in("contract_id", contractIds)
        .not("invoice_ref", "is", null)
    : { data: [] as { contract_id: string; invoice_ref: string; amount: number; vendor_name: string | null }[] };

  const costByContract = new Map<
    string,
    { invoice_ref: string; amount: number }
  >();
  for (const c of costs ?? []) {
    const name = (c.vendor_name ?? "").toLowerCase();
    if (name.includes("brightstage") || name.includes("stage") || !costByContract.has(c.contract_id)) {
      costByContract.set(c.contract_id, {
        invoice_ref: c.invoice_ref as string,
        amount: num(c.amount),
      });
    }
  }

  return (data ?? []).map((row) => {
    const contracts = row.contracts as
      | { event_name: string | null }
      | { event_name: string | null }[]
      | null;
    const c = Array.isArray(contracts) ? contracts[0] : contracts;
    const cost = costByContract.get(row.contract_id as string);
    return {
      id: row.id as string,
      title: row.title as string,
      status: row.status as string,
      event_name: c?.event_name ?? null,
      scheduled_start: (row.scheduled_start as string | null) ?? null,
      scheduled_end: (row.scheduled_end as string | null) ?? null,
      location: (row.location as string | null) ?? null,
      invoice_ref: cost?.invoice_ref ?? null,
      cost_amount: cost?.amount ?? null,
    };
  });
}

export async function getAssignmentDetail(
  assignmentId: string,
): Promise<WorkAssignmentDetail | null> {
  const supabase = createClient();
  const { data: assignment, error } = await supabase
    .from("work_assignments")
    .select("*")
    .eq("id", assignmentId)
    .maybeSingle();
  if (error) throw error;
  if (!assignment) return null;

  const a = assignment as WorkAssignment;

  const [
    { data: assignee },
    { data: deliverable },
    { data: contract },
    { data: completion },
    { data: timeMaterials },
    { data: attachments },
    { data: exceptions },
  ] = await Promise.all([
    supabase
      .from("work_parties")
      .select("*")
      .eq("id", a.assignee_party_id)
      .maybeSingle(),
    supabase
      .from("contract_deliverables")
      .select("*")
      .eq("id", a.deliverable_id)
      .maybeSingle(),
    supabase
      .from("contracts")
      .select("event_name, customers(name)")
      .eq("id", a.contract_id)
      .maybeSingle(),
    supabase
      .from("work_completions")
      .select("*")
      .eq("assignment_id", assignmentId)
      .maybeSingle(),
    supabase
      .from("work_time_materials")
      .select("*")
      .eq("assignment_id", assignmentId)
      .order("created_at"),
    supabase
      .from("work_attachments")
      .select("*")
      .eq("assignment_id", assignmentId)
      .order("created_at"),
    supabase
      .from("work_exceptions")
      .select("*")
      .eq("assignment_id", assignmentId)
      .order("created_at", { ascending: false }),
  ]);

  const contractRow = contract as {
    event_name?: string;
    customers?: { name: string } | { name: string }[] | null;
  } | null;
  const customerRel = contractRow?.customers;
  const customerName = Array.isArray(customerRel)
    ? customerRel[0]?.name ?? null
    : customerRel?.name ?? null;

  return {
    ...a,
    assignee: (assignee as WorkParty) ?? null,
    deliverable: (deliverable as ContractDeliverable) ?? null,
    event_name: contractRow?.event_name ?? null,
    customer_name: customerName,
    completion: (completion as WorkCompletion) ?? null,
    time_materials: ((timeMaterials ?? []) as WorkTimeMaterial[]).map((t) => ({
      ...t,
      quantity: num(t.quantity),
      unit_cost: num(t.unit_cost),
      hours: t.hours == null ? null : num(t.hours),
    })),
    attachments: (attachments ?? []) as WorkAttachment[],
    exceptions: ((exceptions ?? []) as WorkException[]).map((e) => ({
      ...e,
      estimated_amount:
        e.estimated_amount == null ? null : num(e.estimated_amount),
    })),
  };
}

export async function listWorkParties(): Promise<WorkParty[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("work_parties")
    .select("*")
    .eq("active", true)
    .order("display_name");
  if (error) throw error;
  return (data ?? []) as WorkParty[];
}

export async function listExceptions(
  filter?: WorkQueryFilter & { status?: string; contractId?: string },
): Promise<WorkExceptionRow[]> {
  const supabase = createClient();
  let q = supabase
    .from("work_exceptions")
    .select(
      "*, contracts(event_name), submitter:work_parties!submitted_by_party_id(display_name), approver:work_parties!approver_party_id(display_name), work_assignments(title)",
    )
    .order("created_at", { ascending: false });

  if (filter?.status) q = q.eq("status", filter.status);
  if (filter?.contractId) q = q.eq("contract_id", filter.contractId);
  if (filter?.submitterPartyId) {
    q = q.eq("submitted_by_party_id", filter.submitterPartyId);
  }
  if (filter?.approverPartyId) {
    q = q.eq("approver_party_id", filter.approverPartyId);
  }

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((row) => {
    const r = row as WorkException & {
      contracts?: { event_name: string } | null;
      submitter?: { display_name: string } | null;
      approver?: { display_name: string } | null;
      work_assignments?: { title: string } | null;
    };
    return {
      id: r.id,
      contract_id: r.contract_id,
      assignment_id: r.assignment_id,
      exception_type: r.exception_type,
      description: r.description,
      submitted_by_party_id: r.submitted_by_party_id,
      approver_party_id: r.approver_party_id,
      status: r.status,
      billable_eligible: r.billable_eligible,
      estimated_amount:
        r.estimated_amount == null ? null : num(r.estimated_amount),
      resolution_notes: r.resolution_notes,
      approved_at: r.approved_at,
      created_at: r.created_at,
      event_name: r.contracts?.event_name ?? null,
      submitter_name: r.submitter?.display_name ?? null,
      approver_name: r.approver?.display_name ?? null,
      assignment_title: r.work_assignments?.title ?? null,
    };
  });
}

export function groupDeliverablesByPhase(
  items: ContractDeliverable[],
): Record<DeliverablePhase, ContractDeliverable[]> {
  return {
    planning: items.filter((d) => d.phase === "planning"),
    execution: items.filter((d) => d.phase === "execution"),
    wrapup: items.filter((d) => d.phase === "wrapup"),
  };
}

/** Risk copy helper — days until event_start (proxy for missing contracts.event_date). */
export function daysUntilEvent(eventStart: string | null): number | null {
  if (!eventStart) return null;
  const start = new Date(eventStart);
  const now = new Date();
  const diff = Math.ceil(
    (start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  return diff;
}

export async function listContractDocuments(
  contractId: string,
): Promise<WorkContractDocument[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("work_contract_documents")
    .select("*")
    .eq("contract_id", contractId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as WorkContractDocument[];
}

export async function listActiveWorkParties(): Promise<WorkParty[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("work_parties")
    .select("*")
    .eq("active", true)
    .order("display_name");
  if (error) throw error;
  return (data ?? []) as WorkParty[];
}

/**
 * Ensure every contract_deliverable has a linked performance obligation.
 * Keeps one ASC 606-aligned list (no orphan "work item" peers).
 */
export async function ensureObligationsCoverDeliverables(
  contractId: string,
): Promise<void> {
  const supabase = createClient();

  const [{ data: deliverables }, { data: existing }, { data: contract }] =
    await Promise.all([
      supabase
        .from("contract_deliverables")
        .select("*")
        .eq("contract_id", contractId)
        .order("sort_order"),
      supabase
        .from("work_performance_obligations")
        .select("id, deliverable_id, obligation_number")
        .eq("contract_id", contractId),
      supabase
        .from("contracts")
        .select("customers(name, billing_email)")
        .eq("id", contractId)
        .maybeSingle(),
    ]);

  const linked = new Set(
    (existing ?? [])
      .map((o) => o.deliverable_id as string | null)
      .filter(Boolean),
  );
  const orphans = ((deliverables ?? []) as ContractDeliverable[]).filter(
    (d) => !linked.has(d.id),
  );
  if (orphans.length === 0) return;

  const { data: party } = await supabase
    .from("work_parties")
    .select("id")
    .eq("active", true)
    .in("party_type", ["crew", "vendor"])
    .order("display_name")
    .limit(1)
    .maybeSingle();

  const cust = contract?.customers as
    | { name: string; billing_email: string | null }
    | { name: string; billing_email: string | null }[]
    | null
    | undefined;
  const customer = Array.isArray(cust) ? cust[0] : cust;

  let nextNum =
    (existing ?? []).reduce(
      (m, o) => Math.max(m, Number(o.obligation_number ?? 0)),
      0,
    ) + 1;

  const phaseRank: Record<string, number> = {
    planning: 1,
    execution: 2,
    wrapup: 3,
  };
  orphans.sort(
    (a, b) =>
      (phaseRank[a.phase] ?? 9) - (phaseRank[b.phase] ?? 9) ||
      a.sort_order - b.sort_order,
  );

  for (const d of orphans) {
    const statusMap: Record<string, string> = {
      promised: "identified",
      scheduled: "scheduled",
      in_progress: "in_progress",
      completed: "completed",
      waived: "waived",
    };
    const { data: created, error } = await supabase
      .from("work_performance_obligations")
      .insert({
        contract_id: contractId,
        deliverable_id: d.id,
        obligation_number: nextNum,
        code: `PO-${nextNum}`,
        title: d.title,
        description: d.description,
        phase: d.phase,
        status: statusMap[d.status] ?? "identified",
        source: "seed",
        assignee_party_id: party?.id ?? null,
        customer_contact_name: customer?.name
          ? `${customer.name} AP`
          : null,
        customer_contact_email: customer?.billing_email ?? null,
        estimated_labor_hours: 0,
        estimated_supply_cost: 0,
        ready_for_cost_tracking: true,
        ready_for_billing_ref: true,
        sort_order: nextNum,
      })
      .select("id")
      .single();
    if (error) throw error;

    await supabase.from("work_obligation_resources").insert({
      obligation_id: created.id,
      contract_id: contractId,
      resource_type: "manpower",
      label: "Assigned crew",
      quantity: 1,
      unit: "people",
      estimated_unit_cost: 45,
      export_to_cost: true,
    });
    nextNum += 1;
  }
}

export async function listObligationsForContract(
  contractId: string,
): Promise<ObligationWithResources[]> {
  const supabase = createClient();
  const { data: obligations, error } = await supabase
    .from("work_performance_obligations")
    .select("*, work_parties!assignee_party_id(display_name)")
    .eq("contract_id", contractId)
    .order("obligation_number", { ascending: true });
  if (error) throw error;

  const ids = (obligations ?? []).map((o) => o.id);
  if (ids.length === 0) return [];

  const { data: resources, error: rErr } = await supabase
    .from("work_obligation_resources")
    .select("*")
    .in("obligation_id", ids)
    .order("created_at");
  if (rErr) throw rErr;

  const byOb = new Map<string, WorkObligationResource[]>();
  for (const r of (resources ?? []) as WorkObligationResource[]) {
    const list = byOb.get(r.obligation_id) ?? [];
    list.push({
      ...r,
      quantity: num(r.quantity),
      estimated_unit_cost: num(r.estimated_unit_cost),
    });
    byOb.set(r.obligation_id, list);
  }

  return (obligations ?? []).map((raw) => {
    const row = raw as WorkPerformanceObligation & {
      work_parties?: { display_name: string } | null;
    };
    const resourcesForOb = byOb.get(row.id) ?? [];
    let labor = 0;
    let supply = 0;
    for (const r of resourcesForOb) {
      const line = r.quantity * r.estimated_unit_cost;
      if (r.resource_type === "manpower") labor += line;
      else supply += line;
    }
    if (supply === 0 && num(row.estimated_supply_cost) > 0) {
      supply = num(row.estimated_supply_cost);
    }
    if (labor === 0 && num(row.estimated_labor_hours) > 0) {
      labor = num(row.estimated_labor_hours) * 45;
    }
    return {
      ...row,
      obligation_number: num(row.obligation_number) || num(row.sort_order) || 0,
      estimated_labor_hours: num(row.estimated_labor_hours),
      estimated_supply_cost: num(row.estimated_supply_cost),
      assignee_name: row.work_parties?.display_name ?? null,
      resources: resourcesForOb,
      labor_cost_estimate: labor,
      supply_cost_estimate: supply,
      total_cost_estimate: labor + supply,
    };
  });
}

/** For Cost / Accounting tabs — same view they should query. */
export async function listObligationHandoff(
  contractId?: string,
): Promise<WorkObligationHandoff[]> {
  const supabase = createClient();
  let q = supabase
    .from("v_work_obligation_handoff")
    .select("*")
    .order("event_name");
  if (contractId) q = q.eq("contract_id", contractId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...(r as WorkObligationHandoff),
    estimated_labor_hours: num(r.estimated_labor_hours),
    estimated_supply_cost: num(r.estimated_supply_cost),
    manpower_line_count: num(r.manpower_line_count),
    supply_line_count: num(r.supply_line_count),
    equipment_line_count: num(r.equipment_line_count),
    resource_estimated_total: num(r.resource_estimated_total),
  }));
}

export type WorkBoardFilter =
  | "all"
  | "outstanding"
  | "completed"
  | "at_risk"
  | "exceptions"
  | "no_contract";

export function filterWorkEvents(
  events: WorkEventStatus[],
  filter: WorkBoardFilter,
): WorkEventStatus[] {
  switch (filter) {
    case "outstanding":
      return events.filter((e) => e.outstanding_count > 0);
    case "completed":
      return events.filter(
        (e) => e.promised_count > 0 && e.outstanding_count === 0,
      );
    case "at_risk":
      return events.filter(
        (e) =>
          e.outstanding_pct >= 40 ||
          e.pending_exceptions > 0 ||
          e.contract_status === "deposit_pending",
      );
    case "exceptions":
      return events.filter((e) => e.pending_exceptions > 0);
    case "no_contract":
      return events; // caller may intersect with docs
    default:
      return events;
  }
}
