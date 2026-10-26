"use client";

import { useState } from "react";
import Link from "next/link";

export interface WeddingNavItem {
  label: string;
  href: string;
}

interface WeddingNavProps {
  items: WeddingNavItem[];
  /**
   * The subset shown inline on desktop. The full list still fills the phone
   * menu, so a short bar never hides a section from a guest.
   */
  desktopItems?: WeddingNavItem[];
  cta?: { label: string; href: string };
  onNavigate?: (href: string) => void;
}

const GOLD = "#b8892f";
const GOLD_LIGHT = "#e8c05f";
const CREAM = "#f5f0e6";
const INK = "#2b2118";

export function WeddingNames() {
  return (
    <p className="font-serif text-lg" style={{ color: INK }}>
      Sarah <span style={{ color: GOLD }}>&</span> Patrick
    </p>
  );
}

export default function WeddingNav({ items, desktopItems, cta, onNavigate }: WeddingNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const inlineItems = desktopItems && desktopItems.length > 0 ? desktopItems : items;

  const handleClick = (e: React.MouseEvent, href: string) => {
    // Only in-page anchors are intercepted for smooth scrolling. Full paths
    // (Aso Ebi page, RSVP links) must navigate normally, never be swallowed.
    if (!onNavigate || !href.startsWith("#")) return;
    e.preventDefault();
    setMenuOpen(false);
    onNavigate(href);
  };

  // In-page anchors render as buttons so a tap can never trigger a page
  // navigation (which would replay the opening). Full paths stay as Links.
  const renderItem = (l: WeddingNavItem, mobile: boolean) => {
    if (onNavigate && l.href.startsWith("#")) {
      return (
        <button
          key={l.label}
          onClick={() => {
            setMenuOpen(false);
            onNavigate(l.href);
          }}
          className={mobile ? "font-serif text-3xl" : "text-[13px] font-bold hover:underline underline-offset-4"}
          style={{ color: INK }}
        >
          {l.label}
        </button>
      );
    }
    return (
      <Link
        key={l.label}
        href={l.href}
        onClick={(e) => handleClick(e, l.href)}
        className={mobile ? "font-serif text-3xl" : "text-[13px] font-bold hover:underline underline-offset-4"}
        style={{ color: INK }}
      >
        {l.label}
      </Link>
    );
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b" style={{ background: `${CREAM}f2`, borderColor: "#e2d5b8" }}>
        <div className="max-w-4xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          <WeddingNames />
          {/* Desktop: a short inline bar. The rest lives in the phone menu. */}
          <nav className="hidden md:flex items-center gap-6">
            {inlineItems.map((l) => renderItem(l, false))}
            {cta && (
              <Link
                href={cta.href}
                className="h-9 px-4 rounded-full font-bold text-[13px] text-white flex items-center"
                style={{ background: `linear-gradient(160deg, ${GOLD_LIGHT}, ${GOLD})` }}
              >
                {cta.label}
              </Link>
            )}
          </nav>
          {/* Mobile: hamburger only */}
          <button onClick={() => setMenuOpen(true)} aria-label="Open menu" className="p-2 md:hidden">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="7" x2="21" y2="7" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="17" x2="21" y2="17" />
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col md:hidden" style={{ background: CREAM }}>
          <div className="max-w-4xl w-full mx-auto px-5 h-14 flex items-center justify-between border-b" style={{ borderColor: "#e2d5b8" }}>
            <WeddingNames />
            <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="p-2 text-2xl leading-none" style={{ color: INK }}>
              ×
            </button>
          </div>
          <nav className="flex-1 flex flex-col items-center justify-center gap-5">
            {items.map((l) => renderItem(l, true))}
            {cta && (
              <Link
                href={cta.href}
                onClick={() => setMenuOpen(false)}
                className="mt-2 h-12 px-8 rounded-full font-bold text-sm text-white flex items-center"
                style={{ background: `linear-gradient(160deg, ${GOLD_LIGHT}, ${GOLD})` }}
              >
                {cta.label}
              </Link>
            )}
          </nav>
        </div>
      )}
    </>
  );
}
