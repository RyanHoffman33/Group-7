"use client";

export default function ContractsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--danger)]/20 bg-[#fdf6f6] p-6">
      <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
        Something went wrong
      </h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {error.message || "Contracts could not load this view."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-md bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white"
      >
        Try again
      </button>
    </div>
  );
}
