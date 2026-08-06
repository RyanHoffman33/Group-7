/** Customer portal demo data — interactive UI owns runtime state. */

export type CustomerMilestoneStatus = "complete" | "action_needed" | "upcoming";

export type CustomerInvoiceStatus =
  | "paid"
  | "partially_paid"
  | "unpaid"
  | "overdue"
  | "disputed"
  | "canceled";

export type CustomerActionStatus = "pending" | "approved" | "changes_requested";

export type CustomerEvent = {
  id: string;
  eventName: string;
  eventDate: string;
  venue: string;
  venueAddress: string;
  eventType: string;
  status: string;
  guestCount: number;
  managerName: string;
  managerRole: string;
  managerEmail: string;
  managerPhone: string;
  heroImage: string;
  heroAlt: string;
  summary: string;
  agenda: { time: string; item: string }[];
  inclusions: string[];
};

export type CustomerActionItem = {
  id: string;
  title: string;
  eventId: string;
  eventName: string;
  dueDate: string;
  explanation: string;
  detail: string;
  options: string[];
  status: CustomerActionStatus;
};

export type CustomerInvoice = {
  id: string;
  invoiceNumber: string;
  eventId: string;
  description: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  amountPaid: number;
  balance: number;
  status: CustomerInvoiceStatus;
  lineItems: { label: string; amount: number }[];
};

export type CustomerPayment = {
  id: string;
  paidAt: string;
  invoiceOrEvent: string;
  amount: number;
  reference: string;
  status: string;
  method: string;
};

export type CustomerDocument = {
  id: string;
  name: string;
  kind: string;
  eventId: string;
  summary: string;
  body: string;
};

export const SAMPLE_CUSTOMER_EVENTS: CustomerEvent[] = [
  {
    id: "evt-delta-leadership",
    eventName: "Demo Customer Leadership Conference",
    eventDate: "2026-09-18",
    venue: "The Jefferson Hotel",
    venueAddress: "101 W Franklin St, Richmond, VA 23220",
    eventType: "Corporate conference",
    status: "Planning",
    guestCount: 250,
    managerName: "Emily Gray",
    managerRole: "Event Manager",
    managerEmail: "emily.gray@mainevent.example",
    managerPhone: "(804) 555-0142",
    heroImage: "/brand/customer-conference-hero.png?v=2",
    heroAlt: "Conference session in a hotel ballroom",
    summary:
      "Two-day leadership conference with general session, breakouts, and evening reception. MainEvent is producing AV, staging, and guest experience.",
    agenda: [
      { time: "7:30 AM", item: "Registration & breakfast" },
      { time: "9:00 AM", item: "Opening keynote — Grand Ballroom" },
      { time: "12:00 PM", item: "Working lunch" },
      { time: "1:30 PM", item: "Breakout tracks" },
      { time: "5:30 PM", item: "Networking reception" },
    ],
    inclusions: [
      "Full AV package (LED wall, mics, staging)",
      "Registration & badge printing",
      "Catering coordination",
      "On-site production crew",
    ],
  },
  {
    id: "evt-delta-holiday",
    eventName: "Demo Customer Holiday Reception",
    eventDate: "2026-12-12",
    venue: "Grand Ballroom",
    venueAddress: "101 W Franklin St, Richmond, VA 23220",
    eventType: "Reception",
    status: "Confirmed",
    guestCount: 120,
    managerName: "Emily Gray",
    managerRole: "Event Manager",
    managerEmail: "emily.gray@mainevent.example",
    managerPhone: "(804) 555-0142",
    heroImage: "/brand/customer-holiday-reception-hero.png?v=1",
    heroAlt: "Holiday reception in a decorated event space",
    summary:
      "Evening holiday reception for clients and partners with cocktail service, entertainment, and branded photo moment.",
    agenda: [
      { time: "6:00 PM", item: "Doors & welcome drinks" },
      { time: "6:45 PM", item: "Remarks from leadership" },
      { time: "7:15 PM", item: "Dinner service" },
      { time: "9:00 PM", item: "Entertainment & networking" },
    ],
    inclusions: [
      "Room layout & décor package",
      "House sound & lighting",
      "Photo backdrop",
      "Event-night staffing",
    ],
  },
];

export const SAMPLE_ACTIVE_EVENT_ID = SAMPLE_CUSTOMER_EVENTS[0].id;

