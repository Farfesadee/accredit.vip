"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign"] as const;

function captureUtm() {
  try {
    const params = new URLSearchParams(window.location.search);
    let touched = false;
    const stored = JSON.parse(localStorage.getItem("accredit_utm") || "{}");
    for (const key of UTM_KEYS) {
      const val = params.get(key);
      if (val) {
        stored[key] = val;
        touched = true;
      }
    }
    if (touched) localStorage.setItem("accredit_utm", JSON.stringify(stored));
  } catch {}
}

export function getStoredUtm(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem("accredit_utm") || "{}");
  } catch {
    return {};
  }
}

export function SiteChrome() {
  const [progress, setProgress] = useState(0);
  const [showTop, setShowTop] = useState(false);
  const [cookieOk, setCookieOk] = useState(true);
  const [supportOpen, setSupportOpen] = useState(false);
  const [announcement, setAnnouncement] = useState<{ id: number; title: string; body: string } | null>(null);
  const [hideFloats, setHideFloats] = useState(false);

  useEffect(() => {
    captureUtm();
    try {
      setCookieOk(localStorage.getItem("accredit_cookie_ok") === "1");
    } catch {}
    const path = window.location.pathname;
    // No floating buttons on gate/admin tooling (accreditation scanners,
    // scan helpers, admin console) where they would cover controls.
    setHideFloats(
      path.startsWith("/accreditation") || path.startsWith("/admin") || path.startsWith("/scan")
    );
    if (path.startsWith("/dashboard") || path.startsWith("/admin")) {
      apiClient<{ announcements: { id: number; title: string; body: string }[] }>("/announcements/active")
        .then((d) => {
          const list = d.announcements || [];
          const seen: string[] = JSON.parse(localStorage.getItem("accredit_ann_seen") || "[]");
          const fresh = list.find((a) => !seen.includes(String(a.id)));
          if (fresh) setAnnouncement(fresh);
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? Math.min(1, el.scrollTop / max) : 0);
      setShowTop(el.scrollTop > 600);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const acceptCookies = () => {
    try {
      localStorage.setItem("accredit_cookie_ok", "1");
    } catch {}
    setCookieOk(true);
  };

  const dismissAnnouncement = () => {
    if (!announcement) return;
    try {
      const seen: string[] = JSON.parse(localStorage.getItem("accredit_ann_seen") || "[]");
      seen.push(String(announcement.id));
      localStorage.setItem("accredit_ann_seen", JSON.stringify(seen));
    } catch {}
    setAnnouncement(null);
  };

  return (
    <>
      {announcement && (
        <div className="bg-[#0D1B2A] text-white px-4 py-2.5 flex items-center gap-3">
          <p className="flex-1 min-w-0 text-xs sm:text-sm truncate">
            <strong>{announcement.title}:</strong> <span className="text-white/80">{announcement.body}</span>
          </p>
          <button onClick={dismissAnnouncement} aria-label="Dismiss announcement" className="flex-shrink-0 text-white/60 hover:text-white text-sm font-bold px-1">
            ✕
          </button>
        </div>
      )}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-[#0D1B2A] focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
        Skip to content
      </a>

      {/* Scroll progress */}
      <div className="fixed top-0 left-0 right-0 z-[90] h-1 bg-transparent pointer-events-none" aria-hidden="true">
        <div className="h-full transition-[width] duration-100" style={{ width: `${progress * 100}%`, background: "linear-gradient(90deg, #1ABC9C, #16A085)" }} />
      </div>

      {/* Floating contact support */}
      {!hideFloats && supportOpen && (
        <div className="fixed bottom-20 right-6 z-[80] w-64 rounded-2xl bg-white shadow-2xl border border-[#e8edf2] overflow-hidden">
          <p className="px-4 pt-3 pb-1 text-xs font-black uppercase tracking-wider text-[#94a3b8]">Contact support</p>
          <a
            href="https://wa.me/2348101143265"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3 hover:bg-[#f8f9fc] transition-colors"
          >
            <span className="w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: "#25D366" }}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.5 14.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.5 0 1.47 1.07 2.9 1.22 3.1.15.2 2.11 3.22 5.1 4.51.71.31 1.27.49 1.71.63.72.23 1.37.2 1.88.12.57-.09 1.76-.72 2-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35M12.05 21.79h-.01a9.87 9.87 0 01-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 01-1.51-5.26c0-5.45 4.44-9.88 9.9-9.88a9.83 9.83 0 019.88 9.89c0 5.45-4.44 9.88-9.89 9.88M20.5 3.49A11.8 11.8 0 0012.05 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.9 11.9 0 005.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.24-6.16-3.44-8.41" /></svg>
            </span>
            <span>
              <span className="block text-sm font-bold text-[#0D1B2A]">WhatsApp</span>
              <span className="block text-xs text-[#64748b]">+234 810 114 3265</span>
            </span>
          </a>
          <a
            href="mailto:info@accredit.vip"
            className="flex items-center gap-3 px-4 py-3 hover:bg-[#f8f9fc] transition-colors"
          >
            <span className="w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: "#1ABC9C" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </span>
            <span>
              <span className="block text-sm font-bold text-[#0D1B2A]">Email</span>
              <span className="block text-xs text-[#64748b]">info@accredit.vip</span>
            </span>
          </a>
          <Link
            href="/contact"
            onClick={() => setSupportOpen(false)}
            className="flex items-center gap-3 px-4 py-3 border-t border-[#e8edf2] hover:bg-[#f8f9fc] transition-colors"
          >
            <span className="w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: "#0D1B2A" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </span>
            <span className="block text-sm font-bold text-[#0D1B2A]">Contact page</span>
          </Link>
        </div>
      )}
      {!hideFloats && (
      <button
        onClick={() => setSupportOpen(!supportOpen)}
        aria-label="Contact support"
        title="Contact support"
        className="fixed bottom-6 right-6 z-[80] w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110"
        style={{ background: "linear-gradient(135deg, #1ABC9C, #16A085)", boxShadow: "0 8px 24px rgba(26,188,156,0.4)" }}
      >
        {supportOpen ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
        )}
      </button>
      )}

      {/* Back to top */}
      {!hideFloats && showTop && !supportOpen && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
          title="Back to top"
          className="fixed bottom-20 right-6 z-[80] w-12 h-12 rounded-full bg-[#0D1B2A] text-white shadow-lg flex items-center justify-center transition-transform hover:scale-110"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      )}

      {/* Cookie banner */}
      {!cookieOk && (
        <div className="fixed bottom-0 left-0 right-0 z-[85] px-4 pb-4">
          <div className="max-w-3xl mx-auto rounded-2xl bg-[#0D1B2A] text-white px-5 py-4 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <p className="text-xs leading-relaxed text-white/80 flex-1">
              We use basic cookies to keep you signed in and remember your preferences. By using Accredit Interactive you accept this.
            </p>
            <button
              onClick={acceptCookies}
              className="flex-shrink-0 rounded-xl px-5 py-2.5 text-xs font-bold text-white transition-transform hover:scale-105"
              style={{ background: "linear-gradient(135deg, #1ABC9C, #16A085)" }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
