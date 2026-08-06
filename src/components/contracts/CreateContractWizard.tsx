"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { createContract } from "@/features/contracts/actions";
import { formatCurrency } from "@/features/billing/aging";
import { Panel } from "@/components/billing/ui";
import {
  CHECKPOINT_TYPES,
  CHECKPOINT_LABELS,
  INVOLVEMENT_MODEL_DESCRIPTIONS,
  INVOLVEMENT_MODEL_LABELS,
  type InvolvementModel,
} from "@/features/involvement/checkpoints";
import { listEventTypes, type EventTypeOption } from "@/features/contracts/event-types";
import { addEventTypeAction } from "@/features/contracts/customer-actions";
import { ValuationToolClient } from "@/components/valuation/ValuationToolClient";

type Customer = { id: string; name: string };
type DiscountType = "none" | "percent" | "fixed";

/** Portal demo org — matches DEMO_CUSTOMER_ID / Demo Customer name. */
const DEMO_PORTAL_CUSTOMER_ID = "22222222-2222-2222-2222-222222222201";
const DEMO_CUSTOMER_NAME = "Demo Customer";

function isDemoPortalCustomer(c: { id: string; name: string } | undefined) {
  if (!c) return false;
  const name = c.name.trim().toLowerCase();
  return (
    c.id === DEMO_PORTAL_CUSTOMER_ID ||
    name === DEMO_CUSTOMER_NAME.toLowerCase()
  );
}

type ServiceLine = {
  key: string;
  description: string;
  line_type: string;
  quantity: number;
  unit_rate: number;
  amount: number;
};

type PoDraft = {
  title: string;
  description: string;
  completion_definition: string;
  amount: string;
  service_keys: string[];
};

type MilestoneDraft = {
  milestone_key: string;
  label: string;
  amount: string;
  due_date: string;
  milestone_type: string;
  sequence_no: number;
};

const STORAGE_KEY = "mainevent-create-contract-draft-v6";

type StepDef = { title: string; purpose: string };

const STEPS: StepDef[] = [
  {
    title: "Customer & Event",
    purpose: "Who is the client, and what event are you contracting for?",
  },
  {
    title: "Services & Scope",
    purpose: "List what you’re selling and what must be delivered.",
  },
  {
    title: "Pricing",
    purpose: "Set contract value and discounts. First payment = deposit (tied to PO #1).",
  },
  {
    title: "Performance Obligations",
    purpose:
      "Group services into deliverable phases that unlock billing. Every service must be covered before you continue.",
  },
  {
    title: "Payment Schedule",
    purpose:
      "Milestone installments follow deliverable phases (amounts locked). Deposit and cancel fee equal PO #1.",
  },
  {
    title: "Approvals & Involvement",
    purpose: "Who prepares this, and how the customer stays involved.",
  },
  {
    title: "Terms & Review",
    purpose: "Cancellation terms (fee = PO #1), optional documents, then confirm.",
  },
];

/** Always milestone billing — installments align with performance obligations. */
const BILLING_METHOD = "milestone";
const BILLING_METHOD_LABEL = "Milestone billing (aligned with POs)";

const DELIVERABLE_PHASES: { value: string; label: string }[] = [
  { value: "planning", label: "Planning" },
  { value: "execution", label: "Execution" },
  { value: "wrapup", label: "Wrap-up" },
];

/** Deposit / progress / final only — schedule aligns with PO installments. */
const MILESTONE_TYPES: { value: string; label: string }[] = [
  { value: "deposit", label: "Deposit" },
  { value: "progress", label: "Progress" },
  { value: "final", label: "Final" },
];

function moneyRound(n: number) {
  return Math.round(n * 100) / 100;
}

function newServiceKey() {
  return `svc-${Math.random().toString(36).slice(2, 10)}`;
}

function ensureLineKeys(lines: Array<Partial<ServiceLine>>): ServiceLine[] {
  return lines.map((l, i) => ({
    key: typeof l.key === "string" && l.key ? l.key : newServiceKey(),
    description: String(l.description ?? ""),
    line_type: String(l.line_type ?? (i === 0 ? "package" : "service")),
    quantity: Number(l.quantity) || 1,
    unit_rate: Number(l.unit_rate) || 0,
    amount: Number(l.amount) || 0,
  }));
}

function ensurePos(raw: Array<Partial<PoDraft>>): PoDraft[] {
  return raw.map((p) => ({
    title: String(p.title ?? ""),
    description: String(p.description ?? ""),
    completion_definition: String(p.completion_definition ?? ""),
    amount: p.amount != null ? String(p.amount) : "",
    service_keys: Array.isArray(p.service_keys)
      ? p.service_keys.map(String)
      : [],
  }));
}