export const SAMPLE_MILESTONES = [
  {
    id: "ms-1",
    name: "Contract Signed",
    status: "complete" as CustomerMilestoneStatus,
    date: "2026-05-01",
    dateLabel: "May 1, 2026",
    eventId: "evt-delta-leadership",
  },
  {
    id: "ms-2",
    name: "Deposit Received",
    status: "complete" as CustomerMilestoneStatus,
    date: "2026-05-05",
    dateLabel: "May 5, 2026",
    eventId: "evt-delta-leadership",
  },
  {
    id: "ms-3",
    name: "Venue Confirmed",
    status: "complete" as CustomerMilestoneStatus,
    date: "2026-05-12",
    dateLabel: "May 12, 2026",
    eventId: "evt-delta-leadership",
  },
  {
    id: "ms-4",
    name: "Catering Approval",
    status: "action_needed" as CustomerMilestoneStatus,
    date: "2026-08-08",
    dateLabel: "Due Aug 8, 2026",
    eventId: "evt-delta-leadership",
  },
  {
    id: "ms-5",
    name: "Final Guest Count",
    status: "upcoming" as CustomerMilestoneStatus,
    date: "2026-09-01",
    dateLabel: "Due Sept 1, 2026",
    eventId: "evt-delta-leadership",
  },
  {
    id: "ms-6",
    name: "Final Payment",
    status: "upcoming" as CustomerMilestoneStatus,
    date: "2026-09-10",
    dateLabel: "Due Sept 10, 2026",
    eventId: "evt-delta-leadership",
  },
];

export const SAMPLE_ACTION_ITEMS: CustomerActionItem[] = [
  {
    id: "act-1",
    title: "Approve catering selection",
    eventId: "evt-delta-leadership",
    eventName: "Demo Customer Leadership Conference",
    dueDate: "2026-08-08",
    explanation: "Review the proposed menu package and confirm dietary accommodations.",
    detail:
      "Chef proposes plated lunch (chicken + vegetarian) with gluten-free option, plus AM/PM coffee breaks. Estimated per-person cost is within your contracted catering allowance.",
    options: [
      "Plated lunch — chicken or vegetarian",
      "Gluten-free plates available on request",
      "Coffee & tea service (morning + afternoon)",
      "Reception hors d'oeuvres for 250",
    ],
    status: "pending",
  },
  {
    id: "act-2",
    title: "Approve updated floor plan",
    eventId: "evt-delta-leadership",
    eventName: "Demo Customer Leadership Conference",
    dueDate: "2026-08-09",
    explanation: "Confirm seating layout and stage orientation for the general session.",
    detail:
      "Revised floor plan moves the LED wall 8 feet upstage and adds two breakout clusters near the foyer. Capacity remains 250 seated.",
    options: [
      "Theater seating for keynote (250)",
      "LED wall centered on south wall",
      "Two breakout pods near foyer",
      "Registration desk at Franklin St entrance",
    ],
    status: "pending",
  },
];

export const SAMPLE_INVOICES: CustomerInvoice[] = [
  {
    id: "inv-101",
    invoiceNumber: "INV-101",
    eventId: "evt-delta-leadership",
    description: "Deposit",
    issueDate: "2026-05-05",
    dueDate: "2026-05-05",
    amount: 12500,
    amountPaid: 12500,
    balance: 0,
    status: "paid",
    lineItems: [
      { label: "Production package deposit (25% of $50,000)", amount: 10000 },
      { label: "Venue hold / planning retainer", amount: 2500 },
    ],
  },
  {
    id: "inv-102",
    invoiceNumber: "INV-102",
    eventId: "evt-delta-leadership",
    description: "Milestone 1",
    issueDate: "2026-07-20",
    dueDate: "2026-07-20",
    amount: 25000,
    amountPaid: 25000,
    balance: 0,
    status: "paid",
    lineItems: [
      { label: "LED wall & staging progress", amount: 12000 },
      { label: "Wireless mics & recording package", amount: 6000 },
      { label: "Crew labor commitment (show call)", amount: 7000 },
    ],
  },
  {
    id: "inv-103",
    invoiceNumber: "INV-103",
    eventId: "evt-delta-leadership",
    description: "Final",
    issueDate: "2026-08-01",
    dueDate: "2026-09-10",
    amount: 12500,
    amountPaid: 0,
    balance: 12500,
    status: "unpaid",
    lineItems: [
      { label: "Final production balance", amount: 8000 },
      { label: "Registration & badge printing", amount: 2000 },
      { label: "On-site contingency (unused refundable)", amount: 2500 },
    ],
  },
  {
    id: "inv-201",
    invoiceNumber: "INV-201",
    eventId: "evt-delta-holiday",
    description: "Holiday reception deposit",
    issueDate: "2026-08-01",
    dueDate: "2026-08-15",
    amount: 8000,
    amountPaid: 4000,
    balance: 4000,
    status: "partially_paid",
    lineItems: [
      { label: "Room layout & décor package", amount: 3500 },
      { label: "House sound & lighting", amount: 2500 },
      { label: "Photo backdrop & event-night staffing", amount: 2000 },
    ],
  },
];

