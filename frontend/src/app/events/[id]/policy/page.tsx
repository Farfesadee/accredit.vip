"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getEvent, type EventData } from "@/lib/api/events";
import { Navbar } from "@/components/shared/navbar";
import { Footer } from "@/components/shared/footer";

function formatEventDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

type Block =
  | { kind: "heading"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "text"; text: string };

function toBlocks(policy: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of policy.split(/\n{2,}/)) {
    const lines = raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) continue;

    // A short standalone line is a section heading: "Refunds and transfers",
    // "ENTRY", "3. Admission:" and so on.
    if (
      lines.length === 1 &&
      lines[0].length <= 72 &&
      (/[:：]$/.test(lines[0]) ||
        lines[0] === lines[0].toUpperCase() ||
        /^\d+[.)]\s/.test(lines[0]))
    ) {
      blocks.push({ kind: "heading", text: lines[0].replace(/[:：]$/, "") });
      continue;
    }

    if (lines.every((line) => /^[-•*]\s+/.test(line))) {
      blocks.push({
        kind: "list",
        items: lines.map((line) => line.replace(/^[-•*]\s+/, "").trim()),
      });
      continue;
    }

    blocks.push({ kind: "text", text: lines.join(" ") });
  }
  return blocks;
}

export default function TicketPolicyPage() {
  const params = useParams<{ id: string }>();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params?.id) return;
    getEvent(Number(params.id))
      .then(setEvent)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params?.id]);

  const policy = (event?.ticket_policy || "").trim();
  const blocks = policy ? toBlocks(policy) : [];
  const accent = event?.theme_color || "#1ABC9C";

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar variant="light" />

      <main id="main-content" className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <Link
          href={`/events/${params?.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-[#64748b] hover:text-[#0D1B2A] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to the event
        </Link>

        {loading ? (
          <div className="mt-8 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 rounded bg-[#f1f5f9] animate-pulse" style={{ width: `${90 - i * 8}%` }} />
            ))}
          </div>
        ) : !event ? (
          <p className="mt-10 text-[#64748b]">Event not found.</p>
        ) : (
          <>
            <div
              className="mt-6 rounded-2xl px-5 py-4 sm:px-6 sm:py-5 text-white"
              style={{ background: accent }}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/75">Ticket policy</p>
              <h1 className="text-xl sm:text-2xl font-black leading-tight mt-1">{event.title}</h1>
              <p className="text-sm text-white/85 mt-1">
                {formatEventDate(event.event_date)} · {event.venue}
              </p>
            </div>

            {blocks.length === 0 ? (
              <p className="mt-8 text-[#64748b]">
                The organiser has not published a ticket policy for this event yet.
              </p>
            ) : (
              <article className="mt-8 space-y-5">
                {blocks.map((block, i) =>
                  block.kind === "heading" ? (
                    <h2
                      key={i}
                      className="text-base sm:text-lg font-black text-[#0D1B2A] pt-2"
                      style={{ borderTop: i === 0 ? "none" : "1px solid #e8edf2" }}
                    >
                      {block.text}
                    </h2>
                  ) : block.kind === "list" ? (
                    <ul key={i} className="list-disc pl-5 space-y-2 text-[15px] leading-7 text-[#475569]">
                      {block.items.map((item, j) => (
                        <li key={j}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p key={i} className="text-[15px] leading-7 text-[#475569]">
                      {block.text}
                    </p>
                  )
                )}
              </article>
            )}

            <div className="mt-10 rounded-2xl border border-[#e8edf2] bg-[#f8f9fc] p-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
              <div>
                <p className="font-black text-[#0D1B2A]">{event.title}</p>
                <p className="text-sm text-[#64748b] mt-0.5">
                  {formatEventDate(event.event_date)} · {event.venue}
                </p>
              </div>
              <Link
                href={`/events/${event.id}#tickets-section`}
                className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-black text-white transition-all hover:opacity-90"
                style={{ background: accent }}
              >
                Get tickets
              </Link>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
