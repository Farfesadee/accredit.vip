"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Download, Printer } from "lucide-react";
import Link from "next/link";

export default function HeadcountPosterPage() {
  const params = useParams();
  const eventId = Number(params.id);
  const [url, setUrl] = useState<string>("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    fetch(`${process.env.NEXT_PUBLIC_API_BASE || "https://accredit.vip"}/api/v1/headcount/events/${eventId}/qr.png?size=1200`)
      .then((r) => {
        if (!r.ok) throw new Error("QR not available");
        return r.blob();
      })
      .then((blob) => setUrl(URL.createObjectURL(blob)))
      .catch(() => {})
      .finally(() => setReady(true));
  }, [eventId]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-white p-6 sm:p-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link
            href={`/dashboard/events/${eventId}/headcount`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#475569] hover:text-[#0D1B2A]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-xl border border-[#d9e2ec] px-4 py-2 text-sm font-semibold text-[#475569] hover:bg-[#f8f9fc]"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
            <a
              href={url || `${process.env.NEXT_PUBLIC_API_BASE || "https://accredit.vip"}/api/v1/headcount/events/${eventId}/qr.png?size=1200&download=1`}
              download="obis-house-wristband-qr.png"
              className="inline-flex items-center gap-2 rounded-xl border border-[#d9e2ec] px-4 py-2 text-sm font-semibold text-[#475569] hover:bg-[#f8f9fc]"
            >
              <Download className="h-4 w-4" />
              Download QR
            </a>
          </div>
        </div>

        <div className="grid gap-8">
          {/* Poster */}
          <div className="rounded-2xl border border-[#e8edf2] shadow-sm overflow-hidden">
            <div className="h-1.5 w-full" style={{ backgroundColor: "#E31E24" }} />
            <img
              src="/obi/poster-preview.png"
              alt="OBI's House gate poster"
              className="w-full h-auto"
            />
          </div>

          {/* Wristband labels */}
          <div className="rounded-2xl border border-[#e8edf2] shadow-sm overflow-hidden">
            <div className="h-1.5 w-full" style={{ backgroundColor: "#E31E24" }} />
            <img
              src="/obi/labels-preview.png"
              alt="OBI's House wristband labels"
              className="w-full h-auto"
            />
          </div>

          {/* Standalone QR */}
          <div className="rounded-2xl border border-[#e8edf2] bg-white/50 p-6 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#94a3b8] mb-4">
              Wristband QR (clean, no border)
            </p>
            {url ? (
              <img
                src={url}
                alt="OBI's House wristband QR code"
                className="mx-auto h-64 w-64"
              />
            ) : (
              <div className="mx-auto h-64 w-64 flex items-center justify-center rounded-xl border border-[#e8edf2]">
                <span className="text-sm text-[#94a3b8]">Loading...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}