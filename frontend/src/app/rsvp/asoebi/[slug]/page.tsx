"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import WeddingNav from "@/components/rsvp/WeddingNav";
import WeddingPhoneInput from "@/components/rsvp/WeddingPhoneInput";

const GOLD = "#b8892f";
const GOLD_LIGHT = "#e8c05f";
const CREAM = "#f5f0e6";
const INK = "#2b2118";

export default function WeddingAsoEbiPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [content, setContent] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [abName, setAbName] = useState("");
  const [abPhone, setAbPhone] = useState("");
  const [abEmail, setAbEmail] = useState("");
  const [abQty, setAbQty] = useState(1);
  const [abBusy, setAbBusy] = useState(false);
  const [abError, setAbError] = useState("");
  const [receipt, setReceipt] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      try {
        const data = await apiClient<any>(`/rsvp/register/${slug}`);
        if (!data.wedding_content) {
          setLoadError("Aso Ebi is not available for this event.");
        } else {
          setContent(data.wedding_content);
        }
      } catch (err: any) {
        setLoadError(err.detail || err.message || "Could not load Aso Ebi details.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  const submitAsoebi = async () => {
    setAbError("");
    if (!abName.trim() || !abPhone.trim() || !abEmail.trim()) {
      setAbError("Please provide your full name, phone number and email address.");
      return;
    }
    setAbBusy(true);
    try {
      const res = await apiClient<any>(`/rsvp/asoebi/${slug}`, {
        method: "POST",
        body: { name: abName.trim(), phone: abPhone.trim(), email: abEmail.trim(), quantity: abQty },
      });
      setReceipt(res);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setAbError(err.detail || err.message || "Failed to submit. Please try again.");
    } finally {
      setAbBusy(false);
    }
  };

  const inputCls = "w-full h-12 rounded-xl bg-white border px-4 text-sm outline-none placeholder:text-stone-400 transition focus:border-[#b8892f] focus:ring-2 focus:ring-[#b8892f]/25";
  const labelCls = "block text-xs font-black mb-1.5 uppercase";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: CREAM }}>
        <p className="text-sm" style={{ color: INK }}>Loading Aso Ebi...</p>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: CREAM }}>
        <div className="max-w-md w-full rounded-2xl bg-white border p-8 text-center" style={{ borderColor: "#e2d5b8" }}>
          <h1 className="font-serif text-2xl font-bold" style={{ color: INK }}>Not Available</h1>
          <p className="mt-2 text-sm opacity-60">{loadError}</p>
          <Link href="/" className="inline-block mt-5 text-sm font-bold underline underline-offset-4" style={{ color: GOLD }}>
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const asoebi = content.asoebi || {};
  const price = asoebi.price || 0;

  return (
    <div className="min-h-screen" style={{ background: CREAM, color: INK }}>
      <WeddingNav
        items={[
          { label: "Invitation", href: `/rsvp/register/${slug}` },
          { label: "The Day", href: `/rsvp/register/${slug}#when-where` },
          { label: "Dress Code", href: `/rsvp/register/${slug}#dress-code` },
          { label: "Hotels", href: `/rsvp/register/${slug}#hotels` },
          { label: "Asoebi", href: `/rsvp/asoebi/${slug}` },
          { label: "FAQ", href: `/rsvp/register/${slug}#faq` },
        ]}
        cta={{ label: "RSVP Now", href: `/rsvp/register/${slug}#rsvp` }}
      />

      <main className="max-w-2xl mx-auto px-6 pt-10 pb-16">
        {!receipt ? (
          <>
            <p className="text-[11px] uppercase font-medium" style={{ color: "#8a7a5c", letterSpacing: "0.35em" }}>
              {asoebi.for_who || "For the ladies"}
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl font-normal leading-tight mt-3">
              Friends of the couple asoebi.
            </h1>
            <p className="text-[15px] leading-relaxed mt-4 opacity-75">
              {asoebi.occasion || "Worn at the traditional wedding, Thursday, 17 December 2026."} Choose a package for
              yourself, or for the whole family at once. Pay once into the account below and we send you a reference you
              can look up any time.
            </p>
            <p className="mt-3 text-sm leading-relaxed opacity-60">
              {asoebi.note || "Asoebi is for the women only. Gentlemen, your colour of the day is green."}
            </p>

            {/* PACKAGE CARD */}
            <div className="mt-8 rounded-2xl border bg-white p-6 sm:p-8" style={{ borderColor: "#e2d5b8" }}>
              <p className="text-[11px] uppercase" style={{ color: "#8a7a5c", letterSpacing: "0.35em" }}>Standard</p>
              <h2 className="font-serif text-3xl mt-2">{asoebi.name || "Friends of the Couple Asoebi"}</h2>
              <p className="text-sm opacity-60 mt-1">The cloth for the traditional.</p>
              <ul className="mt-4 space-y-2">
                {(asoebi.items || []).map((item: string, i: number) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: GOLD }} />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-xl font-black">
                ₦{price.toLocaleString()} <span className="text-xs font-normal opacity-50">per package</span>
              </p>
            </div>

            {/* PAY + FORM */}
            <div id="asoebi-form" className="mt-6 rounded-2xl border bg-white p-6 sm:p-8" style={{ borderColor: GOLD }}>
              <p className="text-[11px] uppercase" style={{ color: GOLD, letterSpacing: "0.3em" }}>Step 1, pay to</p>
              <div className="mt-3 space-y-1.5 text-sm">
                <p><span className="font-bold">Account No.:</span> <span className="font-mono font-black text-lg">{asoebi.bank?.number}</span></p>
                <p><span className="font-bold">Account Name:</span> {asoebi.bank?.name}</p>
                <p><span className="font-bold">Bank Name:</span> {asoebi.bank?.bank}</p>
              </div>

              <p className="text-[11px] uppercase mt-6" style={{ color: GOLD, letterSpacing: "0.3em" }}>Step 2, claim your receipt</p>
              <div className="mt-3 space-y-4">
                <div>
                  <label className={labelCls} style={{ color: INK }}>Name: <span style={{ color: GOLD }}>*</span></label>
                  <input value={abName} onChange={(e) => setAbName(e.target.value)} placeholder="Enter your full name" className={inputCls} style={{ borderColor: "#e2d5b8" }} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: INK }}>Phone Number: <span style={{ color: GOLD }}>*</span></label>
                  <WeddingPhoneInput value={abPhone} onChange={setAbPhone} placeholder="Enter your phone number" />
                </div>
                <div>
                  <label className={labelCls} style={{ color: INK }}>Email: <span style={{ color: GOLD }}>*</span></label>
                  <input value={abEmail} onChange={(e) => setAbEmail(e.target.value)} placeholder="Enter your email address" className={inputCls} style={{ borderColor: "#e2d5b8" }} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm opacity-60">Packages</span>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setAbQty((q) => Math.max(1, q - 1))} className="w-10 h-10 rounded-lg border text-lg font-bold" style={{ borderColor: "#d8c9a6" }}>−</button>
                    <span className="font-bold w-6 text-center">{abQty}</span>
                    <button type="button" onClick={() => setAbQty((q) => Math.min(20, q + 1))} className="w-10 h-10 rounded-lg border text-lg font-bold" style={{ borderColor: "#d8c9a6" }}>+</button>
                  </div>
                  <span className="ml-auto font-black">₦{(price * abQty).toLocaleString()}</span>
                </div>
              </div>
              {abError && <p className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{abError}</p>}
              <button
                onClick={submitAsoebi}
                disabled={abBusy}
                className="mt-5 w-full h-12 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2"
                style={{ background: `linear-gradient(160deg, ${GOLD_LIGHT}, ${GOLD})` }}
              >
                {abBusy ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    Processing...
                  </>
                ) : (
                  "I Have Paid, Get My Receipt"
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border bg-white p-6 sm:p-8 text-center" style={{ borderColor: GOLD }}>
            <p className="text-[11px] uppercase" style={{ color: GOLD, letterSpacing: "0.3em" }}>Aso Ebi Receipt</p>
            <p className="font-mono font-black text-3xl mt-2">{receipt.reference}</p>
            <p className="text-sm opacity-70 mt-3">
              {receipt.buyer_name}, {receipt.quantity} package{receipt.quantity !== 1 ? "s" : ""}, ₦{receipt.amount.toLocaleString()}
            </p>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(receipt.reference);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {}
              }}
              className="mt-3 text-xs font-bold underline underline-offset-4"
              style={{ color: GOLD }}
            >
              {copied ? "Copied!" : "Copy reference"}
            </button>
            <p className="text-xs opacity-60 mt-5">Please send your bank payment receipt alongside this reference to:</p>
            <a
              href={receipt.whatsapp_link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl font-bold text-sm text-white w-full"
              style={{ background: "#25D366" }}
            >
              Confirm on WhatsApp ({receipt.whatsapp})
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
