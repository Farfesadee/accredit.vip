"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { API_BASE } from "@/lib/api-client";

export function Footer() {
  const year = new Date().getFullYear();
  const [subEmail, setSubEmail] = useState("");
  const [subMsg, setSubMsg] = useState("");

  return (
    <footer style={{ background: "#070e1a" }}>
      {/* Top gradient accent line */}
      <div style={{ height: "2px", background: "linear-gradient(90deg, transparent, #1ABC9C 30%, #16A085 70%, transparent)" }} />

      {/* Main footer body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">

          {/* ── Brand column ── */}
          <div className="md:col-span-4">
            <Link href="/" className="mb-4 flex items-center gap-3">
              <Image
                src="/logo-mark.png"
                alt=""
                width={366}
                height={372}
                className="h-10 w-auto object-contain opacity-90 transition-opacity hover:opacity-100"
              />
              <Image
                src="/logo-text.png"
                alt="Accredit Interactive"
                width={584}
                height={143}
                className="h-8 w-auto object-contain opacity-90 transition-opacity hover:opacity-100"
              />
            </Link>
            <p className="text-xs leading-relaxed max-w-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
              Premium event accreditation &amp; guest management for Africa.
            </p>

            {/* Social icons */}
            <div className="flex items-center gap-2 mt-4">
              {[
                {
                  label: "WhatsApp",
                  href: "#",
                  icon: (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  ),
                },
                {
                  label: "Instagram",
                  href: "#",
                  icon: (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                    </svg>
                  ),
                },
                {
                  label: "Twitter / X",
                  href: "#",
                  icon: (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  ),
                },
                {
                  label: "LinkedIn",
                  href: "#",
                  icon: (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                  ),
                },
              ].map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 bg-[rgba(255,255,255,0.07)] text-[rgba(255,255,255,0.55)] hover:-translate-y-0.5 hover:bg-[#1ABC9C] hover:text-white"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {/* ── Links ── */}
          <div className="md:col-span-3">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Platform
                </h4>
                <ul className="space-y-2.5">
                  {[
                    { label: "Create Event", href: "/create-event" },
                    { label: "Attend Events", href: "/attend" },
                    { label: "Community", href: "/community" },
                    { label: "Pricing", href: "/pricing" },
                    { label: "Dashboard", href: "/dashboard" },
                  ].map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-sm transition-colors duration-150 text-[rgba(255,255,255,0.45)] hover:text-white">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Company
                </h4>
                <ul className="space-y-2.5">
                  {[
                    { label: "Contact Us", href: "/contact" },
                    { label: "Sign In", href: "/login" },
                    { label: "Register", href: "/register" },
                    { label: "Privacy Policy", href: "/contact" },
                    { label: "Terms of Use", href: "/contact" },
                  ].map((l) => (
                    <li key={l.label}>
                      <Link href={l.href} className="text-sm transition-colors duration-150 text-[rgba(255,255,255,0.45)] hover:text-white">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* ── Newsletter ── */}
          <div className="md:col-span-5">
            <h4
              className="text-xs font-bold uppercase tracking-widest mb-3"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              Stay Updated
            </h4>
            <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.45)" }}>
              Get event tips and platform updates.
            </p>
            <div className="flex gap-2 max-w-sm">
              <input
                type="email"
                placeholder="your@email.com"
                value={subEmail}
                onChange={(e) => setSubEmail(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white outline-none input-dark-bg"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "white",
                }}
              />
              <button
                onClick={async () => {
                  if (!subEmail) return;
                  try {
                    await fetch(`${API_BASE}/subscribe`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ email: subEmail, channels: "email" }),
                    });
                    setSubMsg("Subscribed!");
                    setSubEmail("");
                  } catch { setSubMsg("Failed. Try again."); }
                  setTimeout(() => setSubMsg(""), 3000);
                }}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 flex-shrink-0 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(26, 188, 156,0.4)]"
                style={{ background: "linear-gradient(135deg, #1ABC9C, #16A085)" }}
              >
                Join
              </button>
            </div>
            {subMsg && <p className="text-xs mt-2" style={{ color: "#4ade80" }}>{subMsg}</p>}
          </div>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.28)" }}>
            &copy; {year} Accredit Interactive. All rights reserved. Built for Africa&apos;s events.
          </p>
          <div className="flex items-center gap-1 text-xs" style={{ color: "rgba(255,255,255,0.28)" }}>
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: "#4ade80", boxShadow: "0 0 6px rgba(74,222,128,0.6)" }}
            />
            All systems operational
          </div>
        </div>
      </div>
    </footer>
  );
}
