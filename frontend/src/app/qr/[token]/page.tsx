"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Calendar, Clock, MapPin, CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface TicketData {
  guest_name: string;
  category: string | null;
  event_title: string;
  event_date: string;
  event_time: string;
  venue: string;
  status: string;
  valid: boolean;
  rsvp_status: string | null;
}

function formatDate(dateStr: string) {
  if (!dateStr) return "TBD";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function formatTime(timeStr: string) {
  if (!timeStr) return "TBD";
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  const h = parseInt(parts[0]);
  const m = parts[1];
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export default function QrTicketPage() {
  const params = useParams();
  const token = params?.token;
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    apiClient<TicketData>(`/qr/${token}`)
      .then(setTicket)
      .catch((err) => setError(err instanceof Error ? err.message : "Invalid QR code"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0D1B2A]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-[#1ABC9C]" />
          <p className="text-white/60">Loading your ticket...</p>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0D1B2A] px-4">
        <div className="max-w-md w-full rounded-2xl bg-white p-8 text-center">
          <XCircle className="mx-auto mb-4 w-16 h-16 text-red-500" />
          <h1 className="text-2xl font-bold text-[#0D1B2A]">Invalid QR Code</h1>
          <p className="mt-2 text-[#64748b]">{error || "This QR code is not recognized."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full rounded-2xl bg-white overflow-hidden shadow-2xl">
        <div className="bg-gradient-to-r from-[#1ABC9C] to-[#16A085] p-6 text-center">
          <p className="text-white/70 text-sm uppercase tracking-widest mb-1">Entry Ticket</p>
          <h1 className="text-white text-2xl font-black">{ticket.event_title}</h1>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-center pb-4 border-b border-[#e8edf2]">
            <p className="text-[#64748b] text-sm">Guest</p>
            <p className="text-xl font-bold text-[#0D1B2A]">{ticket.guest_name}</p>
            {ticket.category && (
              <span className="inline-block mt-2 text-xs font-black uppercase tracking-wider text-white px-3 py-1 rounded-full" style={{ background: "#1ABC9C" }}>
                {ticket.category}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-sm text-[#64748b] mb-1">
                <Calendar className="w-4 h-4" />
                <span>Date</span>
              </div>
              <p className="font-semibold text-[#0D1B2A]">{formatDate(ticket.event_date)}</p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-sm text-[#64748b] mb-1">
                <Clock className="w-4 h-4" />
                <span>Time</span>
              </div>
              <p className="font-semibold text-[#0D1B2A]">{formatTime(ticket.event_time)}</p>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-sm text-[#64748b] mb-1">
              <MapPin className="w-4 h-4" />
              <span>Venue</span>
            </div>
            <p className="font-semibold text-[#0D1B2A]">{ticket.venue}</p>
          </div>

          {!ticket.rsvp_status || ticket.rsvp_status === "pending" ? (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-center gap-3">
              <HelpCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-amber-800 text-sm">Awaiting RSVP</p>
                <p className="text-xs text-amber-600">Guest has not responded yet</p>
              </div>
            </div>
          ) : ticket.rsvp_status === "declined" ? (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-center gap-3">
              <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-red-800 text-sm">Declined</p>
                <p className="text-xs text-red-600">Guest declined the invitation</p>
              </div>
            </div>
          ) : ticket.valid ? (
            <div className="rounded-xl bg-green-50 border border-green-200 p-4 flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-green-800 text-sm">Valid Ticket</p>
                <p className="text-xs text-green-600">Show this at the entrance</p>
              </div>
            </div>
          ) : ticket.status === "event_ended" ? (
            <div className="rounded-xl bg-gray-100 border border-gray-300 p-4 flex items-center gap-3">
              <XCircle className="w-6 h-6 text-gray-500 flex-shrink-0" />
              <div>
                <p className="font-bold text-gray-700 text-sm">Event Ended</p>
                <p className="text-xs text-gray-500">This event has already taken place</p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-center gap-3">
              <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-red-800 text-sm">Unavailable</p>
                <p className="text-xs text-red-600">This ticket is no longer valid</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-[#f8f9fc] px-6 py-4 text-center">
          <p className="text-xs text-[#94a3b8]">
            Powered by <span className="font-semibold text-[#1ABC9C]">Accredit Interactive</span>
          </p>
        </div>
      </div>
    </div>
  );
}
