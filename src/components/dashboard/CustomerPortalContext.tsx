"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { decideCustomerApproval } from "@/features/involvement/actions";
import type {
  ApprovalItemWithMeta,
  CustomerFacingContract,
} from "@/features/involvement/types";
import {
  SAMPLE_DOCUMENTS,
  SAMPLE_INVOICES,
  SAMPLE_MILESTONES,
  SAMPLE_PAYMENTS,
  daysUntil,
  financialFromInvoices,
  planningProgressFromMilestones,
  type CustomerDocument,
  type CustomerInvoice,
  type CustomerPayment,
} from "@/features/dashboard/customer-sample";

type PortalContextValue = {
  fullName: string;
  organization?: string | null;
  contracts: CustomerFacingContract[];
  contract: CustomerFacingContract | null;
  selectedId: string;
  setSelectedId: (id: string) => void;
  approvals: ApprovalItemWithMeta[];
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
  eventApprovals: ApprovalItemWithMeta[];
  eventInvoices: CustomerInvoice[];
  eventDocs: CustomerDocument[];
  eventMilestones: typeof SAMPLE_MILESTONES;
  /** @deprecated use eventApprovals — kept for overview page compatibility */
  eventActions: ApprovalItemWithMeta[];
  approveAction: (id: string) => void;
  requestChanges: (id: string, note: string) => void;
  recordPayment: (invoiceId: string, method: "ACH" | "Wire" | "Card") => void;
  deciding: boolean;
};

const CustomerPortalContext = createContext<PortalContextValue | null>(null);

export function CustomerPortalProvider({
  fullName,
  organization,
  contracts,
  approvals: initialApprovals,
  children,
}: {
  fullName: string;
  organization?: string | null;
  contracts: CustomerFacingContract[];
  approvals: ApprovalItemWithMeta[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(contracts[0]?.id ?? "");
  const [approvals, setApprovals] = useState(initialApprovals);
  const [invoices, setInvoices] = useState(SAMPLE_INVOICES);
  const [payments, setPayments] = useState(SAMPLE_PAYMENTS);
  const [milestones, setMilestones] = useState(SAMPLE_MILESTONES);
  const [flash, setFlash] = useState<string | null>(null);
  const [deciding, startDecide] = useTransition();

  useEffect(() => {
    setApprovals(initialApprovals);
  }, [initialApprovals]);

  useEffect(() => {
    if (contracts.length && !contracts.some((c) => c.id === selectedId)) {
      setSelectedId(contracts[0].id);
    }
  }, [contracts, selectedId]);

  const contract =
    contracts.find((c) => c.id === selectedId) ?? contracts[0] ?? null;

  const today = useMemo(() => new Date(), []);
  const eventDate = contract?.event_start?.slice(0, 10) ?? "";
  const days = eventDate ? daysUntil(eventDate, today) : 0;

  const eventApprovals = approvals.filter(
    (a) => !contract || a.contract_id === contract.id,
  );
  const pendingCount = eventApprovals.filter((a) => a.status === "pending").length;

  const eventMilestones = milestones;
  const progress = planningProgressFromMilestones(eventMilestones, today);
  const eventInvoices = invoices;
  const financial = financialFromInvoices(eventInvoices);
  const eventDocs = SAMPLE_DOCUMENTS;

  const showFlash = useCallback((msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 4000);
  }, []);

  const approveAction = useCallback(
    (id: string) => {
      startDecide(async () => {
        const res = await decideCustomerApproval({
          approvalItemId: id,
          decision: "approved",
        });
        if (!res.ok) {
          showFlash(res.error);
          return;
        }
        setApprovals((prev) =>
          prev.map((a) =>
            a.id === id ? { ...a, status: "approved" as const } : a,
          ),
        );
        showFlash("Approved — decision recorded.");
        router.refresh();
      });
    },
    [router, showFlash],
  );

  const requestChanges = useCallback(
    (id: string, note: string) => {
      if (!note.trim()) {
        showFlash("Add a short note so your manager knows what to revise.");
        return;
      }
      startDecide(async () => {
        const res = await decideCustomerApproval({
          approvalItemId: id,
          decision: "changes_requested",
          comments: note,
        });
        if (!res.ok) {
          showFlash(res.error);
          return;
        }
        setApprovals((prev) =>
          prev.map((a) =>
            a.id === id ? { ...a, status: "changes_requested" as const } : a,
          ),
        );
        showFlash("Change request sent to your event manager.");
        router.refresh();
      });
    },
    [router, showFlash],
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
    contracts,
    contract,
    selectedId: contract?.id ?? selectedId,
    setSelectedId,
    approvals,
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
    eventApprovals,
    eventActions: eventApprovals,
    eventInvoices,
    eventDocs,
    eventMilestones,
    approveAction,
    requestChanges,
    recordPayment,
    deciding,
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
