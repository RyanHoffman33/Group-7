/** Demo overlay when live DB lacks flags_resolved_* columns. */
export type FlagResolutionOverlay = {
  flags_resolved_at: string;
  flags_resolved_by: string;
  flags_resolution_note: string | null;
};

export const flagResolutionOverlay = new Map<string, FlagResolutionOverlay>();

export function getFlagResolutionOverlay(id: string) {
  return flagResolutionOverlay.get(id) ?? null;
}

export function setFlagResolutionOverlay(
  id: string,
  value: FlagResolutionOverlay,
) {
  flagResolutionOverlay.set(id, value);
}
