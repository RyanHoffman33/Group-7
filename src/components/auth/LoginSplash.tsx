"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Full-screen brand moment on the login route. Click (or Enter/Space/Escape)
 * dismisses it so the sign-in form is revealed.
 */
export function LoginSplash() {
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);

  const dismiss = useCallback(() => {
    if (exiting || !visible) return;
    setExiting(true);
    window.setTimeout(() => setVisible(false), 320);
  }, [exiting, visible]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
        e.preventDefault();
        dismiss();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, dismiss]);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="Continue to sign in"
      onClick={dismiss}
      className={`fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center border-0 bg-[var(--ink)] px-6 text-center outline-none transition-opacity duration-300 ${
        exiting ? "opacity-0" : "opacity-100"
      }`}
    >
      <div
        className={`login-splash-brand flex flex-col items-center gap-6 transition duration-500 ${
          exiting
            ? "translate-y-2 scale-[0.98] opacity-0"
            : "translate-y-0 scale-100 opacity-100"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/mainevent-mark.png?v=5"
          alt=""
          width={200}
          height={140}
          className="h-28 w-auto max-w-[min(80vw,280px)] object-contain sm:h-36"
        />
        <div>
          <p className="font-[family-name:var(--font-display)] text-4xl tracking-[-0.03em] text-white sm:text-5xl">
            MainEvent
          </p>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
            Contract to Cash
          </p>
        </div>
        <p className="mt-8 text-sm text-white/40">Click anywhere to continue</p>
      </div>
    </button>
  );
}
