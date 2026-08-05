export default function EmployeeDashboardLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-7 w-56 rounded bg-[var(--line)]" />
      <div className="h-4 w-80 max-w-full rounded bg-[var(--line)]" />
      <div className="h-28 rounded-md border border-[var(--line)] bg-[var(--surface)]" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-48 rounded-md border border-[var(--line)] bg-[var(--surface)]" />
        <div className="h-48 rounded-md border border-[var(--line)] bg-[var(--surface)]" />
      </div>
    </div>
  );
}
