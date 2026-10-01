"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api-client";
import { getPublicEvents, type EventData } from "@/lib/api/events";
import { getCurrencySymbol } from "@/lib/event-form-options";

function uploadUrl(path: string | null): string {
  if (!path) return "/uploads/black-market-flyer.jpg";
  if (path.startsWith("http")) return path;
  return `${API_BASE.replace("/api/v1", "")}${path}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type MarqueeCard = {
  key: string;
  title: string;
  sub: string;
  price: string;
  image: string | null;
};

export function BlackMarketSlider() {
  const [event, setEvent] = useState<EventData | null>(null);

  // Follows the admin spotlight: shows whichever event is featured.
  // Hidden entirely when nothing is spotlighted.
  useEffect(() => {
    getPublicEvents()
      .then((list) => setEvent((list || []).find((e: any) => e.spotlight) || null))
      .catch(() => {});
  }, []);

  if (!event) return null;

  const cs = getCurrencySymbol(event?.currency || "NGN");
  const flyer = uploadUrl(event?.cover_image || null);
  const pkgs = (event?.pass_packages || []).filter(
    (p: any) => p && (p.name || Number(p.price) > 0)
  );
  const general = pkgs[0] || { name: "General Access", price: 2000 };
  const premium = pkgs[1] || { name: "Premium VIP/VVIP", price: 50000 };

  // Exactly 3 cards: the event, General Access, Premium. Each links to /attend.
  const cards: MarqueeCard[] = [
    {
      key: "event",
      title: event?.title || "BLACK MARKET Movie World Record Attempt",
      sub: event?.event_date
        ? `${formatDate(event.event_date)} · ${event.venue || "TBS, Lagos"}`
        : "Sept 26, 2026 · TBS, Lagos",
      price: "Buy Tickets",
      image: flyer,
    },
    {
      key: "general",
      title: String(general.name || "General Access"),
      sub: "Zone A & B · Unlimited",
      price: `${cs}${Number(general.price || 2000).toLocaleString()}`,
      image: null,
    },
    {
      key: "premium",
      title: String(premium.name || "Premium VIP/VVIP"),
      sub: "Zone D VIP · Unlimited",
      price: `${cs}${Number(premium.price || 50000).toLocaleString()}`,
      image: null,
    },
  ];

  // Tripled so the -33.333% loop point is seamless.
  const loop = [...cards, ...cards, ...cards];

  return (
    <div
      className="absolute top-0 left-0 right-0 lg:left-1/2 overflow-hidden"
      style={{ zIndex: 20 }}
    >
      <style>{`
        @keyframes bm-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        .bm-marquee-track {
          animation: bm-marquee 26s linear infinite;
        }
        .bm-marquee-track:hover {
          animation-play-state: paused;
        }
      `}</style>

      <p className="text-right text-[9px] font-black uppercase tracking-[0.25em] text-white/50 pr-4 pt-2">
        Now selling: tap a card
      </p>

      {/* Cards slide right-to-left and dissolve into the left fade long
          before they can reach the headline text. */}
      <div
        className="relative pb-2"
        style={{
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 30%, black 94%, transparent 100%)",
          maskImage:
            "linear-gradient(to right, transparent 0%, black 30%, black 94%, transparent 100%)",
        }}
      >
        <div className="bm-marquee-track flex items-stretch gap-4 px-4" style={{ width: "max-content" }}>
          {loop.map((c, i) => (
            <Link
              key={`${c.key}-${i}`}
              href="/attend"
              className="flex-shrink-0 flex items-center gap-3 rounded-2xl p-2.5 no-underline hover:border-[#1ABC9C] transition-colors"
              style={{
                width: 320,
                background: "rgba(10,18,32,0.72)",
                border: "1px solid rgba(255,255,255,0.16)",
                backdropFilter: "blur(12px)",
                boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
              }}
            >
              {c.image ? (
                <img
                  src={c.image}
                  alt=""
                  className="h-24 w-24 rounded-xl object-cover flex-shrink-0"
                />
              ) : (
                <span
                  className="h-24 w-24 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #1ABC9C, #0D1B2A)" }}
                >
                  <span className="text-2xl font-black text-white">₦</span>
                  <span className="text-[9px] font-bold text-white/80 px-1 text-center leading-tight">
                    {c.key === "general" ? "GENERAL" : "VIP / VVIP"}
                  </span>
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold text-white leading-snug">
                  {c.title}
                </span>
                <span className="block text-[11px] text-white/60 mt-0.5">{c.sub}</span>
                <span
                  className="inline-block mt-1.5 text-xs font-black text-[#1ABC9C] px-2.5 py-1 rounded-lg"
                  style={{ background: "rgba(26,188,156,0.14)" }}
                >
                  {c.price}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
