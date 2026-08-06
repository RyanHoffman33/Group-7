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
type DepositType = "percent" | "fixed";

const STORAGE_KEY = "mainevent-create-contract-draft-v3";

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
    title: "Pricing & Deposit",
    purpose: "Set billing method, contract value, discounts, and deposit.",
  },
  {
    title: "Payment Schedule",
    purpose: "Split the net value into payment due dates. Totals must match.",
  },
  {
    title: "Performance Obligations",
    purpose: "Define how the contract is completed and billed under ASC 606.",
  },
  {
    title: "Approvals & Involvement",
    purpose: "Who prepares this, and how the customer stays involved.",
  },
  {
    title: "Terms & Review",
    purpose: "Cancellation terms, optional documents, then confirm everything.",
  },
];

/** UI label → stored billing_method value (existing enum). */
const BILLING_METHODS: { value: string; label: string }[] = [
  { value: "fixed_price", label: "Fixed price" },
  { value: "milestone", label: "Milestone billing" },
  { value: "time_and_materials", label: "Time and materials" },
  { value: "cost_plus", label: "Cost plus" },
  { value: "progress", label: "Custom payment schedule" },
];

const DELIVERABLE_PHASES: { value: string; label: string }[] = [
  { value: "planning", label: "Planning" },
  { value: "execution", label: "Execution" },
  { value: "wrapup", label: "Wrap-up" },
];

const MILESTONE_TYPES: { value: string; label: string }[] = [
  { value: "deposit", label: "Deposit" },
  { value: "progress", label: "Progress" },
  { value: "final", label: "Final" },
  { value: "retainer", label: "Retainer" },
  { value: "other", label: "Other" },
];

function moneyRound(n: number) {
  return Math.round(n * 100) / 100;
}

