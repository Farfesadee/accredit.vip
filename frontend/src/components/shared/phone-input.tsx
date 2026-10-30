"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type Country = { code: string; iso: string; name: string };

export function flagEmoji(iso: string): string {
  return String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));
}

// Nigeria first (dominant default), then alphabetical by name.
export const COUNTRIES: Country[] = [
  { code: "+234", iso: "NG", name: "Nigeria" },
  { code: "+93", iso: "AF", name: "Afghanistan" },
  { code: "+355", iso: "AL", name: "Albania" },
  { code: "+213", iso: "DZ", name: "Algeria" },
  { code: "+1684", iso: "AS", name: "American Samoa" },
  { code: "+376", iso: "AD", name: "Andorra" },
  { code: "+244", iso: "AO", name: "Angola" },
  { code: "+1264", iso: "AI", name: "Anguilla" },
  { code: "+1268", iso: "AG", name: "Antigua and Barbuda" },
  { code: "+54", iso: "AR", name: "Argentina" },
  { code: "+374", iso: "AM", name: "Armenia" },
  { code: "+297", iso: "AW", name: "Aruba" },
  { code: "+61", iso: "AU", name: "Australia" },
  { code: "+43", iso: "AT", name: "Austria" },
  { code: "+994", iso: "AZ", name: "Azerbaijan" },
  { code: "+1242", iso: "BS", name: "Bahamas" },
  { code: "+973", iso: "BH", name: "Bahrain" },
  { code: "+880", iso: "BD", name: "Bangladesh" },
  { code: "+1246", iso: "BB", name: "Barbados" },
  { code: "+375", iso: "BY", name: "Belarus" },
  { code: "+32", iso: "BE", name: "Belgium" },
  { code: "+501", iso: "BZ", name: "Belize" },
  { code: "+229", iso: "BJ", name: "Benin" },
  { code: "+1441", iso: "BM", name: "Bermuda" },
  { code: "+975", iso: "BT", name: "Bhutan" },
  { code: "+591", iso: "BO", name: "Bolivia" },
  { code: "+387", iso: "BA", name: "Bosnia and Herzegovina" },
  { code: "+267", iso: "BW", name: "Botswana" },
  { code: "+55", iso: "BR", name: "Brazil" },
  { code: "+673", iso: "BN", name: "Brunei" },
  { code: "+359", iso: "BG", name: "Bulgaria" },
  { code: "+226", iso: "BF", name: "Burkina Faso" },
  { code: "+257", iso: "BI", name: "Burundi" },
  { code: "+855", iso: "KH", name: "Cambodia" },
  { code: "+237", iso: "CM", name: "Cameroon" },
  { code: "+1", iso: "CA", name: "Canada" },
  { code: "+238", iso: "CV", name: "Cape Verde" },
  { code: "+1345", iso: "KY", name: "Cayman Islands" },
  { code: "+236", iso: "CF", name: "Central African Republic" },
  { code: "+235", iso: "TD", name: "Chad" },
  { code: "+56", iso: "CL", name: "Chile" },
  { code: "+86", iso: "CN", name: "China" },
  { code: "+57", iso: "CO", name: "Colombia" },
  { code: "+269", iso: "KM", name: "Comoros" },
  { code: "+242", iso: "CG", name: "Congo" },
  { code: "+243", iso: "CD", name: "DR Congo" },
  { code: "+682", iso: "CK", name: "Cook Islands" },
  { code: "+506", iso: "CR", name: "Costa Rica" },
  { code: "+225", iso: "CI", name: "Côte d'Ivoire" },
  { code: "+385", iso: "HR", name: "Croatia" },
  { code: "+53", iso: "CU", name: "Cuba" },
  { code: "+357", iso: "CY", name: "Cyprus" },
  { code: "+420", iso: "CZ", name: "Czech Republic" },
  { code: "+45", iso: "DK", name: "Denmark" },
  { code: "+253", iso: "DJ", name: "Djibouti" },
  { code: "+1767", iso: "DM", name: "Dominica" },
  { code: "+1809", iso: "DO", name: "Dominican Republic" },
  { code: "+593", iso: "EC", name: "Ecuador" },
  { code: "+20", iso: "EG", name: "Egypt" },
  { code: "+503", iso: "SV", name: "El Salvador" },
  { code: "+240", iso: "GQ", name: "Equatorial Guinea" },
  { code: "+291", iso: "ER", name: "Eritrea" },
  { code: "+372", iso: "EE", name: "Estonia" },
  { code: "+268", iso: "SZ", name: "Eswatini" },
  { code: "+251", iso: "ET", name: "Ethiopia" },
  { code: "+500", iso: "FK", name: "Falkland Islands" },
  { code: "+298", iso: "FO", name: "Faroe Islands" },
  { code: "+679", iso: "FJ", name: "Fiji" },
  { code: "+358", iso: "FI", name: "Finland" },
  { code: "+33", iso: "FR", name: "France" },
  { code: "+594", iso: "GF", name: "French Guiana" },
  { code: "+689", iso: "PF", name: "French Polynesia" },
  { code: "+241", iso: "GA", name: "Gabon" },
  { code: "+220", iso: "GM", name: "Gambia" },
  { code: "+995", iso: "GE", name: "Georgia" },
  { code: "+49", iso: "DE", name: "Germany" },
  { code: "+233", iso: "GH", name: "Ghana" },
  { code: "+350", iso: "GI", name: "Gibraltar" },
  { code: "+30", iso: "GR", name: "Greece" },
  { code: "+299", iso: "GL", name: "Greenland" },
  { code: "+1473", iso: "GD", name: "Grenada" },
  { code: "+590", iso: "GP", name: "Guadeloupe" },
  { code: "+1671", iso: "GU", name: "Guam" },
  { code: "+502", iso: "GT", name: "Guatemala" },
  { code: "+224", iso: "GN", name: "Guinea" },
  { code: "+245", iso: "GW", name: "Guinea-Bissau" },
  { code: "+592", iso: "GY", name: "Guyana" },
  { code: "+509", iso: "HT", name: "Haiti" },
  { code: "+504", iso: "HN", name: "Honduras" },
  { code: "+852", iso: "HK", name: "Hong Kong" },
  { code: "+36", iso: "HU", name: "Hungary" },
  { code: "+354", iso: "IS", name: "Iceland" },
  { code: "+91", iso: "IN", name: "India" },
  { code: "+62", iso: "ID", name: "Indonesia" },
  { code: "+98", iso: "IR", name: "Iran" },
  { code: "+964", iso: "IQ", name: "Iraq" },
  { code: "+353", iso: "IE", name: "Ireland" },
  { code: "+972", iso: "IL", name: "Israel" },
  { code: "+39", iso: "IT", name: "Italy" },
  { code: "+1876", iso: "JM", name: "Jamaica" },
  { code: "+81", iso: "JP", name: "Japan" },
  { code: "+962", iso: "JO", name: "Jordan" },
  { code: "+7", iso: "KZ", name: "Kazakhstan" },
  { code: "+254", iso: "KE", name: "Kenya" },
  { code: "+686", iso: "KI", name: "Kiribati" },
  { code: "+850", iso: "KP", name: "North Korea" },
  { code: "+82", iso: "KR", name: "South Korea" },
  { code: "+965", iso: "KW", name: "Kuwait" },
  { code: "+996", iso: "KG", name: "Kyrgyzstan" },
  { code: "+856", iso: "LA", name: "Laos" },
  { code: "+371", iso: "LV", name: "Latvia" },
  { code: "+961", iso: "LB", name: "Lebanon" },
  { code: "+266", iso: "LS", name: "Lesotho" },
  { code: "+231", iso: "LR", name: "Liberia" },
  { code: "+218", iso: "LY", name: "Libya" },
  { code: "+423", iso: "LI", name: "Liechtenstein" },
  { code: "+370", iso: "LT", name: "Lithuania" },
  { code: "+352", iso: "LU", name: "Luxembourg" },
  { code: "+853", iso: "MO", name: "Macau" },
  { code: "+389", iso: "MK", name: "North Macedonia" },
  { code: "+261", iso: "MG", name: "Madagascar" },
  { code: "+265", iso: "MW", name: "Malawi" },
  { code: "+60", iso: "MY", name: "Malaysia" },
  { code: "+960", iso: "MV", name: "Maldives" },
  { code: "+223", iso: "ML", name: "Mali" },
  { code: "+356", iso: "MT", name: "Malta" },
  { code: "+692", iso: "MH", name: "Marshall Islands" },
  { code: "+596", iso: "MQ", name: "Martinique" },
  { code: "+222", iso: "MR", name: "Mauritania" },
  { code: "+230", iso: "MU", name: "Mauritius" },
  { code: "+262", iso: "YT", name: "Mayotte" },
  { code: "+52", iso: "MX", name: "Mexico" },
  { code: "+691", iso: "FM", name: "Micronesia" },
  { code: "+373", iso: "MD", name: "Moldova" },
  { code: "+377", iso: "MC", name: "Monaco" },
  { code: "+976", iso: "MN", name: "Mongolia" },
  { code: "+382", iso: "ME", name: "Montenegro" },
  { code: "+1664", iso: "MS", name: "Montserrat" },
  { code: "+212", iso: "MA", name: "Morocco" },
  { code: "+258", iso: "MZ", name: "Mozambique" },
  { code: "+95", iso: "MM", name: "Myanmar" },
  { code: "+264", iso: "NA", name: "Namibia" },
  { code: "+674", iso: "NR", name: "Nauru" },
  { code: "+977", iso: "NP", name: "Nepal" },
  { code: "+31", iso: "NL", name: "Netherlands" },
  { code: "+687", iso: "NC", name: "New Caledonia" },
  { code: "+64", iso: "NZ", name: "New Zealand" },
  { code: "+505", iso: "NI", name: "Nicaragua" },
  { code: "+227", iso: "NE", name: "Niger" },
  { code: "+1670", iso: "MP", name: "Northern Mariana Islands" },
  { code: "+47", iso: "NO", name: "Norway" },
  { code: "+968", iso: "OM", name: "Oman" },
  { code: "+92", iso: "PK", name: "Pakistan" },
  { code: "+680", iso: "PW", name: "Palau" },
  { code: "+970", iso: "PS", name: "Palestine" },
  { code: "+507", iso: "PA", name: "Panama" },
  { code: "+675", iso: "PG", name: "Papua New Guinea" },
  { code: "+595", iso: "PY", name: "Paraguay" },
  { code: "+51", iso: "PE", name: "Peru" },
  { code: "+63", iso: "PH", name: "Philippines" },
  { code: "+48", iso: "PL", name: "Poland" },
  { code: "+351", iso: "PT", name: "Portugal" },
  { code: "+1787", iso: "PR", name: "Puerto Rico" },
  { code: "+974", iso: "QA", name: "Qatar" },
  { code: "+262", iso: "RE", name: "Réunion" },
  { code: "+40", iso: "RO", name: "Romania" },
  { code: "+7", iso: "RU", name: "Russia" },
  { code: "+250", iso: "RW", name: "Rwanda" },
  { code: "+590", iso: "BL", name: "Saint Barthélemy" },
  { code: "+290", iso: "SH", name: "Saint Helena" },
  { code: "+1869", iso: "KN", name: "Saint Kitts and Nevis" },
  { code: "+1758", iso: "LC", name: "Saint Lucia" },
  { code: "+590", iso: "MF", name: "Saint Martin" },
  { code: "+508", iso: "PM", name: "Saint Pierre and Miquelon" },
  { code: "+1784", iso: "VC", name: "Saint Vincent and the Grenadines" },
  { code: "+685", iso: "WS", name: "Samoa" },
  { code: "+378", iso: "SM", name: "San Marino" },
  { code: "+239", iso: "ST", name: "São Tomé and Príncipe" },
  { code: "+966", iso: "SA", name: "Saudi Arabia" },
  { code: "+221", iso: "SN", name: "Senegal" },
  { code: "+381", iso: "RS", name: "Serbia" },
  { code: "+248", iso: "SC", name: "Seychelles" },
  { code: "+232", iso: "SL", name: "Sierra Leone" },
  { code: "+65", iso: "SG", name: "Singapore" },
  { code: "+1721", iso: "SX", name: "Sint Maarten" },
  { code: "+421", iso: "SK", name: "Slovakia" },
  { code: "+386", iso: "SI", name: "Slovenia" },
  { code: "+677", iso: "SB", name: "Solomon Islands" },
  { code: "+252", iso: "SO", name: "Somalia" },
  { code: "+27", iso: "ZA", name: "South Africa" },
  { code: "+211", iso: "SS", name: "South Sudan" },
  { code: "+34", iso: "ES", name: "Spain" },
  { code: "+94", iso: "LK", name: "Sri Lanka" },
  { code: "+249", iso: "SD", name: "Sudan" },
  { code: "+597", iso: "SR", name: "Suriname" },
  { code: "+46", iso: "SE", name: "Sweden" },
  { code: "+41", iso: "CH", name: "Switzerland" },
  { code: "+963", iso: "SY", name: "Syria" },
  { code: "+886", iso: "TW", name: "Taiwan" },
  { code: "+992", iso: "TJ", name: "Tajikistan" },
  { code: "+255", iso: "TZ", name: "Tanzania" },
  { code: "+66", iso: "TH", name: "Thailand" },
  { code: "+670", iso: "TL", name: "Timor-Leste" },
  { code: "+228", iso: "TG", name: "Togo" },
  { code: "+690", iso: "TK", name: "Tokelau" },
  { code: "+676", iso: "TO", name: "Tonga" },
  { code: "+1868", iso: "TT", name: "Trinidad and Tobago" },
  { code: "+216", iso: "TN", name: "Tunisia" },
  { code: "+90", iso: "TR", name: "Turkey" },
  { code: "+993", iso: "TM", name: "Turkmenistan" },
  { code: "+1649", iso: "TC", name: "Turks and Caicos" },
  { code: "+688", iso: "TV", name: "Tuvalu" },
  { code: "+256", iso: "UG", name: "Uganda" },
  { code: "+380", iso: "UA", name: "Ukraine" },
  { code: "+971", iso: "AE", name: "United Arab Emirates" },
  { code: "+44", iso: "GB", name: "United Kingdom" },
  { code: "+1", iso: "US", name: "United States" },
  { code: "+598", iso: "UY", name: "Uruguay" },
  { code: "+998", iso: "UZ", name: "Uzbekistan" },
  { code: "+678", iso: "VU", name: "Vanuatu" },
  { code: "+39", iso: "VA", name: "Vatican City" },
  { code: "+58", iso: "VE", name: "Venezuela" },
  { code: "+84", iso: "VN", name: "Vietnam" },
  { code: "+1284", iso: "VG", name: "British Virgin Islands" },
  { code: "+1340", iso: "VI", name: "U.S. Virgin Islands" },
  { code: "+681", iso: "WF", name: "Wallis and Futuna" },
  { code: "+967", iso: "YE", name: "Yemen" },
  { code: "+260", iso: "ZM", name: "Zambia" },
  { code: "+263", iso: "ZW", name: "Zimbabwe" },
];

