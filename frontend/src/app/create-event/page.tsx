"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, MapPin, Calendar } from "lucide-react";
import { Navbar } from "@/components/shared/navbar";
import { Footer } from "@/components/shared/footer";
import { apiClient } from "@/lib/api-client";
import { generateFlier } from "@/lib/api/ai";
import { TrialStore } from "@/lib/trial-store";
import { CURRENCIES, getCurrencySymbol } from "@/lib/event-form-options";
import { formatCurrencyAmount } from "@/lib/currencies";
import { VenueInput } from "@/components/shared/venue-input";
import { QRPreview } from "@/components/qr-preview";
import Tesseract from "tesseract.js";

const DRAFT_KEY = "accredit_event_draft";
const DRAFT_KEYS: Record<string, string> = { invite: "accredit_draft_invite", event: "accredit_draft_event" };

const DEFAULT_FORM = {
  title: "",
  host_name: "",
  event_type: "wedding",
  category: "concert",
  event_date: "",
  event_time: "",
  details_to_be_communicated: false,
  timezone: "Africa/Lagos|WAT",
  venue: "",
  after_party_enabled: false,
  after_party_location: "",
  after_party_time: "",
  guest_range: "1 - 100",
  delivery_channels: [] as Channel[],
  qr_delivery: "with_qr" as QrDeliveryOption,
  qr_later_title: "",
  qr_later_message: "",
  qr_later_media_source: "upload" as "upload" | "ai",
  qr_later_image_name: "",
  qr_later_image_prompt: "",
  male_dress_code: "",
  female_dress_code: "",
  gate_fee: "",
  currency: CURRENCIES[0]?.code || "NGN",
  headliners: "",
  social_platform: "instagram" as SocialPlatform,
  social_handle: "",
  media_source: "upload" as "upload" | "ai",
  uploaded_image_name: "",
  image_prompt: "",
  custom_category: "",
  custom_event_type: "",
  generated_image_ready: false,
  generated_image_url: "",
  description: "",
  qr_message: "",
  invite_template: "elegant" as InviteTemplate | null,
};

type Mode = "invite" | "event";
type Channel = "email" | "whatsapp" | "sms";
type QrDeliveryOption = "with_qr" | "without_qr" | "qr_later";
type SocialPlatform = "instagram" | "x" | "facebook" | "tiktok" | "linkedin" | "website" | "other";
type InviteTemplate = "elegant" | "bold" | "minimal" | "vibrant" | "corporate";
type SocialHandle = { platform: SocialPlatform; handle: string };
type PassPackage = { name: string; price: string };
type LineupPerson = {
  role: string;
  name: string;
  attachHeadshot: boolean;
  headshotSource: "upload" | "ai";
  headshotFileName: string;
  generatedHeadshot: boolean;
};

const pricing: Record<Channel, number> = {
  email: 100000,
  whatsapp: 200000,
  sms: 300000,
};

const channelLabels: Record<Channel, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  sms: "SMS",
};

const qrDeliveryOptions: Array<{ value: QrDeliveryOption; label: string; description: string }> = [
  {
    value: "with_qr",
    label: "With QR code",
    description: "Send the flyer-style invitation and a unique animated accreditation QR code together.",
  },
  {
    value: "without_qr",
    label: "Without QR code",
    description: "Send only the invitation message and design.",
  },
  {
    value: "qr_later",
    label: "With QR code, but later",
    description: "Send the invite now, then optionally return later to send unique animated QR accreditation details.",
  },
];

