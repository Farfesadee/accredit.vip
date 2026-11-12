// Build-time identity for the couple's own dashboard (portal.sarahandpatrick.co.uk).
// Only the portal build in .github/workflows/deploy.yml sets these, so every
// other surface, including accredit.vip, keeps the platform defaults.
export const PORTAL = process.env.NEXT_PUBLIC_PORTAL_NAME || "";

// The event this portal exists for. Used for the /admin shortcut and the
// post-login landing page.
export const PORTAL_EVENT_ID = process.env.NEXT_PUBLIC_PORTAL_EVENT_ID || "";

// The couple's public wedding site, linked from the sign-in screen when set.
export const PORTAL_SITE_URL = process.env.NEXT_PUBLIC_PORTAL_SITE_URL || "";

// A short line under their names on the sign-in screen, for example
// "19 December 2026, Abuja".
export const PORTAL_TAGLINE = process.env.NEXT_PUBLIC_PORTAL_TAGLINE || "";

export const PORTAL_HOME = PORTAL_EVENT_ID ? "/admin" : "/dashboard";

// "Patrick & Sarah" becomes "P&S" for the collapsed sidebar rail.
export const PORTAL_INITIALS =
  PORTAL.split(/[^A-Za-z]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase())
    .join("&") || "P&S";

// The wedding's own palette, used by the portal chrome in place of the
// platform's teal and navy.
export const PORTAL_ACCENT = "#C9A227";
export const PORTAL_ACCENT_DARK = "#A8871F";
export const PORTAL_SIDEBAR_BG = "#1F1B16";
