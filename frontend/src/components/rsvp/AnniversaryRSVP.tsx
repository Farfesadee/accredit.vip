"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUp,
  CalendarDays,
  ChevronDown,
  Clock,
  MapPin,
  Volume2,
  VolumeX,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { COUNTRIES, flagEmoji } from "@/components/shared/phone-input";

/**
 * Nelkon & Blessing Obi-Uzu: 30th Wedding Anniversary (event 84).
 *
 * Standalone guest experience, scoped to this event only. The cover opens by
 * itself after a short beat (no tap), the film tells the story in their own
 * photographs, and "Ordinary" starts once and never restarts: one audio
 * element carries the whole visit, from the cover through to the RSVP.
 */

// Palette lifted from the client's flier: aubergine, lavender, cream.
const INK = "#241B33";
const INK_DEEP = "#171021";
const ACTION = "#5B3F82";
const ACTION_LIGHT = "#7B5BA8";
const LAV = "#C3B2DE";
const CREAM = "#FAF6EF";
const CREAM_SOFT = "#F3EDE2";
const MUTED = "#6B6076";

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
@keyframes annivFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.anniv-rise{animation:annivRise 900ms cubic-bezier(0.22,1,0.36,1) both}
/* Page-level wrapper: opacity only. A transform here would become the
   containing block for the fixed header and drag it along on scroll. */
