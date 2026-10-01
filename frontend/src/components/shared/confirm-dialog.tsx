"use client";

import { useEffect } from "react";

type Variant = "danger" | "warning" | "default";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  onConfirm: () => void;
  onCancel: () => void;
};

const variantStyles: Record<Variant, { icon: string; confirmBg: string; confirmShadow: string }> = {
  danger: {
    icon: "text-red-500",
    confirmBg: "linear-gradient(135deg, #ef4444, #b91c1c)",
    confirmShadow: "0 4px 14px rgba(239,68,68,0.35)",
  },
  warning: {
    icon: "text-amber-500",
    confirmBg: "linear-gradient(135deg, #f59e0b, #d97706)",
    confirmShadow: "0 4px 14px rgba(245,158,11,0.35)",
  },
  default: {
    icon: "text-[#1ABC9C]",
    confirmBg: "linear-gradient(135deg, #1ABC9C, #16A085)",
    confirmShadow: "0 4px 14px rgba(26, 188, 156,0.35)",
  },
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: Props) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;

  const s = variantStyles[variant];

  const iconPath = variant === "danger"
    ? "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    : variant === "warning"
    ? "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    : "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(13,27,42,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-[0_24px_60px_rgba(13,27,42,0.22)]"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cd-title"
        aria-describedby="cd-message"
      >
        <div className="p-6 pb-5">
          <div className="flex items-start gap-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{
                background: variant === "danger" ? "rgba(239,68,68,0.1)"
                  : variant === "warning" ? "rgba(245,158,11,0.1)"
                  : "rgba(26, 188, 156,0.1)",
              }}
            >
              <svg className={`w-5 h-5 ${s.icon}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
              </svg>
            </div>
            <div className="flex-1">
              <h3 id="cd-title" className="text-base font-black text-[#0D1B2A]">{title}</h3>
              <p id="cd-message" className="mt-1.5 text-sm text-[#64748b] leading-relaxed">{message}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3 border-t border-[#e8edf2] px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-10 rounded-xl border border-[#d9e2ec] text-sm font-semibold text-[#475569] hover:bg-[#f8f9fc] transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 h-10 rounded-xl text-sm font-black text-white transition-all hover:opacity-90"
            style={{ background: s.confirmBg, boxShadow: s.confirmShadow }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
