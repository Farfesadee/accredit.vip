import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth-context";
import { ClientProviders } from "./client-providers";
import { SessionGuard } from "@/components/session-guard";
import { SiteChrome } from "@/components/shared/site-chrome";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

import { PORTAL, PORTAL_SITE_URL } from "@/lib/portal";

// The couple's own dashboard build (portal.sarahandpatrick.co.uk) is compiled
// with NEXT_PUBLIC_PORTAL_NAME set, so their browser tab carries their name
// rather than the platform's. Every other build is untouched.
const PORTAL_NAME = process.env.NEXT_PUBLIC_PORTAL_NAME;

const SITE_TITLE = PORTAL_NAME
  ? `${PORTAL_NAME} | Dashboard`
  : "Accredit Interactive | Event Ticketing Platform & Marketplace in Nigeria";

const SITE_DESCRIPTION = PORTAL_NAME
  ? `Guest list, invitations and entry codes for ${PORTAL_NAME}.`
  : "Accredit Interactive is Nigeria's event ticketing platform and event marketplace: create events, sell tickets online, send WhatsApp/SMS/email invitations, generate QR access codes, and track attendance: all in one place.";

// Shared marketing copy is dropped entirely on the couple's build; the object
// below is otherwise identical, so accredit.vip keeps every tag it shipped with.
const SHORT_DESCRIPTION = PORTAL_NAME
  ? SITE_DESCRIPTION
  : "Create events, sell tickets online, send invitations, generate QR codes, and track attendance: all from one platform built for Africa.";

const OG_IMAGE = PORTAL_NAME ? "/uploads/wedding-7e961344fddf.jpg" : "/logo-full.png";

export const metadata: Metadata = {
  metadataBase: new URL(PORTAL ? PORTAL_SITE_URL || "https://accredit.vip" : "https://accredit.vip"),
  title: {
    default: SITE_TITLE,
    template: PORTAL_NAME ? `%s | ${PORTAL_NAME}` : "%s | Accredit Interactive",
  },
  description: SITE_DESCRIPTION,
  ...(PORTAL_NAME
    ? {}
    : {
        keywords: [
          "event ticketing platform",
          "event ticketing platform Nigeria",
          "sell tickets online Nigeria",
          "event marketplace",
          "event marketplace Nigeria",
          "buy event tickets Lagos",
          "event management platform Africa",
          "QR event accreditation",
          "event invitations WhatsApp",
          "Accredit Interactive",
        ],
      }),
  authors: [{ name: PORTAL_NAME || "Accredit Interactive" }],
  creator: PORTAL_NAME || "Accredit Interactive",
  alternates: { canonical: "/" },
  // The couple's dashboard is private; the platform's public pages want to rank.
  robots: PORTAL ? { index: false, follow: false } : { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: PORTAL_NAME || "Accredit Interactive",
    title: SITE_TITLE,
    description: SHORT_DESCRIPTION,
    images: [
      PORTAL_NAME
        ? { url: OG_IMAGE, width: 1024, height: 1280, alt: PORTAL_NAME }
        : { url: OG_IMAGE, width: 1200, height: 630, alt: "Accredit Interactive" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: PORTAL_NAME
      ? SITE_DESCRIPTION
      : "Create events, sell tickets online, send invitations, generate QR codes, and track attendance.",
    images: [OG_IMAGE],
  },
  icons: {
    // The couple's portal carries their crest in the tab, not the platform mark.
    icon: PORTAL_NAME ? "/uploads/wedding-crest-cream.png" : "/logo-mark.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-portal={PORTAL ? "" : undefined}
      className={`${plusJakartaSans.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" style={{ fontFamily: "var(--font-plus-jakarta), system-ui, sans-serif" }}>
        <AuthProvider>
          <SessionGuard>
            {children}
            <ClientProviders />
            <SiteChrome />
          </SessionGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
