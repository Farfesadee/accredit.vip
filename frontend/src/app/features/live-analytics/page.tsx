"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FeatureLayout } from "@/components/shared/feature-layout";
import { Check } from "lucide-react";

const icon = (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

export default function LiveAnalyticsPage() {
  return (
    <FeatureLayout icon={icon} title="Live Analytics" tag="Data & Insights" tagColor="#D97706">
      <div className="prose prose-sm max-w-none space-y-6">
        <p className="text-lg leading-relaxed" style={{ color: "#4b5563" }}>
          Get real-time visibility into every aspect of your event. From RSVP conversion rates to check-in 
          timelines and channel-by-channel delivery performance: all your data is visualised and accessible 
          from a single dashboard.
        </p>

        <h2 className="text-xl font-bold mt-10" style={{ color: "#0D1B2A" }}>What You Can Track</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { title: "RSVP Analytics", desc: "Track how many guests accepted, declined, or are still pending. See your conversion rate in real-time." },
            { title: "Check-in Timelines", desc: "Monitor when guests arrive. See peak entry times and total attendance as it happens." },
            { title: "Delivery Reports", desc: "See which invites were delivered successfully vs failed across WhatsApp, SMS, and Email." },
            { title: "Revenue Overview", desc: "For ticketed events, track total sales, revenue collected, and outstanding payments." },
            { title: "Channel Performance", desc: "Compare open rates and response rates across Email, SMS, and WhatsApp." },
            { title: "Guest Demographics", desc: "View aggregate data on your guests: useful for corporate and large-scale events." },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border p-5" style={{ borderColor: "#fef3c7" }}>
              <h3 className="font-bold text-sm mb-1" style={{ color: "#0D1B2A" }}>{item.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: "#6b7280" }}>{item.desc}</p>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-bold mt-10" style={{ color: "#0D1B2A" }}>Key Features</h2>
        <ul className="space-y-3" style={{ color: "#4b5563" }}>
          <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#D97706" }} aria-hidden="true" /> <strong>Real-Time Updates</strong>: Data refreshes automatically. No manual refresh needed.</li>
          <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#D97706" }} aria-hidden="true" /> <strong>Event-Level Views</strong>: See analytics per event, not just a global overview.</li>
          <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#D97706" }} aria-hidden="true" /> <strong>Export Ready</strong>: All data is structured and ready for export to spreadsheets.</li>
          <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#D97706" }} aria-hidden="true" /> <strong>Admin Dashboard</strong>: Super admins get system-wide stats: total users, events, and revenue.</li>
          <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#D97706" }} aria-hidden="true" /> <strong>Historical Data</strong>: Past event data remains accessible for comparison and reporting.</li>
        </ul>

        <div className="mt-10 pt-8 border-t">
          <Link href="/create-event"><Button style={{ background: "#D97706" }} className="h-12 px-8 text-base font-bold">CREATE EVENT</Button></Link>
        </div>
      </div>
    </FeatureLayout>
  );
}
