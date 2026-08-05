export default function AccountingDashboardLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-72 rounded bg-[var(--line)]" />
      <div className="h-4 w-96 max-w-full rounded bg-[var(--line)]" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-lg border border-[var(--line)] bg-[var(--surface)]"
          />
        ))}
      </div>
      <div className="h-56 rounded-lg border border-[var(--line)] bg-[var(--surface)]" />
      <div className="grid gap-3 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-48 rounded-lg border border-[var(--line)] bg-[var(--surface)]"
          />
        ))}
      </div>
    </div>
  );
}
