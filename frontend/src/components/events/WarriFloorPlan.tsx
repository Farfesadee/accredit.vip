"use client";

/**
 * Warri Again? interactive floor plan.
 *
 * A faithful port of the organiser's standalone plan (Warri_Again_Interactive_
 * Floor_Plan.html): the same nine categories, colours, zone-labelled table
 * numbers, VIP banks, stage and legend, drawn at the same viewBox and the same
 * coordinates. The demo reservation timer is replaced with a real selection
 * that is handed to the ticket panel on the event page.
 *
 * Geometry lives here rather than in the database because the organiser's file
 * is the published artwork. The database supplies availability and the seats
 * already sold, matched by table code.
 *
 * Layout notes:
 * - One markup tree, no duplicated mobile/desktop copies. The map and the
 *   selection panel sit in a grid that stacks on phones (map first) and sits
 *   side by side from lg up. The map is always rendered: it is a horizontally
 *   scrollable canvas on small screens so every table stays legible.
 * - Nothing is preselected. The guest picks the category, the table and the
 *   way they want to buy it.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "@/lib/api-client";

export type FloorPlanSelection = {
  packageName: string;
  mode: "table" | "seat" | "vip";
  tables: string[];
  seats: number[];
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  label: string;
};

type Props = {
  eventId: number;
  packages: { name: string; price: number | string; seats?: number; capacity?: number | null }[];
  currencySymbol: string;
  onReserve: (selection: FloorPlanSelection) => void;
  isOrganizer?: boolean;      // Can manage tables/seats
  isAdmin?: boolean;          // Admin can manage all
};

type ApiTable = {
  id: number;
  table_number: string;
  tier_name: string;
  tier_category: string;
  status: string;
  color: string;
  side?: string | null;
  display_number?: number | null;
  seat_count?: number;
  sold_seats?: number[];
  blocked?: boolean;
};

type Marker = {
  id: string;
  code: string;
  cat: number;
  n: number;
  x: number;
  y: number;
  side: string;
  color: string;
};

const CATS = [
  { name: "Silver Table", color: "#12c9ed", prefix: "SL", enabled: false },
  { name: "Gold Table", color: "#47ed15", prefix: "GL", enabled: false },
  { name: "Premium Gold", color: "#009337", prefix: "PGL", enabled: false },
  { name: "Platinum Star", color: "#ffda48", prefix: "PS", enabled: false },
  { name: "Platinum Legacy", color: "#3465ac", prefix: "PL", enabled: false },
  { name: "Platinum Prime", color: "#956536", prefix: "PPM", enabled: false },
  { name: "Platinum Prestige", color: "#ff9c36", prefix: "PP", enabled: false },
  { name: "Platinum Extreme", color: "#cb3700", prefix: "PE", enabled: false },
  { name: "VIP", color: "#c42d23", prefix: "VIP", enabled: true },
];

/**
 * Category colours, so the ticket panel can print the same swatch the guest
 * sees on the plan next to each tier name.
 */
export const FLOOR_CATEGORY_COLORS: Record<string, string> = CATS.reduce(
  (acc, c) => ({ ...acc, [c.name]: c.color }),
  {} as Record<string, string>,
);

type GroupDef = {
  cat: number;
  side: string;
  start: number;
  prefix: string;
  color?: string;
  points: [number, number][];
};

const GROUPS: GroupDef[] = [
  {
    cat: 0,
    side: "Rear left",
    start: 1,
    prefix: "SL",
    points: [
      [117, 218],
      [159, 206],
      [201, 188],
      [125, 176],
      [166, 158],
      [255, 125],
      [298, 112],
    ],
  },
  {
    cat: 0,
    side: "Lounge",
    start: 1,
    prefix: "SG",
    points: [
      [530, 117],
      [575, 117],
      [620, 117],
      [554, 78],
      [599, 78],
      [390, 97],
      [443, 81],
      [395, 53],
      [458, 32],
      [713, 74],
      [766, 85],
      [748, 45],
    ],
  },
  {
    cat: 0,
    side: "Rear right",
    start: 8,
    prefix: "SR",
    points: [
      [843, 110],
      [886, 122],
      [881, 69],
      [928, 85],
      [944, 180],
      [982, 158],
      [1023, 222],
      [982, 204],
      [1022, 179],
      [1019, 132],
      [1103, 161],
    ],
  },
  {
    cat: 1,
    side: "Left",
    start: 6,
    prefix: "GL",
    points: [
      [31, 498],
      [65, 465],
      [100, 432],
      [133, 401],
      [168, 369],
      [202, 337],
      [44, 407],
      [78, 375],
      [111, 344],
      [146, 311],
      [180, 278],
    ],
  },
  {
    cat: 1,
    side: "Right",
    start: 6,
    prefix: "GR",
    color: "#920092",
    points: [
      [949, 341],
      [982, 373],
      [1017, 405],
      [1052, 437],
      [1085, 469],
      [1119, 500],
    ],
  },
  {
    cat: 1,
    side: "Right",
    start: 12,
    prefix: "GR",
    color: "#920092",
    points: [
      [969, 282],
      [1003, 314],
      [1038, 347],
      [1073, 380],
      [1107, 412],
    ],
  },
  {
    cat: 2,
    side: "Left",
    start: 1,
    prefix: "PGL",
    points: [
      [70, 537],
      [105, 505],
      [139, 474],
      [174, 441],
      [207, 409],
    ],
  },
  {
    cat: 2,
    side: "Right",
    start: 1,
    prefix: "PGR",
    color: "#f000ed",
    points: [
      [942, 407],
      [976, 441],
      [1010, 474],
      [1044, 506],
      [1079, 537],
    ],
  },
];