const socialPlatforms: Array<{ value: SocialPlatform; label: string; placeholder: string }> = [
  { value: "instagram", label: "Instagram", placeholder: "@yourbrand" },
  { value: "x", label: "X / Twitter", placeholder: "@yourbrand" },
  { value: "facebook", label: "Facebook", placeholder: "facebook.com/yourpage" },
  { value: "tiktok", label: "TikTok", placeholder: "@yourbrand" },
  { value: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/company/yourbrand" },
  { value: "website", label: "Website", placeholder: "https://yourwebsite.com" },
  { value: "other", label: "Other", placeholder: "Handle or link" },
];

const inviteTemplates: Array<{
  value: InviteTemplate | null;
  label: string;
  description: string;
  bestFor: string;
  icon: (props: any) => React.ReactNode
}> = [
  {
    value: null,
    label: "Use My Own",
    description: "No template - use your custom design",
    bestFor: "Custom, branded invitations",
    icon: ({ className }: any) => (
      <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    value: "elegant",
    label: "Elegant",
    description: "Classic, sophisticated, timeless",
    bestFor: "Weddings, formal galas, upscale events",
    icon: ({ className }: any) => (
      <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2.293-2.293a1 1 0 00-1.414 0L10 12.586 5.707 8.293a1 1 0 00-1.414 0L2 10.586V19a2 2 0 002 2h16a2 2 0 002-2V7z" />
      </svg>
    ),
  },
  {
    value: "bold",
    label: "Bold",
    description: "Vibrant, energetic, eye-catching",
    bestFor: "Concerts, festivals, nightlife, parties",
    icon: ({ className }: any) => (
      <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    value: "minimal",
    label: "Minimal",
    description: "Clean, simple, plenty of breathing room",
    bestFor: "Corporate events, conferences, seminars",
    icon: ({ className }: any) => (
      <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
      </svg>
    ),
  },
  {
    value: "vibrant",
    label: "Vibrant",
    description: "Fun, colorful, playful, modern",
    bestFor: "Birthdays, celebrations, social events",
    icon: ({ className }: any) => (
      <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
  },
  {
    value: "corporate",
    label: "Corporate",
    description: "Professional, business-ready",
    bestFor: "Business meetings, professional events",
    icon: ({ className }: any) => (
      <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5.217m0 0a9.01 9.01 0 00-5.566 0m5.566 0A8.973 8.973 0 0019 21m0 0h2" />
      </svg>
    ),
  },
];



const guestRanges = [
  { label: "1 - 100", min: 1, max: 100, units: 1 },
  { label: "100 - 200", min: 100, max: 200, units: 2 },
  { label: "200 - 300", min: 200, max: 300, units: 3 },
  { label: "300 - 400", min: 300, max: 400, units: 4 },
  { label: "400 - 500", min: 400, max: 500, units: 5 },
  { label: "500 - 1000", min: 500, max: 1000, units: 10 },
];

const timeSlots = Array.from({ length: 48 }, (_, index) => {
  const hour24 = Math.floor(index / 2);
  const minutes = index % 2 === 0 ? "00" : "30";
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${minutes} ${period}`;
});

const timezoneOptions = [
  { value: "Africa/Lagos|WAT", label: "NG Lagos, Nigeria (WAT)" },
  { value: "Africa/Accra|GMT", label: "GH Accra, Ghana (GMT)" },
  { value: "Africa/Nairobi|EAT", label: "KE Nairobi, Kenya (EAT)" },
  { value: "Africa/Johannesburg|SAST", label: "ZA Johannesburg, South Africa (SAST)" },
  { value: "Europe/London|GMT/BST", label: "GB London, United Kingdom (GMT/BST)" },
  { value: "Europe/Paris|CET", label: "FR Paris, France (CET)" },
  { value: "America/New_York|ET", label: "US New York, United States (ET)" },
  { value: "America/Los_Angeles|PT", label: "US Los Angeles, United States (PT)" },
  { value: "Asia/Dubai|GST", label: "AE Dubai, UAE (GST)" },
];

function getTrialFingerprint() {
  const key = "accredit_trial_fingerprint";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(key, generated);
  return generated;
}

function toggleChannel(channels: Channel[], channel: Channel) {
  return channels.includes(channel)
    ? channels.filter((item) => item !== channel)
    : [...channels, channel];
}

function TimeDropdown({ value, onChange, disabled, id }: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  id: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-11 w-full rounded-xl border border-[#d9e2ec] px-3 pr-11 text-sm outline-none focus:border-[#1ABC9C] disabled:bg-[#f8fafc] disabled:text-[#94a3b8]"
        placeholder={disabled ? "To be communicated" : "Select or type time"}
        required={!disabled}
      />
      {!disabled && (
        <>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-[#23466f] hover:bg-[#f8fafc]"
            aria-label="Open time options"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          {open && (
            <div className="absolute z-50 mt-1 max-h-44 w-full overflow-y-auto rounded-xl border border-[#d9e2ec] bg-white shadow-lg">
              {timeSlots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); onChange(slot); setOpen(false); }}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-[#f8fafc] ${value === slot ? "font-bold text-[#1ABC9C]" : "text-[#23466f]"}`}
                >
                  {slot}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SelectDropdown({ children, value, onChange, className, disabled, required }: {
  children: React.ReactNode;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        className={`${className || ""} appearance-none`}
        style={{ WebkitAppearance: "none", MozAppearance: "none" }}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
    </div>
  );
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatDisplayDate(isoDate: string): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return "";
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const monthName = MONTHS[date.getMonth()];
  const ordinal = d % 10 === 1 && d !== 11 ? "st" : d % 10 === 2 && d !== 12 ? "nd" : d % 10 === 3 && d !== 13 ? "rd" : "th";
  return `${weekday} ${d}${ordinal} ${monthName}, ${y}`;
}

function parseDateParts(isoDate: string) {
  if (!isoDate) return { day: "", month: "", year: "" };
  const [y, m, d] = isoDate.split("-");
  return { day: d || "", month: m || "", year: y || "" };
}


function dataUriToBlob(dataUri: string): Blob {
  const [meta, base64] = dataUri.split(",");
  const mime = meta?.match(/:(.*?);/)?.[1] || "image/png";
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function resizeImage(file: File, maxW: number, maxH: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width <= maxW && height <= maxH) {
        resolve(file);
        return;
      }
      const ratio = Math.min(maxW / width, maxH / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else resolve(file);
      }, file.type);
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

const templateStyles: Record<string, { headerBg: string; bodyBg: string; fontClass: string; accent: string; textColor: string }> = {
  elegant: { headerBg: "linear-gradient(135deg,#F5F0E8,#E8D9A0)", bodyBg: "#FDFAF3", fontClass: "font-serif", accent: "#B8860B", textColor: "#2d2416" },
  bold: { headerBg: "#000", bodyBg: "#111", fontClass: "font-sans font-black", accent: "#ef4444", textColor: "#ffffff" },
  minimal: { headerBg: "#f5f5f5", bodyBg: "#fff", fontClass: "font-light", accent: "#6b7280", textColor: "#333333" },
  vibrant: { headerBg: "linear-gradient(135deg,#7C3AED,#EC4899)", bodyBg: "#fdf4ff", fontClass: "font-sans", accent: "#7C3AED", textColor: "#ffffff" },
  corporate: { headerBg: "#0D1B2A", bodyBg: "#fff", fontClass: "font-sans", accent: "#0D1B2A", textColor: "#ffffff" },
};



export default function CreateEventPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const [step, setStep] = useState(0);
  const [formPage, setFormPage] = useState(0);
  const totalFormPages = 2;
  const [fingerprint, setFingerprint] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [usedTrials, setUsedTrials] = useState<Record<Mode, boolean>>({ invite: false, event: false });
  const [submitting, setSubmitting] = useState(false);
  const [aiImageGenerating, setAiImageGenerating] = useState(false);
  const [uploadedImagePreviewUrl, setUploadedImagePreviewUrl] = useState<string | null>(null);
  const [uploadedImageData, setUploadedImageData] = useState<string | null>(null);
  const [locationData, setLocationData] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [trialComplete, setTrialComplete] = useState(false);
  const [trialEventId, setTrialEventId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [qrValue, setQrValue] = useState("");
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [passPackages, setPassPackages] = useState<PassPackage[]>([
    { name: "Regular", price: "" },
  ]);
  const [socialHandles, setSocialHandles] = useState<SocialHandle[]>([
    { platform: "instagram", handle: "" },
  ]);
  const [lineup, setLineup] = useState<LineupPerson[]>([
    {
      role: "",
      name: "",
      attachHeadshot: true,
      headshotSource: "upload",
      headshotFileName: "",
      generatedHeadshot: false,
    },
  ]);
  // Date picker parts: tracked independently so partial selections aren't lost
  const [dayPart, setDayPart] = useState("");
  const [monthPart, setMonthPart] = useState("");
  const [yearPart, setYearPart] = useState("");

  // Controlled open state for collapsible details
  const [inviteTemplateOpen, setInviteTemplateOpen] = useState(false);
  const [qrDetailsOpen, setQrDetailsOpen] = useState(false);
  // AI generation errors
  const [aiImageError, setAiImageError] = useState("");

  // Flier upload / parse state
  const [flierParsing, setFlierParsing] = useState(false);
  const [flierPreview, setFlierPreview] = useState<string | null>(null);
  const [flierParsed, setFlierParsed] = useState(false);
  const [flierParseError, setFlierParseError] = useState("");

  // Email input modal for test invites
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testPhone, setTestPhone] = useState("");

  // Event preview modal for test events
  const [eventPreviewUrl, setEventPreviewUrl] = useState<string | null>(null);

  // Invitation flyer preview modal
  const [inviteFlyer, setInviteFlyer] = useState<string | null>(null);

  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const autoResize = useCallback(() => {
    const el = descriptionRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFingerprint(getTrialFingerprint());
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Restore trial success state from sessionStorage on mount (survives reload)
  useEffect(() => {
    const saved = sessionStorage.getItem("accredit_trial_success");
    if (!saved) return;
    try {
      const s = JSON.parse(saved);
      if (!s.trialComplete) return;
      setTrialComplete(true);
      setTrialEventId(s.trialEventId);
      if (s.flierUrl) setEventPreviewUrl(s.flierUrl);
      if (s.flyerUrl) setInviteFlyer(s.flyerUrl);
      if (s.mode === "event" && s.flierUrl) {
        setMessage("Event flier preview generated! Here's what your event will look like on Discover Events:");
      } else if (s.mode === "invite" && s.sentTo) {
        const via = s.sentVia ? ` via ${s.sentVia}` : "";
        setMessage(s.flyerUrl
          ? `Test invitation flyer sent to ${s.sentTo}${via}. Here's the beautiful invitation your guests will see:`
          : `Test invite sent to ${s.sentTo}${via}. Check your messages to see the invitation flyer. Create an account to send real invites to your guest list.`);
      } else {
        setMessage(s.mode === "event"
          ? "Event preview ready. Create an account to publish to Discover Events."
          : "Invite preview sent. Create an account to send to your full guest list.");
      }
    } catch { /* ignore */ }
  }, []);

  // Restore draft from localStorage on mount
  useEffect(() => {
    const lastMode = localStorage.getItem("accredit_last_mode") as Mode | null;
    if (!lastMode) return;
    const saved = localStorage.getItem(DRAFT_KEYS[lastMode]);
    if (!saved) return;
    try {
      const draft = JSON.parse(saved);
      if (draft && draft.form) {
        setMode(lastMode);
        setForm(draft.form || DEFAULT_FORM);
        setPassPackages(draft.passPackages || [{ name: "Regular", price: "" }]);
        setSocialHandles(draft.socialHandles || [{ platform: "instagram", handle: "" }]);
        setLineup(draft.lineup || [{ role: "", name: "", attachHeadshot: true, headshotSource: "upload", headshotFileName: "", generatedHeadshot: false }]);
        if (draft.uploadedImageData) {
          setUploadedImageData(draft.uploadedImageData);
          setUploadedImagePreviewUrl(draft.uploadedImageData);
          setFlierPreview(draft.uploadedImageData);
        }
        if (draft.flierParsed) setFlierParsed(true);
        const lastStep = localStorage.getItem("accredit_create_step");
        if (lastStep) setStep(parseInt(lastStep, 10)); else setStep(1);
        const lastFormPage = localStorage.getItem("accredit_create_formPage");
        if (lastFormPage) setFormPage(parseInt(lastFormPage, 10));
      }
    } catch {
      localStorage.removeItem(DRAFT_KEYS[lastMode]);
    }
  }, []);

  const saveDraft = useCallback((overrideForm?: typeof DEFAULT_FORM, overrideMode?: Mode) => {
    const m = overrideMode ?? mode;
    if (!m) return;
    const data = {
      form: overrideForm || form,
      passPackages,
      socialHandles,
      lineup,
      flierParsed,
      uploadedImageData,
    };
    try {
      localStorage.setItem(DRAFT_KEYS[m], JSON.stringify(data));
    } catch {
      // Quota exceeded: retry without bulky image data
      try {
        localStorage.setItem(DRAFT_KEYS[m], JSON.stringify({ ...data, uploadedImageData: null }));
      } catch {}
    }
    localStorage.setItem("accredit_last_mode", m);
    localStorage.setItem("accredit_create_step", String(step));
    localStorage.setItem("accredit_create_formPage", String(formPage));
  }, [form, passPackages, socialHandles, lineup, flierParsed, uploadedImageData, mode, step, formPage]);

  // Auto-save draft on meaningful state changes
  useEffect(() => {
    if (!hydrated || !mode) return;
    const timer = setTimeout(() => saveDraft(), 300);
    return () => clearTimeout(timer);
  }, [form, passPackages, socialHandles, lineup, flierParsed, mode, step, formPage, hydrated]);

  useEffect(() => {
    return () => {
      if (uploadedImagePreviewUrl) URL.revokeObjectURL(uploadedImagePreviewUrl);
    };
  }, [uploadedImagePreviewUrl]);

  useEffect(() => {
    if (!fingerprint) return;
    (["invite", "event"] as Mode[]).forEach(async (trialType) => {
      try {
        const status = await apiClient<{ used: boolean }>("/trials/check", {
          method: "POST",
          body: { trial_type: trialType, fingerprint },
        });
        setUsedTrials((current) => ({ ...current, [trialType]: status.used }));
      } catch {
        setUsedTrials((current) => ({
          ...current,
          [trialType]: localStorage.getItem(`accredit_trial_used_${trialType}`) === "true",
        }));
      }
    });
  }, [fingerprint]);

  const selectedGuestRange = guestRanges.find((range) => range.label === form.guest_range) || guestRanges[0];
  const pricingUnits = selectedGuestRange.units;
  const selectedPrice = useMemo(
    () => (mode === "invite" ? form.delivery_channels.reduce((total, channel) => total + pricing[channel] * pricingUnits, 0) : 0),
    [form.delivery_channels, mode, pricingUnits]
  );
  const selectedChannelNames = form.delivery_channels.map((channel) => channelLabels[channel]);

  const selectedTimezone = timezoneOptions.find((zone) => zone.value === form.timezone) || timezoneOptions[0];
  const selectedQrDelivery = qrDeliveryOptions.find((option) => option.value === form.qr_delivery) || qrDeliveryOptions[0];
  const selectedSocialPlatform = socialPlatforms.find((platform) => platform.value === form.social_platform) || socialPlatforms[0];
  const detailsToBeCommunicated = mode === "invite" && form.details_to_be_communicated;
  const visibleSocialHandles = socialHandles.filter((item) => item.handle.trim());
  const visiblePassPackages = passPackages.filter((item) => item.name.trim() || item.price.trim());
  const visibleLineup = lineup.filter((item) => item.role.trim() && item.name.trim());

  const updatePassPackage = (index: number, next: Partial<PassPackage>) => {
    setPassPackages((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...next } : item)));
  };

  const updateSocialHandle = (index: number, next: Partial<SocialHandle>) => {
    setSocialHandles((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...next } : item)));
  };

  const updateLineup = (index: number, next: Partial<LineupPerson>) => {
    setLineup((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...next } : item)));
  };

  const generateHeadshot = (index: number) => {
    updateLineup(index, { headshotSource: "ai", generatedHeadshot: true, attachHeadshot: true });
  };

  function regexParseFlier(text: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    // Pre-clean OCR artifacts: pipes between words, stray special chars, normalize whitespace
    const clean = text
      .replace(/[|]/g, " ")
      .replace(/[–—]/g, " ")
      .replace(/[‎‏]/g, "")
      .replace(/[ \t]+/g, " ")
      .trim();

    const lines = clean.split("\n").map((l) => l.trim()).filter(Boolean);

    // Date: try label-based first, then free-form
    const dateLabels = /\b(?:date|event date|event day)\s*[:.]?\s*(.*)/i;
    for (const line of lines) {
      const m = line.match(dateLabels);
      if (m) {
        const d = extractDate(m[1]);
        if (d) { result.event_date = d; break; }
      }
    }
    if (!result.event_date) {
      const d = extractDate(clean);
      if (d) result.event_date = d;
    }

    // Time: try label-based first, then free-form
    const timeLabels = /(?:time|hour|starts?|by)\s*[:.]?\s*(.*)/i;
    for (const line of lines) {
      const m = line.match(timeLabels);
      if (m) {
        const t = extractTime(m[1]);
        if (t) { result.event_time = t; break; }
      }
    }
    if (!result.event_time) {
      const t = extractTime(clean);
      if (t) result.event_time = t;
    }

    // Venue: try label-based first, then fallback
    const venueLabels = /(?:venue|location|place|address|at)\s*[:.]?\s*(.*)/i;
    for (const line of lines) {
      const m = line.match(venueLabels);
      if (m) {
        const v = m[1].replace(/[,;].*$/, "").trim();
        if (v.length > 2 && v.length < 80) { result.venue = v; break; }
      }
    }
    if (!result.venue) {
      // Fallback: look for a mostly-uppercase line of 2+ words near the bottom
      const upperLines = lines.filter((l) => {
        const letters = l.replace(/[^A-Za-z]/g, "");
        const uppers = l.replace(/[^A-Z]/g, "").length;
        return letters.length > 5 && uppers / letters.length > 0.6 && l.split(/\s+/).length >= 2;
      });
      if (upperLines.length >= 1) result.venue = upperLines[upperLines.length - 1].replace(/\s+[a-z]{2,}$/, "").trim();
    }
    if (!result.venue) {
      const sepMatch = clean.match(/(?:\b(?:at|@|venue|location)\s+)([A-Za-z][A-Za-z .'-]{3,70})/i);
      if (sepMatch) result.venue = sepMatch[1].trim();
    }

    // Title: score each line by how "title-like" it is
    const EVENT_KEYWORDS = /invite|invitation|wedding|celebration|party|birthday|anniversary|concert|festival|show|gala|ball|fundraiser|reunion|ceremony|reception|banquet|conference|summit|workshop|seminar|launch|premiere|opening|exhibition|fair|market/i;
    const WATERMARK = /chatgpt|gpt.?image|dall.?e|generated.?by|midjourney|screenshot|image \d|prompt|ai.?generated|stable.?diffusion/i;
    const COMMON_CAPS = new Set(["INVITE","YOU","TO","THE","AND","FOR","YOUR","OUR","ARE","ALL","CAN","HAS","HAD","WAS","WERE","THIS","THAT","WITH","FROM","THEY","WILL","BEEN","HAVE","HERE","WHAT","WHEN","WHERE","WHICH","THERE","THEIR","COME","JOIN","RSVP","CELEBRATE","WEDDING","BIRTHDAY","PARTY","EVENT","SHOW","FOUR","FIVE","SIX","SEVEN","EIGHT","NINE","TEN","ELEVEN","TWELVE","ONE","TWO","THREE"]);
    function isNameWord(w: string) {
      return w.length >= 4 && w === w.toUpperCase() && /[A-Z]/.test(w) && /[AEIOU]/.test(w) && !COMMON_CAPS.has(w);
    }
    let bestScore = 0;
    // Special case: adjacent lines each with an all-caps name → "NAME and NAME"
    for (let i = 0; i < lines.length - 1; i++) {
      const w1 = lines[i].trim().split(/\s+/).filter(isNameWord);
      const w2 = lines[i + 1].trim().split(/\s+/).filter(isNameWord);
      if (w1.length >= 1 && w2.length >= 1) {
        result.title = w1[0] + " and " + w2[0];
        bestScore = 999;
        break;
      }
    }
    // Fallback: score remaining lines
    if (!result.title) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].replace(/[#*"'_`^~°|]/g, "").trim();
        if (line.length < 2 || line.length > 100) continue;
        if (WATERMARK.test(line)) continue;

        // Try combining this line with the next if both look like name fragments
        const candidate = (() => {
          const next = i + 1 < lines.length ? lines[i + 1].replace(/[#*"'_`^~°|]/g, "").trim() : "";
          const combined = line + " " + next;
          const allCapsWords = combined.split(/\s+/).filter((w) => w.length >= 3 && w === w.toUpperCase() && /[A-Z]/.test(w));
          const lowerWords = combined.split(/\s+/).filter((w) => w.length >= 2 && w !== w.toUpperCase());
          if (allCapsWords.length >= 2) {
            const garbled = lowerWords.filter((w) => w.length >= 3 && !/^(?:and|&|the|for|of|at|in|on|to|by)$/i.test(w));
            if (garbled.length <= 1) return combined;
          }
          return line;
        })();

        const cleanLine = candidate;
        if (cleanLine.length < 4 || cleanLine.length > 100) continue;
        if (/^\d/.test(cleanLine)) continue;
        const alpha = cleanLine.replace(/[^A-Za-z ]/g, "").length;
        if (alpha / cleanLine.length < 0.5) continue;
        const words = cleanLine.split(/\s+/).filter(Boolean);
        const realWords = words.filter((w) => {
          if (w.length < 2) return false;
          const letters = w.replace(/[^A-Za-z]/g, "").length;
          return letters / w.length > 0.5;
        });
        const avgWordLen = realWords.length ? realWords.reduce((s, w) => s + w.length, 0) / realWords.length : 0;
        if (avgWordLen < 2.5 || realWords.length < 1) continue;
        let score = realWords.length + Math.round(avgWordLen);
        if (EVENT_KEYWORDS.test(cleanLine)) score += 8;
        // Bonus for actual name-like words (excludes common English words like INVITE, YOU, TO, etc.)
        const nameWords = words.filter(isNameWord);
        score += nameWords.length * 3;
        const lower = cleanLine.toLowerCase();
        if (/^(?:date|time|venue|location|address)/i.test(cleanLine)) score -= 6;
        if (score > bestScore) {
          bestScore = score;
          result.title = cleanLine;
        }
      }
    }
    if (!result.title) {
      const t = clean.replace(/\s+/g, " ").trim();
      if (t.length > 1) result.title = t;
    }

    return result;
  }

  function extractDate(s: string): string | null {
    const txt = s.replace(/[|°^~*_`]/g, " ").replace(/\s+/g, " ").trim();
    const months: Record<string, string> = {
      jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12"
    };

    // Pattern 1: "18 JUL 2025" or "18 JULY 2025"
    let m = txt.match(/(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s*\.?\s+(\d{4}|\d{2})/i);
    if (m) {
      const day = String(parseInt(m[1], 10)).padStart(2, "0");
      const month = months[m[2].slice(0, 3).toLowerCase()] || "01";
      const year = m[3].length === 2 ? "20" + m[3] : m[3];
      return `${year}-${month}-${day}`;
    }

    // Pattern 2: "18 September 2027" or "18th August, 2025"
    m = txt.match(/(\d{1,2})\s*(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)[a-z]*\s*,?\s*(\d{4}|\d{2})/i);
    if (m) {
      const day = String(parseInt(m[1], 10)).padStart(2, "0");
      const month = months[m[2].slice(0, 3).toLowerCase()] || "01";
      const year = m[3].length === 2 ? "20" + m[3] : m[3];
      return `${year}-${month}-${day}`;
    }

    // Pattern 3: "September 18, 2027"
    m = txt.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)[a-z]*\s+(\d{1,2})\s*(?:st|nd|rd|th)?\s*,?\s*(\d{4}|\d{2})/i);
    if (m) {
      const day = String(parseInt(m[2], 10)).padStart(2, "0");
      const month = months[m[1].slice(0, 3).toLowerCase()] || "01";
      const year = m[3].length === 2 ? "20" + m[3] : m[3];
      return `${year}-${month}-${day}`;
    }

    // Pattern 4: "18/09/2027", "18-09-2027", "18.09.2027", "2027-09-18"
    m = txt.match(/(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4}|\d{2})|(\d{4})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{1,2})/);
    if (m) {
      if (m[1]) {
        const day = String(parseInt(m[1], 10)).padStart(2, "0");
        const month = String(parseInt(m[2], 10)).padStart(2, "0");
        const year = m[3].length === 2 ? "20" + m[3] : m[3];
        return `${year}-${month}-${day}`;
      } else {
        const year = m[4];
        const month = String(parseInt(m[5], 10)).padStart(2, "0");
        const day = String(parseInt(m[6], 10)).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
    }

    return null;
  }

  const NUMBERS: Record<string, string> = {
    twelve: "12", eleven: "11", ten: "10", nine: "9", eight: "8", seven: "7",
    six: "6", five: "5", four: "4", three: "3", two: "2", one: "1",
    noon: "12", midnight: "12",
  };

  function extractTime(s: string): string | null {
    const txt = s.replace(/[|°^~*_`]/g, " ").replace(/\s+/g, " ").trim().toUpperCase();

    // Pattern 1: "4:30 PM" or "4:30PM" or "16:30"
    let tm = txt.match(/(\d{1,2}):(\d{2})\s*(?:AM|PM)?/);
    if (tm) {
      const hour = String(parseInt(tm[1], 10)).padStart(2, "0");
      const minute = tm[2];
      // If it looks like 24-hour format (hour > 12), convert to 12-hour
      if (parseInt(tm[1], 10) >= 12) {
        const h12 = parseInt(tm[1], 10) === 12 ? 12 : parseInt(tm[1], 10) - 12;
        return String(h12).padStart(2, "0") + ":" + minute + " PM";
      }
      // Check for AM/PM in original string
      const period = /PM/i.test(s) ? "PM" : /AM/i.test(s) ? "AM" : "AM";
      return hour + ":" + minute + " " + period;
    }

    // Pattern 2: "4 PM" or "4PM" or "16:00"
    tm = txt.match(/(\d{1,2})\s*(?::00)?\s*(?:AM|PM)?/);
    if (tm && parseInt(tm[1], 10) <= 23) {
      const hour = parseInt(tm[1], 10);
      // If it looks like 24-hour format
      if (hour >= 12) {
        const h12 = hour === 12 ? 12 : hour - 12;
        return String(h12).padStart(2, "0") + ":00 PM";
      }
      const period = /PM/i.test(s) ? "PM" : /AM|MORNING/i.test(s) ? "AM" : hour < 12 ? "AM" : "PM";
      return String(hour).padStart(2, "0") + ":00 " + period;
    }

    // Pattern 3: Spelled out numbers "FOUR PM" or "FOUR O'CLOCK"
    const wordHour = txt.match(/\b(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|NOON|MIDNIGHT)\b/);
    if (wordHour) {
      const hour = NUMBERS[wordHour[1].toLowerCase()] || "12";
      let period = "AM";
      if (/PM|AFTERNOON|EVENING|NIGHT/.test(txt)) period = "PM";
      if (/AM|MORNING/.test(txt)) period = "AM";
      if (/NOON/.test(txt)) period = "PM";
      if (/MIDNIGHT/.test(txt)) period = "AM";
      const minute = /HALF.*PAST/.test(txt) ? "30" : /QUARTER.*PAST/.test(txt) ? "15" : /QUARTER.*TO/.test(txt) ? "45" : "00";
      return String(parseInt(hour, 10)).padStart(2, "0") + ":" + minute + " " + period;
    }

    return null;
  }

  const handleFlierUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFlierParseError("");
    setFlierParsed(false);

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setFlierPreview(dataUrl);
      setUploadedImagePreviewUrl(dataUrl);
      setUploadedImageData(dataUrl);
      setForm((prev) => ({ ...prev, media_source: "upload", uploaded_image_name: file.name }));
      setFlierParsing(true);

      let allText = "";
      try {
        const { data } = await Tesseract.recognize(dataUrl, "eng", {
          logger: () => {},
        });
        allText = data.text;
      } catch (ocrErr) {

      }

      // Always also parse the filename as a fallback
      const fileNameText = file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ");
      if (!allText.trim()) allText = fileNameText;

      setTimeout(() => {
        const result = regexParseFlier(allText);


        const str = (v: unknown) => (typeof v === "string" ? v : "");
        const nextForm = {
          ...form,
          title: str(result.title) || form.title,
          host_name: str(result.host_name) || form.host_name,
          venue: str(result.venue) || form.venue,
        };

        setForm(nextForm);

        const rawDate = str(result.event_date);
        if (rawDate) {
          const parts = parseDateParts(rawDate);
          const d = String(parseInt(parts.day || "0", 10));
          if (d && d !== "0") { setDayPart(d); setMonthPart(parts.month); setYearPart(parts.year); }
          nextForm.event_date = rawDate;
        }

        const rawTime = str(result.event_time);
        if (rawTime) {
          nextForm.event_time = rawTime;
        }

        setFlierParsed(true);
        const nextMode = mode || "event";
        setMode(nextMode);
        setFlierParsing(false);
        saveDraft(nextForm, nextMode);
      }, 500);
    };
    reader.readAsDataURL(file);
  };

  const generateImage = async () => {
    if (!hydrated || !mode) return;
    setAiImageGenerating(true);
    try {
      const autoPrompt = [
        form.title ? `Premium visual artwork for "${form.title}".` : "Premium event visual artwork.",
        form.category ? `Category: ${form.category}.` : "",
        form.venue ? `Venue mood inspired by ${form.venue}.` : "",
        form.male_dress_code ? `Dress code mood: ${form.male_dress_code}.` : "",
        form.event_date ? `Season/date mood: ${form.event_date}.` : "",
        form.event_time ? `Lighting mood: ${form.event_time}.` : "",
        visibleLineup.length
          ? `Featuring: ${visibleLineup.slice(0, 3).map((p) => p.name).filter(Boolean).join(", ")}.`
          : "",
        "Vibrant professional event artwork only. Do not include text, words, letters, numbers, dates, labels, logos, or headline copy.",
      ].filter(Boolean).join(" ");
      const prompt = form.image_prompt.trim() || autoPrompt;
      setAiImageError("");
      const url = await generateFlier(prompt);
      setForm((current) => ({
        ...current,
        media_source: "ai",
        generated_image_ready: true,
        generated_image_url: url,
        image_prompt: current.image_prompt || autoPrompt,
      }));
    } catch (err) {
      setAiImageError("Could not generate image. Please try again later or upload your own.");
    } finally {
      setAiImageGenerating(false);
    }
  };

  const showEmailModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mode || !fingerprint) return;
    if (mode === "invite") {
      if (form.delivery_channels.length === 0) {
        setError("Select at least one delivery channel to test.");
        return;
      }
      setEmailModalOpen(true);
      setError("");
    } else {
      runTrial();
    }
  };

  const runTrial = async () => {
    if (!mode || !fingerprint) return;

    setError("");
    setMessage("");
    setTrialComplete(false);
    setSubmitting(true);
    setEmailModalOpen(false);

    try {
      const result = await apiClient<{ flier_url?: string; sent_to?: string; sent_via?: string; flyer_url?: string; event_id?: number }>("/trials/use", {
        method: "POST",
        body: {
          trial_type: mode,
          fingerprint,
          payload: {
            ...form,
            pass_packages: passPackages,
            lineup,
            social_handles: socialHandles,
            estimated_price: selectedPrice,
            pricing_units: pricingUnits,
            guest_count: selectedGuestRange.max,
            test_email: mode === "invite" ? testEmail : undefined,
            test_phone: mode === "invite" ? testPhone || undefined : undefined,
            uploaded_image_data: uploadedImageData || undefined,
          },
        },
      });

      localStorage.setItem(`accredit_trial_used_${mode}`, "true");
      setUsedTrials((current) => ({ ...current, [mode]: true }));
      localStorage.removeItem(DRAFT_KEY);
      setTrialComplete(true);
      setTrialEventId(result.event_id ?? null);

      if (mode === "event" && result.flier_url) {
        setEventPreviewUrl(result.flier_url);
        setMessage("Event flier preview generated! Here's what your event will look like on Discover Events:");
      } else if (mode === "invite" && result.sent_to) {
        const viaText = result.sent_via ? ` via ${result.sent_via}` : "";
        if (result.flyer_url) {
          setInviteFlyer(result.flyer_url);
          setMessage(`Test invitation flyer sent to ${result.sent_to}${viaText}. Here's the beautiful invitation your guests will see:`);
        } else {
          setMessage(`Test invite sent to ${result.sent_to}${viaText}. Check your messages to see the invitation flyer. Create an account to send real invites to your guest list.`);
        }
      } else {
        setMessage(mode === "event"
          ? "Event preview ready. Create an account to publish to Discover Events."
          : `Invite preview sent. Create an account to send to your full guest list.`
        );
      }

      // Persist raw success data so the success screen survives page reload
      sessionStorage.setItem("accredit_trial_success", JSON.stringify({
        trialComplete: true,
        trialEventId: result.event_id ?? null,
        flierUrl: result.flier_url || null,
        flyerUrl: result.flyer_url || null,
        sentTo: result.sent_to || null,
        sentVia: result.sent_via || null,
        mode,
      }));
    } catch (err) {
      const detail = err instanceof Error ? err.message : "You have already tested this feature.";
      setError(detail);
      setUsedTrials((current) => ({ ...current, [mode]: true }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestAndSignup = async () => {
    if (!mode) return;

    setSubmitting(true);
    setError("");

    try {
      // Save to trial store (runTrial already called /trials/use)
      const trialEvent = TrialStore.create(mode as 'invite' | 'event');
      trialEvent.form = form;
      trialEvent.passPackages = passPackages;
      trialEvent.socialHandles = socialHandles;
      trialEvent.lineup = lineup;
      trialEvent.uploadedImageData = uploadedImageData;
      trialEvent.tested = true;
      trialEvent.testedVia = mode === "invite"
        ? (form.delivery_channels.includes("email") ? "email" : form.delivery_channels[0] || "email") as 'email' | 'whatsapp' | 'sms'
        : 'email';
      trialEvent.testRecipient = mode === "invite" ? testEmail || "" : undefined;
      TrialStore.save(trialEvent);

      // For POST EVENT mode, also save to sessionStorage so onboarding can create a real event
      if (mode === "event") {
        const eventData = {
          title: form.title,
          host_name: form.host_name,
          event_date: form.event_date,
          event_time: form.event_time,
          venue: form.venue,
          description: form.description,
          guest_count_range: form.guest_range,
          event_type: form.event_type || "concert",
          category: form.category === "__other__" ? form.custom_category : form.category,
          ticket_price: form.gate_fee ? Number(form.gate_fee) : undefined,
          currency: form.currency,
          pass_packages: passPackages,
          lineup,
        };
        sessionStorage.setItem("post_event_trial_data", JSON.stringify(eventData));
      }

      // Redirect to onboarding
      router.push('/auth/onboarding');
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Failed to test. Please try again.";
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
    <style>{`
      @keyframes pulse-accent {
        0%, 100% { box-shadow: 0 0 0 0 rgba(26, 188, 156,0.7); }
        50% { box-shadow: 0 0 20px 10px rgba(26, 188, 156,0.3); }
      }
      @keyframes dance {
        0%, 100% { transform: translateY(0) scale(1); }
        25% { transform: translateY(-8px) scale(1.02); }
        50% { transform: translateY(0) scale(1); }
        75% { transform: translateY(-4px) scale(1.01); }
      }
      @keyframes pulse-breathing {
        0%, 100% { box-shadow: 0 0 0 0 rgba(26, 188, 156,0.4); }
        50% { box-shadow: 0 0 0 8px rgba(26, 188, 156,0.1); }
      }
      @keyframes gentleBounce {
        0%, 100% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-6px) scale(1.01); }
      }
      .bounce-button {
        animation: gentleBounce 0.8s ease-in-out infinite;
        will-change: transform;
        transform: translateZ(0);
      }
    `}</style>
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar variant="light" />

      <main className="flex-1 relative">
        {/* Mobile back to home button */}
        <Link
          href="/"
          className="md:hidden fixed top-24 left-4 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#4a6280] shadow-[0_2px_8px_rgba(0,0,0,0.12)] transition-all hover:bg-[#f8f9fc] active:scale-95 border border-[#e8edf2]"
          aria-label="Back to home"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>

        <section className="px-4 py-3 sm:py-6 sm:px-6 lg:px-8 bg-white border-b border-[#e8edf2]">
          <div className="mx-auto grid max-w-6xl gap-6 lg:gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            {step === 0 && (
            <div>
              <h1 className="max-w-3xl text-2xl sm:text-5xl lg:text-6xl font-black leading-tight text-[#0D1B2A]">
                Test your invite
              </h1>
              <p className="mt-2 sm:mt-6 max-w-2xl text-sm sm:text-lg leading-6 sm:leading-8 text-gray-500">
                Choose CREATE INVITE for private guest lists or POST EVENT for public discovery.
                The test previews exactly what your guests will see - no payment required.
              </p>
            </div>
            )}

            {step === 0 && (
              <div className="rounded-2xl border border-[#e8edf2] bg-[#f8f9fc] p-4 sm:p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-600">
                  Choose one to get started
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      const newMode = mode === "invite" ? null : "invite";
                      if (newMode !== mode) {
                        setForm({ ...DEFAULT_FORM });
                        setPassPackages([{ name: "Regular", price: "" }]);
                        setSocialHandles([{ platform: "instagram", handle: "" }]);
                        setLineup([{ role: "", name: "", attachHeadshot: true, headshotSource: "upload", headshotFileName: "", generatedHeadshot: false }]);
                        if (uploadedImagePreviewUrl) URL.revokeObjectURL(uploadedImagePreviewUrl);
                        setUploadedImagePreviewUrl(null);
                        setUploadedImageData(null);
                        setDayPart(""); setMonthPart(""); setYearPart("");
                        setFlierPreview(null); setFlierParsed(false); setFlierParseError("");
                      }
                      setMode(() => newMode);
                      if (newMode) { setStep(1); setFormPage(0); } else setStep(0);
                      setMessage("");
                      setError("");
                      setTrialComplete(false);
                    }}
                    className={`rounded-xl border-2 p-6 text-left transition-all duration-200 cursor-pointer ${
                      mode === "invite"
                        ? "border-[#1ABC9C] bg-white shadow-[0_4px_20px_rgba(26, 188, 156,0.14)] ring-2 ring-[#1ABC9C]/15"
                        : "border-[#e2e8f0] bg-white hover:border-[#1ABC9C]/50 hover:shadow-md"
                    }`}
                    style={step === 0 && !mode ? { animation: "dance 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) infinite" } : {}}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-base font-black uppercase tracking-[0.12em] text-[#1ABC9C]">
                        CREATE INVITE
                      </span>
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all"
                        style={{
                          borderColor: mode === "invite" ? "#1ABC9C" : "#d1d5db",
                          background: mode === "invite" ? "#1ABC9C" : "white",
                        }}
                      >
                        {mode === "invite" && (
                          <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                    </div>
                    <strong className="block text-xl font-black text-[#07182f]">Private invitation</strong>
                    <span className="mt-2 block text-sm text-gray-500">
                      Guest upload, RSVP, reminders, WhatsApp/SMS/Email, QR access.
                    </span>
                    <span
                      className="mt-4 inline-flex items-center gap-1 text-xs font-bold"
                      style={{ color: mode === "invite" ? "#1ABC9C" : "#9ca3af" }}
                    >
                      {mode === "invite" ? "Selected" : "Select"}
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const newMode = mode === "event" ? null : "event";
                      if (newMode !== mode) {
                        setForm({ ...DEFAULT_FORM });
                        setPassPackages([{ name: "Regular", price: "" }]);
                        setSocialHandles([{ platform: "instagram", handle: "" }]);
                        setLineup([{ role: "", name: "", attachHeadshot: true, headshotSource: "upload", headshotFileName: "", generatedHeadshot: false }]);
                        if (uploadedImagePreviewUrl) URL.revokeObjectURL(uploadedImagePreviewUrl);
                        setUploadedImagePreviewUrl(null);
                        setUploadedImageData(null);
                        setDayPart(""); setMonthPart(""); setYearPart("");
                        setFlierPreview(null); setFlierParsed(false); setFlierParseError("");
                      }
                      setMode(() => newMode);
                      if (newMode) { setStep(1); setFormPage(0); } else setStep(0);
                      setMessage("");
                      setError("");
                      setTrialComplete(false);
                    }}
                    className={`rounded-xl border-2 p-6 text-left transition-all duration-200 cursor-pointer ${
                      mode === "event"
                        ? "border-[#1ABC9C] bg-white shadow-[0_4px_20px_rgba(26, 188, 156,0.14)] ring-2 ring-[#1ABC9C]/15"
                        : "border-[#e2e8f0] bg-white hover:border-[#1ABC9C]/50 hover:shadow-md"
                    }`}
                    style={step === 0 && !mode ? { animation: "dance 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) infinite 0.1s" } : {}}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-base font-black uppercase tracking-[0.12em] text-[#1ABC9C]">
                        POST EVENT
                      </span>
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all"
                        style={{
                          borderColor: mode === "event" ? "#1ABC9C" : "#d1d5db",
                          background: mode === "event" ? "#1ABC9C" : "white",
                        }}
                      >
                        {mode === "event" && (
                          <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                    </div>
                    <strong className="block text-xl font-black text-[#07182f]">POST EVENT</strong>
                    <span className="mt-2 block text-sm text-gray-500">
                      Public listing on Discover Events, ticket sales, flyer/banner, lineup, gate fee.
                    </span>
                    <span
                      className="mt-4 inline-flex items-center gap-1 text-xs font-bold"
                      style={{ color: mode === "event" ? "#1ABC9C" : "#9ca3af" }}
                    >
                      {mode === "event" ? "Selected" : "Select"}
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {message ? (
          <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
            <div className="max-w-md w-full">
              <div className="rounded-2xl bg-white shadow-[0_16px_42px_rgba(15,23,42,0.08)] overflow-hidden">
                <div className="bg-gradient-to-br from-[#1ABC9C]/10 to-[#1ABC9C]/5 px-6 py-8 text-center border-b border-[#e8edf2]">
                  <div className="mb-4 flex justify-center">
                    <svg className="w-12 h-12 text-[#1ABC9C]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-black text-[#0D1B2A]">Test Invite Sent!</h2>
                </div>
                <div className="px-6 py-8 space-y-6">
                  <p className="text-base font-medium text-[#0D1B2A]">{message}</p>
                  <div className="space-y-3">
                    <div className="rounded-xl border-2 border-[#1ABC9C]/20 bg-gradient-to-br from-[#fef2f8] to-[#fff5f9] p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-[#1ABC9C] mb-1">PREVIEW</p>
                      <p className="text-lg font-bold text-[#0D1B2A]">{mode === "event" ? "Flyer ready" : "Invite ready"}</p>
                    </div>
                    <div className="rounded-xl border-2 border-[#1ABC9C]/20 bg-gradient-to-br from-[#fef2f8] to-[#fff5f9] p-6">
                      <p className="text-xs font-bold uppercase tracking-widest text-[#1ABC9C] mb-4">QR CODE</p>
                      {uploadedImagePreviewUrl ? (
                        <div className="flex justify-center">
                          <QRPreview qrValue={qrValue || `${form.title}-${form.event_date}`} imageUrl={uploadedImagePreviewUrl} size={220} />
                        </div>
                      ) : (
                        <p className="text-center text-sm text-[#94a3b8]">Upload an image to see your custom QR code</p>
                      )}
                    </div>
                    <div className="rounded-xl border-2 border-[#1ABC9C]/20 bg-gradient-to-br from-[#fef2f8] to-[#fff5f9] p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-[#1ABC9C] mb-1">{mode === "event" ? "DISCOVER" : "CHANNELS"}</p>
                      <p className="text-lg font-bold text-[#0D1B2A]">{mode === "event" ? "Publish after signup" : selectedChannelNames.join(" + ")}</p>
                    </div>
                  </div>
                  {trialEventId ? (
                    <button onClick={() => router.push(`/dashboard/events/${trialEventId}`)} className="w-full h-14 flex items-center justify-center bg-gradient-to-r from-[#1ABC9C] to-[#16A085] text-white px-6 text-lg font-black shadow-[0_8px_24px_rgba(26, 188, 156,0.35)] transition-all hover:scale-105 whitespace-nowrap" style={{clipPath: "polygon(0 0,100% 0,100% calc(100% - 10px),calc(50% + 14px) calc(100% - 10px),50% 100%,calc(50% - 14px) calc(100% - 10px),0 calc(100% - 10px))", padding: "14px 40px"}}>View in Dashboard →</button>
                  ) : (
                    <button onClick={handleTestAndSignup} disabled={submitting} className="w-full h-14 flex items-center justify-center bg-gradient-to-r from-[#1ABC9C] to-[#16A085] text-white px-6 text-lg font-black shadow-[0_8px_24px_rgba(26, 188, 156,0.35)] transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed animate-bounce whitespace-nowrap" style={{clipPath: "polygon(0 0,100% 0,100% calc(100% - 10px),calc(50% + 14px) calc(100% - 10px),50% 100%,calc(50% - 14px) calc(100% - 10px),0 calc(100% - 10px))", padding: "14px 40px"}}>{submitting ? "Setting up..." : "Create Event →"}</button>
                  )}
                  <p className="text-xs text-center text-[#94a3b8]">Create an account to send real invites to your guest list</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
        <section className={`px-4 sm:px-6 lg:px-8 ${step > 0 ? 'pt-0 pb-0' : 'py-4 sm:py-8'}`}>
          <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1fr_390px]">
            <form id="create-event-form" onSubmit={showEmailModal} className={`rounded-2xl border border-[#e2e8f0] bg-white p-3 shadow-[0_16px_42px_rgba(15,23,42,0.08)] sm:p-4 ${step === 1 ? '' : 'hidden'}`}>
              {step === 1 && (
              <>
              {formPage === 0 && (<>

              {/* Mode header */}
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="inline-block px-3 py-1.5 rounded-lg" style={{ background: "rgba(26, 188, 156,0.1)" }}>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1ABC9C]">
                      {mode === "event" ? "Post Event Test" : "Create Invite Test"}
                    </p>
                  </div>
                  <h2 className="mt-2 text-2xl font-black text-[#07182f]">
                    {mode ? "Try it once, then continue securely" : "Choose a flow above"}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  {mode && (
                    <button
                      type="button"
                      onClick={() => setStep(0)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:text-[#0D1B2A] hover:bg-gray-100 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                      Back
                    </button>
                  )}
                  {mode && usedTrials[mode] && (
                    <span className="rounded-full bg-[#fff1f8] px-3 py-1 text-xs font-bold text-[#16A085]">
                      Trial already used
                    </span>
                  )}
                </div>
              </div>

              {/* Flier upload - shared by both modes */}
              <div className="mb-6">
                {flierParsing ? (
                  <div className="flex items-center gap-3 rounded-xl border border-[#e8edf2] bg-[#f8f9fc] px-4 py-3">
                    <div className="w-4 h-4 rounded-full border-2 border-[#1ABC9C] border-t-transparent animate-spin flex-shrink-0" />
                    <p className="text-sm font-semibold text-[#0D1B2A]">Uploading image…</p>
                  </div>
                ) : flierParsed ? (
                  <div className="flex items-center gap-3 rounded-xl border border-[#e8edf2] bg-[#f8f9fc] px-4 py-3">
                    <div className="flex-1">
                      <p className="text-sm font-bold text-emerald-600">Image uploaded: fill in the details below</p>
                      <p className="text-xs text-[#94a3b8] mt-0.5">Basic info may be extracted from the filename</p>
                    </div>
                    <label className="cursor-pointer text-xs font-bold text-[#1ABC9C] hover:underline flex-shrink-0">
                      Change
                      <input type="file" accept="image/*" className="sr-only" onChange={handleFlierUpload} />
                    </label>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[#d9e2ec] bg-[#f8f9fc] px-4 py-3 hover:border-[#1ABC9C] transition-colors group">
                    <div className="w-9 h-9 rounded-xl bg-white border border-[#e8edf2] flex items-center justify-center flex-shrink-0 group-hover:border-[#1ABC9C] transition-colors">
                      <svg className="w-4 h-4 text-[#1ABC9C]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#0D1B2A]">Upload image/flyer</p>
                      <p className="text-xs text-[#94a3b8] mt-0.5">Instantly extract title, date, and venue from your image</p>
                    </div>
                    <span className="flex-shrink-0 rounded-lg border border-[#1ABC9C] px-3 py-1.5 text-xs font-bold text-[#1ABC9C] group-hover:bg-[#fff1f8] transition-colors">
                      Upload
                    </span>
                    <input type="file" accept="image/*" className="sr-only" onChange={handleFlierUpload} />
                  </label>
                )}
                {flierParseError && (
                  <p className="mt-2 text-xs font-medium text-amber-600">{flierParseError}</p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-[#23466f]">
                    {mode === "event" ? "Event title" : "Invite title"}
                  </span>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="h-11 w-full rounded-xl border border-[#d9e2ec] px-3 text-sm outline-none focus:border-[#1ABC9C]"
                    placeholder={mode === "event" ? "Lagos Music Weekend" : "Sarah & James Wedding"}
                    required
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-[#23466f]">
                    {mode === "event" ? "Host or promoter" : "Host name"} <span className="text-xs font-normal text-[#94a3b8]">(optional)</span>
                  </span>
                  <input
                    value={form.host_name}
                    onChange={(e) => setForm({ ...form, host_name: e.target.value })}
                    className="h-11 w-full rounded-xl border border-[#d9e2ec] px-3 text-sm outline-none focus:border-[#1ABC9C]"
                    placeholder={mode === "event" ? "Accredit Live" : "The Adeyemis"}
                  />
                </label>

                {mode === "event" ? (
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-[#23466f]">Category</span>
                    <SelectDropdown
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value, custom_category: e.target.value !== "__other__" ? "" : form.custom_category })}
                      className="h-11 w-full rounded-xl border border-[#d9e2ec] px-3 text-sm outline-none focus:border-[#1ABC9C]"
                    >
                      <option value="concert">Concert</option>
                      <option value="conference">Conference</option>
                      <option value="festival">Festival</option>
                      <option value="comedy">Comedy show</option>
                      <option value="exhibition">Exhibition</option>
                      <option value="community">Community gathering</option>
                      <option value="house_party">House Party</option>
                      <option value="games_night">Games Night</option>
                      <option value="beach_party">Beach Party</option>
                      <option value="seminar">Seminar</option>
                      <option value="comedy_show">Comedy Show</option>
                      <option value="magic_show">Magic Show</option>
                      <option value="__other__">Others</option>
                    </SelectDropdown>
                    {form.category === "__other__" && (
                      <input
                        type="text"
                        value={form.custom_category || ""}
                        onChange={(e) => setForm({ ...form, custom_category: e.target.value })}
                        className="mt-2 h-11 w-full rounded-xl border border-[#d9e2ec] px-3 text-sm outline-none focus:border-[#1ABC9C]"
                        placeholder="Type your category..."
                        autoFocus
                        required
                      />
                    )}
                  </label>
                ) : (
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-[#23466f]">Event type</span>
                    <SelectDropdown
                      value={form.event_type}
                      onChange={(e) => setForm({ ...form, event_type: e.target.value, custom_event_type: e.target.value !== "others" ? "" : form.custom_event_type })}
                      className="h-11 w-full rounded-xl border border-[#d9e2ec] px-3 text-sm outline-none focus:border-[#1ABC9C]"
                    >
                      <option value="wedding">Wedding</option>
                      <option value="birthday">Birthday</option>
                      <option value="corporate">Corporate</option>
                      <option value="religious">Religious event</option>
                      <option value="vip">VIP gathering</option>
                      <option value="conference">Conference</option>
                      <option value="seminar">Seminar</option>
                      <option value="exhibition">Exhibition</option>
                      <option value="comedy_show">Comedy Show</option>
                      <option value="magic_show">Magic Show</option>
                      <option value="others">Others</option>
                    </SelectDropdown>
                    {form.event_type === "others" && (
                      <input
                        type="text"
                        value={form.custom_event_type}
                        onChange={(e) => setForm({ ...form, custom_event_type: e.target.value })}
                        placeholder="Type your event type..."
                        className="mt-2 h-11 w-full rounded-xl border border-[#d9e2ec] px-3 text-sm outline-none focus:border-[#1ABC9C]"
                        autoFocus
                        required
                      />
                    )}
                  </label>
                )}

                {mode === "invite" ? (
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-[#23466f]">Number of guests</span>
                    <SelectDropdown
                      value={form.guest_range}
                      onChange={(e) => setForm({ ...form, guest_range: e.target.value })}
                      className="h-11 w-full rounded-xl border border-[#d9e2ec] px-3 text-sm font-bold outline-none focus:border-[#1ABC9C]"
                      required
                    >
                      {guestRanges.map((range) => (
                        <option key={range.label} value={range.label}>
                          {range.label} guests
                        </option>
                      ))}
                    </SelectDropdown>
                  </label>
                ) : (
                  <details className="rounded-xl border border-[#d9e2ec] group">
                    <summary className="flex cursor-pointer items-center justify-between p-4 text-sm font-semibold text-[#23466f] [&::-webkit-details-marker]:hidden">
                      <span>Social media handles</span>
                      <svg className="w-4 h-4 text-[#94a3b8] transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </summary>
                    <div className="px-4 pb-4">
                      <button
                        type="button"
                        onClick={() => setSocialHandles((current) => [...current, { platform: "instagram", handle: "" }])}
                        className="mb-3 rounded-lg border border-[#d9e2ec] px-3 py-2 text-xs font-bold text-[#23466f] hover:bg-[#fff1f8]"
                      >
                        Add
                      </button>
                      <div className="space-y-2">
                      {socialHandles.map((social, index) => {
                        const platform = socialPlatforms.find((item) => item.value === social.platform) || socialPlatforms[0];
                        return (
                          <div key={index} className="grid gap-2 sm:grid-cols-[0.9fr_1.1fr_auto]">
                            <SelectDropdown
                              value={social.platform}
                              onChange={(e) => updateSocialHandle(index, { platform: e.target.value as SocialPlatform })}
                              className="h-11 w-full rounded-xl border border-[#d9e2ec] px-3 text-sm font-semibold outline-none focus:border-[#1ABC9C]"
                            >
                              {socialPlatforms.map((item) => (
                                <option key={item.value} value={item.value}>
                                  {item.label}
                                </option>
                              ))}
                            </SelectDropdown>
                            <input
                              value={social.handle}
                              onChange={(e) => updateSocialHandle(index, { handle: e.target.value })}
                              className="h-11 w-full rounded-xl border border-[#d9e2ec] px-3 text-sm outline-none focus:border-[#1ABC9C]"
                              placeholder={platform.placeholder}
                            />
                            <button
                              type="button"
                              onClick={() => setSocialHandles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                              className="h-11 rounded-xl border border-[#fecdd3] px-3 text-xs font-bold text-red-600 hover:bg-red-50"
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  </details>
                )}

                {mode === "invite" && (
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#edf2f7] p-3 text-sm font-semibold text-[#23466f] md:col-span-2">
                    <input
                      type="checkbox"
                      checked={form.details_to_be_communicated}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          details_to_be_communicated: e.target.checked,
                          event_date: e.target.checked ? "" : form.event_date,
                          event_time: e.target.checked ? "" : form.event_time,
                          venue: e.target.checked ? "" : form.venue,
                        })
                      }
                      className="h-4 w-4 accent-[#1ABC9C]"
                    />
                    Date, time and venue will be communicated later
                  </label>
                )}

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-[#23466f]">Date</span>
                  <div className="flex gap-2">
                    <SelectDropdown
                      value={dayPart}
                      onChange={(e) => {
                        const d = e.target.value;
                        setDayPart(d);
                        if (d && monthPart && yearPart) {
                          setForm((f) => ({ ...f, event_date: `${yearPart}-${monthPart}-${d.padStart(2, "0")}` }));
                        }
                      }}
                      disabled={detailsToBeCommunicated}
                      className="h-11 w-20 rounded-xl border border-[#d9e2ec] px-2 text-sm outline-none focus:border-[#1ABC9C] disabled:bg-[#f8fafc] disabled:text-[#94a3b8]"
                      required={!detailsToBeCommunicated}
                    >
                      <option value="">Day</option>
                      {Array.from({ length: 31 }, (_, i) => (
                        <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
                      ))}
                    </SelectDropdown>
                    <SelectDropdown
                      value={monthPart}
                      onChange={(e) => {
                        const m = e.target.value;
                        setMonthPart(m);
                        if (dayPart && m && yearPart) {
                          setForm((f) => ({ ...f, event_date: `${yearPart}-${m}-${dayPart.padStart(2, "0")}` }));
                        }
                      }}
                      disabled={detailsToBeCommunicated}
                      className="h-11 flex-1 rounded-xl border border-[#d9e2ec] px-2 text-sm outline-none focus:border-[#1ABC9C] disabled:bg-[#f8fafc] disabled:text-[#94a3b8]"
                      required={!detailsToBeCommunicated}
                    >
                      <option value="">Month</option>
                      {MONTHS.map((name, i) => (
                        <option key={i + 1} value={String(i + 1).padStart(2, "0")}>{name}</option>
                      ))}
                    </SelectDropdown>
                    <SelectDropdown
                      value={yearPart}
                      onChange={(e) => {
                        const y = e.target.value;
                        setYearPart(y);
                        if (dayPart && monthPart && y) {
                          setForm((f) => ({ ...f, event_date: `${y}-${monthPart}-${dayPart.padStart(2, "0")}` }));
                        }
                      }}
                      disabled={detailsToBeCommunicated}
                      className="h-11 w-24 rounded-xl border border-[#d9e2ec] px-2 text-sm outline-none focus:border-[#1ABC9C] disabled:bg-[#f8fafc] disabled:text-[#94a3b8]"
                      required={!detailsToBeCommunicated}
                    >
                      <option value="">Year</option>
                      {Array.from({ length: 10 }, (_, i) => {
                        const year = new Date().getFullYear() + i;
                        return <option key={year} value={String(year)}>{year}</option>;
                      })}
                    </SelectDropdown>
                  </div>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-[#23466f]">Time</span>
                  <TimeDropdown
                    id="event-time-input"
                    value={form.event_time}
                    onChange={(v) => setForm({ ...form, event_time: v })}
                    disabled={detailsToBeCommunicated}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-[#23466f]">Time zone</span>
                  <SelectDropdown
                    value={form.timezone}
                    onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                    className="h-11 w-full rounded-xl border border-[#d9e2ec] px-3 text-sm font-semibold outline-none focus:border-[#1ABC9C]"
                    required
                  >
                    {timezoneOptions.map((zone) => (
                      <option key={zone.value} value={zone.value}>
                        {zone.label}
                      </option>
                    ))}
                  </SelectDropdown>
                </label>
              </div>
              </>)}

              {formPage === 1 && (<>
                <div className="mt-5 space-y-5">
                {mode === "invite" && (<>
                  <fieldset className="rounded-xl border border-[#d9e2ec] p-4">
                    <legend className="px-2 text-sm font-semibold text-[#23466f]">Delivery channels</legend>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {(Object.keys(pricing) as Channel[]).map((channel) => (
                        <label key={channel} className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#edf2f7] p-3 text-sm font-semibold text-[#23466f]">
                          <input
                            type="checkbox"
                            checked={form.delivery_channels.includes(channel)}
                            onChange={() => setForm({ ...form, delivery_channels: toggleChannel(form.delivery_channels, channel) })}
                            className="h-4 w-4 accent-[#1ABC9C]"
                          />
                          <span>{channelLabels[channel]}{channel !== "email" && <span className="ml-2 text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Not available</span>}</span>
                          <span className="ml-auto text-xs text-[#94a3b8]">{formatCurrencyAmount(pricing[channel], "NGN")}/100</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {/* Venue & Dress Code */}
                  <div className="space-y-2">
                    <span className="text-sm font-semibold text-[#23466f]">Venue</span>
                    <VenueInput
                      value={form.venue}
                      onChange={(v) => setForm({ ...form, venue: v })}
                      onLocationChange={(loc) => setLocationData({ lat: loc.lat, lng: loc.lng })}
                      disabled={detailsToBeCommunicated}
                      className="h-11 w-full rounded-xl border border-[#d9e2ec] px-3 text-sm outline-none focus:border-[#1ABC9C] disabled:bg-[#f8fafc] disabled:text-[#94a3b8]"
                      placeholder={detailsToBeCommunicated ? "To be communicated" : "Search for a venue or type manually..."}
                      required={!detailsToBeCommunicated}
                    />
                  </div>

                  {/* Dress code - Female & Male */}
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-[#23466f]">Dress code - Female</span>
                      <input
                        value={form.female_dress_code || ""}
                        onChange={(e) => setForm({ ...form, female_dress_code: e.target.value })}
                        className="h-11 w-full rounded-xl border border-[#d9e2ec] px-3 text-sm outline-none focus:border-[#1ABC9C]"
                        placeholder="Evening gown, aso ebi, all white"
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-[#23466f]">Dress code - Male</span>
                      <input
                        value={form.male_dress_code}
                        onChange={(e) => setForm({ ...form, male_dress_code: e.target.value })}
                        className="h-11 w-full rounded-xl border border-[#d9e2ec] px-3 text-sm outline-none focus:border-[#1ABC9C]"
                        placeholder="Black suit, agbada, senator"
                      />
                    </label>
                  </div>

                  {/* QR code option - collapsible */}
                  <details open={qrDetailsOpen} className="rounded-xl border border-[#d9e2ec] group">
                    <summary onClick={(e) => { e.preventDefault(); setQrDetailsOpen(!qrDetailsOpen); }} className="flex cursor-pointer items-center justify-between p-4 text-sm font-semibold text-[#23466f] [&::-webkit-details-marker]:hidden">
                      <span>QR code option</span>
                      <svg className={`w-4 h-4 text-[#94a3b8] transition-transform ${qrDetailsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </summary>
                    <div className="px-4 pb-4">
                      <div className="grid gap-3 md:grid-cols-3">
                      {qrDeliveryOptions.map((option) => (
                        <label key={option.value} className="flex cursor-pointer flex-col gap-2 rounded-xl border border-[#edf2f7] p-3 text-sm text-[#23466f]">
                          <span className="flex items-center gap-2 font-bold">
                            <input
                              type="radio"
                              checked={form.qr_delivery === option.value}
                              onChange={() => { setForm({ ...form, qr_delivery: option.value }); setQrDetailsOpen(false); }}
                              className="h-4 w-4 accent-[#1ABC9C]"
                            />
                            {option.label}
                          </span>
                          <span className="text-xs leading-5 text-[#64748b]">{option.description}</span>
                        </label>
                      ))}
                      </div>

                    {form.qr_delivery === "with_qr" && (
                      <div className="mt-4">
                        <textarea
                          value={form.qr_message}
                          onChange={(e) => setForm({ ...form, qr_message: e.target.value })}
                          className="min-h-20 w-full resize-none rounded-xl border border-[#d9e2ec] bg-white px-3 py-3 text-sm outline-none focus:border-[#1ABC9C]"
                          placeholder="Optional message to accompany the QR code (e.g. 'Attached to this invite is your QR code. Kindly present it at the event for entry.')"
                        />
                      </div>
                    )}

                    {form.qr_delivery === "qr_later" && (
                      <div className="mt-4 space-y-3 rounded-xl bg-[#f8fafc] p-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          <input
                            value={form.qr_later_title}
                            onChange={(e) => setForm({ ...form, qr_later_title: e.target.value })}
                            className="h-11 rounded-xl border border-[#d9e2ec] bg-white px-3 text-sm outline-none focus:border-[#1ABC9C]"
                            placeholder="QR message title"
                          />
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#edf2f7] bg-white p-3 text-sm font-semibold text-[#23466f]">
                              <input
                                type="radio"
                                checked={form.qr_later_media_source === "upload"}
                                onChange={() => setForm({ ...form, qr_later_media_source: "upload" })}
                                className="h-4 w-4 accent-[#1ABC9C]"
                              />
                              Upload QR
                            </label>
                            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#edf2f7] bg-white p-3 text-sm font-semibold text-[#23466f]">
                              <input
                                type="radio"
                                checked={form.qr_later_media_source === "ai"}
                                onChange={() => setForm({ ...form, qr_later_media_source: "ai" })}
                                className="h-4 w-4 accent-[#1ABC9C]"
                              />
                              Generate QR
                            </label>
                          </div>
                        </div>
                        <textarea
                          value={form.qr_later_message}
                          onChange={(e) => setForm({ ...form, qr_later_message: e.target.value })}
                          className="min-h-24 w-full resize-none rounded-xl border border-[#d9e2ec] bg-white px-3 py-3 text-sm outline-none focus:border-[#1ABC9C]"
                          placeholder="Optional QR message. You can leave this blank and write it when you return later."
                        />
                        {form.qr_later_media_source === "upload" ? (
                           <div>
                           <input
                             type="file"
                             accept="image/*"
                             onChange={(e) => setForm({ ...form, qr_later_image_name: e.target.files?.[0]?.name || "" })}
className="block w-full cursor-pointer rounded-xl border border-[#d9e2ec] bg-white px-3 py-2 text-sm text-[#23466f] file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#1ABC9C] file:px-4 file:py-2 file:font-bold file:text-white file:hover:bg-[#16A085]"
                            />
                            <p className="mt-1 text-xs text-[#94a3b8]">Recommended: 1200×675px, max 5MB</p>
                           </div>
                        ) : (
                          <input
                            value={form.qr_later_image_prompt}
                            onChange={(e) => setForm({ ...form, qr_later_image_prompt: e.target.value })}
                            className="h-11 w-full rounded-xl border border-[#d9e2ec] bg-white px-3 text-sm outline-none focus:border-[#1ABC9C]"
                            placeholder="Describe the QR code design you want"
                          />
                        )}
                        <p className="text-xs font-semibold text-[#64748b]">
                          Sending QR codes later is a separate optional delivery, so message copy and artwork can be prepared now or completed when you return.
                        </p>
                      </div>
                    )}
                  </div>
                  </details>
                </>)}

                {mode === "event" && (<>
                  <details className="rounded-xl border border-[#d9e2ec] group">
                    <summary className="flex cursor-pointer items-center justify-between p-4 text-sm font-bold text-[#23466f] [&::-webkit-details-marker]:hidden">
                      <span>Gate fee / pass packages</span>
                      <svg className="w-4 h-4 text-[#94a3b8] transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </summary>
                    <div className="px-4 pb-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-semibold text-[#23466f]">Currency:</span>
                        <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}
                          className="h-9 rounded-xl border border-[#d9e2ec] px-3 text-sm outline-none focus:border-[#1ABC9C] bg-white">
                          {CURRENCIES.map((c) => (
                            <option key={c.code} value={c.code}>{c.label}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPassPackages((current) => [...current, { name: "", price: "" }])}
                        className="mb-3 w-fit cursor-pointer rounded-lg bg-[#1ABC9C] px-3 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-[#16A085]"
                      >
                        Add package
                      </button>
                    <div className="space-y-3">
                      {passPackages.map((item, index) => (
                        <div key={index} className="grid gap-3 rounded-xl bg-[#f8fafc] p-3 md:grid-cols-[1fr_1fr_auto]">
                          <input
                            value={item.name}
                            onChange={(e) => updatePassPackage(index, { name: e.target.value })}
                            className="h-11 rounded-xl border border-[#d9e2ec] px-3 text-sm outline-none focus:border-[#1ABC9C]"
                            placeholder="Regular, VIP, Table for 5"
                          />
                          <input
                            value={item.price}
                            onChange={(e) => updatePassPackage(index, { price: e.target.value })}
                            className="h-11 rounded-xl border border-[#d9e2ec] px-3 text-sm outline-none focus:border-[#1ABC9C]"
                            placeholder={"e.g. "+getCurrencySymbol(form.currency)+"10,000"}
                          />
                          <button
                            type="button"
                            onClick={() => setPassPackages((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                            className="h-11 cursor-pointer rounded-xl border border-[#fecdd3] px-3 text-xs font-bold uppercase tracking-widest text-red-600 hover:bg-red-50"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  </details>

                  <details className="rounded-xl border border-[#d9e2ec] group">
                    <summary className="flex cursor-pointer items-center justify-between p-4 text-sm font-bold text-[#23466f] [&::-webkit-details-marker]:hidden">
                      <span>Headliners, speakers or artistes</span>
                      <svg className="w-4 h-4 text-[#94a3b8] transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </summary>
                    <div className="px-4 pb-4">
                      <button
                        type="button"
                        onClick={() =>
                          setLineup((current) => [
                            ...current,
                            { role: "", name: "", attachHeadshot: true, headshotSource: "upload", headshotFileName: "", generatedHeadshot: false },
                          ])
                        }
                        className="mb-3 w-fit cursor-pointer rounded-lg bg-[#1ABC9C] px-3 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-[#16A085]"
                      >
                        Add person
                      </button>
                    <div className="space-y-4">
                      {lineup.map((person, index) => (
                        <div key={index} className="space-y-3 rounded-xl bg-[#f8fafc] p-3">
                          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                            <input
                              value={person.role}
                              onChange={(e) => updateLineup(index, { role: e.target.value })}
                              className="h-11 rounded-xl border border-[#d9e2ec] px-3 text-sm outline-none focus:border-[#1ABC9C]"
                              placeholder="Keynote Speaker, Guest Speaker, Artiste"
                            />
                            <input
                              value={person.name}
                              onChange={(e) => updateLineup(index, { name: e.target.value })}
                              className="h-11 rounded-xl border border-[#d9e2ec] px-3 text-sm outline-none focus:border-[#1ABC9C]"
                              placeholder="Name"
                            />
                            <button
                              type="button"
                              onClick={() => setLineup((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                              className="h-11 cursor-pointer rounded-xl border border-[#fecdd3] px-3 text-xs font-bold uppercase tracking-widest text-red-600 hover:bg-red-50"
                            >
                              Remove
                            </button>
                          </div>
                          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#23466f]">
                            <input
                              type="checkbox"
                              checked={person.attachHeadshot}
                              onChange={(e) => updateLineup(index, { attachHeadshot: e.target.checked })}
                              className="h-4 w-4 accent-[#1ABC9C]"
                            />
                            Attach headshot to flyer
                          </label>
                          {person.attachHeadshot && (
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="md:col-span-2">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => updateLineup(index, { headshotFileName: e.target.files?.[0]?.name || "" })}
                                  className="block w-full cursor-pointer rounded-xl border border-[#d9e2ec] bg-white px-3 py-2 text-sm text-[#23466f] file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#1ABC9C] file:px-4 file:py-2 file:font-bold file:text-white file:hover:bg-[#16A085]"
                                />
                                <p className="mt-1 text-xs text-[#94a3b8]">Recommended: 400×400px square, max 2MB</p>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  </details>

                  <fieldset className="rounded-xl border border-[#d9e2ec] p-4">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-[#23466f]">
                      <input
                        type="checkbox"
                        checked={form.after_party_enabled}
                        onChange={(e) => setForm({ ...form, after_party_enabled: e.target.checked })}
                        className="h-4 w-4 accent-[#1ABC9C]"
                      />
                      Include after party location
                    </label>
                    {form.after_party_enabled && (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <input
                          value={form.after_party_location}
                          onChange={(e) => setForm({ ...form, after_party_location: e.target.value })}
                          className="h-11 rounded-xl border border-[#d9e2ec] px-3 text-sm outline-none focus:border-[#1ABC9C]"
                          placeholder="After party venue or address"
                        />
                        <TimeDropdown
                          id="after-party-time-input"
                          value={form.after_party_time}
                          onChange={(v) => setForm({ ...form, after_party_time: v })}
                        />
                      </div>
                    )}
                  </fieldset>
                </>)}

                {/* Description / message for both modes */}
                <div className="space-y-2">
                  <span className="text-sm font-semibold text-[#23466f]">
                    {mode === "event" ? "Event description" : "Invite message"}
                  </span>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="min-h-32 w-full resize-none rounded-xl border border-[#d9e2ec] px-3 py-3 text-sm outline-none focus:border-[#1ABC9C]"
                    placeholder={mode === "event" ? "Describe the event for public discovery." : "Write the message your guests should receive."}
                    required
                  />
                </div>
                </div>
              </>)}



              {/* Mobile error + success message - shown after trial */}
              {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}

              {/* Sticky Bottom Navigation Bar for Form Pages */}
              {(step === 1) && mode && (
                <div className="sticky bottom-4 z-30 flex items-center gap-3 rounded-xl border border-[#e8edf2] bg-white px-4 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
                  <button
                    type="button"
                    onClick={() => {
                      if (formPage === 0) {
                        setStep(0); setMode(null);
                      } else {
                        setFormPage(formPage - 1);
                      }
                    }}
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 bounce-button"
                    style={{ background: "linear-gradient(135deg, #1ABC9C, #16A085)" }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const form = document.getElementById('create-event-form') as HTMLFormElement;
                      if (!form?.reportValidity()) return;
                      if (formPage === totalFormPages - 1) {
                        setStep(2);
                      } else {
                        setFormPage(formPage + 1);
                      }
                    }}
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 bounce-button"
                    style={{ background: "linear-gradient(135deg, #1ABC9C, #16A085)" }}
                  >
                    {formPage === totalFormPages - 1 ? "Next: Preview" : "Next"}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
              </>
              )}
            </form>

            {step === 1 && (
              <div className="hidden lg:block space-y-6" data-live-preview>
                <div className="sticky top-20 rounded-2xl bg-white p-6 text-[#0D1B2A] shadow-[0_18px_48px_rgba(0,0,0,0.08)] border border-[#e8edf2] min-h-[500px] flex flex-col">
                  {mode === "event" ? (
                    <>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1ABC9C]">Flyer builder</p>
                      <h3 className="mt-3 text-3xl font-black">Live Preview</h3>
                      <p className="mt-2 text-sm text-gray-500">
                        See exactly how your event flyer will appear on Discover Events.
                      </p>
                    </>
                  ) : (
                    <div className="rounded-xl bg-gradient-to-br from-[#fef2f8] to-[#fff5f9] p-5 border border-[#fce4f0]">
                      <div className="inline-block px-3 py-1.5 rounded-lg" style={{ background: "rgba(26, 188, 156,0.1)" }}>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1ABC9C]">Live estimate</p>
                      </div>
                      <h3 className="mt-3 text-3xl font-black text-[#0D1B2A]">{formatCurrencyAmount(selectedPrice, form.currency)}</h3>
                      <p className="mt-2 text-sm text-gray-500">
                        {form.guest_range} guests across {pricingUnits} pricing block{pricingUnits > 1 ? "s" : ""} of 100.
                      </p>
                      <div className="mt-5 space-y-2">
                        {form.delivery_channels.length === 0 ? (
                          <p className="rounded-xl bg-white/80 p-3 text-sm text-gray-500 border border-[#e8edf2]">Select at least one channel.</p>
                        ) : (
                          form.delivery_channels.map((channel) => (
                            <div key={channel} className="flex items-center justify-between rounded-xl bg-white/80 p-3 text-sm border border-[#e8edf2]">
                              <span className="text-gray-700">{channelLabels[channel]}</span>
                              <strong className="text-[#0D1B2A]">{formatCurrencyAmount(pricing[channel] * pricingUnits, form.currency)}</strong>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-8 space-y-5">
                    {(uploadedImagePreviewUrl || form.generated_image_url) && (
                      <div className="overflow-hidden rounded-xl bg-white">
                        <img
                          src={uploadedImagePreviewUrl || form.generated_image_url}
                          alt="Event image"
                          className="w-full max-h-80 object-contain bg-gray-100"
                        />
                      </div>
                    )}
                    <div className="overflow-hidden rounded-xl bg-white text-[#07182f]">
                      {(() => {
                        const activeTemplate = mode === "invite" ? form.invite_template : null;
                        const styles = activeTemplate ? templateStyles[activeTemplate] : null;
                        const headerText = styles ? styles.textColor : "white";
                        return (
                          <>
                            <div
                              className="flex min-h-36 flex-col justify-end p-5"
                              style={{
                                background: styles ? styles.headerBg : (
                                  mode === "invite"
                                    ? "linear-gradient(135deg, #1ABC9C 0%, #07182f 52%, #F5A623 100%)"
                                    : "linear-gradient(135deg, #0f172a 0%, #263b5e 50%, #1ABC9C 100%)"
                                ),
                                color: headerText,
                              }}
                            >
                              <p className="text-xs font-black uppercase tracking-[0.22em] opacity-75">
                                {mode === "event" ? "Event flyer" : "Invite flyer"}
                              </p>
                              <h4 className="mt-3 text-3xl font-black leading-tight">{form.title || (mode === "event" ? "Your Event Title" : "Your Invitation")}</h4>
                              <p className="mt-2 text-sm opacity-85">
                                {form.venue || (mode === "event" ? "Event venue" : "Venue TBD")}
                              </p>
                            </div>
                            <div className="p-4">
                              <h4 className="text-xl font-black">{form.title || (mode === "event" ? "Your Event Title" : "Your Invitation")}</h4>
                              <p className="mt-1 text-sm text-[#64748b]">{form.host_name || "Host name"}</p>
                              {mode === "event" ? (
                                <>
                                  <div className="mt-4 space-y-3 text-sm text-[#23466f]">
                                    {(form.description || "").split(/\n{2,}/).filter((p) => p.trim()).length > 0
                                      ? (form.description || "").split(/\n{2,}/).map((para, i) => (
                                          <p key={i} dangerouslySetInnerHTML={{ __html: para.replace(/\n/g, "<br />") }} />
                                        ))
                                      : <p className="italic text-[#94a3b8]">Your event description will appear here in the preview.</p>}
                                  </div>
                                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                                    <div className="rounded-lg bg-[#f8fafc] p-2">
                                      <dt className="font-bold uppercase tracking-widest text-[#475569]">Date</dt>
                                      <dd className="mt-1 font-semibold">{formatDisplayDate(form.event_date) || "Event date"}</dd>
                                    </div>
                                    <div className="rounded-lg bg-[#f8fafc] p-2">
                                      <dt className="font-bold uppercase tracking-widest text-[#475569]">Time</dt>
                                      <dd className="mt-1 font-semibold">{form.event_time || "Event time"}</dd>
                                    </div>
                                    <div className="col-span-2 rounded-lg bg-[#f8fafc] p-2">
                                      <dt className="font-bold uppercase tracking-widest text-[#475569]">Venue</dt>
                                      <dd className="mt-1 font-semibold">{form.venue || "Event venue"}</dd>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="mt-4 space-y-3 text-sm text-[#23466f]">
                                    <p className="font-semibold">Dear <span className="text-[#1ABC9C]">[Guest Name]</span>,</p>
                                    {(() => {
                                      const desc = form.description || "";
                                      const paragraphs = desc.split(/\n{2,}/).filter((p) => p.trim());
                                      if (paragraphs.length === 0) {
                                        return <p className="italic text-[#94a3b8]">Your message will appear here in the preview.</p>;
                                      }
                                      return paragraphs.map((para, i) => (
                                        <p key={i} dangerouslySetInnerHTML={{ __html: para.replace(/\n/g, "<br />") }} />
                                      ));
                                    })()}
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div className="rounded-lg bg-[#f8fafc] p-2">
                                        <dt className="font-bold uppercase tracking-widest text-[#475569]">Date</dt>
                                        <dd className="mt-1 font-semibold">{formatDisplayDate(form.event_date) || "Event date"}</dd>
                                      </div>
                                      <div className="rounded-lg bg-[#f8fafc] p-2">
                                        <dt className="font-bold uppercase tracking-widest text-[#475569]">Time</dt>
                                        <dd className="mt-1 font-semibold">{form.event_time || "Event time"}</dd>
                                      </div>
                                      <div className="col-span-2 rounded-lg bg-[#f8fafc] p-2">
                                        <dt className="font-bold uppercase tracking-widest text-[#475569]">Venue</dt>
                                          <dd className="mt-1 font-semibold">{form.venue || "Event venue"}</dd>
                                        </div>
                                        <div className="col-span-2 rounded-lg bg-[#f8fafc] p-2">
                                          <dt className="font-bold uppercase tracking-widest text-[#475569]">Dress code</dt>
                                        </div>
                                        <div className="rounded-lg bg-[#f8fafc] p-2">
                                          <dt className="font-bold uppercase tracking-widest text-[#475569]">Female</dt>
                                          <dd className="mt-1 font-semibold">{form.female_dress_code || "Not specified"}</dd>
                                        </div>
                                        <div className="rounded-lg bg-[#f8fafc] p-2">
                                          <dt className="font-bold uppercase tracking-widest text-[#475569]">Male</dt>
                                          <dd className="mt-1 font-semibold">{form.male_dress_code || "Not specified"}</dd>
                                        </div>
                                      </div>
                                  </div>
                                </>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    {mode === "invite" && form.qr_delivery !== "without_qr" && (
                      <div className="rounded-xl bg-white p-4 text-[#07182f]">
                        <p className="text-xs font-bold uppercase tracking-widest text-[#94a3b8]">QR code</p>
                        {(form.qr_message || form.qr_delivery === "with_qr") && (
                          <p className="mt-2 text-sm text-[#23466f]">{form.qr_message || "Attached to this invite is your QR code. Kindly present it at the event for entry."}</p>
                        )}
                        <div className="mt-3 flex justify-center">
                          {uploadedImagePreviewUrl ? (
                            <QRPreview
                              qrValue={`${form.title}-${form.event_date}-${form.host_name}`}
                              imageUrl={uploadedImagePreviewUrl}
                              size={160}
                            />
                          ) : (
                            <div className="grid h-24 w-24 grid-cols-5 gap-1 rounded-lg bg-[#f8fafc] p-2 shadow-[0_0_0_4px_rgba(26, 188, 156,0.08)]">
                              {Array.from({ length: 25 }).map((_, index) => (
                                <span key={index}
                                  className={`rounded-sm ${[0, 1, 2, 5, 10, 12, 14, 18, 20, 21, 22, 24].includes(index) ? "bg-[#07182f]" : "bg-white"}`}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 lg:col-span-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 px-6 bounce-button"
                  style={{ background: "linear-gradient(135deg, #1ABC9C, #16A085)" }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous: Edit form
                </button>

                <aside className="sticky top-8 self-start rounded-2xl bg-white p-6 text-[#0D1B2A] shadow-[0_18px_48px_rgba(0,0,0,0.08)] border border-[#e8edf2]">
                  {mode === "event" ? (
                    <>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1ABC9C]">Flyer builder</p>
                      <h3 className="mt-3 text-3xl font-black">Discovery preview</h3>
                      <p className="mt-2 text-sm text-gray-500">
                        POST EVENT creates a flyer/banner-style preview for Discover Events. Invite delivery pricing does not apply here.
                      </p>
                    </>
                  ) : (
                    <div className="rounded-xl bg-gradient-to-br from-[#fef2f8] to-[#fff5f9] p-5 border border-[#fce4f0]">
                      <div className="inline-block px-3 py-1.5 rounded-lg" style={{ background: "rgba(26, 188, 156,0.1)" }}>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1ABC9C]">Live estimate</p>
                      </div>
                      <h3 className="mt-3 text-3xl font-black text-[#0D1B2A]">{formatCurrencyAmount(selectedPrice, form.currency)}</h3>
                      <p className="mt-2 text-sm text-gray-500">
                        {form.guest_range} guests across {pricingUnits} pricing block{pricingUnits > 1 ? "s" : ""} of 100.
                      </p>
                      <div className="mt-5 space-y-2">
                        {form.delivery_channels.length === 0 ? (
                          <p className="rounded-xl bg-white/80 p-3 text-sm text-gray-500 border border-[#e8edf2]">Select at least one channel.</p>
                        ) : (
                          form.delivery_channels.map((channel) => (
                            <div key={channel} className="flex items-center justify-between rounded-xl bg-white/80 p-3 text-sm border border-[#e8edf2]">
                              <span className="text-gray-700">{channelLabels[channel]}</span>
                              <strong className="text-[#0D1B2A]">{formatCurrencyAmount(pricing[channel] * pricingUnits, form.currency)}</strong>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-8 space-y-5">
                    {(uploadedImagePreviewUrl || form.generated_image_url) && (
                      <div className="overflow-hidden rounded-xl bg-white">
                        <img
                          src={uploadedImagePreviewUrl || form.generated_image_url}
                          alt="Event image"
                          className="w-full max-h-80 object-contain bg-gray-100"
                        />
                      </div>
                    )}
                    <div className="overflow-hidden rounded-xl bg-white text-[#07182f]">
                      {(() => {
                        const activeTemplate = mode === "invite" ? form.invite_template : null;
                        const styles = activeTemplate ? templateStyles[activeTemplate] : null;
                        const headerText = styles ? styles.textColor : "white";
                        return (
                          <>
                            <div
                              className="flex min-h-36 flex-col justify-end p-5"
                              style={{
                                background: styles ? styles.headerBg : (
                                  mode === "invite"
                                    ? "linear-gradient(135deg, #1ABC9C 0%, #07182f 52%, #F5A623 100%)"
                                    : "linear-gradient(135deg, #0f172a 0%, #263b5e 50%, #1ABC9C 100%)"
                                ),
                                color: headerText,
                              }}
                            >
                              <p className="text-xs font-black uppercase tracking-[0.22em] opacity-75">
                                {mode === "event" ? "Event flyer" : "Invite flyer"}
                              </p>
                              <h4 className="mt-3 text-3xl font-black leading-tight">{form.title || "Your Event Title"}</h4>
                              <p className="mt-2 text-sm opacity-85">
                                {detailsToBeCommunicated ? "Venue to be communicated" : form.venue || "Event venue"}
                              </p>
                            </div>
                            <div className="p-4">
                      <h4 className="text-xl font-black">{form.title || "Your Event Title"}</h4>
                      <p className="mt-1 text-sm text-[#64748b]">{form.host_name || "Host name"}</p>
                        {mode === "event" ? (
                        <>
                          <div className="mt-4 space-y-3 text-sm text-[#23466f]">
                            {(form.description || "").split(/\n{2,}/).filter((p) => p.trim()).length > 0
                              ? (form.description || "").split(/\n{2,}/).map((para, i) => (
                                  <p key={i} dangerouslySetInnerHTML={{ __html: para.replace(/\n/g, "<br />") }} />
                                ))
                              : <p className="italic text-[#94a3b8]">Your event description will appear here in the test preview.</p>}
                          </div>
                          {visibleLineup.length > 0 && (
                            <p className="mt-3 rounded-lg bg-[#fff1f8] p-3 text-sm font-semibold text-[#16A085]">
                              Featuring: {visibleLineup.map((p) => p.name).filter(Boolean).join(" · ")}
                            </p>
                          )}
                          {form.after_party_enabled && (
                            <p className="mt-2 rounded-lg bg-[#fff1f8] p-3 text-sm font-semibold text-[#16A085]">
                              After party at {form.after_party_location || "TBD"}{form.after_party_time ? ` by ${form.after_party_time}` : ""}
                            </p>
                          )}
                          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-lg bg-[#f8fafc] p-2">
                              <dt className="font-bold uppercase tracking-widest text-[#475569]">Date</dt>
                              <dd className="mt-1 font-semibold">{detailsToBeCommunicated ? "To be communicated" : formatDisplayDate(form.event_date) || "Event date"}</dd>
                            </div>
                            <div className="rounded-lg bg-[#f8fafc] p-2">
                              <dt className="font-bold uppercase tracking-widest text-[#475569]">Time</dt>
                              <dd className="mt-1 font-semibold">{detailsToBeCommunicated ? "To be communicated" : form.event_time || "Event time"}</dd>
                            </div>
                            <div className="col-span-2 rounded-lg bg-[#f8fafc] p-2">
                              <dt className="font-bold uppercase tracking-widest text-[#475569]">Venue</dt>
                              <dd className="mt-1 font-semibold">{detailsToBeCommunicated ? "To be communicated" : form.venue || "Event venue"}</dd>
                            </div>
                            <div className="col-span-2 rounded-lg bg-[#f8fafc] p-2">
                              <dt className="font-bold uppercase tracking-widest text-[#475569]">
                                {visiblePassPackages.length > 0 ? "Tickets / Gate fee" : "Gate fee"}
                              </dt>
                              {visiblePassPackages.length > 0 ? (
                                visiblePassPackages.map((pkg, i) => (
                                  <dd key={i} className="mt-1 font-semibold">
                                    {pkg.name}{pkg.price ? ` - ${pkg.price}` : ""}
                                  </dd>
                                ))
                              ) : (
                                <dd className="mt-1 font-semibold">Free entry</dd>
                              )}
                            </div>
                            <div className="col-span-2 rounded-lg bg-[#f8fafc] p-2">
                              <dt className="font-bold uppercase tracking-widest text-[#475569]">Dress code</dt>
                            </div>
                            <div className="rounded-lg bg-[#f8fafc] p-2">
                              <dt className="font-bold uppercase tracking-widest text-[#475569]">Female</dt>
                              <dd className="mt-1 font-semibold">{form.female_dress_code || "Not specified"}</dd>
                            </div>
                            <div className="rounded-lg bg-[#f8fafc] p-2">
                              <dt className="font-bold uppercase tracking-widest text-[#475569]">Male</dt>
                              <dd className="mt-1 font-semibold">{form.male_dress_code || "Not specified"}</dd>
                            </div>
                            {visibleSocialHandles.length > 0 && (
                              <div className="rounded-lg bg-[#f8fafc] p-2">
                                <dt className="font-bold uppercase tracking-widest text-[#475569]">Social</dt>
                                <dd className="mt-1 font-semibold truncate">{visibleSocialHandles[0].handle}</dd>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="mt-4 space-y-3 text-sm text-[#23466f]">
                            <p className="font-semibold">Dear <span className="text-[#1ABC9C]">[Guest Name]</span>,</p>
                            {(() => {
                              const desc = form.description || "";
                              const paragraphs = desc.split(/\n{2,}/).filter((p) => p.trim());
                              if (paragraphs.length === 0) {
                                return <p className="italic text-[#94a3b8]">Your message will appear here in the test preview.</p>;
                              }
                              return paragraphs.map((para, i) => (
                                <p key={i} dangerouslySetInnerHTML={{ __html: para.replace(/\n/g, "<br />") }} />
                              ));
                            })()}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="rounded-lg bg-[#f8fafc] p-2">
                                <dt className="font-bold uppercase tracking-widest text-[#475569]">Date</dt>
                                <dd className="mt-1 font-semibold">{detailsToBeCommunicated ? "To be communicated" : formatDisplayDate(form.event_date) || "Event date"}</dd>
                              </div>
                              <div className="rounded-lg bg-[#f8fafc] p-2">
                                <dt className="font-bold uppercase tracking-widest text-[#475569]">Time</dt>
                                <dd className="mt-1 font-semibold">{detailsToBeCommunicated ? "To be communicated" : form.event_time || "Event time"}</dd>
                              </div>
                              <div className="col-span-2 rounded-lg bg-[#f8fafc] p-2">
                                <dt className="font-bold uppercase tracking-widest text-[#475569]">Venue</dt>
                                <dd className="mt-1 font-semibold">{detailsToBeCommunicated ? "To be communicated" : form.venue || "Event venue"}</dd>
                              </div>
                              <div className="col-span-2 rounded-lg bg-[#f8fafc] p-2">
                                <dt className="font-bold uppercase tracking-widest text-[#475569]">Dress code</dt>
                              </div>
                              <div className="rounded-lg bg-[#f8fafc] p-2">
                                <dt className="font-bold uppercase tracking-widest text-[#475569]">Female</dt>
                                <dd className="mt-1 font-semibold">{form.female_dress_code || "Not specified"}</dd>
                              </div>
                              <div className="rounded-lg bg-[#f8fafc] p-2">
                                <dt className="font-bold uppercase tracking-widest text-[#475569]">Male</dt>
                                <dd className="mt-1 font-semibold">{form.male_dress_code || "Not specified"}</dd>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    {mode === "invite" && form.qr_delivery !== "without_qr" && (
                      <div className="rounded-xl bg-white p-4 text-[#07182f]">
                        <p className="text-xs font-bold uppercase tracking-widest text-[#94a3b8]">QR code</p>
                        {(form.qr_message || form.qr_delivery === "with_qr") && (
                          <p className="mt-2 text-sm text-[#23466f]">{form.qr_message || "Attached to this invite is your QR code. Kindly present it at the event for entry."}</p>
                        )}
                        <div className="mt-3 flex justify-center">
                          {uploadedImagePreviewUrl ? (
                            <QRPreview
                              qrValue={`${form.title}-${form.event_date}-${form.host_name}`}
                              imageUrl={uploadedImagePreviewUrl}
                              size={160}
                            />
                          ) : (
                            <div className="grid h-24 w-24 grid-cols-5 gap-1 rounded-lg bg-[#f8fafc] p-2 shadow-[0_0_0_4px_rgba(26, 188, 156,0.08)]">
                              {Array.from({ length: 25 }).map((_, index) => (
                                <span
                                  key={index}
                                  className={`rounded-sm ${[0, 1, 2, 5, 10, 12, 14, 18, 20, 21, 22, 24].includes(index) ? "bg-[#07182f]" : "bg-white"}`}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}

                    {message ? (
                      <div className="mt-6 rounded-xl border-2 border-[#1ABC9C]/20 bg-gradient-to-br from-[#fef2f8] to-[#fff5f9] p-5 text-sm text-[#23466f]">
                        <p className="text-base font-bold text-[#07182f]">{message}</p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-xl bg-white p-3 shadow-sm">
                            <p className="text-xs font-bold uppercase tracking-widest text-[#94a3b8]">Preview</p>
                            <p className="mt-1 font-bold text-[#07182f]">{mode === "event" ? "Flyer ready" : "Invite ready"}</p>
                          </div>
                          <div className="rounded-xl bg-white p-3 shadow-sm">
                            <p className="text-xs font-bold uppercase tracking-widest text-[#94a3b8]">QR</p>
                            <p className="mt-1 font-bold text-[#07182f]">Ready</p>
                          </div>
                          <div className="rounded-xl bg-white p-3 shadow-sm">
                            <p className="text-xs font-bold uppercase tracking-widest text-[#94a3b8]">
                              {mode === "event" ? "Discover" : "Channels"}
                            </p>
                            <p className="mt-1 font-bold text-[#07182f]">
                              {mode === "event" ? "Publish after signup" : selectedChannelNames.join(" + ")}
                            </p>
                          </div>
                        </div>
                        {trialEventId ? (
                          <button
                            type="button"
                            onClick={() => router.push(`/dashboard/events/${trialEventId}`)}
                            className="mt-5 flex h-14 w-full items-center justify-center rounded-xl bg-[#1ABC9C] px-6 text-base font-black text-white shadow-[0_8px_24px_rgba(26, 188, 156,0.35)] transition-all hover:bg-[#16A085]"
                          >
                            View in Dashboard →
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleTestAndSignup}
                            disabled={submitting}
                            className="mt-5 flex h-14 w-full items-center justify-center rounded-xl bg-[#1ABC9C] px-6 text-base font-black text-white shadow-[0_8px_24px_rgba(26, 188, 156,0.35)] transition-all hover:bg-[#16A085] disabled:opacity-50 disabled:cursor-not-allowed animate-bounce"
                          >
                            {submitting ? "Setting up..." : "Would you like to continue with your invite?"}
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        type="submit"
                        form="create-event-form"
                        disabled={submitting}
                        className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-[#1ABC9C] px-6 text-sm font-bold text-white transition-all hover:bg-[#16A085] disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ animation: 'pulse-accent 2s infinite' }}
                      >
                        {submitting ? "Preparing preview..." : "Test this feature"}
                      </button>
                    )}
                  </div>
                </aside>
              </div>
            )}
          </div>
        </section>
      )}
      </main>

      {/* Email Input Modal for Test Invites */}
      {emailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="rounded-2xl bg-white p-6 sm:p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold text-[#0D1B2A] mb-2">Send Test Invite to Yourself</h2>
            <p className="text-sm text-gray-600 mb-6">We'll send a preview of your invitation so you can see exactly how it looks on each channel.</p>
            <input
              type="email"
              placeholder="your@email.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="w-full px-4 py-3 border border-[#d9e2ec] rounded-xl outline-none focus:border-[#1ABC9C] mb-3"
              autoFocus
            />
            {form.delivery_channels.some((c) => c === "whatsapp" || c === "sms") && (
              <input
                type="tel"
                placeholder="+2348012345678 (for WhatsApp/SMS test)"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="w-full px-4 py-3 border border-[#d9e2ec] rounded-xl outline-none focus:border-[#1ABC9C] mb-6"
              />
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setEmailModalOpen(false)}
                className="flex-1 px-4 py-3 border border-[#d9e2ec] rounded-xl text-sm font-bold text-[#0D1B2A] hover:bg-[#f8f9fc] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runTrial}
                disabled={!testEmail.includes("@")}
                className="flex-1 px-4 py-3 bg-[#1ABC9C] text-white rounded-xl text-sm font-bold hover:bg-[#d0147a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? "Sending..." : "Send Preview"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invitation Flyer Preview Modal */}
      {inviteFlyer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="rounded-2xl bg-white max-w-md w-full shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-[#e8edf2]">
              <h2 className="text-2xl font-bold text-[#0D1B2A]">Invitation Flyer</h2>
              <button
                onClick={() => setInviteFlyer(null)}
                className="text-gray-400 hover:text-[#0D1B2A] transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <p className="text-sm text-gray-600 mb-4">This beautiful flyer is exactly what your guests will see when you send them invitations. Everything they need is visible at a glance on their phone!</p>
              <img src={inviteFlyer} alt="Invitation Flyer" className="w-full max-h-96 object-contain bg-gray-100 rounded-xl shadow-lg" />
            </div>
            <div className="p-6 border-t border-[#e8edf2] bg-[#f8f9fc]">
              <p className="text-sm text-gray-600 mb-4">Ready to send real invitations? Create an account to set up your guest list and start sending.</p>
              <button
                type="button"
                onClick={handleTestAndSignup}
                disabled={submitting}
                className="block w-full px-4 py-3 bg-[#1ABC9C] text-white rounded-xl font-bold hover:bg-[#d0147a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors bounce-button"
              >
                {submitting ? "Setting up..." : "Test This Feature"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Preview Modal */}
      {eventPreviewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="rounded-2xl bg-white max-w-2xl w-full shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-[#e8edf2]">
              <h2 className="text-2xl font-bold text-[#0D1B2A]">Event Preview</h2>
              <button
                onClick={() => setEventPreviewUrl(null)}
                className="text-gray-400 hover:text-[#0D1B2A] transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <p className="text-sm text-gray-600 mb-4">This is how your event will look on Discover Events once you create an account and publish it.</p>
              <img src={eventPreviewUrl} alt="Event Preview" className="w-full max-h-96 object-contain bg-gray-100 rounded-xl" />
            </div>
            <div className="p-6 border-t border-[#e8edf2] bg-[#f8f9fc]">
              <p className="text-sm text-gray-600 mb-4">Ready to publish this event? Create an account to save your settings and post to Discover Events.</p>
              <button
                type="button"
                onClick={handleTestAndSignup}
                disabled={submitting}
                className="block w-full px-4 py-3 bg-[#1ABC9C] text-white rounded-xl font-bold hover:bg-[#d0147a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors bounce-button"
              >
                {submitting ? "Setting up..." : "Test This Feature"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer visible on desktop only */}
      <div className="hidden sm:block">
        <Footer />
      </div>
    </div>
    </>
  );
}