const NIGERIA = COUNTRIES[0];

function digitsOf(value: string): string {
  return (value || "").replace(/\D/g, "");
}

/** Longest dial code wins, so +1242 (Bahamas) never collapses into +1. */
function detectCountry(value: string): Country | null {
  if (!value || !value.startsWith("+")) return null;
  let best: Country | null = null;
  for (const c of COUNTRIES) {
    if (c.code && value.startsWith(c.code) && (!best || c.code.length > best.code.length)) {
      best = c;
    }
  }
  return best;
}

function countryByIso(iso: string): Country {
  return COUNTRIES.find((c) => c.iso === iso) || NIGERIA;
}

/**
 * Ranked search for the country picker. A query can be a country name (full or
 * partial), a two letter ISO code, or a dial code with or without the plus
 * ("44", "+44"). Exact dial-code matches come first so typing "44" offers the
 * United Kingdom before every country that merely contains 44.
 */
function searchCountries(raw: string): Country[] {
  const q = raw.trim().toLowerCase();
  if (!q) return COUNTRIES;
  const qDigits = q.replace(/\D/g, "");
  const scored: { country: Country; score: number }[] = [];

  for (const country of COUNTRIES) {
    const name = country.name.toLowerCase();
    const iso = country.iso.toLowerCase();
    const code = country.code.replace(/\D/g, "");
    let score = -1;

    if (iso === q) score = 110;
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
    // Nigeria is the platform default, so it wins any exact tie ("nig" should
    // offer Nigeria before Niger). Everything else stays alphabetical.
    if (a.country.iso === NIGERIA.iso) return -1;
    if (b.country.iso === NIGERIA.iso) return 1;
    return a.country.name.localeCompare(b.country.name);
  });
  return scored.map((s) => s.country);
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  inputClassName?: string;
  /** "md" matches the taller rounded-xl fields used on the public RSVP forms. */
  size?: "sm" | "md";
};

