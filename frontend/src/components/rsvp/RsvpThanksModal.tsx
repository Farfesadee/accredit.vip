"use client";

import { useEffect } from "react";

/**
 * The one answer a guest who cannot come ever sees: a short, kind note in the
 * page's own palette. It is a modal rather than a screen, so the invitation
 * stays exactly where it was behind it and the guest is never dumped onto a
 * blank "done" page for saying no.
 *
 * Every RSVP surface (the generic register page and each bespoke invitation)
 * uses this, passing its own colours.
 */
export default function RsvpThanksModal({
  open,
  onClose,
  title = "Thank you for your response",
  message = "We appreciate you letting us know. You will be missed, and we hope to see you at a future celebration.",
  accent = "#1ABC9C",
  surface = "#ffffff",
  textColor = "#0D1B2A",
  mutedColor = "#64748b",
  closeLabel = "Close",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  accent?: string;
  surface?: string;
  textColor?: string;
  mutedColor?: string;
  closeLabel?: string;
}) {
  // Hold the page still while the note is up, and let Escape dismiss it.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center px-5 py-8"
      style={{ background: "rgba(8, 8, 14, 0.62)", backdropFilter: "blur(3px)" }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-sm text-center motion-pop"
        style={{
          background: surface,
          boxShadow: "0 30px 80px rgba(0,0,0,0.35)",
          padding: "30px 26px 24px",
        }}
      >
        <span
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: `${accent}1A`, color: accent }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
        <h2
          className="mt-5 font-serif text-xl sm:text-2xl"
          style={{ color: textColor, lineHeight: 1.25 }}
        >
          {title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: mutedColor }}>
          {message}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 inline-flex h-11 w-full items-center justify-center text-[11px] font-semibold uppercase transition-opacity hover:opacity-90"
          style={{ background: accent, color: surface, letterSpacing: "0.18em" }}
        >
          {closeLabel}
        </button>
      </div>
    </div>
  );
}
