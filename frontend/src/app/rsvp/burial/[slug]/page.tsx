"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { Calendar, Clock, MapPin, Check, X, Loader, ChevronDown, Users } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface BurialEvent {
  id: number;
  title: string;
  slug: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  state: string;
  cover_image: string | null;
  theme_color: string;
  deceased_photo_url: string | null;
  burial_flyer_url: string | null;
}

interface HostInfo {
  name: string;
  allocation: number | null;
}

interface BurialRSVPData {
  event: BurialEvent;
  hosts: HostInfo[] | string[];
}

function formatDate(dateStr: string) {
  if (!dateStr) return "TBD";
  const parts = dateStr.split("-");
  if (parts.length !== 3) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }
  const y = parseInt(parts[0]), m = parseInt(parts[1]), d = parseInt(parts[2]);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dateObj = new Date(y, m - 1, d);
  return `${days[dateObj.getDay()]}, ${months[m - 1]} ${d}, ${y}`;
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

function getHostFromUrl(): string {
  if (typeof window === "undefined") return "";
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("host") || "";
  } catch {
    return "";
  }
}

export default function BurialRSVPPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [showSplash, setShowSplash] = useState(true);
  const [rsvpData, setRsvpData] = useState<BurialRSVPData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [response, setResponse] = useState<"accepted" | "declined" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [hostInput, setHostInput] = useState("");
  const [invitedBy, setInvitedBy] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);

  const isHostPreSet = !!getHostFromUrl();
  const themeColor = rsvpData?.event.theme_color || "#1A2554";

  const getHostNames = (): string[] => {
    if (!rsvpData?.hosts) return [];
    return rsvpData.hosts.map(h => (typeof h === "string" ? h : h.name));
  };

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 5500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (showSplash) return;
    const load = async () => {
      if (!slug) return;
      try {
        const host = getHostFromUrl();
        if (host) setInvitedBy(host);
        const data = await apiClient<BurialRSVPData>(`/rsvp/burial/${slug}`);
        setRsvpData(data);
      } catch (err: any) {
        setError(err.detail || err.message || "Could not load event details");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug, showSplash]);

  const submitRsvp = async () => {
    const host = getHostFromUrl();
    const effectiveHost = host || invitedBy;
    if (!name.trim() || !phone.trim() || !effectiveHost || !response) return;
    setSubmitting(true);
    setError("");
    try {
      const query = host ? `?host=${encodeURIComponent(host)}` : "";
      await apiClient(`/rsvp/burial/${slug}${query}`, {
        method: "POST",
        body: { name: name.trim(), phone: phone.trim(), email: email.trim(), invited_by: effectiveHost, response },
      });
      setSubmitted(true);
    } catch (err: any) {
      const msg = err.detail || err.message || "";
      if (msg.toLowerCase().includes("already registered")) {
        setError("You have already registered for this event. No need to RSVP again.");
      } else if (msg.toLowerCase().includes("kindly contact your host")) {
        setError("Error occured, kindly contact your host");
      } else {
        setError(msg || "Failed to submit RSVP. Please try again.");
      }
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
      <div className="flex min-h-screen items-center justify-center bg-[#0D1B2A]">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: themeColor }} />
          <p className="text-white/60">Loading event details...</p>
        </div>
      </div>
    );
  }

  if (!rsvpData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0D1B2A] px-4">
        <div className="max-w-md w-full rounded-2xl bg-white p-8 text-center">
          <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[#0D1B2A]">Event Not Found</h1>
          <p className="mt-2 text-slate-500">{error || "This RSVP link is invalid or the event has ended."}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    const event = rsvpData!.event;
    return (
      <div className="min-h-screen bg-[#0D1B2A] px-4 py-12 sm:py-16">
        <div className="max-w-lg mx-auto">
          <div className="rounded-2xl bg-white shadow-lg overflow-hidden">
            {event.cover_image && (
              <div className="h-48 w-full bg-gray-100">
                <img src={event.cover_image} alt={event.title} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-6 sm:p-8 text-center">
              {response === "accepted" ? (
                <>
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                    <Check className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h1 className="text-2xl font-bold text-[#0D1B2A]">Attendance Confirmed</h1>
                  <p className="mt-3 text-slate-600 leading-relaxed">
                    Thank you, <strong>{name}</strong>. Your attendance has been recorded for {event.title}.
                  </p>
                  <div className="mt-6 rounded-xl bg-slate-50 border border-slate-200 p-4 text-left space-y-2">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Calendar className="w-4 h-4 flex-shrink-0" style={{ color: themeColor }} />
                      <span><strong>Date:</strong> {formatDate(event.date)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Clock className="w-4 h-4 flex-shrink-0" style={{ color: themeColor }} />
                      <span><strong>Time:</strong> {formatTime(event.time)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: themeColor }} />
                      <span><strong>Venue:</strong> {event.venue}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Users className="w-4 h-4 flex-shrink-0" style={{ color: themeColor }} />
                      <span><strong>Invited By:</strong> {(getHostFromUrl() || invitedBy)}</span>
                    </div>
                  </div>
                  <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
                    <p className="text-sm font-medium text-amber-800">What happens next?</p>
                    <ul className="mt-2 text-sm text-amber-700 space-y-1 list-disc list-inside">
                      <li>Look out for a confirmation message from your host within the next 72 hours</li>
                      <li>The confirmation message will contain your QR code for entry</li>
                      <li>If you don't receive anything within 72 hours, please contact the family member who invited you</li>
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
                    <X className="w-8 h-8 text-red-500" />
                  </div>
                  <h1 className="text-2xl font-bold text-[#0D1B2A]">Response Recorded</h1>
                  <p className="mt-3 text-slate-600 leading-relaxed">
                    Thank you, <strong>{name}</strong>. Your response has been noted and will be conveyed to{' '}
                    {(getHostFromUrl() || invitedBy)}.
                  </p>
                </>
              )}
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-white/40">
            Powered by <span className="font-semibold" style={{ color: themeColor }}>Accredit Interactive</span>
          </p>
        </div>
      </div>
    );
  }

  const event = rsvpData!.event;
  const hostFromUrl = getHostFromUrl();
  const effectiveInvitedBy = hostFromUrl || invitedBy;
  const canSubmit = name.trim() && phone.trim() && effectiveInvitedBy && response;
  const fieldErrors: string[] = [];
  if (!name.trim()) fieldErrors.push("Name");
  if (!phone.trim()) fieldErrors.push("Phone Number");

  if (!hostFromUrl && !invitedBy) fieldErrors.push("Invited By");
  if (!response) fieldErrors.push("Attendance Response");

  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
        <div className="rounded-2xl bg-white border border-slate-200 shadow-lg overflow-hidden">
          {event.cover_image && (
            <div className="h-56 sm:h-64 w-full bg-gray-100">
              <img src={event.cover_image} alt={event.title} className="w-full h-full object-cover" />
            </div>
          )}

          <div className="p-6 sm:p-8">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-[#0D1B2A]">{event.title}</h1>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 pb-6 border-b border-slate-100">
              <div className="flex items-start gap-3 bg-slate-50 rounded-xl p-3">
                <Calendar className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: themeColor }} />
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Date</p>
                  <p className="font-semibold text-[#0D1B2A] text-sm">{formatDate(event.date)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-slate-50 rounded-xl p-3">
                <Clock className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: themeColor }} />
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Time</p>
                  <p className="font-semibold text-[#0D1B2A] text-sm">{formatTime(event.time)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-slate-50 rounded-xl p-3 sm:col-span-2">
                <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: themeColor }} />
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Venue</p>
                  <p className="font-semibold text-[#0D1B2A] text-sm">{event.venue}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3">
                  <p className="text-sm font-medium text-red-800">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                  Your Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Enter your full name"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#0D1B2A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1A2554]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="08012345678"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#0D1B2A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1A2554]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                  Email Address <span className="text-slate-400">(optional)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#0D1B2A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1A2554]"
                />
              </div>

              {hostFromUrl ? (
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                    Invited By
                  </label>
                  <div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-[#0D1B2A]">
                    {hostFromUrl}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                    Who invited you? <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={invitedBy || hostInput}
                      onChange={e => {
                        setHostInput(e.target.value);
                        setInvitedBy("");
                        setShowSuggestions(true);
                        setFocusedIdx(-1);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      onKeyDown={e => {
                        const filtered = getHostNames().filter(h =>
                          h.toLowerCase().includes((invitedBy || hostInput).toLowerCase())
                        );
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setFocusedIdx(prev => Math.min(prev + 1, filtered.length - 1));
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setFocusedIdx(prev => Math.max(prev - 1, 0));
                        } else if (e.key === "Enter" && focusedIdx >= 0 && filtered[focusedIdx]) {
                          e.preventDefault();
                          setInvitedBy(filtered[focusedIdx]);
                          setHostInput(filtered[focusedIdx]);
                          setShowSuggestions(false);
                        }
                      }}
                      placeholder="Search for the host who invited you..."
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm text-[#0D1B2A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1A2554]"
                    />
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    {showSuggestions && (invitedBy || hostInput) && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                        {getHostNames()
                          .filter(h => h.toLowerCase().includes((invitedBy || hostInput).toLowerCase()))
                          .map((h, i) => (
                            <button
                              key={h}
                              type="button"
                              onMouseDown={() => {
                                setInvitedBy(h);
                                setHostInput(h);
                                setShowSuggestions(false);
                              }}
                              className={`block w-full text-left px-4 py-2.5 text-sm transition-colors ${
                                i === focusedIdx
                                  ? "bg-slate-100 text-[#0D1B2A]"
                                  : invitedBy === h
                                  ? "bg-slate-50 text-[#0D1B2A] font-medium"
                                  : "text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              {h}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-2 space-y-3">
                <p className="text-center text-sm font-semibold text-[#0D1B2A]">
                  Will you attend? <span className="text-red-500">*</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setResponse("accepted")}
                    className={`flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold text-base transition-all ${
                      response === "accepted"
                        ? "bg-emerald-600 text-white shadow-lg ring-2 ring-emerald-600 ring-offset-2"
                        : "bg-white text-slate-500 border-2 border-slate-200 hover:border-emerald-500 hover:text-emerald-600"
                    }`}
                  >
                    <Check className="w-5 h-5" />
                    Yes, I Will Attend
                  </button>
                  <button
                    type="button"
                    onClick={() => setResponse("declined")}
                    className={`flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold text-base transition-all ${
                      response === "declined"
                        ? "bg-red-600 text-white shadow-lg ring-2 ring-red-600 ring-offset-2"
                        : "bg-white text-slate-500 border-2 border-slate-200 hover:border-red-500 hover:text-red-600"
                    }`}
                  >
                    <X className="w-5 h-5" />
                    Sorry, Cannot Attend
                  </button>
                </div>
              </div>

              <button
                onClick={submitRsvp}
                disabled={!canSubmit || submitting}
                className="w-full mt-4 flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold text-base text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: canSubmit ? themeColor : "#94a3b8" }}
              >
                {submitting ? (
                  <><Loader className="w-5 h-5 animate-spin" /> Submitting...</>
                ) : response === "accepted" ? (
                  "Confirm Attendance"
                ) : response === "declined" ? (
                  "Submit Response"
                ) : (
                  "Select an option above"
                )}
              </button>
            </div>
          </div>

          <div className="bg-slate-50 px-6 py-4 text-center border-t border-slate-200">
            <p className="text-xs text-slate-400">
              Powered by <span className="font-semibold" style={{ color: themeColor }}>Accredit Interactive</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