function defaultDueDate(
  index: number,
  total: number,
  eventStart: string,
  eventEnd: string,
): string {
  const start = eventStart ? eventStart.slice(0, 10) : "";
  const end = eventEnd ? eventEnd.slice(0, 10) : start;
  if (!start) return "";
  if (total <= 1) return start;
  if (index === 0) return start;
  if (index === total - 1) return end || start;
  if (!end || end === start) return start;
  const a = new Date(`${start}T12:00:00`);
  const b = new Date(`${end}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return start;
  const t = index / (total - 1);
  const ms = a.getTime() + (b.getTime() - a.getTime()) * t;
  return new Date(ms).toISOString().slice(0, 10);
}

function milestonesFromPos(
  pos: PoDraft[],
  prev: MilestoneDraft[],
  eventStart: string,
  eventEnd: string,
  depositRequired: boolean,
): MilestoneDraft[] {
  const filled = pos.filter((p) => p.title.trim());
  return filled.map((p, i) => {
    const key = `po-${i + 1}`;
    const existing = prev.find((m) => m.milestone_key === key);
    const last = i === filled.length - 1;
    const milestone_type =
      i === 0 && depositRequired
        ? "deposit"
        : last
          ? "final"
          : "progress";
    return {
      milestone_key: key,
      label: p.title.trim(),
      amount: String(moneyRound(Number(p.amount) || 0)),
      due_date:
        existing?.due_date ||
        defaultDueDate(i, filled.length, eventStart, eventEnd),
      milestone_type,
      sequence_no: i + 1,
    };
  });
}

function FieldLabel({
  children,
  required,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <span className="mb-1 block text-xs font-medium text-[var(--muted)]">
      {children}
      {required ? <span className="text-[var(--danger)]"> *</span> : null}
    </span>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="mt-1 block text-xs text-[var(--danger)]" role="alert">
      {message}
    </span>
  );
}

function StepPurpose({ text }: { text: string }) {
  return <p className="mb-4 text-sm text-[var(--muted)]">{text}</p>;
}

export function CreateContractWizard({ customers }: { customers: Customer[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [eventName, setEventName] = useState("");
  const [eventTypes, setEventTypes] = useState<EventTypeOption[]>(() =>
    listEventTypes(),
  );
  const [eventType, setEventType] = useState("corporate_conference");
  const [newEventTypeLabel, setNewEventTypeLabel] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueCity, setVenueCity] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [pm, setPm] = useState("Alex Rivera");

  const [lines, setLines] = useState<ServiceLine[]>([
    {
      key: newServiceKey(),
      description: "Full production package",
      line_type: "package",
      quantity: 1,
      unit_rate: 0,
      amount: 0,
    },
  ]);
  const [deliverables, setDeliverables] = useState([
    {
      code: "DLV-1",
      title: "Event production",
      description: "",
      phase: "execution",
    },
  ]);

  const [billingMethod] = useState(BILLING_METHOD);
  /** Manual gross override; empty string ⇒ use sum of service lines when available. */
  const [grossOverride, setGrossOverride] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("none");
  const [discountPercentInput, setDiscountPercentInput] = useState("");
  const [discountFixedInput, setDiscountFixedInput] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  const [milestones, setMilestones] = useState<MilestoneDraft[]>([]);

  const [createdBy, setCreatedBy] = useState("Coordinator Lee");
  const [submitNow, setSubmitNow] = useState(false);
  const [involvementModel, setInvolvementModel] = useState<
    "collaborative" | "full_service" | "custom"
  >("collaborative");
  const [customCheckpoints, setCustomCheckpoints] = useState<string[]>([
    "venue",
    "budget",
    "change_order",
    "cancellation",
  ]);
  const [pos, setPos] = useState<PoDraft[]>([
    {
      title: "Planning & design",
      description: "",
      completion_definition: "Customer approves planning package as complete.",
      amount: "",
      service_keys: [],
    },
    {
      title: "Event production",
      description: "",
      completion_definition: "Customer confirms event-day delivery.",
      amount: "",
      service_keys: [],
    },
    {
      title: "Wrap-up & closeout",
      description: "",
      completion_definition:
        "Customer accepts final wrap-up and closes engagement.",
      amount: "",
      service_keys: [],
    },
  ]);

  const [cancelPolicy, setCancelPolicy] = useState(
    "Payment milestones follow performance obligations. The initial deposit equals PO #1. If canceled after one or more POs are in progress or paid, amounts paid to date are recognized as revenue and the contract is terminated. The default cancellation fee equals the PO #1 / deposit amount.",
  );

  const [docTitle, setDocTitle] = useState("Engagement proposal");
  const [docUrl, setDocUrl] = useState("");
  const [notes, setNotes] = useState("");

  const catalogServices = useMemo(
    () => lines.filter((l) => l.description.trim()),
    [lines],
  );

  const linesGross = useMemo(
    () => moneyRound(lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)),
    [lines],
  );

  const gross = useMemo(() => {
    if (grossOverride.trim() !== "") return moneyRound(Number(grossOverride) || 0);
    if (linesGross > 0) return linesGross;
    return 0;
  }, [grossOverride, linesGross]);

  const discountCalc = useMemo(() => {
    if (discountType === "none") {
      return { percent: 0, amount: 0 };
    }
    if (discountType === "percent") {
      const percent = Number(discountPercentInput) || 0;
      const amount = moneyRound(gross * (percent / 100));
      return { percent, amount };
    }
    const amount = moneyRound(Number(discountFixedInput) || 0);
    return { percent: 0, amount };
  }, [discountType, discountPercentInput, discountFixedInput, gross]);

  const net = useMemo(
    () => moneyRound(Math.max(0, gross - discountCalc.amount)),
    [gross, discountCalc.amount],
  );

  /** First titled PO amount — deposit and default cancel fee. */
  const po1Amount = useMemo(() => {
    const filled = pos.filter((p) => p.title.trim());
    if (!filled.length) return 0;
    return moneyRound(Number(filled[0].amount) || 0);
  }, [pos]);

  const depositRequired = po1Amount > 0;
  const depositCalc = useMemo(() => {
    if (!depositRequired) {
      return { percent: 0, amount: 0, fixed: null as number | null };
    }
    const percent =
      net > 0 ? moneyRound((po1Amount / net) * 100) : 0;
    return { percent, amount: po1Amount, fixed: po1Amount };
  }, [depositRequired, po1Amount, net]);

  const cancelFeeAmount = po1Amount;
  const cancelFeePercent = useMemo(() => {
    if (net <= 0 || po1Amount <= 0) return 0;
    return Math.min(100, moneyRound((po1Amount / net) * 100));
  }, [po1Amount, net]);

  const remainingBalance = useMemo(
    () => moneyRound(Math.max(0, net - depositCalc.amount)),
    [net, depositCalc.amount],
  );

  const scheduleSum = useMemo(
    () => milestones.reduce((s, m) => s + (Number(m.amount) || 0), 0),
    [milestones],
  );

  const poSum = useMemo(
    () => pos.reduce((s, p) => s + (Number(p.amount) || 0), 0),
    [pos],
  );

  const coveredServiceKeys = useMemo(() => {
    const set = new Set<string>();
    for (const p of pos) {
      for (const k of p.service_keys) set.add(k);
    }
    return set;
  }, [pos]);

  const uncoveredServices = useMemo(
    () => catalogServices.filter((s) => !coveredServiceKeys.has(s.key)),
    [catalogServices, coveredServiceKeys],
  );

  const requirePos = catalogServices.length > 0;

  const fieldErrors = useMemo(() => {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (!customerId) e.customerId = "Select a customer.";
      if (!eventName.trim()) e.eventName = "Enter an event name.";
      if (!eventStart) e.eventStart = "Enter the event start date.";
      if (!pm.trim()) e.pm = "Enter the project manager.";
    }
    if (step === 1) {
      if (
        !lines.some((l) => l.description.trim()) &&
        !deliverables.some((d) => d.title.trim())
      ) {
        e.scope = "Add at least one service line or deliverable.";
      }
    }
    if (step === 2) {
      if (gross <= 0) e.gross = "Gross value must be greater than zero.";
      if (discountType === "percent") {
        const p = Number(discountPercentInput);
        if (Number.isNaN(p) || p < 0 || p > 100) {
          e.discount = "Discount % must be between 0 and 100.";
        }
      }
      if (discountType === "fixed") {
        const a = Number(discountFixedInput);
        if (Number.isNaN(a) || a < 0) {
          e.discount = "Discount cannot be negative.";
        } else if (a > gross + 1e-9) {
          e.discount = "Discount cannot exceed gross value.";
        }
      }
      if (gross > 0 && net <= 0) {
        e.net = "Net value must be greater than zero after discount.";
      }
    }
    // Step 3: Performance Obligations
    if (step === 3) {
      if (requirePos) {
        const filled = pos.filter((p) => p.title.trim());
        if (!filled.length) {
          e.pos = "Add at least one performance obligation.";
        }
        for (let i = 0; i < pos.length; i++) {
          const p = pos[i];
          if (!p.title.trim()) continue;
          if (!p.completion_definition.trim()) {
            e[`poDone${i}`] = "Say what “done” means.";
          }
          if (!(Number(p.amount) > 0)) {
            e[`poAmt${i}`] = "Amount must be greater than $0.";
          }
          if (!p.service_keys.length) {
            e[`poSvc${i}`] = "Select at least one service for this obligation.";
          }
        }
        if (uncoveredServices.length) {
          e.poCoverage = `Uncovered services: ${uncoveredServices
            .map((s) => s.description.trim())
            .join(", ")}. Every service must appear in at least one obligation.`;
        }
        if (filled.length && Math.abs(poSum - net) > 0.01) {
          e.poMatch = `Obligation amounts (${formatCurrency(poSum)}) must equal net (${formatCurrency(net)}).`;
        }
      }
    }
    // Step 4: Payment Schedule (derived from POs)
    if (step === 4) {
      if (!milestones.length) {
        e.schedule =
          requirePos
            ? "Define performance obligations first — the schedule is built from them."
            : "Add at least one payment.";
      }
      if (
        depositRequired &&
        milestones.some(
          (m) => m.milestone_type === "deposit" && !(Number(m.amount) > 0),
        )
      ) {
        e.depositRow = "Deposit payment must be greater than $0.";
      }
      if (milestones.length && Math.abs(scheduleSum - net) > 0.01) {
        e.scheduleMatch = `Payments (${formatCurrency(scheduleSum)}) must equal net (${formatCurrency(net)}).`;
      }
      for (let i = 0; i < milestones.length; i++) {
        if (!milestones[i].label.trim()) {
          e[`msLabel${i}`] = "Name this payment.";
        }
      }
    }
    if (step === 5) {
      if (!createdBy.trim()) e.createdBy = "Enter who prepared this.";
      if (involvementModel === "custom" && customCheckpoints.length === 0) {
        e.checkpoints = "Select at least one checkpoint for Custom.";
      }
    }
    if (step === 6) {
      if (!cancelPolicy.trim()) e.cancelPolicy = "Enter cancellation terms.";
    }
    return e;
  }, [
    step,
    customerId,
    eventName,
    eventStart,
    pm,
    lines,
    deliverables,
    billingMethod,
    gross,
    net,
    discountType,
    discountPercentInput,
    discountFixedInput,
    depositRequired,
    depositCalc.amount,
    milestones,
    scheduleSum,
    pos,
    poSum,
    requirePos,
    uncoveredServices,
    createdBy,
    involvementModel,
    customCheckpoints,
    cancelPolicy,
  ]);

  const stepValid = Object.keys(fieldErrors).length === 0;

  // Keep payment schedule aligned with POs whenever obligations change.
  useEffect(() => {
    if (!hydrated) return;
    const filled = pos.filter((p) => p.title.trim());
    if (!filled.length) {
      if (requirePos) setMilestones([]);
      return;
    }
    setMilestones((prev) =>
      milestonesFromPos(filled, prev, eventStart, eventEnd, depositRequired),
    );
  }, [pos, eventStart, eventEnd, depositRequired, hydrated, requirePos]);

  useEffect(() => {
    // Restore create-contract draft from sessionStorage (external system).
    // Intentionally syncs local form state once on mount for Back/Continue + refresh.
    /* eslint-disable react-hooks/set-state-in-effect -- sessionStorage draft hydrate */
    try {
      // v6 only — do not hydrate billingMethod / depositType from older drafts.
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Record<string, unknown>;
        if (typeof d.step === "number") {
          setStep(Math.min(STEPS.length - 1, Math.max(0, d.step as number)));
        }
        if (typeof d.customerId === "string") setCustomerId(d.customerId);
        if (typeof d.eventName === "string") setEventName(d.eventName);
        if (typeof d.eventType === "string") setEventType(d.eventType);
        if (typeof d.eventStart === "string") setEventStart(d.eventStart);
        if (typeof d.eventEnd === "string") setEventEnd(d.eventEnd);
        if (typeof d.venueName === "string") setVenueName(d.venueName);
        if (typeof d.venueCity === "string") setVenueCity(d.venueCity);
        if (typeof d.guestCount === "string") setGuestCount(d.guestCount);
        if (typeof d.pm === "string") setPm(d.pm);
        if (Array.isArray(d.lines)) setLines(ensureLineKeys(d.lines as Partial<ServiceLine>[]));
        if (Array.isArray(d.deliverables))
          setDeliverables(d.deliverables as typeof deliverables);
        if (typeof d.grossOverride === "string")
          setGrossOverride(d.grossOverride);
        if (
          d.discountType === "none" ||
          d.discountType === "percent" ||
          d.discountType === "fixed"
        ) {
          setDiscountType(d.discountType);
        }
        if (typeof d.discountPercentInput === "string")
          setDiscountPercentInput(d.discountPercentInput);
        if (typeof d.discountFixedInput === "string")
          setDiscountFixedInput(d.discountFixedInput);
        if (Array.isArray(d.milestones))
          setMilestones(d.milestones as MilestoneDraft[]);
        if (typeof d.createdBy === "string") setCreatedBy(d.createdBy);
        if (typeof d.submitNow === "boolean") setSubmitNow(d.submitNow);
        if (typeof d.cancelPolicy === "string") setCancelPolicy(d.cancelPolicy);
        if (typeof d.docTitle === "string") setDocTitle(d.docTitle);
        if (typeof d.docUrl === "string") setDocUrl(d.docUrl);
        if (typeof d.notes === "string") setNotes(d.notes);
        if (Array.isArray(d.pos)) setPos(ensurePos(d.pos as Partial<PoDraft>[]));
        if (
          d.involvementModel === "collaborative" ||
          d.involvementModel === "full_service" ||
          d.involvementModel === "custom"
        ) {
          setInvolvementModel(d.involvementModel);
        }
        if (Array.isArray(d.customCheckpoints)) {
          setCustomCheckpoints(d.customCheckpoints as string[]);
        }
        setDraftRestored(true);
      }
    } catch {
      /* ignore corrupt draft */
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const payload = {
      step,
      customerId,
      eventName,
      eventType,
      eventStart,
      eventEnd,
      venueName,
      venueCity,
      guestCount,
      pm,
      lines,
      deliverables,
      billingMethod,
      grossOverride,
      discountType,
      discountPercentInput,
      discountFixedInput,
      milestones,
      createdBy,
      submitNow,
      cancelPolicy,
      docTitle,
      docUrl,
      notes,
      pos,
      involvementModel,
      customCheckpoints,
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* quota */
    }
  }, [
    hydrated,
    step,
    customerId,
    eventName,
    eventType,
    eventStart,
    eventEnd,
    venueName,
    venueCity,
    guestCount,
    pm,
    lines,
    deliverables,
    billingMethod,
    grossOverride,
    discountType,
    discountPercentInput,
    discountFixedInput,
    milestones,
    createdBy,
    submitNow,
    cancelPolicy,
    docTitle,
    docUrl,
    notes,
    pos,
    involvementModel,
    customCheckpoints,
  ]);

  useEffect(() => {
    setShowErrors(false);
    setError(null);
  }, [step]);

  // Drop stale service keys when a service line is removed.
  useEffect(() => {
    const valid = new Set(catalogServices.map((s) => s.key));
    setPos((prev) => {
      let changed = false;
      const next = prev.map((p) => {
        const keys = p.service_keys.filter((k) => valid.has(k));
        if (keys.length !== p.service_keys.length) {
          changed = true;
          return { ...p, service_keys: keys };
        }
        return p;
      });
      return changed ? next : prev;
    });
  }, [catalogServices]);

  function next() {
    if (!stepValid) {
      setShowErrors(true);
      setError("Fix the highlighted fields to continue.");
      return;
    }
    setError(null);
    setShowErrors(false);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function back() {
    setError(null);
    setShowErrors(false);
    setStep((s) => Math.max(0, s - 1));
  }

  function goToStep(i: number) {
    if (i > step) return;
    setError(null);
    setShowErrors(false);
    setStep(i);
  }

  function setDiscountTypeSafe(nextType: DiscountType) {
    setDiscountType(nextType);
    setDiscountPercentInput("");
    setDiscountFixedInput("");
  }

  function serviceAmountSum(keys: string[]) {
    return moneyRound(
      catalogServices
        .filter((s) => keys.includes(s.key))
        .reduce((sum, s) => sum + (Number(s.amount) || 0), 0),
    );
  }

  function togglePoService(poIndex: number, serviceKey: string) {
    setPos((prev) => {
      const next = [...prev];
      const p = next[poIndex];
      const has = p.service_keys.includes(serviceKey);
      const service_keys = has
        ? p.service_keys.filter((k) => k !== serviceKey)
        : [...p.service_keys, serviceKey];
      const priced = serviceAmountSum(service_keys);
      next[poIndex] = {
        ...p,
        service_keys,
        // Auto-fill from service prices when available; otherwise keep manual amount.
        amount: priced > 0 ? String(priced) : p.amount,
      };
      return next;
    });
  }

  function splitPosFromValue() {
    const v = net;
    if (v <= 0) return;
    const titled = pos.filter((p) => p.title.trim());
    const n = Math.max(1, titled.length || pos.length);
    const base = moneyRound(v / n);
    setPos((prev) => {
      const targets = prev.filter((p) => p.title.trim());
      const list = targets.length ? targets : prev;
      let allocated = 0;
      return prev.map((p, i) => {
        const idx = list.indexOf(p);
        if (idx < 0) return p;
        const isLast = idx === list.length - 1;
        const amount = isLast
          ? moneyRound(v - allocated)
          : base;
        if (!isLast) allocated = moneyRound(allocated + amount);
        return { ...p, amount: String(amount) };
      });
    });
  }

  function submit() {
    if (!stepValid) {
      setShowErrors(true);
      setError("Fix the highlighted fields before creating.");
      return;
    }
    if (Math.abs(scheduleSum - net) > 0.01) {
      setError(
        `Payment schedule total (${formatCurrency(scheduleSum)}) must equal net (${formatCurrency(net)}).`,
      );
      return;
    }
    const poPayload = requirePos
      ? pos
          .filter((p) => p.title.trim())
          .map((p) => ({
            title: p.title,
            description: p.description || undefined,
            completion_definition: p.completion_definition,
            amount: Number(p.amount) || 0,
            service_keys: p.service_keys,
          }))
      : undefined;
    if (requirePos && poPayload) {
      const sum = poPayload.reduce((s, p) => s + p.amount, 0);
      if (Math.abs(sum - net) > 0.01) {
        setError(
          `Performance obligation amounts (${formatCurrency(sum)}) must equal net (${formatCurrency(net)}).`,
        );
        return;
      }
      if (
        poPayload.some(
          (p) =>
            !p.completion_definition.trim() ||
            p.amount <= 0 ||
            !p.service_keys.length,
        )
      ) {
        setError(
          "Each obligation needs completion criteria, an amount > 0, and at least one service.",
        );
        return;
      }
      if (uncoveredServices.length) {
        setError(
          `Uncovered services: ${uncoveredServices
            .map((s) => s.description.trim())
            .join(", ")}.`,
        );
        return;
      }
    }
    setError(null);
    start(async () => {
      const result = await createContract({
        customer_id: customerId,
        event_name: eventName,
        event_type: eventType,
        event_start: new Date(eventStart).toISOString(),
        event_end: eventEnd ? new Date(eventEnd).toISOString() : undefined,
        venue_name: venueName || undefined,
        venue_city: venueCity || undefined,
        guest_count: guestCount ? Number(guestCount) : undefined,
        project_manager_label: pm,
        billing_method: BILLING_METHOD,
        gross_contract_value: gross,
        contract_value: net,
        deposit_required: depositRequired,
        deposit_percent: depositRequired ? depositCalc.percent : 0,
        minimum_deposit_amount: depositRequired ? depositCalc.amount : null,
        discount_amount: discountType === "fixed" ? discountCalc.amount : 0,
        discount_percent:
          discountType === "percent" ? discountCalc.percent : 0,
        cancellation_policy_text: cancelPolicy,
        cancellation_fee_percent: cancelFeePercent,
        notes: notes || undefined,
        created_by: createdBy,
        submit_for_approval: submitNow,
        involvement_model: involvementModel,
        custom_checkpoint_types:
          involvementModel === "custom" ? customCheckpoints : undefined,
        performance_obligations: poPayload,
        line_items: lines
          .filter((l) => l.description.trim())
          .map((l) => ({
            description: l.description,
            line_type: l.line_type,
            quantity: Number(l.quantity) || 1,
            unit_rate: Number(l.unit_rate) || 0,
            amount: Number(l.amount) || 0,
          })),
        deliverables: deliverables
          .filter((d) => d.title.trim())
          .map((d) => ({
            code: d.code || "DLV",
            title: d.title,
            description: d.description,
            phase: d.phase || "planning",
          })),
        milestones: milestones.map((m, i) => ({
          milestone_key: m.milestone_key || `ms-${i + 1}`,
          label: m.label,
          amount: Number(m.amount) || 0,
          due_date: m.due_date || undefined,
          milestone_type: m.milestone_type,
          sequence_no: m.sequence_no || i + 1,
        })),
        document: docTitle
          ? {
              title: docTitle,
              doc_type: "proposal",
              external_url: docUrl || undefined,
            }
          : undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      try {
        sessionStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem("mainevent-create-contract-draft-v3");
        sessionStorage.removeItem("mainevent-create-contract-draft-v2");
      } catch {
        /* ignore */
      }
      router.push(`/contracts/${result.id}`);
      router.refresh();
    });
  }

  const field =
    "w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm";
  const fieldBad = `${field} border-[var(--danger)]`;
  const err = (key: string) => (showErrors ? fieldErrors[key] : undefined);
  const customerName =
    customers.find((c) => c.id === customerId)?.name ?? "—";
  const submitToCustomer = isDemoPortalCustomer(
    customers.find((c) => c.id === customerId),
  );
  const submitCheckboxLabel = submitToCustomer
    ? "Submit proposal to customer"
    : "Submit for PM approval";
  const afterCreateLabel = submitNow
    ? submitToCustomer
      ? "Submit proposal to customer"
      : "Submit for PM approval"
    : "Save as draft";
  const createButtonLabel = pending
    ? "Saving…"
    : submitNow
      ? submitToCustomer
        ? "Create & send to customer"
        : "Create & submit"
      : "Create draft";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-[var(--ink)]">
          Step {step + 1} of {STEPS.length}
          <span className="font-normal text-[var(--muted)]">
            {" "}
            · {STEPS[step].title}
          </span>
        </p>
      </div>

      {draftRestored ? (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--line)] bg-[#f7f9fb] px-3 py-2 text-sm"
          role="status"
        >
          <p className="text-[var(--ink)]">
            Resumed unfinished draft from this browser.
          </p>
          <button
            type="button"
            className="rounded-md border border-[var(--line)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--ink)]"
            onClick={() => {
              try {
                sessionStorage.removeItem(STORAGE_KEY);
                sessionStorage.removeItem("mainevent-create-contract-draft-v3");
                sessionStorage.removeItem("mainevent-create-contract-draft-v2");
              } catch {
                /* ignore */
              }
              window.location.reload();
            }}
          >
            Start over
          </button>
        </div>
      ) : null}

      <ol className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={s.title}>
              <button
                type="button"
                disabled={i > step}
                onClick={() => goToStep(i)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                  current
                    ? "bg-[var(--accent)] text-white"
                    : done
                      ? "bg-[var(--accent-soft)] text-[var(--accent)] hover:opacity-90"
                      : "cursor-default bg-[#eef2f6] text-[var(--muted)]"
                } disabled:cursor-default`}
                aria-current={current ? "step" : undefined}
              >
                {done ? (
                  <span aria-hidden="true" className="text-[10px]">
                    ✓
                  </span>
                ) : (
                  <span aria-hidden="true">{i + 1}</span>
                )}
                {s.title}
              </button>
            </li>
          );
        })}
      </ol>

      <Panel title={STEPS[step].title}>
        <StepPurpose text={STEPS[step].purpose} />

        {step === 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              <FieldLabel required>Customer</FieldLabel>
              <select
                className={err("customerId") ? fieldBad : field}
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <FieldError message={err("customerId")} />
              <span className="mt-1 block text-xs text-[var(--muted)]">
                Need a new party? Use Create new customer above.
              </span>
            </label>
            <label className="text-sm sm:col-span-2">
              <FieldLabel required>Event name</FieldLabel>
              <input
                className={err("eventName") ? fieldBad : field}
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="e.g. Spring Product Showcase"
              />
              <FieldError message={err("eventName")} />
            </label>
            <label className="text-sm">
              <FieldLabel>Event type</FieldLabel>
              <select
                className={field}
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
              >
                {eventTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="text-sm">
              <FieldLabel>Add event type</FieldLabel>
              <div className="flex gap-2">
                <input
                  className={field}
                  value={newEventTypeLabel}
                  onChange={(e) => setNewEventTypeLabel(e.target.value)}
                  placeholder="e.g. Hybrid summit"
                />
                <button
                  type="button"
                  className="shrink-0 rounded-md border border-[var(--line)] px-3 py-2 text-xs font-semibold"
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("label", newEventTypeLabel);
                    start(async () => {
                      const r = await addEventTypeAction(fd);
                      if (!r.ok || !r.value || !r.label) {
                        setError(r.error ?? "Could not add event type");
                        return;
                      }
                      setEventTypes((prev) => {
                        if (prev.some((p) => p.value === r.value)) return prev;
                        return [...prev, { value: r.value!, label: r.label! }];
                      });
                      setEventType(r.value);
                      setNewEventTypeLabel("");
                      setError(null);
                    });
                  }}
                >
                  Add
                </button>
              </div>
            </div>
            <label className="text-sm">
              <FieldLabel required>Project manager</FieldLabel>
              <input
                className={err("pm") ? fieldBad : field}
                value={pm}
                onChange={(e) => setPm(e.target.value)}
              />
              <FieldError message={err("pm")} />
            </label>
            <label className="text-sm">
              <FieldLabel required>Event start</FieldLabel>
              <input
                type="datetime-local"
                className={err("eventStart") ? fieldBad : field}
                value={eventStart}
                onChange={(e) => setEventStart(e.target.value)}
              />
              <FieldError message={err("eventStart")} />
            </label>
            <label className="text-sm">
              <FieldLabel>Event end</FieldLabel>
              <input
                type="datetime-local"
                className={field}
                value={eventEnd}
                onChange={(e) => setEventEnd(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <FieldLabel>Venue</FieldLabel>
              <input
                className={field}
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                placeholder="Venue or location name"
              />
            </label>
            <label className="text-sm">
              <FieldLabel>City</FieldLabel>
              <input
                className={field}
                value={venueCity}
                onChange={(e) => setVenueCity(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <FieldLabel>Guest count</FieldLabel>
              <input
                type="number"
                min={0}
                className={field}
                value={guestCount}
                onChange={(e) => setGuestCount(e.target.value)}
              />
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            {err("scope") ? (
              <p
                className="rounded-md border border-[var(--danger)]/30 bg-[#fef2f2] px-3 py-2 text-sm text-[var(--danger)]"
                role="alert"
              >
                {err("scope")}
              </p>
            ) : null}
            <div>
              <p className="mb-1 text-sm font-semibold">Services</p>
              <p className="mb-3 text-xs text-[var(--muted)]">
                Sellable lines. These become the catalog for performance
                obligations. Totals roll into Pricing unless you override.
              </p>
              {lines.map((l, i) => (
                <div
                  key={l.key}
                  className="mb-3 grid gap-2 rounded-md border border-[var(--line)] p-3 sm:grid-cols-4"
                >
                  <label className="text-sm sm:col-span-2">
                    <FieldLabel>Description</FieldLabel>
                    <input
                      className={field}
                      value={l.description}
                      onChange={(e) => {
                        const nextLines = [...lines];
                        nextLines[i] = { ...l, description: e.target.value };
                        setLines(nextLines);
                      }}
                      placeholder="e.g. Full-day AV package"
                    />
                  </label>
                  <label className="text-sm">
                    <FieldLabel>Qty</FieldLabel>
                    <input
                      type="number"
                      min={0}
                      className={field}
                      value={l.quantity}
                      onChange={(e) => {
                        const nextLines = [...lines];
                        const qty = Number(e.target.value);
                        nextLines[i] = {
                          ...l,
                          quantity: qty,
                          amount: qty * l.unit_rate,
                        };
                        setLines(nextLines);
                      }}
                    />
                  </label>
                  <label className="text-sm">
                    <FieldLabel>Unit price</FieldLabel>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={field}
                      value={l.unit_rate}
                      onChange={(e) => {
                        const nextLines = [...lines];
                        const unit_rate = Number(e.target.value);
                        nextLines[i] = {
                          ...l,
                          unit_rate,
                          amount: l.quantity * unit_rate,
                        };
                        setLines(nextLines);
                      }}
                    />
                  </label>
                  <label className="text-sm sm:col-span-2">
                    <FieldLabel>Line total</FieldLabel>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={field}
                      value={l.amount}
                      onChange={(e) => {
                        const nextLines = [...lines];
                        nextLines[i] = {
                          ...l,
                          amount: Number(e.target.value),
                        };
                        setLines(nextLines);
                      }}
                    />
                  </label>
                </div>
              ))}
              <button
                type="button"
                className="text-sm font-medium text-[var(--accent)]"
                onClick={() =>
                  setLines([
                    ...lines,
                    {
                      key: newServiceKey(),
                      description: "",
                      line_type: "service",
                      quantity: 1,
                      unit_rate: 0,
                      amount: 0,
                    },
                  ])
                }
              >
                + Add service
              </button>
            </div>
            <div>
              <p className="mb-1 text-sm font-semibold">Deliverables</p>
              <p className="mb-3 text-xs text-[var(--muted)]">
                What must be delivered for this engagement.
              </p>
              {deliverables.map((d, i) => (
                <div key={i} className="mb-3 grid gap-2 sm:grid-cols-3">
                  <label className="text-sm">
                    <FieldLabel>Name</FieldLabel>
                    <input
                      className={field}
                      value={d.title}
                      onChange={(e) => {
                        const nextD = [...deliverables];
                        nextD[i] = {
                          ...d,
                          title: e.target.value,
                          code:
                            d.code && d.code !== `DLV-${i + 1}`
                              ? d.code
                              : `DLV-${i + 1}`,
                        };
                        setDeliverables(nextD);
                      }}
                      placeholder="e.g. Stage setup"
                    />
                  </label>
                  <label className="text-sm sm:col-span-2">
                    <FieldLabel>Description</FieldLabel>
                    <input
                      className={field}
                      value={d.description}
                      onChange={(e) => {
                        const nextD = [...deliverables];
                        nextD[i] = { ...d, description: e.target.value };
                        setDeliverables(nextD);
                      }}
                      placeholder="What must be delivered"
                    />
                  </label>
                  <label className="text-sm">
                    <FieldLabel>Phase</FieldLabel>
                    <select
                      className={field}
                      value={d.phase}
                      onChange={(e) => {
                        const nextD = [...deliverables];
                        nextD[i] = { ...d, phase: e.target.value };
                        setDeliverables(nextD);
                      }}
                    >
                      {DELIVERABLE_PHASES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ))}
              <button
                type="button"
                className="text-sm font-medium text-[var(--accent)]"
                onClick={() =>
                  setDeliverables([
                    ...deliverables,
                    {
                      code: `DLV-${deliverables.length + 1}`,
                      title: "",
                      description: "",
                      phase: "planning",
                    },
                  ])
                }
              >
                + Add deliverable
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <ValuationToolClient
              compact
              initialEventType={eventType}
              initialGuests={guestCount ? Number(guestCount) : 150}
              initialEstimate={
                grossOverride !== ""
                  ? grossOverride
                  : linesGross > 0
                    ? String(linesGross)
                    : ""
              }
              eventName={eventName}
            />
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-[var(--ink)]">
                  Contract value
                </h3>
                <div className="rounded-md border border-[var(--line)] bg-[#f8fafb] px-3 py-2 text-sm">
                  <span className="text-[var(--muted)]">Payment model</span>
                  <p className="mt-0.5 font-medium text-[var(--ink)]">
                    {BILLING_METHOD_LABEL}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Installments always follow performance obligations — no
                    recurring schedule option.
                  </p>
                </div>
                <label className="block text-sm">
                  <FieldLabel required>Gross value</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={err("gross") ? fieldBad : field}
                    value={
                      grossOverride !== ""
                        ? grossOverride
                        : linesGross > 0
                          ? String(linesGross)
                          : ""
                    }
                    onChange={(e) => setGrossOverride(e.target.value)}
                    placeholder="0.00"
                  />
                  <FieldError message={err("gross")} />
                  <span className="mt-1 block text-xs text-[var(--muted)]">
                    {linesGross > 0
                      ? `From services (${formatCurrency(linesGross)}). Edit to override.`
                      : "Enter a value, or price services on the previous step."}
                  </span>
                </label>
                <label className="block text-sm">
                  <FieldLabel>Discount</FieldLabel>
                  <select
                    className={field}
                    value={discountType}
                    onChange={(e) =>
                      setDiscountTypeSafe(e.target.value as DiscountType)
                    }
                  >
                    <option value="none">None</option>
                    <option value="percent">Percentage</option>
                    <option value="fixed">Fixed amount</option>
                  </select>
                </label>
                {discountType === "percent" ? (
                  <label className="block text-sm">
                    <FieldLabel>Discount %</FieldLabel>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        className={`${err("discount") ? fieldBad : field} pr-10`}
                        value={discountPercentInput}
                        onChange={(e) =>
                          setDiscountPercentInput(e.target.value)
                        }
                        placeholder="0"
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-[var(--muted)]">
                        %
                      </span>
                    </div>
                    <FieldError message={err("discount")} />
                  </label>
                ) : null}
                {discountType === "fixed" ? (
                  <label className="block text-sm">
                    <FieldLabel>Discount amount</FieldLabel>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={err("discount") ? fieldBad : field}
                      value={discountFixedInput}
                      onChange={(e) => setDiscountFixedInput(e.target.value)}
                      placeholder="0.00"
                    />
                    <FieldError message={err("discount")} />
                  </label>
                ) : null}
                <div className="rounded-md border border-[var(--line)] bg-[#f8fafb] px-3 py-2 text-sm">
                  <span className="text-[var(--muted)]">Net contract value</span>
                  <p className="mt-0.5 font-semibold tabular-nums">
                    {formatCurrency(net)}
                  </p>
                  <FieldError message={err("net")} />
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-[var(--ink)]">
                  Deposit & cancellation (derived)
                </h3>
                <div className="rounded-md border border-[var(--line)] bg-[#f8fafb] px-3 py-3 text-sm text-[var(--muted)]">
                  <p className="font-medium text-[var(--ink)]">
                    No separate down payment to enter
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                    <li>
                      Deposit automatically equals <strong>PO #1</strong> (first
                      performance obligation) after obligations are set.
                    </li>
                    <li>
                      Default cancellation fee also equals <strong>PO #1</strong>.
                    </li>
                    <li>
                      Mid-stream cancel: amounts paid to date are recognized as
                      revenue and the contract is terminated.
                    </li>
                  </ul>
                  <p className="mt-3 text-sm">
                    {po1Amount > 0 ? (
                      <>
                        Current PO #1 → deposit / cancel fee:{" "}
                        <strong className="text-[var(--ink)] tabular-nums">
                          {formatCurrency(po1Amount)}
                        </strong>
                      </>
                    ) : (
                      <>
                        Deposit will equal PO #1 after obligations are set on
                        the next steps.
                      </>
                    )}
                  </p>
                </div>
              </section>
            </div>

            <section>
              <h3 className="mb-3 text-sm font-semibold text-[var(--ink)]">
                Summary
              </h3>
              <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--muted)]">Gross</dt>
                    <dd className="tabular-nums">{formatCurrency(gross)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--muted)]">Discount</dt>
                    <dd className="tabular-nums text-[var(--muted)]">
                      {discountCalc.amount > 0
                        ? `(${formatCurrency(discountCalc.amount)})`
                        : formatCurrency(0)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-[var(--line)] pt-2">
                    <dt className="font-semibold">Net</dt>
                    <dd className="font-semibold tabular-nums">
                      {formatCurrency(net)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--muted)]">Deposit (PO #1)</dt>
                    <dd className="tabular-nums">
                      {po1Amount > 0
                        ? formatCurrency(depositCalc.amount)
                        : "Set after POs"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-[var(--line)] pt-2">
                    <dt className="font-semibold">Remaining after deposit</dt>
                    <dd className="font-semibold tabular-nums">
                      {po1Amount > 0
                        ? formatCurrency(remainingBalance)
                        : formatCurrency(net)}
                    </dd>
                  </div>
                </dl>
              </div>
            </section>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {!requirePos ? (
              <p className="rounded-md border border-[var(--line)] bg-[#f8fafb] px-3 py-3 text-sm text-[var(--muted)]">
                No services listed — performance obligations are optional.
                Add services on Services & Scope if you want ASC 606 tracking.
              </p>
            ) : (
              <>
                <div className="rounded-md border border-[var(--line)] bg-[#f8fafb] px-3 py-3 text-sm text-[var(--muted)]">
                  <p className="font-medium text-[var(--ink)]">
                    Rules for this step
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                    <li>
                      Each obligation must include one or more services from
                      Services & Scope.
                    </li>
                    <li>
                      Every service must appear in at least one obligation
                      before you can continue.
                    </li>
                    <li>
                      Obligation amounts must sum to net (
                      {formatCurrency(net)}). Selecting priced services
                      auto-fills the amount; adjust if discount changes the
                      allocation.
                    </li>
                    <li>
                      The next step builds the payment schedule from these
                      obligations automatically.
                    </li>
                  </ul>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-[var(--muted)]">
                    Allocated: <strong>{formatCurrency(poSum)}</strong>
                    {" · "}
                    Net: <strong>{formatCurrency(net)}</strong>
                    {" · "}
                    Covered:{" "}
                    <strong>
                      {catalogServices.length - uncoveredServices.length}/
                      {catalogServices.length} services
                    </strong>
                  </p>
                  <button
                    type="button"
                    className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm"
                    onClick={splitPosFromValue}
                  >
                    Split net evenly
                  </button>
                </div>

                {err("pos") || err("poMatch") || err("poCoverage") ? (
                  <p
                    className="rounded-md border border-[var(--danger)]/30 bg-[#fef2f2] px-3 py-2 text-sm text-[var(--danger)]"
                    role="alert"
                  >
                    {err("poCoverage") || err("pos") || err("poMatch")}
                  </p>
                ) : Math.abs(poSum - net) <= 0.01 &&
                  poSum > 0 &&
                  uncoveredServices.length === 0 ? (
                  <p className="text-xs text-[var(--ok)]">
                    All services covered and amounts match net.
                  </p>
                ) : null}

                {pos.map((p, i) => (
                  <div
                    key={i}
                    className="grid gap-2 rounded-md border border-[var(--line)] p-3 sm:grid-cols-2"
                  >
                    <label className="text-sm sm:col-span-2">
                      <FieldLabel>Obligation {i + 1} title</FieldLabel>
                      <input
                        className={field}
                        value={p.title}
                        onChange={(e) => {
                          const nextP = [...pos];
                          nextP[i] = { ...p, title: e.target.value };
                          setPos(nextP);
                        }}
                        placeholder="e.g. Planning & design"
                      />
                    </label>
                    <label className="text-sm sm:col-span-2">
                      <FieldLabel>When is this complete?</FieldLabel>
                      <input
                        className={err(`poDone${i}`) ? fieldBad : field}
                        value={p.completion_definition}
                        onChange={(e) => {
                          const nextP = [...pos];
                          nextP[i] = {
                            ...p,
                            completion_definition: e.target.value,
                          };
                          setPos(nextP);
                        }}
                        placeholder="Customer approves…"
                      />
                      <FieldError message={err(`poDone${i}`)} />
                    </label>

                    <fieldset className="sm:col-span-2">
                      <legend className="mb-1 text-xs font-medium text-[var(--muted)]">
                        Services covered <span className="text-[var(--danger)]">*</span>
                      </legend>
                      {catalogServices.length === 0 ? (
                        <p className="text-xs text-[var(--muted)]">
                          No services with descriptions yet.
                        </p>
                      ) : (
                        <div className="grid gap-1.5 sm:grid-cols-2">
                          {catalogServices.map((s) => (
                            <label
                              key={s.key}
                              className="flex items-start gap-2 rounded-md border border-[var(--line)] px-2 py-1.5 text-sm"
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={p.service_keys.includes(s.key)}
                                onChange={() => togglePoService(i, s.key)}
                              />
                              <span>
                                <span className="font-medium">{s.description}</span>
                                {Number(s.amount) > 0 ? (
                                  <span className="mt-0.5 block text-xs text-[var(--muted)]">
                                    {formatCurrency(Number(s.amount))}
                                  </span>
                                ) : null}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                      <FieldError message={err(`poSvc${i}`)} />
                    </fieldset>

                    <label className="text-sm">
                      <FieldLabel>Allocated amount</FieldLabel>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className={err(`poAmt${i}`) ? fieldBad : field}
                        value={p.amount}
                        onChange={(e) => {
                          const nextP = [...pos];
                          nextP[i] = { ...p, amount: e.target.value };
                          setPos(nextP);
                        }}
                      />
                      <FieldError message={err(`poAmt${i}`)} />
                    </label>
                  </div>
                ))}
                <button
                  type="button"
                  className="text-sm font-medium text-[var(--accent)]"
                  onClick={() =>
                    setPos([
                      ...pos,
                      {
                        title: "",
                        description: "",
                        completion_definition: "",
                        amount: "",
                        service_keys: [],
                      },
                    ])
                  }
                >
                  + Add obligation
                </button>
              </>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <div className="rounded-md border border-[var(--line)] bg-[#f8fafb] px-3 py-3 text-sm text-[var(--muted)]">
              Milestone installments are generated from performance obligations
              (one payment per PO, amounts locked). The first installment is the
              deposit (PO #1). Edit due dates or payment type labels if needed.
              To change amounts, go back and edit the obligations.
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm">
                <span className="text-xs text-[var(--muted)]">
                  Deposit (= PO #1)
                </span>
                <p className="mt-0.5 font-semibold tabular-nums text-[var(--ink)]">
                  {formatCurrency(depositCalc.amount)}
                </p>
              </div>
              <div className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm">
                <span className="text-xs text-[var(--muted)]">
                  Default cancel fee (= PO #1)
                </span>
                <p className="mt-0.5 font-semibold tabular-nums text-[var(--ink)]">
                  {formatCurrency(cancelFeeAmount)}
                  {cancelFeePercent > 0 ? (
                    <span className="ml-1 text-xs font-normal text-[var(--muted)]">
                      ({cancelFeePercent}% of net)
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-[var(--muted)]">
                Scheduled: <strong>{formatCurrency(scheduleSum)}</strong>
                {" · "}
                Net: <strong>{formatCurrency(net)}</strong>
              </p>
            </div>
            {Math.abs(scheduleSum - net) > 0.01 ? (
              <p
                className="rounded-md border border-[#f59e0b]/40 bg-[#fffbeb] px-3 py-2 text-sm text-[#92400e]"
                role="status"
              >
                {err("scheduleMatch") ||
                  `Off by ${formatCurrency(Math.abs(scheduleSum - net))}. Adjust PO amounts on the previous step.`}
              </p>
            ) : milestones.length > 0 ? (
              <p className="text-xs text-[var(--ok)]">
                Schedule matches net contract value.
              </p>
            ) : null}
            <FieldError message={err("schedule") || err("depositRow")} />
            {milestones.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                {requirePos
                  ? "No obligations defined yet — go back to Performance Obligations."
                  : "No payments yet. Add obligations or create a manual installment."}
              </p>
            ) : null}
            {milestones.map((m, i) => (
              <div
                key={m.milestone_key}
                className="mb-1 grid gap-2 rounded-md border border-[var(--line)] p-3 sm:grid-cols-4"
              >
                <label className="text-sm sm:col-span-2">
                  <FieldLabel required>Payment name</FieldLabel>
                  <input
                    className={err(`msLabel${i}`) ? fieldBad : field}
                    value={m.label}
                    onChange={(e) => {
                      const nextM = [...milestones];
                      nextM[i] = { ...m, label: e.target.value };
                      setMilestones(nextM);
                    }}
                    placeholder="e.g. Planning installment"
                  />
                  <FieldError message={err(`msLabel${i}`)} />
                </label>
                <label className="text-sm">
                  <FieldLabel>Amount (from PO)</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={`${field} bg-[#f8fafb]`}
                    value={m.amount}
                    readOnly
                    title="Amount is locked to the matching performance obligation"
                  />
                </label>
                <label className="text-sm">
                  <FieldLabel>Due date</FieldLabel>
                  <input
                    type="date"
                    className={field}
                    value={m.due_date}
                    onChange={(e) => {
                      const nextM = [...milestones];
                      nextM[i] = { ...m, due_date: e.target.value };
                      setMilestones(nextM);
                    }}
                  />
                </label>
                <label className="text-sm sm:col-span-2">
                  <FieldLabel>Type</FieldLabel>
                  <input
                    className={`${field} bg-[#f8fafb]`}
                    value={
                      MILESTONE_TYPES.find((t) => t.value === m.milestone_type)
                        ?.label ?? m.milestone_type
                    }
                    readOnly
                    title="Type follows installment position (deposit / progress / final)"
                  />
                </label>
              </div>
            ))}
            {!requirePos ? (
              <button
                type="button"
                className="text-sm font-medium text-[var(--accent)]"
                onClick={() =>
                  setMilestones([
                    ...milestones,
                    {
                      milestone_key: `ms-${milestones.length + 1}`,
                      label: "",
                      amount: "",
                      due_date: "",
                      milestone_type: "progress",
                      sequence_no: milestones.length + 1,
                    },
                  ])
                }
              >
                + Add payment
              </button>
            ) : null}
          </div>
        )}

        {step === 5 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <FieldLabel required>Prepared by</FieldLabel>
              <input
                className={err("createdBy") ? fieldBad : field}
                value={createdBy}
                onChange={(e) => setCreatedBy(e.target.value)}
              />
              <FieldError message={err("createdBy")} />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={submitNow}
                  onChange={(e) => setSubmitNow(e.target.checked)}
                />
                {submitCheckboxLabel}
              </span>
              <span className="pl-6 text-xs text-[var(--muted)]">
                {submitToCustomer
                  ? "Checked: sends to the customer portal for accept & deposit. Unchecked: saves as draft only."
                  : "Checked: submits for PM review now. Unchecked: saves as draft only."}
              </span>
            </label>

            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-sm font-semibold text-[var(--ink)]">
                Customer involvement
              </legend>
              <p className="mb-3 text-xs text-[var(--muted)]">
                Controls which planning items the customer must approve in their
                portal. Internal contract approval does not recognize revenue.
              </p>
              <div className="space-y-2">
                {(
                  [
                    "collaborative",
                    "full_service",
                    "custom",
                  ] as InvolvementModel[]
                ).map((m) => (
                  <label
                    key={m}
                    className="flex cursor-pointer gap-2 rounded-md border border-[var(--line)] px-3 py-2 text-sm"
                  >
                    <input
                      type="radio"
                      name="involvement"
                      checked={involvementModel === m}
                      onChange={() => setInvolvementModel(m)}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-semibold">
                        {INVOLVEMENT_MODEL_LABELS[m]}
                      </span>
                      <span className="mt-0.5 block text-xs text-[var(--muted)]">
                        {INVOLVEMENT_MODEL_DESCRIPTIONS[m]}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {involvementModel === "custom" ? (
              <div className="sm:col-span-2">
                <p className="mb-2 text-xs font-medium text-[var(--muted)]">
                  Required checkpoints
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {CHECKPOINT_TYPES.map((t) => (
                    <label key={t} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={customCheckpoints.includes(t)}
                        onChange={() =>
                          setCustomCheckpoints((prev) =>
                            prev.includes(t)
                              ? prev.filter((x) => x !== t)
                              : [...prev, t],
                          )
                        }
                      />
                      {CHECKPOINT_LABELS[t]}
                    </label>
                  ))}
                </div>
                <FieldError message={err("checkpoints")} />
              </div>
            ) : null}
          </div>
        )}

        {step === 6 && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm sm:col-span-2">
                <FieldLabel required>Cancellation policy</FieldLabel>
                <textarea
                  className={err("cancelPolicy") ? fieldBad : field}
                  rows={4}
                  value={cancelPolicy}
                  onChange={(e) => setCancelPolicy(e.target.value)}
                />
                <FieldError message={err("cancelPolicy")} />
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Mid-stream cancellation recognizes amounts paid to date as
                  revenue and terminates the contract. Default fee equals PO #1.
                </p>
              </label>
              <div className="text-sm">
                <FieldLabel>Default cancellation fee (from PO #1)</FieldLabel>
                <div className="rounded-md border border-[var(--line)] bg-[#f8fafb] px-3 py-2">
                  <p className="font-semibold tabular-nums text-[var(--ink)]">
                    {formatCurrency(cancelFeeAmount)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Auto-set to match the initial deposit / PO #1
                    {cancelFeePercent > 0
                      ? ` (${cancelFeePercent}% of net).`
                      : "."}{" "}
                    Not editable — change PO #1 to adjust.
                  </p>
                </div>
              </div>
              <label className="text-sm">
                <FieldLabel>Document title</FieldLabel>
                <input
                  className={field}
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                />
              </label>
              <label className="text-sm">
                <FieldLabel>Document URL</FieldLabel>
                <input
                  className={field}
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  placeholder="https://…"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <FieldLabel>Internal notes</FieldLabel>
                <textarea
                  className={field}
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
            </div>

            <div className="rounded-md border border-[var(--line)] bg-[#f8fafb] p-4 text-sm">
              <p className="font-semibold text-[var(--ink)]">Review before create</p>
              <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-[var(--muted)]">Customer</dt>
                  <dd>{customerName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">Event</dt>
                  <dd>{eventName || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">When</dt>
                  <dd>
                    {eventStart
                      ? new Date(eventStart).toLocaleString()
                      : "—"}
                    {eventEnd
                      ? ` → ${new Date(eventEnd).toLocaleString()}`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">Venue</dt>
                  <dd>
                    {[venueName, venueCity].filter(Boolean).join(", ") || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">PM</dt>
                  <dd>{pm || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">Billing</dt>
                  <dd>{BILLING_METHOD_LABEL}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">Value</dt>
                  <dd>
                    Gross {formatCurrency(gross)} · Net {formatCurrency(net)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">
                    Deposit / cancel fee (PO #1)
                  </dt>
                  <dd>
                    {depositRequired
                      ? formatCurrency(depositCalc.amount)
                      : "None"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">
                    Performance obligations
                  </dt>
                  <dd>
                    {requirePos
                      ? `${pos.filter((p) => p.title.trim()).length} defined · ${formatCurrency(poSum)}`
                      : "None (no services)"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">Payments</dt>
                  <dd>
                    {milestones.length} installment
                    {milestones.length === 1 ? "" : "s"} ·{" "}
                    {formatCurrency(scheduleSum)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">Involvement</dt>
                  <dd>{INVOLVEMENT_MODEL_LABELS[involvementModel]}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">After create</dt>
                  <dd>{afterCreateLabel}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-[var(--muted)]">Services</dt>
                  <dd>
                    {catalogServices.length} line
                    {catalogServices.length === 1 ? "" : "s"}
                    {" · "}
                    {deliverables.filter((d) => d.title.trim()).length}{" "}
                    deliverable
                    {deliverables.filter((d) => d.title.trim()).length === 1
                      ? ""
                      : "s"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {error ? (
          <p className="mt-4 text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}

        {!stepValid && showErrors ? (
          <p className="mt-2 text-xs text-[var(--muted)]">
            Complete the required fields above to continue.
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            disabled={step === 0 || pending}
            onClick={back}
            className="rounded-md border border-[var(--line)] px-4 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Back
          </button>
          <div className="flex items-center gap-3">
            {!stepValid ? (
              <span className="hidden text-xs text-[var(--muted)] sm:inline">
                Required fields incomplete
              </span>
            ) : null}
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={next}
                disabled={!stepValid}
                className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                disabled={pending || !stepValid}
                onClick={submit}
                className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createButtonLabel}
              </button>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}
