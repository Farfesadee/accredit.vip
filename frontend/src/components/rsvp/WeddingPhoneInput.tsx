"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { COUNTRIES, flagEmoji } from "@/components/shared/phone-input";

interface WeddingPhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const NIGERIA = COUNTRIES[0];

const digitsOf = (value: string) => (value || "").replace(/\D/g, "");

/** Longest dial code wins, so +1242 (Bahamas) never collapses into +1. */
function detectCountry(value: string) {
  if (!value || !value.startsWith("+")) return null;
  let best = null as { code: string; iso: string; name: string } | null;
  for (const c of COUNTRIES) {
    if (c.code && value.startsWith(c.code) && (!best || c.code.length > best.code.length)) {
      best = c;
    }
  }
  return best;
}

function countryByIso(iso: string) {
  return COUNTRIES.find((c) => c.iso === iso) || NIGERIA;
}

// Two letters and everyday names people actually type, so a guest looking for
// the United Kingdom finds it with "uk" as well as with "44" or "united".
const ALIASES: Record<string, string> = {
  uk: "GB",
  gb: "GB",
  gbr: "GB",
  britain: "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  usa: "US",
  us: "US",
  america: "US",
  uae: "AE",
  emirates: "AE",
  dubai: "AE",
};

/** Ranked search: name (full or partial), ISO code, alias, or dial code. */
function searchCountries(raw: string) {
  const q = raw.trim().toLowerCase();
  if (!q) return COUNTRIES;
  const qDigits = q.replace(/\D/g, "");
  const aliasIso = ALIASES[q];
  const scored: { country: (typeof COUNTRIES)[number]; score: number }[] = [];

  for (const country of COUNTRIES) {
    const name = country.name.toLowerCase();
    const iso = country.iso.toLowerCase();
    const code = country.code.replace(/\D/g, "");
    let score = -1;

    if (aliasIso && country.iso === aliasIso) score = 112;
    else if (iso === q) score = 110;
    else if (qDigits && code === qDigits) score = 100;
    else if (name === q) score = 95;
    else if (name.startsWith(q)) score = 80;
    else if (qDigits && code.startsWith(qDigits)) score = 75;
    else if (iso.startsWith(q)) score = 70;
    else if (name.includes(q)) score = 60;
    else if (qDigits && qDigits.length > 1 && code.includes(qDigits)) score = 40;

    if (score >= 0) scored.push({ country, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.country.iso === NIGERIA.iso) return -1;
    if (b.country.iso === NIGERIA.iso) return 1;
    return a.country.name.localeCompare(b.country.name);
  });
  return scored.map((s) => s.country);
}

