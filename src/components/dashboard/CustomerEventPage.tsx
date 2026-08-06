"use client";

import { formatDate, formatLabel } from "@/features/billing/aging";
import { Money, Panel } from "@/components/billing/ui";
import { useCustomerPortal } from "@/components/dashboard/CustomerPortalContext";
import { involvementLabel } from "@/components/dashboard/CustomerPortalShell";
import {
  INVOLVEMENT_MODEL_DESCRIPTIONS,
  isInvolvementModel,
} from "@/features/involvement/checkpoints";

const HERO_BY_TYPE: Record<string, { src: string; alt: string }> = {
  corporate_conference: {
    src: "/brand/customer-conference-hero.png?v=2",
    alt: "Conference session in a hotel ballroom",
  },
  holiday_party: {
    src: "/brand/customer-holiday-reception-hero.png?v=1",
    alt: "Holiday reception in a decorated event space",
  },
};

export function CustomerEventPage() {
  const { contract } = useCustomerPortal();

  if (!contract) {
    return (
      <p className="text-sm text-[var(--muted)]">No event linked to your account.</p>
    );
  }

  const hero =
    HERO_BY_TYPE[contract.event_type ?? ""] ??
    HERO_BY_TYPE.corporate_conference;
  const modelDesc = isInvolvementModel(contract.involvement_model)
    ? INVOLVEMENT_MODEL_DESCRIPTIONS[contract.involvement_model]
    : INVOLVEMENT_MODEL_DESCRIPTIONS.collaborative;

  return (
    <div className="flex flex-col gap-3">
      <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
        <div className="relative h-48 w-full sm:h-56">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hero.src}
            alt={hero.alt}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">
              {formatLabel(contract.event_type ?? "event")} ·{" "}
              {formatLabel(contract.status)}
            </p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl text-white sm:text-3xl">
              {contract.event_name}
            </h2>
          </div>
        </div>
        <div className="p-4 sm:p-5">
          {contract.notes ? (
            <p className="text-sm text-[var(--muted)]">{contract.notes}</p>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Your MainEvent engagement details for contract{" "}
              {contract.contract_number}.
            </p>
          )}
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[var(--muted)]">
                Date
              </dt>
              <dd className="font-medium">{formatDate(contract.event_start)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[var(--muted)]">
                Guests
              </dt>
              <dd className="font-medium">
                {contract.guest_count != null ? contract.guest_count : "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[11px] uppercase tracking-wide text-[var(--muted)]">
                Venue
              </dt>
              <dd className="font-medium">{contract.venue_name ?? "TBD"}</dd>
              <dd className="text-[13px] text-[var(--muted)]">
                {contract.venue_city ?? ""}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[var(--muted)]">
                Contract #
              </dt>
              <dd className="font-medium">{contract.contract_number}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[var(--muted)]">
                Contract value
              </dt>
              <dd className="font-medium">
                <Money amount={contract.contract_value} />
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <Panel title="Your involvement model" bodyClassName="px-4 py-3">
        <p className="font-semibold">
          {involvementLabel(contract.involvement_model)}
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">{modelDesc}</p>
      </Panel>

      <Panel title="Your event contact" bodyClassName="px-4 py-3">
        <p className="font-semibold">{contract.project_manager_label}</p>
        <p className="text-sm text-[var(--muted)]">Project Manager</p>
        <a
          href="mailto:emily.gray@mainevent.example"
          className="mt-2 block text-sm font-medium text-[var(--accent)] hover:underline"
        >
          Contact via your MainEvent manager
        </a>
      </Panel>
    </div>
  );
}
