"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";

type HeadcountEvent = {
  id: number;
  title: string;
  slug: string;
  venue: string | null;
  city: string | null;
  event_time: string | null;
  event_date: string | null;
  next_dates: { date: string; label: string | null; start_time: string | null }[];
};

const RED = "#E31E24";
const INK = "#141414";
const CREAM = "#F7F4EF";

function longDate(value: string) {
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function clock(value: string | null) {
  if (!value) return "7:00 PM";
  const [hRaw, mRaw] = value.split(":");
  const h = Number(hRaw);
  if (Number.isNaN(h)) return "7:00 PM";
  return `${h % 12 || 12}:${mRaw || "00"} ${h >= 12 ? "PM" : "AM"}`;
}

export default function HeadcountPassPage() {
  const params = useParams();
  const slug = (params?.slug as string) || "";
  const [event, setEvent] = useState<HeadcountEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    apiClient<HeadcountEvent>(`/headcount/event/${slug}`)
      .then(setEvent)
      .catch(() => setError("This wristband link is not active."));
  }, [slug]);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: CREAM, color: INK }}>
      <div className="flex-1 w-full max-w-lg mx-auto px-5 py-8 sm:py-12">
        <p
          className="text-center text-[10px] font-bold uppercase tracking-[0.42em]"
          style={{ color: RED }}
        >
          Entry wristband
        </p>

        <div className="mt-6 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/obi/obis-house.jpg"
            alt="OBI's House"
            className="w-56 sm:w-64 h-auto"
          />
        </div>

        <div className="mt-6 flex items-center gap-3">
          <span className="h-px flex-1" style={{ backgroundColor: "rgba(20,20,20,0.15)" }} />
          <span
            className="text-[10px] font-bold uppercase tracking-[0.32em]"
            style={{ color: RED }}
          >
            Mondays
          </span>
          <span className="h-px flex-1" style={{ backgroundColor: "rgba(20,20,20,0.15)" }} />
        </div>

        {error ? (
          <div className="mt-8 rounded-2xl bg-white p-6 text-center shadow-sm">
            <p className="text-sm font-semibold">{error}</p>
            <p className="mt-2 text-xs text-black/50">
              Ask the accreditation team at the gate if you need help.
            </p>
          </div>
        ) : !event ? (
          <div className="mt-8 rounded-2xl bg-white p-8 text-center shadow-sm">
            <div
              className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: RED, borderTopColor: "transparent" }}
            />
            <p className="mt-3 text-xs uppercase tracking-[0.3em] text-black/40">Please wait</p>
          </div>
        ) : (
          <>
            <div className="mt-6 text-center">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                {event.title}
              </h1>
              <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em]">
                {clock(event.event_time)} WAT
              </p>
              <p className="mt-2 text-sm text-black/60">
                Hakuna Matata Theme Park
                <br />
                Eko Hotels &amp; Suites, Victoria Island, Lagos
              </p>
            </div>

            <div className="mt-7 rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: RED }}>
                Your wristband is your pass
              </p>
              <p className="mt-2 text-sm leading-relaxed text-black/70">
                Keep your wristband on. At the gate the accreditation team scans the code
                printed on it, and that scan is what records your entry.
              </p>
              <p className="mt-3 text-xs leading-relaxed text-black/45">
                Scanning this page with your own phone does not record anything. Only the
                accreditation team scanner counts.
              </p>
            </div>

            {event.next_dates.length > 0 && (
              <div className="mt-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-black/40">
                  Next nights
                </p>
                <ul className="mt-3 divide-y divide-black/5 rounded-2xl bg-white px-4 shadow-sm">
                  {event.next_dates.slice(0, 4).map((day) => (
                    <li key={day.date} className="flex items-center justify-between gap-3 py-3">
                      <span className="text-sm font-semibold">{longDate(day.date)}</span>
                      <span className="text-xs font-bold uppercase tracking-widest text-black/45">
                        {clock(day.start_time || event.event_time)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        <div className="mt-9 flex items-center justify-center gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/obi/hakuna-matata.jpg" alt="Hakuna Matata Theme Park" className="w-28 h-auto" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/obi/eko-hotels.jpg" alt="Eko Hotels & Suites" className="w-28 h-auto" />
        </div>

        <p className="mt-8 text-center text-[10px] uppercase tracking-[0.25em] text-black/30">
          Powered by Accredit Interactive
        </p>
      </div>
    </div>
  );
}
