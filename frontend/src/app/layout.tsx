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

export const metadata: Metadata = {
  metadataBase: new URL("https://accredit.vip"),
  title: {
    default: "Accredit Interactive | Event Ticketing Platform & Marketplace in Nigeria",
    template: "%s | Accredit Interactive",
  },
  description:
    "Accredit Interactive is Nigeria's event ticketing platform and event marketplace: create events, sell tickets online, send WhatsApp/SMS/email invitations, generate QR access codes, and track attendance: all in one place.",
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
  authors: [{ name: "Accredit Interactive" }],
  creator: "Accredit Interactive",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: "Accredit Interactive",
    title: "Accredit Interactive | Event Ticketing Platform & Marketplace in Nigeria",
    description:
      "Create events, sell tickets online, send invitations, generate QR codes, and track attendance: all from one platform built for Africa.",
    images: [{ url: "/logo-full.png", width: 1200, height: 630, alt: "Accredit Interactive" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Accredit Interactive | Event Ticketing Platform & Marketplace in Nigeria",
    description:
      "Create events, sell tickets online, send invitations, generate QR codes, and track attendance.",
    images: ["/logo-full.png"],
  },
  icons: {
    icon: "/logo-mark.png",
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
