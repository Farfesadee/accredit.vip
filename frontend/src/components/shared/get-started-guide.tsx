"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const IconMap: Record<string, React.ReactNode> = {
  welcome: <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 15H7a4 4 0 0 0-4 4v2h14v-2a4 4 0 0 0-4-4h-4z"/><circle cx="12" cy="7" r="4"/></svg>,
  invite: <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7-10-7"/></svg>,
  discover: <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="m16 12-4-4-4 4"/><path d="m12 10v8"/></svg>,
  post: <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>,
  next: <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/><path d="M12 6v6l4 2"/></svg>,
};

export function GetStartedGuide() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    const hasSeenGuide = localStorage.getItem("accredit_seen_guide");
    if (!hasSeenGuide) {
      const timer = setTimeout(() => setIsOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem("accredit_seen_guide", "true");
    setIsOpen(false);
  };

  if (!isOpen) return null;

  const steps = [
    {
      title: "Welcome to Accredit Interactive",
      icon: "welcome",
      content: (
        <div className="space-y-4">
          <p className="text-lg text-gray-700">
            Welcome! We're the premium event infrastructure platform for Africa. Whether you're planning a wedding, concert, conference, or gathering: we've got you covered.
          </p>
          <p className="text-gray-600">
            Let's walk you through what you can do in just a few minutes. Ready? Click Next to begin!
          </p>
        </div>
      ),
    },
    {
      title: "CREATE INVITE - Test First",
      icon: "invite",
      content: (
        <div className="space-y-4">
          <p className="text-gray-700">
            <strong>Want to send invitations?</strong> Start here. You can:
          </p>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-start gap-3">
              <span className="text-[#1ABC9C] font-bold">→</span>
              <span><strong>Design beautiful invitation flyers</strong> that guests see at a glance on their phones</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[#1ABC9C] font-bold">→</span>
              <span><strong>TEST for free</strong>: send yourself a preview invitation to see exactly how it looks</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[#1ABC9C] font-bold">→</span>
              <span><strong>Send via Email, WhatsApp, or SMS</strong>: pick your channels and send real invites</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[#1ABC9C] font-bold">→</span>
              <span><strong>Attach QR codes</strong> for seamless check-in at your event</span>
            </li>
          </ul>
          <p className="text-sm text-[#1ABC9C] font-semibold mt-4">Go to CREATE EVENT to get started with testing!</p>
        </div>
      ),
    },
    {
      title: "DISCOVER EVENTS - Find & Buy Tickets",
      icon: "discover",
      content: (
        <div className="space-y-4">
          <p className="text-gray-700">
            <strong>Looking for events?</strong> Browse and buy tickets here. You'll find:
          </p>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-start gap-3">
              <span className="text-purple-600 font-bold">→</span>
              <span><strong>Concerts, conferences, festivals, weddings</strong>: and more events across Africa</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-purple-600 font-bold">→</span>
              <span><strong>Beautiful event flyers</strong> showing all the details you need</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-purple-600 font-bold">→</span>
              <span><strong>Instant ticket purchase</strong> with secure payment (we charge a small 5% platform fee)</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-purple-600 font-bold">→</span>
              <span><strong>Filters & search</strong> to find events by category, price, date, and location</span>
            </li>
          </ul>
          <p className="text-sm text-purple-600 font-semibold mt-4">Go to DISCOVER EVENTS (or ATTEND) to browse!</p>
        </div>
      ),
    },
    {
      title: "POST EVENT - Go Public",
      icon: "post",
      content: (
        <div className="space-y-4">
          <p className="text-gray-700">
            <strong>Ready to reach thousands?</strong> Create a public event listing. You can:
          </p>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-start gap-3">
              <span className="text-cyan-600 font-bold">→</span>
              <span><strong>Upload a professional event flyer</strong> (or AI generate one for you)</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-cyan-600 font-bold">→</span>
              <span><strong>Set ticket prices & limits</strong>: control how many tickets are available</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-cyan-600 font-bold">→</span>
              <span><strong>TEST before posting</strong>: see exactly how your event looks on Discover Events</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-cyan-600 font-bold">→</span>
              <span><strong>Get ticket sales instantly</strong>: watch as guests buy tickets in real-time</span>
            </li>
          </ul>
          <p className="text-sm text-cyan-600 font-semibold mt-4">Create an account to start posting events!</p>
        </div>
      ),
    },
    {
      title: "Your Next Steps",
      icon: "next",
      content: (
        <div className="space-y-4">
          <p className="text-lg text-gray-700 font-semibold">
            Here's how to get started:
          </p>
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-teal-50 border-l-4 border-[#1ABC9C]">
              <p className="font-semibold text-[#1ABC9C]">Step 1: Try Testing (Free!)</p>
              <p className="text-sm text-gray-600 mt-1">
                Click "CREATE EVENT" and try testing an invite or event without creating an account. See how beautiful everything looks!
              </p>
            </div>
            <div className="p-4 rounded-lg bg-purple-50 border-l-4 border-purple-600">
              <p className="font-semibold text-purple-600">Step 2: Browse & Buy Tickets</p>
              <p className="text-sm text-gray-600 mt-1">
                Go to "Discover Events" and explore public events. If you find something you like, buy a ticket!
              </p>
            </div>
            <div className="p-4 rounded-lg bg-cyan-50 border-l-4 border-cyan-600">
              <p className="font-semibold text-cyan-600">Step 3: Create an Account</p>
              <p className="text-sm text-gray-600 mt-1">
                Ready to send real invites or post events? Sign up and unlock the full power of Accredit Interactive. Your account is completely free.
              </p>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const currentStep = steps[step - 1];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="rounded-2xl bg-white max-w-2xl w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1ABC9C] to-[#d0147a] px-6 py-8 text-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 flex items-center justify-center" style={{ color: "white" }}>
              {IconMap[currentStep.icon] || <span className="text-3xl">{currentStep.icon}</span>}
            </div>
            <div>
              <h2 className="text-3xl font-bold">{currentStep.title}</h2>
              <p className="text-white/80 text-sm mt-1">Step {step} of {steps.length}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-8 max-h-[60vh] overflow-y-auto">
          {currentStep.content}
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-gray-200">
          <div
            className="h-full bg-gradient-to-r from-[#1ABC9C] to-[#d0147a] transition-all duration-300"
            style={{ width: `${(step / steps.length) * 100}%` }}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-6 bg-[#f8f9fc] flex items-center justify-between gap-4">
          <button
            onClick={handleClose}
            className="text-sm font-semibold text-gray-600 hover:text-[#0D1B2A] transition-colors"
          >
            Skip Guide
          </button>

          <div className="flex gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-6 py-2 rounded-lg border border-[#d9e2ec] text-[#0D1B2A] font-semibold hover:bg-[#f0f0f0] transition-colors"
              >
                Back
              </button>
            )}
            {step < steps.length ? (
              <button
                onClick={() => setStep(step + 1)}
                className="px-6 py-2 rounded-lg bg-[#1ABC9C] text-white font-semibold hover:bg-[#d0147a] transition-colors"
              >
                Next
              </button>
            ) : (
              <Link
                href="/create-event"
                onClick={handleClose}
                className="px-6 py-2 rounded-lg bg-[#1ABC9C] text-white font-semibold hover:bg-[#d0147a] transition-colors inline-block"
              >
                Start Testing →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
