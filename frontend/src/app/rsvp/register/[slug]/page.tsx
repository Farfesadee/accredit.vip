"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { Calendar, Clock, MapPin, Check, X, Loader, User, Building, Briefcase } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import EnvelopeSplash from "@/components/rsvp/EnvelopeSplash";

interface RegistrationEvent {
  id: number;
  title: string;
  slug: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  state: string;
  cover_image: string | null;
  flyer_url: string | null;
  theme_color: string;
  host_name: string;
  dress_code: string | null;
  registration_open?: boolean;
}

interface RegistrationData {
  event: RegistrationEvent;
  two_step?: boolean;
  extra_fields?: string[];
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

const COUNTRY_CODES = [
  { code: "+234", label: "Nigeria (+234)" },
  { code: "+1", label: "USA / Canada (+1)" },
  { code: "+44", label: "UK (+44)" },
  { code: "+233", label: "Ghana (+233)" },
  { code: "+254", label: "Kenya (+254)" },
  { code: "+27", label: "South Africa (+27)" },
  { code: "+971", label: "UAE (+971)" },
  { code: "+91", label: "India (+91)" },
];

function fullPhoneNumber(countryCode: string, local: string) {
  return (countryCode + " " + local).replace(/[^\d+]/g, "");
}

export default function EventRegistrationPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [showSplash, setShowSplash] = useState(true);
  const [showEnvelope, setShowEnvelope] = useState(false);
  const [rsvpData, setRsvpData] = useState<RegistrationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // shared detail fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+234");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [subDepartment, setSubDepartment] = useState("");
  const [category, setCategory] = useState("");

  // single-page flow (non-ACAMB)
  const [response, setResponse] = useState<"accepted" | "declined" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // two-step flow (ACAMB / event 67)
  const [step, setStep] = useState<"attendance" | "details" | "done">("attendance");
  const [twoStepResponse, setTwoStepResponse] = useState<"accepted" | "declined" | null>(null);
  const [twoStepSubmitting, setTwoStepSubmitting] = useState(false);

  // Birthday music for event 72
  const audioCtxRef = useRef<any>(null);
  const musicIntervalRef = useRef<any>(null);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const musicStartedRef = useRef(false);

  const MELODY = [
    { f: 262, d: 0.35 }, { f: 262, d: 0.15 }, { f: 294, d: 0.5 },
    { f: 262, d: 0.5 }, { f: 349, d: 0.5 }, { f: 330, d: 1.0 },
    { f: 262, d: 0.35 }, { f: 262, d: 0.15 }, { f: 294, d: 0.5 },
    { f: 262, d: 0.5 }, { f: 392, d: 0.5 }, { f: 349, d: 1.0 },
    { f: 262, d: 0.35 }, { f: 262, d: 0.15 }, { f: 523, d: 0.5 },
    { f: 440, d: 0.5 }, { f: 349, d: 0.5 }, { f: 330, d: 0.5 },
    { f: 294, d: 1.0 },
    { f: 466, d: 0.35 }, { f: 466, d: 0.15 }, { f: 440, d: 0.5 },
    { f: 349, d: 0.5 }, { f: 392, d: 0.5 }, { f: 349, d: 1.0 },
  ];

