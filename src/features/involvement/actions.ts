"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/features/users/session";
import {
  isCheckpointType,
  isInvolvementModel,
  type CheckpointType,
  type InvolvementModel,
} from "./checkpoints";
import {
  getApprovalItemForCustomer,
  listCustomerFacingContracts,
  resolveCustomerIdForPortalSession,
} from "./queries";

export type InvolvementActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

function revalidateInvolvement(contractId?: string) {
  revalidatePath("/contracts");
  revalidatePath("/contracts/list");
  revalidatePath("/dashboard/customer");
  revalidatePath("/dashboard/customer/actions");
  revalidatePath("/dashboard/customer/event");
  if (contractId) revalidatePath(`/contracts/${contractId}`);
}

function slugKey(title: string, checkpointType: string) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${checkpointType}-${base || "item"}`;
}

export async function setContractInvolvementModel(input: {
  contractId: string;
  model: InvolvementModel;
  customCheckpointTypes?: CheckpointType[];
}): Promise<InvolvementActionResult> {
  try {
    const session = await getSessionUser();
    if (!session) return { ok: false, error: "Sign in required." };
    if (session.roleKey === "customer" || session.roleKey === "vendor") {
      return { ok: false, error: "Customers cannot change involvement models." };
    }
    if (!isInvolvementModel(input.model)) {
      return { ok: false, error: "Invalid involvement model." };
    }

    const supabase = createClient();
    const { error } = await supabase
      .from("contracts")
      .update({ involvement_model: input.model })
      .eq("id", input.contractId);
    if (error) throw error;

    if (input.model === "custom") {
      const types = (input.customCheckpointTypes ?? []).filter(isCheckpointType);
      const { error: delErr } = await supabase
        .from("contract_involvement_checkpoints")
        .delete()
        .eq("contract_id", input.contractId);
      if (delErr) throw delErr;
      if (types.length) {
        const { error: insErr } = await supabase
          .from("contract_involvement_checkpoints")
          .insert(
            types.map((checkpoint_type) => ({
              contract_id: input.contractId,
              checkpoint_type,
              required: true,
            })),
          );
        if (insErr) throw insErr;
      }
    }

    revalidateInvolvement(input.contractId);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update involvement model.",
    };
  }
}

export async function sendCustomerApprovalRequest(input: {
  contractId: string;
  checkpointType: string;
  title: string;
  supportingInfo: string;
  dueDate?: string;
  createdBy: string;
  /** When revising an existing item_key, bump version and supersede prior pending/open. */
  itemKey?: string;
}): Promise<InvolvementActionResult> {
  try {
    const session = await getSessionUser();
    if (!session) return { ok: false, error: "Sign in required." };
    if (session.roleKey === "customer" || session.roleKey === "vendor") {
      return { ok: false, error: "Only internal roles can send approval requests." };
    }
    if (!input.title?.trim()) return { ok: false, error: "Title is required." };
    if (!isCheckpointType(input.checkpointType)) {
      return { ok: false, error: "Invalid checkpoint type." };
    }

    const supabase = createClient();
    const itemKey =
      input.itemKey?.trim() ||
      slugKey(input.title.trim(), input.checkpointType);

    const { data: prior } = await supabase
      .from("customer_approval_items")
      .select("id, version, status")
      .eq("contract_id", input.contractId)
      .eq("item_key", itemKey)
      .order("version", { ascending: false })
      .limit(1);

    const last = prior?.[0];
    const nextVersion = last ? Number(last.version) + 1 : 1;

    if (last && (last.status === "pending" || last.status === "draft")) {
      await supabase
        .from("customer_approval_items")
        .update({ status: "superseded", updated_at: new Date().toISOString() })
        .eq("id", last.id);
    } else if (last && last.status === "approved") {
      await supabase
        .from("customer_approval_items")
        .update({ status: "superseded", updated_at: new Date().toISOString() })
        .eq("id", last.id);
    } else if (last && last.status === "changes_requested") {
      await supabase
        .from("customer_approval_items")
        .update({ status: "superseded", updated_at: new Date().toISOString() })
        .eq("id", last.id);
    }

    const { data, error } = await supabase
      .from("customer_approval_items")
      .insert({
        contract_id: input.contractId,
        checkpoint_type: input.checkpointType,
        title: input.title.trim(),
        item_key: itemKey,
        version: nextVersion,
        supporting_info: input.supportingInfo?.trim() || null,
        due_date: input.dueDate || null,
        status: "pending",
        created_by: input.createdBy || session.fullName,
        sent_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;

    revalidateInvolvement(input.contractId);
    return { ok: true, id: data.id as string };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to send approval request.",
    };
  }
}

export async function decideCustomerApproval(input: {
  approvalItemId: string;
  decision: "approved" | "changes_requested";
  comments?: string;
}): Promise<InvolvementActionResult> {
  try {
    const session = await getSessionUser();
    if (!session) return { ok: false, error: "Sign in required." };
    if (session.roleKey !== "customer") {
      return { ok: false, error: "Only the customer can decide approval requests." };
    }
    if (input.decision === "changes_requested" && !input.comments?.trim()) {
      return {
        ok: false,
        error: "Add a short note so your manager knows what to revise.",
      };
    }

    const customerId = await resolveCustomerIdForPortalSession({
      organization: session.organization,
      email: session.email,
    });
    if (!customerId) {
      return { ok: false, error: "No customer record linked to this account." };
    }
    const contracts = await listCustomerFacingContracts(customerId);
    const allowedIds = contracts.map((c) => c.id);

    const item = await getApprovalItemForCustomer(
      input.approvalItemId,
      allowedIds,
    );
    if (!item) {
      return { ok: false, error: "Approval request not found for your events." };
    }
    if (item.status !== "pending") {
      return { ok: false, error: "This request is no longer awaiting a decision." };
    }

    const supabase = createClient();
    const { error: dErr } = await supabase
      .from("customer_approval_decisions")
      .insert({
        approval_item_id: item.id,
        decision: input.decision,
        comments: input.comments?.trim() || null,
        customer_contact: session.fullName,
        decided_at: new Date().toISOString(),
        approved_version: item.version,
      });
    if (dErr) throw dErr;

    const { error: uErr } = await supabase
      .from("customer_approval_items")
      .update({
        status: input.decision,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    if (uErr) throw uErr;

    revalidateInvolvement(item.contract_id);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to record decision.",
    };
  }
}
