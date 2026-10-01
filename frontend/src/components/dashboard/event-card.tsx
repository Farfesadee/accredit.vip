"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { EventData } from "@/lib/api/events";
import { CalendarDays, MapPin } from "lucide-react";

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr + "T12:00:00");
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return dateStr;
  }
}

export function EventCard({ event }: { event: EventData }) {
  return (
    <Link href={`/dashboard/events/${event.id}`} className="block group">
      <div
        className="rounded-2xl overflow-hidden transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-lg flex flex-col h-full"
        style={{ background: "white", border: "1px solid #e8edf2", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
      >
        <div
          className="h-40 relative overflow-hidden"
          style={event.cover_image ? {
            backgroundImage: `url(${event.cover_image})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          } : {
            background: "linear-gradient(135deg, #0D1B2A, #1a2e45)",
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <CalendarDays className="h-12 w-12 text-white/20" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-3" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.7))" }}>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white" style={{ background: "rgba(26, 188, 156,0.85)" }}>
              {(event.status || "draft").toUpperCase()}
            </span>
          </div>
        </div>

        <div className="p-4 flex flex-col flex-1 gap-2">
          <h3 className="font-bold text-[#0D1B2A] text-sm leading-snug group-hover:text-[#1ABC9C] transition-colors line-clamp-2">
            {event.title}
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{formatDate(event.event_date)}</span>
          </div>
          {event.venue && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{event.venue}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#f8f9fc", border: "1px solid #e8edf2" }}>
      <div className="skeleton h-40" />
      <div className="p-4 space-y-2">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
      </div>
    </div>
  );
}
