import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://sarahandpatrick.co.uk"),
  title: {
    default: "Sarah & Patrick | 19 December 2026",
    template: "%s | Sarah & Patrick",
  },
  description:
    "The wedding of Sarah Ekene Elumeze and Patrick Ekperikpe Ekpo. Saturday, 19 December 2026, Abuja. #HeavyOnTheEkpos",
  keywords: ["Sarah and Patrick", "wedding", "Abuja", "19 December 2026"],
  authors: [{ name: "Sarah & Patrick" }],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: "https://sarahandpatrick.co.uk",
    siteName: "Sarah & Patrick",
    title: "Sarah & Patrick | 19 December 2026",
    description:
      "The wedding of Sarah Ekene Elumeze and Patrick Ekperikpe Ekpo. Saturday, 19 December 2026, Abuja.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sarah & Patrick | 19 December 2026",
    description:
      "The wedding of Sarah Ekene Elumeze and Patrick Ekperikpe Ekpo. Saturday, 19 December 2026, Abuja.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f5f0e6",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
