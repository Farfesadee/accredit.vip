"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Download,
  Loader,
  MapPin,
  Menu,
  Play,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useInviteMusic } from "@/lib/invite-music";
import { COUNTRIES, flagEmoji } from "@/components/shared/phone-input";
import RsvpThanksModal from "@/components/rsvp/RsvpThanksModal";

const GOLD = "#C9A227";
const IVORY = "#F3EDE2";
const INK = "#070707";

interface GalaContent {
  title: string;
  title_lines?: string[];
  kicker: string;
  line: string;
  book_launch?: { title: string; note: string };
  plus_one?: { allowed: boolean; note: string };
  host: string;
  countdown_to: string;
  date: { full: string; weekday: string; day: string; month: string; year: string };
  red_carpet: string;
  venue: { name: string; room: string; location: string; map_url: string };
  after_party: { venue: string; note: string; map_url: string };
  dress_code: { style: string; note: string };
  evening: { time: string; title: string; detail: string }[];
  quote: { text: string; author: string };
  poster_url: string;
  emblem_url: string;
  portrait_url: string;
  film_url: string;
  film_poster_url: string;
  film_vertical_url: string;
  film_vertical_poster_url: string;
  /** The client's score, owned by one audio element for the whole visit. */
  music_url?: string;
}

interface GalaRSVPProps {
  slug: string;
  content: GalaContent;
  /** Present when the page is opened from a guest's personal RSVP link. */
  guestToken?: string;
  guest?: {
    name: string;
    email?: string | null;
    phone?: string | null;
    status?: string | null;
  } | null;
}

/* ------------------------------------------------------------------ helpers */