  const playMelody = useCallback(() => {
    const c = audioCtxRef.current;
    if (!c || c.state === "closed") return;
    let t = c.currentTime + 0.1;
    for (const note of MELODY) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.frequency.value = note.f;
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + note.d - 0.02);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t);
      osc.stop(t + note.d);
      t += note.d;
    }
  }, []);

  const startBirthdayMusic = useCallback(() => {
    if (musicStartedRef.current) return;
    musicStartedRef.current = true;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
      playMelody();
      const totalDuration = MELODY.reduce((sum, n) => sum + n.d, 0);
      musicIntervalRef.current = setInterval(() => {
        if (audioCtxRef.current && audioCtxRef.current.state !== "closed") playMelody();
      }, totalDuration * 1000 + 200);
      setMusicPlaying(true);
    } catch {}
  }, [playMelody]);

  const toggleMusic = useCallback(() => {
    const c = audioCtxRef.current;
    if (!c) return;
    if (c.state === "running") {
      c.suspend();
      if (musicIntervalRef.current) { clearInterval(musicIntervalRef.current); musicIntervalRef.current = null; }
      setMusicPlaying(false);
    } else if (c.state === "suspended") {
      c.resume();
      playMelody();
      const totalDuration = MELODY.reduce((sum, n) => sum + n.d, 0);
      musicIntervalRef.current = setInterval(() => {
        if (audioCtxRef.current && audioCtxRef.current.state === "running") playMelody();
      }, totalDuration * 1000 + 200);
      setMusicPlaying(true);
    }
  }, [playMelody]);

  useEffect(() => {
    return () => {
      if (musicIntervalRef.current) clearInterval(musicIntervalRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    };
  }, []);

  const themeColor = rsvpData?.event.theme_color || "#1ABC9C";
  const isTwoStep = !!rsvpData?.two_step;
  const isNFW = rsvpData?.event.id === 74;

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (showSplash) return;
    const load = async () => {
      if (!slug) return;
      try {
        const data = await apiClient<RegistrationData>(`/rsvp/register/${slug}`);
        setRsvpData(data);
        if (data.two_step) {
          setShowSplash(false);
          if (data.event.id === 72) setShowEnvelope(true);
        }
      } catch (err: any) {
        setError(err.detail || err.message || "Could not load event details");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug, showSplash]);

  const submitRsvp = async () => {
    if (!name.trim() || !phone.trim() || !email.trim() || !response || (isNFW && !category)) return;
    setSubmitting(true);
    setError("");
    try {
      await apiClient(`/rsvp/register/${slug}`, {
        method: "POST",
        body: { name: name.trim(), phone: fullPhoneNumber(countryCode, phone), email: email.trim(), response, category: isNFW ? category : "" },
      });
      setSubmitted(true);
    } catch (err: any) {
      const msg = err.detail || err.message || "";
      if (msg.toLowerCase().includes("already registered")) {
        setError("You have already registered for this event. No need to register again.");
      } else {
        setError(msg || "Failed to submit. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const submitDetails = async () => {
    if (!rsvpData) return;
    const isACAMB = rsvpData.event.id === 67;
    if (isACAMB) {
      if (!name.trim() || !phone.trim() || !email.trim() || !organization.trim() || !subDepartment.trim()) return;
    } else {
      if (!name.trim() || !phone.trim() || !email.trim()) return;
    }
    setTwoStepSubmitting(true);
    setError("");
    try {
      const body: any = {
        name: name.trim(),
        phone: fullPhoneNumber(countryCode, phone),
        email: email.trim(),
        response: "accepted",
      };
      if (isACAMB) {
        body.organization = organization.trim();
        body.sub_department = subDepartment.trim();
      }
      await apiClient(`/rsvp/register/${slug}`, { method: "POST", body });
      setTwoStepResponse("accepted");
      setStep("done");
    } catch (err: any) {
      const msg = err.detail || err.message || "";
      if (msg.toLowerCase().includes("already registered")) {
        setError("You have already registered for this event. No need to register again.");
      } else {
        setError(msg || "Failed to submit. Please try again.");
      }
    } finally {
      setTwoStepSubmitting(false);
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

  if (showEnvelope && rsvpData) {
    const ev = rsvpData.event;
    return (
      <EnvelopeSplash
        eventTitle={ev.title}
        celebrantName={ev.id === 72 ? "Annette" : ev.host_name}
        eventDate={formatDate(ev.date)}
        coverImage={ev.cover_image}
        onMusicStart={startBirthdayMusic}
        onOpen={() => setShowEnvelope(false)}
      />
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
          <p className="mt-2 text-slate-500">{error || "This registration link is invalid or the event has ended."}</p>
        </div>
      </div>
    );
  }

  if (rsvpData.event.registration_open === false) {
    const closedEvent = rsvpData!.event;
    return (
      <div className="min-h-screen bg-[#f8f9fc] px-4 py-12 sm:py-16">
        <div className="max-w-lg mx-auto">
          <div className="rounded-2xl bg-white shadow-lg overflow-hidden">
{(closedEvent.cover_image || closedEvent.flyer_url) && (
  <img src={closedEvent.cover_image || closedEvent.flyer_url || undefined} alt={closedEvent.title} className="w-full h-auto object-contain" />
)}
            <div className="p-6 sm:p-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
                <X className="w-8 h-8 text-amber-600" />
              </div>
              <h1 className="text-2xl font-bold text-[#0D1B2A]">Registration Closed</h1>
              <p className="mt-3 text-slate-600 leading-relaxed">
                Registration for <strong>{closedEvent.title}</strong> is no longer open.
                We appreciate your interest.
              </p>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-slate-400">
            Powered by <span className="font-semibold" style={{ color: closedEvent.theme_color }}>Accredit Interactive</span>
          </p>
        </div>
      </div>
    );
  }

  // ---------- Two-step flow (ACAMB event 67 / Annette event 72) ----------
  if (isTwoStep) {
    const event = rsvpData!.event;
    const isACAMB = event.id === 67;

    if (step === "done") {
      const accepted = twoStepResponse === "accepted";
      return (<>
        <div className="min-h-screen bg-[#0D1B2A] px-4 py-12 sm:py-16">
          <div className="max-w-lg mx-auto">
            <div className="rounded-2xl bg-white shadow-lg overflow-hidden">
{(event.cover_image || event.flyer_url) && (
  <img src={event.cover_image || event.flyer_url || undefined} alt={event.title} className="w-full h-auto object-contain" />
)}
              <div className="p-6 sm:p-8 text-center">
                {accepted ? (
                  <>
                    {event.id === 72 && event.cover_image && (
                      <img
                        src={event.cover_image}
                        alt={event.host_name}
                        className="w-20 h-20 rounded-full object-cover mx-auto mb-4 border-3"
                        style={{ borderColor: themeColor }}
                      />
                    )}
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
                      <Check className="w-8 h-8 text-blue-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-[#0D1B2A]">Registration Received</h1>
                    <div className="mt-6 bg-rose-50 border border-rose-200 rounded-xl p-5 text-left">
                      <p className="text-sm font-semibold text-slate-800 mb-2">What happens next?</p>
                      <ul className="text-sm text-slate-700 space-y-2 list-disc list-inside leading-relaxed">
                        <li>Your registration details have been received and your event access is being processed.</li>
                        <li>Once processed, your QR code will be sent via email or WhatsApp ahead of the event.</li>
                        <li>This QR code is your access to the venue.</li>
                        <li>Entry to the venue is strictly by valid QR access code.</li>
                      </ul>
                    </div>
                    <div className="mt-6 rounded-xl bg-slate-50 border border-slate-200 p-4 text-left space-y-3">
                      <div className="flex items-center gap-2.5 text-sm text-slate-600">
                        <Calendar className="w-4 h-4 flex-shrink-0" style={{ color: themeColor }} />
                        <span><strong>Date:</strong> {formatDate(event.date)}</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-sm text-slate-600">
                        <Clock className="w-4 h-4 flex-shrink-0" style={{ color: themeColor }} />
                        <span><strong>Time:</strong> {formatTime(event.time)}</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-sm text-slate-600">
                        <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: themeColor }} />
                        <span><strong>Venue:</strong> {event.venue}</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-sm text-slate-600">
                        <User className="w-4 h-4 flex-shrink-0" style={{ color: themeColor }} />
                        <span><strong>Host:</strong> {event.host_name}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50">
                      <X className="w-8 h-8 text-rose-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-[#0D1B2A]">Thank You For Your Response</h1>
                    <p className="mt-3 text-slate-600 leading-relaxed">
                      We appreciate you letting us know. We hope to see you at a future event!
                    </p>
                  </>
                )}
              </div>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-white/40">
          Powered by <span className="font-semibold" style={{ color: themeColor }}>Accredit Interactive</span>
        </p>
      </div>
      {musicStartedRef.current && (
        <button onClick={toggleMusic} className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all" style={{ backgroundColor: themeColor }}>
          {musicPlaying
            ? <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
            : <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
        </button>
      )}
      </>);
    }

    if (step === "attendance") {
      return (<>
        <div className="min-h-screen bg-[#f8f9fc]">
          <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
            <div className="rounded-2xl bg-white border border-slate-200 shadow-lg overflow-hidden">
{(event.id !== 72 && (event.cover_image || event.flyer_url)) && (
  <img src={event.cover_image || event.flyer_url || undefined} alt={event.title} className="w-full h-auto object-contain" />
)}
              <div className="p-6 sm:p-8">
                <div className="text-center mb-6">
                  {event.id === 72 && event.cover_image && (
                    <div className="mb-4">
                      <img
                        src={event.cover_image}
                        alt={event.host_name}
                        className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover mx-auto border-4 shadow-lg"
                        style={{ borderColor: themeColor }}
                      />
                    </div>
                  )}
                  <h1 className={`${event.id === 72 ? "text-lg" : "text-2xl"} font-bold text-[#0D1B2A]`}>{event.title}</h1>
                  <p className="text-sm text-slate-500 mt-1">Please confirm your attendance below</p>
                  {event.dress_code && (
                    <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 border border-slate-200">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dress Code:</span>
                      <span className="text-sm font-bold text-[#0D1B2A]">{event.dress_code}</span>
                    </div>
                  )}
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
                  <p className="text-center text-lg font-semibold text-[#0D1B2A]">
                    Will you be attending?
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => { setTwoStepResponse("accepted"); setStep("details"); }}
                      className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold text-base bg-emerald-600 text-white shadow-lg ring-2 ring-emerald-600 ring-offset-2"
                    >
                      <Check className="w-5 h-5" />
                      Yes, I Will Attend
                    </button>
                    <button
                      type="button"
                      onClick={() => { setTwoStepResponse("declined"); setStep("done"); }}
                      className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold text-base bg-red-600 text-white shadow-lg ring-2 ring-red-600 ring-offset-2"
                    >
                      <X className="w-5 h-5" />
                      Sorry, Cannot Attend
                    </button>
                  </div>
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
        {musicStartedRef.current && (
          <button onClick={toggleMusic} className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all" style={{ backgroundColor: themeColor }}>
            {musicPlaying
              ? <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
              : <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
          </button>
        )}
      </>);
    }

    // step === "details"
    const canSubmit = isACAMB
      ? name.trim() && phone.trim() && email.trim() && organization.trim() && subDepartment.trim()
      : name.trim() && phone.trim() && email.trim();
    return (<>
      <div className="min-h-screen bg-[#f8f9fc]">
        <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
          <div className="rounded-2xl bg-white border border-slate-200 shadow-lg overflow-hidden">
            {(event.cover_image || event.flyer_url) && (
              <img src={event.cover_image || event.flyer_url || undefined} alt={event.title} className="w-full h-auto object-contain" />
            )}
            <div className="p-6 sm:p-8">
              <div className="text-center mb-6">
                <h1 className={`${event.id === 72 ? "text-lg" : "text-2xl"} font-bold text-[#0D1B2A]`}>{event.title}</h1>
                <p className="text-sm text-slate-500 mt-1">Please fill in your details to confirm attendance</p>
              </div>

              <div className="space-y-4">
                {error && (
                  <div className="rounded-xl bg-red-50 border border-red-200 p-3">
                    <p className="text-sm font-medium text-red-800">{error}</p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#0D1B2A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#0D1B2A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={countryCode}
                      onChange={e => setCountryCode(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-[#0D1B2A] focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]"
                    >
                      {COUNTRY_CODES.map(c => (
                        <option key={c.code} value={c.code}>{c.label}</option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="8012345678"
                      className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#0D1B2A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]"
                    />
                  </div>
                </div>

                {isACAMB && (
                  <>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                    <span className="inline-flex items-center gap-1.5"><Building className="w-3.5 h-3.5" /> Organization <span className="text-red-500">*</span></span>
                  </label>
                  <input
                    type="text"
                    value={organization}
                    onChange={e => setOrganization(e.target.value)}
                    placeholder="e.g. First Bank Nigeria"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#0D1B2A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                    <span className="inline-flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Sub Department <span className="text-red-500">*</span></span>
                  </label>
                  <input
                    type="text"
                    value={subDepartment}
                    onChange={e => setSubDepartment(e.target.value)}
                    placeholder="e.g. SPEC dept, Marketing & Comms"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#0D1B2A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]"
                  />
                </div>
                  </>
                )}

                <button
                  onClick={submitDetails}
                  disabled={!canSubmit || twoStepSubmitting}
                  className="w-full mt-4 flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold text-base text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: canSubmit ? themeColor : "#94a3b8" }}
                >
                  {twoStepSubmitting ? (
                    <><Loader className="w-5 h-5 animate-spin" /> Submitting...</>
                  ) : (
                    "Confirm Attendance"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep("attendance"); setTwoStepResponse(null); }}
                  className="w-full text-sm text-slate-400 hover:text-slate-600"
                >
                  Back
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
      {musicStartedRef.current && (
        <button onClick={toggleMusic} className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all" style={{ backgroundColor: themeColor }}>
          {musicPlaying
            ? <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
            : <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
        </button>
      )}
      </>);
  }

  // ---------- default single-page flow (other events) ----------
  const event = rsvpData!.event;
  const canSubmit = isNFW
      ? name.trim() && phone.trim() && email.trim() && response && category
      : name.trim() && phone.trim() && email.trim() && response;
  const fieldErrors: string[] = [];
  if (!name.trim()) fieldErrors.push("Full Name");
  if (!phone.trim()) fieldErrors.push("Phone Number");
  if (!email.trim()) fieldErrors.push("Email Address");
  if (!response) fieldErrors.push("Attendance Response");
  if (isNFW && !category) fieldErrors.push("Category");

  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
        <div className="rounded-2xl bg-white border border-slate-200 shadow-lg overflow-hidden">
          {(event.cover_image || event.flyer_url) && (
            <img src={event.cover_image || event.flyer_url || undefined} alt={event.title} className="w-full h-auto object-contain" />
          )}

          <div className="p-6 sm:p-8">
            <div className="text-center mb-6">
              <h1 className={`${event.id === 72 ? "text-lg" : "text-2xl"} font-bold text-[#0D1B2A]`}>{event.title}</h1>
              <p className="text-sm text-slate-500 mt-1">Please confirm your attendance below</p>
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
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Enter your full name"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#0D1B2A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#0D1B2A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]"
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
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#0D1B2A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]"
                />
              </div>

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
