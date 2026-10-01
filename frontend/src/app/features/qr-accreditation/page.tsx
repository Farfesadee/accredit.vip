"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FeatureLayout } from "@/components/shared/feature-layout";
import { Check } from "lucide-react";

const icon = (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8H3m2 8H3m18-8h-1M4 16H3m15-4a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

export default function QRAccreditationPage() {
  return (
    <FeatureLayout icon={icon} title="QR Accreditation" tag="Check-in Tech" tagColor="#0891B2">
      <div className="prose prose-sm max-w-none space-y-6">
        <p className="text-lg leading-relaxed" style={{ color: "#4b5563" }}>
          QR Accreditation is the core of your event security. Every guest and ticket buyer gets a unique, 
          cryptographically-random QR code that your team scans at the gate for instant, fraud-proof check-in.
        </p>

        <h2 className="text-xl font-bold mt-10" style={{ color: "#0D1B2A" }}>How It Works</h2>
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { step: "1", title: "Generate", desc: "Each guest or ticket buyer automatically gets a unique QR code linked to their identity." },
            { step: "2", title: "Distribute", desc: "Send QR codes via invites for guests or embed them in digital ticket receipts for buyers." },
            { step: "3", title: "Scan", desc: "Your staff scans the QR code at the door using any QR scanner connected to the system." },
            { step: "4", title: "Verify", desc: "The system validates the code, marks the guest as checked in, and rejects duplicate scans." },
          ].map((item) => (
            <div key={item.step} className="rounded-xl border p-5" style={{ borderColor: "#cffafe" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold mb-3" style={{ background: "#0891B2" }}>{item.step}</div>
              <h3 className="font-bold text-sm mb-1" style={{ color: "#0D1B2A" }}>{item.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: "#6b7280" }}>{item.desc}</p>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-bold mt-10" style={{ color: "#0D1B2A" }}>Key Features</h2>
        <ul className="space-y-3" style={{ color: "#4b5563" }}>
          <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#0891B2" }} aria-hidden="true" /> <strong>Fraud-Proof</strong>: Each QR encodes a unique random token. Cloned codes are detected and rejected.</li>
          <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#0891B2" }} aria-hidden="true" /> <strong>Duplicate Detection</strong>: Once a code is scanned, it cannot be used again. Prevents re-entry fraud.</li>
          <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#0891B2" }} aria-hidden="true" /> <strong>Instant Validation</strong>: Scans are verified in real-time against the server. No offline sync needed.</li>
          <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#0891B2" }} aria-hidden="true" /> <strong>Printable & Digital</strong>: QR codes work both on phone screens and on printed paper.</li>
          <li className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#0891B2" }} aria-hidden="true" /> <strong>Live Check-in Logs</strong>: See exactly who has entered and at what time, updated in real-time.</li>
        </ul>

        <div className="mt-10 pt-8 border-t">
          <Link href="/create-event"><Button style={{ background: "#0891B2" }} className="h-12 px-8 text-base font-bold">CREATE EVENT</Button></Link>
        </div>
      </div>
    </FeatureLayout>
  );
}
