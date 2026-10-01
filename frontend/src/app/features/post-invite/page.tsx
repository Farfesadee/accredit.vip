"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FeatureLayout } from "@/components/shared/feature-layout";
import { Check } from "lucide-react";

const icon = (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

export default function PostInvitePage() {
  return (
    <FeatureLayout icon={icon} title="Post Invite: Private Events" tag="Private Events" tagColor="#1ABC9C">
      <div className="prose prose-sm max-w-none space-y-6">
        <p className="text-lg leading-relaxed" style={{ color: "#4b5563" }}>
          Post Invite is designed for private, by-invitation-only events. Whether it's an intimate wedding, 
          a corporate dinner, a VIP gathering, or a birthday celebration: you control exactly who gets in.
        </p>

        <h2 className="text-xl font-bold mt-10" style={{ color: "#0D1B2A" }}>How It Works</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { step: "1", title: "Create", desc: "Set up your event with date, time, venue, dress code, and host details. Choose 'Post Invite' mode when creating." },
            { step: "2", title: "Upload Guests", desc: "Add guests manually or import via CSV. Each guest automatically gets a unique RSVP token and QR code." },
            { step: "3", title: "Send Invites", desc: "Deliver personalised invitations via WhatsApp, SMS, or Email. Each invite includes the guest's unique QR code." },
          ].map((item) => (
            <div key={item.step} className="rounded-xl border p-5" style={{ borderColor: "#f3e8ff" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold mb-3" style={{ background: "#1ABC9C" }}>{item.step}</div>
              <h3 className="font-bold text-sm mb-1" style={{ color: "#0D1B2A" }}>{item.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: "#6b7280" }}>{item.desc}</p>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-bold mt-10" style={{ color: "#0D1B2A" }}>Key Features</h2>
        <ul className="space-y-3" style={{ color: "#4b5563" }}>
          <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#1ABC9C" }} aria-hidden="true" /> <strong>Guest List Control</strong>: Your event stays private. Only invited guests can access the RSVP page.</li>
          <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#1ABC9C" }} aria-hidden="true" /> <strong>Multi-Channel Delivery</strong>: Reach guests where they are: WhatsApp, SMS, or Email.</li>
          <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#1ABC9C" }} aria-hidden="true" /> <strong>RSVP Tracking</strong>: See who accepted, declined, or is pending in real-time.</li>
          <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#1ABC9C" }} aria-hidden="true" /> <strong>QR Door Check-in</strong>: Scan guest QR codes at the gate for instant validation.</li>
          <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#1ABC9C" }} aria-hidden="true" /> <strong>Cover Images & Fliers</strong>: Upload branding assets for the RSVP page.</li>
        </ul>

        <h2 className="text-xl font-bold mt-10" style={{ color: "#0D1B2A" }}>Perfect For</h2>
        <div className="flex flex-wrap gap-2">
          {["Weddings", "Birthday Parties", "Corporate Dinners", "VIP Galas", "Family Reunions", "Anniversary Celebrations"].map((item) => (
            <span key={item} className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: "#fce7f3", color: "#1ABC9C" }}>{item}</span>
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
