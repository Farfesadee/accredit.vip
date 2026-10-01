"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { API_BASE } from "@/lib/api-client";

interface PublicEvent {
  id: number;
  title: string;
  venue: string;
  event_date: string;
  category: string;
  description: string;
  cover_image: string | null;
  timezone: string;
  slug?: string;
}

function imgUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${API_BASE.replace("/api/v1", "")}${path}`;
}

function categoryGradient(cat: string): string {
  const gradients: Record<string, string> = {
    concert: "linear-gradient(135deg, #1a0533 0%, #4a0080 50%, #1ABC9C 100%)",
    festival: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #f59e0b 100%)",
    conference: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
    corporate: "linear-gradient(135deg, #1e3a5f 0%, #2d4a7a 50%, #3b82f6 100%)",
    wedding: "linear-gradient(135deg, #4a044e 0%, #701a75 50%, #1ABC9C 100%)",
  };
  return gradients[cat] || "linear-gradient(135deg, #0D1B2A 0%, #263b5e 50%, #1ABC9C 100%)";
}

const PLACEHOLDER_EVENTS: PublicEvent[] = [
  { id: -1, title: "Lagos Jazz Festival", venue: "Eko Convention Centre", event_date: "2026-08-15", category: "concert", description: "", cover_image: null, timezone: "WAT" },
  { id: -2, title: "Abuja Tech Summit", venue: "Transcorp Hilton", event_date: "2026-09-20", category: "conference", description: "", cover_image: null, timezone: "WAT" },
  { id: -3, title: "Accra Fashion Week", venue: "Kempinski Hotel", event_date: "2026-10-05", category: "festival", description: "", cover_image: null, timezone: "WAT" },
  { id: -4, title: "Nairobi Music Awards", venue: "KICC", event_date: "2026-11-12", category: "concert", description: "", cover_image: null, timezone: "WAT" },
  { id: -5, title: "Cape Town Food Fest", venue: "V&A Waterfront", event_date: "2026-12-01", category: "festival", description: "", cover_image: null, timezone: "WAT" },
  { id: -6, title: "Kigali Innovation Forum", venue: "KCC", event_date: "2027-01-20", category: "conference", description: "", cover_image: null, timezone: "WAT" },
  { id: -7, title: "Lagos Fashion Week", venue: "Victoria Island", event_date: "2027-02-14", category: "festival", description: "", cover_image: null, timezone: "WAT" },
  { id: -8, title: "Accra Music Concert", venue: "Independence Square", event_date: "2027-03-10", category: "concert", description: "", cover_image: null, timezone: "WAT" },
];

export function EventsCarousel() {
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/events/public?date_from=2020-01-01`);
        if (res.ok) {
          const data = await res.json();
          setEvents(data.slice(0, 10));
        }
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const displayEvents = events.length > 0 ? events.slice(0, 10) : PLACEHOLDER_EVENTS;

  return (
    <div className="py-3 overflow-hidden" style={{ background: "linear-gradient(180deg, rgba(5,10,20,0.7) 0%, transparent 100%)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-2">
        <div className="flex items-center">
          <span className="w-1.5 h-1.5 rounded-full bg-[#1ABC9C] animate-pulse mr-2" />
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/50">Live Events</span>
        </div>
      </div>

      <div className="relative">
        {/* Gradient fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-16 z-10 pointer-events-none" style={{ background: "linear-gradient(90deg, rgba(5,10,20,0.6) 0%, transparent 100%)" }} />
        <div className="absolute right-0 top-0 bottom-0 w-32 z-10 pointer-events-none" style={{ background: "linear-gradient(270deg, rgba(5,10,20,0.6) 0%, transparent 100%)" }} />

        {/* Marquee track - only event cards */}
        <div className="marquee-track flex gap-5" style={{ width: "max-content" }}>
          {[...displayEvents, ...displayEvents, ...displayEvents].map((ev, i) => (
            <Link
              key={`${ev.id}-${i}`}
              href={`/e/${ev.slug || ev.id}`}
              className="flex-shrink-0 w-60 rounded-2xl border border-[#e8edf2] p-4 hover:shadow-lg transition-all hover:-translate-y-1 no-underline group bg-white shadow-sm"
            >
              {ev.cover_image ? (
                <div className="w-full h-28 rounded-xl mb-3 bg-cover bg-center flex items-end p-3" style={{ backgroundImage: `url(${imgUrl(ev.cover_image)})` }}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/80 bg-black/20 px-2 py-0.5 rounded">{ev.category || "Event"}</span>
                </div>
              ) : (
                <div className="w-full h-28 rounded-xl mb-3 flex items-end p-3" style={{ background: categoryGradient(ev.category || "concert") }}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/80 bg-black/20 px-2 py-0.5 rounded">{ev.category || "Event"}</span>
                </div>
              )}
              <h3 className="text-sm font-bold text-[#0D1B2A] mt-1 leading-snug group-hover:text-[#1ABC9C] transition-colors">{ev.title}</h3>
              <p className="text-xs text-gray-400 mt-1 truncate">{ev.venue}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {ev.event_date ? new Date(ev.event_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
              </p>
            </Link>
          ))}
        </div>

        {/* Fixed SEE MORE button on the right */}
        <div className="absolute right-0 top-0 bottom-0 z-20 flex items-center pr-4">
          <Link
            href="/attend"
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white shadow-md border border-[#1ABC9C] hover:bg-[#fff1f8] transition-all no-underline group animate-bounce"
          >
            <span className="text-sm font-black text-[#1ABC9C] tracking-wider whitespace-nowrap">SEE MORE</span>
            <svg className="w-5 h-5 text-[#1ABC9C] group-hover:translate-x-1 transition-transform flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        .marquee-track {
          animation: marquee 40s linear infinite;
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
