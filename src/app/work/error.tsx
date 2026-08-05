"use client";

export default function WorkError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--danger)]/30 bg-[#fdf2f2] p-6">
      <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--danger)]">
        Work module error
      </h2>
      <p className="mt-2 text-sm text-[var(--muted)]">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white"
      >
        Try again
      </button>
    </div>
  );
}
