"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUp,
  CalendarDays,
  ChevronDown,
  Clock,
  MapPin,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useInviteMusic } from "@/lib/invite-music";
import { COUNTRIES, flagEmoji } from "@/components/shared/phone-input";
import RsvpThanksModal from "@/components/rsvp/RsvpThanksModal";

/**
 * Engr. Obi & Dr. Blessing: 30th Wedding Anniversary (event 84).
 *
 * Standalone guest experience, scoped to this event only. The cover opens by
 * itself after a short beat (no tap), the film tells the story in their own
 * photographs, and "Ordinary" starts once and never restarts: one audio
 * element carries the whole visit, from the cover through to the RSVP.
 */

// Palette: the client's Image 4, applied to the page as directed.
// Purple carries the surface (60%), lavender the panels (25%), peach the
// accents and actions (15%), white the type and highlights.
const PURPLE = "#6E6FFA";
const INK = "#241C6B"; // deep violet: reading text on light, base of the dark
const INK_DEEP = "#1B1550";
const ACTION = "#6E6FFA"; // the purple itself, for rules and links on light
const ACTION_LIGHT = "#8A8BFC";
const LAV = "#E6E6FA";
const PEACH = "#FFDAB9";
const CREAM = "#FFFFFF";
const CREAM_SOFT = "#F4F4FE";
const MUTED = "#6B6B96";

// Fonts from the client's PDF: Urbanist is the exact typeface used there
// (sans), with Yellowtail and Great Vibes standing in for the two script
// faces so the page carries the same lettering as the printed invitation.
const BODY = "'AnnivUrbanist', 'Urbanist', system-ui, -apple-system, sans-serif";
const BRUSH = "'AnnivBrush', 'Yellowtail', cursive";
const SCRIPT = "'AnnivScript', 'Great Vibes', cursive";

const FONT_CSS = `
@font-face{font-family:'AnnivUrbanist';src:url('/fonts/urbanist.woff2') format('woff2');font-weight:100 900;font-style:normal;font-display:swap;}
@font-face{font-family:'AnnivBrush';src:url('/fonts/yellowtail.woff2') format('woff2');font-weight:400;font-style:normal;font-display:swap;}
@font-face{font-family:'AnnivScript';src:url('/fonts/greatvibes.woff2') format('woff2');font-weight:400;font-style:normal;font-display:swap;}
@keyframes annivFill{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes annivRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes annivFade{from{opacity:0}to{opacity:1}}
.anniv-rise{animation:annivRise 900ms cubic-bezier(0.22,1,0.36,1) both}
/* Page-level wrapper: opacity only. A transform here would become the
   containing block for the fixed header and drag it along on scroll. */
.anniv-fade{animation:annivFade 700ms ease both}
.anniv-script-lh{line-height:0.92;padding-bottom:0.12em}
.anniv-cover-half{position:absolute;inset:0;overflow:hidden}
`;

interface Props {
  slug: string;
  content: any;
  /** Present when the page is opened from a guest's personal RSVP link. */
  guestToken?: string;
  guest?: {
    name: string;
    email?: string | null;
    phone?: string | null;
    status?: string | null;
  } | null;
}

/* ------------------------------------------------------------- countdown */

function useCountdown(target?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return useMemo(() => {
    const end = target ? new Date(target).getTime() : 0;
    if (!end || Number.isNaN(end)) return null;
    let diff = Math.max(0, end - now);
    const days = Math.floor(diff / 86400000);
    diff -= days * 86400000;
    const hours = Math.floor(diff / 3600000);
    diff -= hours * 3600000;
    const minutes = Math.floor(diff / 60000);
    diff -= minutes * 60000;
    const seconds = Math.floor(diff / 1000);
    return { days, hours, minutes, seconds };
  }, [now, target]);
}

/**
 * Own component on purpose: the clock ticks every second, and letting it
 * re-render the whole invitation is what makes a phone stutter while it
 * scrolls. Only these four boxes ever change.
 */
