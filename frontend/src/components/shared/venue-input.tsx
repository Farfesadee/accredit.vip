"use client";

import { useState, useRef, useEffect } from "react";

export type LocationData = {
  city: string | null;
  state: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  display_name: string;
};

type Suggestion = {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
  };
};

type VenueInputProps = {
  value: string;
  onChange: (value: string) => void;
  onLocationChange?: (loc: LocationData) => void;
  required?: boolean;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
};

export function VenueInput({ value, onChange, onLocationChange, required, className, disabled, placeholder }: VenueInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleChange = (val: string) => {
    onChange(val);
    clearTimeout(timer.current);
    if (val.length < 3) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&limit=5&accept-language=en&addressdetails=1`,
          { headers: { "User-Agent": "AccreditVIP/1.0" } }
        );
        const data: Suggestion[] = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch { setSuggestions([]); }
      setLoading(false);
    }, 400);
  };

  const select = (s: Suggestion) => {
    onChange(s.display_name);
    const addr = s.address || {};
    onLocationChange?.({
      display_name: s.display_name,
      city: addr.city || addr.town || addr.village || null,
      state: addr.state || null,
      country: addr.country || null,
      lat: parseFloat(s.lat) || null,
      lng: parseFloat(s.lon) || null,
    });
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className={className || "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"}
        placeholder={placeholder || "Search for a venue or type manually..."}
        required={required}
        disabled={disabled}
        autoComplete="off"
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
        </div>
      )}
      {open && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-1 z-50 max-h-48 overflow-y-auto rounded-lg border bg-background shadow-lg">
          {suggestions.map((s, i) => (
            <li
              key={i}
              onClick={() => select(s)}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-accent transition-colors border-b last:border-b-0"
            >
              {s.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
