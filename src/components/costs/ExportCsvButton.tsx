"use client";

export function ExportCsvButton({
  rows,
}: {
  rows: Record<string, string | number>[];
}) {
  function download() {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const escape = (v: string | number) => {
      const s = String(v ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n"))
        return `"${s.replaceAll('"', '""')}"`;
      return s;
    };
    const lines = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => escape(r[h] ?? "")).join(",")),
    ];
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cost-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={!rows.length}
      className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--ink)] disabled:opacity-50"
    >
      Export CSV
    </button>
  );
}