function billingLabel(value: string) {
  return BILLING_METHODS.find((m) => m.value === value)?.label ?? value;
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

  const [lines, setLines] = useState([
    {
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

  const [billingMethod, setBillingMethod] = useState("fixed_price");
  /** Manual gross override; empty string ⇒ use sum of service lines when available. */
  const [grossOverride, setGrossOverride] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("none");
  const [discountPercentInput, setDiscountPercentInput] = useState("");
  const [discountFixedInput, setDiscountFixedInput] = useState("");
  const [depositRequired, setDepositRequired] = useState(true);
  const [depositType, setDepositType] = useState<DepositType>("percent");
  const [depositPercentInput, setDepositPercentInput] = useState("30");
  const [depositFixedInput, setDepositFixedInput] = useState("");
  const [hydrated, setHydrated] = useState(false);

  const [milestones, setMilestones] = useState([
    {
      milestone_key: "deposit",
      label: "Deposit",
      amount: "",
      due_date: "",
      milestone_type: "deposit",
      sequence_no: 1,
    },
    {
      milestone_key: "final",
      label: "Final payment",
      amount: "",
      due_date: "",
      milestone_type: "final",
      sequence_no: 2,
    },
  ]);

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
  const [definePos, setDefinePos] = useState(true);
  const [pos, setPos] = useState([
    {
      title: "Planning & design",
      description: "",
      completion_definition: "Customer approves planning package as complete.",
      amount: "",
    },
    {
      title: "Event production",
      description: "",
      completion_definition: "Customer confirms event-day delivery.",
      amount: "",
    },
    {
      title: "Wrap-up & closeout",
      description: "",
      completion_definition:
        "Customer accepts final wrap-up and closes engagement.",
      amount: "",
    },
  ]);

  const [cancelPolicy, setCancelPolicy] = useState(
    "Deposit forfeited if canceled within 60 days of the event; sliding scale thereafter.",
  );
  const [cancelFee, setCancelFee] = useState("25");

  const [docTitle, setDocTitle] = useState("Engagement proposal");
  const [docUrl, setDocUrl] = useState("");
  const [notes, setNotes] = useState("");

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

  const depositCalc = useMemo(() => {
    if (!depositRequired) {
      return { percent: 0, amount: 0, fixed: null as number | null };
    }
    if (depositType === "fixed") {
      const amount = moneyRound(Number(depositFixedInput) || 0);
      return { percent: 0, amount, fixed: amount };
    }
    const percent = Number(depositPercentInput) || 0;
    const amount = moneyRound(net * (percent / 100));
    return { percent, amount, fixed: null as number | null };
  }, [
    depositRequired,
    depositType,
    depositFixedInput,
    depositPercentInput,
    net,
  ]);

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
      if (!billingMethod) e.billingMethod = "Select a billing method.";
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
      if (depositRequired) {
        if (depositType === "percent") {
          const p = Number(depositPercentInput);
          if (Number.isNaN(p) || p < 0 || p > 100) {
            e.deposit = "Deposit % must be between 0 and 100.";
          }
        } else {
          const a = Number(depositFixedInput);
          if (Number.isNaN(a) || a < 0) {
            e.deposit = "Deposit cannot be negative.";
          } else if (a > net + 1e-9) {
            e.deposit = "Deposit cannot exceed net value.";
          }
        }
        if (!e.deposit && depositCalc.amount > net + 1e-9) {
          e.deposit = "Deposit cannot exceed net value.";
        }
      }
    }
    if (step === 3) {
      if (!milestones.length) e.schedule = "Add at least one payment.";
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
    if (step === 4 && definePos) {
      const filled = pos.filter((p) => p.title.trim());
      if (!filled.length) {
        e.pos = "Add at least one obligation, or uncheck “Define now”.";
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
      }
      if (filled.length && Math.abs(poSum - net) > 0.01) {
        e.poMatch = `Obligation amounts (${formatCurrency(poSum)}) must equal net (${formatCurrency(net)}).`;
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
    depositType,
    depositPercentInput,
    depositFixedInput,
    depositCalc.amount,
    milestones,
    scheduleSum,
    definePos,
    pos,
    poSum,
    createdBy,
    involvementModel,
    customCheckpoints,
    cancelPolicy,
  ]);

  const stepValid = Object.keys(fieldErrors).length === 0;

  useEffect(() => {
    // Restore create-contract draft from sessionStorage (external system).
    // Intentionally syncs local form state once on mount for Back/Continue + refresh.
    /* eslint-disable react-hooks/set-state-in-effect -- sessionStorage draft hydrate */
    try {
      const raw =
        sessionStorage.getItem(STORAGE_KEY) ??
        sessionStorage.getItem("mainevent-create-contract-draft-v2");
      if (raw) {
        const d = JSON.parse(raw) as Record<string, unknown>;
        if (typeof d.step === "number") {
          // Clamp: v2 had POs on step 3; map old indices if draft is v2-shaped
          const s = d.step as number;
          setStep(Math.min(STEPS.length - 1, Math.max(0, s)));
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
        if (Array.isArray(d.lines)) setLines(d.lines as typeof lines);
        if (Array.isArray(d.deliverables))
          setDeliverables(d.deliverables as typeof deliverables);
        if (typeof d.billingMethod === "string")
          setBillingMethod(d.billingMethod);
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
        if (typeof d.depositRequired === "boolean")
          setDepositRequired(d.depositRequired);
        if (d.depositType === "percent" || d.depositType === "fixed") {
          setDepositType(d.depositType);
        }
        if (typeof d.depositPercentInput === "string")
          setDepositPercentInput(d.depositPercentInput);
        if (typeof d.depositFixedInput === "string")
          setDepositFixedInput(d.depositFixedInput);
        if (Array.isArray(d.milestones))
          setMilestones(d.milestones as typeof milestones);
        if (typeof d.createdBy === "string") setCreatedBy(d.createdBy);
        if (typeof d.submitNow === "boolean") setSubmitNow(d.submitNow);
        if (typeof d.cancelPolicy === "string") setCancelPolicy(d.cancelPolicy);
        if (typeof d.cancelFee === "string") setCancelFee(d.cancelFee);
        if (typeof d.docTitle === "string") setDocTitle(d.docTitle);
        if (typeof d.docUrl === "string") setDocUrl(d.docUrl);
        if (typeof d.notes === "string") setNotes(d.notes);
        if (typeof d.definePos === "boolean") setDefinePos(d.definePos);
        if (Array.isArray(d.pos)) setPos(d.pos as typeof pos);
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
      depositRequired,
      depositType,
      depositPercentInput,
      depositFixedInput,
      milestones,
      createdBy,
      submitNow,
      cancelPolicy,
      cancelFee,
      docTitle,
      docUrl,
      notes,
      definePos,
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
    depositRequired,
    depositType,
    depositPercentInput,
    depositFixedInput,
    milestones,
    createdBy,
    submitNow,
    cancelPolicy,
    cancelFee,
    docTitle,
    docUrl,
    notes,
    definePos,
    pos,
    involvementModel,
    customCheckpoints,
  ]);

  useEffect(() => {
    setShowErrors(false);
    setError(null);
  }, [step]);

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

  function setDepositRequiredSafe(on: boolean) {
    setDepositRequired(on);
    if (!on) {
      setDepositPercentInput("");
      setDepositFixedInput("");
    } else if (depositType === "percent" && !depositPercentInput) {
      setDepositPercentInput("30");
    }
  }

  function setDepositTypeSafe(nextType: DepositType) {
    setDepositType(nextType);
    setDepositPercentInput(nextType === "percent" ? "30" : "");
    setDepositFixedInput("");
  }

  function splitMilestonesFromValue() {
    const v = net;
    if (v <= 0) return;
    const dep = depositRequired ? depositCalc.amount : 0;
    const rest = moneyRound(v - dep);
    setMilestones([
      {
        milestone_key: "deposit",
        label: "Deposit",
        amount: String(dep),
        due_date: eventStart ? eventStart.slice(0, 10) : "",
        milestone_type: "deposit",
        sequence_no: 1,
      },
      {
        milestone_key: "final",
        label: "Final payment",
        amount: String(rest),
        due_date: eventEnd ? eventEnd.slice(0, 10) : "",
        milestone_type: "final",
        sequence_no: 2,
      },
    ]);
  }

  function splitPosFromValue() {
    const v = net;
    if (v <= 0) return;
    const a = moneyRound(v * 0.3);
    const b = moneyRound(v * 0.5);
    const c = moneyRound(v - a - b);
    setPos((prev) => [
      { ...prev[0], amount: String(a) },
      { ...prev[1], amount: String(b) },
      { ...prev[2], amount: String(c) },
    ]);
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
    const poPayload = definePos
      ? pos
          .filter((p) => p.title.trim())
          .map((p) => ({
            title: p.title,
            description: p.description || undefined,
            completion_definition: p.completion_definition,
            amount: Number(p.amount) || 0,
          }))
      : undefined;
    if (definePos && poPayload) {
      const sum = poPayload.reduce((s, p) => s + p.amount, 0);
      if (Math.abs(sum - net) > 0.01) {
        setError(
          `Performance obligation amounts (${formatCurrency(sum)}) must equal net (${formatCurrency(net)}).`,
        );
        return;
      }
      if (
        poPayload.some((p) => !p.completion_definition.trim() || p.amount <= 0)
      ) {
        setError("Each obligation needs completion criteria and an amount > 0.");
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
        billing_method: billingMethod,
        gross_contract_value: gross,
        contract_value: net,
        deposit_required: depositRequired,
        deposit_percent:
          depositRequired && depositType === "percent"
            ? depositCalc.percent
            : 0,
        minimum_deposit_amount:
          depositRequired && depositType === "fixed" ? depositCalc.amount : null,
        discount_amount: discountType === "fixed" ? discountCalc.amount : 0,
        discount_percent:
          discountType === "percent" ? discountCalc.percent : 0,
        cancellation_policy_text: cancelPolicy,
        cancellation_fee_percent: Number(cancelFee) || 0,
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
                Sellable lines. Totals roll into Pricing unless you override.
              </p>
              {lines.map((l, i) => (
                <div
                  key={i}
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
                <label className="block text-sm">
                  <FieldLabel required>Billing method</FieldLabel>
                  <select
                    className={err("billingMethod") ? fieldBad : field}
                    value={billingMethod}
                    onChange={(e) => setBillingMethod(e.target.value)}
                  >
                    {BILLING_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <FieldError message={err("billingMethod")} />
                </label>
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
                  Deposit
                </h3>
                <label className="flex items-start gap-3 rounded-md border border-[var(--line)] bg-white px-3 py-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={depositRequired}
                    onChange={(e) => setDepositRequiredSafe(e.target.checked)}
                  />
                  <span>
                    <span className="font-medium text-[var(--ink)]">
                      Require deposit before work starts
                    </span>
                    <span className="mt-1 block text-xs text-[var(--muted)]">
                      Held until related services are delivered.
                    </span>
                  </span>
                </label>
                {depositRequired ? (
                  <>
                    <label className="block text-sm">
                      <FieldLabel>Deposit type</FieldLabel>
                      <select
                        className={field}
                        value={depositType}
                        onChange={(e) =>
                          setDepositTypeSafe(e.target.value as DepositType)
                        }
                      >
                        <option value="percent">Percentage of net</option>
                        <option value="fixed">Fixed amount</option>
                      </select>
                    </label>
                    {depositType === "percent" ? (
                      <label className="block text-sm">
                        <FieldLabel>Deposit %</FieldLabel>
                        <div className="relative">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            className={`${err("deposit") ? fieldBad : field} pr-10`}
                            value={depositPercentInput}
                            onChange={(e) =>
                              setDepositPercentInput(e.target.value)
                            }
                          />
                          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-[var(--muted)]">
                            %
                          </span>
                        </div>
                        <FieldError message={err("deposit")} />
                      </label>
                    ) : (
                      <label className="block text-sm">
                        <FieldLabel>Deposit amount</FieldLabel>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className={err("deposit") ? fieldBad : field}
                          value={depositFixedInput}
                          onChange={(e) => setDepositFixedInput(e.target.value)}
                          placeholder="0.00"
                        />
                        <FieldError message={err("deposit")} />
                      </label>
                    )}
                    <div className="rounded-md border border-[var(--line)] bg-[#f8fafb] px-3 py-2 text-sm">
                      <span className="text-[var(--muted)]">
                        Deposit required
                      </span>
                      <p className="mt-0.5 font-semibold tabular-nums">
                        {formatCurrency(depositCalc.amount)}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-[var(--muted)]">
                    No deposit required for this engagement.
                  </p>
                )}
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
                    <dt className="text-[var(--muted)]">Deposit</dt>
                    <dd className="tabular-nums">
                      {formatCurrency(depositCalc.amount)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-[var(--line)] pt-2">
                    <dt className="font-semibold">Remaining balance</dt>
                    <dd className="font-semibold tabular-nums">
                      {formatCurrency(remainingBalance)}
                    </dd>
                  </div>
                </dl>
              </div>
            </section>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-[var(--muted)]">
                Scheduled: <strong>{formatCurrency(scheduleSum)}</strong>
                {" · "}
                Net: <strong>{formatCurrency(net)}</strong>
              </p>
              <button
                type="button"
                className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm"
                onClick={splitMilestonesFromValue}
              >
                Auto-split deposit + final
              </button>
            </div>
            {Math.abs(scheduleSum - net) > 0.01 ? (
              <p
                className="rounded-md border border-[#f59e0b]/40 bg-[#fffbeb] px-3 py-2 text-sm text-[#92400e]"
                role="status"
              >
                {err("scheduleMatch") ||
                  `Off by ${formatCurrency(Math.abs(scheduleSum - net))}. Adjust amounts or auto-split.`}
              </p>
            ) : (
              <p className="text-xs text-[var(--ok)]">
                Schedule matches net contract value.
              </p>
            )}
            <FieldError message={err("schedule") || err("depositRow")} />
            {milestones.map((m, i) => (
              <div
                key={i}
                className="mb-1 grid gap-2 rounded-md border border-[var(--line)] p-3 sm:grid-cols-4"
              >
                <label className="text-sm sm:col-span-2">
                  <FieldLabel required>Payment name</FieldLabel>
                  <input
                    className={err(`msLabel${i}`) ? fieldBad : field}
                    value={m.label}
                    onChange={(e) => {
                      const nextM = [...milestones];
                      const label = e.target.value;
                      nextM[i] = {
                        ...m,
                        label,
                        milestone_key: (() => {
                          const keep =
                            m.milestone_key &&
                            ["deposit", "final"].includes(m.milestone_key);
                          if (keep) return m.milestone_key;
                          const slug = label
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, "-")
                            .replace(/^-|-$/g, "");
                          return slug || `ms-${i + 1}`;
                        })(),
                      };
                      setMilestones(nextM);
                    }}
                    placeholder="e.g. Deposit on signing"
                  />
                  <FieldError message={err(`msLabel${i}`)} />
                </label>
                <label className="text-sm">
                  <FieldLabel>Amount</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={field}
                    value={m.amount}
                    onChange={(e) => {
                      const nextM = [...milestones];
                      nextM[i] = { ...m, amount: e.target.value };
                      setMilestones(nextM);
                    }}
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
                  <select
                    className={field}
                    value={m.milestone_type}
                    onChange={(e) => {
                      const nextM = [...milestones];
                      nextM[i] = { ...m, milestone_type: e.target.value };
                      setMilestones(nextM);
                    }}
                  >
                    {MILESTONE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
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
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <label className="flex items-start gap-3 rounded-md border border-[var(--line)] px-3 py-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={definePos}
                onChange={(e) => setDefinePos(e.target.checked)}
              />
              <span>
                <span className="font-medium">Define performance obligations now</span>
                <span className="mt-1 block text-xs text-[var(--muted)]">
                  Each obligation needs a title, what “done” means, and an amount.
                  Amounts must sum to net ({formatCurrency(net)}). You can also
                  add them later on the contract detail page.
                </span>
              </span>
            </label>

            {!definePos ? (
              <p className="rounded-md border border-[var(--line)] bg-[#f8fafb] px-3 py-3 text-sm text-[var(--muted)]">
                Skipping for now. After create, open the contract and use
                Performance Obligations to allocate the net value.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-[var(--muted)]">
                    Allocated: <strong>{formatCurrency(poSum)}</strong>
                    {" · "}
                    Net: <strong>{formatCurrency(net)}</strong>
                  </p>
                  <button
                    type="button"
                    className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm"
                    onClick={splitPosFromValue}
                  >
                    Split 30% / 50% / 20%
                  </button>
                </div>
                {err("pos") || err("poMatch") ? (
                  <p
                    className="rounded-md border border-[var(--danger)]/30 bg-[#fef2f2] px-3 py-2 text-sm text-[var(--danger)]"
                    role="alert"
                  >
                    {err("pos") || err("poMatch")}
                  </p>
                ) : Math.abs(poSum - net) <= 0.01 && poSum > 0 ? (
                  <p className="text-xs text-[var(--ok)]">
                    Obligation amounts match net contract value.
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
                      },
                    ])
                  }
                >
                  + Add obligation
                </button>
              </div>
            )}
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
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={submitNow}
                onChange={(e) => setSubmitNow(e.target.checked)}
              />
              Submit for PM approval right after create
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
                  rows={3}
                  value={cancelPolicy}
                  onChange={(e) => setCancelPolicy(e.target.value)}
                />
                <FieldError message={err("cancelPolicy")} />
              </label>
              <label className="text-sm">
                <FieldLabel>Default cancellation fee %</FieldLabel>
                <div className="relative max-w-xs">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className={`${field} pr-10`}
                    value={cancelFee}
                    onChange={(e) => setCancelFee(e.target.value)}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-[var(--muted)]">
                    %
                  </span>
                </div>
              </label>
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
                  <dd>{billingLabel(billingMethod)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">Value</dt>
                  <dd>
                    Gross {formatCurrency(gross)} · Net {formatCurrency(net)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">Deposit</dt>
                  <dd>
                    {depositRequired
                      ? formatCurrency(depositCalc.amount)
                      : "None"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">Payments</dt>
                  <dd>
                    {milestones.length} milestone
                    {milestones.length === 1 ? "" : "s"} ·{" "}
                    {formatCurrency(scheduleSum)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">
                    Performance obligations
                  </dt>
                  <dd>
                    {definePos
                      ? `${pos.filter((p) => p.title.trim()).length} defined · ${formatCurrency(poSum)}`
                      : "Define later on contract"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">Involvement</dt>
                  <dd>{INVOLVEMENT_MODEL_LABELS[involvementModel]}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">After create</dt>
                  <dd>
                    {submitNow ? "Submit for PM approval" : "Save as draft"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-[var(--muted)]">Services</dt>
                  <dd>
                    {lines.filter((l) => l.description.trim()).length} line
                    {lines.filter((l) => l.description.trim()).length === 1
                      ? ""
                      : "s"}
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
                {pending
                  ? "Saving…"
                  : submitNow
                    ? "Create & submit"
                    : "Create draft"}
              </button>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}
