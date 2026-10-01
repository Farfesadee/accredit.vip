"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  Camera,
  CheckCircle2,
  Lock,
  MessageCircle,
  Palette,
  PartyPopper,
  Phone,
  Rocket,
  ShieldCheck,
  Ticket,
  User,
  UserPlus,
  Users,
  Wrench,
  Send,
} from "lucide-react";

const STORAGE_KEY = "accredit_onboarding_done";

const stepIcons = {
  party: PartyPopper,
  shield: ShieldCheck,
  user: User,
  calendar: CalendarDays,
  note: UserPlus,
  users: Users,
  send: Send,
  check: CheckCircle2,
  ticket: Ticket,
  camera: Camera,
  palette: Palette,
  chart: BarChart3,
  tools: Wrench,
  chat: MessageCircle,
  phone: Phone,
  lock: Lock,
  rocket: Rocket,
};

const steps = [
  {
    icon: "party",
    title: "Welcome to Accredit Interactive",
    description:
      "The premium event infrastructure platform for Africa. Create private or public events, manage guests, send multi-channel invitations, sell tickets, generate QR codes, and track attendance: all from one dashboard.",
    detail: [
      "This quick tour will walk you through every feature so you can get started in minutes.",
      "You can skip this tutorial anytime and come back later by clearing your browser data.",
    ],
  },
  {
    icon: "shield",
    title: "1. Create Your Account",
    description:
      "Sign up with your name, email, phone, and choose how you'd like to verify your identity.",
    detail: [
      'Go to the <Link href="/register" className="text-primary underline underline-offset-2">Register</Link> page to create your account.',
      "Enter your First Name & Last Name: these will appear on your profile and event host info.",
      "Add your phone number with country code (the country flag and code dropdown helps you pick).",
      "Choose your verification channel: Email, SMS, or WhatsApp. A verification link will be sent there.",
      "After clicking the verification link, your account is fully activated.",
      "Your dashboard becomes available immediately after login.",
    ],
  },
  {
    icon: "user",
    title: "2. Your Profile & Dashboard",
    description:
      "Your dashboard is the command center for everything: events, guests, invites, tickets, and more.",
    detail: [
      "Once logged in, you land on your Dashboard which lists all your events.",
      'Use the search bar and category filter to quickly find specific events.',
      "Click any event card to open its full management page with guests, QR codes, invites, and fliers.",
      "Your name and role appear at the top: if you need admin access, contact support.",
      "The sidebar/nav gives you quick access to Dashboard, Discover Events, and your Profile.",
    ],
  },
  {
    icon: "calendar",
    title: "3. Creating Events: Two Modes",
    description:
      "Accredit Interactive supports two distinct event modes depending on your needs.",
    detail: [
      "<strong>Post Invite</strong>: For private events (weddings, birthdays, corporate dinners, VIP gatherings). The guest list is controlled by you; no public listing. Includes QR code accreditation and multi-channel invites.",
      "<strong>Post Event</strong>: For public events (concerts, conferences, festivals). Listed on the Discover page for anyone to find. You can sell tickets with Paystack integration and issue digital QR tickets.",
      'Click "Create Event" to get started: choose your mode, fill in the details, and publish.',
      "Each event gets a dedicated page with date, time, timezone, venue, host info, dress code, and description.",
      "You can always edit or delete events from your dashboard.",
    ],
  },
  {
    icon: "note",
    title: "4. Event Details Form",
    description:
      "The creation form is split into clear sections so nothing gets missed.",
    detail: [
      "<strong>Basic Info:</strong> Title, event type (wedding, concert, conference, etc.), host name.",
      "<strong>Date & Time:</strong> Pick a date, then select time from a dropdown with 30-minute intervals. Choose your timezone from the comprehensive list covering all major regions.",
      "<strong>Venue:</strong> Venue name/address plus an optional Google Maps link so guests can navigate.",
      "<strong>Optional:</strong> Dress code, description, cover image, and fliers for branding.",
      "<strong>Ticket (Post Event only):</strong> Set price and available quantity for paid events.",
      "Once created, you're taken directly to the event management page.",
    ],
  },
  {
    icon: "users",
    title: "5. Managing Guests",
    description:
      "Add guests individually or import in bulk. Each guest automatically gets a unique RSVP token and QR code.",
    detail: [
      "<strong>Manual entry:</strong> Add name, phone, and email one at a time using the Add Guest form.",
      "<strong>CSV import:</strong> Upload a CSV file with columns: name, phone, email. Bulk import many guests at once.",
      "<strong>Search & filter:</strong> Find guests by name, email, or phone; filter by RSVP status (Pending / Accepted / Declined / Maybe).",
      "<strong>Inline edit & delete:</strong> Click on any guest row to update their details, or delete them entirely.",
      "<strong>QR codes:</strong> Each guest gets a unique QR code that can be scanned at the door for check-in.",
      "Guests are unique per event: each event has its own independent guest list.",
    ],
  },
  {
    icon: "send",
    title: "6. Sending Invitations",
    description:
      "Send invitations via Email, WhatsApp, or SMS directly from the event dashboard.",
    detail: [
      "Choose your channel: <strong>Email</strong> (via Resend), <strong>WhatsApp</strong> (via Twilio), or <strong>SMS</strong> (via Termii or Africa's Talking).",
      "Each invite is personalized with the guest's name and a unique RSVP link.",
      "You can select which guests to invite (all or specific ones).",
      "Use the <strong>Test Send</strong> button first to preview what guests will receive.",
      "Delivery logs show send status for each batch: see who received their invite and who didn't.",
      "Note: WhatsApp and SMS require API keys to work beyond mock/console mode.",
    ],
  },
  {
    icon: "check",
    title: "7. RSVP Tracking",
    description:
      "Monitor guest responses in real-time as they accept, decline, or mark maybe.",
    detail: [
      "Guests click the unique RSVP link in their invite message to respond.",
      "They see full event details: date, time, timezone, venue, dress code, and description.",
      "Three response options: <strong>Yes, I'll be there</strong> / <strong>Maybe</strong> / <strong>Sorry, can't make it</strong>.",
      "RSVP stats on your dashboard show: Total Invited / Accepted / Declined / Pending / Maybe.",
      "Duplicate responses are automatically blocked: each token works once.",
      "No login required for guests: the token-based system keeps it simple.",
    ],
  },
  {
    icon: "ticket",
    title: "8. Ticketing & Payments",
    description:
      "Set a ticket price and sell directly through the platform with Paystack payment processing.",
    detail: [
      "Only available in <strong>Post Event</strong> mode.",
      "Set a ticket price (in the currency of your choice) and the number of available tickets.",
      "Buyers visit the public event page and complete a checkout form (name, email, phone).",
      "Payment is processed through <strong>Paystack</strong>: cards, USSD, bank transfer, and mobile money.",
      "After successful payment, the buyer receives a <strong>digital ticket receipt</strong> with a QR code.",
      "The ticket page also includes a print option and a link to the event page.",
      "You can see all <strong>ticket buyers</strong> listed in your event dashboard under 'Ticket Buyers'.",
    ],
  },
  {
    icon: "camera",
    title: "9. QR Codes & Door Verification",
    description:
      "Generate QR codes for each guest and scan at the event entrance for fast, secure check-in.",
    detail: [
      "<strong>Guest QR:</strong> Click the QR button next to any guest to generate their unique QR code image.",
      "<strong>Ticket QR:</strong> Ticket buyers automatically get a QR embedded in their receipt (no extra step).",
      "<strong>Verify at door:</strong> Use the QR verify endpoint/scan to validate a guest's code at check-in.",
      "<strong>Scan once:</strong> The system marks the guest as checked in and rejects any duplicate scans.",
      "<strong>QR format:</strong> ACC:{event_id}:{reference}:{buyer_email}: parse this with your scanner.",
      "Check-in status is visible on the guest list in your dashboard.",
    ],
  },
  {
    icon: "palette",
    title: "10. Event Branding & Promotion",
    description:
      "Customize your event with images, branding, and make it discoverable to the public.",
    detail: [
      "<strong>Cover Image:</strong> Upload a featured image that appears on the event page, RSVP page, and ticket page.",
      "<strong>Fliers:</strong> Upload multiple flier variants (e.g., square, portrait, story) for your event.",
      "All images are stored on the server and served via the /uploads endpoint.",
      "<strong>Public Discovery:</strong> Public events appear on the Discover page with search, category, and date filters.",
      "<strong>Categories:</strong> Tag your event (concert, conference, festival, party, networking, etc.) for filtering.",
      "Search by title, venue, category, or date range to help people find your event.",
    ],
  },
  {
    icon: "chart",
    title: "11. Dashboard Analytics & Stats",
    description:
      "See all your event metrics at a glance: guest counts, RSVPs, revenue, and more.",
    detail: [
      "The event detail page shows: total guests, RSVP breakdown, checked-in count, and pending invites.",
      "Ticket buyers section shows who purchased, how much they paid, and their check-in status.",
      "Delivery logs show invite delivery success/failure per channel.",
      "Revenue tracking shows total sales from ticket purchases.",
      "Export your event data anytime for records or analysis.",
    ],
  },
  {
    icon: "tools",
    title: "12. Post-Event Management",
    description:
      "After the event, you still have access to all data and can manage follow-ups.",
    detail: [
      "Event status (draft/published/completed) helps you organize past and upcoming events.",
      "You can still generate QR codes, resend invites, and check attendance after the event date.",
      "Download or export guest lists for your records (coming soon).",
      "Edit event details even after publishing: change date, time, venue, or description.",
      "Delete events if you no longer need them.",
    ],
  },
  {
    icon: "chat",
    title: "13. AI Assistant",
    description:
      "Get instant help from the built-in AI assistant: no need to search for answers.",
    detail: [
      'Click the chat bubble icon in the bottom-right corner of any page to open the AI assistant.',
      "The bubble is draggable: click and drag to reposition it anywhere on screen.",
      "Type your question about creating events, managing guests, sending invites, QR codes, or anything else.",
      "The assistant provides immediate FAQ-based answers (no external API needed, fully local).",
      'Hover over the icon to see the tooltip: "Need help? Ask me anything!"',
    ],
  },
  {
    icon: "phone",
    title: "14. Support & Contact",
    description:
      "Reach out to the Accredit Interactive team if you need further assistance or have questions.",
    detail: [
      'Use the <Link href="/contact" className="text-primary underline underline-offset-2">Contact page</Link> to send a message to the support team: include your name, email, subject, and message.',
      'Check the <Link href="/pricing" className="text-primary underline underline-offset-2">Pricing page</Link> for Email, WhatsApp, and SMS channel pricing.',
      "For urgent issues, reach out via the support channels listed on the contact page.",
      'If you have admin access, the admin dashboard provides system-wide stats and management tools.',
    ],
  },
  {
    icon: "lock",
    title: "15. Keeping Your Account Safe",
    description:
      "Best practices to protect your account and data.",
    detail: [
      "<strong>Choose a strong password:</strong> Use a mix of uppercase, lowercase, numbers, and symbols.",
      "<strong>Verify your account:</strong> Confirm your email, SMS, or WhatsApp when you sign up.",
      "<strong>Forgot your password?</strong> Use the 'Forgot Password' link to reset securely.",
      "<strong>Keep your details updated:</strong> Update your profile information in the Profile section anytime.",
      "<strong>Logout when done:</strong> Always logout when using public or shared computers.",
      "<strong>Need help?</strong> Contact support via the Contact page if you notice any suspicious activity.",
    ],
  },
  {
    icon: "rocket",
    title: "16. You're Ready!",
    description:
      "You've learned all the key features. Here's a quick recap of what to do next.",
    detail: [
      "<strong>Step 1:</strong> Create your account and verify via your preferred channel.",
      "<strong>Step 2:</strong> Create your first event (Post Invite or Post Event).",
      "<strong>Step 3:</strong> Add guests manually or via CSV upload.",
      "<strong>Step 4:</strong> Send invitations via email, SMS, or WhatsApp.",
      "<strong>Step 5:</strong> Track RSVPs, sell tickets, and manage check-ins.",
      "<strong>Step 6:</strong> Use QR codes for door verification.",
      "<strong>Step 7:</strong> Check your stats and wrap up post-event.",
      "Need help? Use the AI assistant or contact us. Good luck with your events!",
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

  const goToStep = (i: number) => {
    setStep(i);
  };

  if (!show) return null;

  const s = steps[step];
  const Icon = stepIcons[s.icon as keyof typeof stepIcons] || PartyPopper;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-background rounded-2xl shadow-2xl overflow-hidden my-4">
        <div className="h-1.5 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>
        <div className="p-5 sm:p-8">
          <div className="text-center mb-2">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icon className="h-8 w-8" />
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-center mb-2">{s.title}</h2>
          <p className="text-sm text-muted-foreground text-center mb-4">{s.description}</p>
          <div className="rounded-lg bg-muted/50 p-4 text-sm leading-relaxed space-y-1.5">
            {s.detail.map((line, i) => (
              <p key={i} dangerouslySetInnerHTML={{ __html: line }} />
            ))}
          </div>
          <div className="flex items-center justify-center gap-1.5 mt-6 mb-5 flex-wrap">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => goToStep(i)}
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
            className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip tutorial
          </button>
        </div>
      </div>
    </div>
  );
}