function AnnivCountdown({ target }: { target?: string }) {
  const countdown = useCountdown(target);
  if (!countdown) return null;
  return (
    <div className="mt-14 grid grid-cols-4 gap-2 sm:gap-4">
      {[
        { v: countdown.days, l: "Days" },
        { v: countdown.hours, l: "Hours" },
        { v: countdown.minutes, l: "Minutes" },
        { v: countdown.seconds, l: "Seconds" },
      ].map((u) => (
        <div
          key={u.l}
          className="border py-5 text-center"
          style={{ borderColor: "rgba(230,230,250,0.18)" }}
        >
          <p
            style={{
              fontFamily: BODY,
              fontSize: "clamp(22px, 5vw, 34px)",
              color: CREAM,
              fontWeight: 300,
              // steady digit widths: a changing number must not nudge the box
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {String(u.v).padStart(2, "0")}
          </p>
          <p
            className="mt-2 text-[8.5px] uppercase"
            style={{ letterSpacing: "0.26em", color: "rgba(230,230,250,0.75)" }}
          >
            {u.l}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------- phone picker */

/**
 * Country code + number in one underline field.
 *
 * A native <select> is deliberately avoided: its widest option sets a
 * min-content width (flag + dial code + country name) that blows the field
 * past a phone screen and makes mobile browsers widen the whole page. Here
 * the trigger is only as wide as a flag and a dial code, and the list opens
 * in a panel over the form.
 */
function AnnivPhoneInput({
  dialCode,
  number,
  onDialCode,
  onNumber,
}: {
  dialCode: string;
  number: string;
  onDialCode: (code: string) => void;
  onNumber: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const selected =
    COUNTRIES.find((country) => country.code === dialCode) || COUNTRIES[0];

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 60);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    const digits = query.trim().replace(/\D/g, "");
    if (!text) return COUNTRIES;
    return COUNTRIES.filter(
      (country) =>
        country.name.toLowerCase().includes(text) ||
        country.iso.toLowerCase().includes(text) ||
        (digits && country.code.replace(/\D/g, "").startsWith(digits))
    );
  }, [query]);

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-2 border-b" style={{ borderColor: "#C9C9E8" }}>
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setOpen((value) => !value);
          }}
          aria-label="Choose country code"
          className="flex h-12 flex-shrink-0 items-center gap-1.5 pr-2 text-[13px]"
          style={{ color: INK }}
        >
          <span className="text-[15px] leading-none">{flagEmoji(selected.iso)}</span>
          <span>{selected.code}</span>
          <ChevronDown size={13} style={{ color: MUTED }} />
        </button>
        <input
          value={number}
          onChange={(event) => onNumber(event.target.value)}
          placeholder="801 234 5678"
          inputMode="tel"
          className="h-12 min-w-0 flex-1 bg-transparent text-[15px] outline-none"
          style={{ color: INK }}
        />
      </div>

      {open && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden border shadow-xl"
          style={{ borderColor: "#C9C9E8", background: "#FFFFFF" }}
        >
          <div className="border-b p-2" style={{ borderColor: "#E6E6FA" }}>
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search country or code"
              className="h-10 w-full border px-3 text-[14px] outline-none"
              style={{ borderColor: "#C9C9E8", background: CREAM_SOFT, color: INK }}
            />
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="px-4 py-3 text-[13px]" style={{ color: MUTED }}>
                No match found
              </p>
            )}
            {filtered.map((country) => (
              <button
                key={`${country.iso}-${country.code}`}
                type="button"
                onClick={() => {
                  onDialCode(country.code);
                  setOpen(false);
                  setQuery("");
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13.5px]"
                style={{ color: INK }}
              >
                <span className="w-5 text-[15px] leading-none">{flagEmoji(country.iso)}</span>
                <span className="min-w-0 flex-1 truncate">{country.name}</span>
                <span className="flex-shrink-0" style={{ color: ACTION }}>
                  {country.code}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ page */

export default function AnniversaryRSVP({ slug, content, guestToken, guest }: Props) {
  const c = content || {};
  const poster: string = c.invite_poster_url || c.hero_image || "";
  // Client directive (2026-10-26): the experience opens on the "thirty years"
  // poster, so the cover has its own artwork. The invitation below keeps the
  // traditional attire portrait in the hero.
  const coverPoster: string = c.cover_poster_url || poster;
  const film: string = c.invite_video_url || c.video_url || "";
  const groom: string = c.groom || "Engr. Obi";
  const bride: string = c.bride || "Dr. Blessing";
  // No family surname: the client's invitation names the couple only, so the
  // line under the names states the occasion instead of inventing a name.
  const occasion: string = c.occasion || "30th Wedding Anniversary";
  const ceremony = c.ceremony || {};
  const dress = c.dress_code || {};
  const photos: { url: string; caption: string; note: string; width?: number; height?: number }[] =
    c.photos && c.photos.length
      ? c.photos
      : [
          { url: "/uploads/anniv-g1.jpg?v=3", caption: "Still them", note: "Thirty years on" },
          { url: "/uploads/anniv-g3.jpg?v=3", caption: "Out and about", note: "Somewhere warm" },
          { url: "/uploads/anniv-g4.jpg?v=3", caption: "Laughing", note: "Still" },
          { url: "/uploads/anniv-g5.jpg?v=3", caption: "Dressed up", note: "Ready to celebrate" },
          { url: "/uploads/anniv-g6.jpg?v=3", caption: "The family", note: "All of us, together" },
        ];

  // One companion rides on the guest's own pass (same rule as the gala).
  const plusOneNote: string =
    c.plus_one?.note || "Your invitation admits two: you and one companion.";

  const [phase, setPhase] = useState<"cover" | "film" | "invitation">(() => {
    try {
      // Preview hook (no guest-facing effect).
      if (
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("view") === "invitation"
      ) {
        return "invitation";
      }
      if (sessionStorage.getItem(`anniv-entered-${slug}`) === "1") return "invitation";
      return "cover";
    } catch {
      return "cover";
    }
  });
  const [opening, setOpening] = useState(false);
  const [filmStalled, setFilmStalled] = useState(false);
  // "Ordinary" belongs to the visit, not to this component. One audio element
  // lives in `invite-music`, started on the welcome screen before this page
  // mounts, and keeps playing through the cover, the film and the invitation.
  // Only the guest's own Sound button stops it.
  const music = useInviteMusic(c.music_url);
  const musicUrl: string = c.music_url || "";
  const [showTop, setShowTop] = useState(false);

  const filmRef = useRef<HTMLVideoElement | null>(null);

  const [name, setName] = useState(guest?.name || "");
  const [email, setEmail] = useState(guest?.email || "");
  const [phone, setPhone] = useState("");
  const [dialCode, setDialCode] = useState("+234");
  const [attendance, setAttendance] = useState<"yes" | "no" | null>(null);
  const [plusOne, setPlusOne] = useState(false);
  const [plusOneName, setPlusOneName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(
    guest?.status === "accepted" || guest?.status === "declined"
  );
  const [declined, setDeclined] = useState(guest?.status === "declined");
  const [thanksOpen, setThanksOpen] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const countdownEl = <AnnivCountdown target={c.countdown_to} />;

  /* ------------------------------------------------------------- music */

  // The song is already running from the welcome screen. Nothing here starts,
  // restarts or resumes it on a timer or gesture: the only control is the
  // guest's own Sound button.
  const soundAction = music.audible ? "Turn the music off" : "Turn the music on";

  /* -------------------------------------------------------------- cover */

  // The invitation opens itself: 3.6s on the client's flier, then the cover
  // parts down the middle onto the film.
  useEffect(() => {
    if (phase !== "cover") return;
    const part = setTimeout(() => {
      setOpening(true);
      const v = filmRef.current;
      if (v) {
        v.muted = true;
        v.play().catch(() => setFilmStalled(true));
      }
    }, 3600);
    const reveal = setTimeout(() => setPhase("film"), 4750);
    return () => {
      clearTimeout(part);
      clearTimeout(reveal);
    };
  }, [phase]);

  const enterInvitation = useCallback(() => {
    setPhase("invitation");
    try {
      sessionStorage.setItem(`anniv-entered-${slug}`, "1");
    } catch {
      /* ignore */
    }
  }, [slug]);

  // "Watch the Invitation" plays the montage again. The gate is a fixed overlay,
  // so the guest keeps their place in the invitation, the song never breaks, and
  // the film hands them back to the same spot when it ends.
  const replayRef = useRef(false);
  const watchFilm = useCallback(() => {
    if (!film) return;
    replayRef.current = true;
    setFilmStalled(false);
    setPhase("film");
  }, [film]);

  useEffect(() => {
    if (phase === "invitation") return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "film") return;
    const v = filmRef.current;
    if (!v) return;
    // A replay starts the montage from the top; the first pass already played
    // under the parting cover, so it carries on where it is.
    if (replayRef.current) {
      replayRef.current = false;
      try {
        v.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    setFilmStalled(false);
    v.muted = true;
    v.play().catch(() => setFilmStalled(true));
    const guard = setTimeout(() => {
      if (v.paused) setFilmStalled(true);
    }, 2200);
    return () => clearTimeout(guard);
  }, [phase]);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 620);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* --------------------------------------------------------------- RSVP */

  const submit = async (response: "yes" | "no") => {
    setError("");
    setAttendance(response);
    const wantsCompanion = plusOne && Boolean(c.plus_one?.allowed ?? true);
    if (response === "yes" && wantsCompanion && !plusOneName.trim()) {
      setError("Please add the name of the companion joining you.");
      setAttendance(null);
      return;
    }
    if (guestToken) {
      // Personal link: this guest is already on the list, so the reply is
      // recorded against their own row. Nothing to re-enter.
      setSubmitting(true);
      try {
        await apiClient(`/rsvp/${guestToken}`, {
          method: "POST",
          body: {
            response: response === "yes" ? "yes" : "no",
            plus_one: response === "yes" ? wantsCompanion : false,
            plus_one_name:
              response === "yes" && wantsCompanion ? plusOneName.trim() : "",
          },
        });
        setDeclined(response === "no");
        setDone(true);
      } catch (err: any) {
        setError(
          err?.detail || err?.message || "We could not send your reply. Please try again."
        );
        setAttendance(null);
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (response === "no") {
      // A public "no" asks for nothing: no form, no guest record, just a short
      // note. Personal links keep the existing reply record + change response.
      setSubmitting(true);
      try {
        await apiClient(`/rsvp/register/${slug}`, {
          method: "POST",
          body: { name: "", email: "", phone: "", response: "declined" },
        });
        setAttendance(null);
        setThanksOpen(true);
      } catch (err: any) {
        setError(
          err?.detail || err?.message || "We could not send your reply. Please try again."
        );
        setAttendance(null);
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (response === "yes") {
      if (!name.trim()) {
        setError("Please tell us your full name.");
        setAttendance(null);
        return;
      }
      if (!email.trim() && !phone.trim()) {
        setError("Please add an email address or a phone number.");
        setAttendance(null);
        return;
      }
    }
    setSubmitting(true);
    try {
      await apiClient(`/rsvp/register/${slug}`, {
        method: "POST",
        body: {
          name: name.trim(),
          email: email.trim(),
          phone: phone ? `${dialCode}${phone.replace(/\D/g, "")}` : "",
          response: "accepted",
          plus_one: wantsCompanion,
          plus_one_name: wantsCompanion ? plusOneName.trim() : "",
        },
      });
      setDeclined(false);
      setDone(true);
    } catch (err: any) {
      setError(
        err?.detail || err?.message || "We could not send your reply. Please try again."
      );
      setAttendance(null);
    } finally {
      setSubmitting(false);
    }
  };

  /* ----------------------------------------------------------- calendar */

  const mapsUrl =
    "https://www.google.com/maps/dir/?api=1&destination=" +
    encodeURIComponent(
      `${ceremony.venue || "Landmark Centre"} ${ceremony.location || "Victoria Island Lagos"}`
    );

  const icsHref = useMemo(() => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Accredit Interactive//Anniversary//EN",
      "BEGIN:VEVENT",
      "UID:nelkon-blessing-30th@accredit.vip",
      "DTSTAMP:20261022T000000Z",
      "DTSTART:20261215T140000Z",
      "DTEND:20261215T190000Z",
      `SUMMARY:${groom} & ${bride} 30th Wedding Anniversary`,
      `LOCATION:${ceremony.venue || "Landmark Centre"}, ${ceremony.location || "Victoria Island, Lagos"}`,
      "DESCRIPTION:Thirty years. Please join us to celebrate.",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    return "data:text/calendar;charset=utf-8," + encodeURIComponent(ics);
  }, [groom, bride, ceremony.venue, ceremony.location]);

  /* -------------------------------------------------------- opening gate */

  const gate =
    phase !== "invitation" ? (
      <div className="fixed inset-0 z-[95] overflow-hidden" style={{ background: "#140F3C" }}>
        <video
          ref={filmRef}
          src={film}
          poster={phase === "film" ? coverPoster : undefined}
          playsInline
          muted
          preload="auto"
          className="absolute inset-0 h-full w-full object-contain"
          onEnded={enterInvitation}
          onError={enterInvitation}
          onPlaying={() => setFilmStalled(false)}
        />

        {filmStalled && (
          <button
            onClick={() => {
              const v = filmRef.current;
              if (!v) return;
              v.muted = true;
              v.play()
                .then(() => setFilmStalled(false))
                .catch(() => {});
            }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4"
            style={{ background: "rgba(20,15,60,0.72)" }}
            aria-label="Play the anniversary film"
          >
            <span
              className="flex h-20 w-20 items-center justify-center rounded-full text-2xl"
              style={{ background: PEACH, color: INK }}
            >
              &#9654;
            </span>
            <span
              className="text-[11px] uppercase"
              style={{ letterSpacing: "0.28em", color: CREAM }}
            >
              Tap to play
            </span>
          </button>
        )}

        {phase === "cover" && (
          <>
            {/* The cover: the "thirty years" poster artwork above, the words on
                a purple panel beneath, so the picture, "Together since 1996",
                the names and the date all read inside one phone screen. Two
                copies of the same composition are clipped down the middle and
                part like a curtain when the invitation opens by itself. */}
            {(["left", "right"] as const).map((side) => (
              <div
                key={side}
                aria-hidden
                className="anniv-cover-half"
                style={{
                  background: `linear-gradient(to bottom, ${PURPLE} 0%, #5A5BEA 100%)`,
                  clipPath: side === "left" ? "inset(0 50% 0 0)" : "inset(0 0 0 50%)",
                  transform: opening
                    ? `translateX(${side === "left" ? "-100%" : "100%"})`
                    : "none",
                  transition: "transform 1150ms cubic-bezier(0.76, 0, 0.24, 1)",
                  willChange: "transform",
                }}
              >
                <div className="absolute inset-0 flex flex-col md:block">
                  <div className="relative flex h-[50svh] w-full flex-none items-center justify-center overflow-hidden px-4 md:absolute md:inset-y-0 md:left-auto md:right-0 md:h-full md:w-[54%] md:px-8">
                    {coverPoster && (
                      <img
                        src={coverPoster}
                        alt={`${groom} and ${bride}`}
                        width={1166}
                        height={1165}
                        className="h-auto w-auto max-h-full max-w-full"
                        style={{
                          // The whole poster, never a crop. A cover crop put the
                          // edge of the frame through the man, so the picture now
                          // sits complete on the purple field at every width.
                          objectFit: "contain",
                          boxShadow: "0 30px 80px rgba(20,15,60,0.45)",
                          border: "1px solid rgba(230,230,250,0.22)",
                        }}
                      />
                    )}
                  </div>

                  <div
                    className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-8 pt-2 text-center md:absolute md:inset-y-0 md:left-0 md:right-[54%] md:px-12 md:pb-0 md:pt-0 md:text-left"
                    style={{
                      // One gradient for the whole cover, so the photograph and
                      // the words share the same field with no seam between them.
                      background: "transparent",
                      opacity: opening ? 0 : 1,
                      transition: "opacity 380ms ease",
                    }}
                  >
                  <p
                    className="anniv-rise text-[9.5px] uppercase sm:text-[10.5px]"
                    style={{ letterSpacing: "0.42em", color: LAV, animationDelay: "200ms" }}
                  >
                    Together since {c.since || "1996"}
                  </p>
                  <h1
                    className="anniv-rise anniv-script-lh mt-3 flex flex-wrap items-baseline justify-center gap-x-2 md:justify-start"
                    style={{
                      fontFamily: SCRIPT,
                      // Sized for the whole name, not a first name: the client's
                      // "Engr. Obi & Dr. Blessing" has to sit on one line on a
                      // phone, and wraps in two balanced lines when it cannot.
                      fontSize: "clamp(34px, 9vw, 66px)",
                      color: CREAM,
                      textShadow: "0 6px 40px rgba(20,15,60,0.35)",
                      animationDelay: "420ms",
                    }}
                  >
                    <span>{groom}</span>
                    <span style={{ color: PEACH }}>&amp;</span>
                    <span>{bride}</span>
                  </h1>
                  <p
                    className="anniv-rise mt-2 text-[10px] uppercase sm:text-[11px]"
                    style={{ letterSpacing: "0.36em", color: CREAM, animationDelay: "700ms" }}
                  >
                    {occasion}
                  </p>
                  <span
                    className="anniv-rise mt-4 block h-px w-16"
                    style={{ background: PEACH, opacity: 0.85, animationDelay: "850ms" }}
                  />
                  <p
                    className="anniv-rise mt-4 text-[10px] uppercase sm:text-[11px]"
                    style={{
                      letterSpacing: "0.3em",
                      color: "rgba(255,255,255,0.92)",
                      animationDelay: "1000ms",
                    }}
                  >
                    {ceremony.date || "Tuesday, December 15, 2026"}
                  </p>

                  {/* The invitation opens by itself. */}
                  <div
                    className="mt-6 h-px w-40 overflow-hidden"
                    style={{ background: "rgba(230,230,250,0.3)" }}
                  >
                    <span
                      className="block h-px w-full"
                      style={{
                        background: PEACH,
                        transformOrigin: "left center",
                        animation: "annivFill 3.5s linear forwards",
                        opacity: opening ? 0 : 1,
                      }}
                    />
                  </div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* No sound control over the film: the client asked for the floating
            speaker to go. The music itself is untouched and still plays from
            the first frame; the guest can mute it from the header once the
            invitation is open. */}
      </div>
    ) : null;

  /* ---------------------------------------------------------------- page */

  return (
    <div style={{ fontFamily: BODY, background: CREAM, color: INK }}>
      <style dangerouslySetInnerHTML={{ __html: FONT_CSS }} />

      {gate}

      {phase === "invitation" && (
        <div className="anniv-fade">
          {/* ---------------------------------------------------- header */}
          <header
            className="fixed inset-x-0 top-0 z-50 transition-colors duration-300"
            style={{
              // No backdrop blur: on phones it repaints the whole page on every
              // scroll frame and reads as jumping content. A solid tint is
              // cheaper and looks the same over a dark page.
              background: showTop ? "rgba(27,21,80,0.94)" : "transparent",
              borderBottom: showTop ? "1px solid rgba(230,230,250,0.14)" : "1px solid transparent",
            }}
          >
            <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="flex items-center gap-3"
                aria-label="Back to the top of the invitation"
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full border text-[11px]"
                  style={{ borderColor: "rgba(230,230,250,0.5)", color: CREAM }}
                >
                  OB
                </span>
                <span
                  className="hidden text-[12px] sm:block"
                  style={{ fontFamily: SCRIPT, color: CREAM, fontSize: "20px" }}
                >
                  {groom} &amp; {bride}
                </span>
              </button>
              <div className="flex items-center gap-2 sm:gap-3">
                {musicUrl && (
                  <button
                    onClick={music.toggle}
                    aria-label={soundAction}
                    className="flex h-10 w-10 items-center justify-center rounded-full border transition-colors"
                    style={{
                      borderColor: music.audible
                        ? "rgba(230,230,250,0.55)"
                        : "rgba(230,230,250,0.28)",
                      background: music.audible
                        ? "rgba(75,75,216,0.65)"
                        : "rgba(255,255,255,0.06)",
                      color: CREAM,
                    }}
                  >
                    {music.audible ? <Volume2 size={15} /> : <VolumeX size={15} />}
                  </button>
                )}
                <a
                  href="#rsvp"
                  className="rounded-full px-5 py-2.5 text-[10px] uppercase transition-colors"
                  style={{ letterSpacing: "0.24em", background: PEACH, color: INK, fontWeight: 600 }}
                >
                  RSVP
                </a>
              </div>
            </div>
          </header>

          {/* ------------------------------------------------------ hero */}
          <section
            className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden px-6 pb-16 pt-24 sm:px-8 lg:pt-28"
            style={{ background: `linear-gradient(180deg, ${PURPLE} 0%, #5A5BEA 58%, #4B4BD8 100%)` }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 26% 18%, rgba(230,230,250,0.24), transparent 58%), radial-gradient(circle at 88% 82%, rgba(255,218,185,0.16), transparent 55%)",
              }}
            />
            <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[0.85fr_1fr] lg:gap-16">
              <div className="flex justify-center">
                {poster && (
                  <img
                    src={poster}
                    alt={`${groom} and ${bride}`}
                    width={1200}
                    height={1500}
                    className="w-full max-w-[300px] sm:max-w-[340px] lg:max-w-[400px]"
                    style={{
                      boxShadow: "0 40px 90px rgba(20,15,60,0.45)",
                      borderRadius: "2px",
                      // space reserved before the file arrives, so nothing jumps
                      aspectRatio: "1200 / 1500",
                      objectFit: "cover",
                      objectPosition: "center 26%",
                    }}
                  />
                )}
              </div>

              <div className="text-center lg:text-left">
                <p
                  className="text-[9.5px] uppercase sm:text-[11px]"
                  style={{ letterSpacing: "0.44em", color: LAV }}
                >
                  Together since {c.since || "1996"}
                </p>
                <h1
                  className="anniv-script-lh mt-4 flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 lg:justify-start"
                  style={{
                    fontFamily: SCRIPT,
                    // The full names on a phone, and two balanced lines rather
                    // than one squeezed line on a wide screen.
                    fontSize: "clamp(34px, 7.4vw, 58px)",
                    color: CREAM,
                  }}
                >
                  <span>{groom}</span>
                  <span style={{ color: PEACH }}>&amp;</span>
                  <span>{bride}</span>
                </h1>
                <p
                  className="mt-2 text-[10px] uppercase sm:text-[11.5px]"
                  style={{ letterSpacing: "0.4em", color: CREAM }}
                >
                  {occasion}
                </p>
                <div className="mt-6 flex items-center justify-center gap-3 lg:justify-start">
                  <span className="block h-px w-12" style={{ background: PEACH, opacity: 0.85 }} />
                  <span className="block h-1.5 w-1.5 rotate-45" style={{ background: PEACH }} />
                  <span className="block h-px w-12" style={{ background: PEACH, opacity: 0.85 }} />
                </div>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 lg:justify-start">
                  <span
                    className="text-[10px] uppercase sm:text-[11px]"
                    style={{ letterSpacing: "0.28em", color: "rgba(255,255,255,0.9)" }}
                  >
                    {ceremony.date || "Tuesday, December 15, 2026"}
                  </span>
                  <span className="hidden h-3 w-px sm:block" style={{ background: "rgba(230,230,250,0.45)" }} />
                  <span
                    className="text-[10px] uppercase sm:text-[11px]"
                    style={{ letterSpacing: "0.28em", color: "rgba(255,255,255,0.9)" }}
                  >
                    {ceremony.time || "3:00 PM"}
                  </span>
                  <span className="hidden h-3 w-px sm:block" style={{ background: "rgba(230,230,250,0.45)" }} />
                  <span
                    className="text-[10px] uppercase sm:text-[11px]"
                    style={{ letterSpacing: "0.28em", color: "rgba(255,255,255,0.9)" }}
                  >
                    Victoria Island, Lagos
                  </span>
                </div>
                <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center lg:justify-start">
                  <a
                    href="#rsvp"
                    className="inline-flex h-12 items-center justify-center px-8 text-[10.5px] uppercase transition-transform hover:scale-[1.02]"
                    style={{
                      letterSpacing: "0.24em",
                      background: PEACH,
                      color: INK,
                      fontWeight: 600,
                    }}
                  >
                    RSVP
                  </a>
                  {/* The house pattern for every montage event: the film can be
                      watched again from the invitation, and the song never
                      restarts when it does. */}
                  {film && (
                    <button
                      type="button"
                      onClick={watchFilm}
                      className="inline-flex h-12 items-center justify-center gap-2.5 border px-6 text-[10.5px] uppercase transition-colors hover:bg-white/10"
                      style={{
                        letterSpacing: "0.22em",
                        borderColor: "rgba(255,218,185,0.6)",
                        color: CREAM,
                      }}
                    >
                      <Play size={12} /> Watch the Invitation
                    </button>
                  )}
                </div>
                <a
                  href="#letter"
                  className="mt-6 inline-flex items-center gap-3 text-[10px] uppercase"
                  style={{ letterSpacing: "0.3em", color: PEACH }}
                >
                  Read the invitation
                  <span className="block h-px w-10" style={{ background: PEACH, opacity: 0.7 }} />
                </a>
              </div>
            </div>
          </section>

          {/* ---------------------------------------------------- letter */}
          <section id="letter" className="relative overflow-hidden px-6 py-20 sm:py-28" style={{ background: CREAM }}>
            <div
              className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full"
              style={{ background: "radial-gradient(circle, rgba(230,230,250,0.75), transparent 70%)" }}
            />
            <div className="relative mx-auto max-w-2xl text-center">
              <p
                className="text-[9.5px] uppercase sm:text-[10.5px]"
                style={{ letterSpacing: "0.42em", color: "#4B4BD8" }}
              >
                Please join us to celebrate
              </p>
              <h2
                className="anniv-script-lh mt-5"
                style={{ fontFamily: SCRIPT, fontSize: "clamp(30px, 6.6vw, 50px)", color: INK }}
              >
                {groom} and {bride}
              </h2>
              <p
                className="mt-4 text-[12px] uppercase sm:text-[13px]"
                style={{ letterSpacing: "0.4em", color: MUTED }}
              >
                30th Anniversary
              </p>
              <div className="mx-auto mt-8 flex items-center justify-center gap-3">
                <span className="block h-px w-16" style={{ background: PEACH }} />
                <span className="block h-1.5 w-1.5 rotate-45" style={{ background: "#4B4BD8" }} />
                <span className="block h-px w-16" style={{ background: PEACH }} />
              </div>
              <p className="mx-auto mt-8 max-w-xl text-[15px] leading-relaxed" style={{ color: "#3A3470" }}>
                {c.hero_line ||
                  "Celebrating 30 beautiful years of love, laughter and lifelong companionship."}
              </p>
            </div>
          </section>

          {/* --------------------------------------------------- gallery */}
          <section id="gallery" className="px-5 py-20 sm:px-8 sm:py-24" style={{ background: LAV }}>
            <div className="mx-auto max-w-6xl">
              <div className="text-center">
                <p
                  className="text-[9.5px] uppercase sm:text-[10.5px]"
                  style={{ letterSpacing: "0.42em", color: "#4B4BD8" }}
                >
                  A life together
                </p>
                <h2
                  className="anniv-script-lh mt-4"
                  style={{ fontFamily: SCRIPT, fontSize: "clamp(34px, 6.5vw, 52px)", color: INK }}
                >
                  Thirty years of us
                </h2>
                <span
                  className="mx-auto mt-6 block h-px w-16"
                  style={{ background: PEACH }}
                />
              </div>

              <div className="mt-10 flex flex-wrap justify-center gap-3 sm:mt-12 sm:gap-5">
                {photos.map((p) => (
                  <figure key={p.url} className="w-[calc(50%-0.375rem)] min-w-0 sm:w-[calc(33.333%-0.834rem)]">
                    <div className="overflow-hidden" style={{ background: "#C9C9F0" }}>
                      <img
                        src={p.url}
                        alt={p.caption}
                        loading="lazy"
                        width={p.width || 900}
                        height={p.height || 1125}
                        className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.03]"
                        style={{
                          // The box exists before the bytes do, so the page never
                          // reflows under a scrolling thumb.
                          aspectRatio: `${p.width || 900} / ${p.height || 1125}`,
                        }}
                      />
                    </div>
                    <figcaption className="mt-3">
                      <p
                        className="anniv-script-lh"
                        style={{ fontFamily: SCRIPT, fontSize: "21px", color: INK, lineHeight: 1.05 }}
                      >
                        {p.caption}
                      </p>
                      <p
                        className="mt-1 text-[9px] uppercase"
                        style={{ letterSpacing: "0.26em", color: "#55558A" }}
                      >
                        {p.note}
                      </p>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </section>

          {/* ------------------------------------------------ quote band */}
          <section
            id="quote"
            className="relative overflow-hidden"
            style={{ background: `linear-gradient(180deg, ${PURPLE} 0%, #5A5BEA 100%)` }}
          >
            {/* Photograph and words sit side by side on a wide screen and one
                above the other on a phone, so no copy is ever laid over a
                face. */}
            <div className="mx-auto flex max-w-6xl flex-col md:min-h-[68svh] md:flex-row md:items-stretch">
              <div className="order-1 md:order-2 md:w-[58%]">
                <img
                  src="/uploads/anniv-quote.jpg?v=2"
                  alt={`${groom} and ${bride}`}
                  loading="lazy"
                  className="aspect-[3/2] h-full w-full object-cover md:aspect-auto"
                  style={{ objectPosition: "center 45%" }}
                />
              </div>
              <blockquote className="order-2 flex flex-1 flex-col justify-center px-6 py-14 text-center md:order-1 md:px-14 md:text-left">
                <p
                  style={{
                    fontFamily: SCRIPT,
                    fontSize: "clamp(28px, 6vw, 46px)",
                    color: CREAM,
                    lineHeight: 1.25,
                  }}
                >
                  Thirty years of love, laughter and lifelong companionship.
                </p>
                <footer
                  className="mt-6 text-[9.5px] uppercase"
                  style={{ letterSpacing: "0.4em", color: PEACH }}
                >
                  {groom} &amp; {bride}
                </footer>
              </blockquote>
            </div>
          </section>

          {/* ------------------------------------------------------ day */}
          <section id="day" className="px-6 py-20 sm:py-24" style={{ background: INK_DEEP }}>
            <div className="mx-auto max-w-5xl">
              <div className="text-center">
                <p
                  className="text-[9.5px] uppercase sm:text-[10.5px]"
                  style={{ letterSpacing: "0.42em", color: LAV }}
                >
                  The celebration
                </p>
                <h2
                  className="anniv-script-lh mt-4"
                  style={{ fontFamily: SCRIPT, fontSize: "clamp(36px, 7vw, 56px)", color: CREAM }}
                >
                  {ceremony.date || "Tuesday, December 15, 2026"}
                </h2>
              </div>

              <div className="mt-12 grid gap-4 sm:grid-cols-3">
                {[
                  {
                    icon: <CalendarDays size={16} />,
                    label: "Date",
                    value: ceremony.date || "Tuesday, December 15, 2026",
                  },
                  {
                    icon: <Clock size={16} />,
                    label: "Time",
                    value: ceremony.time || "3:00 PM",
                  },
                  {
                    icon: <MapPin size={16} />,
                    label: "Venue",
                    value: `${ceremony.venue || "Landmark Centre, Hall 2"}`,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="border p-6"
                    style={{ borderColor: "rgba(230,230,250,0.22)", background: "rgba(230,230,250,0.04)" }}
                  >
                    <span className="flex items-center gap-2" style={{ color: LAV }}>
                      {item.icon}
                      <span className="text-[9px] uppercase" style={{ letterSpacing: "0.3em" }}>
                        {item.label}
                      </span>
                    </span>
                    <p className="mt-4 text-[15px] leading-snug" style={{ color: CREAM }}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              <p
                className="mx-auto mt-6 max-w-2xl text-center text-[13.5px] leading-relaxed"
                style={{ color: "rgba(255,255,255,0.7)" }}
              >
                {ceremony.location ||
                  "Plot 3 & 4, Water Corporation Road, Victoria Island, Lagos"}
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3.5 text-[10px] uppercase"
                  style={{ letterSpacing: "0.26em", background: PEACH, color: INK, fontWeight: 600 }}
                >
                  <MapPin size={13} /> Get directions
                </a>
                <a
                  href={icsHref}
                  download="nelkon-blessing-30th-anniversary.ics"
                  className="inline-flex items-center gap-2 border px-6 py-3.5 text-[10px] uppercase"
                  style={{ letterSpacing: "0.26em", borderColor: "rgba(230,230,250,0.45)", color: LAV }}
                >
                  <CalendarDays size={13} /> Add to calendar
                </a>
              </div>

              {countdownEl}

              <div
                className="mt-12 border p-7 text-center sm:p-9"
                style={{ borderColor: "rgba(230,230,250,0.22)" }}
              >
                <p
                  className="text-[9px] uppercase"
                  style={{ letterSpacing: "0.34em", color: LAV }}
                >
                  {dress.label || "Dress Code"}
                </p>
                <p
                  className="anniv-script-lh mt-3"
                  style={{ fontFamily: SCRIPT, fontSize: "clamp(28px, 6vw, 40px)", color: CREAM }}
                >
                  {dress.theme || "Elegant"}
                </p>
                <p className="mt-3 text-[13px]" style={{ color: "rgba(255,255,255,0.65)" }}>
                  {dress.note || "Come dressed to celebrate thirty years with us."}
                </p>
              </div>
            </div>
          </section>

          {/* ----------------------------------------------------- RSVP */}
          <section id="rsvp" className="px-5 py-20 sm:px-8 sm:py-24" style={{ background: CREAM }}>
            <div className="mx-auto max-w-xl">
              {done ? (
                <div className="text-center">
                  <span
                    className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border"
                    style={{ borderColor: "#4B4BD8", color: "#4B4BD8" }}
                  >
                    {declined ? "\u2715" : "\u2713"}
                  </span>
                  <h3
                    className="anniv-script-lh mt-6"
                    style={{ fontFamily: SCRIPT, fontSize: "clamp(32px, 6vw, 44px)", color: INK }}
                  >
                    {declined ? "Thank you for letting us know" : "We cannot wait to see you"}
                  </h3>
                  <p className="mx-auto mt-4 max-w-md text-[14.5px] leading-relaxed" style={{ color: "#3A3470" }}>
                    {declined
                      ? "You will be missed. Thank you for your reply."
                      : plusOne
                      ? "Your places are reserved. Your entry pass covers you and your companion, and will reach you by email or WhatsApp before the celebration."
                      : "Your place is reserved. Your entry pass will reach you by email or WhatsApp before the celebration."}
                  </p>
                  {guestToken && (
                    <button
                      type="button"
                      onClick={() => {
                        setDone(false);
                        setDeclined(false);
                        setAttendance(null);
                        setError("");
                      }}
                      className="mt-6 text-[10px] uppercase underline underline-offset-4"
                      style={{ letterSpacing: "0.2em", color: MUTED }}
                    >
                      Change my response
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="text-center">
                    <p
                      className="text-[9.5px] uppercase"
                      style={{ letterSpacing: "0.4em", color: "#4B4BD8" }}
                    >
                      Kindly respond
                    </p>
                    <h3
                      className="anniv-script-lh mt-3"
                      style={{ fontFamily: SCRIPT, fontSize: "clamp(32px, 6.5vw, 46px)", color: INK }}
                    >
                      Will you celebrate with us?
                    </h3>
                    <p className="mx-auto mt-4 max-w-md text-[13.5px] leading-relaxed" style={{ color: MUTED }}>
                      {plusOneNote}
                    </p>
                    {guestToken && guest?.name && (
                      <p
                        className="mt-3 text-[9.5px] uppercase"
                        style={{ letterSpacing: "0.3em", color: "#4B4BD8" }}
                      >
                        Reserved for {guest.name}
                      </p>
                    )}
                  </div>

                  {/* One companion, exactly as the gala does it. */}
                  <div className="mt-9">
                    <p
                      className="text-[9.5px] uppercase"
                      style={{ letterSpacing: "0.26em", color: MUTED }}
                    >
                      Your party
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPlusOne(false)}
                        aria-pressed={!plusOne}
                        className="px-3 py-3.5 text-[10px] uppercase transition-colors"
                        style={{
                          letterSpacing: "0.18em",
                          background: plusOne ? "transparent" : PEACH,
                          color: plusOne ? MUTED : INK,
                          border: `1px solid ${plusOne ? "#C9C9E8" : PEACH}`,
                          fontWeight: plusOne ? 400 : 600,
                        }}
                      >
                        Just me
                      </button>
                      <button
                        type="button"
                        onClick={() => setPlusOne(true)}
                        aria-pressed={plusOne}
                        className="px-3 py-3.5 text-[10px] uppercase transition-colors"
                        style={{
                          letterSpacing: "0.18em",
                          background: plusOne ? PEACH : "transparent",
                          color: plusOne ? INK : MUTED,
                          border: `1px solid ${plusOne ? PEACH : "#C9C9E8"}`,
                          fontWeight: plusOne ? 600 : 400,
                        }}
                      >
                        Me + one
                      </button>
                    </div>
                  </div>

                  {plusOne && (
                    <label className="mt-5 block">
                      <span
                        className="text-[9.5px] uppercase"
                        style={{ letterSpacing: "0.26em", color: MUTED }}
                      >
                        Companion&apos;s name <span style={{ color: "#4B4BD8" }}>*</span>
                      </span>
                      <input
                        value={plusOneName}
                        onChange={(e) => setPlusOneName(e.target.value)}
                        placeholder="Who is joining you?"
                        className="mt-2 h-12 w-full border-b bg-transparent px-1 text-[15px] outline-none"
                        style={{ borderColor: "#C9C9E8", color: INK }}
                      />
                    </label>
                  )}

                  {guestToken ? (
                    <div className="mt-8 grid gap-3 sm:grid-cols-2">
                      <button
                        onClick={() => submit("yes")}
                        disabled={submitting}
                        className="px-4 py-4 text-[10.5px] uppercase disabled:opacity-60"
                        style={{
                          letterSpacing: "0.16em",
                          background: PEACH,
                          color: INK,
                          fontWeight: 600,
                        }}
                      >
                        {submitting && attendance === "yes" ? "Sending..." : "Confirm my seat"}
                      </button>
                      <button
                        onClick={() => submit("no")}
                        disabled={submitting}
                        className="px-4 py-4 text-[10.5px] uppercase disabled:opacity-60"
                        style={{
                          letterSpacing: "0.16em",
                          background: "transparent",
                          color: MUTED,
                          border: "1px solid #C9C9E8",
                        }}
                      >
                        {submitting && attendance === "no" ? "Sending..." : "Sorry, I cannot make it"}
                      </button>
                    </div>
                  ) : !showForm ? (
                    <div className="mt-8 grid gap-3 sm:grid-cols-2">
                      <button
                        onClick={() => {
                          setShowForm(true);
                          setAttendance("yes");
                          setError("");
                        }}
                        className="px-4 py-4 text-[10.5px] uppercase"
                        style={{
                          letterSpacing: "0.16em",
                          background: PEACH,
                          color: INK,
                          fontWeight: 600,
                        }}
                      >
                        Yes, I will be there
                      </button>
                      <button
                        onClick={() => submit("no")}
                        disabled={submitting}
                        className="px-4 py-4 text-[10.5px] uppercase disabled:opacity-60"
                        style={{
                          letterSpacing: "0.16em",
                          background: "transparent",
                          color: MUTED,
                          border: "1px solid #C9C9E8",
                        }}
                      >
                        {submitting && attendance === "no" ? "Sending..." : "Sorry, I cannot make it"}
                      </button>
                    </div>
                  ) : (
                    <form
                      className="mt-8 space-y-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        submit("yes");
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p
                          className="text-[9.5px] uppercase"
                          style={{ letterSpacing: "0.26em", color: MUTED }}
                        >
                          Your details
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setShowForm(false);
                            setAttendance(null);
                            setError("");
                          }}
                          className="inline-flex items-center gap-2 text-[10px] uppercase transition-colors"
                          style={{ letterSpacing: "0.2em", color: MUTED }}
                        >
                          <ArrowRight size={12} className="rotate-180" /> Back
                        </button>
                      </div>

                      <label className="block">
                        <span
                          className="text-[9.5px] uppercase"
                          style={{ letterSpacing: "0.26em", color: MUTED }}
                        >
                          Full name <span style={{ color: "#4B4BD8" }}>*</span>
                        </span>
                        <input
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Your full name"
                          className="mt-2 h-12 w-full border-b bg-transparent px-1 text-[15px] outline-none"
                          style={{ borderColor: "#C9C9E8", color: INK }}
                        />
                      </label>

                      <label className="block">
                        <span
                          className="text-[9.5px] uppercase"
                          style={{ letterSpacing: "0.26em", color: MUTED }}
                        >
                          Email
                        </span>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="mt-2 h-12 w-full border-b bg-transparent px-1 text-[15px] outline-none"
                          style={{ borderColor: "#C9C9E8", color: INK }}
                        />
                      </label>

                      <div>
                        <span
                          className="text-[9.5px] uppercase"
                          style={{ letterSpacing: "0.26em", color: MUTED }}
                        >
                          Phone number
                        </span>
                        <div className="mt-2">
                          <AnnivPhoneInput
                            dialCode={dialCode}
                            number={phone}
                            onDialCode={setDialCode}
                            onNumber={setPhone}
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="mt-2 w-full py-4 text-[10.5px] uppercase disabled:opacity-60"
                        style={{
                          letterSpacing: "0.2em",
                          background: PEACH,
                          color: INK,
                          fontWeight: 600,
                        }}
                      >
                        {submitting && attendance === "yes" ? "Sending..." : "Send my RSVP"}
                      </button>
                    </form>
                  )}

                  {error && (
                    <p className="mt-4 text-center text-[13px]" style={{ color: "#B3341F" }}>
                      {error}
                    </p>
                  )}
                </>
              )}
            </div>
          </section>

          {/* --------------------------------------------------- footer */}
          <footer
            className="px-6 py-16 text-center"
            style={{ background: `linear-gradient(180deg, ${PURPLE} 0%, #4B4BD8 100%)` }}
          >
            <p
              className="anniv-script-lh"
              style={{ fontFamily: SCRIPT, fontSize: "clamp(34px, 7vw, 52px)", color: CREAM }}
            >
              {groom} &amp; {bride}
            </p>
            <p
              className="mt-2 text-[10px] uppercase"
              style={{ letterSpacing: "0.4em", color: LAV }}
            >
              {occasion}
            </p>
            <div className="mx-auto mt-7 flex items-center justify-center gap-3">
              <span className="block h-px w-14" style={{ background: "rgba(255,218,185,0.6)" }} />
              <span className="block h-1.5 w-1.5 rotate-45" style={{ background: PEACH }} />
              <span className="block h-px w-14" style={{ background: "rgba(255,218,185,0.6)" }} />
            </div>
            <p className="mt-7 text-[13px]" style={{ color: "rgba(255,255,255,0.82)" }}>
              {ceremony.date || "Tuesday, December 15, 2026"} &middot; {ceremony.time || "3:00 PM"} &middot;{" "}
              {ceremony.venue || "Landmark Centre, Hall 2"}
            </p>
            {c.hashtag && (
              <p
                className="mt-4 text-[10px] uppercase"
                style={{ letterSpacing: "0.3em", color: PEACH }}
              >
                {c.hashtag}
              </p>
            )}
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="mx-auto mt-9 flex items-center gap-2 rounded-full border px-5 py-2.5 text-[9.5px] uppercase transition-colors"
              style={{
                letterSpacing: "0.24em",
                borderColor: "rgba(255,218,185,0.55)",
                color: CREAM,
              }}
            >
              <ArrowUp size={13} /> Back to the top
            </button>
            <p className="mt-8 text-[9px] uppercase" style={{ letterSpacing: "0.3em", color: "rgba(255,255,255,0.55)" }}>
              Powered by Accredit Interactive
            </p>
          </footer>
        </div>
      )}

      <RsvpThanksModal
        open={thanksOpen}
        onClose={() => setThanksOpen(false)}
        accent="#4B4BD8"
        surface={CREAM}
        textColor={INK}
        mutedColor={MUTED}
      />
    </div>
  );
}
