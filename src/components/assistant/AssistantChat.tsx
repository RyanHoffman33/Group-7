"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "How much unearned deposit liability do we have?",
  "What’s earned but not yet billed?",
  "Summarize open contracts and A/R",
  "What cost flags need attention?",
];

export function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi — I’m Ask MainEvent. I answer from live app data scoped to your role (contracts, billing, costs, work, engagement, analytics — only what you’re allowed to see). Ask about an ME- contract, A/R, deposits, or costs.",
    },
  ]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    // Keep page content clear of the floating assistant.
    document.documentElement.style.setProperty(
      "--ask-mainevent-pad",
      open ? "24rem" : "5.5rem",
    );
    return () => {
      document.documentElement.style.removeProperty("--ask-mainevent-pad");
    };
  }, [open]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setError(null);
    setInput("");
    const nextHistory = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(nextHistory);
    setPending(true);
    setNotice(null);
    setProvider(null);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: nextHistory
            .filter((m) => m.role === "user" || m.role === "assistant")
            .slice(0, -1),
        }),
      });
      const data = (await res.json()) as {
        reply?: string;
        error?: string;
        provider?: string;
        notice?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Ask MainEvent request failed");
      setProvider(data.provider ?? null);
      setNotice(data.notice ?? null);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply ?? "No reply." },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-end p-4 sm:p-5">
      <div className="pointer-events-auto flex max-w-full flex-col items-end gap-3">
        {open ? (
          <div
            id="mainevent-assistant"
            className="flex h-[min(420px,55vh)] w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl"
          >
            <div className="border-b border-[var(--line)] bg-[var(--ink)] px-4 py-3 text-white">
              <p className="text-sm font-semibold">Ask MainEvent</p>
              <p className="mt-0.5 text-[11px] text-white/60">
                Live Billing, Compliance & Costs
                {provider ? ` · ${provider}` : ""}
              </p>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
              {messages.map((m, i) => (
                <div
                  key={`${i}-${m.role}`}
                  className={`max-w-[92%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "ml-auto bg-[var(--accent)] text-white"
                      : "bg-[#eef2f6] text-[var(--ink)]"
                  }`}
                >
                  {m.content}
                </div>
              ))}
              {pending ? (
                <p className="text-xs text-[var(--muted)]">
                  Looking up live numbers…
                </p>
              ) : null}
              {notice ? (
                <p className="rounded-md bg-[#fff7eb] px-2 py-1.5 text-[11px] text-[var(--warn)]">
                  {notice}
                </p>
              ) : null}
              {error ? (
                <p className="text-xs text-[var(--danger)]">{error}</p>
              ) : null}
              <div ref={endRef} />
            </div>

            <div className="border-t border-[var(--line)] px-3 py-2">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={pending}
                    onClick={() => send(s)}
                    className="rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-[11px] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
                  >
                    {s.length > 42 ? `${s.slice(0, 40)}…` : s}
                  </button>
                ))}
              </div>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(input);
                }}
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about deposits, costs, flags…"
                  disabled={pending}
                  className="min-w-0 flex-1 rounded-md border border-[var(--line)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
                <button
                  type="submit"
                  disabled={pending || !input.trim()}
                  className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="mainevent-assistant"
          className="flex h-12 items-center gap-2 rounded-full bg-[var(--ink)] px-4 text-sm font-semibold text-white shadow-lg transition hover:bg-[#1a2d45]"
        >
          <span aria-hidden className="text-base">
            ◈
          </span>
          {open ? "Close" : "Ask MainEvent"}
        </button>
      </div>
    </div>
  );
}
