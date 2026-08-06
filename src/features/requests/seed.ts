import type { EventRequest } from "./types";

/** In-memory store for demo intake requests (reset on server restart). */
export const eventRequests: EventRequest[] = [
  {
    id: "req-demo-1",
    userId: "usr-cust",
    contactName: "Casey Customer",
    contactEmail: "customer@gmail.com",
    contactPhone: "555-0101",
    organization: "Delta Consulting",
    eventName: "Delta Q4 Leadership Summit",
    eventType: "corporate_conference",
    preferredDate: "2026-11-12",
    estimatedGuests: 180,
    venuePreference: "Downtown Chicago ballroom",
    budgetRange: "$75,000 – $150,000",
    messageToTeam:
      "Looking for a full-day conference with breakouts and evening reception. Possible guest count increase.",
    status: "submitted",
    createdAt: new Date().toISOString(),
  },
];
