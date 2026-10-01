"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { apiClient } from "@/lib/api-client";
import { getEvent, type EventData } from "@/lib/api/events";
import { Menu, X, MapPin, Calendar, Clock, Edit2, Trash2, Users, BarChart3, Mail, Settings, Plus, ArrowLeft, Ticket } from "lucide-react";

export default function CouponsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const eventId = params?.id;
  const [event, setEvent] = useState<EventData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [code, setCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountFixed, setDiscountFixed] = useState("");
  const [maxUses, setMaxUses] = useState("");

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (user && eventId) {
      getEvent(Number(eventId)).then(setEvent).catch(() => {});
      apiClient<any[]>(`/coupons/${eventId}`).then(setCoupons).catch(() => {});
    }
  }, [user, eventId]);

  const createCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient("/coupons", {
        method: "POST",
        body: {
          event_id: Number(eventId),
          code,
          discount_percent: discountPercent ? Number(discountPercent) : null,
          discount_fixed: discountFixed ? Number(discountFixed) : null,
          max_uses: Number(maxUses) || 0,
        },
      });
      setCode("");
      setDiscountPercent("");
      setDiscountFixed("");
      const updated = await apiClient<any[]>(`/coupons/${eventId}`);
      setCoupons(updated);
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-white flex">
      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-screen w-96 bg-white border-r border-slate-200 z-50 transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Event Info */}
        <div className="p-6 border-b border-slate-200 space-y-4">
          {/* Cover Image or Gradient */}
          <div className="h-32 bg-gradient-to-br from-slate-300 to-slate-400 rounded-lg" />

          {/* Event Title */}
          <div>
            <h2 className="text-lg font-bold text-slate-900">{event?.title || "Event"}</h2>
            <p className="text-xs text-slate-500 mt-1">Event ID: {eventId}</p>
          </div>

          {/* Event Details */}
          <div className="space-y-2 text-sm">
            {event?.venue && (
              <div className="flex items-start gap-2 text-slate-700">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{event.venue}</span>
              </div>
            )}
            {event?.event_date && (
              <div className="flex items-center gap-2 text-slate-700">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span>{new Date(event.event_date).toLocaleDateString()}</span>
              </div>
            )}
            {event?.event_time && (
              <div className="flex items-center gap-2 text-slate-700">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span>{event.event_time}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => router.push(`/dashboard/events/${eventId}/edit`)}
              className="flex-1 h-9 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-900 flex items-center justify-center gap-2 transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="flex-1 h-9 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors"
            >
              View Details
            </button>
          </div>

          {/* RSVP Stats */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-xs text-emerald-600 font-medium">Accepted</p>
              <p className="text-lg font-bold text-emerald-900">0</p>
            </div>
            <div className="rounded-lg bg-slate-100 p-3">
              <p className="text-xs text-slate-600 font-medium">Total</p>
              <p className="text-lg font-bold text-slate-900">0</p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="p-4 space-y-1">
          <a
            href={`/dashboard/events/${eventId}`}
            className="block px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Overview
          </a>
          <a
            href={`/dashboard/events/${eventId}#guests`}
            className="block px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Guests
          </a>
          <a
            href={`/dashboard/events/${eventId}#invites`}
            className="block px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Send Invites
          </a>
          <a
            href={`/dashboard/events/${eventId}/questions`}
            className="block px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Questions
          </a>
          <a
            href={`/dashboard/events/${eventId}/reminders`}
            className="block px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Reminders
          </a>
          <a
            href={`/dashboard/events/${eventId}/coupons`}
            className="block px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium transition-colors"
          >
            Coupons
          </a>
          <a
            href={`/dashboard/events/${eventId}/templates`}
            className="block px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Templates
          </a>
          <a
            href={`/dashboard/events/${eventId}/waitlist`}
            className="block px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Waitlist
          </a>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="border-b border-slate-200 bg-white sticky top-0 z-30">
          <div className="flex items-center gap-4 px-6 py-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <a
              href="/dashboard"
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </a>
            <h1 className="text-lg font-bold text-slate-900 ml-auto">Coupon Codes</h1>
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl space-y-6">
            {/* Create Coupon Form */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Create New Coupon
              </h2>
              <form onSubmit={createCoupon} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Code</label>
                  <input
                    placeholder="Leave empty for random code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Discount %</label>
                    <input
                      placeholder="e.g. 10"
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(e.target.value)}
                      type="number"
                      className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Fixed Discount</label>
                    <input
                      placeholder="₦ amount"
                      value={discountFixed}
                      onChange={(e) => setDiscountFixed(e.target.value)}
                      type="number"
                      className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Max Uses</label>
                  <input
                    placeholder="0 = unlimited"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    type="number"
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full h-10 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium transition-colors"
                >
                  Create Coupon
                </button>
              </form>
            </div>

            {/* Coupons List */}
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Ticket className="w-5 h-5" />
                Active Coupons ({coupons.length})
              </h2>
              {coupons.length === 0 ? (
                <div className="rounded-xl border border-slate-200 border-dashed p-12 text-center bg-slate-50">
                  <p className="text-sm text-slate-600">No coupons created yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {coupons.map((c) => (
                    <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900">{c.code}</p>
                          <p className="text-sm text-slate-600 mt-1">
                            {c.discount_percent
                              ? `${c.discount_percent}% off`
                              : c.discount_fixed
                                ? `₦${c.discount_fixed.toLocaleString()} off`
                                : "No discount"}
                          </p>
                        </div>
                        <div className="text-right text-sm text-slate-600 ml-4 flex-shrink-0">
                          <p className="font-medium">{c.used_count}/{c.max_uses || "∞"} used</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
