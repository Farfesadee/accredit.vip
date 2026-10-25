"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The accredit.vip welcome screen shown before every RSVP page.
 *
 * The platform's own homepage is the backdrop (a still of the live page, so it
 * paints instantly, carries no cookie banner or tour and costs no second page
 * load), with a please wait pill and a progress hairline above it. It runs for
 * a fixed few seconds and then hands over to the invitation, which has already
 * loaded behind it.
 */
export default function BrandSplash({
  durationMs = 5000,
  onDone,
}: {
  durationMs?: number;
  onDone: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const [barMs, setBarMs] = useState(durationMs);
  const [barOn, setBarOn] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    // Count from when the welcome screen actually reached the screen, not from
    // when React finished hydrating: the markup is server rendered, so on a
    // cold phone the browser may have been showing it for a second already.
    let elapsed = 0;
    try {
      const fcp = performance
        .getEntriesByType("paint")
        .find((entry) => entry.name === "first-contentful-paint");
      if (fcp) elapsed = Math.max(0, performance.now() - fcp.startTime);
    } catch {
      elapsed = 0;
    }
    const remaining = Math.max(1200, durationMs - elapsed);
    setBarMs(remaining);
    setBarOn(true);

    const fade = setTimeout(() => setLeaving(true), Math.max(0, remaining - 520));
    const done = setTimeout(() => doneRef.current(), remaining);
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, [durationMs]);

  return (
    <div
      className="fixed inset-0 z-[200] overflow-hidden bg-[#0D1B2A] transition-opacity duration-500"
      style={{ opacity: leaving ? 0 : 1 }}
      aria-live="polite"
      aria-label="Loading your invitation"
    >
      <style>{`
        @keyframes brandSpin{to{transform:rotate(360deg)}}
        @keyframes brandIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes brandDot{0%,100%{opacity:.35}50%{opacity:1}}
      `}</style>

      {/* accredit.vip itself, as the guest sees it on the live site. */}
      <picture>
        <source media="(min-width: 768px)" srcSet="/splash-site-desktop.jpg" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/splash-site-mobile.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
      </picture>

      {/* Light wash on top so the site still reads, deeper at the foot for the pill. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(13,27,42,0.45) 0%, rgba(13,27,42,0.22) 26%, rgba(13,27,42,0.34) 58%, rgba(13,27,42,0.86) 88%, #0D1B2A 100%)",
        }}
      />

      {/* A soft pool of shadow through the middle so the pill reads over any
          part of the artwork, wherever the guest's screen is tall. */}
      <div
        className="pointer-events-none absolute inset-0 z-[5]"
        style={{
          background:
            "radial-gradient(58% 26% at 50% 50%, rgba(9,17,28,0.80) 0%, rgba(9,17,28,0.42) 55%, rgba(9,17,28,0) 80%)",
        }}
      />

      <div className="absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center px-6">
        <div
          className="flex items-center gap-3 rounded-full px-5 py-3"
          style={{
            background: "rgba(9,17,28,0.82)",
            border: "1px solid rgba(255,255,255,0.14)",
            animation: "brandIn 520ms ease-out both",
          }}
        >
          <span
            className="block h-4 w-4 rounded-full border-[2px] border-white/25"
            style={{ borderTopColor: "#1ABC9C", animation: "brandSpin 900ms linear infinite" }}
          />
          <span
            className="text-[11px] font-semibold uppercase text-white/95 sm:text-xs"
            style={{ letterSpacing: "0.32em" }}
          >
            Please wait
          </span>
        </div>

        <p
          className="mt-3 text-[9px] uppercase text-white/55 sm:text-[10px]"
          style={{ letterSpacing: "0.24em", animation: "brandDot 2.6s ease-in-out infinite" }}
        >
          Taking you to your invitation
        </p>

        <div className="mt-5 h-[2px] w-40 overflow-hidden rounded-full bg-white/15 sm:w-52">
          <div
            className="h-full w-full origin-left rounded-full"
            style={{
              background: "#1ABC9C",
              transform: barOn ? "scaleX(1)" : "scaleX(0)",
              transition: barOn ? `transform ${barMs}ms linear` : undefined,
            }}
          />
        </div>

        <p
          className="mt-4 text-[8px] uppercase text-white/30 sm:text-[9px]"
          style={{ letterSpacing: "0.3em" }}
        >
          Accredit Interactive
        </p>
      </div>
    </div>
  );
}
