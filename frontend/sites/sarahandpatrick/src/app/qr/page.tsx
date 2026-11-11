"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

const GOLD = "#b8892f";
const GOLD_LIGHT = "#e8c05f";
const CREAM = "#f5f0e6";
const INK = "#2b2118";
const MUTED = "#7d6d5c";

interface Pass {
  valid: boolean;
  guest_name: string;
  category: string | null;
  party_size?: number | null;
  plus_one_name?: string | null;
  event_title: string;
  event_date: string;
  event_time: string;
  venue: string;
  rsvp_status: string | null;
  status: string;
}

function tokenFromPath(): string {
  if (typeof window === "undefined") return "";
  const parts = window.location.pathname.split("/").filter(Boolean);
  const index = parts.indexOf("qr");
  const raw = index >= 0 ? parts[index + 1] : "";
  try {
    return decodeURIComponent(raw || "");
  } catch {
    return raw || "";
  }
}

function longDate(value: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function clock(value: string) {
  if (!value) return "";
  const [h, m] = value.split(":");
  const hour = Number(h);
  if (Number.isNaN(hour)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m || "00"} ${suffix}`;
}

export default function PassPage() {
  const [pass, setPass] = useState<Pass | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = tokenFromPath();
    if (!t) {
      setError("This pass link is incomplete. Please open the link from your invitation message again.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    apiClient<Pass>(`/qr/${t}`)
      .then((data) => {
        if (!cancelled) setPass(data);
      })
      .catch(() => {
        if (!cancelled) setError("We could not find this pass. Please check the link and try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const admits =
    pass?.party_size === 2
      ? pass?.plus_one_name
        ? `Admits 2 guests, ${pass.guest_name} and ${pass.plus_one_name}`
        : "Admits 2 guests"
      : "Admits 1 guest";

  const statusLabel = pass
    ? pass.status === "event_ended"
      ? "Event ended"
      : pass.valid
        ? "Valid for entry"
        : "Already checked in"
    : "";

  return (
    <main
      className="flex min-h-screen items-center justify-center px-5 py-12"
      style={{ background: CREAM, color: INK }}
    >
      <div className="w-full max-w-md">
        <div className="text-center">
          <img
            src="/uploads/wedding-crest-cream.png"
            alt=""
            width={96}
            height={96}
            className="mx-auto h-20 w-20 object-contain"
          />
          <p
            className="mt-4 text-[10px] uppercase"
            style={{ color: GOLD, letterSpacing: "0.32em" }}
          >
            Sarah &amp; Patrick
          </p>
          <p
            className="mt-2 text-[9px] uppercase"
            style={{ color: MUTED, letterSpacing: "0.28em" }}
          >
            Entry Pass
          </p>
        </div>

        <div
          className="mt-7 overflow-hidden rounded-2xl bg-white shadow-sm"
          style={{ border: `1px solid ${GOLD_LIGHT}` }}
        >
          <div className="px-6 py-7 text-center">
            {loading ? (
              <div className="py-8">
                <div
                  className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-transparent"
                  style={{ borderTopColor: GOLD, borderRightColor: GOLD }}
                />
                <p className="mt-4 text-xs" style={{ color: MUTED }}>
                  Opening your pass
                </p>
              </div>
            ) : error ? (
              <div className="py-6">
                <p className="font-serif text-xl">Pass unavailable</p>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: MUTED }}>
                  {error}
                </p>
              </div>
            ) : pass ? (
              <>
                <p
                  className="text-[9px] uppercase"
                  style={{ color: MUTED, letterSpacing: "0.28em" }}
                >
                  {pass.event_title}
                </p>
                <h1 className="mt-2 font-serif text-2xl leading-tight">
                  {pass.guest_name}
                </h1>
                <p
                  className="mt-3 inline-block rounded-full px-4 py-1 text-[9px] uppercase"
                  style={{
                    background: pass.valid ? "rgba(184,137,47,0.12)" : "rgba(125,109,92,0.12)",
                    color: pass.valid ? GOLD : MUTED,
                    letterSpacing: "0.2em",
                  }}
                >
                  {statusLabel}
                </p>

                <dl className="mt-6 space-y-3 text-left text-sm">
                  <div>
                    <dt
                      className="text-[9px] uppercase"
                      style={{ color: MUTED, letterSpacing: "0.24em" }}
                    >
                      Date
                    </dt>
                    <dd className="mt-1">{longDate(pass.event_date)}</dd>
                  </div>
                  <div>
                    <dt
                      className="text-[9px] uppercase"
                      style={{ color: MUTED, letterSpacing: "0.24em" }}
                    >
                      Time
                    </dt>
                    <dd className="mt-1">{clock(pass.event_time)}</dd>
                  </div>
                  <div>
                    <dt
                      className="text-[9px] uppercase"
                      style={{ color: MUTED, letterSpacing: "0.24em" }}
                    >
                      Venue
                    </dt>
                    <dd className="mt-1">{pass.venue}</dd>
                  </div>
                  <div>
                    <dt
                      className="text-[9px] uppercase"
                      style={{ color: MUTED, letterSpacing: "0.24em" }}
                    >
                      This pass
                    </dt>
                    <dd className="mt-1">{admits}</dd>
                  </div>
                </dl>
              </>
            ) : null}
          </div>

          {pass ? (
            <div
              className="px-6 py-4 text-center text-[10px] leading-relaxed"
              style={{ background: "rgba(184,137,47,0.08)", color: MUTED }}
            >
              Show the QR code from your invitation message at the entrance.
            </div>
          ) : null}
        </div>

        <p className="mt-6 text-center text-[10px]" style={{ color: MUTED }}>
          <a href="/" style={{ color: GOLD }}>
            Open the wedding invitation
          </a>
        </p>
      </div>
    </main>
  );
}
