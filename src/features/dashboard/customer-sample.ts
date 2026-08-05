/** Temporary sample data for Customer Dashboard until auth + client portal wiring. */

export type CustomerMilestoneStatus = "complete" | "action_needed" | "upcoming";

export type CustomerInvoiceStatus =
  | "paid"
  | "partially_paid"
  | "unpaid"
  | "overdue"
  | "disputed"
  | "canceled";

export const SAMPLE_CUSTOMER = {
  /** Auth not wired — organization label for greeting when set. */
  organizationName: "Delta Consulting" as string | null,
  firstName: null as string | null,
};

/** Multiple events for selector demo — only this customer's sample events. */
export const SAMPLE_CUSTOMER_EVENTS = [
  {
    id: "evt-delta-leadership",
    eventName: "Delta Leadership Conference",
    eventDate: "2026-09-18",
    venue: "The Jefferson Hotel",
    eventType: "Corporate conference",
    status: "Planning",
    guestCount: 250,
    managerName: "Emily Gray",
    managerRole: "Event Manager",
    managerEmail: "emily.gray@mainevent.example",
    href: "/compliance",
    heroImage: "/brand/customer-conference-hero.png?v=2",
    heroAlt: "Conference session in a hotel ballroom",
  },
  {
    id: "evt-delta-holiday",
    eventName: "Delta Holiday Reception",
    eventDate: "2026-12-12",
    venue: "Grand Ballroom",
    eventType: "Reception",
    status: "Confirmed",
    guestCount: 120,
    managerName: "Emily Gray",
    managerRole: "Event Manager",
    managerEmail: "emily.gray@mainevent.example",
    href: "/compliance",
    heroImage: "/brand/customer-holiday-reception-hero.png?v=1",
    heroAlt: "Holiday reception in a decorated event space",
  },
] as const;

export const SAMPLE_ACTIVE_EVENT_ID = SAMPLE_CUSTOMER_EVENTS[0].id;

/**
 * Progress derived from milestone completion count (sample only).
 * Not a hard-coded decorative percentage.
 */
export const SAMPLE_MILESTONES = [
  {
    id: "ms-1",
    name: "Contract Signed",
    status: "complete" as CustomerMilestoneStatus,
    date: "2026-05-01",
    dateLabel: "May 1, 2026",
  },
  {
    id: "ms-2",
    name: "Deposit Received",
    status: "complete" as CustomerMilestoneStatus,
    date: "2026-05-05",
    dateLabel: "May 5, 2026",
  },
  {
    id: "ms-3",
    name: "Venue Confirmed",
    status: "complete" as CustomerMilestoneStatus,
    date: "2026-05-12",
    dateLabel: "May 12, 2026",
  },
  {
    id: "ms-4",
    name: "Catering Approval",
    status: "action_needed" as CustomerMilestoneStatus,
    date: "2026-08-08",
    dateLabel: "Due Aug 8, 2026",
  },
  {
    id: "ms-5",
    name: "Final Guest Count",
    status: "upcoming" as CustomerMilestoneStatus,
    date: "2026-09-01",
    dateLabel: "Due Sept 1, 2026",
  },
  {
    id: "ms-6",
    name: "Final Payment",
    status: "upcoming" as CustomerMilestoneStatus,
    date: "2026-09-10",
    dateLabel: "Due Sept 10, 2026",
  },
];

export const SAMPLE_ACTION_ITEMS = [
  {
    id: "act-1",
    title: "Approve catering selection",
    eventName: "Delta Leadership Conference",
    dueDate: "2026-08-08",
    explanation: "Review the proposed menu package and confirm dietary accommodations.",
    href: "/compliance/modifications",
  },
  {
    id: "act-2",
    title: "Approve updated floor plan",
    eventName: "Delta Leadership Conference",
    dueDate: "2026-08-09",
    explanation: "Confirm seating layout and stage orientation for the general session.",
    href: "/compliance",
  },
];

export const SAMPLE_FINANCIAL = {
  contractTotal: 50000,
  amountInvoiced: 50000,
  amountPaid: 37500,
  outstandingBalance: 12500,
  nextPaymentDue: "2026-09-10",
  nextPaymentAmount: 12500,
  /** Simulated recording only — not live payment processing. */
  paymentCtaHref: "/billing/payments",
  paymentCtaLabel: "View payment options",
};

export const SAMPLE_INVOICES = [
  {
    id: "inv-101",
    invoiceNumber: "INV-101",
    description: "Deposit",
    issueDate: "2026-05-05",
    dueDate: "2026-05-05",
    amount: 12500,
    amountPaid: 12500,
    balance: 0,
    status: "paid" as CustomerInvoiceStatus,
    href: "/billing/invoices",
  },
  {
    id: "inv-102",
    invoiceNumber: "INV-102",
    description: "Milestone 1",
    issueDate: "2026-07-20",
    dueDate: "2026-07-20",
    amount: 25000,
    amountPaid: 25000,
    balance: 0,
    status: "paid" as CustomerInvoiceStatus,
    href: "/billing/invoices",
  },
  {
    id: "inv-103",
    invoiceNumber: "INV-103",
    description: "Final",
    issueDate: "2026-08-01",
    dueDate: "2026-09-10",
    amount: 12500,
    amountPaid: 0,
    balance: 12500,
    status: "unpaid" as CustomerInvoiceStatus,
    href: "/billing/invoices",
  },
];

export const SAMPLE_PAYMENTS = [
  {
    id: "pay-1",
    paidAt: "2026-05-05",
    invoiceOrEvent: "INV-101 · Deposit",
    amount: 12500,
    reference: "ACH-88421",
    status: "Recorded",
    href: "/billing/payments",
  },
  {
    id: "pay-2",
    paidAt: "2026-07-22",
    invoiceOrEvent: "INV-102 · Milestone 1",
    amount: 25000,
    reference: "Wire-22910",
    status: "Recorded",
    href: "/billing/payments",
  },
];

/** Customer-safe document labels only (sample). */
export const SAMPLE_DOCUMENTS = [
  {
    id: "doc-1",
    name: "Signed Event Contract",
    kind: "Contract",
    href: "/compliance",
  },
  {
    id: "doc-2",
    name: "Approved Floor Plan",
    kind: "Floor plan",
    href: "/compliance",
  },
  {
    id: "doc-3",
    name: "Event Day Schedule",
    kind: "Schedule",
    href: "/compliance",
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
