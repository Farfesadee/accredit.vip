"use client";

import { useEffect, useState } from "react";
import WeddingRSVP from "@/components/rsvp/WeddingRSVP";
import { apiClient } from "@/lib/api-client";

const GOLD = "#b8892f";
const CREAM = "#f5f0e6";
const INK = "#2b2118";

/**
 * The standalone site's entry point for the invitation.
 *
 * The page content comes from the platform API (the same endpoint the
 * accredit.vip page uses), so the couple's dashboard stays the single place
 * where dates, venues and dress codes are edited. Everything visual is the
 * real WeddingRSVP component: this file only loads the payload and hands it
 * over.
 */
export default function WeddingShell({ slug }: { slug: string }) {
  const [content, setContent] = useState<any | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient<any>(`/rsvp/register/${slug}`);
        if (cancelled) return;
        if (!data?.wedding_content) {
          setError("This invitation is not available yet.");
          return;
        }
        setContent(data.wedding_content);
      } catch {
        if (!cancelled) setError("We could not open the invitation. Please check your connection and reload.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-6 text-center"
        style={{ background: CREAM, color: INK }}
      >
        <div className="max-w-sm">
          <p className="font-serif text-2xl">Sarah &amp; Patrick</p>
          <p className="mt-3 text-sm leading-relaxed opacity-70">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-full px-7 text-[11px] font-semibold uppercase"
            style={{ background: GOLD, color: "#fff", letterSpacing: "0.18em" }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: CREAM }}
      >
        <div className="text-center">
          <div
            className="mx-auto mb-5 h-8 w-8 animate-spin rounded-full border-2 border-transparent"
            style={{ borderTopColor: GOLD, borderRightColor: GOLD }}
          />
          <p
            className="text-[10px] uppercase"
            style={{ color: GOLD, letterSpacing: "0.32em" }}
          >
            Sarah &amp; Patrick
          </p>
        </div>
      </div>
    );
  }

  return <WeddingRSVP slug={slug} content={content} />;
}
