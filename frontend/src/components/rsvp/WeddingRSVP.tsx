"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import WeddingMusicButton from "@/components/rsvp/WeddingMusic";
import WeddingNav from "@/components/rsvp/WeddingNav";
import WeddingPhoneInput from "@/components/rsvp/WeddingPhoneInput";
import { playWeddingMusic } from "@/lib/wedding-music";

interface WeddingRSVPProps {
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

const GOLD = "#b8892f";
const GOLD_LIGHT = "#e8c05f";
const CREAM = "#f5f0e6";
const INK = "#2b2118";

function dirUrl(destination: string) {
  // No origin means Google Maps routes from the guest's current location.
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

function useCountdown(targetIso: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, new Date(targetIso).getTime() - now);
  return {
    passed: diff <= 0,
    days: Math.floor(diff / 86400000),
    hours: Math.floor(diff / 3600000) % 24,
    minutes: Math.floor(diff / 60000) % 60,
    seconds: Math.floor(diff / 1000) % 60,
  };
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true);
            obs.disconnect();
          }
        });
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
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.8s ease ${delay}ms, transform 0.8s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// A calendar file the guest can drop straight into their phone, generated from
// the same details the page shows, so nothing has to be retyped.
function calendarHref(content: any) {
  const start = new Date(content.countdown_to);
  const end = new Date(start.getTime() + 7 * 3600 * 1000);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const ceremony = content.ceremony || {};
  const reception = content.reception || {};
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Accredit Interactive//Wedding Invitation//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${content.bride || "bride"}-${content.groom || "groom"}-${stamp(start)}@accredit.vip`.replace(/\s+/g, "-"),
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${content.bride || "Bride"} and ${content.groom || "Groom"}, White Wedding`,
    `LOCATION:${ceremony.venue || ""}, ${ceremony.location || ""}`,
    `DESCRIPTION:White wedding ceremony at ${ceremony.time || ""}. Reception from ${reception.time || ""} at ${reception.venue || ""}.`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return "data:text/calendar;charset=utf-8," + encodeURIComponent(lines.join("\r\n"));
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] uppercase mb-3 font-medium" style={{ color: GOLD, letterSpacing: "0.35em" }}>
      {children}
    </p>
  );
}

// A chapter of the invitation: one photograph, then the words that belong to
// it. The picture is never cropped into a letterbox and no copy is ever laid
// over a face, which is what keeps portrait photography readable on a phone.
function WeddingChapter({
  id,
  image,
  imagePosition = "center 45%",
  eyebrow,
  title,
  children,
}: {
  id?: string;
  image: string;
  imagePosition?: string;
  eyebrow: string;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section id={id} className="wed-chapter mt-12 w-full" style={{ background: "#120d08" }}>
      <div className="mx-auto grid w-full max-w-6xl items-center md:grid-cols-2">
        <div className="wed-chapter-media relative w-full overflow-hidden" style={{ background: "#0b0805" }}>
          <img
            src={image}
            alt=""
            className="h-full w-full object-cover"
            style={{ objectPosition: imagePosition }}
            loading="lazy"
          />
        </div>
        <div className="px-6 py-12 sm:px-10 md:py-16">
          <p className="text-[10px] uppercase font-medium" style={{ color: GOLD_LIGHT, letterSpacing: "0.42em" }}>
            {eyebrow}
          </p>
          <h2 className="mt-3 font-serif text-4xl leading-[1.1] sm:text-5xl" style={{ color: "#f8f2e6" }}>
            {title}
          </h2>
          <div className="mt-6" style={{ color: "rgba(248,242,230,0.88)" }}>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function WeddingRSVP({ slug, content, guestToken, guest }: WeddingRSVPProps) {
  const [entered, setEntered] = useState<boolean>(() => {
    // If the guest already opened the invitation this session (e.g. coming
    // back from the Aso Ebi page), skip the opening film, never replay it.
    try {
      return typeof window !== "undefined" && sessionStorage.getItem(`wed-entered-${slug}`) === "1";
    } catch {
      return false;
    }
  });
  const [playingFilm, setPlayingFilm] = useState(false);
  const [fading, setFading] = useState(false);
  const filmRef = useRef<HTMLVideoElement | null>(null);

  const [attendance, setAttendance] = useState<"yes" | "no" | null>(null);
  const [name, setName] = useState(guest?.name || "");
  const [email, setEmail] = useState(guest?.email || "");
  const [phone, setPhone] = useState(guest?.phone || "");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(
    guest?.status === "accepted" || guest?.status === "declined"
  );
  const [declined, setDeclined] = useState(guest?.status === "declined");
  const [error, setError] = useState("");

  const [dressPick, setDressPick] = useState<string | null>(null);

  const cd = useCountdown(content.countdown_to);
  const filmUrl = content.invite_video_url || content.video_url;
  const posterUrl = content.invite_poster_url || content.monogram_url;
  const photos: string[] = content.photos || [];
  const heroImage = content.hero_image || photos[1] || photos[0] || content.monogram_url;
  // Each photograph carries one chapter, the way the client's reference site
  // does it: no gallery grid, just full-bleed pictures under the words.
  const dayPhoto = photos[0] || heroImage;
  const asoebiPhoto = photos[2] || photos[0] || heroImage;
  const heroLine =
    content.hero_line ||
    "To join in the celebration of love at their White Wedding, Abuja, Saturday 19 December 2026.";
  const musicUrl = content.music_url;

  const ceremony = content.ceremony || {};
  const ceremonyFull = [ceremony.venue, ceremony.location].filter(Boolean).join(", ");

  // The curtain clip ends on a few seconds of black. Reveal on the moment the
  // curtain has actually left the frame (data driven, so replacing the clip only
  // means updating reveal_at) and always on end or on error as the safety net.
  const revealAt = Number(content.reveal_at) || 0;
  const onFilmTime = () => {
    const v = filmRef.current;
    if (!v) return;
    const cut = revealAt > 0 ? revealAt : v.duration ? v.duration - 0.05 : 0;
    if (cut > 0 && v.currentTime >= cut) reveal();
  };

  const reveal = () => {
    if (fading) return;
    filmRef.current?.pause();
    setFading(true);
    window.setTimeout(() => {
      try {
        sessionStorage.setItem(`wed-entered-${slug}`, "1");
      } catch {}
      setEntered(true);
      window.scrollTo({ top: 0 });
    }, 700);
  };

  const startFilm = () => {
    // Music begins the moment the guest taps to open, while the silent curtain
    // clip plays. If the clip cannot play, open the invitation straight away.
    if (musicUrl) playWeddingMusic(musicUrl);
    setPlayingFilm(true);
    const v = filmRef.current;
    if (!v) {
      reveal();
      return;
    }
    v.muted = true;
    v.currentTime = 0;
    v.play().catch(() => reveal());
  };

  useEffect(() => {
    if (entered) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [entered]);

  const submitRsvp = async () => {
    if (!name.trim() || !phone.trim() || !email.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await apiClient(`/rsvp/register/${slug}`, {
        method: "POST",
        body: { name: name.trim(), phone: phone.trim(), email: email.trim(), response: "accepted" },
      });
      setDone(true);
    } catch (err: any) {
      const msg = err.detail || err.message || "";
      setError(
        msg.toLowerCase().includes("already registered")
          ? "You have already registered, no need to do it again."
          : msg || "Failed to submit. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Personal link: the guest is already on the list, so both answers are
  // recorded against their own row and no details are asked for again.
  const submitPersonal = async (response: "yes" | "no") => {
    if (!guestToken) return;
    setAttendance(response);
    setSubmitting(true);
    setError("");
    try {
      await apiClient(`/rsvp/${guestToken}`, {
        method: "POST",
        body: { response },
      });
      setDeclined(response === "no");
      setDone(true);
    } catch (err: any) {
      setError(err?.detail || err?.message || "Failed to submit. Please try again.");
      setAttendance(null);
    } finally {
      setSubmitting(false);
    }
  };

  const scrollTo = (href: string) => {
    if (href === "#invitation") {
      // Invitation always restarts from the curtain opening.
      try {
        sessionStorage.removeItem(`wed-entered-${slug}`);
      } catch {}
      filmRef.current?.pause();
      setPlayingFilm(false);
      setFading(false);
      setEntered(false);
      setTimeout(() => window.scrollTo({ top: 0 }), 50);
      return;
    }
    const id = href.replace("#", "");
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const navItems = [
    { label: "Invitation", href: "#invitation" },
    { label: "When & Where", href: "#when-where" },
    { label: "Dress Code", href: "#dress-code" },
    { label: "Hotels", href: "#hotels" },
    { label: "RSVP", href: "#rsvp" },
  ];

  const inputCls =
    "w-full h-12 rounded-xl bg-white border px-4 text-sm outline-none placeholder:text-stone-400 transition focus:border-[#b8892f] focus:ring-2 focus:ring-[#b8892f]/25";

  const labelCls = "block text-xs font-black mb-1.5 uppercase";

  return (
    <div className="min-h-screen" style={{ background: CREAM, color: INK }}>
      <style>{`
        .wed-chapter { scroll-margin-top: 4rem; }
        .wed-chapter-media { height: 62svh; }
        @media (min-width: 768px) {
          .wed-chapter-media { height: min(80svh, 700px); }
        }
        .wed-tap-cta {
          animation: wedTap 2.6s ease-in-out infinite;
          box-shadow: 0 12px 26px rgba(0, 0, 0, 0.5);
        }
        @keyframes wedTap {
          0%, 100% {
            transform: translateY(0) scale(1);
            box-shadow: 0 12px 26px rgba(0, 0, 0, 0.5);
          }
          50% {
            transform: translateY(-3px) scale(1.04);
            box-shadow: 0 17px 32px rgba(0, 0, 0, 0.55);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .wed-tap-cta { animation: none; }
        }
      `}</style>
      {/* OPENING CURTAIN: the client's clip, which parts onto their photograph */}
      {!entered && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-700 ease-out sm:px-6"
          style={{
            background: "#100b06",
            opacity: fading ? 0 : 1,
            pointerEvents: fading ? "none" : "auto",
          }}
        >
          <div
            className="relative h-full w-full overflow-hidden"
            style={{
              // Cap the width to the clip's own aspect so the artwork can never
              // be cropped vertically on short or landscape viewports. On a
              // portrait phone the cap is wider than the screen, so the curtain
              // still fills it edge to edge.
              maxWidth: "calc(100svh * 464 / 848)",
              boxShadow: "0 0 120px rgba(0,0,0,0.6)",
            }}
          >
            {!playingFilm && (
              <button
                type="button"
                onClick={startFilm}
                aria-label="Tap to open the invitation"
                className="absolute inset-0 h-full w-full cursor-pointer"
              >
                <img
                  src={posterUrl}
                  alt="Sarah and Patrick"
                  className="h-full w-full object-cover"
                  draggable={false}
                />
                {/* The clip carries a tiny "tap to open" caption inside its own
                    artwork, so the real control sits exactly over it: a gold
                    button, in the same words, that pulses until it is tapped. */}
                <span
                  className="pointer-events-none absolute inset-x-0 flex justify-center"
                  style={{ top: "74.6%", transform: "translateY(-50%)" }}
                >
                  <span
                    className="wed-tap-cta flex h-[42px] items-center gap-2.5 rounded-full px-7 text-[11px] font-black uppercase"
                    style={{
                      background: `linear-gradient(160deg, ${GOLD_LIGHT}, ${GOLD})`,
                      color: INK,
                      letterSpacing: "0.28em",
                    }}
                  >
                    Tap to Open
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </span>
                </span>
              </button>
            )}
            <video
              ref={filmRef}
              src={filmUrl}
              poster={posterUrl}
              muted
              playsInline
              preload="auto"
              onTimeUpdate={onFilmTime}
              onEnded={reveal}
              onError={reveal}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                playingFilm ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            />
          </div>
        </div>
      )}

      <WeddingNav items={navItems} cta={{ label: "Get Aso Ebi", href: `/rsvp/asoebi/${slug}` }} onNavigate={scrollTo} />

      {/* HERO: the photograph the curtain opens onto */}
      <section
        id="invitation"
        className="relative w-full overflow-hidden"
        style={{ minHeight: "calc(100svh - 3.5rem)", background: "#120d08" }}
      >
        <img
          src={heroImage}
          alt="Sarah and Patrick"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: "center 28%" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(16,11,6,0.62) 0%, rgba(16,11,6,0.10) 22%, rgba(16,11,6,0.18) 48%, rgba(14,10,6,0.90) 100%)",
          }}
        />
        <div
          className="relative flex flex-col justify-end px-6 pb-14 sm:px-10 sm:pb-20 mx-auto w-full max-w-5xl"
          style={{ minHeight: "calc(100svh - 3.5rem)" }}
        >
          <p className="text-[10px] uppercase font-medium" style={{ color: GOLD_LIGHT, letterSpacing: "0.42em" }}>
            Sarah &amp; Patrick
          </p>
          <h1
            className="mt-4 font-serif font-normal leading-[1.06]"
            style={{ color: "#f8f2e6", fontSize: "clamp(2.35rem, 7.4vw, 4.25rem)" }}
          >
            Request the honour
            <br />
            of your presence.
          </h1>
          <p
            className="mt-5 max-w-xl text-[14.5px] leading-relaxed sm:text-base"
            style={{ color: "rgba(248,242,230,0.88)" }}
          >
            {heroLine}
          </p>
          <a
            href="#rsvp"
            onClick={(e) => {
              e.preventDefault();
              scrollTo("#rsvp");
            }}
            className="mt-7 inline-flex h-12 w-fit items-center justify-center rounded-full px-9 text-sm font-bold text-white transition-transform hover:scale-[1.02]"
            style={{ background: `linear-gradient(160deg, ${GOLD_LIGHT}, ${GOLD})` }}
          >
            RSVP
          </a>
          <div className="mt-8 flex items-center gap-3">
            <span className="h-px w-10" style={{ background: "rgba(232,192,95,0.75)" }} />
            <span className="text-[10px] uppercase" style={{ color: "rgba(248,242,230,0.72)", letterSpacing: "0.35em" }}>
              Scroll
            </span>
          </div>
        </div>
      </section>

      {/* YOU ARE INVITED */}
      <section className="px-6 pt-12 pb-4 max-w-2xl mx-auto text-center">
        <Reveal>
          <img
            src={content.monogram_url}
            alt="Sarah and Patrick crest"
            className="mx-auto w-24 select-none sm:w-28"
            draggable={false}
          />
          <p className="mt-6 text-[10px] uppercase font-medium" style={{ color: GOLD, letterSpacing: "0.42em" }}>
            You are invited
          </p>
          <p className="mt-4 font-serif text-3xl sm:text-4xl">Sarah &amp; Patrick</p>
          <p className="mt-3 text-sm opacity-70">invite you to their</p>
          <p className="mt-2 font-serif text-2xl sm:text-3xl">White Wedding</p>
        </Reveal>

        <Reveal delay={120}>
          <div className="mt-10">
            <div className="mx-auto mb-8 h-px w-16" style={{ background: "#d8c9a6" }} />
            <p className="text-[10px] uppercase font-bold" style={{ color: GOLD, letterSpacing: "0.3em" }}>
              The celebration begins in
            </p>
            {!cd.passed ? (
              <div className="mt-5 flex items-start justify-center gap-6 sm:gap-10">
                {(
                  [
                    [cd.days, "Days"],
                    [cd.hours, "Hours"],
                    [cd.minutes, "Minutes"],
                    [cd.seconds, "Seconds"],
                  ] as [number, string][]
                ).map(([v, l]) => (
                  <div key={l} className="text-center">
                    <p className="font-serif text-4xl tabular-nums">{String(v).padStart(2, "0")}</p>
                    <p className="mt-1 text-[10px] uppercase" style={{ color: "#8a7a5e", letterSpacing: "0.22em" }}>
                      {l}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 font-serif text-3xl">Just Married</p>
            )}
          </div>
        </Reveal>
      </section>

      {/* CHAPTER: THE DAY, carried by the second photograph */}
      <WeddingChapter
        id="when-where"
        image={dayPhoto}
        imagePosition="center 52%"
        eyebrow="The celebration"
        title="The White Wedding"
      >
        <div className="space-y-7">
          <div>
            <p className="text-[10px] uppercase font-bold" style={{ color: GOLD_LIGHT, letterSpacing: "0.3em" }}>
              {ceremony.label}
            </p>
            <p className="mt-2 font-serif text-xl" style={{ color: "#f8f2e6" }}>{ceremony.time}</p>
            <p style={{ color: "rgba(248,242,230,0.85)" }}>{ceremony.venue}</p>
            <p className="text-sm" style={{ color: "rgba(248,242,230,0.6)" }}>{ceremony.location}</p>
            <a
              href={dirUrl(ceremonyFull)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs font-bold underline underline-offset-4"
              style={{ color: GOLD_LIGHT }}
            >
              Get directions
            </a>
          </div>

          <div className="h-px w-10" style={{ background: "rgba(232,192,95,0.45)" }} />

          <div>
            <p className="text-[10px] uppercase font-bold" style={{ color: GOLD_LIGHT, letterSpacing: "0.3em" }}>
              Reception
            </p>
            <p className="mt-2 font-serif text-xl" style={{ color: "#f8f2e6" }}>From {content.reception.time}</p>
            <p style={{ color: "rgba(248,242,230,0.85)" }}>{content.reception.venue}</p>
            <a
              href={dirUrl(content.reception.venue)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs font-bold underline underline-offset-4"
              style={{ color: GOLD_LIGHT }}
            >
              Get directions
            </a>
          </div>
        </div>

        <a
          href={calendarHref(content)}
          download="sarah-and-patrick-white-wedding.ics"
          className="mt-8 inline-flex h-11 items-center gap-2 rounded-full border px-5 text-xs font-bold transition-colors hover:bg-white/10"
          style={{ borderColor: "rgba(232,192,95,0.55)", color: "#f8f2e6" }}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M8 3v4M16 3v4M3 11h18M12 15v4M10 17h4" />
          </svg>
          Add to calendar
        </a>
      </WeddingChapter>

      {/* DRESS CODE */}
      {content.dress_code && (
        <section id="dress-code" className="px-6 pt-14 pb-12 max-w-2xl mx-auto" style={{ scrollMarginTop: "4.5rem" }}>
          <Reveal>
            <div className="text-center mb-6">
              <Eyebrow>{content.dress_code.label}</Eyebrow>
              <h2 className="font-serif text-3xl sm:text-4xl">{content.dress_code.style}</h2>
              <p className="text-sm opacity-70 mt-4 max-w-md mx-auto leading-relaxed">{content.dress_code.message}</p>
            </div>
          </Reveal>
          <Reveal>
            <div className="rounded-2xl border bg-white/70 p-6" style={{ borderColor: "#e2d5b8" }}>
              <p className="text-[11px] uppercase text-center mb-4 font-bold" style={{ color: GOLD, letterSpacing: "0.3em" }}>
                Colour Palette
              </p>
              <div className="flex flex-wrap justify-center gap-x-5 gap-y-4">
                {(content.dress_code.colors || []).map((c: any) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setDressPick(dressPick === c.name ? null : c.name)}
                    className="flex flex-col items-center gap-1.5 transition-all active:scale-95"
                    title={c.name}
                  >
                    <span
                      className="w-14 h-14 rounded-full border-2 transition-all"
                      style={{
                        background: c.hex,
                        borderColor: dressPick === c.name ? GOLD : "#ffffff",
                        boxShadow: dressPick === c.name
                          ? "0 0 0 2px #b8892f, 0 8px 18px rgba(184,137,47,0.35)"
                          : "0 4px 12px rgba(0,0,0,0.12)",
                      }}
                    />
                    <span className="text-[11px] font-bold opacity-80">{c.name}</span>
                  </button>
                ))}
              </div>
              <p className="text-sm opacity-70 mt-5 text-center leading-relaxed">{content.dress_code.note}</p>
              {dressPick && (
                <p className="mt-3 text-center text-xs font-bold uppercase" style={{ color: GOLD, letterSpacing: "0.2em" }}>
                  {dressPick} (
                  {(content.dress_code.colors || []).find((c: any) => c.name === dressPick)?.hex})
                </p>
              )}
            </div>
          </Reveal>
        </section>
      )}

      {/* HOTELS */}
      <section id="hotels" className="px-6 pt-14 pb-12 max-w-4xl mx-auto" style={{ scrollMarginTop: "4.5rem" }}>
        <Reveal>
          <div className="text-center mb-6">
            <Eyebrow>Getting you there</Eyebrow>
            <h2 className="font-serif text-3xl sm:text-4xl">Hotel Recommendations</h2>
            <p className="text-sm opacity-60 mt-3 max-w-md mx-auto">{content.hotels_note}</p>
          </div>
        </Reveal>
        <div className="grid gap-3 sm:grid-cols-2">
          {(content.hotels || []).map((h: any, i: number) => (
            <Reveal key={i} delay={Math.min(i * 60, 300)}>
              <div className="rounded-xl border bg-white/70 p-4 flex items-start justify-between gap-3" style={{ borderColor: "#e2d5b8" }}>
                <div>
                  <p className="font-serif font-bold">{h.name}</p>
                  <p className="text-xs opacity-60 mt-0.5">{h.address}</p>
                </div>
                <a
                  href={dirUrl(`${h.name}, ${h.address}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 text-xs font-bold underline underline-offset-4 mt-1"
                  style={{ color: GOLD }}
                  title="Open directions from your current location"
                >
                  Directions
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CHAPTER: ASO EBI, carried by the third photograph */}
      <WeddingChapter
        id="asoebi"
        image={asoebiPhoto}
        imagePosition="center 42%"
        eyebrow="Aso Ebi"
        title={
          <>
            The family cloth,
            <br />
            in one payment.
          </>
        }
      >
        <p className="max-w-md text-sm leading-relaxed sm:text-base" style={{ color: "rgba(248,242,230,0.85)" }}>
          Choose the Aso Ebi package for yourself or the whole family at once, pay once, and get a reference you can look
          up any time.
        </p>
        <p className="mt-5 font-serif text-2xl" style={{ color: "#f8f2e6" }}>
          ₦{(content.asoebi.price || 0).toLocaleString()}{" "}
          <span className="text-xs" style={{ color: "rgba(248,242,230,0.6)" }}>
            from, per package
          </span>
        </p>
        <Link
          href={`/rsvp/asoebi/${slug}`}
          className="mt-6 inline-flex h-12 items-center justify-center rounded-full px-8 text-sm font-bold text-white transition-transform hover:scale-[1.02]"
          style={{ background: `linear-gradient(160deg, ${GOLD_LIGHT}, ${GOLD})` }}
        >
          Get Aso Ebi Package
        </Link>
      </WeddingChapter>

      {/* RSVP */}
      <section id="rsvp" className="px-6 pt-14 pb-16 max-w-2xl mx-auto" style={{ scrollMarginTop: "4.5rem" }}>
        <Reveal>
          <div className="text-center mb-6">
            <Eyebrow>Be part of our day</Eyebrow>
            <h2 className="font-serif text-3xl sm:text-4xl">RSVP</h2>
            <p className="text-sm opacity-60 mt-3 max-w-sm mx-auto leading-relaxed">
              Kindly tell us if you can join us, so we can plan the day around you.
            </p>
          </div>
        </Reveal>
        {done ? (
          <div className="rounded-2xl border bg-white p-6 text-center" style={{ borderColor: GOLD }}>
            <p className="font-serif text-2xl">{declined ? "Thank you" : "Thank you!"}</p>
            <p className="text-sm opacity-70 mt-2">
              {declined
                ? "Your reply has been recorded. You will be missed."
                : "Your attendance has been recorded. Your entry QR code will arrive by email or WhatsApp shortly."}
            </p>
            {guestToken && (
              <button
                onClick={() => {
                  setDone(false);
                  setDeclined(false);
                  setAttendance(null);
                  setError("");
                }}
                className="mt-4 text-xs underline underline-offset-4"
                style={{ color: GOLD }}
              >
                Change my response
              </button>
            )}
          </div>
        ) : attendance === null ? (
          <div className="text-center">
            <p className="text-[11px] uppercase font-bold mb-1" style={{ color: GOLD, letterSpacing: "0.3em" }}>{guestToken ? "Kindly respond" : "Step 1 of 2"}</p>
            <p className="font-serif text-2xl mb-2">Will you be attending?</p>
            {guestToken && guest?.name && (
              <p className="text-[10px] uppercase opacity-60 mb-4" style={{ letterSpacing: "0.28em" }}>
                Reserved for {guest.name}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
              <button
                onClick={() => (guestToken ? submitPersonal("yes") : setAttendance("yes"))}
                disabled={submitting}
                className="rounded-2xl border-2 bg-white p-5 flex flex-col items-center gap-2 transition-all active:scale-95 disabled:opacity-60"
                style={{ borderColor: GOLD, boxShadow: "0 8px 24px rgba(184,137,47,0.18)" }}
              >
                <span className="w-11 h-11 rounded-full flex items-center justify-center text-white" style={{ background: `linear-gradient(160deg, ${GOLD_LIGHT}, ${GOLD})` }}>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </span>
                <span className="font-bold text-sm">{submitting && attendance === "yes" ? "Sending..." : "Yes, I Will Attend"}</span>
              </button>
              <button
                onClick={() => (guestToken ? submitPersonal("no") : setAttendance("no"))}
                disabled={submitting}
                className="rounded-2xl border-2 bg-white p-5 flex flex-col items-center gap-2 transition-all active:scale-95 disabled:opacity-60"
                style={{ borderColor: "#e2d5b8" }}
              >
                <span className="w-11 h-11 rounded-full flex items-center justify-center border-2" style={{ borderColor: "#d8c9a6", color: "#a89570" }}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </span>
                <span className="font-bold text-sm opacity-70">{submitting && attendance === "no" ? "Sending..." : "No"}</span>
              </button>
            </div>
            {error && <p className="mt-4 text-xs text-red-700">{error}</p>}
          </div>
        ) : attendance === "no" ? (
          <div className="rounded-2xl border bg-white p-6 text-center" style={{ borderColor: "#e2d5b8" }}>
            <p className="opacity-80 text-sm">Thank you for letting us know. You will be missed!</p>
            <button onClick={() => setAttendance(null)} className="mt-3 text-xs underline underline-offset-4" style={{ color: GOLD }}>
              Back
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border bg-white p-5 space-y-4 max-w-md mx-auto" style={{ borderColor: "#e2d5b8" }}>
            <p className="text-[11px] uppercase font-bold" style={{ color: GOLD, letterSpacing: "0.3em" }}>Step 2 of 2, your details</p>
            <div>
              <label className={labelCls} style={{ color: INK }}>Name: <span style={{ color: GOLD }}>*</span></label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your full name" className={inputCls} style={{ borderColor: "#e2d5b8" }} />
            </div>
            <div>
              <label className={labelCls} style={{ color: INK }}>Email: <span style={{ color: GOLD }}>*</span></label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email address" className={inputCls} style={{ borderColor: "#e2d5b8" }} />
            </div>
            <div>
              <label className={labelCls} style={{ color: INK }}>Phone Number: <span style={{ color: GOLD }}>*</span></label>
              <WeddingPhoneInput value={phone} onChange={setPhone} placeholder="Enter your phone number" />
            </div>
            {error && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
            <button
              onClick={submitRsvp}
              disabled={submitting}
              className="w-full h-12 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(160deg, ${GOLD_LIGHT}, ${GOLD})` }}
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  Submitting...
                </>
              ) : (
                "Confirm Attendance"
              )}
            </button>
            <button onClick={() => setAttendance(null)} className="w-full text-xs opacity-50 underline underline-offset-4">
              Back
            </button>
          </div>
        )}
      </section>

      <footer className="px-6 pb-14 text-center">
        <div className="mx-auto mb-6 h-px w-16" style={{ background: "#d8c9a6" }} />
        <p className="text-[11px] uppercase" style={{ color: GOLD, letterSpacing: "0.3em" }}>{content.hashtag}</p>
        <p className="text-[11px] opacity-40 mt-2">Sarah &amp; Patrick, December 19, 2026</p>
      </footer>

      {/* The music control appears only once the curtain has opened: the tap
          that parts the curtain is also what starts the music. */}
      {musicUrl && entered && <WeddingMusicButton src={musicUrl} />}
    </div>
  );
}