// Centre banks, exactly as the organiser's file lays them out: five rows of ten
// working outwards from the stage, each row a different platinum tier.
const CENTRE_ORDER = [7, 6, 5, 4, 3];

function buildMarkers(): Marker[] {
  const markers: Marker[] = [];
  for (const group of GROUPS) {
    group.points.forEach(([x, y], i) => {
      const n = group.start + i;
      markers.push({
        id: `${group.prefix}-${n}-${group.side.replace(/\s+/g, "")}`,
        code: `${group.prefix}-${n}`,
        cat: group.cat,
        n,
        x,
        y,
        side: group.side,
        color: group.color || CATS[group.cat].color,
      });
    });
  }
  CENTRE_ORDER.forEach((cat, row) => {
    for (let j = 0; j < 10; j += 1) {
      const n = 1 + 10 * row + j;
      markers.push({
        id: `${CATS[cat].prefix}-${n}`,
        code: `${CATS[cat].prefix}-${n}`,
        cat,
        n,
        x: 360 + 46.6 * j,
        y: 441 - row * 54,
        side: "Centre",
        color: CATS[cat].color,
      });
    }
  });
  return markers;
}

function blockedMarker(cat: number, n: number) {
  if (cat === 7) return true;
  if (cat === 6) return n === 19;
  if (cat === 4) return n === 39;
  if (cat === 5) return n === 29;
  if (cat === 3) return n === 49;
  return n === 3;
}

