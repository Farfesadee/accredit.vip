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
  { name: "Silver Table", color: "#12c9ed", prefix: "SL" },
  { name: "Gold Table", color: "#47ed15", prefix: "GL" },
  { name: "Premium Gold", color: "#009337", prefix: "PGL" },
  { name: "Platinum Star", color: "#ffda48", prefix: "PS" },
  { name: "Platinum Legacy", color: "#3465ac", prefix: "PL" },
  { name: "Platinum Prime", color: "#956536", prefix: "PPM" },
  { name: "Platinum Prestige", color: "#ff9c36", prefix: "PP" },
  { name: "Platinum Extreme", color: "#cb3700", prefix: "PE" },
  { name: "VIP", color: "#c42d23", prefix: "VIP" },
];

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

export default function WarriFloorPlan({ eventId, packages, currencySymbol, onReserve }: Props) {
  const markers = useMemo(buildMarkers, []);
  const [category, setCategory] = useState(6);
  const [mode, setMode] = useState<"table" | "seat">("table");
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [seats, setSeats] = useState<number[]>([]);
  const [zoom, setZoom] = useState(1);
  const [tables, setTables] = useState<Record<string, ApiTable>>({});
  const [notice, setNotice] = useState("");
  const [isNarrow, setIsNarrow] = useState(false);
  const listRef = useRef<HTMLSelectElement | null>(null);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsNarrow(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  const cat = CATS[category];
  const isVip = category === 8;
  const isExtreme = category === 7;
  const bySeat = !isVip && mode === "seat";
  const packageForCat = packages.find((p) => p.name === cat.name) || null;
  const packageSeats = Math.max(1, Number(packageForCat?.seats) || 1);
  const packagePrice = Number(packageForCat?.price) || 0;
  const seatPrice = packageSeats > 1 ? Math.round(packagePrice / packageSeats) : packagePrice;

  const chosen = chosenId ? markers.find((m) => m.id === chosenId) || null : null;
  const chosenTable = chosen ? tables[chosen.code] : undefined;
  const tableSeats = Math.max(1, Number(chosenTable?.seat_count) || packageSeats);
  const soldSeats = new Set<number>(chosenTable?.sold_seats || []);
  const unavailableSeats = new Set<number>([
    ...BLOCKED_SEATS,
    ...Array.from(soldSeats),
  ]);

  const reset = (nextCategory?: number) => {
    setChosenId(null);
    setSeats([]);
    setNotice("");
    if (nextCategory !== undefined) setCategory(nextCategory);
  };

  const pick = (id: string) => {
    setChosenId(id);
    setSeats([]);
    setNotice("");
  };

  const toggleSeat = (seat: number) => {
    if (unavailableSeats.has(seat)) return;
    setSeats((prev) => (prev.includes(seat) ? prev.filter((s) => s !== seat) : [...prev, seat].sort((a, b) => a - b)));
    setNotice("");
  };

  const isAvailable = (m: Marker) => {
    if (blockedMarker(m.cat, m.n)) return false;
    const row = tables[m.code];
    if (!row) return true;
    if (row.status === "available") return true;
    // A table that has some seats taken can still sell the empty ones, but it
    // can no longer be bought as a whole table.
    return row.status === "partially_sold" && bySeat;
  };

  const priceLabel = (price: number) =>
    price > 0 ? `${currencySymbol}${price.toLocaleString()}` : "Free";

  const hint = isVip
    ? "One general-admission pass per guest."
    : isExtreme
    ? "Shown on the supplied floor plan. Public sales have not been confirmed."
    : "Tap a coloured table or choose one from the list.";

  const reserveLabel = isVip
    ? "Reserve ticket"
    : bySeat
    ? `Reserve ${seats.length || ""} seat${seats.length === 1 ? "" : "s"}`
    : "Reserve table";

  const reserveDisabled =
    !isVip && (!chosen || (bySeat && seats.length === 0));

  const handleReserve = () => {
    if (reserveDisabled) return;
    if (isVip) {
      onReserve({
        packageName: cat.name,
        mode: "vip",
        tables: [],
        seats: [],
        quantity: 1,
        unitPrice: packagePrice,
        totalPrice: packagePrice,
        label: "VIP admission, one guest",
      });
      setNotice("VIP selected in the ticket panel below. Choose how many passes you need.");
      return;
    }
    if (!chosen) return;
    const available = isAvailable(chosen);
    if (!available) {
      setNotice(`Table ${chosen.n} is not for sale.`);
      return;
    }
    const label = `${chosen.side} · Table ${chosen.n}`;
    if (bySeat) {
      onReserve({
        packageName: cat.name,
        mode: "seat",
        tables: [chosen.code],
        seats: [...seats].sort((a, b) => a - b),
        quantity: seats.length,
        unitPrice: seatPrice,
        totalPrice: seatPrice * seats.length,
        label: `${label} · Seat${seats.length === 1 ? "" : "s"} ${[...seats].sort((a, b) => a - b).join(", ")}`,
      });
      setNotice(`${seats.length} seat${seats.length === 1 ? "" : "s"} on ${label} added to the ticket panel below.`);
    } else {
      onReserve({
        packageName: cat.name,
        mode: "table",
        tables: [chosen.code],
        seats: [],
        quantity: 1,
        unitPrice: packagePrice,
        totalPrice: packagePrice,
        label: `${label} · Whole table, ${packageSeats} seats`,
      });
      setNotice(`Table ${chosen.n} added to the ticket panel below.`);
    }
  };

  const categoryMarkers = markers.filter((m) => m.cat === category);

  const listOpen = !isVip && !isExtreme;

  return (
    <section
      id="seating-plan"
      className="overflow-hidden rounded-3xl border border-[#d8dfdb] bg-[#f3f4ef]"
    >
      {/* Masthead, as on the organiser's own plan */}
      <div className="bg-[#173935] px-4 py-5 sm:px-6 sm:py-6 md:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#b3d7cb] sm:text-xs">
          EKO CONVENTION CENTRE · LAGOS
        </p>
        <h2 className="mt-1 text-3xl font-black leading-tight tracking-[-0.045em] text-white sm:text-4xl md:text-5xl">
          Warri Again?
        </h2>
        <p className="mt-1 text-sm font-semibold text-white/85 sm:text-base">
          Seating plan · 26 December 2026
        </p>
      </div>

      <div className="p-4 sm:p-5 md:p-6">

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="grid gap-1.5 text-[13px] font-bold text-[#182e2c] sm:mr-3">
          Ticket category
          <select
            value={category}
            onChange={(e) => reset(Number(e.target.value))}
            className="h-12 min-w-0 rounded-xl border border-[#aab8b3] bg-white px-3 text-base font-semibold text-[#182e2c] outline-none focus:border-[#173935]"
          >
            {CATS.map((c, i) => (
              <option key={c.name} value={i}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-[13px] font-bold text-[#182e2c]">
          Sale preview
          <select
            value={mode}
            disabled={isVip}
            onChange={(e) => {
              setMode(e.target.value as "table" | "seat");
              setSeats([]);
              setNotice("");
            }}
            className="h-12 min-w-0 rounded-xl border border-[#aab8b3] bg-white px-3 text-base font-semibold text-[#182e2c] outline-none focus:border-[#173935] disabled:opacity-50"
          >
            <option value="table">Whole table</option>
            <option value="seat">Individual seats</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_310px]">
        {/* MAP */}
        <div className="rounded-2xl border border-[#d8dfdb] bg-white p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-xl sm:text-2xl font-black text-[#182e2c]">Venue map</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Zoom out"
                onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
                className="h-10 w-10 rounded-lg border border-[#aab8b3] bg-white text-lg font-black text-[#182e2c] active:scale-95"
              >
                −
              </button>
              <button
                type="button"
                aria-label="Zoom in"
                onClick={() => setZoom((z) => Math.min(3, z + 0.5))}
                className="h-10 w-10 rounded-lg border border-[#aab8b3] bg-white text-lg font-black text-[#182e2c] active:scale-95"
              >
                +
              </button>
            </div>
          </div>

          <p className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] font-semibold text-[#485953] sm:text-[13px]">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-3.5 w-3.5 rounded-full border border-[#667]"
                style={{ background: cat.color }}
              />
              Available in category
            </span>
            <span>○ Other category</span>
            <span>× Unavailable</span>
            <span>◎ Selected</span>
          </p>

          <div className="overflow-auto rounded-xl border border-[#eef1ee]">
            <svg
              viewBox="-170 -82 1500 870"
              role="img"
              aria-label="Warri Again venue, stage at bottom"
              className="block h-auto max-w-none"
              style={{ width: `${zoom * 100}%`, minWidth: `${(isNarrow ? 880 : 650) * zoom}px` }}
            >
              <path
                d="M-135 635 Q-185 100 290 6 Q580 -110 866 2 Q1320 95 1294 635 L1170 706 L1060 601 L100 601 L-30 707Z"
                fill="#f7f8f5"
                stroke="#bfc9c4"
                strokeWidth={5}
              />
              <path d="M285 194H858V470H285Z" fill="#fff" stroke="#d5dcd7" strokeWidth={4} />
              <path d="M505 584 L578 535 L651 584 H804 V707 H353 V584Z" fill="#23423c" />
              <text x={579} y={655} fill="#ffffff" fontSize={33} fontWeight={700} textAnchor="middle">
                STAGE
              </text>
              <text x={576} y={-9} fill="#344640" fontSize={17} fontWeight={700} textAnchor="middle">
                BAR / LOUNGE
              </text>
              <text x={571} y={172} fill="#344640" fontSize={15} fontWeight={700} textAnchor="middle">
                FOH
              </text>

              {/* VIP banks */}
              {VIP_BANKS.map(([x, y, w, angle]) => (
                <g key={`vip-${x}-${y}`} transform={`translate(${x} ${y}) rotate(${angle})`}>
                  <rect width={w} height={53} rx={10} fill={isVip ? "#efb3af" : "#e0e4e1"} />
                  <text x={w / 2} y={32} fontSize={16} fontWeight={700} textAnchor="middle" fill="#344640">
                    VIP
                  </text>
                </g>
              ))}

              {/* Tables */}
              {markers.map((m) => {
                const active = m.cat === category;
                const off = blockedMarker(m.cat, m.n);
                const unavailable = off || !isAvailable(m);
                const ok = active && !unavailable;
                const ink = active ? (unavailable ? "#d1d6d3" : m.color) : "#e0e4e1";
                const isChosen = chosenId === m.id;
                const name = `${m.side} · Table ${m.n}${unavailable ? " · Unavailable" : ""}`;
                return (
                  <g
                    key={m.id}
                    className={ok ? "cursor-pointer" : undefined}
                    tabIndex={ok ? 0 : -1}
                    role={ok ? "button" : undefined}
                    aria-label={name}
                    aria-pressed={ok ? isChosen : undefined}
                    onClick={() => ok && pick(m.id)}
                    onKeyDown={(e) => {
                      if (ok && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        pick(m.id);
                      }
                    }}
                  >
                    <title>{name}</title>
                    <circle cx={m.x} cy={m.y} r={20} fill="transparent" style={{ pointerEvents: ok ? "all" : "none" }} />
                    {isChosen && (
                      <circle cx={m.x} cy={m.y} r={21} fill="none" stroke="#172b25" strokeWidth={3} />
                    )}
                    <circle
                      cx={m.x}
                      cy={m.y}
                      r={16}
                      fill={ink}
                      stroke={ok ? "#58645f" : "#c9cfcb"}
                      strokeWidth={2}
                    />
                    <text
                      x={m.x}
                      y={m.y + 5}
                      fontSize={15}
                      fontWeight={700}
                      textAnchor="middle"
                      fill={ok ? inkFor(ink) : "#626d67"}
                      style={{ pointerEvents: "none" }}
                    >
                      {active && unavailable ? "×" : m.n}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          <p className="mt-2 text-[11px] font-semibold text-[#6b7d75] sm:hidden">
            Drag the map sideways, or use + to zoom in.
          </p>
        </div>

        {/* SIDEBAR */}
        <aside className="rounded-2xl border border-[#d8dfdb] bg-white p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <span
              className="inline-block h-3.5 w-3.5 rounded-full border border-[#667]"
              style={{ background: cat.color }}
            />
            <h3 className="text-lg font-black text-[#182e2c]">{cat.name}</h3>
          </div>

          <p className="text-sm font-semibold leading-6 text-[#485953]">{hint}</p>

          {packageForCat && (
            <p className="mt-2 text-sm font-bold text-[#182e2c]">
              {priceLabel(packagePrice)}
              <span className="font-semibold text-[#5f7169]">
                {packageSeats > 1 ? ` per table of ${packageSeats}` : " per guest"}
              </span>
            </p>
          )}
          {packageForCat && packageSeats > 1 && (
            <p className="text-[12px] font-semibold text-[#5f7169]">
              {priceLabel(seatPrice)} per seat when bought individually
            </p>
          )}

          {listOpen && (
            <select
              ref={listRef}
              aria-label="Choose a table"
              value={chosenId || ""}
              onChange={(e) => (e.target.value ? pick(e.target.value) : reset())}
              className="mt-3 h-12 w-full rounded-xl border border-[#aab8b3] bg-white px-3 text-base font-semibold text-[#182e2c] outline-none focus:border-[#173935]"
            >
              <option value="">Choose a table</option>
              {categoryMarkers
                .filter((m) => isAvailable(m))
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.side} · Table {m.n}
                  </option>
                ))}
            </select>
          )}

          {isExtreme && (
            <p className="mt-3 rounded-xl border border-[#e7b7b4] bg-[#fdf1f0] px-3 py-2 text-[13px] font-bold text-[#8a2b26]">
              This tier is shown for reference. Public sales have not been confirmed.
            </p>
          )}

          {/* Seat ring */}
          {chosen && bySeat && (
            <div className="mt-4">
              <svg viewBox="0 0 250 220" role="img" aria-label="Ten numbered seats" className="w-full">
                <text x={125} y={113} fontSize={17} fontWeight={700} textAnchor="middle" fill="#344640">
                  Table {chosen.n}
                </text>
                {Array.from({ length: tableSeats }, (_, i) => i + 1).map((n) => {
                  const angle = ((n - 1) * Math.PI) / 5 - Math.PI / 2;
                  const x = 125 + 82 * Math.cos(angle);
                  const y = 110 + 82 * Math.sin(angle);
                  const off = unavailableSeats.has(n);
                  const fill = off ? "#d1d6d3" : chosen.color;
                  const picked = seats.includes(n);
                  return (
                    <g
                      key={`seat-${n}`}
                      className={off ? undefined : "cursor-pointer"}
                      tabIndex={off ? -1 : 0}
                      role={off ? undefined : "button"}
                      aria-label={`Seat ${n}${off ? " · Unavailable" : ""}`}
                      aria-pressed={off ? undefined : picked}
                      onClick={() => toggleSeat(n)}
                      onKeyDown={(e) => {
                        if (!off && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault();
                          toggleSeat(n);
                        }
                      }}
                    >
                      <title>
                        Seat {n}
                        {off ? " · Unavailable" : ""}
                      </title>
                      {picked && (
                        <circle cx={x} cy={y} r={21} fill="none" stroke="#172b25" strokeWidth={3} />
                      )}
                      <circle cx={x} cy={y} r={16} fill={fill} stroke={off ? "#c9cfcb" : "#58645f"} strokeWidth={2} />
                      <text
                        x={x}
                        y={y + 5}
                        fontSize={15}
                        fontWeight={700}
                        textAnchor="middle"
                        fill={off ? "#59655f" : inkFor(fill)}
                        style={{ pointerEvents: "none" }}
                      >
                        {off ? "×" : n}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}

          <p aria-live="polite" className="mt-3 min-h-[22px] text-sm font-bold text-[#182e2c]">
            {chosen
              ? `${chosen.side} · Table ${chosen.n} · ${
                  bySeat
                    ? seats.length
                      ? `Seats ${[...seats].sort((a, b) => a - b).join(", ")}`
                      : "Choose seats"
                    : `${packageSeats} guest passes`
                }`
              : isVip
              ? "One general-admission pass per guest."
              : ""}
          </p>

          {chosen && !isVip && bySeat && seats.length > 0 && (
            <p className="text-sm font-black text-[#173935]">
              Total {priceLabel(seatPrice * seats.length)}
            </p>
          )}

          <button
            type="button"
            onClick={handleReserve}
            disabled={reserveDisabled}
            className="mt-3 w-full rounded-xl bg-[#173935] px-4 py-3.5 text-base font-black text-white transition-colors hover:bg-[#11241e] disabled:cursor-not-allowed disabled:bg-[#e6eae8] disabled:text-[#65726d]"
          >
            {reserveLabel}
          </button>

          <p aria-live="polite" className="mt-2 text-[13px] font-semibold leading-5 text-[#485953]">
            {notice}
          </p>
        </aside>
      </div>

      <p className="mt-5 text-[12px] sm:text-[13px] font-semibold leading-6 text-[#485953]">
        Availability is checked live against the organiser&apos;s table release. Sponsor allocations
        and the final table release require organiser approval.
      </p>
      </div>
    </section>
  );
}
