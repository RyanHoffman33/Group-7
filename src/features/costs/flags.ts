import type { CostApprovalStatus, CostEntry } from "@/lib/supabase/types";
import { exceedsCommitmentVariance } from "@/features/costs/config";

export type CostFlagKey =
  | "flag_late_entry"
  | "flag_duplicate_invoice"
  | "flag_over_committed"
  | "flag_after_billing"
  | "flag_actual_exceeds_committed"
  | "flag_no_commitment";

export const FLAG_LABELS: Record<CostFlagKey, string> = {
  flag_late_entry: "Late entry",
  flag_duplicate_invoice: "Duplicate invoice #",
  flag_over_committed: "Over category budget",
  flag_after_billing: "After billing finalized",
  flag_actual_exceeds_committed: "Over committed amount",
  flag_no_commitment: "No commitment on file",
};

export type FlagReasonInput = Pick<
  CostEntry,
  | "amount"
  | "commitment_status"
  | "prior_committed_amount"
  | "flag_late_entry"
  | "flag_duplicate_invoice"
  | "flag_over_committed"
  | "flag_after_billing"
  | "flag_actual_exceeds_committed"
  | "flag_no_commitment"
>;

export type FlagQueueInput = FlagReasonInput &
  Pick<CostEntry, "flags_resolved_at" | "approval_status">;

export function activeFlags(entry: FlagReasonInput): CostFlagKey[] {
  const keys: CostFlagKey[] = [];
  if (entry.flag_late_entry) keys.push("flag_late_entry");
  if (entry.flag_duplicate_invoice) keys.push("flag_duplicate_invoice");
  if (entry.flag_over_committed) keys.push("flag_over_committed");
  if (entry.flag_after_billing) keys.push("flag_after_billing");
  if (entry.flag_actual_exceeds_committed)
    keys.push("flag_actual_exceeds_committed");
  if (entry.flag_no_commitment) keys.push("flag_no_commitment");
  return keys;
}

export function hasAnyFlag(entry: FlagReasonInput): boolean {
  return activeFlags(entry).length > 0;
}

/** Flags exist and have not been marked resolved (audit booleans stay true). */
export function hasUnresolvedFlags(entry: FlagQueueInput): boolean {
  return hasAnyFlag(entry) && !entry.flags_resolved_at;
}

/**
 * Open Flags queue membership: unresolved control exceptions only.
 * Amount authority (pending_approval) lives solely under Approvals.
 */
export function belongsInFlagsQueue(entry: FlagQueueInput): boolean {
  return (
    hasUnresolvedFlags(entry) &&
    entry.approval_status !== ("pending_approval" satisfies CostApprovalStatus)
  );
}

/**
 * Specific, human-readable reasons for Flags & Exceptions.
 * Pending approval is handled only on Approvals — not duplicated here.
 */
export function flagReasons(entry: FlagReasonInput): string[] {
  const reasons: string[] = [];

  const prior = entry.prior_committed_amount;
  if (
    entry.flag_actual_exceeds_committed &&
    prior != null &&
    prior > 0 &&
    entry.amount > prior
  ) {
    const pct = Math.round(((entry.amount - prior) / prior) * 100);
    reasons.push(`${pct}% over committed amount`);
  } else if (entry.flag_actual_exceeds_committed) {
    reasons.push("Over committed amount");
  }

  if (entry.flag_no_commitment) {
    reasons.push("No commitment on file");
  }

  if (entry.flag_over_committed) {
    reasons.push("Over category budget");
  }
  if (entry.flag_duplicate_invoice) {
    reasons.push("Duplicate invoice #");
  }
  if (entry.flag_after_billing) {
    reasons.push("Cost entered after billing finalized");
  }
  if (entry.flag_late_entry) {
    reasons.push("Late entry");
  }

  return reasons;
}

/** Recompute commitment-related flags from amounts/status. */
export function computeCommitmentFlags(input: {
  commitmentStatus: "committed" | "actual";
  amount: number;
  priorCommittedAmount: number | null;
}): {
  flag_actual_exceeds_committed: boolean;
  flag_no_commitment: boolean;
} {
  if (input.commitmentStatus === "committed") {
    return {
      flag_actual_exceeds_committed: false,
      flag_no_commitment: false,
    };
  }

  const prior = input.priorCommittedAmount;
  if (prior == null) {
    return {
      flag_actual_exceeds_committed: false,
      flag_no_commitment: true,
    };
  }

  return {
    flag_actual_exceeds_committed: exceedsCommitmentVariance(
      prior,
      input.amount,
    ),
    flag_no_commitment: false,
  };
}
