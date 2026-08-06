/** Shared checkpoint types for Customer Involvement Model. */

export const INVOLVEMENT_MODELS = [
  "collaborative",
  "full_service",
  "custom",
] as const;

export type InvolvementModel = (typeof INVOLVEMENT_MODELS)[number];

export const CHECKPOINT_TYPES = [
  "event_concept",
  "budget",
  "venue",
  "major_vendors",
  "decor_production_design",
  "final_run_of_show",
  "material_scope_change",
  "change_order",
  "contract_value_increase",
  "major_scope_change",
  "venue_or_date_change",
  "cancellation",
] as const;

export type CheckpointType = (typeof CHECKPOINT_TYPES)[number];

export const CHECKPOINT_LABELS: Record<CheckpointType, string> = {
  event_concept: "Event concept",
  budget: "Budget",
  venue: "Venue",
  major_vendors: "Major vendors",
  decor_production_design: "Décor / production design",
  final_run_of_show: "Final run of show",
  material_scope_change: "Material scope change",
  change_order: "Change order",
  contract_value_increase: "Contract-value increase",
  major_scope_change: "Major scope change",
  venue_or_date_change: "Venue or date change",
  cancellation: "Cancellation",
};

/** Collaborative — customer reviews major planning checkpoints. */
export const COLLABORATIVE_CHECKPOINTS: readonly CheckpointType[] = [
  "event_concept",
  "budget",
  "venue",
  "major_vendors",
  "decor_production_design",
  "final_run_of_show",
  "material_scope_change",
] as const;

/** Full-service — MainEvent handles routine planning; customer only for major changes. */
export const FULL_SERVICE_CHECKPOINTS: readonly CheckpointType[] = [
  "change_order",
  "contract_value_increase",
  "major_scope_change",
  "venue_or_date_change",
  "cancellation",
] as const;

export const INVOLVEMENT_MODEL_LABELS: Record<InvolvementModel, string> = {
  collaborative: "Collaborative",
  full_service: "Full-Service",
  custom: "Custom",
};

export const INVOLVEMENT_MODEL_DESCRIPTIONS: Record<InvolvementModel, string> = {
  collaborative:
    "Customer reviews and approves major planning checkpoints (concept, budget, venue, vendors, décor, run of show, material scope changes).",
  full_service:
    "MainEvent handles routine planning within the approved contract and budget. Customer approval is still required for change orders, value increases, major scope changes, venue/date changes, and cancellations.",
  custom:
    "Project manager chooses exactly which checkpoint types require customer approval.",
};

export function isInvolvementModel(v: unknown): v is InvolvementModel {
  return (
    typeof v === "string" &&
    (INVOLVEMENT_MODELS as readonly string[]).includes(v)
  );
}

export function isCheckpointType(v: unknown): v is CheckpointType {
  return (
    typeof v === "string" &&
    (CHECKPOINT_TYPES as readonly string[]).includes(v)
  );
}

export function checkpointLabel(type: string): string {
  if (isCheckpointType(type)) return CHECKPOINT_LABELS[type];
  return type.replace(/_/g, " ");
}

export function requiredCheckpointsForModel(
  model: InvolvementModel,
  customTypes: CheckpointType[] = [],
): CheckpointType[] {
  if (model === "collaborative") return [...COLLABORATIVE_CHECKPOINTS];
  if (model === "full_service") return [...FULL_SERVICE_CHECKPOINTS];
  return customTypes.filter((t) => isCheckpointType(t));
}