function useCountdown(target: string) {
  const targetMs = useMemo(() => new Date(target).getTime(), [target]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, targetMs - now);
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    over: diff === 0,
  };
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShown(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(26px)",
        transition: `opacity 0.9s ease ${delay}ms, transform 0.9s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={`text-[11px] uppercase tracking-[0.3em] sm:text-[12px] sm:tracking-[0.4em] ${className}`}
      style={{ color: GOLD }}
    >
      {children}
    </p>
  );
}

function GoldRule({ width = 96, className = "" }: { width?: number; className?: string }) {
  return <span className={`block h-px ${className}`} style={{ width, background: GOLD, opacity: 0.7 }} />;
}

function buildIcs(content: GalaContent) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Accredit Interactive//A Gala Dinner Experience//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    "UID:the-art-of-attention-2026@accredit.vip",
    "DTSTAMP:20261020T000000Z",
    "DTSTART:20261202T160000Z",
    "DTEND:20261202T230000Z",
    `SUMMARY:${content.title}`,
    `LOCATION:${content.venue.name}, ${content.venue.room}, ${content.venue.location}`,
    `DESCRIPTION:Red Carpet ${content.red_carpet}. Dress code: ${content.dress_code.style}. After party at ${content.after_party.venue}.`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

/* ------------------------------------------------------- dark phone input */

function GalaPhoneInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const selected = COUNTRIES.find((c) => c.code !== "" && value.startsWith(c.code)) || COUNTRIES[0];
  const displayValue = selected && value.startsWith(selected.code) ? value.slice(selected.code.length) : value;

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 60);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    const digits = query.trim().replace(/\D/g, "");
    if (!text) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(text) ||
        c.iso.toLowerCase().includes(text) ||
        (digits && c.code.replace(/\D/g, "").startsWith(digits))
    );
  }, [query]);

  return (
    <div ref={wrapRef} className="relative">
      <div
        className="flex h-12 items-center overflow-hidden border-b"
        style={{ borderColor: "#3a3016", background: "rgba(255,255,255,0.015)" }}
      >
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setOpen((o) => !o);
          }}
          aria-label="Choose country code"
          className="flex h-full flex-shrink-0 items-center gap-1.5 border-r px-3 text-sm"
          style={{ borderColor: "#3a3016", color: IVORY }}
        >
          <span className="text-base leading-none">{flagEmoji(selected.iso)}</span>
          <span style={{ color: "#cfc6b6" }}>{selected.code}</span>
          <ChevronDown size={13} style={{ color: GOLD }} />
        </button>
        <input
          type="tel"
          inputMode="tel"
          value={displayValue}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "");
            const codeDigits = selected.code.replace(/\D/g, "");
            const num = raw.startsWith(codeDigits) ? raw.slice(codeDigits.length) : raw;
            onChange(`${selected.code}${num}`);
          }}
          placeholder="Phone number"
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[16px] outline-none placeholder:text-[#6f685c]"
          style={{ color: IVORY }}
        />
      </div>

      {open && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-hidden border shadow-2xl"
          style={{ borderColor: "#3a3016", background: "#0d0d0d" }}
        >
          <div className="border-b p-2" style={{ borderColor: "#241f14" }}>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country or code"
              className="h-10 w-full border px-3 text-sm outline-none placeholder:text-[#6f685c]"
              style={{ background: "#131313", borderColor: "#2c2618", color: IVORY }}
            />
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 && <p className="px-4 py-3 text-sm opacity-50">No match found</p>}
            {filtered.map((c) => (
              <button
                key={`${c.iso}-${c.code}`}
                type="button"
                onClick={() => {
                  const num = value.replace(/^\+\d+/, "");
                  onChange(num ? `${c.code}${num}` : "");
                  setOpen(false);
                  setQuery("");
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-[#191919]"
                style={{ color: IVORY }}
              >
                <span className="w-6 text-base leading-none">{flagEmoji(c.iso)}</span>
                <span className="flex-1 truncate">{c.name}</span>
                <span className="font-bold" style={{ color: GOLD }}>
                  {c.code}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ main */

export default function GalaRSVP({ slug, content, guestToken, guest }: GalaRSVPProps) {
  const [entered, setEntered] = useState<boolean>(() => {
    try {
      return typeof window !== "undefined" && sessionStorage.getItem(`gala-entered-${slug}`) === "1";
    } catch {
      return false;
    }
  });
  const [filmOpen, setFilmOpen] = useState(false);
  // Music is ON by default and belongs to the visit, not to this component.
  // `invite-music` holds one audio element for the whole page: it starts on the
  // welcome screen (before this component even mounts), keeps playing across the
  // film and into the invitation, and is stopped only by the guest.
  const music = useInviteMusic(content.music_url);
  const musicUrl: string = content.music_url || "";
  const [filmStalled, setFilmStalled] = useState(false);
  const [filmFallback, setFilmFallback] = useState(false);
  const [filmLoading, setFilmLoading] = useState(false);
  const filmRef = useRef<HTMLVideoElement | null>(null);

  // Phones get the dedicated 9:16 cut of the film (readable type, full screen).
  const [phoneView, setPhoneView] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setPhoneView(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const [attendance, setAttendance] = useState<"yes" | "no" | null>(null);
  const [name, setName] = useState(guest?.name ?? "");
  const [email, setEmail] = useState(guest?.email ?? "");
  const [phone, setPhone] = useState(guest?.phone ?? "");
  const [organization, setOrganization] = useState("");
  // Event 82 only: one companion on the same pass.
  const [plusOne, setPlusOne] = useState(false);
  const [plusOneName, setPlusOneName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingKind, setPendingKind] = useState<"yes" | "no" | null>(null);
  const [done, setDone] = useState(
    guest?.status === "accepted" || guest?.status === "declined"
  );
  const [declined, setDeclined] = useState(guest?.status === "declined");
  const [error, setError] = useState("");
  // A public "no" is answered with a short note, never a form: the invitation
  // stays exactly where it is behind it.
  const [thanksOpen, setThanksOpen] = useState(false);

  const countdown = useCountdown(content.countdown_to);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = filmOpen || !entered ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [filmOpen, entered]);

  const enter = useCallback(() => {
    setFilmOpen(false);
    setEntered(true);
    try {
      sessionStorage.setItem(`gala-entered-${slug}`, "1");
    } catch {
      /* ignore */
    }
  }, [slug]);

  // The invitation opens itself: a short beat on the gate, then the film.
  const openFilm = useCallback(() => {
    setFilmStalled(false);
    setFilmFallback(false);
    setFilmLoading(true);
    setFilmOpen(true);
  }, []);

  /* ------------------------------------------------------------- music */

  // The song is already running from the welcome screen. Nothing here starts or
  // resumes it on a timer: the only control is the guest's own Sound button.
  const soundAction = music.audible ? "Turn the music off" : "Turn the music on";

  const startFilm = useCallback(() => {
    const v = filmRef.current;
    if (!v) return;
    // The montage is silent by design: the score is owned by the audio
    // element, so the video never carries sound and can always start itself.
    v.muted = true;
    v.play()
      .then(() => setFilmStalled(false))
      .catch(() => setFilmStalled(true));
  }, []);

  // The invitation opens itself: a short beat on the gate, then the film.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (entered || filmOpen || autoOpened.current) return;
    const t = setTimeout(() => {
      autoOpened.current = true;
      openFilm();
    }, 3800);
    return () => clearTimeout(t);
  }, [entered, filmOpen, openFilm]);

  // Start playback as soon as the overlay mounts (no delayed timer: a timeout
  // drops the gesture on iOS), then again on any event that means data arrived.
  useEffect(() => {
    if (!filmOpen) {
      setFilmStalled(false);
      return;
    }
    startFilm();
    const guard = setTimeout(() => {
      const v = filmRef.current;
      if (v && v.paused) setFilmStalled(true);
    }, 1600);
    return () => clearTimeout(guard);
  }, [filmOpen, phoneView, filmFallback, startFilm]);

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const submit = async (response: "yes" | "no") => {
    setError("");
    if (response === "yes" && plusOne && !plusOneName.trim()) {
      setError("Please add the name of the companion joining you.");
      return;
    }
    setSubmitting(true);
    setPendingKind(response);
    try {
      // Personal link: the guest is already on the list, so the answer goes
      // straight to their own record (and the QR fires on "yes").
      if (guestToken) {
        await apiClient(`/rsvp/${guestToken}`, {
          method: "POST",
          body: {
            response,
            note: null,
            plus_one: response === "yes" ? plusOne : false,
            plus_one_name: response === "yes" && plusOne ? plusOneName.trim() : "",
          },
        });
        setDeclined(response === "no");
        setDone(true);
        return;
      }
      if (response === "no") {
        await apiClient(`/rsvp/register/${slug}`, {
          method: "POST",
          body: { name: "", email: "", phone: "", response: "declined" },
        });
        setThanksOpen(true);
        return;
      }
      await apiClient(`/rsvp/register/${slug}`, {
        method: "POST",
        body: {
          name: name.trim(),
          email: email.trim(),
          phone,
          organization: organization.trim(),
          plus_one: plusOne,
          plus_one_name: plusOne ? plusOneName.trim() : "",
          response: "accepted",
        },
      });
      setDone(true);
    } catch (err: any) {
      const msg = err?.detail || err?.message || "";
      if (typeof msg === "string" && msg.toLowerCase().includes("already registered")) {
        setError("This name, email or phone is already on the guest list. Your seat is reserved.");
      } else {
        setError(typeof msg === "string" && msg ? msg : "Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
      setPendingKind(null);
    }
  };

  const downloadCalendar = () => {
    const blob = new Blob([buildIcs(content)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "a-gala-dinner-experience.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const navItems = [
    { id: "invitation", label: "The Invitation" },
    { id: "evening", label: "The Evening" },
    { id: "venue", label: "Venue" },
    { id: "dress", label: "Dress Code" },
  ];

  /* ---------------------------------------------------------- opening gate */

  const galaStyles = (
    <style>{`
      @keyframes gala-breathe {
        0%, 100% {
          transform: scale(1);
          box-shadow: 0 10px 28px rgba(201,162,39,0.28), 0 0 0 0 rgba(201,162,39,0.38);
        }
        50% {
          transform: scale(1.045);
          box-shadow: 0 22px 54px rgba(201,162,39,0.52), 0 0 0 16px rgba(201,162,39,0);
        }
      }
      .gala-breathe { animation: gala-breathe 2.6s ease-in-out infinite; will-change: transform, box-shadow; }
      .gala-breathe:hover { filter: brightness(1.06); }
      @media (prefers-reduced-motion: reduce) {
        .gala-breathe { animation: none; }
      }
      @keyframes galaGateFill {
        from { transform: scaleX(0); }
        to { transform: scaleX(1); }
      }
      @keyframes galaFilmIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `}</style>
  );

  const filmOverlay = filmOpen ? (
    <div
      className="fixed inset-0 z-50 bg-black"
      style={{ animation: "galaFilmIn 900ms ease both" }}
    >
      <video
        ref={filmRef}
        src={
          filmFallback
            ? content.film_url
            : phoneView
              ? content.film_vertical_url
              : content.film_url
        }
        poster={
          filmFallback
            ? content.film_poster_url
            : phoneView
              ? content.film_vertical_poster_url
              : content.film_poster_url
        }
        playsInline
        muted
        autoPlay
        preload="auto"
        controls={false}
        className="h-full w-full object-contain"
        onEnded={enter}
        onError={() => {
          // Never strand a guest on a black screen: fall back to the 16:9 cut
          // once, then move on to the invitation if that fails too.
          if (phoneView && !filmFallback) setFilmFallback(true);
          else enter();
        }}
        onLoadedData={() => {
          const v = filmRef.current;
          if (v && v.paused) startFilm();
        }}
        onCanPlay={() => {
          const v = filmRef.current;
          if (v && v.paused) startFilm();
        }}
        onPlaying={() => {
          setFilmStalled(false);
          setFilmLoading(false);
        }}
      />

      {/* Slow connections: a quiet cue that the film is coming, never a dead frame. */}
      {filmLoading && !filmStalled && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span
            className="h-10 w-10 animate-spin rounded-full border-2"
            style={{ borderColor: "rgba(201,162,39,0.25)", borderTopColor: GOLD }}
          />
        </div>
      )}

      {/* If a browser still refuses to start on its own, this is a real tap. */}
      {filmStalled && (
        <button
          onClick={() => {
            const v = filmRef.current;
            if (v) {
              v.muted = true;
              v.play().then(() => setFilmStalled(false)).catch(() => {});
            }
          }}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4"
          style={{ background: "rgba(3,3,3,0.45)" }}
          aria-label="Play the invitation film"
        >
          <span
            className="flex h-20 w-20 items-center justify-center rounded-full"
            style={{ background: "rgba(201,162,39,0.92)", color: "#0a0a0a" }}
          >
            <Play size={30} fill="currentColor" />
          </span>
          <span className="text-[12px] uppercase" style={{ letterSpacing: "0.26em", color: IVORY }}>
            Tap to play
          </span>
        </button>
      )}

      <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 p-4 sm:p-7">
        <p
          className="rounded-full px-3 py-1.5 text-[9.5px] uppercase sm:px-4 sm:text-[11px]"
          style={{
            letterSpacing: "0.28em",
            color: "rgba(243,237,226,0.95)",
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(6px)",
          }}
        >
          {content.title}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={music.toggle}
            aria-label={soundAction}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
            style={{
              borderColor: "rgba(201,162,39,0.55)",
              color: GOLD,
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(6px)",
            }}
          >
            {music.audible ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  /* ----------------------------------------------------------------- gate */

  // The gate is a branch, never an early return: the audio element and the
  // film overlay have to survive the handover from the gate to the invitation,
  // otherwise the score restarts the moment the film ends.
  const gate = (
      <div className="fixed inset-0 z-40 overflow-y-auto" style={{ background: "#050505" }}>
        {/* Mobile: the invitation words, then it opens on its own */}
        <div className="flex min-h-full flex-col md:hidden">
          <div className="flex flex-1 flex-col items-center justify-center px-6 pb-14 pt-14 text-center">
            <Eyebrow className="mb-4">Your invitation</Eyebrow>
            <h1
              className="font-serif leading-[1.02]"
              style={{ fontSize: "clamp(34px, 9.4vw, 46px)", color: IVORY, letterSpacing: "0.01em" }}
            >
              {(content.title_lines ?? [content.title]).map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h1>
            <GoldRule width={70} className="mx-auto my-5" />
            <p className="mb-1 text-[11.5px] uppercase" style={{ letterSpacing: "0.24em", color: "#c9c0af" }}>
              Wednesday, 2 December 2026
            </p>
            <p className="mb-6 text-[10.5px] uppercase" style={{ letterSpacing: "0.2em", color: "#8a8274" }}>
              Federal Palace Hotel · Victoria Island
            </p>
            <div className="h-px w-44 overflow-hidden" style={{ background: "rgba(201,162,39,0.22)" }}>
              <span
                className="block h-px w-full"
                style={{ background: GOLD, transformOrigin: "left center", animation: "galaGateFill 3.4s linear forwards" }}
              />
            </div>
            <p className="mt-4 text-[10px] uppercase" style={{ letterSpacing: "0.22em", color: "#7e7666" }}>
              The invitation opens on its own
            </p>
          </div>
        </div>

        {/* Desktop: poster + invitation words */}
        <div className="hidden h-full md:grid md:grid-cols-2">
          <div className="flex items-center justify-center p-10">
            <img
              src={content.poster_url}
              alt={content.title}
              className="max-h-[84vh] w-auto border"
              style={{ borderColor: "#3a3016", boxShadow: "0 40px 80px rgba(0,0,0,0.7)" }}
            />
          </div>
          <div className="flex flex-col justify-center px-14 lg:px-20">
            <Eyebrow className="mb-6">{content.kicker}</Eyebrow>
            <h1
              className="font-serif leading-[1.0]"
              style={{ fontSize: "clamp(46px, 5.4vw, 76px)", color: IVORY, letterSpacing: "0.01em" }}
            >
              {(content.title_lines ?? [content.title]).map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h1>
            <GoldRule width={90} className="my-8" />
            <p className="font-serif text-xl italic" style={{ color: "#cfc6b6" }}>
              {content.line}
            </p>
            <p className="mt-4 text-[11px] uppercase" style={{ letterSpacing: "0.32em", color: GOLD }}>
              Wednesday, 2 December 2026 · Red Carpet 5:00 PM
            </p>
            <div className="mt-10 h-px w-56 overflow-hidden" style={{ background: "rgba(201,162,39,0.22)" }}>
              <span
                className="block h-px w-full"
                style={{ background: GOLD, transformOrigin: "left center", animation: "galaGateFill 3.4s linear forwards" }}
              />
            </div>
            <p className="mt-4 text-[10px] uppercase" style={{ letterSpacing: "0.26em", color: "#7e7666" }}>
              The invitation opens on its own
            </p>
          </div>
        </div>
      </div>
  );

  /* -------------------------------------------------------------- invitation */

  const invitation = (
    <div className="min-h-screen" style={{ background: INK, color: IVORY }}>
      {/* nav */}
      <header
        className="fixed inset-x-0 top-0 z-30 transition-all duration-500"
        style={{
          background: scrolled ? "rgba(7,7,7,0.88)" : "transparent",
          backdropFilter: scrolled ? "blur(14px)" : "none",
          borderBottom: scrolled ? "1px solid #241f14" : "1px solid transparent",
        }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-3">
            <span className="block h-2 w-2 rotate-45" style={{ background: GOLD }} />
            <span
              className="hidden text-[10px] uppercase sm:block"
              style={{ letterSpacing: "0.28em", color: IVORY }}
            >
              {content.title}
            </span>
          </button>

          <nav className="hidden items-center gap-8 lg:flex">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="text-[10px] uppercase transition-colors hover:text-[#C9A227]"
                style={{ letterSpacing: "0.26em", color: "#cfc6b6" }}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => scrollTo("rsvp")}
              className="border px-5 py-2.5 text-[10px] font-semibold uppercase transition-all hover:bg-[#C9A227] hover:text-black"
              style={{ borderColor: GOLD, color: GOLD, letterSpacing: "0.22em" }}
            >
              RSVP
            </button>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {musicUrl && (
              <button
                onClick={music.toggle}
                aria-label={soundAction}
                className="flex h-10 w-10 items-center justify-center rounded-full border"
                style={{ borderColor: "rgba(201,162,39,0.45)", color: GOLD }}
              >
                {music.audible ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>
            )}
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Menu"
              className="flex h-10 w-10 items-center justify-center lg:hidden"
              style={{ color: GOLD }}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t px-6 py-6 lg:hidden" style={{ borderColor: "#241f14", background: "#090909" }}>
            <div className="flex flex-col gap-5">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className="text-left text-[13px] uppercase tracking-[0.2em]"
                  style={{ color: IVORY }}
                >
                  {item.label}
                </button>
              ))}
              <button
                onClick={() => scrollTo("rsvp")}
                className="mt-2 border px-5 py-3 text-[12px] font-semibold uppercase"
                style={{ borderColor: GOLD, color: GOLD, letterSpacing: "0.2em" }}
              >
                RSVP
              </button>
            </div>
          </div>
        )}
      </header>

      {/* hero */}
      <section className="relative flex min-h-[94vh] items-center justify-center overflow-hidden px-5 pt-24">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 45% at 50% 42%, rgba(201,162,39,0.13), transparent 70%), linear-gradient(180deg, #070707 0%, #0a0906 55%, #070707 100%)",
          }}
        />
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <Reveal>
            <Eyebrow className="mb-7">{content.kicker}</Eyebrow>
          </Reveal>
          <Reveal delay={90}>
            <h1
              className="font-serif leading-[1.0]"
              style={{ fontSize: "clamp(44px, 11vw, 88px)", letterSpacing: "0.01em", color: IVORY }}
            >
              {(content.title_lines ?? [content.title]).map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h1>
          </Reveal>
          <Reveal delay={180}>
            <GoldRule width={110} className="mx-auto my-8" />
            <p className="font-serif text-[19px] italic sm:text-2xl" style={{ color: "#d8cfbe" }}>
              {content.line}
            </p>
            <p
              className="mt-6 text-[11.5px] uppercase tracking-[0.24em] sm:text-[12px] sm:tracking-[0.34em]"
              style={{ color: GOLD }}
            >
              Wednesday, 2 December 2026
            </p>
            <p
              className="mt-2 text-[11px] uppercase tracking-[0.2em] sm:text-[12px] sm:tracking-[0.28em]"
              style={{ color: "#8f8778" }}
            >
              Federal Palace Hotel · Victoria Island, Lagos
            </p>
            {content.book_launch && (
              <p className="mt-3 text-[10.5px] italic sm:text-[11.5px]" style={{ color: "#7e7666" }}>
                With the launch of {content.book_launch.title}
              </p>
            )}
          </Reveal>

          <Reveal delay={280}>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                onClick={() => scrollTo("rsvp")}
                className="inline-flex items-center gap-2 px-8 py-4 text-[12px] font-semibold uppercase text-black transition-transform hover:scale-[1.02]"
                style={{ background: GOLD, letterSpacing: "0.2em" }}
              >
                Reserve Your Seat <ArrowRight size={14} />
              </button>
              <button
                onClick={openFilm}
                className="inline-flex items-center gap-2 px-7 py-4 text-[12px] uppercase transition-colors hover:text-[#C9A227]"
                style={{ color: "#cfc6b6", letterSpacing: "0.18em" }}
              >
                <Play size={13} /> Watch the Invitation
              </button>
            </div>
          </Reveal>

          {!countdown.over && (
            <Reveal delay={340}>
              <div className="mt-14 flex items-start justify-center gap-6 sm:gap-10">
                {[
                  ["Days", countdown.days],
                  ["Hours", countdown.hours],
                  ["Minutes", countdown.minutes],
                  ["Seconds", countdown.seconds],
                ].map(([label, val]) => (
                  <div key={label as string} className="text-center">
                    <p className="font-serif text-[30px] sm:text-4xl" style={{ color: IVORY }}>
                      {String(val).padStart(2, "0")}
                    </p>
                    <p
                      className="mt-1 text-[10px] uppercase tracking-[0.24em] sm:text-[10px] sm:tracking-[0.3em]"
                      style={{ color: "#8f8778" }}
                    >
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </Reveal>
          )}
        </div>

        <button
          onClick={() => scrollTo("invitation")}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          aria-label="Scroll down"
          style={{ color: "rgba(201,162,39,0.55)" }}
        >
          <ChevronDown size={22} className="animate-bounce" />
        </button>
      </section>

      {/* the invitation */}
      <section id="invitation" className="border-t px-5 py-24 sm:px-8 md:py-32" style={{ borderColor: "#1c1810" }}>
        <div className="mx-auto grid max-w-6xl items-center gap-14 md:grid-cols-[1.05fr_0.95fr] md:gap-20">
          <Reveal>
            <Eyebrow className="mb-6">The Invitation</Eyebrow>
            <h2
              className="font-serif leading-[1.05]"
              style={{ fontSize: "clamp(32px, 8.6vw, 48px)", color: IVORY }}
            >
              An evening built
              <br />
              around the table.
            </h2>
            <GoldRule width={80} className="my-7" />
            <p className="text-[16.5px] leading-[1.85]" style={{ color: "#bdb5a6" }}>
              It is our pleasure to invite you to an exclusive gala dinner at the Federal Palace Hotel: an
              evening of fine dining, live conversation and the quiet power of presence.
            </p>
            <p className="mt-4 text-[16.5px] leading-[1.85]" style={{ color: "#bdb5a6" }}>
              Dinner is the heart of the night, served in the Balmoral Convention Centre, and the evening
              continues long after the last toast. Attendance is by invitation, and every guest has been
              chosen with care.
            </p>
            {content.book_launch && (
              <p className="mt-5 border-l pl-5 text-[14.5px] leading-[1.8] italic" style={{ borderColor: "#2a2416", color: "#9a9285" }}>
                {content.book_launch.note}
              </p>
            )}

            <div className="mt-9 border-l pl-6" style={{ borderColor: "#3a3016" }}>
              <p className="font-serif text-[19.5px] italic leading-relaxed" style={{ color: "#d8cfbe" }}>
                &ldquo;{content.quote.text}&rdquo;
              </p>
              <p
                className="mt-3 text-[10.5px] uppercase tracking-[0.24em] sm:tracking-[0.3em]"
                style={{ color: GOLD }}
              >
                {content.quote.author}
              </p>
            </div>
          </Reveal>

          <Reveal delay={140}>
            <div className="relative mx-auto w-full max-w-sm">
              <div
                className="absolute -left-3 -top-3 h-full w-full border"
                style={{ borderColor: "#3a3016" }}
              />
              <img
                src={content.portrait_url}
                alt={content.host}
                className="relative block h-auto w-full border object-cover"
                style={{ borderColor: "#241f14" }}
              />
              <div
                className="absolute inset-x-0 bottom-0 px-5 pb-5 pt-16"
                style={{ background: "linear-gradient(180deg, transparent, rgba(7,7,7,0.92))" }}
              >
                <Eyebrow className="mb-1 text-[10px]">Hosted by</Eyebrow>
                <p className="font-serif text-[20px]" style={{ color: IVORY }}>
                  {content.host}
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* the evening */}
      <section
        id="evening"
        className="border-y px-5 py-24 sm:px-8 md:py-32"
        style={{ borderColor: "#1c1810", background: "#0a0908" }}
      >
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <div className="text-center">
              <Eyebrow className="mb-4">The Evening</Eyebrow>
              <h2 className="font-serif" style={{ fontSize: "clamp(32px, 8vw, 44px)", color: IVORY }}>
                An evening built around dinner
              </h2>
              <GoldRule width={70} className="mx-auto mt-6" />
            </div>
          </Reveal>

          <div className="relative mt-14">
            <div className="absolute bottom-0 left-[7px] top-0 w-px sm:left-[92px]" style={{ background: "#2a2416" }} />
            <div className="space-y-10">
              {content.evening.map((item, i) => (
                <Reveal key={item.title} delay={i * 70}>
                  <div className="relative flex flex-col gap-2 pl-8 sm:flex-row sm:items-baseline sm:gap-8 sm:pl-0">
                    <div className="hidden w-[76px] flex-shrink-0 text-right sm:block">
                      <p className="text-[10px] uppercase" style={{ letterSpacing: "0.22em", color: GOLD }}>
                        {item.time}
                      </p>
                    </div>
                    <span
                      className="absolute left-0 top-2 block h-3.5 w-3.5 rotate-45 border sm:left-[86px]"
                      style={{ borderColor: GOLD, background: "#0a0908" }}
                    />
                    <div className="sm:pl-8">
                      <p
                        className="text-[11.5px] uppercase tracking-[0.16em] sm:hidden"
                        style={{ color: GOLD }}
                      >
                        {item.time}
                      </p>
                      <h3 className="mt-1 font-serif text-[23px] sm:mt-0 sm:text-2xl" style={{ color: IVORY }}>
                        {item.title}
                      </h3>
                      <p className="mt-1 text-[15.5px] leading-relaxed" style={{ color: "#a49b8d" }}>
                        {item.detail}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* venue */}
      <section id="venue" className="px-5 py-24 sm:px-8 md:py-32">
        <div className="mx-auto grid max-w-6xl gap-14 md:grid-cols-2 md:gap-16">
          <Reveal>
            <Eyebrow className="mb-8">When &amp; Where</Eyebrow>
            <div className="flex items-end gap-5">
              <p className="font-serif leading-none" style={{ fontSize: "clamp(92px, 26vw, 132px)", color: IVORY }}>
                {content.date.day}
              </p>
              <div className="pb-3">
                <p className="text-[12.5px] uppercase tracking-[0.24em]" style={{ color: GOLD }}>
                  {content.date.month}
                </p>
                <p className="font-serif text-[26px]" style={{ color: IVORY }}>
                  {content.date.year}
                </p>
              </div>
            </div>
            <p className="mt-4 text-[12px] uppercase tracking-[0.22em]" style={{ color: "#9a9285" }}>
              {content.date.weekday}
            </p>

            <div className="mt-10 space-y-5">
              <div className="flex items-start gap-4">
                <Clock size={17} style={{ color: GOLD, marginTop: 3 }} />
                <div>
                  <p className="text-[11.5px] uppercase tracking-[0.2em]" style={{ color: GOLD }}>
                    Red Carpet
                  </p>
                  <p className="mt-1 text-[16.5px]" style={{ color: IVORY }}>
                    {content.red_carpet}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <MapPin size={17} style={{ color: GOLD, marginTop: 3 }} />
                <div>
                  <p className="text-[11.5px] uppercase tracking-[0.2em]" style={{ color: GOLD }}>
                    Venue
                  </p>
                  <p className="mt-1 text-[16.5px]" style={{ color: IVORY }}>
                    {content.venue.name}
                  </p>
                  <p className="text-[15.5px]" style={{ color: "#a49b8d" }}>
                    {content.venue.room}
                  </p>
                  <p className="text-[15.5px]" style={{ color: "#a49b8d" }}>
                    {content.venue.location}
                  </p>
                </div>
              </div>
            </div>

            <a
              href={content.venue.map_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center gap-2 border px-6 py-3.5 text-[11.5px] uppercase transition-all hover:bg-[#C9A227] hover:text-black"
              style={{ borderColor: GOLD, color: GOLD, letterSpacing: "0.2em" }}
            >
              Get Directions <ArrowRight size={14} />
            </a>
          </Reveal>

          <Reveal delay={130}>
            <div className="border p-7 sm:p-10" style={{ borderColor: "#2a2416", background: "#0a0908" }}>
              <Eyebrow className="mb-4">After Party</Eyebrow>
              <h3 className="font-serif" style={{ fontSize: "clamp(34px, 9vw, 44px)", color: IVORY }}>
                {content.after_party.venue}
              </h3>
              <GoldRule width={54} className="my-5" />
              <p className="text-[15.5px] leading-relaxed" style={{ color: "#bdb5a6" }}>
                {content.after_party.note}. The evening does not end when dinner does: join us as the gala
                moves to {content.after_party.venue}.
              </p>
              <a
                href={content.after_party.map_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-7 inline-flex items-center gap-2 text-[11.5px] uppercase transition-colors hover:text-[#C9A227]"
                style={{ color: "#cfc6b6", letterSpacing: "0.2em" }}
              >
                Directions to {content.after_party.venue} <ArrowRight size={13} />
              </a>

              <div className="mt-9 border-t pt-6" style={{ borderColor: "#241f14" }}>
                <div className="flex items-center gap-3">
                  <Calendar size={16} style={{ color: GOLD }} />
                  <button
                    onClick={downloadCalendar}
                    className="text-[11.5px] uppercase transition-colors hover:text-[#C9A227]"
                    style={{ color: "#cfc6b6", letterSpacing: "0.2em" }}
                  >
                    Add to calendar
                  </button>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* dress code */}
      <section
        id="dress"
        className="border-y px-5 py-24 text-center sm:px-8 md:py-32"
        style={{ borderColor: "#1c1810", background: "#0a0908" }}
      >
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <Eyebrow className="mb-6">Dress Code</Eyebrow>
            <h2
              className="font-serif leading-[1.02]"
              style={{ fontSize: "clamp(38px, 11vw, 68px)", color: IVORY, letterSpacing: "0.04em" }}
            >
              STYLISH IN
              <br />
              ALL BLACK
            </h2>
            <GoldRule width={90} className="mx-auto my-7" />
            <p className="mx-auto max-w-xl text-[16.5px] leading-[1.85]" style={{ color: "#bdb5a6" }}>
              {content.dress_code.note}
            </p>
          </Reveal>

          <Reveal delay={120}>
            <div className="mt-12 flex items-start justify-center gap-8 sm:gap-12">
              {[
                { name: "Midnight Black", hex: "#0b0b0b" },
                { name: "Champagne Gold", hex: GOLD },
                { name: "Ivory", hex: "#EFE6D6" },
              ].map((c) => (
                <div key={c.name} className="text-center">
                  <span
                    className="mx-auto block h-14 w-14 rounded-full sm:h-16 sm:w-16"
                    style={{ background: c.hex, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.14)" }}
                  />
                  <p
                    className="mt-3 text-[10.5px] uppercase tracking-[0.2em] sm:text-[9px] sm:tracking-[0.24em]"
                    style={{ color: "#9a9285" }}
                  >
                    {c.name}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* rsvp */}
      <section id="rsvp" className="px-5 py-24 sm:px-8 md:py-32">
        <div className="mx-auto max-w-xl">
          <Reveal>
            <div className="text-center">
              <Eyebrow className="mb-4">Reservation</Eyebrow>
              <h2 className="font-serif" style={{ fontSize: "clamp(34px, 9vw, 48px)", color: IVORY }}>
                {done ? (declined ? "Thank you" : "Your seat is reserved") : "Will you join us?"}
              </h2>
              <GoldRule width={70} className="mx-auto mt-6" />
            </div>
          </Reveal>

          <Reveal delay={110}>
            <div className="mt-12 border p-7 sm:p-10" style={{ borderColor: "#2a2416", background: "#0a0908" }}>
              {done ? (
                <div className="text-center">
                  {declined ? (
                    <>
                      <p className="font-serif text-lg" style={{ color: IVORY }}>
                        Thank you for letting us know.
                      </p>
                      <p className="mt-3 text-[15.5px] leading-relaxed" style={{ color: "#a49b8d" }}>
                        We are sorry you cannot make it. You will be missed at the table.
                      </p>
                    </>
                  ) : (
                    <>
                      <span
                        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
                        style={{ border: `1px solid ${GOLD}`, color: GOLD }}
                      >
                        <Check size={24} />
                      </span>
                      <p className="mt-6 font-serif text-xl" style={{ color: IVORY }}>
                        We look forward to welcoming you.
                      </p>
                      <p className="mt-3 text-[15.5px] leading-relaxed" style={{ color: "#a49b8d" }}>
                        Your personal QR entry pass is on its way to your email and WhatsApp. Please present
                        it at the red carpet on Wednesday, 2 December.
                      </p>
                      {plusOne && (
                        <p className="mt-3 text-[15.5px] leading-relaxed" style={{ color: GOLD }}>
                          Your pass admits two: you and {plusOneName.trim() || "your guest"}.
                        </p>
                      )}
                      <button
                        onClick={downloadCalendar}
                        className="mt-7 inline-flex items-center gap-2 border px-6 py-3.5 text-[11.5px] uppercase transition-all hover:bg-[#C9A227] hover:text-black"
                        style={{ borderColor: GOLD, color: GOLD, letterSpacing: "0.2em" }}
                      >
                        <Download size={13} /> Add to Calendar
                      </button>
                    </>
                  )}
                  {guestToken && (
                    <button
                      onClick={() => {
                        setDone(false);
                        setDeclined(false);
                        setAttendance(null);
                        setError("");
                      }}
                      className="mt-6 block w-full text-[10.5px] uppercase underline decoration-[#3a3016] underline-offset-4 transition-colors hover:text-[#C9A227]"
                      style={{ letterSpacing: "0.2em", color: "#8f8778" }}
                    >
                      Change my response
                    </button>
                  )}
                </div>
              ) : attendance === null ? (
                <div>
                  <p className="text-center text-[15.5px] leading-relaxed" style={{ color: "#bdb5a6" }}>
                    Kindly confirm your attendance. The evening is intimate, and seats are limited.
                  </p>
                  <p className="mt-2 text-center text-[13px] leading-relaxed" style={{ color: "#8f8778" }}>
                    {content.plus_one?.note ?? "Your invitation admits you and one companion."}
                  </p>
                  {guestToken && guest?.name && (
                    <p
                      className="mt-4 text-center text-[10.5px] uppercase"
                      style={{ letterSpacing: "0.22em", color: GOLD }}
                    >
                      Reserved for {guest.name}
                    </p>
                  )}

                  <div className="mt-7 border p-5" style={{ borderColor: "#2a2416", background: "rgba(201,162,39,0.03)" }}>
                    <p className="text-[10.5px] uppercase" style={{ letterSpacing: "0.24em", color: GOLD }}>
                      Your party
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {[
                        { key: false, label: "Just me" },
                        { key: true, label: "Me + one" },
                      ].map((option) => (
                        <button
                          key={String(option.key)}
                          type="button"
                          onClick={() => {
                            setPlusOne(option.key);
                            setError("");
                            if (!option.key) setPlusOneName("");
                          }}
                          className="border px-4 py-3 text-[11.5px] uppercase transition-all"
                          style={{
                            borderColor: plusOne === option.key ? GOLD : "#3a3016",
                            background: plusOne === option.key ? "rgba(201,162,39,0.10)" : "transparent",
                            color: plusOne === option.key ? GOLD : "#9a9285",
                            letterSpacing: "0.18em",
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    {plusOne && guestToken && (
                      <input
                        value={plusOneName}
                        onChange={(e) => setPlusOneName(e.target.value)}
                        placeholder="Your companion's full name"
                        className="mt-4 h-12 w-full border-b bg-transparent px-1 text-[16px] outline-none transition-colors placeholder:text-[#6f685c]"
                        style={{ borderColor: "#3a3016", color: IVORY }}
                      />
                    )}
                  </div>

                  <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    <button
                      onClick={() => (guestToken ? submit("yes") : setAttendance("yes"))}
                      disabled={submitting}
                      className="group border px-6 py-7 text-center transition-all hover:border-[#C9A227] disabled:opacity-60"
                      style={{ borderColor: "#3a3016", background: "rgba(201,162,39,0.03)" }}
                    >
                      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border" style={{ borderColor: GOLD, color: GOLD }}>
                        {pendingKind === "yes" ? <Loader size={18} className="animate-spin" /> : <Check size={18} />}
                      </span>
                      <p className="mt-4 text-[12.5px] uppercase" style={{ letterSpacing: "0.22em", color: IVORY }}>
                        {guestToken ? "Confirm my seat" : "Yes, I will attend"}
                      </p>
                    </button>
                    <button
                      onClick={() => submit("no")}
                      disabled={submitting}
                      className="border px-6 py-7 text-center transition-all hover:border-[#6f685c] disabled:opacity-60"
                      style={{ borderColor: "#3a3016" }}
                    >
                      <span
                        className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border"
                        style={{ borderColor: "#4a4436", color: "#8f8778" }}
                      >
                        {pendingKind === "no" ? <Loader size={18} className="animate-spin" /> : <X size={18} />}
                      </span>
                      <p className="mt-4 text-[12.5px] uppercase" style={{ letterSpacing: "0.22em", color: "#9a9285" }}>
                        I cannot attend
                      </p>
                    </button>
                  </div>
                  {error && (
                    <p className="mt-5 text-center text-sm" style={{ color: "#e07a6a" }}>
                      {error}
                    </p>
                  )}
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit("yes");
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setAttendance(null);
                      setError("");
                    }}
                    className="mb-7 inline-flex items-center gap-2 text-[11.5px] uppercase transition-colors hover:text-[#C9A227]"
                    style={{ color: "#8f8778", letterSpacing: "0.18em" }}
                  >
                    <ArrowRight size={12} className="rotate-180" /> Back
                  </button>

                  <p
                    className="mb-6 text-[11px] uppercase tracking-[0.22em]"
                    style={{ color: GOLD }}
                  >
                    Your details
                  </p>

                  <div className="space-y-6">
                    <div>
                      <label className="mb-2 block text-[11px] uppercase tracking-[0.18em]" style={{ color: "#9a9285" }}>
                        Full Name <span style={{ color: GOLD }}>*</span>
                      </label>
                      <input
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your full name"
                        className="h-12 w-full border-b bg-transparent px-1 text-[16px] outline-none transition-colors placeholder:text-[#6f685c]"
                        style={{ borderColor: "#3a3016", color: IVORY }}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[11px] uppercase tracking-[0.18em]" style={{ color: "#9a9285" }}>
                        Email <span style={{ color: GOLD }}>*</span>
                      </label>
                      <input
                        required
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="h-12 w-full border-b bg-transparent px-1 text-[16px] outline-none transition-colors placeholder:text-[#6f685c]"
                        style={{ borderColor: "#3a3016", color: IVORY }}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[11px] uppercase tracking-[0.18em]" style={{ color: "#9a9285" }}>
                        Phone Number <span style={{ color: GOLD }}>*</span>
                      </label>
                      <GalaPhoneInput value={phone} onChange={setPhone} />
                    </div>

                    <div>
                      <label className="mb-2 block text-[11px] uppercase tracking-[0.18em]" style={{ color: "#9a9285" }}>
                        Organization <span style={{ color: "#6f685c" }}>(optional)</span>
                      </label>
                      <input
                        value={organization}
                        onChange={(e) => setOrganization(e.target.value)}
                        placeholder="Company or brand"
                        className="h-12 w-full border-b bg-transparent px-1 text-[16px] outline-none transition-colors placeholder:text-[#6f685c]"
                        style={{ borderColor: "#3a3016", color: IVORY }}
                      />
                    </div>

                    {plusOne && (
                      <div>
                        <label className="mb-2 block text-[11px] uppercase tracking-[0.18em]" style={{ color: "#9a9285" }}>
                          Plus One's Full Name <span style={{ color: GOLD }}>*</span>
                        </label>
                        <input
                          required
                          value={plusOneName}
                          onChange={(e) => setPlusOneName(e.target.value)}
                          placeholder="Your companion's full name"
                          className="h-12 w-full border-b bg-transparent px-1 text-[16px] outline-none transition-colors placeholder:text-[#6f685c]"
                          style={{ borderColor: "#3a3016", color: IVORY }}
                        />
                        <p className="mt-2 text-[11.5px]" style={{ color: "#8a8274" }}>
                          One pass admits you both.
                        </p>
                      </div>
                    )}
                  </div>

                  {error && (
                    <p className="mt-5 text-sm" style={{ color: "#e07a6a" }}>
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting || !name.trim() || !email.trim() || !phone}
                    className="mt-8 inline-flex w-full items-center justify-center gap-2 px-8 py-4 text-[12.5px] font-semibold uppercase text-black transition-opacity disabled:opacity-50"
                    style={{ background: GOLD, letterSpacing: "0.2em" }}
                  >
                    {submitting ? <Loader size={15} className="animate-spin" /> : <>Confirm Attendance <ArrowRight size={14} /></>}
                  </button>
                  <p className="mt-4 text-center text-[11.5px]" style={{ color: "#8a8274" }}>
                    Your QR entry pass will be sent to your email and WhatsApp.
                  </p>
                </form>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t px-5 py-12 text-center" style={{ borderColor: "#1c1810" }}>
        <p className="font-serif text-[20px]" style={{ color: IVORY }}>
          {content.title}
        </p>
        <p className="mt-2 text-[10.5px] uppercase tracking-[0.24em]" style={{ color: GOLD }}>
          2 December 2026 · Lagos
        </p>
        <p className="mt-6 text-[11px]" style={{ color: "#8a8274" }}>
          Hosted by {content.host}
        </p>
        <p className="mt-1 text-[10.5px]" style={{ color: "#6f685c" }}>
          Powered by Accredit Interactive
        </p>
      </footer>
    </div>
  );

  /* ------------------------------------------------------------------ page */

  return (
    <>
      {galaStyles}
      {filmOverlay}

      {entered ? invitation : gate}

      <RsvpThanksModal
        open={thanksOpen}
        onClose={() => setThanksOpen(false)}
        accent={GOLD}
        surface="#0a0908"
        textColor={IVORY}
        mutedColor="#a49b8d"
      />
    </>
  );
}
