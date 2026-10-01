"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Calendar, Clock, MapPin, Check, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface RSVPData {
  event_title: string;
  event_date: string;
  event_time: string;
  venue: string;
  host_name: string;
  guest_name: string;
  cover_image: string | null;
  event_theme_color?: string;
  rsvp_status?: string;
  rsvp_note?: string | null;
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

export default function RSVPPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token;

  const [rsvpData, setRsvpData] = useState<RSVPData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedResponse, setSubmittedResponse] = useState<"yes" | "no">("yes");
  const [guestName, setGuestName] = useState("");
  const [selectedResponse, setSelectedResponse] = useState<"yes" | "no" | null>(null);
  const [declineNote, setDeclineNote] = useState("");
  const [showSplash, setShowSplash] = useState(true);
  const themeColor = rsvpData?.event_theme_color || "#1ABC9C";

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 5500);
    return () => { clearTimeout(timer); };
  }, []);

  useEffect(() => {
    const loadRsvpData = async () => {
      try {
        const data = await apiClient<RSVPData>(`/rsvp/${token}`);
        setRsvpData(data);
        if (data.rsvp_status === "accepted" || data.rsvp_status === "declined") {
          setSubmittedResponse(data.rsvp_status === "accepted" ? "yes" : "no");
          setGuestName(data.guest_name);
          setDeclineNote(data.rsvp_note || "");
          setSubmitted(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load invitation");
      } finally {
        setLoading(false);
      }
    };
    if (token) loadRsvpData();
  }, [token]);

  const submitRsvp = async (selected: "yes" | "no") => {
    setSubmitting(true);
    setError("");
    try {
      const res = await apiClient<any>(`/rsvp/${token}`, {
        method: "POST",
        body: { response: selected, note: selected === "no" ? declineNote || null : null },
      });
      setSubmittedResponse(selected);
      setGuestName(res.guest_name || rsvpData?.guest_name || "");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit RSVP");
    } finally {
      setSubmitting(false);
    }
  };

  if (showSplash) {
    return (
      <div className="min-h-screen bg-white relative overflow-hidden">
        <iframe src="/" className="absolute inset-0 w-full h-full border-0" title="accredit.vip" />
        <div className="absolute inset-0 bg-black/10 z-[1]" onClick={(e) => e.preventDefault()} />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0D1B2A]/90 via-[#0D1B2A]/80 to-[#0D1B2A] z-10 flex flex-col items-center justify-center px-6 text-center">
          <Image
            src="/logo-mark.png"
            alt="Accredit Interactive"
            width={260}
            height={50}
            className="h-10 w-auto object-contain mx-auto mb-6"
            priority
          />
          <p className="text-white/50 text-xs uppercase tracking-[0.2em] font-medium mb-1">Event Invitation</p>
          <div className="mt-8 flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin" />
            <p className="text-white/90 text-lg font-bold tracking-[0.25em]">PLEASE WAIT</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fc]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#e8edf2]" style={{ borderTopColor: themeColor }} />
          <p className="text-[#64748b]">Loading your invitation...</p>
        </div>
      </div>
    );
  }

  if (error || !rsvpData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fc] px-4">
        <div className="max-w-md w-full rounded-2xl bg-white p-8 border border-[#e8edf2] text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#fef2f2]">
            <svg className="h-8 w-8 text-[#ef4444]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#0D1B2A]">Invalid Link</h1>
          <p className="mt-2 text-[#64748b]">{error || "This QR code is from a test preview: it isn't linked to any real event."}</p>
          <p className="mt-4 text-sm text-[#94a3b8]">
            Create an account at Accredit Interactive to generate real QR codes linked to your events!
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-start justify-center bg-[#0D1B2A] px-4 pt-16 sm:pt-24">
        <div className="max-w-md w-full rounded-2xl bg-white pt-6 pb-8 px-8 text-center shadow-lg">
          {submittedResponse === "yes" ? (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#f0fdf4]">
                <Check className="w-8 h-8 text-[#10b981]" />
              </div>
              <h1 className="text-2xl font-bold text-[#0D1B2A]">You&apos;re Confirmed</h1>
              <p className="mt-2 text-[#64748b] leading-relaxed">
                Thank you, {guestName || rsvpData?.guest_name || "Guest"}. Your attendance has been recorded.
              </p>
              <p className="mt-3 text-sm text-[#94a3b8] leading-relaxed">
                Your unique QR code will be sent to your registered contact shortly. Please present it at the venue for entry.
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#fef2f2]">
                <X className="w-8 h-8 text-[#dc2626]" />
              </div>
              <h1 className="text-2xl font-bold text-[#0D1B2A]">Response Recorded</h1>
              <p className="mt-2 text-[#64748b] leading-relaxed">
                Thank you, {guestName || rsvpData?.guest_name || "Guest"}. Your response has been received and noted.
              </p>
              {declineNote && (
                <div className="mt-4 rounded-xl bg-[#f8f9fc] border border-[#e8edf2] p-4 text-left">
                  <p className="text-xs text-[#94a3b8] uppercase tracking-wider mb-1">Your reason</p>
                  <p className="text-sm text-[#64748b]">{declineNote}</p>
                </div>
              )}
              <p className="mt-3 text-sm text-[#94a3b8]">
                We appreciate your reply and wish you all the best.
              </p>
            </>
          )}
          {/* Back to Home - advert */}
          <div className="mt-8 pt-6 border-t border-[#e8edf2]">
            <a
              href="https://accredit.vip"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0D1B2A] text-white font-semibold text-sm hover:bg-[#1a2940] transition"
            >
              Back to Home
            </a>
            <p className="mt-3 text-xs text-[#94a3b8]">
              Powered by <span className="font-semibold text-[#1ABC9C]">Accredit Interactive</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fc] relative overflow-hidden">
      {/* Animated floating orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="animate-orb absolute -top-20 -left-20 w-72 h-72 rounded-full opacity-60" style={{ background: `linear-gradient(to bottom right, ${themeColor}15, transparent)` }} />
        <div className="animate-orb absolute top-1/3 -right-16 w-56 h-56 rounded-full opacity-50" style={{ background: `linear-gradient(to bottom left, ${themeColor}12, transparent)`, animationDelay: "-3s" }} />
        <div className="animate-orb absolute -bottom-32 left-1/4 w-80 h-80 rounded-full opacity-40" style={{ background: `linear-gradient(to top right, ${themeColor}0d, transparent)`, animationDelay: "-6s" }} />
      </div>

      {/* Branded header bar */}
      <div className="relative bg-white/80 backdrop-blur-sm border-b border-[#e8edf2] px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo-mark.png" alt="" width={366} height={372} className="h-5 w-auto object-contain" />
          </div>
          <a href="/create-event" className="text-xs font-bold hover:underline" style={{ color: themeColor }}>
            Create Event &rarr;
          </a>
        </div>
      </div>

      <div className="relative max-w-lg mx-auto px-4 py-8">
        <div className="rounded-2xl bg-white border border-[#e8edf2] shadow-lg overflow-hidden motion-pop">
          {/* Flyer image */}
          {rsvpData.cover_image && (
            <div className="h-56 sm:h-64 w-full bg-gray-100">
              <img src={rsvpData.cover_image} alt={rsvpData.event_title} className="w-full h-full object-cover" />
            </div>
          )}

          <div className="p-6 sm:p-8">
            {/* Guest greeting */}
            <div className="text-center mb-8 motion-rise" style={{ animationDelay: "0.1s" }}>
              <p className="text-sm text-[#94a3b8] uppercase tracking-wider mb-1">Dear {rsvpData.guest_name},</p>
              <h1 className="text-3xl font-bold text-[#0D1B2A] mt-2">You&apos;re Invited!</h1>
              <p className="text-[#64748b] mt-1">{rsvpData.host_name} cordially invites you to</p>
            </div>

            {/* Event details */}
            <div className="space-y-4 mb-8 pb-8 border-b border-[#e8edf2] motion-rise" style={{ animationDelay: "0.2s" }}>
              <div className="text-center">
                <h2 className="text-2xl font-extrabold" style={{ color: themeColor }}>{rsvpData.event_title}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                <div className="flex items-start gap-3 bg-[#f8f9fc] rounded-xl p-4 motion-float-card">
                  <Calendar className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: themeColor }} />
                  <div>
                    <p className="text-xs text-[#94a3b8] uppercase tracking-wider mb-0.5">Date</p>
                    <p className="font-bold text-[#0D1B2A]">{formatDate(rsvpData.event_date)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-[#f8f9fc] rounded-xl p-4 motion-float-card-alt">
                  <Clock className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: themeColor }} />
                  <div>
                    <p className="text-xs text-[#94a3b8] uppercase tracking-wider mb-0.5">Time</p>
                    <p className="font-bold text-[#0D1B2A]">{formatTime(rsvpData.event_time)}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-[#f8f9fc] rounded-xl p-4 motion-float-card" style={{ animationDelay: "-2s" }}>
                <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: themeColor }} />
                <div>
                  <p className="text-xs text-[#94a3b8] uppercase tracking-wider mb-0.5">Venue</p>
                  <p className="font-bold text-[#0D1B2A]">{rsvpData.venue}</p>
                </div>
              </div>
            </div>

            {/* RSVP */}
            <div className="mb-6 motion-rise" style={{ animationDelay: "0.3s" }}>
              <p className="text-center text-lg font-bold text-[#0D1B2A] mb-5">Will you attend?</p>

              {error && (
                <div className="mb-4 rounded-xl bg-[#fef2f2] border border-[#fecdd3] p-3">
                  <p className="text-sm font-semibold text-[#991b1b]">{error}</p>
                </div>
              )}

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setSelectedResponse("yes")}
                  className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold text-base transition-all ${
                    selectedResponse === "yes"
                      ? "bg-[#16a34a] text-white shadow-[0_4px_12px_rgba(22,163,74,0.3)] ring-2 ring-[#16a34a] ring-offset-2"
                      : "bg-white text-[#64748b] border-2 border-[#e8edf2] hover:border-[#16a34a] hover:text-[#16a34a]"
                  }`}
                >
                  <Check className="w-5 h-5" />
                  Yes, I'll Attend
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedResponse("no")}
                  className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold text-base transition-all ${
                    selectedResponse === "no"
                      ? "bg-[#dc2626] text-white shadow-[0_4px_12px_rgba(220,38,38,0.3)] ring-2 ring-[#dc2626] ring-offset-2"
                      : "bg-white text-[#64748b] border-2 border-[#e8edf2] hover:border-[#dc2626] hover:text-[#dc2626]"
                  }`}
                >
                  <X className="w-5 h-5" />
                  Sorry, Can't Attend
                </button>
              </div>

              {selectedResponse === "no" && (
                <div className="mt-4">
                  <textarea
                    placeholder="Optional: let us know why you can't make it..."
                    value={declineNote}
                    onChange={(e) => setDeclineNote(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-[#e8edf2] bg-white px-4 py-3 text-sm text-[#0D1B2A] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#dc2626] resize-none"
                  />
                </div>
              )}

              {selectedResponse && (
                <button
                  onClick={() => submitRsvp(selectedResponse)}
                  disabled={submitting}
                  className={`w-full mt-4 flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold text-base text-white transition-all disabled:opacity-60 ${
                    selectedResponse === "yes"
                      ? "bg-[#16a34a] shadow-[0_4px_12px_rgba(22,163,74,0.3)] hover:shadow-[0_6px_16px_rgba(22,163,74,0.45)] hover:scale-[1.02]"
                      : "bg-[#dc2626] shadow-[0_4px_12px_rgba(220,38,38,0.3)] hover:shadow-[0_6px_16px_rgba(220,38,38,0.45)] hover:scale-[1.02]"
                  }`}
                >
                  {submitting ? "Submitting..." : selectedResponse === "yes" ? "Confirm Attendance" : "Submit Response"}
                </button>
              )}
            </div>
          </div>

          {/* Footer branding */}
          <div className="bg-[#f8f9fc] px-6 py-4 text-center border-t border-[#e8edf2] motion-fade-in" style={{ animationDelay: "0.5s" }}>
            <p className="text-xs text-[#94a3b8]">
              Powered by <a href="/" className="font-semibold hover:underline" style={{ color: themeColor }}>Accredit Interactive</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
