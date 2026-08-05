"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canStartWork } from "@/features/contracts/status";
import type {
  ExceptionType,
  TimeMaterialEntryType,
} from "./types";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function revalidateWork(paths?: string[]) {
  revalidatePath("/work");
  revalidatePath("/work/exceptions");
  for (const p of paths ?? []) revalidatePath(p);
}

/** Block crew spend / check-in until contract is Active (deposit satisfied). */
async function assertWorkAuthorized(
  contractId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contracts")
    .select("status, deposit_required, event_name")
    .eq("id", contractId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, error: "Contract not found." };
  if (canStartWork(data.status)) return { ok: true };
  if (data.status === "deposit_pending") {
    return {
      ok: false,
      error: `Work is blocked — required deposit not received for “${data.event_name}”. Record the deposit in Billing before check-in or cost entry.`,
    };
  }
  return {
    ok: false,
    error: `Work is blocked — contract status is “${String(data.status).replaceAll("_", " ")}”. Only Active engagements can start production.`,
  };
}

async function contractIdForAssignment(
  assignmentId: string,
): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("work_assignments")
    .select("contract_id")
    .eq("id", assignmentId)
    .maybeSingle();
  return (data?.contract_id as string | undefined) ?? null;
}

/** Defaults for assignee + customer contact on new obligations. */
async function resolveObligationDefaults(contractId: string): Promise<{
  assigneePartyId: string | null;
  customerContactName: string | null;
  customerContactEmail: string | null;
}> {
  const supabase = createClient();
  const [{ data: party }, { data: contract }] = await Promise.all([
    supabase
      .from("work_parties")
      .select("id")
      .eq("active", true)
      .in("party_type", ["crew", "vendor"])
      .order("display_name")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("contracts")
      .select("customers(name, billing_email)")
      .eq("id", contractId)
      .maybeSingle(),
  ]);
  const cust = contract?.customers as
    | { name: string; billing_email: string | null }
    | { name: string; billing_email: string | null }[]
    | null
    | undefined;
  const customer = Array.isArray(cust) ? cust[0] : cust;
  return {
    assigneePartyId: (party?.id as string | undefined) ?? null,
    customerContactName: customer?.name
      ? `${customer.name} AP`
      : null,
    customerContactEmail: customer?.billing_email ?? null,
  };
}

/** Demo stub until Users & Roles ? always allows. */
export async function assertCanApproveException(
  _actorPartyId?: string,
): Promise<{ allowed: boolean; reason?: string }> {
  return { allowed: true };
}

