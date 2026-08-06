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

const STORAGE_KEY = "mainevent-create-contract-draft-v2";

const STEPS = [
  "Customer & Event",
  "Services & Deliverables",
  "Financial Terms",
  "Payment Schedule",
  "Approvals",
  "Cancellation",
  "Documents & Review",
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

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1 block text-xs font-medium text-[var(--muted)]">
      {children}
    </span>
  );
}

export function CreateContractWizard({ customers }: { customers: Customer[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    // Restore create-contract draft from sessionStorage (external system).
    // Intentionally syncs local form state once on mount for Back/Continue + refresh.
    /* eslint-disable react-hooks/set-state-in-effect -- sessionStorage draft hydrate */
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Record<string, unknown>;
        if (typeof d.step === "number") setStep(d.step as number);
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
  ]);

  function validateFinancialTerms(): string | null {
    if (!billingMethod) return "Select a billing method.";
    if (gross <= 0) return "Gross contract value must be greater than zero.";
    if (discountType === "percent") {
      const p = Number(discountPercentInput);
      if (Number.isNaN(p) || p < 0 || p > 100) {
        return "Percentage discount must be between 0% and 100%.";
      }
    }
    if (discountType === "fixed") {
      const a = Number(discountFixedInput);
      if (Number.isNaN(a) || a < 0) {
        return "Fixed discount amount cannot be negative.";
      }
      if (a > gross + 1e-9) {
        return "The discount cannot exceed the gross contract value.";
      }
    }
    if (net <= 0) {
      return "Net contract value must be greater than zero.";
    }
    if (depositRequired) {
      if (depositType === "percent") {
        const p = Number(depositPercentInput);
        if (Number.isNaN(p) || p < 0 || p > 100) {
          return "Deposit percentage must be between 0% and 100%.";
        }
      } else {
        const a = Number(depositFixedInput);
        if (Number.isNaN(a) || a < 0) {
          return "Fixed deposit amount cannot be negative.";
        }
        if (a > net + 1e-9) {
          return "The required deposit cannot exceed the net contract value.";
        }
      }
      if (depositCalc.amount > net + 1e-9) {
        return "The required deposit cannot exceed the net contract value.";
      }
    }
    return null;
  }

  function validateStep(): string | null {
    if (step === 0) {
      if (!customerId) return "Select a customer.";
      if (!eventName.trim()) return "Event name is required.";
      if (!eventStart) return "Event start is required.";
      if (!pm.trim()) return "Project manager is required.";
    }
    if (step === 1) {
      if (
        !lines.some((l) => l.description.trim()) &&
        !deliverables.some((d) => d.title.trim())
      ) {
        return "Add at least one service line or deliverable.";
      }
    }
    if (step === 2) {
      return validateFinancialTerms();
    }
    if (step === 3) {
      if (!milestones.length) return "Add payment milestones.";
      if (
        depositRequired &&
        milestones.some(
          (m) =>
            m.milestone_type === "deposit" && !(Number(m.amount) > 0),
        )
      ) {
        return "Deposit payment rows must be greater than $0 when a deposit is required.";
      }
      if (Math.abs(scheduleSum - net) > 0.01) {
        return `Schedule total (${formatCurrency(scheduleSum)}) must equal net contract value (${formatCurrency(net)}).`;
      }
    }
    if (step === 4) {
      if (!createdBy.trim()) return "Prepared-by name is required.";
    }
    if (step === 5) {
      if (!cancelPolicy.trim()) return "Cancellation terms are required.";
    }
    return null;
  }

  function next() {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  function setDiscountTypeSafe(next: DiscountType) {
    setDiscountType(next);
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

  function setDepositTypeSafe(next: DepositType) {
    setDepositType(next);
    setDepositPercentInput(next === "percent" ? "30" : "");
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

  function submit() {
    const err =
      validateStep() ||
      (!cancelPolicy.trim() ? "Cancellation terms are required." : null);
    if (err) {
      setError(err);
      return;
    }
    if (Math.abs(scheduleSum - net) > 0.01) {
      setError(
        `Payment schedule total (${scheduleSum}) must equal net contract value (${net}).`,
      );
      return;
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
        deposit_percent: depositRequired && depositType === "percent"
          ? depositCalc.percent
          : 0,
        minimum_deposit_amount:
          depositRequired && depositType === "fixed" ? depositCalc.amount : null,
        discount_amount:
          discountType === "fixed" ? discountCalc.amount : 0,
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
      } catch {
        /* ignore */
      }
      router.push(`/contracts/${result.id}`);
      router.refresh();
    });
  }

  const field =
    "w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm";

  return (
    <div className="space-y-4">
      <ol className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              i === step
                ? "bg-[var(--accent)] text-white"
                : i < step
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "bg-[#eef2f6] text-[var(--muted)]"
            }`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      <Panel title={STEPS[step]}>
        {step === 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              <FieldLabel>Customer *</FieldLabel>
              <select
                className={field}
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-[var(--muted)]">
                Select an existing customer, or use Create new customer above.
              </span>
            </label>
            <label className="text-sm sm:col-span-2">
              <FieldLabel>Event name *</FieldLabel>
              <input
                className={field}
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="e.g. Spring Product Showcase"
              />
              <span className="mt-1 block text-xs text-[var(--muted)]">
                One contract = one event (engagement on the contract row).
              </span>
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
              <FieldLabel>Add new event type</FieldLabel>
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
              <FieldLabel>Project manager *</FieldLabel>
              <input
                className={field}
                value={pm}
                onChange={(e) => setPm(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <FieldLabel>Event start *</FieldLabel>
              <input
                type="datetime-local"
                className={field}
                value={eventStart}
                onChange={(e) => setEventStart(e.target.value)}
              />
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
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-semibold">Services & packages</p>
              <p className="mb-3 text-xs text-[var(--muted)]">
                Enter each sellable service. Line total updates from quantity ×
                unit price. Contract-level discounts are set under Financial
                Terms.
              </p>
              {lines.map((l, i) => (
                <div
                  key={i}
                  className="mb-3 grid gap-2 rounded-md border border-[var(--line)] p-3 sm:grid-cols-4"
                >
                  <label className="text-sm sm:col-span-2">
                    <FieldLabel>Service name / description</FieldLabel>
                    <input
                      className={field}
                      value={l.description}
                      onChange={(e) => {
                        const next = [...lines];
                        next[i] = { ...l, description: e.target.value };
                        setLines(next);
                      }}
                      placeholder="e.g. Full-day AV package"
                    />
                  </label>
                  <label className="text-sm">
                    <FieldLabel>Quantity</FieldLabel>
                    <input
                      type="number"
                      min={0}
                      className={field}
                      value={l.quantity}
                      onChange={(e) => {
                        const next = [...lines];
                        const qty = Number(e.target.value);
                        next[i] = {
                          ...l,
                          quantity: qty,
                          amount: qty * l.unit_rate,
                        };
                        setLines(next);
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
                        const next = [...lines];
                        const unit_rate = Number(e.target.value);
                        next[i] = {
                          ...l,
                          unit_rate,
                          amount: l.quantity * unit_rate,
                        };
                        setLines(next);
                      }}
                    />
                  </label>
                  <label className="text-sm sm:col-span-2">
                    <FieldLabel>Line total (calculated)</FieldLabel>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={field}
                      value={l.amount}
                      onChange={(e) => {
                        const next = [...lines];
                        next[i] = { ...l, amount: Number(e.target.value) };
                        setLines(next);
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
              <p className="mb-2 text-sm font-semibold">
                Contractual deliverables
              </p>
              <p className="mb-3 text-xs text-[var(--muted)]">
                What must be delivered for this engagement. Reference codes are
                assigned automatically.
              </p>
              {deliverables.map((d, i) => (
                <div key={i} className="mb-3 grid gap-2 sm:grid-cols-3">
                  <label className="text-sm">
                    <FieldLabel>Deliverable name</FieldLabel>
                    <input
                      className={field}
                      value={d.title}
                      onChange={(e) => {
                        const next = [...deliverables];
                        next[i] = {
                          ...d,
                          title: e.target.value,
                          code:
                            d.code && d.code !== `DLV-${i + 1}`
                              ? d.code
                              : `DLV-${i + 1}`,
                        };
                        setDeliverables(next);
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
                        const next = [...deliverables];
                        next[i] = { ...d, description: e.target.value };
                        setDeliverables(next);
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
                        const next = [...deliverables];
                        next[i] = { ...d, phase: e.target.value };
                        setDeliverables(next);
                      }}
                    >
                      {DELIVERABLE_PHASES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-xs text-[var(--muted)] sm:col-span-3">
                    Reference code {d.code || `DLV-${i + 1}`} is assigned
                    automatically.
                  </p>
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
              {/* Section 1 */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-[var(--ink)]">
                  Contract pricing
                </h3>
                <label className="block text-sm">
                  <FieldLabel>Billing method</FieldLabel>
                  <select
                    className={field}
                    value={billingMethod}
                    onChange={(e) => setBillingMethod(e.target.value)}
                  >
                    {BILLING_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <FieldLabel>Gross contract value</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={field}
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
                  <span className="mt-1 block text-xs text-[var(--muted)]">
                    {linesGross > 0
                      ? `Defaults from service lines (${formatCurrency(linesGross)}). Edit to override.`
                      : "Enter gross value, or set amounts on Scope & Services lines."}
                  </span>
                </label>
                <label className="block text-sm">
                  <FieldLabel>Discount type</FieldLabel>
                  <select
                    className={field}
                    value={discountType}
                    onChange={(e) =>
                      setDiscountTypeSafe(e.target.value as DiscountType)
                    }
                  >
                    <option value="none">No discount</option>
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
                        className={`${field} pr-10`}
                        value={discountPercentInput}
                        onChange={(e) => setDiscountPercentInput(e.target.value)}
                        placeholder="0"
                        aria-label="Discount percent of gross contract value"
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-[var(--muted)]">
                        %
                      </span>
                    </div>
                    <span className="mt-1 block text-xs text-[var(--muted)]">
                      Percent of gross contract value (0–100).
                    </span>
                  </label>
                ) : null}
                {discountType === "fixed" ? (
                  <label className="block text-sm">
                    <FieldLabel>Fixed discount amount</FieldLabel>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={field}
                      value={discountFixedInput}
                      onChange={(e) => setDiscountFixedInput(e.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                ) : null}
                <div className="rounded-md border border-[var(--line)] bg-[#f8fafb] px-3 py-2 text-sm">
                  <span className="text-[var(--muted)]">Net contract value</span>
                  <p className="mt-0.5 font-semibold tabular-nums">
                    {formatCurrency(net)}
                  </p>
                </div>
              </section>

              {/* Section 2 */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-[var(--ink)]">
                  Deposit requirements
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
                      Deposit required before work begins
                    </span>
                    <span className="mt-1 block text-xs text-[var(--muted)]">
                      Required before work begins. Held until related services
                      are delivered.
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
                        <option value="percent">Percentage</option>
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
                            className={`${field} pr-10`}
                            value={depositPercentInput}
                            onChange={(e) =>
                              setDepositPercentInput(e.target.value)
                            }
                            aria-label="Deposit percent of net contract value"
                          />
                          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-[var(--muted)]">
                            %
                          </span>
                        </div>
                        <span className="mt-1 block text-xs text-[var(--muted)]">
                          Percent of net contract value after discount (0–100).
                        </span>
                      </label>
                    ) : (
                      <label className="block text-sm">
                        <FieldLabel>Deposit amount</FieldLabel>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className={field}
                          value={depositFixedInput}
                          onChange={(e) => setDepositFixedInput(e.target.value)}
                          placeholder="0.00"
                        />
                      </label>
                    )}
                    <div className="rounded-md border border-[var(--line)] bg-[#f8fafb] px-3 py-2 text-sm">
                      <span className="text-[var(--muted)]">
                        Calculated deposit required
                      </span>
                      <p className="mt-0.5 font-semibold tabular-nums">
                        {formatCurrency(depositCalc.amount)}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-[var(--muted)]">
                    No deposit will be required. Work activation is not gated on
                    a customer deposit for this engagement.
                  </p>
                )}
              </section>
            </div>

            {/* Section 3 */}
            <section>
              <h3 className="mb-3 text-sm font-semibold text-[var(--ink)]">
                Financial summary
              </h3>
              <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--muted)]">Gross contract value</dt>
                    <dd className="font-medium tabular-nums">
                      {formatCurrency(gross)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--muted)]">Less: Discount</dt>
                    <dd className="font-medium tabular-nums text-[var(--muted)]">
                      {discountCalc.amount > 0
                        ? `(${formatCurrency(discountCalc.amount)})`
                        : formatCurrency(0)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-[var(--line)] pt-3">
                    <dt className="font-semibold">Net contract value</dt>
                    <dd className="font-semibold tabular-nums">
                      {formatCurrency(net)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--muted)]">Required deposit</dt>
                    <dd className="font-medium tabular-nums">
                      {formatCurrency(depositCalc.amount)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-[var(--line)] pt-3">
                    <dt className="font-semibold">Remaining contract balance</dt>
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
                Scheduled total: <strong>{formatCurrency(scheduleSum)}</strong>{" "}
                · Net contract value: <strong>{formatCurrency(net)}</strong>
              </p>
              <button
                type="button"
                className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm"
                onClick={splitMilestonesFromValue}
              >
                Split deposit + final from value
              </button>
            </div>
            {Math.abs(scheduleSum - net) > 0.01 ? (
              <p
                className="rounded-md border border-[#f59e0b]/40 bg-[#fffbeb] px-3 py-2 text-sm text-[#92400e]"
                role="status"
              >
                Schedule does not match net contract value (
                {formatCurrency(Math.abs(scheduleSum - net))} difference). Adjust
                amounts or use “Split deposit + final from value.”
              </p>
            ) : (
              <p className="text-xs text-[var(--ok)]">
                Schedule totals match the net contract value.
              </p>
            )}
            {milestones.map((m, i) => (
              <div
                key={i}
                className="mb-1 grid gap-2 rounded-md border border-[var(--line)] p-3 sm:grid-cols-4"
              >
                <label className="text-sm sm:col-span-2">
                  <FieldLabel>Milestone name</FieldLabel>
                  <input
                    className={field}
                    value={m.label}
                    onChange={(e) => {
                      const next = [...milestones];
                      const label = e.target.value;
                      next[i] = {
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
                      setMilestones(next);
                    }}
                    placeholder="e.g. Deposit on signing"
                  />
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
                      const next = [...milestones];
                      next[i] = { ...m, amount: e.target.value };
                      setMilestones(next);
                    }}
                  />
                  {m.milestone_type === "deposit" &&
                  Number(m.amount) === 0 &&
                  depositRequired ? (
                    <span className="mt-1 block text-xs text-[var(--danger)]">
                      Deposit rows should not be $0 when a deposit is required.
                    </span>
                  ) : null}
                </label>
                <label className="text-sm">
                  <FieldLabel>Due date</FieldLabel>
                  <input
                    type="date"
                    className={field}
                    value={m.due_date}
                    onChange={(e) => {
                      const next = [...milestones];
                      next[i] = { ...m, due_date: e.target.value };
                      setMilestones(next);
                    }}
                  />
                </label>
                <label className="text-sm sm:col-span-2">
                  <FieldLabel>Billing trigger</FieldLabel>
                  <select
                    className={field}
                    value={m.milestone_type}
                    onChange={(e) => {
                      const next = [...milestones];
                      next[i] = { ...m, milestone_type: e.target.value };
                      setMilestones(next);
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
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <FieldLabel>Prepared by *</FieldLabel>
              <input
                className={field}
                value={createdBy}
                onChange={(e) => setCreatedBy(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={submitNow}
                onChange={(e) => setSubmitNow(e.target.checked)}
              />
              Submit for project manager approval immediately
            </label>
            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-xs font-medium text-[var(--muted)]">
                Customer involvement model
              </legend>
              <div className="space-y-2">
                {(
                  ["collaborative", "full_service", "custom"] as InvolvementModel[]
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
                  Custom required checkpoints
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
              </div>
            ) : null}
            <p className="text-xs text-[var(--muted)] sm:col-span-2">
              Internal contract approval does not recognize revenue. Customer
              involvement controls which planning checkpoints the client must
              approve in their portal.
            </p>
          </div>
        )}

        {step === 5 && (
          <div className="grid gap-3">
            <label className="text-sm">
              <FieldLabel>Cancellation policy *</FieldLabel>
              <textarea
                className={field}
                rows={4}
                value={cancelPolicy}
                onChange={(e) => setCancelPolicy(e.target.value)}
              />
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
                  aria-label="Cancellation fee percent"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-[var(--muted)]">
                  %
                </span>
              </div>
              <span className="mt-1 block text-xs text-[var(--muted)]">
                Default fee as a percent of contract value if canceled (0–100).
              </span>
            </label>
          </div>
        )}

        {step === 6 && (
          <div className="grid gap-3 sm:grid-cols-2">
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
                placeholder="https://..."
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <FieldLabel>Internal notes</FieldLabel>
              <textarea
                className={field}
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <div className="rounded-md border border-[var(--line)] bg-[#f8fafb] p-4 text-sm sm:col-span-2">
              <p className="font-semibold">Review</p>
              <ul className="mt-2 space-y-1 text-[var(--muted)]">
                <li>
                  Customer:{" "}
                  {customers.find((c) => c.id === customerId)?.name ?? "—"}
                </li>
                <li>Event: {eventName || "—"}</li>
                <li>PM: {pm}</li>
                <li>Method: {billingLabel(billingMethod)}</li>
                <li>
                  Gross {formatCurrency(gross)} · Discount{" "}
                  {formatCurrency(discountCalc.amount)} · Net{" "}
                  {formatCurrency(net)}
                </li>
                <li>
                  Deposit:{" "}
                  {depositRequired
                    ? formatCurrency(depositCalc.amount)
                    : "None"}
                </li>
                <li>
                  Submit: {submitNow ? "Yes — pending approval" : "Save as draft"}
                </li>
              </ul>
            </div>
          </div>
        )}

        {error ? (
          <p className="mt-4 text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-between gap-2">
          <button
            type="button"
            disabled={step === 0 || pending}
            onClick={back}
            className="rounded-md border border-[var(--line)] px-4 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={next}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={submit}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending
                ? "Saving…"
                : submitNow
                  ? "Create & submit"
                  : "Create draft"}
            </button>
          )}
        </div>
      </Panel>
    </div>
  );
}
