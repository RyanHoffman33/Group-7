"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  SAMPLE_ACTION_ITEMS,
  SAMPLE_ACTIVE_EVENT_ID,
  SAMPLE_CUSTOMER_EVENTS,
  SAMPLE_DOCUMENTS,
  SAMPLE_INVOICES,
  SAMPLE_MILESTONES,
  SAMPLE_PAYMENTS,
  daysUntil,
  financialFromInvoices,
  planningProgressFromMilestones,
  type CustomerActionItem,
  type CustomerDocument,
  type CustomerEvent,
  type CustomerInvoice,
  type CustomerPayment,
} from "@/features/dashboard/customer-sample";

type PortalContextValue = {
  fullName: string;
  organization?: string | null;
  event: CustomerEvent;
  selectedId: string;
  setSelectedId: (id: string) => void;
  actions: CustomerActionItem[];
  invoices: CustomerInvoice[];
  payments: CustomerPayment[];
  milestones: typeof SAMPLE_MILESTONES;
  documents: CustomerDocument[];
  flash: string | null;
  showFlash: (msg: string) => void;
  days: number;
  progress: ReturnType<typeof planningProgressFromMilestones>;
  financial: ReturnType<typeof financialFromInvoices>;
  pendingCount: number;
  eventActions: CustomerActionItem[];
  eventInvoices: CustomerInvoice[];
  eventDocs: CustomerDocument[];
  eventMilestones: typeof SAMPLE_MILESTONES;
  approveAction: (id: string) => void;
  requestChanges: (id: string, note: string) => boolean;
  recordPayment: (invoiceId: string, method: "ACH" | "Wire" | "Card") => void;
};

const CustomerPortalContext = createContext<PortalContextValue | null>(null);

export function CustomerPortalProvider({
  fullName,
  organization,
  initialEventId,
  children,
}: {
  fullName: string;
  organization?: string | null;
  initialEventId?: string;
  children: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState(
    SAMPLE_CUSTOMER_EVENTS.find((e) => e.id === initialEventId)?.id ??
      SAMPLE_ACTIVE_EVENT_ID,
  );
  const [actions, setActions] = useState(SAMPLE_ACTION_ITEMS);
  const [invoices, setInvoices] = useState(SAMPLE_INVOICES);
  const [payments, setPayments] = useState(SAMPLE_PAYMENTS);
  const [milestones, setMilestones] = useState(SAMPLE_MILESTONES);
  const [flash, setFlash] = useState<string | null>(null);

  const event =
    SAMPLE_CUSTOMER_EVENTS.find((e) => e.id === selectedId) ??
    SAMPLE_CUSTOMER_EVENTS[0];

  const today = useMemo(() => new Date(), []);
  const days = daysUntil(event.eventDate, today);
  const eventMilestones = milestones.filter((m) => m.eventId === event.id);
  const progress = planningProgressFromMilestones(
    eventMilestones.length ? eventMilestones : milestones,
    today,
  );
  const eventInvoices = invoices.filter((i) => i.eventId === event.id);
  const financial = financialFromInvoices(eventInvoices);
  const eventActions = actions.filter((a) => a.eventId === event.id);
  const pendingCount = eventActions.filter((a) => a.status === "pending").length;
  const eventDocs = SAMPLE_DOCUMENTS.filter((d) => d.eventId === event.id);

  const showFlash = useCallback((msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 4000);
  }, []);

  const approveAction = useCallback(
    (id: string) => {
      const item = actions.find((a) => a.id === id);
      setActions((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "approved" as const } : a)),
      );
      if (item?.title.toLowerCase().includes("catering")) {
        setMilestones((prev) =>
          prev.map((m) =>
            m.id === "ms-4"
              ? { ...m, status: "complete" as const, dateLabel: "Approved today" }
              : m,
          ),
        );
      }
      showFlash(`Approved: ${item?.title ?? "item"}`);
    },
    [actions, showFlash],
  );

  const requestChanges = useCallback(
    (id: string, note: string) => {
      if (!note.trim()) {
        showFlash("Add a short note so your manager knows what to revise.");
        return false;
      }
      setActions((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, status: "changes_requested" as const } : a,
        ),
      );
      showFlash("Change request sent to your event manager.");
      return true;
    },
    [showFlash],
  );

  const recordPayment = useCallback(
    (invoiceId: string, method: "ACH" | "Wire" | "Card") => {
      const inv = invoices.find((i) => i.id === invoiceId);
      if (!inv || inv.balance <= 0) return;
      const amount = inv.balance;
      const ref = `${method}-${Math.floor(10000 + Math.random() * 89999)}`;
      const paidAt = new Date().toISOString().slice(0, 10);
      setInvoices((prev) =>
        prev.map((i) =>
          i.id === invoiceId
            ? { ...i, amountPaid: i.amount, balance: 0, status: "paid" as const }
            : i,
        ),
      );
      setPayments((prev) => [
        {
          id: `pay-${Date.now()}`,
          paidAt,
          invoiceOrEvent: `${inv.invoiceNumber} · ${inv.description}`,
          amount,
          reference: ref,
          status: "Recorded",
          method,
        },
        ...prev,
      ]);
      setMilestones((prev) =>
        prev.map((m) =>
          m.id === "ms-6"
            ? { ...m, status: "complete" as const, dateLabel: "Paid today" }
            : m,
        ),
      );
      showFlash(`Payment of $${amount.toLocaleString()} recorded (${method}).`);
    },
    [invoices, showFlash],
  );

  const value: PortalContextValue = {
    fullName,
    organization,
    event,
    selectedId,
    setSelectedId,
    actions,
    invoices,
    payments,
    milestones,
    documents: SAMPLE_DOCUMENTS,
    flash,
    showFlash,
    days,
    progress,
    financial,
    pendingCount,
    eventActions,
    eventInvoices,
    eventDocs,
    eventMilestones: eventMilestones.length ? eventMilestones : milestones,
    approveAction,
    requestChanges,
    recordPayment,
  };

  return (
    <CustomerPortalContext.Provider value={value}>
      {children}
    </CustomerPortalContext.Provider>
  );
}

export function useCustomerPortal() {
  const ctx = useContext(CustomerPortalContext);
  if (!ctx) {
    throw new Error("useCustomerPortal must be used within CustomerPortalProvider");
  }
  return ctx;
}
