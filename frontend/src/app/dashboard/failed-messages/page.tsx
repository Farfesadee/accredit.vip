"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Menu, X, LayoutGrid, Calendar, Plus, Wallet as WalletIcon, AlertTriangle, Download, Filter, RefreshCw, LogOut, Lock, ChevronDown, ChevronUp, MessageCircle, Mail } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

interface FailedMessage {
  id: number;
  event_id: number;
  event_title: string;
  guest_name: string;
  channel: string;
  status: string;
  contact: string;
  error: string;
  error_meaning: string;
  sent_at: string;
  created_at: string;
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visibleStart = local.slice(0, Math.min(8, local.length));
  const visibleEnd = local.length > 1 ? local.slice(-1) : "";
  return `${visibleStart}******${visibleEnd}@${domain}`;
}

export default function FailedMessagesPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [messages, setMessages] = useState<FailedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [channelFilter, setChannelFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    fetchMessages();
  }, [user, authLoading, router]);

  const getEventIdFilter = () => {
    if (typeof window === "undefined") return undefined;
    const params = new URLSearchParams(window.location.search);
    const val = params.get("event_id");
    return val ? parseInt(val) || undefined : undefined;
  };

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (channelFilter !== "all") params.set("channel", channelFilter);
      const eventId = getEventIdFilter();
      if (eventId) params.set("event_id", String(eventId));
      const qs = params.toString();
      const url = "/api/v1/failed-messages" + (qs ? `?${qs}` : "");
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMessages(Array.isArray(data) ? data : []);
      }
    } catch {}
    setLoading(false);
  };

  const handleDownloadCsv = () => {
    const params = new URLSearchParams();
    if (channelFilter !== "all") params.set("channel", channelFilter);
    const eventId = getEventIdFilter();
    if (eventId) params.set("event_id", String(eventId));
    const qs = params.toString();
    const url = "/api/v1/failed-messages/export" + (qs ? `?${qs}` : "");
    window.open(url, "_blank");
  };

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const filtered = messages.filter((m) =>
    m.guest_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.event_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.contact.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.error.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fc]">
        <div className="flex items-center gap-2 text-[#64748b]">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-[#f8f9fc]">
      {mobileNavOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileNavOpen(false)} />
      )}

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4">
            <h2 className="text-lg font-bold text-[#0D1B2A] mb-2">Sign Out?</h2>
            <p className="text-[#64748b] mb-6">Are you sure you want to sign out?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 px-4 py-2 rounded-lg border border-[#e8edf2] text-[#0D1B2A] font-semibold hover:bg-[#f8f9fc] transition-colors">Cancel</button>
              <button onClick={handleLogout} className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors">Sign Out</button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex-col flex-shrink-0 transition-all duration-300 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 lg:static lg:flex`}
        style={{
          background: "#0D1B2A",
          width: sidebarOpen ? "256px" : "80px",
        }}
      >
        <div className="flex items-center justify-between h-24 px-4 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Link href="/" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
            <Image src="/logo-mark.png" alt="" width={366} height={372} className="h-10 w-auto object-contain flex-shrink-0" />
            {sidebarOpen && <Image src="/logo-text.png" alt="Accredit Interactive" width={594} height={152} className="h-8 w-auto object-contain min-w-0" />}
          </Link>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0 hidden lg:block ml-2"
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? <X className="w-5 h-5 text-white/80" /> : <Menu className="w-5 h-5 text-white/80" />}
          </button>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {sidebarOpen && <p className="px-3 text-[10px] font-bold text-white/25 uppercase tracking-widest mb-3">Main Menu</p>}
          {[
            { href: "/dashboard", label: "Dashboard", icon: <LayoutGrid className="w-4 h-4" /> },
            { href: "/dashboard/events", label: "Events", icon: <Calendar className="w-4 h-4" /> },
            { href: "/dashboard/create", label: "Create Event", icon: <Plus className="w-4 h-4" /> },
            { href: "/dashboard/wallet", label: "Wallet", icon: <WalletIcon className="w-4 h-4" /> },
            { href: "/dashboard/failed-messages", label: "Failed Messages", icon: <AlertTriangle className="w-4 h-4" /> },
          ].map((item) => {
            const isActive = item.href === "/dashboard/failed-messages";
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileNavOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group"
                style={{
                  background: isActive ? "rgba(239,68,68,0.15)" : "transparent",
                  color: isActive ? "#EF4444" : "rgba(255,255,255,0.6)",
                }}
                title={!sidebarOpen ? item.label : ""}
              >
                <span className={isActive ? "text-[#EF4444]" : "text-white/40"}>{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}

          {sidebarOpen && (
            <div className="pt-4 mt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="px-3 text-[10px] font-bold text-white/25 uppercase tracking-widest mb-3">Discover</p>
              <Link
                href="/attend"
                onClick={() => setMobileNavOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/08 transition-all"
              >
                <LayoutGrid className="w-4 h-4" />
                Browse Events
              </Link>
            </div>
          )}
        </nav>

        <div className="px-3 py-4 flex-shrink-0 space-y-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: "linear-gradient(135deg, #1ABC9C, #16A085)" }}>
              {user?.full_name?.charAt(0) || "U"}
            </div>
            {sidebarOpen && (
              <div className="min-w-0 flex-1">
                <p className="text-white text-xs font-semibold truncate">{user?.full_name}</p>
                <p className="text-white/40 text-xs truncate" title={user?.email && maskEmail(user.email)}>{user?.email && maskEmail(user.email)}</p>
              </div>
            )}
          </div>

          {sidebarOpen && (
            <>
              <Link href="/dashboard/change-password" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#1ABC9C] bg-[#1ABC9C]/10 hover:bg-[#1ABC9C]/20 transition-all w-full">
                <Lock className="w-4 h-4" />
                Change Password
              </Link>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-50 border-2 border-red-200 text-red-600 hover:bg-red-100 hover:border-red-400 font-bold text-sm transition-all"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center justify-between px-6 flex-shrink-0" style={{ background: "white", borderBottom: "1px solid #e8edf2" }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileNavOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <Menu className="w-5 h-5 text-[#0D1B2A]" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-[#0D1B2A]">Failed Messages</h1>
              <p className="text-xs text-gray-400">Delivery failures across all events</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadCsv}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download CSV
            </button>
          </div>
        </header>

        <main className="flex-1 px-6 py-8 overflow-auto">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Total Failures", value: messages.length, color: "#EF4444", bg: "rgba(239,68,68,0.08)" },
              { label: "Email", value: messages.filter(m => m.channel === "email").length, color: "#3B82F6", bg: "rgba(59,130,246,0.08)" },
              { label: "WhatsApp", value: messages.filter(m => m.channel === "whatsapp").length, color: "#22C55E", bg: "rgba(34,197,94,0.08)" },
              { label: "SMS", value: messages.filter(m => m.channel === "sms").length, color: "#8B5CF6", bg: "rgba(139,92,246,0.08)" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl p-4 flex items-center gap-4" style={{ background: "white", border: "1px solid #e8edf2" }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: stat.bg, color: stat.color }}>
                  {stat.label === "Total Failures" ? <AlertTriangle className="w-5 h-5" /> :
                   stat.label === "Email" ? <Mail className="w-5 h-5" /> :
                   stat.label === "WhatsApp" ? <MessageCircle className="w-5 h-5" /> :
                   <Mail className="w-5 h-5" />}
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#0D1B2A]">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by guest, event, or error..."
                className="w-full h-11 pl-4 pr-4 rounded-lg border border-[#d9e2ec] text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400"
              />
            </div>
            <div className="flex gap-3">
              <select
                value={channelFilter}
                onChange={(e) => { setChannelFilter(e.target.value); }}
                className="h-11 px-3 rounded-lg border border-[#d9e2ec] text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 bg-white"
              >
                <option value="all">All Channels</option>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
              </select>
              <button
                onClick={() => { setChannelFilter("all"); setSearchQuery(""); fetchMessages(); }}
                className="px-4 py-2 rounded-lg border border-[#e8edf2] text-[#64748b] font-semibold hover:bg-[#f8f9fc] transition-colors text-sm"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-[#e8edf2] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: "#f8f9fc", borderBottom: "1px solid #e8edf2" }}>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#64748b] uppercase tracking-wider">Event</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#64748b] uppercase tracking-wider">Guest</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#64748b] uppercase tracking-wider">Channel</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#64748b] uppercase tracking-wider">Contact</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#64748b] uppercase tracking-wider">Error</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#64748b] uppercase tracking-wider">Meaning</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-[#64748b] uppercase tracking-wider">Sent At</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">Loading...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">No failed messages found</td></tr>
                  ) : filtered.map((m) => (
                    <tr key={m.id} className="hover:bg-[#f8f9fc] transition-colors" style={{ borderBottom: "1px solid #f0f2f5" }}>
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/events/${m.event_id}`} className="text-sm font-semibold text-[#0D1B2A] hover:text-[#1ABC9C] transition-colors">
                          {m.event_title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-[#0D1B2A]">{m.guest_name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                          m.channel === "email" ? "bg-blue-100 text-blue-700" :
                          m.channel === "whatsapp" ? "bg-emerald-100 text-emerald-700" :
                          "bg-purple-100 text-purple-700"
                        }`}>
                          {m.channel === "email" ? <Mail className="w-3 h-3" /> :
                           m.channel === "whatsapp" ? <MessageCircle className="w-3 h-3" /> :
                           <Mail className="w-3 h-3" />}
                          {m.channel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-mono text-[#64748b]">{m.contact || "—"}</span>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <button
                          onClick={() => toggleRow(m.id)}
                          className="flex items-center gap-1 text-xs font-mono text-red-600 bg-red-50 px-2 py-1 rounded hover:bg-red-100 transition-colors w-full text-left"
                        >
                          <span className="truncate flex-1">{m.error || "—"}</span>
                          {expandedRows.has(m.id) ? <ChevronUp className="w-3 h-3 flex-shrink-0" /> : <ChevronDown className="w-3 h-3 flex-shrink-0" />}
                        </button>
                        {expandedRows.has(m.id) && (
                          <div className="mt-1 text-xs text-red-700 bg-red-50 px-2 py-1.5 rounded">
                            {m.error || "No error details"}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[250px]">
                        <p className="text-xs text-[#64748b] leading-relaxed">{m.error_meaning || "—"}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs text-gray-400">
                          {m.sent_at ? new Date(m.sent_at).toLocaleString() : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {messages.length > 0 && (
            <p className="text-xs text-gray-400 mt-4 text-center">
              Showing {filtered.length} of {messages.length} failed message{messages.length !== 1 ? "s" : ""}.
              Download the CSV for a complete record.
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
