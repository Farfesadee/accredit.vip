export type PassPackage = {
  name: string;
  price: string;
  quantity?: string;
};

export type LineupPerson = {
  role: string;
  name: string;
  attachHeadshot: boolean;
  headshotSource: "upload" | "ai";
  headshotFileName: string;
  generatedHeadshot: boolean;
};

export const timeOptions = Array.from({ length: 48 }, (_, index) => {
  const hour24 = Math.floor(index / 2);
  const minutes = index % 2 === 0 ? "00" : "30";
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return {
    value: `${String(hour24).padStart(2, "0")}:${minutes}`,
    label: `${hour12}:${minutes} ${period}`,
  };
});

export const timezoneOptions = [
  { value: "WAT", label: "NG Lagos, Nigeria (WAT, UTC+1)" },
  { value: "GMT", label: "GH Accra, Ghana (GMT, UTC+0)" },
  { value: "EAT", label: "KE Nairobi, Kenya (EAT, UTC+3)" },
  { value: "SAST", label: "ZA Johannesburg, South Africa (SAST, UTC+2)" },
  { value: "GMT/BST", label: "GB London, United Kingdom (GMT/BST)" },
  { value: "CET", label: "FR Paris, France (CET, UTC+1)" },
  { value: "ET", label: "US New York, United States (ET)" },
  { value: "PT", label: "US Los Angeles, United States (PT)" },
  { value: "GST", label: "AE Dubai, UAE (GST, UTC+4)" },
  { value: "IST", label: "IN Mumbai, India (IST, UTC+5:30)" },
  { value: "SGT", label: "SG Singapore (SGT, UTC+8)" },
  { value: "AEST", label: "AU Sydney, Australia (AEST, UTC+10)" },
];

export const lineupRoleOptions = [
  "Keynote Speaker",
  "Guest Speaker",
  "Panelist",
  "Host",
  "MC",
  "Headliner",
  "Supporting Artiste",
  "DJ",
  "Comedian",
  "Special Guest",
];

export function formatTimeForDisplay(value: string) {
  const normalized = value.slice(0, 5);
  return timeOptions.find((option) => option.value === normalized)?.label || value;
}

export function parseTimeInputTo24Hour(value: string) {
  const trimmed = value.trim();
  const direct = timeOptions.find((option) => option.value === trimmed || option.label.toLowerCase() === trimmed.toLowerCase());
  if (direct) return direct.value;

  const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match) return trimmed;

  let hour = Number(match[1]);
  const minutes = match[2] || "00";
  const period = match[3].toUpperCase();
  if (period === "AM" && hour === 12) hour = 0;
  if (period === "PM" && hour < 12) hour += 12;
  return `${String(hour).padStart(2, "0")}:${minutes}`;
}

export function cleanPassPackages(packages: PassPackage[]) {
  return packages
    .map((item) => ({
      name: item.name.trim(),
      price: item.price.trim(),
      quantity: item.quantity?.trim() || "",
    }))
    .filter((item) => item.name || item.price || item.quantity);
}

export function cleanLineup(lineup: LineupPerson[]) {
  return lineup
    .map((person) => ({
      role: person.role.trim(),
      name: person.name.trim(),
      attach_headshot: person.attachHeadshot,
      headshot_source: person.headshotSource,
      headshot_file_name: person.headshotFileName.trim(),
      generated_headshot: person.generatedHeadshot,
    }))
    .filter((person) => person.role || person.name);
}

import { SUPPORTED_CURRENCIES } from "./currencies";

export const CURRENCIES = SUPPORTED_CURRENCIES.map((c) => ({
  code: c.code,
  symbol: c.symbol,
  label: `${c.name} (${c.symbol})`,
}));

export function getCurrencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol || code;
}
