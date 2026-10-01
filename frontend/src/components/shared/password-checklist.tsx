"use client";

import { useMemo } from "react";
import { Check } from "lucide-react";

type Requirement = {
  label: string;
  met: boolean;
};

const SPECIAL_CHARS = /[!@#$%^&*()_\-+=\[\]{};:'",.<>?/|`~\\]/;

function buildRequirements(password: string): Requirement[] {
  return [
    { label: "At least 12 characters", met: password.length >= 12 },
    { label: "One uppercase letter (A-Z)", met: /[A-Z]/.test(password) },
    { label: "One lowercase letter (a-z)", met: /[a-z]/.test(password) },
    { label: "One number (0-9)", met: /[0-9]/.test(password) },
    { label: "One special character (!@#$%^&*)", met: SPECIAL_CHARS.test(password) },
  ];
}

export function PasswordChecklist({ password }: { password: string }) {
  const requirements = useMemo(() => buildRequirements(password), [password]);
  const metCount = requirements.filter((r) => r.met).length;

  return (
    <div className="mt-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
      <p className="mb-1.5 text-[11px] font-semibold text-gray-500">
        Password requirements <span className="text-gray-400">({metCount}/{requirements.length})</span>
      </p>
      <ul className="grid grid-cols-1 gap-1">
        {requirements.map((req) => (
          <li key={req.label} className="flex items-center gap-1.5 text-[11px] leading-tight">
            <span
              className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full transition-colors ${
                req.met ? "bg-emerald-500" : "bg-gray-300"
              }`}
            >
              <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} />
            </span>
            <span className={req.met ? "text-emerald-600 font-medium" : "text-gray-500"}>{req.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}