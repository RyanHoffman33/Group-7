"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  getContractForGaap,
  updateContractValue,
} from "./adapters/contracts";
import type {
  CostClassificationType,
  EvidenceType,
  ModAccountingTreatment,
} from "@/lib/supabase/types";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function revalidateGaap() {
  revalidatePath("/compliance");
  revalidatePath("/compliance/recognition");
  revalidatePath("/compliance/deposits-retainers");
  revalidatePath("/compliance/modifications");
  revalidatePath("/compliance/costs");
  revalidatePath("/compliance/audit");
  revalidatePath("/compliance/policies");
  revalidatePath("/billing");
  revalidatePath("/billing/invoices");
}

/**
 * Brandon hook — wired to Users & Roles permission matrix.
 */
export async function assertCanRecognizeRevenue(
  _actor = "billing-user",
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const { requirePermission } = await import("@/features/access/enforce");
    const { denyAdminAccountingByDefault, denyCoordinatorFinancialAccess } =
      await import("@/features/access/sod");
    const session = await requirePermission("compliance.recognize");
    const coord = denyCoordinatorFinancialAccess(session.roleKey);
    if (!coord.allowed) return { allowed: false, reason: coord.reason };
    const admin = denyAdminAccountingByDefault(session.roleKey);
    if (!admin.allowed) return { allowed: false, reason: admin.reason };
    void _actor;
    return { allowed: true };
  } catch (e) {
    return {
      allowed: false,
      reason: e instanceof Error ? e.message : "Not permitted to recognize revenue.",
    };
  }
}

export async function assertCanApplyModification(
  _actor = "billing-user",
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const { requirePermission } = await import("@/features/access/enforce");
    const { denyAdminAccountingByDefault } = await import("@/features/access/sod");
    const session = await requirePermission("compliance.modify");
    const admin = denyAdminAccountingByDefault(session.roleKey);
    if (!admin.allowed) return { allowed: false, reason: admin.reason };
    void _actor;
    return { allowed: true };
  } catch (e) {
    return {
      allowed: false,
      reason: e instanceof Error ? e.message : "Not permitted to apply modifications.",
    };
  }
}

