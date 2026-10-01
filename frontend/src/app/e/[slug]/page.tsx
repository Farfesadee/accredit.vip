"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient, API_BASE } from "@/lib/api-client";
import type { EventData } from "@/lib/api/events";
import { Skeleton } from "@/components/shared/loading-skeleton";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { GoBack } from "@/components/shared/go-back";
import { formatTimeForDisplay } from "@/lib/event-form-options";
import { Hourglass } from "lucide-react";

type PurchaseInfo = {
  purchase_id: number;
  reference: string;
  amount: number;
  quantity: number;
  authorization_url: string | null;
};

type PurchaseStatus = {
  id: number;
  reference: string;
  status: string;
  buyer_name: string;
  quantity: number;
  amount: number;
};

function PublicEventContent() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState<PurchaseInfo | null>(null);
  const [purchaseStatus, setPurchaseStatus] = useState<PurchaseStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (slug) {
      apiClient<EventData>(`/events/by-slug/${slug}`)
        .then(setEvent)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [slug]);

  useEffect(() => {
    const ref = searchParams.get("purchase") || searchParams.get("trxref");
    if (ref) {
      apiClient<PurchaseStatus>(`/tickets/purchases/${ref}`)
        .then((s) => {
          setPurchaseStatus(s);
          if (s.status === "completed") {
            router.push(`/ticket/${ref}`);
          }
        })
        .catch(() => {});
    }
  }, [searchParams]);

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setPurchasing(true);
    try {
      const res = await apiClient<PurchaseInfo>("/tickets/purchase", {
        method: "POST",
        body: {
          event_id: event!.id,
          buyer_name: buyerName,
          buyer_email: buyerEmail,
          buyer_phone: buyerPhone || null,
          quantity,
        },
      });
      setPurchaseResult(res);
      if (res.authorization_url) {
        window.location.href = res.authorization_url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed");
    }
    setPurchasing(false);
  };

  if (loading) return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b h-16" />
      <div className="flex-1 container mx-auto px-4 py-12 max-w-3xl space-y-6">
        <Skeleton className="h-10 w-2/3" />
        <div className="space-y-3">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-5 w-1/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-5 w-1/3" />
        </div>
      </div>
    </div>
  );
  if (!event) return (
    <div className="flex min-h-screen items-center justify-center flex-col gap-4">
      <p className="text-muted-foreground">Event not found</p>
      <Link href="/" className="text-primary underline underline-offset-4">Go Home</Link>
    </div>
  );

  const passPackages = event.pass_packages?.filter((item) => item.name || item.price || item.quantity) || [];
  const lineup = event.lineup?.filter((person) => person.role || person.name) || [];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Accredit<span className="text-primary">.vip</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link href="/attend">Discover</Link>
            <Link href="/login">Sign In</Link>
          </nav>
        </div>
      </header>

      <div className="flex-1 container mx-auto px-4 py-8 sm:py-12 max-w-3xl">
        <div className="mb-4"><GoBack fallback="/attend" /></div>
        {purchaseStatus && purchaseStatus.status !== "completed" ? (
          <div className="rounded-lg border p-8 text-center">
            <Hourglass className="mx-auto mb-4 h-12 w-12 text-[#1ABC9C]" aria-hidden="true" />
            <h2 className="text-2xl font-bold mb-2">Payment Pending</h2>
            <p className="text-muted-foreground">We&apos;re waiting for payment confirmation.</p>
            <p className="text-sm text-muted-foreground mt-2">Reference: {purchaseStatus.reference}</p>
          </div>
        ) : (
          <>
            <div className="rounded-lg border p-8 mb-8">
              <h1 className="text-3xl font-bold">{event.title}</h1>
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-medium text-foreground">Date:</span> {event.event_date}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-medium text-foreground">Time:</span> {formatTimeForDisplay(event.event_time)} {event.timezone}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-medium text-foreground">Venue:</span> {event.venue}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-medium text-foreground">Host:</span> {event.host_name}
                </div>
                {event.dress_code && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="font-medium text-foreground">Dress Code:</span> {event.dress_code}
                  </div>
                )}
                {event.description && (
                  <div className="pt-4">
                    <h3 className="font-semibold mb-2">About</h3>
                    <p className="text-muted-foreground">{event.description}</p>
                  </div>
                )}
                {lineup.length > 0 && (
                  <div className="pt-4">
                    <h3 className="font-semibold mb-3">Lineup</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {lineup.map((person, index) => (
                        <div key={`${person.role}-${person.name}-${index}`} className="rounded-lg border p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{person.role || "Guest"}</p>
                          <p className="font-semibold">{person.name || "To be announced"}</p>
                          {person.attach_headshot && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {person.headshot_source === "ai" ? "AI headshot requested for flyer" : "Headshot attached to flyer"}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {event.after_party_enabled && event.after_party_location && (
                  <div className="pt-4">
                    <h3 className="font-semibold mb-2">After Party</h3>
                    <p className="text-muted-foreground">
                      {event.after_party_location}
                      {event.after_party_time ? ` - ${formatTimeForDisplay(event.after_party_time)}` : ""}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {(event.ticket_price || passPackages.length > 0) && (
              <div className="text-center -mt-4 mb-8">
                <a
                  href="#tickets-section"
                  className="inline-block rounded-xl bg-primary text-primary-foreground font-black text-lg py-4 px-10 shadow-lg hover:opacity-90 transition-all"
                >
                  GET TICKET
                </a>
              </div>
            )}

            {event.ticket_price || passPackages.length > 0 ? (
              <div className="rounded-lg border p-8" id="tickets-section">
                <h2 className="text-xl font-bold mb-2">Get Tickets</h2>
                {passPackages.length > 0 && (
                  <div className="mb-6 grid gap-3 sm:grid-cols-2">
                    {passPackages.map((item, index) => (
                      <div key={`${item.name}-${index}`} className="rounded-lg border p-3">
                        <p className="font-semibold">{item.name || "Pass"}</p>
                        <p className="text-2xl font-bold text-primary">{item.price || "Free"}</p>
                        {item.quantity && <p className="text-xs text-muted-foreground">{item.quantity} available</p>}
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-3xl font-bold text-primary mb-6">
                  ₦{event.ticket_price?.toLocaleString() || "Select a package"}
                  <span className="text-sm font-normal text-muted-foreground"> per ticket</span>
                </p>
                {event.tickets_available !== null && (
                  <p className="text-sm text-muted-foreground mb-6">
                    {event.tickets_available} tickets remaining
                  </p>
                )}

                {error && (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive mb-4">
                    {error}
                  </div>
                )}

                <form onSubmit={handlePurchase} className="space-y-4">
                  <input
                    placeholder="Your Name"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    required
                  />
                  <input
                    type="email"
                    placeholder="Your Email"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    required
                  />
                  <input
                    placeholder="Phone (optional)"
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                  <div>
                    <label className="text-sm font-medium">Quantity</label>
                    <select
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm mt-1"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={purchasing || !event.ticket_price}
                    className="w-full rounded-lg bg-primary text-primary-foreground font-semibold py-3 px-6 hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {purchasing ? "Processing..." : event.ticket_price ? `Pay ₦${Math.round(event.ticket_price * quantity * 1.025).toLocaleString()}` : "Package checkout coming soon"}
                  </button>
                </form>
              </div>
            ) : (
              <div className="rounded-lg border p-8 text-center">
                <p className="text-muted-foreground">Free entry &middot; No tickets required</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function PublicEventBySlugPage() {
  return (
    <ErrorBoundary>
      <PublicEventContent />
    </ErrorBoundary>
  );
}
