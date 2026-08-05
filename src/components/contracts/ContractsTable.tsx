"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDate, formatLabel } from "@/features/billing/aging";
import type { ContractListRow } from "@/features/contracts/queries";
import {
  STATUS_LABELS,
  depositTone,
  statusTone,
  type ContractStatus,
} from "@/features/contracts/status";
import { Money, StatusPill } from "@/components/billing/ui";

type Props = {
  rows: ContractListRow[];
};

export function ContractsTable({ rows }: Props) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [pm, setPm] = useState("all");
  const [customer, setCustomer] = useState("all");
  const [deposit, setDeposit] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState<"event" | "value" | "number" | "status">(
    "event",
  );
  const [page, setPage] = useState(0);
  const pageSize = 12;

  const managers = useMemo(
    () =>
      [...new Set(rows.map((r) => r.project_manager_label).filter(Boolean))].sort(),
    [rows],
  );
  const customers = useMemo(
    () =>
      [...new Set(rows.map((r) => r.customer_name).filter(Boolean))].sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    let list = [...rows];
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (r) =>
          r.contract_number?.toLowerCase().includes(query) ||
          r.id?.toLowerCase().includes(query) ||
          r.event_name?.toLowerCase().includes(query) ||
          r.customer_name?.toLowerCase().includes(query) ||
          r.project_manager_label?.toLowerCase().includes(query),
      );
    }
    if (status !== "all") list = list.filter((r) => r.status === status);
    if (pm !== "all")
      list = list.filter((r) => r.project_manager_label === pm);
    if (customer !== "all")
      list = list.filter((r) => r.customer_name === customer);
    if (deposit !== "all")
      list = list.filter((r) => r.deposit_status === deposit);
    if (dateFrom) {
      list = list.filter(
        (r) => r.event_start && r.event_start.slice(0, 10) >= dateFrom,
      );
    }
    if (dateTo) {
      list = list.filter(
        (r) => r.event_start && r.event_start.slice(0, 10) <= dateTo,
      );
    }
    list.sort((a, b) => {
      if (sort === "value")
        return Number(b.contract_value) - Number(a.contract_value);
      if (sort === "number")
        return (a.contract_number ?? "").localeCompare(b.contract_number ?? "");
      if (sort === "status") return a.status.localeCompare(b.status);
      const ae = a.event_start ?? "";
      const be = b.event_start ?? "";
      return ae.localeCompare(be);
    });
    return list;
  }, [rows, q, status, pm, customer, deposit, dateFrom, dateTo, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice(page * pageSize, page * pageSize + pageSize);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-[var(--muted)]">Search</span>
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="Number, event, customer, PM"
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">Status</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
          >
            <option value="all">All</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">Project manager</span>
          <select
            value={pm}
            onChange={(e) => {
              setPm(e.target.value);
              setPage(0);
            }}
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
          >
            <option value="all">All</option>
            {managers.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">Customer</span>
          <select
            value={customer}
            onChange={(e) => {
              setCustomer(e.target.value);
              setPage(0);
            }}
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
          >
            <option value="all">All</option>
            {customers.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">Deposit</span>
          <select
            value={deposit}
            onChange={(e) => {
              setDeposit(e.target.value);
              setPage(0);
            }}
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
          >
            <option value="all">All</option>
            <option value="not_required">Not required</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="satisfied">Satisfied</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">Event from</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(0);
            }}
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">Event to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(0);
            }}
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[var(--muted)]">Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
          >
            <option value="event">Event date</option>
            <option value="value">Revised value</option>
            <option value="number">Contract number</option>
            <option value="status">Status</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] p-10 text-center">
          <p className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
            No contracts match
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Adjust filters or{" "}
            <Link href="/contracts/new" className="text-[var(--accent)]">
              create a contract
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
                <tr className="border-b border-[var(--line)]">
                  <th className="pb-2 font-medium">Contract</th>
                  <th className="pb-2 font-medium">Customer / Event</th>
                  <th className="pb-2 font-medium">Type / Date</th>
                  <th className="pb-2 font-medium">PM</th>
                  <th className="pb-2 font-medium">Original</th>
                  <th className="pb-2 font-medium">Revised</th>
                  <th className="pb-2 font-medium">Billed</th>
                  <th className="pb-2 font-medium">Paid</th>
                  <th className="pb-2 font-medium">Deposit</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Next milestone</th>
                  <th className="pb-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[var(--line)] last:border-0 hover:bg-[#f8fafb]"
                  >
                    <td className="py-3">
                      <Link
                        href={`/contracts/${r.id}`}
                        className="font-semibold text-[var(--accent)]"
                      >
                        {r.contract_number}
                      </Link>
                    </td>
                    <td className="py-3">
                      <div>{r.customer_name}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {r.event_name}
                      </div>
                    </td>
                    <td className="py-3">
                      <div>{formatLabel(r.event_type)}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {formatDate(r.event_start)}
                      </div>
                    </td>
                    <td className="py-3">{r.project_manager_label}</td>
                    <td className="py-3">
                      <Money amount={Number(r.original_contract_value)} />
                    </td>
                    <td className="py-3">
                      <Money amount={Number(r.contract_value)} />
                    </td>
                    <td className="py-3">
                      <Money amount={Number(r.billed_to_date)} />
                    </td>
                    <td className="py-3">
                      <Money amount={Number(r.paid_to_date)} />
                    </td>
                    <td className="py-3">
                      <StatusPill tone={depositTone(r.deposit_status)}>
                        {formatLabel(r.deposit_status)}
                      </StatusPill>
                    </td>
                    <td className="py-3">
                      <StatusPill tone={statusTone(r.status)}>
                        {STATUS_LABELS[r.status as ContractStatus] ?? r.status}
                      </StatusPill>
                    </td>
                    <td className="py-3">
                      <div>{r.next_milestone_label ?? "—"}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {formatDate(r.next_milestone_due)}
                      </div>
                    </td>
                    <td className="py-3 text-xs text-[var(--muted)]">
                      {r.action_hint ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm text-[var(--muted)]">
            <span>
              {filtered.length} contract{filtered.length === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded-md border border-[var(--line)] px-3 py-1.5 disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                Page {page + 1} / {pages}
              </span>
              <button
                type="button"
                disabled={page >= pages - 1}
                onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
                className="rounded-md border border-[var(--line)] px-3 py-1.5 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
