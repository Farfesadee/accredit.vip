import { Navbar } from "@/components/shared/navbar";
import { HomePageClient } from "@/components/home/home-page-client";

export const metadata = {
  title: "Accredit Interactive | Event Ticketing Platform & Marketplace in Nigeria",
  description:
    "Nigeria's event ticketing platform and event marketplace. Create events, sell tickets online, discover events, send WhatsApp/SMS/email invitations, generate QR access codes, and track attendance.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Accredit Interactive | Event Ticketing Platform & Marketplace in Nigeria",
    description:
      "Create events, sell tickets online, discover events near you, and manage entry with QR accreditation.",
    url: "/",
  },
};

const ORG_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Accredit Interactive",
  url: "https://accredit.vip",
  logo: "https://accredit.vip/logo-full.png",
  description:
    "Event ticketing platform and event marketplace in Nigeria: create events, sell tickets online, send invitations, and manage entry with QR accreditation.",
  sameAs: [],
};

const WEBSITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Accredit Interactive",
  url: "https://accredit.vip",
};

export default function HomePage() {
  return (
    <div id="main-content" className="flex flex-col min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSON_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSON_LD) }}
      />
      <Navbar variant="solid" />
      <HomePageClient />
    </div>
  );
}
