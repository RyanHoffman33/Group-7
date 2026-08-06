import { createClient } from "@/lib/supabase/server";
import {
  isCheckpointType,
  requiredCheckpointsForModel,
  type CheckpointType,
  type InvolvementModel,
  isInvolvementModel,
} from "./checkpoints";
import type {
  ApprovalItemWithMeta,
  ContractInvolvementCheckpoint,
  CustomerApprovalDecision,
  CustomerApprovalItem,
  CustomerFacingContract,
} from "./types";

/** Demo customer account organization → customers.name */
export const DEMO_CUSTOMER_ORG = "Delta Consulting";

const CUSTOMER_SAFE_CONTRACT_SELECT =
  "id, contract_number, event_name, event_type, event_start, event_end, venue_name, venue_city, guest_count, status, project_manager_label, involvement_model, contract_value, notes, customer_id";

export async function resolveCustomerIdForOrganization(
  organization: string | null | undefined,
): Promise<string | null> {
  if (!organization?.trim()) return null;
  const supabase = createClient();
  const { data } = await supabase
    .from("customers")
    .select("id")
    .ilike("name", organization.trim())
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function listCustomerFacingContracts(
  customerId: string,
): Promise<CustomerFacingContract[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contracts")
    .select(CUSTOMER_SAFE_CONTRACT_SELECT)
    .eq("customer_id", customerId)
    .neq("status", "canceled")
    .order("event_start", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapCustomerFacingContract);
}

function mapCustomerFacingContract(row: Record<string, unknown>): CustomerFacingContract {
  return {
    id: String(row.id),
    contract_number: String(row.contract_number ?? ""),
    event_name: String(row.event_name ?? ""),
    event_type: (row.event_type as string | null) ?? null,
    event_start: (row.event_start as string | null) ?? null,
    event_end: (row.event_end as string | null) ?? null,
    venue_name: (row.venue_name as string | null) ?? null,
    venue_city: (row.venue_city as string | null) ?? null,
    guest_count: row.guest_count != null ? Number(row.guest_count) : null,
    status: String(row.status ?? ""),
    project_manager_label: String(row.project_manager_label ?? "Project Manager"),
    involvement_model: isInvolvementModel(row.involvement_model)
      ? row.involvement_model
      : "collaborative",
    contract_value: Number(row.contract_value ?? 0),
    notes: (row.notes as string | null) ?? null,
  };
}

export async function getContractInvolvement(contractId: string): Promise<{
  model: InvolvementModel;
  customCheckpoints: ContractInvolvementCheckpoint[];
  requiredTypes: CheckpointType[];
}> {
  const supabase = createClient();
  const { data: contract, error } = await supabase
    .from("contracts")
    .select("involvement_model")
    .eq("id", contractId)
    .maybeSingle();
  if (error) throw error;
  const model: InvolvementModel = isInvolvementModel(contract?.involvement_model)
    ? contract!.involvement_model
    : "collaborative";

  const { data: cps, error: cpErr } = await supabase
    .from("contract_involvement_checkpoints")
    .select("*")
    .eq("contract_id", contractId)
    .eq("required", true)
    .order("checkpoint_type");
  if (cpErr) throw cpErr;

  const customCheckpoints = (cps ?? []) as ContractInvolvementCheckpoint[];
  const customTypes = customCheckpoints
    .map((c) => c.checkpoint_type)
    .filter(isCheckpointType);
  return {
    model,
    customCheckpoints,
    requiredTypes: requiredCheckpointsForModel(model, customTypes),
  };
}

export async function listApprovalItemsForContract(
  contractId: string,
): Promise<ApprovalItemWithMeta[]> {
  const supabase = createClient();
  const { data: contract } = await supabase
    .from("contracts")
    .select("contract_number, event_name")
    .eq("id", contractId)
    .maybeSingle();

  const { data: items, error } = await supabase
    .from("customer_approval_items")
    .select("*")
    .eq("contract_id", contractId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const ids = (items ?? []).map((i) => i.id as string);
  const decisionsByItem = await loadDecisionsByItemIds(ids);

  return (items ?? []).map((raw) => {
    const item = raw as CustomerApprovalItem;
    return {
      ...item,
      contract_number: String(contract?.contract_number ?? ""),
      event_name: String(contract?.event_name ?? ""),
      decisions: decisionsByItem.get(item.id) ?? [],
    };
  });
}

/** Customer portal: only approvals for the customer's own contract IDs. */
export async function listApprovalItemsForCustomerContracts(
  contractIds: string[],
): Promise<ApprovalItemWithMeta[]> {
  if (contractIds.length === 0) return [];
  const supabase = createClient();

  const { data: contracts, error: cErr } = await supabase
    .from("contracts")
    .select("id, contract_number, event_name")
    .in("id", contractIds);
  if (cErr) throw cErr;
  const meta = new Map(
    (contracts ?? []).map((c) => [
      c.id as string,
      {
        contract_number: String(c.contract_number ?? ""),
        event_name: String(c.event_name ?? ""),
      },
    ]),
  );

  const { data: items, error } = await supabase
    .from("customer_approval_items")
    .select("*")
    .in("contract_id", contractIds)
    .neq("status", "draft")
    .order("due_date", { ascending: true });
  if (error) throw error;

  const ids = (items ?? []).map((i) => i.id as string);
  const decisionsByItem = await loadDecisionsByItemIds(ids);

  return (items ?? []).map((raw) => {
    const item = raw as CustomerApprovalItem;
    const m = meta.get(item.contract_id);
    return {
      ...item,
      contract_number: m?.contract_number ?? "",
      event_name: m?.event_name ?? "",
      decisions: decisionsByItem.get(item.id) ?? [],
    };
  });
}

async function loadDecisionsByItemIds(
  ids: string[],
): Promise<Map<string, CustomerApprovalDecision[]>> {
  const map = new Map<string, CustomerApprovalDecision[]>();
  if (ids.length === 0) return map;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("customer_approval_decisions")
    .select("*")
    .in("approval_item_id", ids)
    .order("decided_at", { ascending: false });
  if (error) throw error;
  for (const d of data ?? []) {
    const row = d as CustomerApprovalDecision;
    const list = map.get(row.approval_item_id) ?? [];
    list.push(row);
    map.set(row.approval_item_id, list);
  }
  return map;
}

export async function getApprovalItemForCustomer(
  itemId: string,
  allowedContractIds: string[],
): Promise<ApprovalItemWithMeta | null> {
  if (!allowedContractIds.length) return null;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("customer_approval_items")
    .select("*")
    .eq("id", itemId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const item = data as CustomerApprovalItem;
  if (!allowedContractIds.includes(item.contract_id)) return null;

  const { data: contract } = await supabase
    .from("contracts")
    .select("contract_number, event_name")
    .eq("id", item.contract_id)
    .maybeSingle();

  const decisionsByItem = await loadDecisionsByItemIds([item.id]);
  return {
    ...item,
    contract_number: String(contract?.contract_number ?? ""),
    event_name: String(contract?.event_name ?? ""),
    decisions: decisionsByItem.get(item.id) ?? [],
  };
}
