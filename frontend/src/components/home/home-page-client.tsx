"use client";

import Link from "next/link";

import { GetStartedGuide } from "@/components/shared/get-started-guide";
import { BlackMarketSlider } from "@/components/home/black-market-slider";
import { Footer } from "@/components/shared/footer";
import { getSpecialDayName } from "@/lib/special-days";
import { Check, Sparkles } from "lucide-react";

const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    title: "Create Invite",
    desc: "Private invitations for weddings, birthdays, corporate dinners & VIP gatherings. Deliver via WhatsApp, SMS, or Email with personalised QR codes.",
    tag: "Private Events",
    color: "#1ABC9C",
    href: "/features/post-invite",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
    title: "Post Event",
    desc: "Publish concerts, conferences, and festivals. Sell tickets, upload flyers, add sponsors, and attract attendees through our discovery marketplace.",
    tag: "Public Events",
    color: "#7C3AED",
    href: "/features/post-event",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8H3m2 8H3m18-8h-1M4 16H3m15-4a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: "QR Accreditation",
    desc: "Generate signed, tamper-proof QR codes for every guest. Staff scan codes at the gate: instant validation, duplicate detection, and live check-in logs.",
    tag: "Check-in Tech",
    color: "#0891B2",
    href: "/features/qr-accreditation",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    title: "Guest Management",
    desc: "Upload guest lists via CSV, track RSVP statuses, send reminders, detect duplicates, and view live attendance analytics in your dashboard.",
    tag: "Operations",
    color: "#059669",
    href: "/features/guest-management",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: "Live Analytics",
    desc: "Real-time delivery reports, RSVP conversion rates, check-in timelines, and channel-by-channel performance: all visualised in your dashboard.",
    tag: "Data & Insights",
    color: "#D97706",
    href: "/features/live-analytics",
  },
];

const statsIconMap = {
  events: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  guests: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 8.646 4 4 0 010-8.646M12 14H8.823a4 4 0 00-3.745 6.283M16 14h4.823a4 4 0 013.745 6.283" /></svg>,
  channels: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  uptime: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
};

const stats = [
  { value: "10k+",  label: "Events Created",  iconKey: "events" },
  { value: "500k+", label: "Guests Managed",  iconKey: "guests" },
  { value: "3",     label: "Delivery Channels", iconKey: "channels" },
  { value: "99.9%", label: "Uptime",           iconKey: "uptime" },
];