function inkFor(hex: string) {
  const rgb = (hex.slice(1).match(/../g) || [])
    .map((part) => parseInt(part, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  return luminance > 0.32 ? "#11241e" : "#ffffff";
}

const BLOCKED_SEATS = [4, 8];

const VIP_BANKS: [number, number, number, number][] = [
  [148, 552, 255, 0],
  [698, 552, 255, 0],
  [-98, 302, 215, -45],
  [1040, 150, 215, 45],
];

type TableState = "available" | "partial" | "sold" | "blocked";

export default function WarriFloorPlan({ eventId, packages, currencySymbol, onReserve, isOrganizer = false, isAdmin = false }: Props) {
  const markers = useMemo(buildMarkers, []);
  const [category, setCategory] = useState<number | null>(null);
  const [mode, setMode] = useState<"table" | "seat" | null>(null);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [seats, setSeats] = useState<number[]>([]);
  const [zoom, setZoom] = useState(1);
  const mapScrollRef = useRef<HTMLDivElement | null>(null);
  const mapCardRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  // Each step hands the guest to the next one: the map after a category is
  // chosen, the selection panel after a table is picked. It only moves when the
  // target is not already on screen, so desktop (where the map and the panel
  // sit side by side) never jumps while phones scroll step by step.
  const bringIntoView = (el: HTMLElement | null) => {
    if (typeof window === "undefined" || !el) return;
    const navOffset = 88;
    const { top } = el.getBoundingClientRect();
    if (top >= navOffset && top <= window.innerHeight * 0.45) return;
    window.scrollTo({ top: window.scrollY + top - navOffset, behavior: "smooth" });
  };
  const nextFrame = (el: HTMLElement | null) => {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => bringIntoView(el));
  };
  // The plan is 900 CSS px wide at 1x, wider than a phone. Fit drops the scale
  // until the whole hall is on screen, and + brings the table numbers back up.
  const fitToPlan = () => {
    const width = mapScrollRef.current?.clientWidth || 0;
    if (!width) return;
    const next = Math.min(1, Math.max(0.3, Math.round((width / 900) * 20) / 20));
    setZoom(next);
  };
  const [tables, setTables] = useState<Record<string, ApiTable>>({});
  const [notice, setNotice] = useState("");
  // Management mode (organizer/admin)
  const canManage = isOrganizer || isAdmin;
  const [mgmtMode, setMgmtMode] = useState<"table" | "seat" | null>(null);
  const [mgmtTableId, setMgmtTableId] = useState<number | null>(null);
  const [mgmtSeats, setMgmtSeats] = useState<number[]>([]);
  const [mgmtLoading, setMgmtLoading] = useState(false);
  const [mgmtError, setMgmtError] = useState("");

  const handleTableStatusChange = async (tableIds: number[], status: "available" | "blocked" | "sold") => {
    if (!canManage) return;
    setMgmtLoading(true);
    setMgmtError("");
    try {
      await apiClient(`/tickets/events/${eventId}/tables/status`, {
        method: "PATCH",
        body: { table_ids: tableIds, status },
      });
      // Refresh tables
      const res = await apiClient<{ tables: ApiTable[] }>(`/tickets/events/${eventId}/floor-plan`);
      const map: Record<string, ApiTable> = {};
      for (const table of res.tables || []) map[table.table_number] = table;
      setTables(map);
      setNotice(`${tableIds.length} table(s) marked as ${status}`);
    } catch (err: any) {
      setMgmtError(err.message || "Failed to update table status");
    }
    setMgmtLoading(false);
  };

  const handleSeatStatusChange = async (tableId: number, seatNumbers: number[], status: "available" | "sold") => {
    if (!canManage) return;
    setMgmtLoading(true);
    setMgmtError("");
    try {
      await apiClient(`/tickets/events/${eventId}/seats/status`, {
        method: "PATCH",
        body: { table_id: tableId, seat_numbers: seatNumbers, status },
      });
      // Refresh tables
      const res = await apiClient<{ tables: ApiTable[] }>(`/tickets/events/${eventId}/floor-plan`);
      const map: Record<string, ApiTable> = {};
      for (const table of res.tables || []) map[table.table_number] = table;
      setTables(map);
      setNotice(`${seatNumbers.length} seat(s) on table marked as ${status}`);
    } catch (err: any) {
      setMgmtError(err.message || "Failed to update seat status");
    }
    setMgmtLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    apiClient<{ tables: ApiTable[] }>(`/tickets/events/${eventId}/floor-plan`)
      .then((res) => {
        if (cancelled) return;
        const map: Record<string, ApiTable> = {};
        for (const table of res.tables || []) map[table.table_number] = table;
        setTables(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // Default to "fit" zoom on mount
  useEffect(() => {
    const timer = setTimeout(() => fitToPlan(), 100);
    return () => clearTimeout(timer);
  }, []);

  const cat = category === null ? null : CATS[category];
  const isVip = category === 8;
  // Only VIP is enabled, tables disabled per client request
  const packageForCat = cat ? packages.find((p) => p.name === cat.name) || null : null;
  const packageSeats = Math.max(1, Number(packageForCat?.seats) || 1);
  const packagePrice = Number(packageForCat?.price) || 0;

  const chosen = chosenId ? markers.find((m) => m.id === chosenId) || null : null;
  const chosenTable = chosen ? tables[chosen.code] : undefined;
  const tableSeats = Math.max(1, Number(chosenTable?.seat_count) || packageSeats);
  const soldSeats = new Set<number>(chosenTable?.sold_seats || []);
  // Unavailable seats include blocked (4, 8) and sold - shown in red
  const unavailableSeats = new Set<number>([...BLOCKED_SEATS, ...Array.from(soldSeats)]);

  const reset = (nextCategory?: number | null) => {
    setChosenId(null);
    setSeats([]);
    setMode(null);
    setNotice("");
    if (nextCategory !== undefined) setCategory(nextCategory);
  };

  const pick = (id: string, move = false) => {
    setChosenId(id);
    setSeats([]);
    setMode(null);
    setNotice("");
    // Tapping the map hands the guest straight to the selection panel.
    if (move) nextFrame(panelRef.current);
  };

  const toggleSeat = (seat: number) => {
    if (unavailableSeats.has(seat)) return;
    setSeats((prev) =>
      prev.includes(seat) ? prev.filter((s) => s !== seat) : [...prev, seat].sort((a, b) => a - b),
    );
    setNotice("");
  };

  const tableState = (m: Marker): TableState => {
    if (blockedMarker(m.cat, m.n)) return "blocked";
    const row = tables[m.code];
    if (!row) return "available";
    if (row.status === "available") return "available";
    if (row.status === "partially_sold") return "partial";
    return "sold";
  };

  // A table with some seats taken can still sell the empty ones, but it can no
  // longer be bought whole. That is why availability does not depend on mode.
  const isAvailable = (m: Marker) => {
    const state = tableState(m);
    return state === "available" || state === "partial";
  };

  const priceLabel = (price: number) =>
    price > 0 ? `${currencySymbol}${price.toLocaleString()}` : "Free";

  const chosenState = chosen ? tableState(chosen) : null;

  const reserveLabel = isVip
    ? "Add VIP pass"
    : !mode
    ? "Choose how to buy"
    : "Reserve this table";

  // Nothing is preselected: a table alone is not a choice of how to buy it.
  const reserveDisabled = isVip
    ? false
    : !chosen || !mode || chosenState !== "available";

  const handleReserve = () => {
    if (reserveDisabled) return;
    if (isVip) {
      onReserve({
        packageName: CATS[8].name,
        mode: "vip",
        tables: [],
        seats: [],
        quantity: 1,
        unitPrice: packagePrice,
        totalPrice: packagePrice,
        label: "VIP admission, one guest",
      });
      setNotice("VIP added to the ticket panel. Choose how many passes you need.");
      return;
    }
    if (!chosen) return;
    const label = `${chosen.side} · Table ${chosen.n}`;
    onReserve({
      packageName: cat?.name || "",
      mode: "table",
      tables: [chosen.code],
      seats: [],
      quantity: 1,
      unitPrice: packagePrice,
      totalPrice: packagePrice,
      label: `${label} · Table, ${packageSeats} seats`,
    });
    setNotice(`${label} added to the ticket panel below.`);
  };

  const categoryMarkers = category === null ? [] : markers.filter((m) => m.cat === category);
  const openCount = categoryMarkers.filter(isAvailable).length;
  const accent = cat?.color || "#173935";

  return (
    <section
      id="seating-plan"
      className="scroll-mt-24 overflow-hidden rounded-3xl border border-[#d8dfdb] bg-white"
    >
      {/* Slim header. The event name, date and venue sit in the compact
          masthead above, so this bar only explains what to do here. */}
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1.5 border-b border-[#e6ebe8] bg-[#173935] px-4 py-4 sm:px-6 sm:py-5">
        <div className="min-w-0">
          <h2 className="mt-1 text-xl font-black leading-tight tracking-[-0.02em] text-white sm:text-2xl">
            SELECT TICKET
          </h2>
        </div>
        <p className="max-w-sm text-[12px] font-semibold leading-5 text-white/75 sm:text-[13px]">
          VIP or table — pick your experience.
        </p>
      </header>

      {/* Step 1: category. Starts empty on purpose. */}
      <div className="border-b border-[#e6ebe8] bg-[#f6f8f4] px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
          <fieldset className="flex-1 min-w-0">
            <legend className="flex items-center gap-2 text-[13px] font-black text-[#182e2c] mb-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#173935] text-[11px] font-black text-white">
                1
              </span>
              Ticket category
            </legend>
            <div className="flex flex-wrap gap-2">
              {/* VIP as standalone button */}
              <button
                type="button"
                onClick={() => {
                  reset(8);
                  nextFrame(mapCardRef.current);
                }}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
                  category === 8
                    ? "bg-[#173935] text-white"
                    : "bg-white border border-[#aab8b3] text-[#182e2c] hover:border-[#c42d23] hover:text-[#c42d23]"
                }`}
              >
                <span
                  className="inline-block h-3 w-3 rounded-full border border-[#93a29b]"
                  style={{ background: CATS[8].color }}
                />
                VIP
              </button>
              {/* Other categories in dropdown - disabled for now, only VIP active */}
              <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
                <select
                  id="floor-category"
                  value={category === null || category === 8 ? "" : String(category)}
                  onChange={(e) => {
                    const next = e.target.value === "" ? null : Number(e.target.value);
                    if (next !== 8) { // VIP handled by button
                      reset(next);
                      if (next !== null) nextFrame(mapCardRef.current);
                    }
                  }}
                  disabled={true}
                  className="h-12 w-full rounded-xl border border-[#aab8b3] bg-[#f5f5f5] px-3 text-base font-semibold text-[#999] outline-none appearance-none pr-10"
                >
                  <option value="">Table categories coming soon</option>
                  {CATS.slice(0, 8).map((c, i) => (
                    <option key={c.name} value={i} disabled>
                      {c.name} (unavailable)
                    </option>
                  ))}
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#94a3b8]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                </span>
              </div>
            </div>
            {cat && isVip && (
              <p className="text-[13px] font-semibold leading-5 text-[#46564f] mt-2">
                {packageForCat ? (
                  <>
                    <span className="font-black text-[#182e2c]">{priceLabel(packagePrice)}</span>
                    {packageSeats > 1 ? ` per table of ${packageSeats}` : " per guest"}
                  </>
                ) : (
                  "Price on request"
                )}
              </p>
            )}
          </fieldset>
        </div>
      </div>

      {/* Step 2 and 3: map, then selection. Stacked on phones, side by side on
          desktop. One tree, so both always show the same state. */}
      <div className="grid gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_336px] lg:items-start">
        {/* MAP */}
        <div ref={mapCardRef} className="min-w-0 overflow-hidden rounded-2xl border border-[#e2e8e4] bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-[#eef1ee] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#42544d]">
                Venue map
              </h3>
              {cat && (
                <span className="hidden items-center gap-1.5 rounded-full bg-[#f3f6f3] px-2 py-0.5 text-[11px] font-bold text-[#42544d] sm:inline-flex">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full border border-[#93a29b]"
                    style={{ background: accent }}
                  />
                  {cat.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Zoom out"
                onClick={() => setZoom((z) => Math.max(0.3, Math.round((z - 0.2) * 10) / 10))}
                disabled={zoom <= 0.3}
                className="h-10 w-10 rounded-lg border border-[#aab8b3] bg-white text-lg font-black leading-none text-[#182e2c] transition-colors active:scale-95 disabled:opacity-40 touch-manipulation"
              >
                -
              </button>
              <span className="w-10 text-center text-[12px] font-black tabular-nums text-[#42544d]">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                aria-label="Zoom in"
                onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.2) * 10) / 10))}
                disabled={zoom >= 3}
                className="h-10 w-10 rounded-lg border border-[#aab8b3] bg-white text-lg font-black leading-none text-[#182e2c] transition-colors active:scale-95 disabled:opacity-40 touch-manipulation"
              >
                +
              </button>
              <button
                type="button"
                onClick={fitToPlan}
                className="h-10 rounded-lg border border-[#aab8b3] bg-white px-2.5 text-[11px] font-black uppercase tracking-wider text-[#182e2c] transition-colors active:scale-95 touch-manipulation"
              >
                Fit
              </button>
            </div>
          </div>

          <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-[#f2f4f2] px-3 py-2 text-[11px] font-semibold text-[#55665f]">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full border border-[#93a29b]"
                style={{ background: cat ? accent : "#e0e4e1" }}
              />
              {cat ? "Open in this category" : "Table"}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#8b9a94]">
              <span className="inline-block h-2.5 w-2.5 rounded-full border border-[#c2cbc6] bg-[#e0e4e1]" />
              Other category
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#e53e3e]">
                <span className="inline-block h-2.5 w-2.5 rounded-full border border-[#e53e3e] bg-[#e53e3e]" />
                Unavailable
              </span>
            <span className="inline-flex items-center gap-1.5 text-[#42544d]">
              <span className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-[#172b25]" />
              Selected
            </span>
          </p>

          <div
            ref={mapScrollRef}
            className="overflow-auto overscroll-contain"
            style={{ WebkitOverflowScrolling: "touch", maxHeight: "min(72vh, 640px)" }}
          >
            <svg
              viewBox="-170 -82 1500 870"
              role="img"
              aria-label="Floor plan of the hall with numbered tables around the stage"
              className="block"
              style={{ width: `${zoom * 100}%`, minWidth: `${900 * zoom}px`, height: "auto" }}
            >
              <path
                d="M-135 635 Q-185 100 290 6 Q580 -110 866 2 Q1320 95 1294 635 L1170 706 L1060 601 L100 601 L-30 707Z"
                fill="#f7f8f5"
                stroke="#bfc9c4"
                strokeWidth={5}
              />
              <path d="M285 194H858V470H285Z" fill="#fff" stroke="#d5dcd7" strokeWidth={4} />
              <path d="M505 584 L578 535 L651 584 H804 V707 H353 V584Z" fill="#23423c" />
              <text x={579} y={655} fill="#ffffff" fontSize={38} fontWeight={700} textAnchor="middle">
                STAGE
              </text>
              <text x={576} y={-9} fill="#344640" fontSize={24} fontWeight={700} textAnchor="middle">
                BAR / LOUNGE
              </text>
              <text x={571} y={172} fill="#344640" fontSize={20} fontWeight={700} textAnchor="middle">
                FOH
              </text>

              {/* VIP banks */}
              {VIP_BANKS.map(([x, y, w, angle]) => (
                <g key={`vip-${x}-${y}`} transform={`translate(${x} ${y}) rotate(${angle})`}>
                  <rect width={w} height={53} rx={10} fill={isVip ? "#efb3af" : "#e0e4e1"} />
                  <text
                    x={w / 2}
                    y={34}
                    fontSize={20}
                    fontWeight={700}
                    textAnchor="middle"
                    fill="#344640"
                  >
                    VIP
                  </text>
                </g>
              ))}

              {/* Tables */}
              {markers.map((m) => {
                const state = tableState(m);
                const active = category !== null && m.cat === category;
                const open = state === "available" || state === "partial";
                const selectable = active && open && !mgmtMode; // Disable guest selection in management mode
                // Fill: available/partial = category color, sold/blocked = red, inactive = grey
                const fill = state === "available" || state === "partial" ? m.color : state === "sold" || state === "blocked" ? "#e53e3e" : "#e0e4e1";
                const isChosen = chosenId === m.id;
                const isMgmtChosen = mgmtTableId && mgmtMode === "table" && tables[m.code]?.id === mgmtTableId;
                const name = `${m.side} · Table ${m.n}${
                  state === "blocked" || state === "sold"
                    ? " · Unavailable"
                    : state === "partial"
                    ? " · Seats still open"
                    : ""
                }`;
                return (
                  <g
                    key={m.id}
                    className={(selectable || (canManage && mgmtMode === "table")) ? "cursor-pointer" : undefined}
                    tabIndex={selectable || (canManage && mgmtMode === "table") ? 0 : -1}
                    role={selectable || (canManage && mgmtMode === "table") ? "button" : undefined}
                    aria-label={name}
                    aria-pressed={selectable ? isChosen : canManage && mgmtMode === "table" ? Boolean(isMgmtChosen) : undefined}
                    onClick={() => {
                      if (selectable) pick(m.id, true);
                      else if (canManage && mgmtMode === "table") {
                        const tbl = tables[m.code];
                        if (tbl) setMgmtTableId(tbl.id);
                      }
                    }}
                    onKeyDown={(e) => {
                      if ((selectable || (canManage && mgmtMode === "table")) && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        if (selectable) pick(m.id, true);
                        else if (canManage && mgmtMode === "table") {
                          const tbl = tables[m.code];
                          if (tbl) setMgmtTableId(tbl.id);
                        }
                      }
                    }}
                  >
                    <title>{name}</title>
                    <circle
                      cx={m.x}
                      cy={m.y}
                      r={26}
                      fill="transparent"
                      style={{ pointerEvents: (selectable || (canManage && mgmtMode === "table")) ? "all" : "none" }}
                    />
                    {isChosen && (
                      <circle cx={m.x} cy={m.y} r={24} fill="none" stroke="#172b25" strokeWidth={4} />
                    )}
                    {isMgmtChosen && (
                      <circle cx={m.x} cy={m.y} r={25} fill="none" stroke="#e53e3e" strokeWidth={4} strokeDasharray="6 4" />
                    )}
                    <circle
                      cx={m.x}
                      cy={m.y}
                      r={19}
                      fill={fill}
                      stroke={
                        isChosen ? "#172b25" : isMgmtChosen ? "#e53e3e" : state === "partial" ? "#6b7d75" : open ? "#58645f" : "#c9cfcb"
                      }
                      strokeWidth={isMgmtChosen ? 3 : state === "partial" ? 3 : 2}
                      strokeDasharray={isMgmtChosen ? "6 4" : state === "partial" ? "5 3" : undefined}
                    />
                    <text
                      x={m.x}
                      y={m.y + 7}
                      fontSize={20}
                      fontWeight={700}
                      textAnchor="middle"
                      fill={active ? inkFor(fill) : state === "sold" ? "#ffffff" : "#5c6862"}
                      style={{ pointerEvents: "none" }}
                    >
                      {active && !open ? "x" : m.n}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <p className="border-t border-[#f2f4f2] px-3 py-2 text-[11px] font-semibold text-[#6b7d75]">
            Swipe the map. Tap Fit to see the sitting arrangements.
          </p>
        </div>

        {/* SELECTION PANEL */}
        <aside ref={panelRef} className="min-w-0 rounded-2xl border border-[#e2e8e4] bg-white p-4">
          {/* Management mode for organizer/admin */}
          {canManage && (
            <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-amber-700 font-black text-sm">🔧 Management Mode</span>
                <select
                  value={mgmtMode || ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setMgmtMode((v === "table" || v === "seat") ? v : null);
                    setMgmtTableId(null);
                    setMgmtSeats([]);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-sm font-semibold text-amber-800"
                >
                  <option value="">Select action…</option>
                  <option value="table">Close/Open Tables</option>
                  <option value="seat">Close/Open Seats</option>
                </select>
                {mgmtMode && (
                  <button
                    type="button"
                    onClick={() => { setMgmtMode(null); setMgmtTableId(null); setMgmtSeats([]); }}
                    className="px-2 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-700 text-xs font-bold hover:bg-amber-50"
                  >
                    Exit
                  </button>
                )}
              </div>
              {mgmtMode === "table" && (
                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-amber-800">Click tables on map to select, then choose status:</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={mgmtLoading || !mgmtTableId}
                      onClick={() => handleTableStatusChange(
                        mgmtTableId ? [mgmtTableId] : [],
                        "blocked"
                      )}
                      className="px-3 py-1.5 rounded-lg bg-red-100 text-red-700 font-bold text-xs hover:bg-red-200 disabled:opacity-50"
                    >
                      Mark Selected as Closed (Blocked)
                    </button>
                    <button
                      type="button"
                      disabled={mgmtLoading || !mgmtTableId}
                      onClick={() => handleTableStatusChange(
                        mgmtTableId ? [mgmtTableId] : [],
                        "available"
                      )}
                      className="px-3 py-1.5 rounded-lg bg-green-100 text-green-700 font-bold text-xs hover:bg-green-200 disabled:opacity-50"
                    >
                      Reopen Selected
                    </button>
                    <button
                      type="button"
                      disabled={mgmtLoading || !mgmtTableId}
                      onClick={() => handleTableStatusChange(
                        mgmtTableId ? [mgmtTableId] : [],
                        "sold"
                      )}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 disabled:opacity-50"
                    >
                      Mark as Sold
                    </button>
                  </div>
                  {mgmtTableId && (
                    <p className="text-xs text-amber-600">
                      Selected: Table ID {mgmtTableId} ({tables[Object.keys(tables).find(k => tables[k].id === mgmtTableId) || ""]?.table_number || "?"})
                    </p>
                  )}
                </div>
              )}
              {mgmtMode === "seat" && mgmtTableId && (
                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-amber-800">
                    Click seats on the diagram to select, then choose status:
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={mgmtLoading || mgmtSeats.length === 0}
                      onClick={() => handleSeatStatusChange(mgmtTableId, mgmtSeats, "sold")}
                      className="px-3 py-1.5 rounded-lg bg-red-100 text-red-700 font-bold text-xs hover:bg-red-200 disabled:opacity-50"
                    >
                      Mark {mgmtSeats.length} Seat(s) as Sold
                    </button>
                    <button
                      type="button"
                      disabled={mgmtLoading || mgmtSeats.length === 0}
                      onClick={() => handleSeatStatusChange(mgmtTableId, mgmtSeats, "available")}
                      className="px-3 py-1.5 rounded-lg bg-green-100 text-green-700 font-bold text-xs hover:bg-green-200 disabled:opacity-50"
                    >
                      Reopen {mgmtSeats.length} Seat(s)
                    </button>
                  </div>
                  {mgmtSeats.length > 0 && (
                    <p className="text-xs text-amber-600">
                      Selected seats: {mgmtSeats.join(", ")}
                    </p>
                  )}
                </div>
              )}
              {mgmtError && (
                <p className="text-sm text-red-600 font-semibold">{mgmtError}</p>
              )}
            </div>
          )}
          {category === null ? (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-[13px] font-black text-[#182e2c]">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#173935] text-[11px] font-black text-white">
                  2
                </span>
                Pick a category first
              </p>
              <p className="text-[13px] font-semibold leading-6 text-[#55665f]">
                Every category has its own tables and price. Choose one above and the map will
                highlight the tables you can buy, with their numbers.
              </p>
            </div>
          ) : isVip ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3.5 w-3.5 rounded-full border border-[#93a29b]"
                  style={{ background: accent }}
                />
                <h3 className="text-base font-black text-[#182e2c]">VIP admission</h3>
              </div>
              <p className="text-[13px] font-semibold leading-6 text-[#55665f]">
                VIP is general admission. Add it to proceed to payment.
              </p>
              <button
                type="button"
                onClick={handleReserve}
                className="w-full rounded-xl bg-[#173935] px-4 py-3.5 text-sm font-black text-white transition-colors hover:bg-[#11241e] touch-manipulation"
              >
                {reserveLabel}
              </button>
              <p aria-live="polite" className="text-[12px] font-semibold leading-5 text-[#55665f]">
                {notice}
              </p>
            </div>
          ) : !chosen ? (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-[13px] font-black text-[#182e2c]">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#173935] text-[11px] font-black text-white">
                  2
                </span>
                Choose Ticket
              </p>
              <p className="text-[13px] font-semibold leading-6 text-[#55665f]">
                Tap a coloured table on the map, or pick the number here.
              </p>
              <select
                aria-label="Choose a table"
                value=""
                onChange={(e) => (e.target.value ? pick(e.target.value) : reset())}
                className="h-12 w-full rounded-xl border border-[#aab8b3] bg-white px-3 text-base font-semibold text-[#182e2c] outline-none focus:border-[#173935] touch-manipulation"
              >
                <option value="">Select a table number</option>
                {categoryMarkers
                  .filter(isAvailable)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.side} · Table {m.n}
                    </option>
                  ))}
              </select>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6b7d75]">
                    {chosen.side}
                  </p>
                  <h3 className="text-lg font-black leading-tight text-[#182e2c]">
                    Table {chosen.n}
                  </h3>
                </div>
                <span
                  className="mt-1 inline-block h-4 w-4 flex-shrink-0 rounded-full border border-[#93a29b]"
                  style={{ background: chosen.color }}
                />
              </div>

              {/* Direct table selection - no seat mode */}
              <p className="flex items-center gap-2 text-[13px] font-black text-[#182e2c]">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#173935] text-[11px] font-black text-white">
                  3
                </span>
                Confirm your table
              </p>

              {chosenState === "partial" && (
                <p className="rounded-lg border border-[#f0c36d] bg-[#fffbeb] px-3 py-2 text-[12px] font-bold leading-5 text-[#92400e]">
                  Some seats on this table are already taken, so it cannot be bought whole.
                </p>
              )}

              <div className="grid gap-2">
                <button
                  type="button"
                  disabled={chosenState !== "available"}
                  onClick={handleReserve}
                  className="flex items-center justify-between gap-2 rounded-xl border border-[#173935] bg-[#eef4f1] px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] font-black text-[#182e2c]">Table</span>
                    <span className="block text-[11px] font-semibold text-[#6b7d75]">
                      {packageSeats} seats, one payment
                    </span>
                  </span>
                  <span className="flex-shrink-0 text-[13px] font-black text-[#182e2c]">
                    {priceLabel(packagePrice)}
                  </span>
                </button>
              </div>

              {!isVip && (
                <div>
                  <p className="mb-1 text-[12px] font-semibold leading-5 text-[#55665f]">
                    Seats 4 and 8 are not for sale.
                  </p>
                  <svg
                    viewBox="0 0 250 220"
                    role="group"
                    aria-label={`Seats on table ${chosen.n}`}
                    className="mx-auto w-full max-w-[270px]"
                  >
                    <text
                      x={125}
                      y={116}
                      fontSize={18}
                      fontWeight={700}
                      textAnchor="middle"
                      fill="#344640"
                    >
                      Table {chosen.n}
                    </text>
                    {Array.from({ length: tableSeats }, (_, i) => i + 1).map((n) => {
                      const angle = ((n - 1) * Math.PI) / 5 - Math.PI / 2;
                      const x = 125 + 82 * Math.cos(angle);
                      const y = 110 + 82 * Math.sin(angle);
                      const isSold = soldSeats.has(n);
                      const isBlocked = BLOCKED_SEATS.includes(n);
                      const off = isBlocked;
                      const isMgmtPicked = mgmtMode === "seat" && mgmtSeats.includes(n);
                      // Fill: sold = red, blocked = grey, available = category color
                      const fill = isSold ? "#e53e3e" : off ? "#d1d6d3" : chosen.color;
                      return (
                        <g
                          key={`seat-${n}`}
                          className={(!off && !isSold && !mgmtMode) || (canManage && mgmtMode === "seat") ? "cursor-pointer" : undefined}
                          tabIndex={(!off && !isSold && !mgmtMode) || (canManage && mgmtMode === "seat") ? 0 : -1}
                          role={(!off && !isSold && !mgmtMode) || (canManage && mgmtMode === "seat") ? "button" : undefined}
                          aria-label={`Seat ${n}${isSold ? " sold" : off ? " unavailable" : ""}`}
                          aria-pressed={isMgmtPicked}
                          onClick={() => {
                            if (mgmtMode === "seat" && canManage) {
                              setMgmtSeats(prev => prev.includes(n) ? prev.filter(s => s !== n) : [...prev, n].sort((a,b)=>a-b));
                            }
                          }}
                          onKeyDown={(e) => {
                            if ((canManage && mgmtMode === "seat")) {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                if (mgmtMode === "seat" && canManage) {
                                  setMgmtSeats(prev => prev.includes(n) ? prev.filter(s => s !== n) : [...prev, n].sort((a,b)=>a-b));
                                }
                              }
                            }
                          }}
                        >
                          <title>{isSold ? `Seat ${n} sold` : off ? `Seat ${n} unavailable` : `Seat ${n}`}</title>
                          <circle
                            cx={x}
                            cy={y}
                            r={22}
                            fill="transparent"
                            style={{ pointerEvents: ((!off && !isSold && !mgmtMode) || (canManage && mgmtMode === "seat")) ? "all" : "none" }}
                          />
                          {isMgmtPicked && (
                            <circle cx={x} cy={y} r={19} fill="none" stroke="#e53e3e" strokeWidth={3} strokeDasharray="6 4" />
                          )}
                          <circle
                            cx={x}
                            cy={y}
                            r={16}
                            fill={fill}
                            stroke={off ? "#c9cfcb" : isMgmtPicked ? "#e53e3e" : "#58645f"}
                            strokeWidth={isMgmtPicked ? 3 : 2}
                          />
                          <text
                            x={x}
                            y={y + 6}
                            fontSize={17}
                            fontWeight={700}
                            textAnchor="middle"
                            fill={isSold ? "#ffffff" : off ? "#59655f" : inkFor(fill)}
                            style={{ pointerEvents: "none" }}
                          >
                            {off || isSold ? "x" : n}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}

              {mode && (
                <div className="rounded-xl bg-[#f6f8f4] px-3 py-2.5">
                  <p className="text-[12px] font-semibold text-[#42544d]">
                    1 x {priceLabel(packagePrice)}
                  </p>
                  <p className="mt-0.5 text-base font-black text-[#173935]">
                    {priceLabel(packagePrice)}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleReserve}
                disabled={reserveDisabled}
                className="w-full rounded-xl bg-[#173935] px-4 py-3.5 text-sm font-black text-white transition-colors hover:bg-[#11241e] disabled:cursor-not-allowed disabled:bg-[#e6eae8] disabled:text-[#65726d] touch-manipulation"
              >
                {reserveLabel}
              </button>

              <button
                type="button"
                onClick={() => reset(category)}
                className="w-full rounded-lg px-2 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#6b7d75] transition-colors hover:text-[#173935]"
              >
                Pick a different table
              </button>

              <p aria-live="polite" className="text-[12px] font-semibold leading-5 text-[#55665f]">
                {notice}
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
