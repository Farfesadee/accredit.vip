"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";

interface NavbarProps {
  variant?: "transparent" | "solid" | "light";
  showAuth?: boolean;
  authLinks?: Array<{ label: string; href: string; primary?: boolean; onClick?: () => void }>;
  extraLinks?: Array<{ label: string; href: string }>;
}

export function Navbar({
  variant = "solid",
  showAuth = true,
  authLinks,
  extraLinks = [
    { label: "Home", href: "/" },
    { label: "Attend", href: "/attend" },
    { label: "Pricing", href: "/pricing" },
    { label: "Community", href: "/community" },
    { label: "Contact", href: "/contact" },
  ],
}: NavbarProps) {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const resolvedAuthLinks = authLinks ?? [
    { label: "LOGIN", href: "/login", primary: false },
    { label: "CREATE EVENT", href: "/create-event", primary: true },
  ];

  const isDark = variant === "solid" || variant === "transparent";

  return (
    <header
      className="motion-navbar sticky top-0 z-50 transition-all duration-300"
      style={
        variant === "light"
          ? { background: "white", borderBottom: "1px solid #e8edf2" }
          : scrolled
          ? {
              background: "rgba(13,27,42,0.95)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
            }
          : {
              background: "#0D1B2A",
              boxShadow: "0 1px 0 rgba(255,255,255,0.06)",
            }
      }
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">

          {/* ── Logo ── */}
          <Link
            href="/"
            aria-label="Accredit Interactive home"
            className="flex items-center gap-3 flex-shrink-0 transition-transform duration-200 hover:scale-[1.02]"
          >
            <Image
              src="/logo-mark.png"
              alt=""
              width={366}
              height={372}
              className="h-12 sm:h-14 w-auto object-contain"
              priority
            />
            <Image
              src="/logo-text.png"
              alt="Accredit Interactive"
              width={594}
              height={152}
              className="h-8 sm:h-10 w-auto object-contain"
              priority
            />
          </Link>

          {/* ── Desktop Nav ── */}
          <nav className="hidden md:flex items-center gap-1">
            {extraLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="nav-link px-4 py-2 rounded-lg transition-all duration-150 text-sm font-medium"
                style={{
                  color: isDark ? "rgba(255,255,255,0.75)" : "#4a6280",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = isDark
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(0,0,0,0.05)";
                  (e.currentTarget as HTMLElement).style.color = isDark ? "white" : "#0D1B2A";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = isDark
                    ? "rgba(255,255,255,0.75)"
                    : "#4a6280";
                }}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* ── Auth Links ── */}
          {showAuth && (
            <div className="hidden md:flex items-center gap-2">
              {resolvedAuthLinks.map((link) => {
                // Use button for logout (has onClick handler)
                if (link.onClick) {
                  return (
                    <button
                      key={link.label}
                      onClick={link.onClick}
                      className="rounded-lg border px-4 py-2 text-sm font-bold transition-all duration-150"
                      style={{
                        color: isDark ? "white" : "#0D1B2A",
                        borderColor: isDark ? "rgba(255,255,255,0.22)" : "rgba(13,27,42,0.18)",
                        background: isDark ? "rgba(255,255,255,0.06)" : "white",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = isDark
                          ? "rgba(255,255,255,0.12)"
                          : "rgba(13,27,42,0.05)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = isDark ? "rgba(255,255,255,0.06)" : "white";
                      }}
                    >
                      {link.label}
                    </button>
                  );
                }
                // Use Link for regular navigation
                return link.primary ? (
                  <Link key={link.href} href={link.href} className="btn-primary text-sm py-2 px-5 rounded-lg">
                    {link.label}
                  </Link>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-lg border px-4 py-2 text-sm font-bold transition-all duration-150"
                    style={{
                      color: isDark ? "white" : "#0D1B2A",
                      borderColor: isDark ? "rgba(255,255,255,0.22)" : "rgba(13,27,42,0.18)",
                      background: isDark ? "rgba(255,255,255,0.06)" : "white",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = isDark
                        ? "rgba(255,255,255,0.12)"
                        : "rgba(13,27,42,0.05)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = isDark ? "rgba(255,255,255,0.06)" : "white";
                    }}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          )}

          {/* ── Mobile Toggle ── */}
          <button
            className="md:hidden p-2 rounded-xl transition-colors duration-150"
            style={{ color: isDark ? "rgba(255,255,255,0.7)" : "#4a6280" }}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = isDark
                ? "rgba(255,255,255,0.08)"
                : "rgba(0,0,0,0.05)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* ── Mobile Menu ── */}
      {mobileOpen && (
        <div
          className="md:hidden border-t"
          style={{
            background: variant === "light" ? "white" : "rgba(13,27,42,0.98)",
            borderColor: variant === "light" ? "#e8edf2" : "rgba(255,255,255,0.08)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div className="px-4 py-4 space-y-1">
            {extraLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                style={{ color: isDark ? "rgba(255,255,255,0.75)" : "#4a6280" }}
                onClick={() => setMobileOpen(false)}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = isDark
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(0,0,0,0.04)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {link.label}
              </Link>
            ))}
            {showAuth && (
              <div className="pt-3 pb-1 space-y-2 border-t" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "#e8edf2" }}>
                {resolvedAuthLinks.map((link) => {
                  // Use button for logout (has onClick handler)
                  if (link.onClick) {
                    return (
                      <button
                        key={link.label}
                        onClick={() => { setMobileOpen(false); link.onClick?.(); }}
                        className="block w-full rounded-xl border px-4 py-3 text-center text-sm font-bold transition-colors"
                        style={{
                          color: isDark ? "white" : "#0D1B2A",
                          borderColor: isDark ? "rgba(255,255,255,0.18)" : "rgba(13,27,42,0.16)",
                          cursor: "pointer",
                        }}
                      >
                        {link.label}
                      </button>
                    );
                  }
                  // Use Link for regular navigation
                  return link.primary ? (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="btn-primary w-full justify-center text-sm py-3 rounded-xl"
                      onClick={() => setMobileOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="block rounded-xl border px-4 py-3 text-center text-sm font-bold transition-all duration-150"
                      style={{
                        color: isDark ? "white" : "#0D1B2A",
                        borderColor: isDark ? "rgba(255,255,255,0.24)" : "rgba(13,27,42,0.2)",
                        background: isDark ? "rgba(255,255,255,0.08)" : "rgba(13,27,42,0.04)",
                      }}
                      onClick={() => setMobileOpen(false)}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
