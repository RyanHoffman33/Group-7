export type ReferralSource =
  | "google_search"
  | "social_media"
  | "friend_or_colleague"
  | "prior_event"
  | "advertisement"
  | "other";

export type EventRequestStatus = "submitted" | "under_review" | "contacted";

export interface EventRequest {
  id: string;
  userId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  organization: string;
  eventName: string;
  eventType: string;
  preferredDate: string;
  estimatedGuests: number;
  venuePreference: string;
  budgetRange: string;
  messageToTeam: string;
  status: EventRequestStatus;
  createdAt: string;
  referralSource?: ReferralSource | null;
  referralOtherText?: string | null;
  referralSubmittedAt?: string | null;
  referralSkipped?: boolean;
}

export const REFERRAL_OPTIONS: { value: ReferralSource; label: string }[] = [
  { value: "google_search", label: "Google / search engine" },
  { value: "social_media", label: "Social media" },
  { value: "friend_or_colleague", label: "Friend or colleague" },
  { value: "prior_event", label: "Attended a prior MainEvent event" },
  { value: "advertisement", label: "Advertisement" },
  { value: "other", label: "Other" },
];

export const EVENT_TYPE_OPTIONS = [
  "Corporate conference",
  "Wedding / celebration",
  "Trade show / expo",
  "Fundraiser / gala",
  "Private party",
  "Other",
] as const;

export const BUDGET_RANGE_OPTIONS = [
  "Under $10,000",
  "$10,000 – $25,000",
  "$25,000 – $75,000",
  "$75,000 – $150,000",
  "$150,000+",
  "Not sure yet",
] as const;