export const SAMPLE_PAYMENTS: CustomerPayment[] = [
  {
    id: "pay-1",
    paidAt: "2026-05-05",
    invoiceOrEvent: "INV-101 · Deposit",
    amount: 12500,
    reference: "ACH-88421",
    status: "Recorded",
    method: "ACH",
  },
  {
    id: "pay-2",
    paidAt: "2026-07-22",
    invoiceOrEvent: "INV-102 · Milestone 1",
    amount: 25000,
    reference: "Wire-22910",
    status: "Recorded",
    method: "Wire",
  },
];

export const SAMPLE_DOCUMENTS: CustomerDocument[] = [
  {
    id: "doc-1",
    name: "Signed Event Contract",
    kind: "Contract",
    eventId: "evt-delta-leadership",
    summary: "Master services agreement and event statement of work.",
    body: `MAINEVENT — EVENT SERVICES AGREEMENT

Client: Demo Customer
Event: Demo Customer Leadership Conference
Date: September 18, 2026
Venue: The Jefferson Hotel, Richmond, VA

Contract value: $50,000
Deposit: $12,500 (received)
Payment schedule: Deposit · Milestone · Final

This demo document is shown for portal walkthrough only.`,
  },
  {
    id: "doc-2",
    name: "Approved Floor Plan",
    kind: "Floor plan",
    eventId: "evt-delta-leadership",
    summary: "Latest seating and stage layout pending your confirmation.",
    body: `FLOOR PLAN — GRAND BALLROOM (Rev C)

• Stage / LED wall: South wall, centered
• Theater seats: 250
• Breakout pods: Foyer east & west
• Registration: Franklin St entrance
• ADA access: East corridor

Status: Awaiting client approval in portal.`,
  },
  {
    id: "doc-3",
    name: "Event Day Schedule",
    kind: "Schedule",
    eventId: "evt-delta-leadership",
    summary: "Run of show for conference day.",
    body: `RUN OF SHOW — SEPT 18, 2026

07:30  Registration & breakfast
09:00  Opening keynote
12:00  Working lunch
13:30  Breakout tracks
17:30  Networking reception

Crew call: 05:30 · Client walkthrough: 06:45`,
  },
];

export function planningProgressFromMilestones(
  milestones: { status: CustomerMilestoneStatus; date?: string }[],
  asOf: Date = new Date(),
): { completed: number; total: number; percent: number; onTrack: boolean } {
  const total = milestones.length;
  const completed = milestones.filter((m) => m.status === "complete").length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  const today = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  const overdueAction = milestones.some((m) => {
    if (m.status !== "action_needed" || !m.date) return false;
    return new Date(`${m.date}T00:00:00`) < today;
  });
  return { completed, total, percent, onTrack: !overdueAction };
}

export function daysUntil(dateStr: string, asOf: Date = new Date()): number {
  const target = new Date(`${dateStr}T00:00:00`);
  const start = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  return Math.ceil((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export function financialFromInvoices(
  invoices: CustomerInvoice[],
  contractValueFallback = 0,
) {
  const invoiceTotal = invoices.reduce((s, i) => s + i.amount, 0);
  const contractTotal =
    contractValueFallback > 0 ? contractValueFallback : invoiceTotal;
  const amountPaid = invoices.reduce((s, i) => s + i.amountPaid, 0);
  const outstandingBalance =
    invoices.length > 0
      ? invoices.reduce((s, i) => s + i.balance, 0)
      : Math.max(0, contractTotal - amountPaid);
  const nextOpen = invoices.find((i) => i.balance > 0);

  const depositInvoices = invoices.filter((i) =>
    i.lineItems.some((l) => /deposit/i.test(l.label)) ||
    /deposit/i.test(i.description),
  );
  const progressInvoices = invoices.filter((i) => !depositInvoices.includes(i));

  const depositBilled = depositInvoices.reduce((s, i) => s + i.amount, 0);
  const depositPaid = depositInvoices.reduce((s, i) => s + i.amountPaid, 0);
  const depositRemaining = depositInvoices.reduce((s, i) => s + i.balance, 0);
  const progressBilled = progressInvoices.reduce((s, i) => s + i.amount, 0);
  const progressPaid = progressInvoices.reduce((s, i) => s + i.amountPaid, 0);
  const progressRemaining = progressInvoices.reduce((s, i) => s + i.balance, 0);

  return {
    contractTotal,
    amountPaid,
    outstandingBalance,
    nextPaymentDue: nextOpen?.dueDate ?? null,
    nextPaymentAmount: nextOpen?.balance ?? 0,
    nextInvoiceId: nextOpen?.id ?? null,
    depositBilled,
    depositPaid,
    depositRemaining,
    depositStatus:
      depositBilled <= 0
        ? ("none" as const)
        : depositRemaining <= 0.01
          ? ("satisfied" as const)
          : depositPaid > 0
            ? ("partial" as const)
            : ("due" as const),
    progressBilled,
    progressPaid,
    progressRemaining,
  };
}
