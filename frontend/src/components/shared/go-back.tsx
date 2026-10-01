"use client";

import { useRouter } from "next/navigation";

export function GoBack({ fallback = "/" }: { fallback?: string }) {
  const router = useRouter();

  return (
    <button
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
      className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#d9e2ec] bg-[#0D1B2A] px-4 text-sm font-bold text-white shadow-sm transition-all hover:border-[#1ABC9C] hover:bg-[#13283d] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/30"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
      Back
    </button>
  );
}
