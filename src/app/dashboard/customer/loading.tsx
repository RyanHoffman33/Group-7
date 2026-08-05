export default function CustomerDashboardLoading() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-8 w-64 rounded bg-[var(--line)]" />
      <div className="h-4 w-80 max-w-full rounded bg-[var(--line)]" />
      <div className="grid gap-2 lg:grid-cols-[1.7fr_1fr]">
        <div className="h-44 rounded-lg border border-[var(--line)] bg-[var(--surface)]" />
        <div className="h-44 rounded-lg border border-[var(--line)] bg-[var(--surface)]" />
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-40 rounded-lg border border-[var(--line)] bg-[var(--surface)]"
          />
        ))}
      </div>
    </div>
  );
}
