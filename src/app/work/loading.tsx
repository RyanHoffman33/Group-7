export default function WorkLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-64 rounded bg-[var(--line)]" />
      <div className="grid gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-lg bg-[var(--line)]" />
        ))}
      </div>
      <div className="h-64 rounded-lg bg-[var(--line)]" />
    </div>
  );
}