export function PhoneInput({
  value,
  onChange,
  placeholder = "Phone number",
  required,
  className = "",
  inputClassName = "",
  size = "sm",
}: Props) {
  const [iso, setIso] = useState(() => detectCountry(value)?.iso ?? NIGERIA.iso);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [rect, setRect] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const numberRef = useRef<HTMLInputElement>(null);

  // The panel is fixed-positioned from the trigger's own rectangle, so it is
  // never clipped by a card, a modal's overflow or a scrolling table.
  const place = () => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 6;
    const margin = 10;
    const spaceBelow = window.innerHeight - r.bottom - gap - margin;
    const spaceAbove = r.top - gap - margin;
    const openUp = spaceBelow < 240 && spaceAbove > spaceBelow;
    const width = Math.min(Math.max(r.width + 150, 288), window.innerWidth - margin * 2);
    let left = r.left;
    if (left + width > window.innerWidth - margin) left = window.innerWidth - margin - width;
    if (left < margin) left = margin;
    const available = openUp ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(180, Math.min(available, 360));
    setRect({
      top: openUp ? Math.max(margin, r.top - gap - maxHeight) : r.bottom + gap,
      left,
      width,
      maxHeight,
    });
  };

  const detected = detectCountry(value);
  const picked = countryByIso(iso);
  // A number that arrives from outside (prefill, paste, edit form) brings its own
  // dial code, so it wins. Codes are compared, not countries: +1 is shared by the
  // US, Canada and the Caribbean, and the guest's own pick must not be flipped.
  const active = detected && detected.code !== picked.code ? detected : picked;

  // Keep the dropdown in step with a value that was set from outside.
  useEffect(() => {
    const found = detectCountry(value);
    if (found && found.code !== countryByIso(iso).code) setIso(found.iso);
  }, [value, iso]);

  const codeDigits = active.code.replace(/\D/g, "");
  const displayValue = value.startsWith(active.code)
    ? value.slice(active.code.length).replace(/\D/g, "")
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
        const rest = pasted.slice(found.code.replace(/\D/g, "").length);
        setIso(found.iso);
        onChange(rest ? `${found.code}${rest}` : "");
        return;
      }
    }
    const typed = digitsOf(raw);
    const num = typed.startsWith(codeDigits) ? typed.slice(codeDigits.length) : typed;
    onChange(num ? `${active.code}${num}` : "");
  };

  const handleCodeChange = (nextIso: string) => {
    const next = countryByIso(nextIso);
    // Keep whatever the guest has already typed and simply re-code it. The old
    // version stripped the whole value here, which wiped the number and snapped
    // the dropdown back to Nigeria on every change.
    const typed = digitsOf(value);
    const previous = active.code.replace(/\D/g, "");
    const local = previous && typed.startsWith(previous) ? typed.slice(previous.length) : typed;
    setIso(next.iso);
    onChange(local ? `${next.code}${local}` : "");
  };

  // ---- searchable picker -------------------------------------------------
  // A native <select> with 229 options is a scroll marathon on a phone, so the
  // code is a proper combobox: type a country name, a two letter code or the
  // dial code itself.

  const results = useMemo(() => searchCountries(query), [query]);

  const openPanel = () => {
    setQuery("");
    setHighlight(0);
    setOpen(true);
  };

  const pickCountry = (nextIso: string) => {
    handleCodeChange(nextIso);
    setOpen(false);
    // Hand the cursor straight to the number box so picking a country is one
    // action, not two.
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => numberRef.current?.focus({ preventScroll: true }));
    }
  };

  useEffect(() => {
    if (!open) return;
    place();
    const follow = () => place();
    // Capture phase so the panel follows the trigger inside a scrolling modal too.
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    // The search box only exists once the panel has been measured, so this waits
    // for `rect`. The guard keeps a scroll (which re-measures) from stealing focus
    // back while the guest is typing in the number field.
    if (!open || !rect) return;
    const active = document.activeElement;
    if (active && panelRef.current?.contains(active)) return;
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
    // Keep the highlighted row in view while arrowing through the list.
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

  const skin =
    size === "md"
      ? { wrap: "h-12 rounded-xl", trigger: "h-12 rounded-l-xl pl-3 pr-2", input: "rounded-r-xl px-4 py-3" }
      : { wrap: "h-10 rounded-lg", trigger: "h-10 rounded-l-lg pl-2 pr-1.5", input: "rounded-r-lg px-3 py-2" };

  return (
    <div className={`flex border border-slate-200 bg-white ${skin.wrap} ${className}`}>
      <div ref={wrapRef} className="relative flex-shrink-0">
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openPanel())}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && !open) {
              e.preventDefault();
              openPanel();
            }
          }}
          aria-label="Country code"
          aria-haspopup="listbox"
          aria-expanded={open}
          className={`flex items-center gap-1 border-r border-slate-200 bg-slate-50 text-sm text-slate-700 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500 ${skin.trigger}`}
        >
          <span className="text-base leading-none">{flagEmoji(active.iso)}</span>
          <span className="font-medium whitespace-nowrap">{active.code}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {open && rect && (
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: rect.top,
              left: rect.left,
              width: rect.width,
              maxHeight: rect.maxHeight,
            }}
            className="z-[80] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10"
          >
            <div className="flex items-center gap-1.5 border-b border-slate-100 px-2.5 py-2">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="flex-shrink-0 text-slate-400"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path strokeLinecap="round" d="m20 20-3.5-3.5" />
              </svg>
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlight(0);
                }}
                onKeyDown={onSearchKeyDown}
                placeholder="Search country or code"
                aria-label="Search country"
                className="w-full bg-transparent text-[16px] text-slate-800 outline-none placeholder:text-slate-400 sm:text-sm"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setHighlight(0);
                    searchRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="flex-shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-600"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              )}
            </div>

            <div ref={listRef} role="listbox" aria-label="Countries" className="flex-1 overflow-y-auto overscroll-contain py-1">
              {results.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-slate-500">No country matches that.</p>
              )}
              {results.map((c, i) => (
                <button
                  key={c.iso}
                  type="button"
                  data-row={i}
                  role="option"
                  aria-selected={c.iso === active.iso}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pickCountry(c.iso)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                    i === highlight ? "bg-teal-50" : "bg-white"
                  } ${c.iso === active.iso ? "font-semibold text-teal-700" : "text-slate-700"}`}
                >
                  <span className="text-base leading-none">{flagEmoji(c.iso)}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="flex-shrink-0 tabular-nums text-slate-500">{c.code}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <input
        ref={numberRef}
        type="tel"
        value={displayValue}
        onChange={handleNumberChange}
        placeholder={placeholder}
        required={required}
        className={`flex-1 bg-transparent text-sm outline-none min-w-0 ${skin.input} ${inputClassName}`}
      />
    </div>
  );
}
