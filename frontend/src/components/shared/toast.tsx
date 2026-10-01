"use client";
import { useEffect, useRef } from "react";
import { CheckCircle, XCircle, X, RotateCcw } from "lucide-react";

type ToastAction = {
  label: string;
  onClick: () => void;
};

type ToastProps = {
  message: string;
  type?: "success" | "error";
  visible: boolean;
  onClose: () => void;
  action?: ToastAction;
  duration?: number;
};

export function Toast({ message, type = "success", visible, onClose, action }: ToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (visible) {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (type === "success") {
        timerRef.current = setTimeout(() => onCloseRef.current(), action ? 8000 : 10000);
      }
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, type, action]);

  if (!visible) return null;

  return (
    <div
      className={`fixed top-20 right-6 z-50 flex items-center gap-3 rounded-xl px-5 py-3 shadow-lg border transition-all duration-300 opacity-100 translate-y-0 ${
        type === "success"
          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
          : "bg-red-50 border-red-200 text-red-800"
      }`}
    >
      {type === "success" ? (
        <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
      ) : (
        <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
      )}
      <span className="text-sm font-medium">{message}</span>
      {action && (
        <button
          onClick={() => { action.onClick(); onClose(); }}
          className="ml-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-200 text-emerald-800 hover:bg-emerald-300 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          {action.label}
        </button>
      )}
      <button onClick={onClose} className="ml-1 flex-shrink-0 opacity-60 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
