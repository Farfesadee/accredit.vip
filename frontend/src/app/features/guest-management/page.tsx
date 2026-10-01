"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FeatureLayout } from "@/components/shared/feature-layout";
import { Check } from "lucide-react";

const icon = (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

export default function GuestManagementPage() {
  return (
    <FeatureLayout icon={icon} title="Guest Management" tag="Operations" tagColor="#059669">
      <div className="prose prose-sm max-w-none space-y-6">
        <p className="text-lg leading-relaxed" style={{ color: "#4b5563" }}>
          Manage your entire guest list from one place. Add guests manually, import thousands via CSV, 
          track RSVPs, send reminders, and monitor attendance: all without leaving your dashboard.
        </p>

        <h2 className="text-xl font-bold mt-10" style={{ color: "#0D1B2A" }}>How It Works</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { step: "1", title: "Import Guests", desc: "Add guests one by one or upload a CSV file with name, phone, and email columns. Bulk import handles thousands of guests." },
            { step: "2", title: "Track RSVPs", desc: "Each guest receives a unique RSVP link. Monitor who accepted, declined, or hasn't responded yet." },
            { step: "3", title: "Check In", desc: "At the event, scan QR codes to check guests in. Live attendance logs sync instantly to your dashboard." },
          ].map((item) => (
            <div key={item.step} className="rounded-xl border p-5" style={{ borderColor: "#d1fae5" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold mb-3" style={{ background: "#059669" }}>{item.step}</div>
              <h3 className="font-bold text-sm mb-1" style={{ color: "#0D1B2A" }}>{item.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: "#6b7280" }}>{item.desc}</p>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-bold mt-10" style={{ color: "#0D1B2A" }}>Key Features</h2>
        <ul className="space-y-3" style={{ color: "#4b5563" }}>
          <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#059669" }} aria-hidden="true" /> <strong>CSV Import</strong>: Upload a spreadsheet with your guest list. Columns: name, phone, email.</li>
          <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#059669" }} aria-hidden="true" /> <strong>RSVP Status Tracking</strong>: See at a glance: Accepted, Declined, Maybe, and Pending counts.</li>
          <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#059669" }} aria-hidden="true" /> <strong>Search & Filter</strong>: Find any guest by name, email, or phone. Filter by RSVP status.</li>
          <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#059669" }} aria-hidden="true" /> <strong>Inline Editing</strong>: Update guest details or remove them directly from the list.</li>
          <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#059669" }} aria-hidden="true" /> <strong>Duplicate Prevention</strong>: The system checks for duplicate entries on import and manual add.</li>
          <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#059669" }} aria-hidden="true" /> <strong>Unique QR Per Guest</strong>: Every guest gets their own scannable code, no sharing possible.</li>
        </ul>

        <div className="mt-10 pt-8 border-t">
          <Link href="/create-event"><Button style={{ background: "#059669" }} className="h-12 px-8 text-base font-bold">CREATE EVENT</Button></Link>
        </div>
      </div>
    </FeatureLayout>
  );
}
