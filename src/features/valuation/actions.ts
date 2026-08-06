"use server";

import { getSessionUser } from "@/features/users/session";
import { buildValuationRecommendation } from "./recommend";
import { valuationCases } from "./seed";
import type { ValuationCase, ValuationRecommendation } from "./types";

export async function runValuationAction(input: {
  eventType: string;
  guests: number;
  currentEstimate?: number | null;
  changeSummary?: string;
  contractId?: string | null;
  requestId?: string | null;
  eventName?: string;
  persist?: boolean;
}): Promise<
  | { ok: true; recommendation: ValuationRecommendation; caseId?: string }
  | { ok: false; error: string }
> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: "Sign in required." };

  const eventType = String(input.eventType ?? "").trim();
  const guests = Number(input.guests);
  if (!eventType) return { ok: false, error: "Event type is required." };
  if (!Number.isFinite(guests) || guests < 1) {
    return { ok: false, error: "Guest count must be at least 1." };
  }

  const recommendation = buildValuationRecommendation({
    eventType,
    guests,
    currentEstimate: input.currentEstimate,
    changeSummary: input.changeSummary,
  });

  if (!input.persist) {
    return { ok: true, recommendation };
  }

  const row: ValuationCase = {
    id: `val-${Date.now()}`,
    createdAt: new Date().toISOString(),
    createdBy: session.email,
    contractId: input.contractId ?? null,
    requestId: input.requestId ?? null,
    eventName: input.eventName?.trim() || "Untitled event",
    eventType,
    guests,
    currentEstimate: input.currentEstimate ?? null,
    changeSummary: input.changeSummary?.trim() || "",
    recommendation,
  };
  valuationCases.unshift(row);
  return { ok: true, recommendation, caseId: row.id };
}

export async function listValuationCases(): Promise<ValuationCase[]> {
  const session = await getSessionUser();
  if (!session) return [];
  return [...valuationCases];
}
