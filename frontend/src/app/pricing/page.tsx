"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/shared/navbar";
import { Footer } from "@/components/shared/footer";
import { Check } from "lucide-react";
import { apiClient } from "@/lib/api-client";

const defaultChannels = [  {
    id: "email",
    name: "Email",
    price: "₦100k",
    note: "Formal, branded delivery for 1-100 guests.",
    features: ["QR code included", "Invite preview", "RSVP tracking", "Delivery report", "Guest list upload"],
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    price: "₦200k",
    note: "Fast, familiar delivery for 1-100 guests.",
    features: ["QR code included", "Invite preview", "RSVP tracking", "Reminder-ready flow", "Delivery report"],
    highlight: true,
  },
  {
    id: "sms",
    name: "SMS",
    price: "₦300k",
    note: "Reliable delivery for 1-100 guests, even without internet.",
    features: ["QR code included", "Short invite message", "RSVP tracking", "Delivery report", "Guest list upload"],
  },
];

const faqs = [
  {
    q: "How do I sell tickets for my event?",
    a: "Post your event with the POST EVENT option, set your ticket price or packages, then share your event link. Buyers pay online and receive QR tickets instantly. Money lands in your wallet for withdrawal to your bank.",
  },
  {
    q: "How do guests receive their QR codes?",
    a: "Every guest and ticket buyer gets a unique QR code delivered by email (and WhatsApp where provided). Your team scans codes at the gate with the accreditation page for instant check-in.",
  },
  {
    q: "Which channels can I send invitations through?",
    a: "Email, WhatsApp, and SMS. Each channel price covers 1-100 guests and includes QR accreditation, RSVP tracking, and delivery reports.",
  },
  {
    q: "How and when do I get paid?",
    a: "Ticket revenue is credited to your Accredit Interactive wallet as sales complete. Add a bank account and withdraw anytime.",
  },
  {
    q: "Can I manage entry on the event day?",
    a: "Yes. The accreditation page verifies QR codes, checks guests in, flags duplicate scans, and lets you add walk-in guests on the spot: even from a phone at the gate.",
  },
];

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [channels, setChannels] = useState(defaultChannels);

  useEffect(() => {
    apiClient<{ settings: Record<string, any> }>("/settings/public")
      .then((res) => {
        const list = res.settings?.pricing_channels;
        if (Array.isArray(list) && list.length) setChannels(list);
      })
      .catch(() => {});
  }, []);
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar variant="light" />

      <main className="flex-1">
        <section className="bg-[#07182f] px-4 py-8 text-white sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#1ABC9C] text-center">
              Channel pricing
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
              <h1 className="text-2xl font-black leading-tight sm:text-3xl lg:text-4xl">
                Pay by invite channel, not by package.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-white/68">
                Each channel price covers 1-100 guests and includes the QR accreditation flow.
                Users can test CREATE INVITE or POST EVENT once before creating an account.
              </p>
            </div>
          </div>
        </section>

        <section className="px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-3">
            {channels.map((channel) => (
              <article
                key={channel.id}
                className="flex flex-col rounded-2xl border p-6 shadow-[0_12px_32px_rgba(15,23,42,0.08)]"
                style={{
                  background: channel.highlight ? "#101c2c" : "white",
                  borderColor: channel.highlight ? "rgba(26, 188, 156,0.55)" : "#e2e8f0",
                }}
              >
                {channel.highlight && (
                  <span className="mb-5 w-fit rounded-full bg-[#1ABC9C] px-3 py-1 text-xs font-bold uppercase tracking-widest text-white">
                    Popular
                  </span>
                )}
                <h2 className="text-2xl font-black" style={{ color: channel.highlight ? "white" : "#07182f" }}>
                  {channel.name}
                </h2>
                <p className="mt-2 text-sm leading-6" style={{ color: channel.highlight ? "rgba(255,255,255,0.66)" : "#64748b" }}>
                  {channel.note}
                </p>
                <div className="mt-7">
                  <span className="text-5xl font-black" style={{ color: channel.highlight ? "white" : "#07182f" }}>
                    {channel.price}
                  </span>
                  <span className="ml-2 text-sm" style={{ color: channel.highlight ? "rgba(255,255,255,0.48)" : "#94a3b8" }}>
                    / 1-100 guests
                  </span>
                </div>
                <ul className="mt-8 space-y-3 pb-4">
                  {channel.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm" style={{ color: channel.highlight ? "rgba(255,255,255,0.86)" : "#23466f" }}>
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#fff1f8] text-xs font-black text-[#1ABC9C]">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/create-event"
                  className={`mt-auto inline-flex h-12 items-center justify-center rounded-xl px-6 text-sm font-bold transition-all ${
                    channel.highlight
                      ? "bg-gradient-to-r from-[#1ABC9C] to-[#16A085] text-white"
                      : "bg-[#07182f] text-white hover:bg-[#1ABC9C]"
                  }`}
                >
                  Test this channel
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="px-4 pb-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-xl sm:text-2xl font-black text-[#0D1B2A] text-center">Frequently asked questions</h2>
            <div className="mt-6 space-y-3">
              {faqs.map((f, i) => (
                <div key={i} className="rounded-xl border border-[#e8edf2] bg-white overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
                    aria-expanded={openFaq === i}
                  >
                    <span className="text-sm font-bold text-[#0D1B2A]">{f.q}</span>
                    <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-black transition-colors ${openFaq === i ? "bg-[#1ABC9C] text-white" : "bg-[#f1f5f9] text-[#0D1B2A]"}`}>
                      {openFaq === i ? "−" : "+"}
                    </span>
                  </button>
                  {openFaq === i && (
                    <p className="px-5 pb-5 text-sm leading-relaxed text-[#475569]">{f.a}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