// Searchable country-code phone field (wedding styling). Same E.164 contract as
// the shared PhoneInput: the value always carries the dial code prefix.
//
// The earlier version derived the selected country from the value and stripped
// the whole number with /^\+\d+$/ when the country changed, so picking anything
// other than Nigeria wiped the field and snapped the trigger back to +234. A
// guest could therefore never enter a UK number. The selection now lives in its
// own state, the typed digits survive a country change, and a pasted
// international number adopts its own country.
export default function WeddingPhoneInput({ value, onChange, placeholder = "Phone number, required" }: WeddingPhoneInputProps) {
  const [iso, setIso] = useState(() => detectCountry(value)?.iso ?? NIGERIA.iso);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const numberRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const detected = detectCountry(value);
  const picked = countryByIso(iso);
  // A number that arrives from outside (prefill) brings its own dial code.
  const active = detected && detected.code !== picked.code ? detected : picked;

  // Keep the trigger in step with a value set from outside (prefill).
  useEffect(() => {
    const found = detectCountry(value);
    if (found && found.code !== countryByIso(iso).code) setIso(found.iso);
  }, [value, iso]);

  // The panel is fixed-positioned from the trigger's own rectangle, so the card
  // it sits in can never clip it and it flips above when the field is low on a
  // phone screen.
  const place = () => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 6;
    const margin = 10;
    const spaceBelow = window.innerHeight - r.bottom - gap - margin;
    const spaceAbove = r.top - gap - margin;
    const openUp = spaceBelow < 240 && spaceAbove > spaceBelow;
    const width = Math.min(Math.max(r.width + 150, 280), window.innerWidth - margin * 2);
    let left = r.left;
    if (left + width > window.innerWidth - margin) left = window.innerWidth - margin - width;
    if (left < margin) left = margin;
    const available = openUp ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(180, Math.min(available, 340));
    setRect({
      top: openUp ? Math.max(margin, r.top - gap - maxHeight) : r.bottom + gap,
      left,
      width,
      maxHeight,
    });
  };

  const codeDigits = active.code.replace(/\D/g, "");
  const displayValue = value.startsWith(active.code)
    ? digitsOf(value.slice(active.code.length))
    : digitsOf(value);

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // A pasted international number ("+44 7700 900123" or "00447700900123")
    // carries its own country, so adopt it instead of stacking a second code.
    if (/^\s*(\+|00)/.test(raw)) {
      let pasted = digitsOf(raw);
      if (pasted.startsWith("00")) pasted = pasted.slice(2);
      const found = detectCountry(`+${pasted}`);
      if (found) {
        const rest = pasted.slice(digitsOf(found.code).length);
        setIso(found.iso);
        onChange(rest ? `${found.code}${rest}` : "");
        return;
      }
    }
    const typed = digitsOf(raw);
    let num = typed.startsWith(codeDigits) ? typed.slice(codeDigits.length) : typed;
    // A national trunk zero is not part of an international number
    // ("07700 900123" is "+44 7700 900123"). Italy and San Marino keep the zero
    // in E.164, so they are the only exceptions.
    const keepsTrunkZero = active.iso === "IT" || active.iso === "SM";
    if (!keepsTrunkZero && num.startsWith("0")) num = num.replace(/^0+/, "");
    onChange(num ? `${active.code}${num}` : "");
  };

  const handleCodeChange = (nextIso: string) => {
    const next = countryByIso(nextIso);
    // Keep whatever the guest has already typed and simply re-code it.
    const typed = digitsOf(value);
    const previous = active.code.replace(/\D/g, "");
    const local = previous && typed.startsWith(previous) ? typed.slice(previous.length) : typed;
    setIso(next.iso);
    onChange(local ? `${next.code}${local}` : "");
  };

  const results = useMemo(() => searchCountries(query), [query]);

  const openPanel = () => {
    setQuery("");
    setHighlight(0);
    setOpen(true);
  };

  const pickCountry = (nextIso: string) => {
    handleCodeChange(nextIso);
    setOpen(false);
    setQuery("");
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => numberRef.current?.focus({ preventScroll: true }));
    }
  };

  useEffect(() => {
    if (!open) return;
    place();
    const follow = () => place();
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !rect) return;
    const current = document.activeElement;
    if (current && panelRef.current?.contains(current)) return;
    searchRef.current?.focus({ preventScroll: true });
  }, [open, rect]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (target && (wrapRef.current?.contains(target) || panelRef.current?.contains(target))) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const row = listRef.current?.querySelector<HTMLElement>(`[data-row="${highlight}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [highlight, open, results]);

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const chosen = results[highlight];
      if (chosen) pickCountry(chosen.iso);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex rounded-xl border bg-white overflow-hidden h-11" style={{ borderColor: "#e2d5b8" }}>
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openPanel())}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && !open) {
              e.preventDefault();
              openPanel();
            }
          }}
          aria-label="Choose country code"
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex-shrink-0 flex items-center gap-1 pl-3 pr-2 text-sm font-bold border-r cursor-pointer"
          style={{ borderColor: "#e2d5b8", background: "#faf6ec" }}
        >
          <span className="text-base leading-none">{flagEmoji(active.iso)}</span>
          <span>{active.code}</span>
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className={`transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <input
          ref={numberRef}
          type="tel"
          value={displayValue}
          onChange={handleNumberChange}
          placeholder={placeholder}
          className="flex-1 bg-transparent px-3 py-2 text-sm outline-none min-w-0 placeholder:text-stone-400"
        />
      </div>

      {open && rect && (
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            top: rect.top,
            left: rect.left,
            width: rect.width,
            maxHeight: rect.maxHeight,
            borderColor: "#e2d5b8",
          }}
          className="z-[80] flex flex-col overflow-hidden rounded-xl border bg-white shadow-xl"
          role="listbox"
        >
          <div className="p-2 border-b" style={{ borderColor: "#f0e8d5" }}>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              onKeyDown={onSearchKeyDown}
              placeholder="Search country or code"
              className="w-full h-10 rounded-lg bg-stone-50 border border-stone-200 px-3 text-sm outline-none placeholder:text-stone-400"
            />
          </div>
          <div ref={listRef} className="overflow-y-auto py-1">
            {results.length === 0 && <p className="px-4 py-3 text-sm opacity-50">No match found</p>}
            {results.map((c, i) => (
              <button
                key={`${c.iso}-${c.code}`}
                type="button"
                data-row={i}
                onClick={() => pickCountry(c.iso)}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left cursor-pointer ${
                  i === highlight ? "bg-amber-50" : ""
                }`}
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
