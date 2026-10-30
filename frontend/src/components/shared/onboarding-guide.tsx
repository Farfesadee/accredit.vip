"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  PartyPopper,
  QrCode,
  Send,
  User,
  Users,
} from "lucide-react";

const STORAGE_KEY = "accredit_onboarding_done";

const stepIcons = {
  party: PartyPopper,
  user: User,
  calendar: CalendarDays,
  users: Users,
  send: Send,
  qr: QrCode,
  done: CheckCircle2,
};

// Kept deliberately short: six screens, one idea each. A first-time organizer
// needs to know what the dashboard does, not every field of every form.
const steps = [
  {
    icon: "party",
    title: "Welcome to Accredit Interactive",
    description: "Invitations, guest lists, tickets and QR entry in one dashboard.",
    detail: ["This is a one minute tour. You can leave it at any point and nothing is lost."],
  },
  {
    icon: "user",
    title: "Your account",
    description: "Sign up once, then every event you run lives in this dashboard.",
    detail: [
      "Register with your name, email and phone. Phone numbers use a country code picker you can search.",
      "Forgot your password? The reset link on the login page handles it.",
    ],
  },
  {
    icon: "calendar",
    title: "Create an event",
    description: "Two modes, chosen on the Create Event page.",
    detail: [
      "<strong>Create Invite:</strong> private events. Your guest list, your invitations, no public listing.",
      "<strong>Post Event:</strong> public events. Listed for anyone to find, with tickets you can sell.",
      "Add the date, time, venue, dress code and artwork. You can edit all of it later.",
    ],
  },
  {
    icon: "users",
    title: "Add your guests",
    description: "Type them in, or upload a spreadsheet.",
    detail: [
      "A guest needs a name plus an email address or a phone number. Rows that cannot be reached are reported back to you.",
      "You can search, filter by RSVP status, and edit or remove a guest at any time.",
      "Every guest gets their own RSVP link, and their own entry QR code.",
    ],
  },
  {
    icon: "send",
    title: "Send invitations",
    description: "Email, WhatsApp or SMS, straight from the event page.",
    detail: [
      "Each invite carries the guest's name and their personal link, so nobody gets somebody else's.",
      "Send to everyone or pick who goes first. Delivery status is logged for every send.",
      "Guests answer on the page the link opens. Their reply updates your dashboard immediately.",
    ],
  },
  {
    icon: "qr",
    title: "QR entry and results",
    description: "Scan guests in at the door and watch the numbers live.",
    detail: [
      "Open Accreditation and scan each code. A second scan of the same code is rejected, which is what makes the count trustworthy.",
      "The event page shows who accepted, who has been checked in, and who has not replied.",
      "When it is over, open the report for the full picture, or print it.",
    ],
  },
];

export function OnboardingGuide() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    // Only show the onboarding guide on dashboard pages, not on public marketing pages
    if (!pathname.startsWith("/dashboard")) return;
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      setShow(true);
    }
  }, [pathname]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
  };

  const next = () => {
    if (step < steps.length - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  };

  const prev = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  if (!show) return null;

  const s = steps[step];
  const Icon = stepIcons[s.icon as keyof typeof stepIcons] || PartyPopper;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-background rounded-2xl shadow-2xl overflow-hidden my-4">
        <div className="h-1.5 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>
        <div className="p-5 sm:p-7">
          <div className="text-center mb-2">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icon className="h-7 w-7" />
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-center mb-2">{s.title}</h2>
          <p className="text-sm text-muted-foreground text-center mb-4">{s.description}</p>
          <div className="rounded-lg bg-muted/50 p-4 text-sm leading-relaxed space-y-2">
            {s.detail.map((line, i) => (
              <p key={i} dangerouslySetInnerHTML={{ __html: line }} />
            ))}
          </div>
          <div className="flex items-center justify-center gap-1.5 mt-5 mb-4 flex-wrap">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === step ? "bg-primary w-4" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>
          <div className="flex gap-3">
            {step > 0 && (
              <button
                onClick={prev}
                className="flex-1 rounded-lg border border-input px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              className={`${step > 0 ? "flex-1" : "w-full"} rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-all`}
            >
              {step < steps.length - 1 ? "Next" : "Get Started"}
            </button>
          </div>
          <button
            onClick={dismiss}
            className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip tour
          </button>
        </div>
      </div>
    </div>
  );
}