.anniv-fade{animation:annivFade 700ms ease both}
.anniv-script-lh{line-height:0.92;padding-bottom:0.12em}
.anniv-cover-half{position:absolute;inset:0;background-repeat:no-repeat;background-position:center 4%;background-size:auto 54%}
@media(max-height:640px){.anniv-cover-half{background-size:auto 46%}}
@media(min-width:768px){.anniv-cover-half{background-position:76% 50%;background-size:auto 84%}}
@media(min-width:1280px){.anniv-cover-half{background-size:auto 88%}}
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
          style={{ borderColor: "rgba(195,178,222,0.18)" }}
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
            style={{ letterSpacing: "0.26em", color: "rgba(195,178,222,0.75)" }}
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
      <div className="flex items-center gap-2 border-b" style={{ borderColor: "#cfc5b6" }}>
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
          style={{ borderColor: "#d9d1c3", background: "#FFFDF9" }}
        >
          <div className="border-b p-2" style={{ borderColor: "#EDE4D5" }}>
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search country or code"
              className="h-10 w-full border px-3 text-[14px] outline-none"
              style={{ borderColor: "#E3D9C8", background: CREAM_SOFT, color: INK }}
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
  const film: string = c.invite_video_url || c.video_url || "";
  const music: string = c.music_url || "";
  const collage: string = c.collage_url || "";
  const groom: string = c.groom || "Nelkon";
  const bride: string = c.bride || "Blessing";
  const surname: string = c.surname || "Obi-Uzu";
  const ceremony = c.ceremony || {};
  const dress = c.dress_code || {};
  const photos: { url: string; caption: string; note: string }[] =
    c.photos && c.photos.length
      ? c.photos
      : [
          { url: "/uploads/anniv-studio.jpg", caption: "Nelkon & Blessing", note: "Today" },
          { url: "/uploads/anniv-traditional.jpg", caption: "The beginning", note: "December 1996" },
          { url: "/uploads/anniv-garden.jpg", caption: "Still smiling", note: "Thirty years later" },
          { url: "/uploads/anniv-outdoor.jpg", caption: "The family", note: "All of us" },
        ];

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
  const [musicOn, setMusicOn] = useState(false);
  const [musicSilent, setMusicSilent] = useState(false);
  const [musicBlocked, setMusicBlocked] = useState(false);
  const [showTop, setShowTop] = useState(false);

  const filmRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Set only when the guest themselves turns the sound off. Until then the
  // song is meant to be playing, so a browser that blocks autoplay gets another
  // attempt on the guest's first touch, scroll or key press.
  const userMutedRef = useRef(false);

  const [name, setName] = useState(guest?.name || "");
  const [email, setEmail] = useState(guest?.email || "");
  const [phone, setPhone] = useState("");
  const [dialCode, setDialCode] = useState("+234");
  const [attendance, setAttendance] = useState<"yes" | "no" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(
    guest?.status === "accepted" || guest?.status === "declined"
  );
  const [declined, setDeclined] = useState(guest?.status === "declined");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const countdownEl = <AnnivCountdown target={c.countdown_to} />;

  /* ------------------------------------------------------------- music */

  const startMusic = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = 0.62;
    a.muted = false;
    a.play()
      .then(() => {
        setMusicOn(true);
        setMusicSilent(false);
        setMusicBlocked(false);
      })
      .catch(() => {
        // Phones refuse to start a page with sound. Keep the song running
        // silently so it is already in time, then the guest's first touch
        // only has to raise the volume: no second press, no restart.
        a.muted = true;
        a.play()
          .then(() => {
            setMusicOn(true);
            setMusicSilent(true);
            setMusicBlocked(true);
          })
          .catch(() => {
            setMusicOn(false);
            setMusicSilent(false);
            setMusicBlocked(true);
          });
      });
  }, []);

  // "Ordinary" is ON by default: it starts the moment the invitation opens and
  // stays on for the whole visit. The button is the only thing that turns it
  // off, and once the guest has turned it off nothing else starts it again.
  // A tap on a form field or a photograph never pauses or toggles it.
  useEffect(() => {
    startMusic();

    const wake = () => {
      const a = audioRef.current;
      if (!a || userMutedRef.current) return;
      if (!a.paused) {
        // Already running silently: raise the volume. The play() call has to
        // happen inside the gesture as well, because iOS in particular will
        // not give sound to an element it allowed to autoplay muted unless it
        // is played again from an interaction.
        if (a.muted) {
          a.muted = false;
          a.volume = 0.62;
          setMusicSilent(false);
          setMusicBlocked(false);
          setMusicOn(true);
          a.play().catch(() => {
            // Refused: keep the song running silently and in time, so the
            // guest's next touch only has to raise the volume again.
            a.muted = true;
            setMusicSilent(true);
            setMusicBlocked(true);
            a.play().catch(() => {});
          });
        }
        return;
      }
      startMusic();
    };
    // Gestures only: these are what a browser accepts as permission to play.
    const events: (keyof WindowEventMap)[] = [
      "pointerdown",
      "pointerup",
      "touchstart",
      "touchend",
      "click",
      "wheel",
      "keydown",
    ];
    events.forEach((event) => window.addEventListener(event, wake, { passive: true }));
    return () =>
      events.forEach((event) => window.removeEventListener(event, wake));
  }, [startMusic]);

  const toggleMusic = () => {
    const a = audioRef.current;
    if (!a) return;
    if (!a.paused && a.muted) {
      // it is playing silently, waiting for exactly this press
      a.muted = false;
      a.volume = 0.62;
      userMutedRef.current = false;
      setMusicSilent(false);
      setMusicBlocked(false);
      setMusicOn(true);
      a.play().catch(() => {
        // Refused: fall back to the silent, in-time playback and keep the hint.
        a.muted = true;
        setMusicSilent(true);
        setMusicBlocked(true);
        a.play().catch(() => {});
      });
      return;
    }
    if (!a.paused) {
      userMutedRef.current = true;
      a.pause();
      setMusicOn(false);
      setMusicSilent(false);
      setMusicBlocked(false);
      return;
    }
    userMutedRef.current = false;
    startMusic();
  };

  const soundLabel = !musicOn ? "Sound off" : musicSilent ? "Tap for sound" : "Sound on";
  const soundAction = !musicOn || musicSilent ? "Turn the music on" : "Turn the music off";

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
    if (guestToken) {
      // Personal link: this guest is already on the list, so the reply is
      // recorded against their own row. Nothing to re-enter.
      setSubmitting(true);
      try {
        await apiClient(`/rsvp/${guestToken}`, {
          method: "POST",
          body: { response: response === "yes" ? "yes" : "no" },
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
          response: response === "yes" ? "accepted" : "declined",
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
      `SUMMARY:${groom} & ${bride} ${surname} 30th Wedding Anniversary`,
      `LOCATION:${ceremony.venue || "Landmark Centre"}, ${ceremony.location || "Victoria Island, Lagos"}`,
      "DESCRIPTION:Thirty years. Please join us to celebrate.",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    return "data:text/calendar;charset=utf-8," + encodeURIComponent(ics);
  }, [groom, bride, surname, ceremony.venue, ceremony.location]);

  /* -------------------------------------------------------- opening gate */

  const gate =
    phase !== "invitation" ? (
      <div className="fixed inset-0 z-[95] overflow-hidden" style={{ background: "#050409" }}>
        <video
          ref={filmRef}
          src={film}
          poster={phase === "film" ? poster : undefined}
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
            style={{ background: "rgba(5,4,9,0.72)" }}
            aria-label="Play the anniversary film"
          >
            <span
              className="flex h-20 w-20 items-center justify-center rounded-full text-2xl"
              style={{ background: ACTION, color: CREAM }}
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
            {/* The client's flier, split down the middle, parts on its own. */}
            {(["left", "right"] as const).map((side) => (
              <div
                key={side}
                aria-hidden
                className="anniv-cover-half"
                style={{
                  backgroundImage: poster ? `url(${poster})` : undefined,
                  clipPath:
                    side === "left" ? "inset(0 50% 0 0)" : "inset(0 0 0 50%)",
                  transform: opening
                    ? `translateX(${side === "left" ? "-100%" : "100%"})`
                    : "none",
                  transition: "transform 1150ms cubic-bezier(0.76, 0, 0.24, 1)",
                  willChange: "transform",
                }}
              />
            ))}

            {/* A soft wash so the flier sits on the page rather than in a box. */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 50% 28%, rgba(91,63,130,0.30), transparent 52%), linear-gradient(to top, #050409 0%, rgba(5,4,9,0.9) 16%, rgba(5,4,9,0) 40%)",
                opacity: opening ? 0 : 1,
                transition: "opacity 420ms ease",
              }}
            />

            <div
              className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center px-6 pb-14 text-center md:inset-y-0 md:right-auto md:w-1/2 md:items-start md:justify-end md:px-14 md:pb-20 md:text-left"
              style={{ opacity: opening ? 0 : 1, transition: "opacity 380ms ease" }}
            >
              <p
                className="anniv-rise text-[9.5px] uppercase sm:text-[10.5px]"
                style={{ letterSpacing: "0.42em", color: LAV, animationDelay: "200ms" }}
              >
                Together since {c.since || "December 1996"}
              </p>
              <h1
                className="anniv-rise anniv-script-lh mt-4"
                style={{
                  fontFamily: SCRIPT,
                  fontSize: "clamp(42px, 13vw, 74px)",
                  color: CREAM,
                  textShadow: "0 6px 40px rgba(0,0,0,0.55)",
                  animationDelay: "420ms",
                }}
              >
                {groom} &amp; {bride}
              </h1>
              <p
                className="anniv-rise mt-2 text-[11px] uppercase"
                style={{ letterSpacing: "0.5em", color: CREAM, animationDelay: "700ms" }}
              >
                {surname}
              </p>
              <span
                className="anniv-rise mt-6 block h-px w-16"
                style={{ background: LAV, opacity: 0.7, animationDelay: "850ms" }}
              />
              <p
                className="anniv-rise mt-5 text-[10px] uppercase sm:text-[11px]"
                style={{ letterSpacing: "0.3em", color: "rgba(250,246,239,0.86)", animationDelay: "1000ms" }}
              >
                {ceremony.date || "Tuesday, December 15, 2026"}
              </p>

              {/* The invitation opens by itself. */}
              <div className="mt-8 h-px w-40 overflow-hidden" style={{ background: "rgba(195,178,222,0.25)" }}>
                <span
                  className="block h-px w-full"
                  style={{
                    background: LAV,
                    transformOrigin: "left center",
                    animation: "annivFill 3.5s linear forwards",
                    opacity: opening ? 0 : 1,
                  }}
                />
              </div>
            </div>
          </>
        )}

        {/* Sound is ON by default: the same control rides the cover and the film. */}
        {music && (
          <button
            onClick={toggleMusic}
            aria-label={soundAction}
            className="absolute right-4 top-4 z-30 flex items-center gap-2 rounded-full px-3 py-2 text-[9px] uppercase"
            style={{
              letterSpacing: "0.22em",
              color: CREAM,
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(195,178,222,0.22)",
              animation:
                musicSilent || (musicBlocked && !musicOn)
                  ? "annivFloat 2.4s ease-in-out infinite"
                  : "none",
            }}
          >
            {musicOn && !musicSilent ? <Volume2 size={13} /> : <VolumeX size={13} />}
            {soundLabel}
          </button>
        )}
      </div>
    ) : null;

  /* ---------------------------------------------------------------- page */

  return (
    <div style={{ fontFamily: BODY, background: CREAM, color: INK }}>
      <style dangerouslySetInnerHTML={{ __html: FONT_CSS }} />

      {/* One audio element for the whole visit. */}
      {music && <audio ref={audioRef} src={music} loop preload="auto" />}

      {gate}

      {/* Only while the browser is still holding the sound back. Any tap, scroll
          or key press releases it, so the guest is never sent hunting for a
          control to switch the music on. */}
      {music && (musicSilent || (musicBlocked && !musicOn)) && (
        <div
          className="pointer-events-none fixed left-1/2 z-[60] -translate-x-1/2 whitespace-nowrap rounded-full border px-4 py-2 text-[9px] uppercase"
          style={{
            bottom: "calc(1.1rem + env(safe-area-inset-bottom))",
            letterSpacing: "0.22em",
            borderColor: "rgba(195,178,222,0.5)",
            background: "rgba(23,16,33,0.92)",
            color: CREAM,
            animation: "annivFloat 2.4s ease-in-out infinite",
          }}
        >
          Tap anywhere for sound
        </div>
      )}

      {phase === "invitation" && (
        <div className="anniv-fade">
          {/* ---------------------------------------------------- header */}
          <header
            className="fixed inset-x-0 top-0 z-50 transition-colors duration-300"
            style={{
              // No backdrop blur: on phones it repaints the whole page on every
              // scroll frame and reads as jumping content. A solid tint is
              // cheaper and looks the same over a dark page.
              background: showTop ? "rgba(23,16,33,0.94)" : "transparent",
              borderBottom: showTop ? "1px solid rgba(195,178,222,0.14)" : "1px solid transparent",
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
                  style={{ borderColor: "rgba(195,178,222,0.5)", color: CREAM }}
                >
                  NB
                </span>
                <span
                  className="hidden text-[12px] sm:block"
                  style={{ fontFamily: SCRIPT, color: CREAM, fontSize: "20px" }}
                >
                  {groom} &amp; {bride}
                </span>
              </button>
              <div className="flex items-center gap-2 sm:gap-3">
                {music && (
                  <button
                    onClick={toggleMusic}
                    aria-label={soundAction}
                    className="flex h-10 items-center gap-2 rounded-full border px-3 text-[9px] uppercase transition-colors"
                    style={{
                      letterSpacing: "0.2em",
                      borderColor: musicOn ? "rgba(195,178,222,0.55)" : "rgba(195,178,222,0.28)",
                      background: musicOn ? "rgba(91,63,130,0.65)" : "rgba(250,246,239,0.06)",
                      color: CREAM,
                      animation:
                        musicSilent || (musicBlocked && !musicOn)
                          ? "annivFloat 2.4s ease-in-out infinite"
                          : "none",
                    }}
                  >
                    {musicOn && !musicSilent ? <Volume2 size={14} /> : <VolumeX size={14} />}
                    <span className="hidden sm:inline">{soundLabel}</span>
                  </button>
                )}
                <a
                  href="#rsvp"
                  className="rounded-full px-5 py-2.5 text-[10px] uppercase transition-colors"
                  style={{ letterSpacing: "0.24em", background: ACTION, color: CREAM }}
                >
                  RSVP
                </a>
              </div>
            </div>
          </header>

          {/* ------------------------------------------------------ hero */}
          <section
            className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden px-6 pb-16 pt-24 sm:px-8 lg:pt-28"
            style={{ background: INK }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 30% 22%, rgba(91,63,130,0.55), transparent 58%), radial-gradient(circle at 88% 78%, rgba(195,178,222,0.18), transparent 55%)",
              }}
            />
            <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[0.85fr_1fr] lg:gap-16">
              <div className="flex justify-center">
                {poster && (
                  <img
                    src={poster}
                    alt={`${groom} and ${bride} ${surname}`}
                    width={874}
                    height={1240}
                    className="w-full max-w-[290px] sm:max-w-[330px] lg:max-w-[390px]"
                    style={{
                      boxShadow: "0 40px 90px rgba(0,0,0,0.55)",
                      borderRadius: "2px",
                      // space reserved before the file arrives, so nothing jumps
                      aspectRatio: "874 / 1240",
                      objectFit: "cover",
                    }}
                  />
                )}
              </div>

              <div className="text-center lg:text-left">
                <p
                  className="text-[9.5px] uppercase sm:text-[11px]"
                  style={{ letterSpacing: "0.44em", color: LAV }}
                >
                  Together since {c.since || "December 1996"}
                </p>
                <h1
                  className="anniv-script-lh mt-4"
                  style={{
                    fontFamily: SCRIPT,
                    fontSize: "clamp(44px, 10vw, 96px)",
                    color: CREAM,
                  }}
                >
                  {groom} &amp; {bride}
                </h1>
                <p
                  className="mt-1 text-[12px] uppercase sm:text-[14px]"
                  style={{ letterSpacing: "0.52em", color: CREAM }}
                >
                  {surname}
                </p>
                <div className="mt-6 flex items-center justify-center gap-3 lg:justify-start">
                  <span className="block h-px w-12" style={{ background: LAV, opacity: 0.7 }} />
                  <span className="block h-1.5 w-1.5 rotate-45" style={{ background: LAV }} />
                  <span className="block h-px w-12" style={{ background: LAV, opacity: 0.7 }} />
                </div>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 lg:justify-start">
                  <span
                    className="text-[10px] uppercase sm:text-[11px]"
                    style={{ letterSpacing: "0.28em", color: "rgba(250,246,239,0.9)" }}
                  >
                    {ceremony.date || "Tuesday, December 15, 2026"}
                  </span>
                  <span className="hidden h-3 w-px sm:block" style={{ background: "rgba(195,178,222,0.45)" }} />
                  <span
                    className="text-[10px] uppercase sm:text-[11px]"
                    style={{ letterSpacing: "0.28em", color: "rgba(250,246,239,0.9)" }}
                  >
                    {ceremony.time || "3:00 PM"}
                  </span>
                  <span className="hidden h-3 w-px sm:block" style={{ background: "rgba(195,178,222,0.45)" }} />
                  <span
                    className="text-[10px] uppercase sm:text-[11px]"
                    style={{ letterSpacing: "0.28em", color: "rgba(250,246,239,0.9)" }}
                  >
                    Victoria Island, Lagos
                  </span>
                </div>
                <a
                  href="#letter"
                  className="mt-9 inline-flex items-center gap-3 text-[10px] uppercase"
                  style={{ letterSpacing: "0.3em", color: LAV }}
                >
                  Read the invitation
                  <span className="block h-px w-10" style={{ background: LAV, opacity: 0.6 }} />
                </a>
              </div>
            </div>
          </section>

          {/* ---------------------------------------------------- letter */}
          <section id="letter" className="relative overflow-hidden px-6 py-20 sm:py-28" style={{ background: CREAM }}>
            <div
              className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full"
              style={{ background: "radial-gradient(circle, rgba(195,178,222,0.35), transparent 70%)" }}
            />
            <div className="relative mx-auto max-w-2xl text-center">
              <p
                className="text-[9.5px] uppercase sm:text-[10.5px]"
                style={{ letterSpacing: "0.42em", color: ACTION }}
              >
                Please join us to celebrate
              </p>
              <h2
                className="anniv-script-lh mt-5"
                style={{ fontFamily: SCRIPT, fontSize: "clamp(34px, 7vw, 54px)", color: INK }}
              >
                {groom} and {bride}
              </h2>
              <p
                className="mt-3 text-[11px] uppercase sm:text-[12px]"
                style={{ letterSpacing: "0.46em", color: MUTED }}
              >
                {surname}
              </p>
              <p
                className="mt-4 text-[12px] uppercase sm:text-[13px]"
                style={{ letterSpacing: "0.4em", color: MUTED }}
              >
                30th Anniversary
              </p>
              <div className="mx-auto mt-8 flex items-center justify-center gap-3">
                <span className="block h-px w-16" style={{ background: LAV }} />
                <span className="block h-1.5 w-1.5 rotate-45" style={{ background: ACTION }} />
                <span className="block h-px w-16" style={{ background: LAV }} />
              </div>
              <p className="mx-auto mt-8 max-w-xl text-[15px] leading-relaxed" style={{ color: "#4B4356" }}>
                {c.hero_line ||
                  "Celebrating 30 beautiful years of love, laughter and lifelong companionship."}
              </p>
            </div>
          </section>

          {/* ---------------------------------------------- thirty years */}
          <section id="story" className="relative overflow-hidden px-6 py-20 sm:py-24" style={{ background: INK }}>
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 50% 0%, rgba(91,63,130,0.55), transparent 62%)",
              }}
            />
            <div className="relative mx-auto max-w-5xl text-center">
              <div className="flex items-end justify-center gap-3 sm:gap-6">
                <span
                  className="leading-none"
                  style={{ fontFamily: BRUSH, fontSize: "clamp(96px, 22vw, 190px)", color: CREAM }}
                >
                  30
                </span>
                <span
                  className="anniv-script-lh pb-6"
                  style={{ fontFamily: SCRIPT, fontSize: "clamp(56px, 13vw, 112px)", color: LAV }}
                >
                  years
                </span>
              </div>
              <p
                className="mt-2 text-[10px] uppercase sm:text-[11px]"
                style={{ letterSpacing: "0.44em", color: "rgba(250,246,239,0.7)" }}
              >
                1996 &middot; 2026
              </p>

              {collage && (
                <figure className="mx-auto mt-14 max-w-3xl">
                  <img
                    src={collage}
                    alt="Together since 1996"
                    width={1240}
                    height={1753}
                    className="w-full rounded-sm"
                    style={{
                      boxShadow: "0 30px 90px rgba(0,0,0,0.5)",
                      // The portrait collage is nearly 500px tall on a phone.
                      // Reserving its box keeps every section below it still
                      // while the file is still arriving.
                      aspectRatio: "1240 / 1753",
                      objectFit: "cover",
                    }}
                  />
                  <figcaption
                    className="mt-5 text-[9.5px] uppercase"
                    style={{ letterSpacing: "0.34em", color: "rgba(195,178,222,0.85)" }}
                  >
                    The years, in their own photographs
                  </figcaption>
                </figure>
              )}
            </div>
          </section>

          {/* --------------------------------------------------- gallery */}
          <section id="gallery" className="px-5 py-20 sm:px-8 sm:py-24" style={{ background: CREAM_SOFT }}>
            <div className="mx-auto max-w-6xl">
              <div className="text-center">
                <p
                  className="text-[9.5px] uppercase sm:text-[10.5px]"
                  style={{ letterSpacing: "0.42em", color: ACTION }}
                >
                  A life together
                </p>
                <h2
                  className="anniv-script-lh mt-4"
                  style={{ fontFamily: SCRIPT, fontSize: "clamp(34px, 6.5vw, 52px)", color: INK }}
                >
                  Thirty years of us
                </h2>
              </div>

              <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4">
                {photos.map((p, i) => (
                  <figure
                    key={p.url}
                    className={
                      i === 0
                        ? "col-span-2 row-span-2 md:col-span-2 md:row-span-2"
                        : i === 3
                        ? "col-span-2 md:col-span-2"
                        : ""
                    }
                  >
                    <div className="overflow-hidden" style={{ background: INK }}>
                      <img
                        src={p.url}
                        alt={p.caption}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.03]"
                        style={{
                          aspectRatio: i === 0 ? "4 / 5" : i === 3 ? "4 / 3" : "4 / 5",
                        }}
                      />
                    </div>
                    <figcaption className="mt-3">
                      <p style={{ fontFamily: SCRIPT, fontSize: "22px", color: ACTION, lineHeight: 1.1 }}>
                        {p.caption}
                      </p>
                      <p
                        className="mt-1 text-[9px] uppercase"
                        style={{ letterSpacing: "0.28em", color: MUTED }}
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
          <section id="quote" className="relative flex min-h-[70svh] items-center justify-center overflow-hidden px-6 py-24">
            <img
              src="/uploads/anniv-studio-large.jpg"
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: "center 12%" }}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(23,16,33,0.82), rgba(23,16,33,0.62), rgba(23,16,33,0.9))",
              }}
            />
            <blockquote className="relative z-10 mx-auto max-w-2xl text-center">
              <p
                style={{
                  fontFamily: SCRIPT,
                  fontSize: "clamp(30px, 6.5vw, 50px)",
                  color: CREAM,
                  lineHeight: 1.25,
                }}
              >
                Thirty years of love, laughter and lifelong companionship.
              </p>
              <footer
                className="mt-6 text-[9.5px] uppercase"
                style={{ letterSpacing: "0.4em", color: LAV }}
              >
                {groom} &amp; {bride}
              </footer>
            </blockquote>
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
                    style={{ borderColor: "rgba(195,178,222,0.22)", background: "rgba(195,178,222,0.04)" }}
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
                style={{ color: "rgba(250,246,239,0.7)" }}
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
                  style={{ letterSpacing: "0.26em", background: ACTION, color: CREAM }}
                >
                  <MapPin size={13} /> Get directions
                </a>
                <a
                  href={icsHref}
                  download="nelkon-blessing-30th-anniversary.ics"
                  className="inline-flex items-center gap-2 border px-6 py-3.5 text-[10px] uppercase"
                  style={{ letterSpacing: "0.26em", borderColor: "rgba(195,178,222,0.4)", color: LAV }}
                >
                  <CalendarDays size={13} /> Add to calendar
                </a>
              </div>

              {countdownEl}

              <div
                className="mt-12 border p-7 text-center sm:p-9"
                style={{ borderColor: "rgba(195,178,222,0.22)" }}
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
                <p className="mt-3 text-[13px]" style={{ color: "rgba(250,246,239,0.65)" }}>
                  {dress.note || "Come dressed to celebrate thirty years with us."}
                </p>
              </div>
            </div>
          </section>

          {/* ----------------------------------------------------- RSVP */}
          <section id="rsvp" className="px-5 py-20 sm:px-8 sm:py-24" style={{ background: CREAM }}>
            <div className="mx-auto max-w-5xl">
              <div className="grid gap-10 md:grid-cols-[0.85fr_1fr] md:items-center">
                <div className="order-2 md:order-1">
                  <div className="overflow-hidden">
                    <img
                      src="/uploads/anniv-traditional.jpg"
                      alt={`${groom} and ${bride}`}
                      loading="lazy"
                      className="h-full w-full object-cover"
                      style={{ aspectRatio: "4 / 5" }}
                    />
                  </div>
                  <p
                    className="mt-4 text-[9px] uppercase"
                    style={{ letterSpacing: "0.3em", color: MUTED }}
                  >
                    We would love to celebrate with you
                  </p>
                </div>

                <div className="order-1 md:order-2">
                  {done ? (
                    <div className="text-center md:text-left">
                      <span
                        className="flex h-14 w-14 items-center justify-center rounded-full border"
                        style={{ borderColor: ACTION, color: ACTION }}
                      >
                        {declined ? "\u2715" : "\u2713"}
                      </span>
                      <h3
                        className="anniv-script-lh mt-6"
                        style={{ fontFamily: SCRIPT, fontSize: "clamp(32px, 6vw, 44px)", color: INK }}
                      >
                        {declined ? "Thank you for letting us know" : "We cannot wait to see you"}
                      </h3>
                      <p className="mt-4 text-[14.5px] leading-relaxed" style={{ color: "#4B4356" }}>
                        {declined
                          ? "You will be missed. Thank you for your reply."
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
                      <p
                        className="text-[9.5px] uppercase"
                        style={{ letterSpacing: "0.4em", color: ACTION }}
                      >
                        Kindly respond
                      </p>
                      <h3
                        className="anniv-script-lh mt-3"
                        style={{ fontFamily: SCRIPT, fontSize: "clamp(32px, 6.5vw, 46px)", color: INK }}
                      >
                        Will you celebrate with us?
                      </h3>

                      {guestToken && guest?.name && (
                        <p
                          className="mt-4 text-[9.5px] uppercase"
                          style={{ letterSpacing: "0.3em", color: MUTED }}
                        >
                          Reserved for {guest.name}
                        </p>
                      )}

                      {guestToken ? (
                        <div className="mt-8 grid gap-3 sm:grid-cols-2">
                          <button
                            onClick={() => submit("yes")}
                            disabled={submitting}
                            className="px-4 py-4 text-[10.5px] uppercase disabled:opacity-60"
                            style={{
                              letterSpacing: "0.16em",
                              background: ACTION,
                              color: CREAM,
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
                              border: "1px solid #d9d1c3",
                            }}
                          >
                            {submitting && attendance === "no"
                              ? "Sending..."
                              : "Sorry, I cannot make it"}
                          </button>
                          {error && (
                            <p className="sm:col-span-2 text-[13px]" style={{ color: "#A33A2B" }}>
                              {error}
                            </p>
                          )}
                        </div>
                      ) : null}

                      {!guestToken && showForm && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowForm(false);
                            setError("");
                          }}
                          className="mt-6 inline-flex items-center gap-2 text-[10px] uppercase transition-colors"
                          style={{ letterSpacing: "0.2em", color: MUTED }}
                        >
                          <ArrowRight size={12} className="rotate-180" /> Back
                        </button>
                      )}

                      {!guestToken && (!showForm ? (
                        <div className="mt-8 grid gap-3 sm:grid-cols-2">
                          <button
                            onClick={() => {
                              setShowForm(true);
                              setAttendance("yes");
                            }}
                            className="px-4 py-4 text-[10.5px] uppercase"
                            style={{
                              letterSpacing: "0.16em",
                              background: ACTION,
                              color: CREAM,
                              fontWeight: 600,
                            }}
                          >
                            Yes, I will be there
                          </button>
                          <button
                            onClick={() => submit("no")}
                            disabled={submitting}
                            className="px-4 py-4 text-[10.5px] uppercase"
                            style={{
                              letterSpacing: "0.16em",
                              background: "transparent",
                              color: MUTED,
                              border: "1px solid #d9d1c3",
                            }}
                          >
                            {submitting && attendance === "no"
                              ? "Sending..."
                              : "Sorry, I cannot make it"}
                          </button>
                        </div>
                      ) : (
                        <form
                          className="mt-6 space-y-4"
                          onSubmit={(e) => {
                            e.preventDefault();
                            submit("yes");
                          }}
                        >
                          <label className="block">
                            <span
                              className="text-[9.5px] uppercase"
                              style={{ letterSpacing: "0.26em", color: MUTED }}
                            >
                              Full name <span style={{ color: ACTION }}>*</span>
                            </span>
                            <input
                              required
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              placeholder="Your full name"
                              className="mt-2 h-12 w-full border-b bg-transparent px-1 text-[15px] outline-none"
                              style={{ borderColor: "#cfc5b6", color: INK }}
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
                              style={{ borderColor: "#cfc5b6", color: INK }}
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

                          {error && (
                            <p className="text-[13px]" style={{ color: "#A33A2B" }}>
                              {error}
                            </p>
                          )}

                          <button
                            type="submit"
                            disabled={submitting}
                            className="mt-2 w-full py-4 text-[10.5px] uppercase disabled:opacity-60"
                            style={{
                              letterSpacing: "0.2em",
                              background: ACTION,
                              color: CREAM,
                              fontWeight: 600,
                            }}
                          >
                            {submitting && attendance === "yes" ? "Sending..." : "Send my RSVP"}
                          </button>
                        </form>
                      ))}

                      {!guestToken && !showForm && error && (
                        <p className="mt-4 text-[13px]" style={{ color: "#A33A2B" }}>
                          {error}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* --------------------------------------------------- footer */}
          <footer className="px-6 py-16 text-center" style={{ background: INK }}>
            <p
              className="anniv-script-lh"
              style={{ fontFamily: SCRIPT, fontSize: "clamp(34px, 7vw, 52px)", color: CREAM }}
            >
              {groom} &amp; {bride}
            </p>
            <p
              className="mt-2 text-[10px] uppercase"
              style={{ letterSpacing: "0.5em", color: LAV }}
            >
              {surname}
            </p>
            <div className="mx-auto mt-7 flex items-center justify-center gap-3">
              <span className="block h-px w-14" style={{ background: "rgba(195,178,222,0.4)" }} />
              <span className="block h-1.5 w-1.5 rotate-45" style={{ background: LAV }} />
              <span className="block h-px w-14" style={{ background: "rgba(195,178,222,0.4)" }} />
            </div>
            <p className="mt-7 text-[13px]" style={{ color: "rgba(250,246,239,0.7)" }}>
              {ceremony.date || "Tuesday, December 15, 2026"} &middot; {ceremony.time || "3:00 PM"} &middot;{" "}
              {ceremony.venue || "Landmark Centre, Hall 2"}
            </p>
            {c.hashtag && (
              <p
                className="mt-4 text-[10px] uppercase"
                style={{ letterSpacing: "0.3em", color: LAV }}
              >
                {c.hashtag}
              </p>
            )}
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="mx-auto mt-9 flex items-center gap-2 rounded-full border px-5 py-2.5 text-[9.5px] uppercase transition-colors"
              style={{
                letterSpacing: "0.24em",
                borderColor: "rgba(195,178,222,0.4)",
                color: CREAM,
              }}
            >
              <ArrowUp size={13} /> Back to the top
            </button>
            <p className="mt-8 text-[9px] uppercase" style={{ letterSpacing: "0.3em", color: "rgba(250,246,239,0.4)" }}>
              Powered by Accredit Interactive
            </p>
          </footer>
        </div>
      )}
    </div>
  );
}