export async function addRecognitionEvidence(input: {
  contract_id: string;
  invoice_id?: string;
  evidence_type: EvidenceType;
  evidence_date: string;
  description: string;
  supporting_ref?: string;
}): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("recognition_evidence")
      .insert({
        contract_id: input.contract_id,
        invoice_id: input.invoice_id || null,
        evidence_type: input.evidence_type,
        evidence_date: input.evidence_date,
        description: input.description,
        supporting_ref: input.supporting_ref || null,
        created_by: "billing-user",
      })
      .select("id")
      .single();
    if (error) throw error;
    revalidateGaap();
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function approveModification(
  modId: string,
  approvedBy = "gabriel-stub",
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const { data: mod, error } = await supabase
      .from("contract_modifications")
      .select("*")
      .eq("id", modId)
      .single();
    if (error) throw error;
    if (mod.status !== "draft") {
      return { ok: false, error: "Only draft modifications can be approved." };
    }
    const { error: upd } = await supabase
      .from("contract_modifications")
      .update({ status: "approved", approved_by: approvedBy })
      .eq("id", modId);
    if (upd) throw upd;
    revalidateGaap();
    return { ok: true, id: modId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function applyModification(modId: string): Promise<ActionResult> {
  try {
    const gate = await assertCanApplyModification();
    if (!gate.allowed) {
      return { ok: false, error: gate.reason ?? "Not authorized to apply mods." };
    }

    const supabase = createClient();
    const { data: mod, error } = await supabase
      .from("contract_modifications")
      .select("*")
      .eq("id", modId)
      .single();
    if (error) throw error;
    if (mod.status !== "approved") {
      return { ok: false, error: "Modification must be approved before apply." };
    }
    if (mod.status === "applied") {
      return { ok: false, error: "Already applied." };
    }

    const contract = await getContractForGaap(mod.contract_id);
    if (!contract) return { ok: false, error: "Contract not found." };

    const prior = Number(contract.contract_value);
    const priceChange = Number(mod.price_change);
    const newValue = prior + priceChange;
    if (newValue < 0) {
      return { ok: false, error: "Resulting contract value cannot be negative." };
    }

    await updateContractValue(mod.contract_id, newValue);

    // Track cumulative change-order value and add a billable schedule line for the Δ.
    const { data: priorCo } = await supabase
      .from("contracts")
      .select("change_order_value_total")
      .eq("id", mod.contract_id)
      .maybeSingle();
    const coTotal =
      Number(priorCo?.change_order_value_total ?? 0) + priceChange;
    await supabase
      .from("contracts")
      .update({ change_order_value_total: coTotal })
      .eq("id", mod.contract_id);

    if (Math.abs(priceChange) > 0.009) {
      const { data: maxSeq } = await supabase
        .from("contract_milestones")
        .select("sequence_no")
        .eq("contract_id", mod.contract_id)
        .order("sequence_no", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextSeq = Number(maxSeq?.sequence_no ?? 0) + 1;
      await supabase.from("contract_milestones").insert({
        contract_id: mod.contract_id,
        milestone_key: `co-${String(mod.mod_number ?? modId).slice(0, 24)}`,
        label: `Change order ${mod.mod_number ?? ""}`.trim(),
        amount: priceChange,
        due_date: mod.effective_date || new Date().toISOString().slice(0, 10),
        milestone_type: "other",
        sequence_no: nextSeq,
        percent_of_contract: null,
      });
    }

    const { error: upd } = await supabase
      .from("contract_modifications")
      .update({
        status: "applied",
        prior_contract_value: prior,
        applied_at: new Date().toISOString(),
      })
      .eq("id", modId);
    if (upd) throw upd;

    await supabase.from("ar_ledger_entries").insert({
      invoice_id: null,
      entry_type: "contract_modification",
      debit: priceChange > 0 ? priceChange : 0,
      credit: priceChange < 0 ? Math.abs(priceChange) : 0,
      memo: `Mod ${mod.mod_number} (${mod.accounting_treatment as ModAccountingTreatment}): TP ${prior} → ${newValue} (Δ ${priceChange}). Schedule line added for billing. Historical invoices unchanged.`,
    });

    revalidateGaap();
    revalidatePath("/contracts");
    revalidatePath(`/contracts/${mod.contract_id}`);
    revalidatePath("/contracts/change-orders");
    revalidatePath("/billing/determine");
    return { ok: true, id: modId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function createModificationDraft(input: {
  contract_id: string;
  mod_number: string;
  effective_date: string;
  description: string;
  price_change: number;
  scope_change_notes?: string;
  accounting_treatment: ModAccountingTreatment;
}): Promise<ActionResult> {
  try {
    const contract = await getContractForGaap(input.contract_id);
    if (!contract) return { ok: false, error: "Contract not found." };
    const supabase = createClient();
    const { data, error } = await supabase
      .from("contract_modifications")
      .insert({
        contract_id: input.contract_id,
        mod_number: input.mod_number,
        effective_date: input.effective_date,
        description: input.description,
        price_change: input.price_change,
        prior_contract_value: contract.contract_value,
        scope_change_notes: input.scope_change_notes || null,
        accounting_treatment: input.accounting_treatment,
        status: "draft",
      })
      .select("id")
      .single();
    if (error) throw error;
    revalidateGaap();
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function upsertCostClassification(input: {
  cost_ref_id: string;
  contract_id: string;
  classification: CostClassificationType;
  period: string;
  amount: number;
  notes?: string;
  cost_source?: string;
}): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("cost_classifications")
      .insert({
        cost_ref_id: input.cost_ref_id,
        cost_source: input.cost_source ?? "cost_entries",
        contract_id: input.contract_id,
        classification: input.classification,
        period: input.period,
        amount: input.amount,
        notes: input.notes || null,
      })
      .select("id")
      .single();
    if (error) throw error;
    revalidateGaap();
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
