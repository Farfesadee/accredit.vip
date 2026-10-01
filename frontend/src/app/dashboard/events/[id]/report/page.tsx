"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { Printer, ArrowLeft, AlertTriangle, Loader } from "lucide-react";
import Link from "next/link";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopbar } from "@/components/dashboard/topbar";

type Guest = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  rsvp_status: string;
  invite_sent: boolean;
  invite_attempts: number;
  invite_viewed_at: string | null;
  notes: string | null;
  tags: string[];
  created_at: string | null;
  qr_token: string | null;
  communication_status?: Record<string, { status: string }>;
};

type Sale = {
  id: number;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string | null;
  quantity: number;
  amount: number;
  reference: string;
  package_name: string | null;
  paid_at: string | null;
  created_at: string | null;
};

export default function EventReportPage() {
  const params = useParams();
  const id = params?.id as string;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [event, setEvent] = useState<any>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accred, setAccred] = useState<{ total_guests: number; checked_in: number; categories: { category: string; total: number; checked_in: number }[] } | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const reportTime = useMemo(() => new Date().toLocaleString(), []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiClient<any>(`/events/${id}`),
      apiClient<{ guests: Guest[] }>(`/events/${id}/guests?limit=1000`),
      apiClient<Sale[]>(`/tickets/events/${id}/purchases`).catch(() => [] as Sale[]),
    ])
      .then(([evt, gst, sls]) => {
        setEvent(evt);
        setGuests(gst.guests);
        setSales(Array.isArray(sls) ? sls : []);
      })
      .catch(() => setError("Failed to load report data."))
      .finally(() => setLoading(false));
  }, [id]);

  // Real-time accreditation analytics (refreshes every 15s)
  useEffect(() => {
    if (!id) return;
    let alive = true;
    const load = () => {
      apiClient<{ total_guests: number; checked_in: number; categories: { category: string; total: number; checked_in: number }[] }>(`/scanner/events/${id}/category-stats`)
        .then((d) => { if (alive) setAccred(d); })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [id]);

  const accepted = useMemo(() => guests.filter((g) => g.rsvp_status === "accepted"), [guests]);
  const declined = useMemo(() => guests.filter((g) => g.rsvp_status === "declined"), [guests]);
  const pending = useMemo(() => guests.filter((g) => g.rsvp_status === "pending"), [guests]);
  const sent = useMemo(() => guests.filter((g) => g.invite_sent), [guests]);
  const notSent = useMemo(() => guests.filter((g) => !g.invite_sent), [guests]);
  const hasContact = useMemo(() => guests.filter((g) => g.email || g.phone), [guests]);
  const noContact = useMemo(() => guests.filter((g) => !g.email && !g.phone), [guests]);
  const withNotes = useMemo(() => guests.filter((g) => g.notes), [guests]);
  const withTags = useMemo(() => guests.filter((g) => g.tags && g.tags.length > 0), [guests]);
  const viewed = useMemo(() => guests.filter((g) => g.invite_viewed_at), [guests]);
  const totalContactable = useMemo(() => guests.filter((g) => g.email || g.phone).length, [guests]);
  const rsvpRate = guests.length > 0 ? Math.round((accepted.length / guests.length) * 100) : 0;
  const responseRate = guests.length > 0 ? Math.round(((accepted.length + declined.length) / guests.length) * 100) : 0;
  const totalTicketsSold = useMemo(() => sales.reduce((n, s) => n + (Number(s.quantity) || 0), 0), [sales]);
  const totalRevenue = useMemo(() => sales.reduce((n, s) => n + (Number(s.amount) || 0), 0), [sales]);

  const channelStats = useMemo(() => {
    const stats: Record<string, { sent: number; delivered: number; read: number; failed: number }> = {};
    guests.forEach((g) => {
      if (g.communication_status) {
        Object.entries(g.communication_status).forEach(([ch, st]) => {
          if (!stats[ch]) stats[ch] = { sent: 0, delivered: 0, read: 0, failed: 0 };
          if (st.status === "delivered") stats[ch].delivered++;
          else if (st.status === "read") stats[ch].read++;
          else if (st.status === "failed") stats[ch].failed++;
          else stats[ch].sent++;
        });
      }
    });
    return stats;
  }, [guests]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-lg font-semibold text-slate-900 mb-2">Error Loading Report</p>
          <p className="text-sm text-slate-600 mb-4">{error}</p>
          <Link href={`/dashboard/events/${id}?tab=guests`} className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
            <ArrowLeft className="w-4 h-4" />
            Back to Event
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { font-size: 11pt; }
          @page { margin: 0.75in; }
          .break-after { page-break-after: always; }
          .report-sidebar-margin { margin-left: 0 !important; }
        }
        .print-only { display: none; }
      `}</style>

      <div className={`transition-all duration-300 no-print ${sidebarOpen ? "lg:ml-64" : "lg:ml-20"}`}>
        <DashboardTopbar
          title="Event Report"
          subtitle={event?.title}
          onMenuClick={() => setMobileNavOpen(true)}
        />
      </div>

      <div className="flex flex-1">
        <div className="no-print">
          <DashboardSidebar
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            mobileNavOpen={mobileNavOpen}
            onMobileNavClose={() => setMobileNavOpen(false)}
          />
        </div>

        <div className={`flex-1 min-w-0 px-4 py-6 transition-all duration-300 report-sidebar-margin ${sidebarOpen ? "lg:ml-64" : "lg:ml-20"}`}>
          <div className="container mx-auto max-w-7xl">

      <div className="flex items-center justify-between mb-6 no-print">
        <Link href={`/dashboard/events/${id}?tab=guests`} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Event
        </Link>
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors">
          <Printer className="w-4 h-4" />
          Print / Save PDF
        </button>
      </div>

        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-slate-900">{event?.title || "Event Report"}</h1>
          {event?.event_date && (
            <p className="text-slate-500 mt-2">
              {new Date(event.event_date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              {event.event_time && <> at {(() => { const p = event.event_time.split(":"); if (p.length < 2) return event.event_time; const h = parseInt(p[0]); return `${h % 12 || 12}:${p[1]} ${h >= 12 ? "PM" : "AM"}`; })()}</>}
            </p>
          )}
          {event?.venue && <p className="text-slate-500">{event.venue}</p>}
          <p className="text-xs text-slate-400 mt-1">Report generated {reportTime}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Guests", value: guests.length, color: "bg-slate-100 text-slate-900" },
            { label: "Accepted", value: accepted.length, color: "bg-emerald-100 text-emerald-900" },
            { label: "Pending", value: pending.length, color: "bg-amber-100 text-amber-900" },
            { label: "Declined", value: declined.length, color: "bg-red-100 text-red-900" },
          ].map((s) => (
            <div key={s.label} className={`rounded-lg p-4 ${s.color}`}>
              <p className="text-xs font-medium opacity-70">{s.label}</p>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="rounded-lg bg-indigo-50 p-4">
            <p className="text-xs font-medium text-indigo-600">RSVP Rate</p>
            <p className="text-xl font-bold text-indigo-900 mt-1">{rsvpRate}%</p>
          </div>
          <div className="rounded-lg bg-teal-50 p-4">
            <p className="text-xs font-medium text-teal-600">Response Rate</p>
            <p className="text-xl font-bold text-teal-900 mt-1">{responseRate}%</p>
          </div>
          <div className="rounded-lg bg-blue-50 p-4">
            <p className="text-xs font-medium text-blue-600">Invite Sent</p>
            <p className="text-xl font-bold text-blue-900 mt-1">{sent.length}</p>
          </div>
          <div className="rounded-lg bg-purple-50 p-4">
            <p className="text-xs font-medium text-purple-600">Invite Viewed</p>
            <p className="text-xl font-bold text-purple-900 mt-1">{viewed.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-600">Not Yet Sent</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{notSent.length}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-600">Has Contact</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{hasContact.length}</p>
          </div>
          <div className="rounded-lg bg-red-50 p-4">
            <p className="text-xs font-medium text-red-600">No Contact</p>
            <p className="text-xl font-bold text-red-900 mt-1">{noContact.length}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-600">Contactable</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{totalContactable}</p>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Accreditation (Live)</h2>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Auto-refreshes
            </span>
          </div>
          {accred ? (
            <>
              <div className="rounded-xl bg-slate-900 text-white p-5 mb-4">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs font-medium text-white/60">Checked in</p>
                    <p className="text-3xl font-black mt-1">{accred.checked_in} <span className="text-base font-semibold text-white/50">/ {accred.total_guests}</span></p>
                  </div>
                  <p className="text-2xl font-black text-teal-300">
                    {accred.total_guests > 0 ? Math.round((accred.checked_in / accred.total_guests) * 100) : 0}%
                  </p>
                </div>
                <div className="h-2.5 rounded-full bg-white/10 mt-4 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${accred.total_guests > 0 ? Math.round((accred.checked_in / accred.total_guests) * 100) : 0}%`,
                      background: "linear-gradient(90deg, #1ABC9C, #16A085)",
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {accred.categories.map((c) => {
                  const pct = c.total > 0 ? Math.round((c.checked_in / c.total) * 100) : 0;
                  const premium = /premium|vip/i.test(c.category);
                  return (
                    <div key={c.category} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-slate-900 truncate">{c.category}</p>
                        {premium && (
                          <span className="text-[10px] font-black uppercase tracking-wider text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full flex-shrink-0 ml-2">VIP</span>
                        )}
                      </div>
                      <p className="text-2xl font-black text-slate-900 mt-2">
                        {c.checked_in}<span className="text-sm font-semibold text-slate-400"> / {c.total}</span>
                      </p>
                      <div className="h-2 rounded-full bg-slate-100 mt-3 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: premium ? "linear-gradient(90deg, #1ABC9C, #0D1B2A)" : "#1ABC9C" }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1.5">{pct}% accredited</p>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400">Loading accreditation data…</p>
          )}
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Ticket Sales ({sales.length} order{sales.length === 1 ? "" : "s"})</h2>
          {sales.length === 0 ? (
            <p className="text-sm text-slate-400">No ticket sales yet.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="rounded-lg bg-emerald-50 p-4">
                  <p className="text-xs font-medium text-emerald-600">Orders</p>
                  <p className="text-xl font-bold text-emerald-900 mt-1">{sales.length}</p>
                </div>
                <div className="rounded-lg bg-teal-50 p-4">
                  <p className="text-xs font-medium text-teal-600">Tickets sold</p>
                  <p className="text-xl font-bold text-teal-900 mt-1">{totalTicketsSold}</p>
                </div>
                <div className="rounded-lg bg-blue-50 p-4">
                  <p className="text-xs font-medium text-blue-600">Revenue</p>
                  <p className="text-xl font-bold text-blue-900 mt-1">{totalRevenue.toLocaleString()}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Buyer</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Package</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Qty</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Amount</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Reference</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((s) => (
                      <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-sm font-medium text-slate-900 whitespace-nowrap">
                          {s.buyer_name}
                          <span className="block text-xs font-normal text-slate-500">{s.buyer_email}</span>
                        </td>
                        <td className="py-2.5 px-3 text-sm text-slate-600 whitespace-nowrap">{s.package_name || "—"}</td>
                        <td className="py-2.5 px-3 text-sm font-bold text-slate-900 text-center">{s.quantity}</td>
                        <td className="py-2.5 px-3 text-sm text-slate-900 text-right whitespace-nowrap">{Number(s.amount).toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-xs font-mono text-slate-600 whitespace-nowrap">{s.reference}</td>
                        <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">
                          {s.paid_at ? new Date(s.paid_at).toLocaleString() : s.created_at ? new Date(s.created_at).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {Object.keys(channelStats).length > 0 && (
        <div className="mb-8">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Channel Delivery Stats</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {Object.entries(channelStats).map(([ch, st]) => (
                <div key={ch} className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold text-slate-600 uppercase mb-2">{ch}</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">Sent</span><span className="font-medium">{st.sent + st.delivered + st.read}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Delivered</span><span className="font-medium text-emerald-700">{st.delivered}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Read</span><span className="font-medium text-blue-700">{st.read}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Failed</span><span className="font-medium text-red-700">{st.failed}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-lg font-bold text-slate-900 mb-4">Guest List ({guests.length})</h2>
        {guests.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">No guests added yet.</p>
        ) : (
          <div className="overflow-x-auto mb-8">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Name</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Contact</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">RSVP</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Invite</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Notes</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Tags</th>
                </tr>
              </thead>
              <tbody>
                {guests.map((g) => (
                  <tr key={g.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2.5 px-3 text-sm font-medium text-slate-900 whitespace-nowrap">{g.name}</td>
                    <td className="py-2.5 px-3 text-sm text-slate-600 whitespace-nowrap">
                      {[g.email, g.phone].filter(Boolean).join(" · ") || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        g.rsvp_status === "accepted" ? "bg-emerald-100 text-emerald-700" :
                        g.rsvp_status === "declined" ? "bg-red-100 text-red-700" :
                        "bg-amber-100 text-amber-700"
                      }`}>
                        {g.rsvp_status === "accepted" ? "Accepted" : g.rsvp_status === "declined" ? "Declined" : "Pending"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-xs text-slate-600">
                      {g.invite_sent ? `Sent (${g.invite_attempts})` : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-sm text-slate-600 max-w-[200px] truncate">
                      {g.notes || "—"}
                    </td>
                    <td className="py-2.5 px-3">
                      {g.tags && g.tags.length > 0 ? (
                        <div className="flex gap-1 flex-wrap">
                          {g.tags.map((t) => (
                            <span key={t} className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">{t}</span>
                          ))}
                        </div>
                      ) : <span className="text-xs text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {withNotes.length > 0 && (
          <div className="break-after">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Guest Notes ({withNotes.length})</h2>
            <div className="space-y-2">
              {withNotes.map((g) => (
                <div key={g.id} className="border border-slate-200 rounded-lg p-3">
                  <p className="font-medium text-sm text-slate-900">{g.name}</p>
                  <p className="text-sm text-slate-600 mt-0.5">{g.notes}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {withTags.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Tag Summary</h2>
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set(guests.flatMap((g) => g.tags || []))).map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-slate-100 text-slate-700">
                  {tag}
                  <span className="text-xs text-slate-400">({guests.filter((g) => (g.tags || []).includes(tag)).length})</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-12 pt-6 border-t border-slate-200 text-center text-xs text-slate-400">
          <p>Accredit Interactive: {event?.title}: Report generated {reportTime}</p>
        </div>

          </div>
        </div>
      </div>
    </div>
  );
}
