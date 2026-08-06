import type { EventRequest } from "./types";

/** In-memory store for demo intake requests (reset on server restart). */
export const eventRequests: EventRequest[] = [];
