"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { COUNTRIES, flagEmoji } from "@/components/shared/phone-input";

interface WeddingPhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// Searchable country-code phone field (wedding styling). Same E.164 contract
// as the shared PhoneInput: value always carries the dial code prefix.
export default function WeddingPhoneInput({ value, onChange, placeholder = "Phone number, required" }: WeddingPhoneInputProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const selected =
    COUNTRIES.find((c) => c.code !== "" && value.startsWith(c.code)) || COUNTRIES[0];

  const displayValue =
    selected && value.startsWith(selected.code) ? value.slice(selected.code.length) : value;

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open ]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open ]);

  const filtered = useMemo(() => {
    const q = query.trim().replace(/\D/g, "");
    const text = query.trim().toLowerCase();
    if (!text) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(text) ||
        c.iso.toLowerCase().includes(text) ||
        (q && c.code.replace(/\D/g, "").startsWith(q))
    );
  }, [query]);

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    const codeDigits = selected.code.replace(/\D/g, "");
    const num = raw.startsWith(codeDigits) ? raw.slice(codeDigits.length) : raw;
    onChange(`${selected.code}${num}`);
  };

  const pickCountry = (code: string) => {
    const country = COUNTRIES.find((c) => c.code === code) || COUNTRIES[0];
    const num = value.replace(/^\+\d+/, "");
    onChange(num ? `${country.code}${num}` : "");
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex rounded-xl border bg-white overflow-hidden h-11" style={{ borderColor: "#e2d5b8" }}>
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setOpen((o) => !o);
          }}
          aria-label="Choose country code"
          className="flex-shrink-0 flex items-center gap-1 pl-3 pr-2 text-sm font-bold border-r"
          style={{ borderColor: "#e2d5b8", background: "#faf6ec" }}
        >
          <span className="text-base leading-none">{flagEmoji(selected.iso)}</span>
          <span>{selected.code}</span>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <input
          type="tel"
          value={displayValue}
          onChange={handleNumberChange}
          placeholder={placeholder}
          className="flex-1 bg-transparent px-3 py-2 text-sm outline-none min-w-0 placeholder:text-stone-400"
        />
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border bg-white shadow-xl overflow-hidden" style={{ borderColor: "#e2d5b8" }}>
          <div className="p-2 border-b" style={{ borderColor: "#f0e8d5" }}>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country or code"
              className="w-full h-10 rounded-lg bg-stone-50 border border-stone-200 px-3 text-sm outline-none placeholder:text-stone-400"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="px-4 py-3 text-sm opacity-50">No match found</p>
            )}
            {filtered.map((c) => (
              <button
                key={`${c.iso}-${c.code}`}
                type="button"
                onClick={() => pickCountry(c.code)}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-amber-50"
              >
                <span className="text-base leading-none w-6">{flagEmoji(c.iso)}</span>
                <span className="flex-1 truncate">{c.name}</span>
                <span className="font-bold opacity-70">{c.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
