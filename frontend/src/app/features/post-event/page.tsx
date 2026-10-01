"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FeatureLayout } from "@/components/shared/feature-layout";
import { Check } from "lucide-react";

const icon = (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);

export default function PostEventPage() {
  return (
    <FeatureLayout icon={icon} title="Post Event: Public Ticketed Events" tag="Public Events" tagColor="#7C3AED">
      <div className="prose prose-sm max-w-none space-y-6">
        <p className="text-lg leading-relaxed" style={{ color: "#4b5563" }}>
          Post Event is built for public-facing events like concerts, conferences, and festivals. 
          Your event gets listed on the Discover page where anyone can find it, buy tickets, and attend.
        </p>

        <h2 className="text-xl font-bold mt-10" style={{ color: "#0D1B2A" }}>How It Works</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { step: "1", title: "Create & List", desc: "Set up your event with all details, ticket pricing, and available quantity. Published events appear on the Discover page." },
            { step: "2", title: "Sell Tickets", desc: "Attendees browse events, select tickets, and pay via Paystack (cards, USSD, bank transfer). Digital tickets are issued instantly." },
            { step: "3", title: "Verify at Door", desc: "Each ticket includes a unique QR code. Scan at the entrance for instant validation and check-in." },
          ].map((item) => (
            <div key={item.step} className="rounded-xl border p-5" style={{ borderColor: "#ede9fe" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold mb-3" style={{ background: "#7C3AED" }}>{item.step}</div>
              <h3 className="font-bold text-sm mb-1" style={{ color: "#0D1B2A" }}>{item.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: "#6b7280" }}>{item.desc}</p>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-bold mt-10" style={{ color: "#0D1B2A" }}>Key Features</h2>
        <ul className="space-y-3" style={{ color: "#4b5563" }}>
          <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#7C3AED" }} aria-hidden="true" /> <strong>Public Discovery</strong>: Your event appears on the Discover page with search, category, and date filters.</li>
          <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#7C3AED" }} aria-hidden="true" /> <strong>Ticket Sales</strong>: Set a price, sell tickets, and collect payments through Paystack integration.</li>
          <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#7C3AED" }} aria-hidden="true" /> <strong>Digital QR Tickets</strong>: Every buyer receives a personalized ticket receipt with scannable QR code.</li>
          <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#7C3AED" }} aria-hidden="true" /> <strong>Buyer Management</strong>: See all ticket buyers, purchase amounts, and check-in status from your dashboard.</li>
          <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#7C3AED" }} aria-hidden="true" /> <strong>Cover & Fliers</strong>: Upload promotional images to attract more attendees.</li>
        </ul>

        <h2 className="text-xl font-bold mt-10" style={{ color: "#0D1B2A" }}>Perfect For</h2>
        <div className="flex flex-wrap gap-2">
          {["Concerts", "Conferences", "Festivals", "Workshops", "Networking Events", "Trade Shows"].map((item) => (
            <span key={item} className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: "#ede9fe", color: "#7C3AED" }}>{item}</span>
          ))}
        </div>

        <div className="mt-10 pt-8 border-t flex gap-4">
          <Link href="/create-event"><Button className="h-12 px-8 text-base font-bold">CREATE EVENT</Button></Link>
          <Link href="/pricing"><Button variant="outline" className="h-12 px-8 text-base font-bold">Channel Pricing</Button></Link>
        </div>
      </div>
    </FeatureLayout>
  );
}