const howItWorks = [
  {
    step: "01",
    title: "Create Your Event",
    desc: "Set up your event in minutes: add your guest list, pick delivery channels, configure QR preferences, and apply your branding.",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    step: "02",
    title: "Send Invitations",
    desc: "Guests receive personalised invitations via WhatsApp, SMS, or Email with their unique QR code: delivered in seconds.",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    ),
  },
  {
    step: "03",
    title: "Scan & Check In",
    desc: "Your team scans QR codes at the gate. Real-time attendance logs sync instantly to your dashboard: no paper, no chaos.",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

const testimonials = [
  {
    quote: "Accredit Interactive transformed how we manage our annual conference. The QR check-in alone saved us 3 hours of manual work at the gate.",
    name: "Adaeze Obi",
    role: "Event Director, Lagos Business Summit",
    avatar: "AO",
    color: "#1ABC9C",
  },
  {
    quote: "We sent 800 WhatsApp invitations and had a 96% delivery rate. Guests loved their personalised QR codes: it felt premium.",
    name: "Kofi Mensah",
    role: "Wedding Planner, Accra",
    avatar: "KM",
    color: "#7C3AED",
  },
  {
    quote: "Best investment for our concert series. The live analytics helped us understand our audience in ways we never could before.",
    name: "Temi Adeyemi",
    role: "Concert Promoter, Abuja",
    avatar: "TA",
    color: "#0891B2",
  },
];

const QR_PATTERN = [
  1,1,1,0,1,0,1,1,
  1,0,1,0,0,1,0,1,
  1,0,1,1,1,0,1,0,
  0,0,0,1,0,0,1,1,
  1,1,0,0,1,1,0,1,
  0,1,1,1,0,1,0,0,
  1,0,0,1,1,0,1,1,
  1,1,1,0,0,1,0,0,
];

const HOME_HERO_COPY = Object.freeze({
  eyebrow: "Premium Event Infrastructure · Africa",
  titleStart: "From invitation to",
  titleMiddle: " entry, stay in",
  titleAccent: "complete control.",
  subtitle:
    "Send branded invitations by WhatsApp, SMS, or Email, give every guest a unique QR pass, and run check-in from one live dashboard.",
});

export function HomePageClient() {
  return (
    <>
    <style>{`
      @keyframes dance {
        0%, 100% { transform: translateY(0) scale(1); }
        25% { transform: translateY(-8px) scale(1.02); }
        50% { transform: translateY(0) scale(1); }
        75% { transform: translateY(-4px) scale(1.01); }
      }
      @keyframes pulse-breathing {
        0%, 100% { box-shadow: 0 0 0 0 rgba(26, 188, 156,0.4); }
        50% { box-shadow: 0 0 0 8px rgba(26, 188, 156,0.1); }
      }
      @media (max-width: 639px) {
        .hero-animated-bg {
          background-position: 50% 0 !important;
          max-height: 100vh !important;
          background-attachment: scroll !important;
        }
      }
    `}</style>

      {/* ════════════════════════════════════════
          HERO (with carousel overlay at top)
      ════════════════════════════════════════ */}
      <section
        className="hero-animated-bg relative overflow-hidden"
        style={{
          backgroundImage: 'url(/hero-background.jpg)',
          backgroundColor: "#07101d",
          backgroundSize: "cover",
          backgroundPosition: "center top",
          backgroundAttachment: "fixed",
          minHeight: "100vh",
          maxHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div className="absolute inset-0" style={{ background: "rgba(5,10,20,0.4)", pointerEvents: "none" }} />

        {/* Black Market marquee: absolute strip pinned right under the navbar.
            It overlays background only and never moves anything below it. */}
        <BlackMarketSlider />

        {/* Mobile CTA Section: shown only on small screens */}
        <div className="sm:hidden relative mx-4 flex flex-1 flex-col items-center justify-center pt-44 pb-8" style={{ zIndex: 10 }}>
          <div className="flex flex-col gap-4 w-full max-w-xs">
            <Link
              href="/create-event"
              className="btn-primary rounded-xl px-10 py-5 text-base font-black text-center transition-all duration-300 hover:scale-105"
              style={{
                letterSpacing: "0.04em",
                animation: "dance 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) infinite",
                animationDelay: "0s"
              }}
            >
              <svg className="h-5 w-5 inline mr-2" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              CREATE EVENT
            </Link>
            <Link
              href="/attend"
              className="btn-secondary rounded-xl px-10 py-5 text-base font-black text-center transition-all duration-300 hover:scale-105"
              style={{
                letterSpacing: "0.04em",
                animation: "dance 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) infinite",
                animationDelay: "0.1s"
              }}
            >
              <svg className="h-5 w-5 inline mr-2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              BUY TICKET
            </Link>
          </div>

          <Link
            href="/login"
            className="mt-4 w-full max-w-xs rounded-xl px-4 py-3 text-sm font-bold text-center transition-all duration-150"
            style={{
              background: "#0D1B2A",
              color: "#ffffff",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            LOG IN
          </Link>
        </div>

        {/* Desktop hero - only on sm+ */}
        <div className="hidden sm:flex relative w-full px-4 sm:px-6 lg:px-8 pt-44 sm:pt-44 lg:pt-8 pb-12 flex-col flex-1" style={{ zIndex: 10 }}>
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-8 lg:items-center lg:min-h-[80vh]">
            {/* LEFT: Text column */}
            <div className="flex flex-col items-start justify-center">
              {getSpecialDayName() && (
                <div
                  className="motion-rise inline-flex items-center gap-2.5 px-5 py-2 rounded-full text-xs font-bold tracking-widest uppercase mb-4"
                  style={{
                    border: "1px solid rgba(255,215,0,0.4)",
                    background: "rgba(255,215,0,0.08)",
                    color: "#FFD700",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Celebrating {getSpecialDayName()}!
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
              )}

              {/* Tag pill */}
              <div
                className="motion-rise inline-flex items-center gap-2.5 px-5 py-2 rounded-full text-xs font-bold tracking-widest uppercase mb-9"
                style={{
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.82)",
                  backdropFilter: "blur(12px)",
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: "#1ABC9C",
                    boxShadow: "0 0 8px rgba(26, 188, 156,0.9)",
                    animation: "pulse 2s ease-in-out infinite",
                  }}
                />
                {HOME_HERO_COPY.eyebrow}
              </div>

              {/* Main heading */}
              <h1
                className="motion-rise motion-delay-1 text-left text-4xl sm:text-6xl lg:text-6xl xl:text-[68px] font-extrabold leading-[1.05] tracking-tight"
              >
                <span style={{ color: "#1ABC9C" }}>{HOME_HERO_COPY.titleStart}</span>{" "}
                <br className="hidden sm:block" />
                <span style={{ color: "#ffffff" }}>{HOME_HERO_COPY.titleMiddle}</span>{" "}
                <span
                  style={{
                    color: "#1ABC9C",
                  }}
                >
                  {HOME_HERO_COPY.titleAccent}
                </span>
              </h1>

              {/* Subtitle */}
              <p
                className="motion-rise motion-delay-2 mt-7 text-left text-base sm:text-lg leading-relaxed max-w-xl"
                style={{ color: "rgba(255,255,255,0.68)" }}
              >
                {HOME_HERO_COPY.subtitle}
              </p>

              {/* CTA buttons */}
              <div className="motion-rise motion-delay-3 mt-10 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/create-event"
                  className="btn-primary rounded-xl px-10 py-4 text-base font-black"
                  style={{
                    letterSpacing: "0.04em",
                    animation: "dance 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) infinite",
                    animationDelay: "0s"
                  }}
                >
                  <svg className="h-5 w-5 inline mr-2" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  CREATE EVENT
                </Link>
                <Link
                  href="/attend"
                  className="btn-secondary rounded-xl px-10 py-4 text-base font-black"
                  style={{
                    letterSpacing: "0.04em",
                    animation: "dance 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) infinite",
                    animationDelay: "0.1s"
                  }}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  BUY TICKET
                </Link>
              </div>

              {/* Trust badges */}
              <div className="motion-rise motion-delay-4 mt-7 flex flex-wrap items-center gap-5">
                {[
                  { icon: "ok", text: "RSVP and QR in one flow" },
                  { icon: "01", text: "Gate scans in real time" },
                  { icon: "id", text: "Guest list stays private" },
                ].map((b) => (
                  <div
                    key={b.text}
                    className="flex items-center gap-2 text-sm"
                    style={{ color: "rgba(255,255,255,0.42)" }}
                  >
                    <span style={{ color: "#4ade80", fontWeight: 700 }}>{b.icon}</span>
                    {b.text}
                  </div>
                ))}
              </div>

              {/* Stats row */}
              <div className="motion-rise motion-delay-5 mt-12 grid grid-cols-2 sm:grid-cols-4 gap-6 w-full">
                {stats.map((s) => (
                  <div key={s.label}>
                    <div className="text-lg mb-1 text-white">{statsIconMap[s.iconKey as keyof typeof statsIconMap]}</div>
                    <p className="text-2xl font-extrabold text-white" style={{ letterSpacing: "-0.03em" }}>{s.value}</p>
                    <p className="mt-0.5 text-xs font-medium" style={{ color: "rgba(255,255,255,0.38)" }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT: Product visual */}
            <div className="motion-pop motion-delay-4 relative" style={{ height: 620 }}>
              {/* (Product visual content - omitted for brevity, showing on desktop) */}
            </div>
          </div>
        </div>
      </section>

      {/* Desktop-only sections below hero */}
      <div className="hidden sm:block">
        {/* SOCIAL PROOF STRIP */}
        <section className="py-9 bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-center text-[10.5px] font-extrabold uppercase tracking-[0.18em] mb-5" style={{ color: "#c8d3e0" }}>
              Trusted by event professionals across Africa
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {[
                "Lagos Business Summit",
                "Accra Fashion Week",
                "Nairobi Tech Conf.",
                "Abuja Music Fest",
                "Cape Town Pride",
                "Kigali Innovation",
              ].map((org) => (
                <div
                  key={org}
                  className="px-5 py-2 rounded-full text-xs font-semibold"
                  style={{ background: "#f4f6fb", border: "1px solid #e4e9f2", color: "#6b7fa0" }}
                >
                  {org}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="py-28 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <div className="badge-teal mb-5">
                <svg className="w-3.5 h-3.5 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                Everything you need
              </div>
              <h2
                className="text-4xl sm:text-5xl font-extrabold"
                style={{ color: "#0D1B2A", letterSpacing: "-0.03em" }}
              >
                One platform.{" "}
                <span style={{ color: "#1ABC9C" }}>Every event.</span>
              </h2>
              <p className="mt-5 text-lg max-w-2xl mx-auto" style={{ color: "#6b7280" }}>
                From intimate weddings to large-scale concerts: Accredit Interactive
                handles the full lifecycle of your event with precision.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <Link key={f.title} href={f.href} className="feature-card group block no-underline">
                  <div
                    className="rounded-2xl flex items-center justify-center mb-5 transition-all duration-300 group-hover:scale-110 feature-icon"
                    style={{ width: 52, height: 52, background: `${f.color}14`, color: f.color }}
                  >
                    {f.icon}
                  </div>
                  <span
                    className="text-[10.5px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                    style={{ background: `${f.color}12`, color: f.color }}
                  >
                    {f.tag}
                  </span>
                  <h3 className="text-lg font-bold mt-4 mb-2" style={{ color: "#0D1B2A" }}>{f.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#6b7280" }}>{f.desc}</p>
                  <div
                    className="mt-5 flex items-center gap-1 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    style={{ color: f.color }}
                  >
                    Learn more
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="py-28" style={{ background: "linear-gradient(180deg,#f6f8fc 0%,#eef1f8 100%)" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <div className="badge-navy mb-5">How it works</div>
              <h2
                className="text-4xl sm:text-5xl font-extrabold"
                style={{ color: "#0D1B2A", letterSpacing: "-0.03em" }}
              >
                Up &amp; running{" "}
                <span style={{ color: "#1ABC9C" }}>in minutes</span>
              </h2>
              <p className="mt-4 text-lg max-w-xl mx-auto" style={{ color: "#6b7280" }}>
                Three simple steps to your first professionally accredited event.
              </p>
            </div>

            <div className="grid gap-10 md:grid-cols-3 relative">
              {howItWorks.map((step, i) => (
                <div key={step.step} className="text-center group">
                  <div
                    className="w-28 h-28 rounded-3xl mx-auto flex flex-col items-center justify-center mb-7 transition-transform duration-300 group-hover:-translate-y-2 how-it-works-icon"
                    style={{
                      background:
                        i === 1
                          ? "linear-gradient(135deg, #1ABC9C 0%, #16A085 100%)"
                          : "#0D1B2A",
                      boxShadow:
                        i === 1
                          ? "0 16px 44px rgba(26, 188, 156,0.42)"
                          : "0 12px 36px rgba(13,27,42,0.28)",
                    }}
                  >
                    <div className="text-white">{step.icon}</div>
                    <span
                      className="text-[11px] font-black tracking-widest mt-1"
                      style={{ color: i === 1 ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.45)" }}
                    >
                      {step.step}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold mb-3" style={{ color: "#0D1B2A" }}>{step.title}</h3>
                  <p className="text-sm leading-relaxed max-w-xs mx-auto" style={{ color: "#6b7280" }}>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="py-28" style={{ background: "linear-gradient(180deg,#f6f8fc 0%,#eef1f8 100%)" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <div className="badge-teal mb-5">Loved by event professionals</div>
              <h2
                className="text-4xl sm:text-5xl font-extrabold"
                style={{ color: "#0D1B2A", letterSpacing: "-0.03em" }}
              >
                Trusted across Africa
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {testimonials.map((t) => (
                <div
                  key={t.name}
                  className="bg-white rounded-3xl p-8 flex flex-col gap-5 hover:-translate-y-1 transition-transform duration-300"
                  style={{ border: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 4px 28px rgba(0,0,0,0.06)" }}
                >
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-4 h-4" fill="#1ABC9C" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed flex-1" style={{ color: "#374151" }}>
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div
                    className="flex items-center gap-3 pt-4"
                    style={{ borderTop: "1px solid rgba(0,0,0,0.055)" }}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}88)` }}
                    >
                      {t.avatar}
                    </div>
                    <div>
                      <p className="font-bold text-sm" style={{ color: "#0D1B2A" }}>{t.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="bg-[#07182f] px-4 py-28 text-white sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#1ABC9C] mb-4 text-center">
              Channel pricing
            </p>
            <div className="mb-16 text-center">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight">
                Pay by invite channel,{" "}
                <span style={{ color: "#1ABC9C" }}>not by package.</span>
              </h2>
              <p className="mt-6 max-w-2xl mx-auto text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.68)" }}>
                Each channel price covers 1-100 guests and includes the QR accreditation flow.
                Users can test CREATE INVITE or POST EVENT once before creating an account.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {[
                {
                  id: "email",
                  name: "Email",
                  price: "₦100k",
                  note: "Formal, branded delivery for 1-100 guests.",
                  features: ["QR code included", "Invite preview", "RSVP tracking", "Delivery report", "Guest list upload"],
                },
                {
                  id: "whatsapp",
                  name: "WhatsApp",
                  price: "₦200k",
                  note: "Fast, familiar delivery for 1-100 guests.",
                  features: ["QR code included", "Invite preview", "RSVP tracking", "Reminder-ready flow", "Delivery report"],
                  highlight: true,
                },
                {
                  id: "sms",
                  name: "SMS",
                  price: "₦300k",
                  note: "Reliable delivery for 1-100 guests, even without internet.",
                  features: ["QR code included", "Short invite message", "RSVP tracking", "Delivery report", "Guest list upload"],
                },
              ].map((channel) => (
                <div
                  key={channel.id}
                  className="flex flex-col rounded-2xl border p-8 shadow-lg"
                  style={{
                    background: channel.highlight ? "#0D1B2A" : "rgba(255,255,255,0.05)",
                    borderColor: channel.highlight ? "rgba(26, 188, 156,0.55)" : "rgba(255,255,255,0.1)",
                  }}
                >
                  {channel.highlight && (
                    <span className="mb-5 w-fit rounded-full bg-[#1ABC9C] px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white">
                      Popular
                    </span>
                  )}
                  <h3 className="text-2xl font-extrabold text-white">
                    {channel.name}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.66)" }}>
                    {channel.note}
                  </p>
                  <div className="mt-8">
                    <span className="text-5xl font-black text-white">
                      {channel.price}
                    </span>
                    <span className="ml-2 text-sm" style={{ color: "rgba(255,255,255,0.48)" }}>
                      / 1-100 guests
                    </span>
                  </div>
                  <ul className="mt-10 space-y-3 flex-1">
                    {channel.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3 text-sm text-white">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#fff1f8] text-xs font-black text-[#1ABC9C]">
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/create-event"
                    className={`mt-8 inline-flex h-12 items-center justify-center rounded-xl px-6 text-sm font-bold transition-all ${
                      channel.highlight
                        ? "bg-gradient-to-r from-[#1ABC9C] to-[#16A085] text-white hover:scale-105"
                        : "bg-white text-[#07182f] hover:bg-[#1ABC9C] hover:text-white"
                    }`}
                  >
                    Get Started
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        <GetStartedGuide />
        <Footer />
      </div>

    </>
  );
}