export async function checkInAssignment(
  assignmentId: string,
  performedByPartyId?: string,
): Promise<ActionResult> {
  try {
    const contractId = await contractIdForAssignment(assignmentId);
    if (!contractId) return { ok: false, error: "Assignment not found." };
    const gate = await assertWorkAuthorized(contractId);
    if (!gate.ok) return gate;

    const supabase = createClient();
    const now = new Date().toISOString();

    const { data: existing } = await supabase
      .from("work_completions")
      .select("id")
      .eq("assignment_id", assignmentId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("work_completions")
        .update({
          checked_in_at: now,
          performed_by_party_id: performedByPartyId || null,
        })
        .eq("assignment_id", assignmentId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("work_completions").insert({
        assignment_id: assignmentId,
        checked_in_at: now,
        performed_by_party_id: performedByPartyId || null,
      });
      if (error) throw error;
    }

    const { error: statusErr } = await supabase
      .from("work_assignments")
      .update({ status: "checked_in" })
      .eq("id", assignmentId);
    if (statusErr) throw statusErr;

    // Mark deliverable in progress when crew starts work
    const { data: assignment } = await supabase
      .from("work_assignments")
      .select("deliverable_id, contract_id")
      .eq("id", assignmentId)
      .single();
    if (assignment?.deliverable_id) {
      await supabase
        .from("contract_deliverables")
        .update({ status: "in_progress" })
        .eq("id", assignment.deliverable_id)
        .in("status", ["promised", "scheduled"]);
    }

    revalidateWork([
      `/work/assignments/${assignmentId}`,
      assignment?.contract_id
        ? `/work/events/${assignment.contract_id}`
        : "",
    ].filter(Boolean));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function completeAssignment(input: {
  assignmentId: string;
  workNotes?: string;
  performedByPartyId?: string;
  completedBeforeApproval?: boolean;
}): Promise<ActionResult> {
  try {
    const contractId = await contractIdForAssignment(input.assignmentId);
    if (!contractId) return { ok: false, error: "Assignment not found." };
    const gate = await assertWorkAuthorized(contractId);
    if (!gate.ok) return gate;

    const supabase = createClient();
    const now = new Date().toISOString();

    const { data: existing } = await supabase
      .from("work_completions")
      .select("id, checked_in_at")
      .eq("assignment_id", input.assignmentId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("work_completions")
        .update({
          completed_at: now,
          work_notes: input.workNotes || null,
          performed_by_party_id: input.performedByPartyId || null,
          completed_before_approval: input.completedBeforeApproval ?? false,
          checked_in_at: existing.checked_in_at ?? now,
        })
        .eq("assignment_id", input.assignmentId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("work_completions").insert({
        assignment_id: input.assignmentId,
        checked_in_at: now,
        completed_at: now,
        work_notes: input.workNotes || null,
        performed_by_party_id: input.performedByPartyId || null,
        completed_before_approval: input.completedBeforeApproval ?? false,
      });
      if (error) throw error;
    }

    const { error: statusErr } = await supabase
      .from("work_assignments")
      .update({ status: "completed" })
      .eq("id", input.assignmentId);
    if (statusErr) throw statusErr;

    const { data: assignment } = await supabase
      .from("work_assignments")
      .select("deliverable_id, contract_id")
      .eq("id", input.assignmentId)
      .single();

    if (assignment?.deliverable_id) {
      // Complete deliverable when all its assignments are done
      const { data: siblings } = await supabase
        .from("work_assignments")
        .select("status")
        .eq("deliverable_id", assignment.deliverable_id);
      const allDone = (siblings ?? []).every((s) => s.status === "completed");
      if (allDone) {
        await supabase
          .from("contract_deliverables")
          .update({ status: "completed" })
          .eq("id", assignment.deliverable_id);
      }
    }

    revalidateWork([
      `/work/assignments/${input.assignmentId}`,
      assignment?.contract_id
        ? `/work/events/${assignment.contract_id}`
        : "",
    ].filter(Boolean));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function addTimeMaterial(input: {
  assignmentId: string;
  entryType: TimeMaterialEntryType;
  description: string;
  quantity?: number;
  unitLabel?: string;
  unitCost?: number;
  hours?: number;
  notes?: string;
  recordedByPartyId?: string;
}): Promise<ActionResult> {
  try {
    const contractId = await contractIdForAssignment(input.assignmentId);
    if (!contractId) return { ok: false, error: "Assignment not found." };
    const gate = await assertWorkAuthorized(contractId);
    if (!gate.ok) return gate;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("work_time_materials")
      .insert({
        assignment_id: input.assignmentId,
        entry_type: input.entryType,
        description: input.description,
        quantity: input.quantity ?? 1,
        unit_label: input.unitLabel || null,
        unit_cost: input.unitCost ?? 0,
        hours: input.hours ?? null,
        notes: input.notes || null,
        recorded_by_party_id: input.recordedByPartyId || null,
      })
      .select("id")
      .single();
    if (error) throw error;
    revalidateWork([`/work/assignments/${input.assignmentId}`]);
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function addAttachmentUrl(input: {
  assignmentId?: string;
  exceptionId?: string;
  fileName: string;
  externalUrl: string;
  uploadedByPartyId?: string;
}): Promise<ActionResult> {
  try {
    if (!input.assignmentId && !input.exceptionId) {
      return { ok: false, error: "assignmentId or exceptionId required" };
    }
    const supabase = createClient();
    const { data, error } = await supabase
      .from("work_attachments")
      .insert({
        assignment_id: input.assignmentId || null,
        exception_id: input.exceptionId || null,
        file_name: input.fileName,
        external_url: input.externalUrl,
        storage_path: null,
        uploaded_by_party_id: input.uploadedByPartyId || null,
      })
      .select("id")
      .single();
    if (error) throw error;
    const paths: string[] = [];
    if (input.assignmentId) paths.push(`/work/assignments/${input.assignmentId}`);
    if (input.exceptionId) paths.push("/work/exceptions");
    revalidateWork(paths);
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function raiseException(input: {
  contractId: string;
  assignmentId?: string;
  exceptionType: ExceptionType;
  description: string;
  submittedByPartyId: string;
  approverPartyId?: string;
  estimatedAmount?: number;
  evidenceUrl?: string;
}): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("work_exceptions")
      .insert({
        contract_id: input.contractId,
        assignment_id: input.assignmentId || null,
        exception_type: input.exceptionType,
        description: input.description,
        submitted_by_party_id: input.submittedByPartyId,
        approver_party_id:
          input.approverPartyId || "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01",
        status: "pending_approval",
        billable_eligible: false,
        estimated_amount: input.estimatedAmount ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;

    if (input.assignmentId) {
      await supabase
        .from("work_assignments")
        .update({ status: "blocked" })
        .eq("id", input.assignmentId)
        .neq("status", "completed");
    }

    if (input.evidenceUrl?.trim()) {
      await supabase.from("work_attachments").insert({
        assignment_id: null,
        exception_id: data.id,
        file_name: "Evidence link",
        external_url: input.evidenceUrl.trim(),
        storage_path: null,
        uploaded_by_party_id: input.submittedByPartyId,
      });
    }

    revalidateWork([
      "/work/exceptions",
      `/work/events/${input.contractId}`,
      input.assignmentId ? `/work/assignments/${input.assignmentId}` : "",
    ].filter(Boolean));
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function approveException(
  exceptionId: string,
  resolutionNotes?: string,
): Promise<ActionResult> {
  try {
    const gate = await assertCanApproveException();
    if (!gate.allowed) {
      return { ok: false, error: gate.reason ?? "Not allowed" };
    }
    const supabase = createClient();
    const { data, error } = await supabase
      .from("work_exceptions")
      .update({
        status: "approved",
        billable_eligible: true,
        approved_at: new Date().toISOString(),
        resolution_notes: resolutionNotes || null,
      })
      .eq("id", exceptionId)
      .select("id, assignment_id, contract_id")
      .single();
    if (error) throw error;

    // Unblock assignment if it was blocked for this exception
    if (data.assignment_id) {
      await supabase
        .from("work_assignments")
        .update({ status: "scheduled" })
        .eq("id", data.assignment_id)
        .eq("status", "blocked");
    }

    revalidateWork([
      "/work/exceptions",
      `/work/events/${data.contract_id}`,
      data.assignment_id ? `/work/assignments/${data.assignment_id}` : "",
    ].filter(Boolean));
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function rejectException(
  exceptionId: string,
  resolutionNotes?: string,
): Promise<ActionResult> {
  try {
    const gate = await assertCanApproveException();
    if (!gate.allowed) {
      return { ok: false, error: gate.reason ?? "Not allowed" };
    }
    const supabase = createClient();
    const { data, error } = await supabase
      .from("work_exceptions")
      .update({
        status: "rejected",
        billable_eligible: false,
        approved_at: new Date().toISOString(),
        resolution_notes: resolutionNotes || null,
      })
      .eq("id", exceptionId)
      .select("id, assignment_id, contract_id")
      .single();
    if (error) throw error;

    if (data.assignment_id) {
      await supabase
        .from("work_assignments")
        .update({ status: "scheduled" })
        .eq("id", data.assignment_id)
        .eq("status", "blocked");
    }

    revalidateWork([
      "/work/exceptions",
      `/work/events/${data.contract_id}`,
      data.assignment_id ? `/work/assignments/${data.assignment_id}` : "",
    ].filter(Boolean));
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Attach a contract document (text and/or URL) to an engagement.
 */
export async function attachContractDocument(input: {
  contractId: string;
  title?: string;
  fileName?: string;
  externalUrl?: string;
  contractText?: string;
  uploadedByPartyId?: string;
}): Promise<ActionResult> {
  try {
    if (!input.contractText?.trim() && !input.externalUrl?.trim()) {
      return {
        ok: false,
        error: "Provide contract text and/or a document URL.",
      };
    }
    const supabase = createClient();

    await supabase
      .from("work_contract_documents")
      .update({ is_primary: false })
      .eq("contract_id", input.contractId);

    const { data, error } = await supabase
      .from("work_contract_documents")
      .insert({
        contract_id: input.contractId,
        title: input.title?.trim() || "Engagement contract",
        file_name: input.fileName || null,
        external_url: input.externalUrl || null,
        contract_text: input.contractText || null,
        scan_status: "pending",
        is_primary: true,
        uploaded_by_party_id: input.uploadedByPartyId || null,
      })
      .select("id")
      .single();
    if (error) throw error;

    revalidateWork([`/work/events/${input.contractId}`, "/work"]);
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Run the contract scan agent and persist obligations + manpower/supply lines.
 * Upserts contract_deliverables so operational work stays linked.
 */
export async function scanContractDocument(
  documentId: string,
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const { data: doc, error: docErr } = await supabase
      .from("work_contract_documents")
      .select("*")
      .eq("id", documentId)
      .single();
    if (docErr) throw docErr;

    let text = (doc.contract_text as string | null) || "";
    if (!text.trim() && doc.external_url) {
      text = `Contract document URL: ${doc.external_url}\n(Title: ${doc.title}). Extract typical event-production performance obligations for this engagement.`;
    }

    await supabase
      .from("work_contract_documents")
      .update({ scan_status: "scanning", scan_error: null })
      .eq("id", documentId);

    const { scanContractText } = await import("./contractScan");
    let result;
    try {
      result = await scanContractText(text);
    } catch (scanErr) {
      const msg =
        scanErr instanceof Error ? scanErr.message : String(scanErr);
      await supabase
        .from("work_contract_documents")
        .update({ scan_status: "failed", scan_error: msg })
        .eq("id", documentId);
      return { ok: false, error: msg };
    }

    // AI scan replaces ALL obligations for this engagement (single source of truth)
    const { data: prior } = await supabase
      .from("work_performance_obligations")
      .select("id")
      .eq("contract_id", doc.contract_id);
    const priorIds = (prior ?? []).map((p) => p.id);
    if (priorIds.length) {
      await supabase
        .from("work_obligation_resources")
        .delete()
        .in("obligation_id", priorIds);
      await supabase
        .from("work_performance_obligations")
        .delete()
        .in("id", priorIds);
    }

    const defaults = await resolveObligationDefaults(doc.contract_id as string);

    let sort = 0;
    for (const ob of result.obligations) {
      sort += 1;
      const code = `PO-${sort}`;

      const { data: existingDel } = await supabase
        .from("contract_deliverables")
        .select("id")
        .eq("contract_id", doc.contract_id)
        .eq("code", code)
        .maybeSingle();

      let deliverableId = existingDel?.id as string | undefined;
      if (!deliverableId) {
        const { data: createdDel, error: delErr } = await supabase
          .from("contract_deliverables")
          .insert({
            contract_id: doc.contract_id,
            code,
            title: ob.title,
            description: ob.description,
            phase: ob.phase,
            status: "promised",
            sort_order: sort,
          })
          .select("id")
          .single();
        if (delErr) throw delErr;
        deliverableId = createdDel.id;
      } else {
        await supabase
          .from("contract_deliverables")
          .update({
            title: ob.title,
            description: ob.description,
            phase: ob.phase,
            status: "promised",
            sort_order: sort,
          })
          .eq("id", deliverableId);
      }

      const { data: obligation, error: obErr } = await supabase
        .from("work_performance_obligations")
        .insert({
          contract_id: doc.contract_id,
          document_id: documentId,
          deliverable_id: deliverableId,
          obligation_number: sort,
          code,
          title: ob.title,
          description: ob.description,
          phase: ob.phase,
          acceptance_criteria: ob.acceptance_criteria || null,
          status: "identified",
          source: "ai_scan",
          assignee_party_id: defaults.assigneePartyId,
          customer_contact_name: defaults.customerContactName,
          customer_contact_email: defaults.customerContactEmail,
          estimated_labor_hours: ob.estimated_labor_hours ?? 0,
          estimated_supply_cost: ob.estimated_supply_cost ?? 0,
          ready_for_cost_tracking: true,
          ready_for_billing_ref: true,
          sort_order: sort,
        })
        .select("id")
        .single();
      if (obErr) throw obErr;

      const resourceRows: {
        obligation_id: string;
        contract_id: string;
        resource_type: "manpower" | "supply" | "equipment";
        label: string;
        role_or_sku: string | null;
        quantity: number;
        unit: string | null;
        estimated_unit_cost: number;
        notes: string | null;
        export_to_cost: boolean;
      }[] =
        ob.resources.length > 0
          ? ob.resources.map((r) => ({
              obligation_id: obligation.id,
              contract_id: doc.contract_id,
              resource_type: r.resource_type,
              label: r.label,
              role_or_sku: r.role_or_sku || null,
              quantity: r.quantity,
              unit: r.unit || null,
              estimated_unit_cost: r.estimated_unit_cost ?? 0,
              notes: r.notes || null,
              export_to_cost: true,
            }))
          : [
              {
                obligation_id: obligation.id,
                contract_id: doc.contract_id,
                resource_type: "manpower",
                label: "Assigned crew",
                role_or_sku: null,
                quantity: 2,
                unit: "people",
                estimated_unit_cost: 45,
                notes: null,
                export_to_cost: true,
              },
            ];

      const { error: resErr } = await supabase
        .from("work_obligation_resources")
        .insert(resourceRows);
      if (resErr) throw resErr;
    }

    await supabase
      .from("work_contract_documents")
      .update({
        scan_status: "scanned",
        scanned_at: new Date().toISOString(),
        scan_error: null,
        raw_ai_json: {
          engine: result.engine,
          summary: result.summary,
          obligation_count: result.obligations.length,
        },
      })
      .eq("id", documentId);

    revalidateWork([`/work/events/${doc.contract_id}`, "/work"]);
    return { ok: true, id: documentId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Attach sample contract text + scan in one step (demo helper). */
export async function attachAndScanSampleContract(
  contractId: string,
  eventName: string,
  customerName: string,
): Promise<ActionResult> {
  const { sampleContractText } = await import("./contractScan");
  const attached = await attachContractDocument({
    contractId,
    title: `${eventName} - engagement agreement`,
    fileName: `${eventName.replace(/\s+/g, "-").toLowerCase()}-contract.txt`,
    contractText: sampleContractText(eventName, customerName),
  });
  if (!attached.ok || !attached.id) return attached;
  return scanContractDocument(attached.id);
}

export type ManualObligationInput = {
  title: string;
  description?: string;
  phase: "planning" | "execution" | "wrapup";
  crewCount?: number;
  suppliesNote?: string;
  assigneePartyId?: string;
  customerContactName?: string;
  customerContactEmail?: string;
};

/**
 * Guided manual entry - replaces all obligations for the engagement
 * with the answers from the question flow (source = manual).
 */
export async function saveManualObligations(input: {
  contractId: string;
  obligations: ManualObligationInput[];
}): Promise<ActionResult> {
  try {
    if (!input.obligations.length) {
      return { ok: false, error: "Add at least one performance obligation." };
    }
    const supabase = createClient();

    const { data: prior } = await supabase
      .from("work_performance_obligations")
      .select("id")
      .eq("contract_id", input.contractId);
    const priorIds = (prior ?? []).map((p) => p.id);
    if (priorIds.length) {
      await supabase
        .from("work_obligation_resources")
        .delete()
        .in("obligation_id", priorIds);
      await supabase
        .from("work_performance_obligations")
        .delete()
        .in("id", priorIds);
    }

    const defaults = await resolveObligationDefaults(input.contractId);

    let sort = 0;
    for (const ob of input.obligations) {
      sort += 1;
      const code = `PO-${sort}`;
      const crew = Math.max(0, Number(ob.crewCount ?? 0));
      const supplies = (ob.suppliesNote || "")
        .split(/,|;|\n/)
        .map((s) => s.trim())
        .filter(Boolean);

      const { data: existingDel } = await supabase
        .from("contract_deliverables")
        .select("id")
        .eq("contract_id", input.contractId)
        .eq("code", code)
        .maybeSingle();

      let deliverableId = existingDel?.id as string | undefined;
      if (!deliverableId) {
        const { data: createdDel, error: delErr } = await supabase
          .from("contract_deliverables")
          .insert({
            contract_id: input.contractId,
            code,
            title: ob.title,
            description: ob.description || null,
            phase: ob.phase,
            status: "promised",
            sort_order: sort,
          })
          .select("id")
          .single();
        if (delErr) throw delErr;
        deliverableId = createdDel.id;
      } else {
        await supabase
          .from("contract_deliverables")
          .update({
            title: ob.title,
            description: ob.description || null,
            phase: ob.phase,
            status: "promised",
            sort_order: sort,
          })
          .eq("id", deliverableId);
      }

      const { data: obligation, error: obErr } = await supabase
        .from("work_performance_obligations")
        .insert({
          contract_id: input.contractId,
          deliverable_id: deliverableId,
          obligation_number: sort,
          code,
          title: ob.title,
          description: ob.description || null,
          phase: ob.phase,
          status: "identified",
          source: "manual",
          assignee_party_id:
            ob.assigneePartyId || defaults.assigneePartyId,
          customer_contact_name:
            ob.customerContactName?.trim() ||
            defaults.customerContactName,
          customer_contact_email:
            ob.customerContactEmail?.trim() ||
            defaults.customerContactEmail,
          estimated_labor_hours: crew * 4,
          estimated_supply_cost: supplies.length * 50,
          ready_for_cost_tracking: true,
          ready_for_billing_ref: true,
          sort_order: sort,
        })
        .select("id")
        .single();
      if (obErr) throw obErr;

      const resources: {
        obligation_id: string;
        contract_id: string;
        resource_type: string;
        label: string;
        quantity: number;
        unit: string;
        estimated_unit_cost: number;
        export_to_cost: boolean;
      }[] = [];

      if (crew > 0) {
        resources.push({
          obligation_id: obligation.id,
          contract_id: input.contractId,
          resource_type: "manpower",
          label: "Crew / staff",
          quantity: crew,
          unit: "people",
          estimated_unit_cost: 45,
          export_to_cost: true,
        });
      }
      for (const s of supplies) {
        resources.push({
          obligation_id: obligation.id,
          contract_id: input.contractId,
          resource_type: "supply",
          label: s,
          quantity: 1,
          unit: "lot",
          estimated_unit_cost: 50,
          export_to_cost: true,
        });
      }
      if (resources.length === 0) {
        resources.push({
          obligation_id: obligation.id,
          contract_id: input.contractId,
          resource_type: "manpower",
          label: "Assigned crew",
          quantity: 1,
          unit: "people",
          estimated_unit_cost: 45,
          export_to_cost: true,
        });
      }
      const { error: resErr } = await supabase
        .from("work_obligation_resources")
        .insert(resources);
      if (resErr) throw resErr;
    }

    revalidateWork([`/work/events/${input.contractId}`, "/work"]);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
