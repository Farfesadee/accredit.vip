"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getPublicEvents, type EventData, type EventFilters } from "@/lib/api/events";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { Navbar } from "@/components/shared/navbar";
import { Footer } from "@/components/shared/footer";
import { ReminderBanner } from "@/components/shared/reminder-banner";
import { X, Share2, Bookmark, BookmarkCheck } from "lucide-react";
import { getCurrencySymbol } from "@/lib/event-form-options";
import { API_BASE } from "@/lib/api-client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

function ShareBtn({ event }: { event: EventData }) {
  const [copied, setCopied] = useState(false);
  const url = `${SITE_URL}/events/${event.id}`;
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation();
        if (navigator.share) navigator.share({ title: event.title, url }).catch(() => {});
        else navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
      }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all duration-200 hover:scale-105 bounce-share"
      style={{ background: "rgba(26, 188, 156,0.85)" }}
    >
      <Share2 className="w-3.5 h-3.5" />
      {copied ? "Copied!" : "Share"}
    </button>
  );
}

function BookmarkBtn({ event }: { event: EventData }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const savedIds: number[] = JSON.parse(localStorage.getItem("bookmarked_events") || "[]");
    setSaved(savedIds.includes(event.id));
  }, [event.id]);
  const toggle = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const savedIds: number[] = JSON.parse(localStorage.getItem("bookmarked_events") || "[]");
    let newIds: number[];
    if (savedIds.includes(event.id)) {
      newIds = savedIds.filter(id => id !== event.id);
      // Remove from reminders too
      const reminders: Record<number, string> = JSON.parse(localStorage.getItem("event_reminders") || "{}");
      delete reminders[event.id];
      localStorage.setItem("event_reminders", JSON.stringify(reminders));
    } else {
      newIds = [...savedIds, event.id];
      // Save reminder with event title
      const reminders: Record<number, string> = JSON.parse(localStorage.getItem("event_reminders") || "{}");
      reminders[event.id] = event.title;
      localStorage.setItem("event_reminders", JSON.stringify(reminders));
    }
    localStorage.setItem("bookmarked_events", JSON.stringify(newIds));
    setSaved(!saved);
  };
  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 hover:scale-105 bounce-share ${saved ? "text-[#1ABC9C]" : "text-white"}`}
      style={{ background: saved ? "rgba(26, 188, 156,0.15)" : "rgba(255,255,255,0.2)" }}
    >
      {saved ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
      {saved ? "Saved" : "Remind Me"}
    </button>
  );
}

const UPLOAD_BASE = API_BASE.replace(/\/api\/v1\/?$/, "");

function coverImgUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${UPLOAD_BASE}${path}`;
}

function formatCardDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatCardTime(timeStr: string): string {
  if (!timeStr) return "";
  const [h, min] = timeStr.split(":").map(Number);
  return `${h % 12 || 12}:${String(min).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function formatDistance(km: number | undefined): string | null {
  if (km === undefined || km === null) return null;
  if (km < 1) return `${Math.round(km * 1000)}m away`;
  return `${km.toFixed(1)}km away`;
}

const CATEGORIES = [
  { value: "", label: "All Events" },
  { value: "concert", label: "Concert" },
  { value: "conference", label: "Conference" },
  { value: "festival", label: "Festival" },
  { value: "nightlife", label: "Nightlife" },
  { value: "sports", label: "Sports" },
  { value: "corporate", label: "Corporate" },
  { value: "private", label: "Private" },
  { value: "wedding", label: "Wedding" },
];

function CategoryIcon({ cat, className = "w-5 h-5" }: { cat: string; className?: string }) {
  const cls = className;
  const icons: Record<string, React.ReactNode> = {
    concert: <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>,
    conference: <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    festival: <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
    nightlife: <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>,
    sports: <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    corporate: <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
    private: <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
    wedding: <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
  };
  return <>{icons[cat] || <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}</>;
}

function EventCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#f8f9fc", border: "1px solid #e8edf2" }}>
      <div className="skeleton h-44 rounded-none" />
      <div className="p-5 space-y-3">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
        <div className="skeleton h-6 w-20 rounded-full mt-2" />
      </div>
    </div>
  );
}

const MONTHS = [
  { value: 0, label: "All Months" },
  { value: 1, label: "January" }, { value: 2, label: "February" }, { value: 3, label: "March" },
  { value: 4, label: "April" }, { value: 5, label: "May" }, { value: 6, label: "June" },
  { value: 7, label: "July" }, { value: 8, label: "August" }, { value: 9, label: "September" },
  { value: 10, label: "October" }, { value: 11, label: "November" }, { value: 12, label: "December" },
];

function AttendContent() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("Lagos");
  const [month, setMonth] = useState(0);
  const [priceType, setPriceType] = useState("");
  const [nearLat, setNearLat] = useState<number | undefined>(undefined);
  const [nearLng, setNearLng] = useState<number | undefined>(undefined);
  const [findingLocation, setFindingLocation] = useState(false);
  const [, setGeoError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("latest");

  const buildFilters = () => ({
    search: search || undefined,
    category: category || undefined,
    location: location || undefined,
    month: month || undefined,
    price_type: priceType || undefined,
    sort_by: sortBy || undefined,
    near_lat: nearLat,
    near_lng: nearLng,
    radius_km: nearLat ? 50 : undefined,
  });

  const loadEvents = useCallback(async (filters?: EventFilters) => {
    setLoading(true);
    try {
      const allEvents = await getPublicEvents(filters);
      const spotlight = allEvents.filter((e: any) => e.spotlight);
      setEvents(spotlight);
    } catch {}
    setLoading(false);
  }, []);

  const [pastEvents, setPastEvents] = useState<any[]>([]);
  useEffect(() => {
    getPublicEvents({ past_only: true }).then(setPastEvents).catch(() => {});
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadEvents(buildFilters());
  };

  const handleNearMe = () => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser");
      return;
    }
    setFindingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setNearLat(lat);
        setNearLng(lng);
        setFindingLocation(false);
        loadEvents({ ...buildFilters(), near_lat: lat, near_lng: lng, radius_km: 50 });
      },
      (err) => {
        setFindingLocation(false);
        setGeoError(err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleReset = () => {
    setSearch(""); setCategory(""); setLocation("Lagos"); setMonth(0); setPriceType(""); setSortBy("latest");
    setNearLat(undefined); setNearLng(undefined);
    loadEvents({ location: "Lagos" });
  };

  const filtersActive = search || category || location !== "Lagos" || month || priceType || sortBy !== "latest" || nearLat !== undefined;

  return (
    <div id="main-content" className="flex min-h-screen flex-col bg-white">
      <style>{`
        @keyframes gentleBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .bounce-share {
          animation: gentleBounce 0.8s ease-in-out 3;
        }
        .bounce-share:hover {
          animation: gentleBounce 0.6s ease-in-out infinite;
        }
      `}</style>
      <Navbar variant="light" />

      {/* Compact search bar: keeps events above the fold */}
      <div className="bg-[#0D1B2A] px-4 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-white leading-tight">Discover Events</h1>
            <p className="text-xs text-white/60 mt-0.5">Concerts, conferences, weddings &amp; more across Africa</p>
          </div>
          <form onSubmit={handleSearch} className="flex-1 flex gap-2 sm:max-w-lg sm:ml-auto">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search events, venues..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-white/20 bg-white/10 text-sm text-white placeholder-white/50 outline-none focus:border-white/40"
              />
            </div>
            <button type="submit" className="btn-primary h-10 px-5 text-sm flex-shrink-0 rounded-xl">
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Filters bar */}
      <div className="sticky top-16 z-30 bg-[#0D1B2A] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-3">
          {/* Category pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => {
                  setCategory(cat.value);
                  loadEvents({ ...buildFilters(), category: cat.value || undefined });
                }}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: category === cat.value ? "linear-gradient(135deg, #1ABC9C, #16A085)" : "rgba(255,255,255,0.15)",
                  color: category === cat.value ? "white" : "rgba(255,255,255,0.8)",
                  boxShadow: category === cat.value ? "0 4px 14px rgba(26, 188, 156,0.3)" : "none",
                  border: category === cat.value ? "none" : "1px solid rgba(255,255,255,0.2)",
                }}
              >
                <CategoryIcon cat={cat.value} className="w-4 h-4" />
                {cat.label}
              </button>
            ))}
          </div>
          {/* Location, Month, Price filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <input type="text" placeholder="City or state..." value={location}
                onChange={(e) => setLocation(e.target.value)}
                onBlur={() => { setNearLat(undefined); setNearLng(undefined); loadEvents(buildFilters()); }}
                className="w-full h-9 pl-8 pr-3 rounded-lg border border-white/20 bg-white/10 text-xs text-white placeholder-white/50 outline-none focus:border-white/40"
              />
            </div>
            <button onClick={handleNearMe} disabled={findingLocation}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold transition-all"
              style={{ background: nearLat ? "linear-gradient(135deg, #1ABC9C, #16A085)" : "rgba(255,255,255,0.15)", color: nearLat ? "white" : "rgba(255,255,255,0.8)", border: nearLat ? "none" : "1px solid rgba(255,255,255,0.2)" }}
            >
              {findingLocation ? (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              )}
              {nearLat ? "Nearby" : "Near Me"}
            </button>
            <select value={month} onChange={(e) => { setMonth(Number(e.target.value)); loadEvents({ ...buildFilters(), month: Number(e.target.value) || undefined }); }}
              className="h-9 px-3 rounded-lg border border-white/20 text-xs outline-none focus:border-white/40"
              style={{ background: "rgba(13,27,42,0.6)", color: "white" }}
            >
              {MONTHS.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
            </select>
            <div className="flex items-center gap-1 bg-white/10 rounded-lg p-0.5 border border-white/20">
              {["", "free", "paid"].map((pt) => (
                <button key={pt} onClick={() => { setPriceType(pt); loadEvents({ ...buildFilters(), price_type: pt || undefined }); }}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                  style={{ background: priceType === pt ? "rgba(255,255,255,0.2)" : "transparent", color: priceType === pt ? "#1ABC9C" : "rgba(255,255,255,0.7)", boxShadow: priceType === pt ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}
                >{pt === "" ? "All" : pt === "free" ? "Free" : "Paid"}</button>
              ))}
            </div>
            <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); loadEvents({ ...buildFilters(), sort_by: e.target.value || undefined }); }}
              className="h-9 px-3 rounded-lg border border-white/20 text-xs outline-none focus:border-white/40"
              style={{ background: "rgba(13,27,42,0.6)", color: "white" }}
            >
              <option value="latest">Latest</option>
              <option value="soonest">Soonest</option>
              <option value="name">Name</option>
            </select>
            {filtersActive && (
              <button onClick={handleReset} className="inline-flex items-center gap-1 text-xs font-medium text-white/60 hover:text-white transition-colors">
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Events Grid */}
      <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => <EventCardSkeleton key={i} />)}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-24">
            <div
              className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-3xl mb-6"
              style={{ background: "rgba(26, 188, 156,0.08)" }}
            >
              <span className="text-3xl" style={{ color: "#1ABC9C" }}><CategoryIcon cat="" className="w-10 h-10" /></span>
            </div>
            <h3 className="text-xl font-bold text-[#0D1B2A] mb-2">
              {filtersActive ? "No matching events" : pastEvents.length > 0 ? "No upcoming events" : "No events yet"}
            </h3>
            <p className="text-gray-400 text-sm mb-8">
              {filtersActive
                ? "Try different search terms or clear your filters."
                : pastEvents.length > 0
                ? "Check the previous events below: new ones are being added daily."
                : "Check back soon: events are being added daily."}
            </p>
            {(filtersActive || pastEvents.length === 0) && (
            <Link href="/register" className="btn-primary inline-flex">
              Create an Event
            </Link>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-400 mb-6">
              Showing <strong className="text-[#0D1B2A]">{events.length}</strong> event{events.length !== 1 ? "s" : ""}
            </p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => {
                const img = coverImgUrl(event.cover_image);
                const pkgs = (event.pass_packages || []).filter((p: any) => p && (p.name || p.price));
                const paidPkgPrices = pkgs.map((p: any) => Number(p.price) || 0).filter((n: number) => n > 0);
                const minPkgPrice = paidPkgPrices.length ? Math.min(...paidPkgPrices) : 0;
                const basePrice = Number(event.ticket_price) || 0;
                const displayPrice = basePrice > 0 ? basePrice : minPkgPrice;
                const isFree = displayPrice <= 0;
                const priceBadge = isFree
                  ? "FREE"
                  : basePrice > 0
                    ? `${getCurrencySymbol(event.currency || "NGN")}${displayPrice.toLocaleString()}`
                    : `From ${getCurrencySymbol(event.currency || "NGN")}${displayPrice.toLocaleString()}`;
                return (
                  <Link key={event.id} href={`/events/${event.id}`} className="block group">
                    <div className="premium-card h-full flex flex-col overflow-hidden">
                      {/* Cover image or category placeholder */}
                      <div className="relative h-44 overflow-hidden bg-[#f4f6fb]">
                        {img ? (
                          <>
                            <img
                              src={img}
                              alt={event.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                          </>
                        ) : (
                          <div className="h-full flex items-center justify-center" style={{ color: "#cbd5e1" }}>
                            <CategoryIcon cat={event.category || event.event_type || ""} className="w-12 h-12" />
                          </div>
                        )}
                        {/* Price badge */}
                        <div className="absolute top-3 right-3">
                          <span
                            className="text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm"
                            style={{ background: isFree ? "#10b981" : "#1ABC9C", color: "white" }}
                          >
                            {priceBadge}
                          </span>
                        </div>
                        {/* Action buttons overlay */}
                        <div className="absolute bottom-3 left-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <ShareBtn event={event} />
                          <BookmarkBtn event={event} />
                        </div>
                      </div>

                      <div className="p-5 flex flex-col flex-1">
                        <span className="badge-teal text-[10px] mb-3 self-start">
                          {(event.category || event.event_type || "Event").toUpperCase()}
                        </span>
                        <h3 className="font-bold text-[#0D1B2A] text-base line-clamp-2 mb-2 group-hover:text-[#1ABC9C] transition-colors">
                          {event.title}
                        </h3>
                        <div className="mt-auto pt-3 space-y-1.5 border-t border-[#e8edf2]">
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="truncate">{event.venue}</span>
                            {event.distance_km !== undefined && (
                              <span className="flex-shrink-0 font-medium" style={{ color: "#1ABC9C" }}>{formatDistance(event.distance_km)}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {formatCardDate(event.event_date)} · {formatCardTime(event.event_time)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Previous events: ended but still visible for records */}
      {!loading && !filtersActive && pastEvents.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 w-full">
          <h2 className="text-lg font-extrabold text-[#0D1B2A] mb-1">Previous events</h2>
          <p className="text-xs text-gray-400 mb-6">These events have ended. Ticket sales are closed.</p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pastEvents.map((event) => {
              const img = coverImgUrl(event.cover_image);
              return (
                <Link key={event.id} href={`/events/${event.id}`} className="block group">
                  <div className="premium-card h-full flex flex-col overflow-hidden opacity-90">
                    <div className="relative h-44 overflow-hidden bg-[#f4f6fb]">
                      {img ? (
                        <>
                          <img
                            src={img}
                            alt={event.title}
                            className="w-full h-full object-cover grayscale-[35%] group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                        </>
                      ) : (
                        <div className="h-full flex items-center justify-center" style={{ color: "#cbd5e1" }}>
                          <CategoryIcon cat={event.category || event.event_type || ""} className="w-12 h-12" />
                        </div>
                      )}
                      <div className="absolute top-3 right-3">
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm bg-slate-500 text-white">
                          ENDED
                        </span>
                      </div>
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      <span className="badge-teal text-[10px] mb-3 self-start">
                        {(event.category || event.event_type || "Event").toUpperCase()}
                      </span>
                      <h3 className="font-bold text-[#0D1B2A] text-base line-clamp-2 mb-2 group-hover:text-[#1ABC9C] transition-colors">
                        {event.title}
                      </h3>
                      <div className="mt-auto pt-3 space-y-1.5 border-t border-[#e8edf2]">
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          </svg>
                          <span className="truncate">{event.venue}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {formatCardDate(event.event_date)} · {formatCardTime(event.event_time)}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <Footer />

      <ReminderBanner />
    </div>
  );
}

export default function AttendPage() {
  return (
    <ErrorBoundary>
      <AttendContent />
    </ErrorBoundary>
  );
}
