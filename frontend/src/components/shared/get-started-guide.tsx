"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const IconMap: Record<string, React.ReactNode> = {
  welcome: <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 15H7a4 4 0 0 0-4 4v2h14v-2a4 4 0 0 0-4-4h-4z"/><circle cx="12" cy="7" r="4"/></svg>,
  ways: <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7-10-7"/></svg>,
  next: <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/><path d="M12 6v6l4 2"/></svg>,
};

type Step = {
  title: string;
  icon: string;
  lead: string;
  points?: { label: string; text: string }[];
};

const steps: Step[] = [
  {
    title: "Welcome",
    icon: "welcome",
    lead: "Accredit Interactive runs your event from invitation to entry.",
  },
  {
    title: "Two ways to run an event",
    icon: "ways",
    lead: "Pick the one that fits you.",
    points: [
      { label: "Create Invite", text: "Private events: send personalised invitations by WhatsApp, SMS or email, then check guests in by QR." },
      { label: "Post Event", text: "Public events: list it, sell tickets, and issue a QR ticket to every buyer." },
    ],
  },
  {
    title: "Try it for free",
    icon: "next",
    lead: "Preview an invite or an event before you commit. You only need an account to send.",
  },
];

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

  const currentStep = steps[step - 1];
  const isLast = step === steps.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="bg-gradient-to-r from-[#1ABC9C] to-[#16A085] px-6 py-6 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center" style={{ color: "white" }}>
              {IconMap[currentStep.icon]}
            </div>
            <div>
              <h2 className="text-xl font-bold leading-tight">{currentStep.title}</h2>
              <p className="mt-0.5 text-xs text-white/80">Step {step} of {steps.length}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          <p className="text-base leading-relaxed text-gray-700">{currentStep.lead}</p>
          {currentStep.points && (
            <ul className="mt-4 space-y-3">
              {currentStep.points.map((p) => (
                <li key={p.label} className="rounded-lg border-l-4 border-[#1ABC9C] bg-teal-50/60 p-3">
                  <p className="text-sm font-semibold text-[#0D1B2A]">{p.label}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-gray-600">{p.text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="h-1 bg-gray-200">
          <div
            className="h-full bg-gradient-to-r from-[#1ABC9C] to-[#16A085] transition-all duration-300"
            style={{ width: `${(step / steps.length) * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-4 bg-[#f8f9fc] px-6 py-4">
          <button
            onClick={handleClose}
            className="text-sm font-semibold text-gray-600 transition-colors hover:text-[#0D1B2A]"
          >
            Skip
          </button>

          <div className="flex gap-2">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="rounded-lg border border-[#d9e2ec] px-5 py-2 font-semibold text-[#0D1B2A] transition-colors hover:bg-[#f0f0f0]"
              >
                Back
              </button>
            )}
            {!isLast ? (
              <button
                onClick={() => setStep(step + 1)}
                className="rounded-lg bg-[#1ABC9C] px-5 py-2 font-semibold text-white transition-colors hover:bg-[#16A085]"
              >
                Next
              </button>
            ) : (
              <Link
                href="/create-event"
                onClick={handleClose}
                className="inline-block rounded-lg bg-[#1ABC9C] px-5 py-2 font-semibold text-white transition-colors hover:bg-[#16A085]"
              >
                Get started
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
