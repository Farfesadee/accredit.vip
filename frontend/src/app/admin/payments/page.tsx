"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/contexts/auth-context";
import { ChevronLeft, Menu, X, BarChart3, Calendar, Users, Settings, Loader, Clock, AlertTriangle, CreditCard, DollarSign, ArrowDownToLine, Ticket, Database } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { NotificationBell } from "@/components/notification-bell";
import { AdminLogoutButton } from "@/components/admin/logout-button";

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visibleStart = local.slice(0, Math.min(8, local.length));
  const visibleEnd = local.length > 1 ? local.slice(-1) : "";
  return `${visibleStart}******${visibleEnd}@${domain}`;
}

export default function AdminPaymentsPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && (!user || (user.role !== "admin" && user.role !== "super_admin"))) {
      router.push("/admin");
    }
  }, [user, authLoading, router]);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useEffect(() => { if (typeof window !== 'undefined' && window.innerWidth < 1024) setSidebarOpen(false); }, []);
  const [tab, setTab] = useState("payments");
  const [payments, setPayments] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [pData, dData] = await Promise.all([
          apiClient<any>("/admin/payments?per_page=100"),
          apiClient<any>("/admin/deposits?per_page=100"),
        ]);
        setPayments(pData.payments || []);
        setDeposits(dData.deposits || []);
      } catch {}
      setLoading(false);
    };
    fetchData();
  }, []);

  if (authLoading || !user) return <div className="min-h-screen flex items-center justify-center bg-[#f8f9fc]"><Loader className="w-8 h-8 animate-spin text-[#1ABC9C]" /></div>;

  const displayData = tab === "payments" ? payments : deposits;
  const totalPages = Math.ceil(displayData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = displayData.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      <aside className={`fixed left-0 top-0 h-screen flex flex-col transition-all duration-300 z-40 ${mobileNavOpen ? "translate-x-0 w-64" : "-translate-x-full w-64"} lg:translate-x-0 ${sidebarOpen ? "lg:w-64" : "lg:w-20"}`} style={{ background: "#0D1B2A", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="h-20 flex items-center justify-between px-4 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {sidebarOpen && <Link href="/admin" className="flex items-center gap-2"><Image src="/logo-mark.png" alt="" width={366} height={372} className="h-8 w-auto object-contain min-w-0" /><Image src="/logo-text.png" alt="Accredit Interactive" width={594} height={152} className="h-6 w-auto object-contain" /></Link>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-white/10 rounded-lg transition-colors hidden lg:block"><X className="w-5 h-5 text-white/80" /></button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {[
            { label: "Dashboard", href: "/admin", Icon: BarChart3 },
            { label: "Event Moderation", href: "/admin/events", Icon: Calendar },
            { label: "Users", href: "/admin/users", Icon: Users },
            { label: "Sessions", href: "/admin/sessions", Icon: Clock },
            { label: "Payments", href: "/admin/payments", Icon: DollarSign },
            { label: "Withdrawals", href: "/admin/withdrawals", Icon: CreditCard },
            { label: "Fraud", href: "/admin/fraud", Icon: AlertTriangle },
            ...(user?.role === "super_admin" ? [{ label: "Audience Data", href: "/admin/audience", Icon: Database }] : []),
            { label: "Settings", href: "/admin/settings", Icon: Settings },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/08 transition-all" style={{ "--tw-bg-opacity": "0.08" } as React.CSSProperties} title={!sidebarOpen ? item.label : ""}>
              <item.Icon className="w-5 h-5 text-white/40" />
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>
        <div className="px-3 py-4 flex-shrink-0 space-y-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {sidebarOpen && (
            <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wide">Account</div>
              <div className="text-xs text-white font-medium truncate" title={maskEmail(user.email)}>
                {maskEmail(user.email)}
              </div>
              <div className="text-[11px] text-white/55">
                Last logged in: {new Date(user.last_login || Date.now()).toLocaleDateString()} at {new Date(user.last_login || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          )}
          <AdminLogoutButton collapsed={!sidebarOpen} />
        </div>
      </aside>
      {mobileNavOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setMobileNavOpen(false)} />
      )}

      <div className={`transition-all duration-300 ${sidebarOpen ? "ml-20 lg:ml-64" : "ml-20"}`}>
        <header className="h-20 border-b border-[#e8edf2] bg-white sticky top-0 z-30">
          <div className="h-full px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileNavOpen(true)} className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Open menu"><Menu className="w-5 h-5 text-[#0D1B2A]" /></button>
              <Link href="/admin" className="text-[#64748b] hover:text-[#0D1B2A]"><ChevronLeft className="w-5 h-5" /></Link>
              <h1 className="text-2xl font-black text-[#0D1B2A]">Payments</h1>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#64748b] font-medium flex-wrap justify-end">
              <NotificationBell admin />
              <span className="hidden md:flex items-center gap-1"><Ticket className="w-4 h-4" /> {payments.length} tickets</span>
              <span className="hidden md:inline text-[#e8edf2]">|</span>
              <span className="hidden md:flex items-center gap-1"><ArrowDownToLine className="w-4 h-4" /> {deposits.length} deposits</span>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6">
          <div className="bg-white rounded-2xl border border-[#e8edf2] p-6 mb-6">
            <div className="flex gap-2 mb-4">
              {[
                { key: "payments", label: "Ticket Payments", Icon: Ticket },
                { key: "deposits", label: "Wallet Deposits", Icon: ArrowDownToLine },
              ].map((t) => (
                <button key={t.key} onClick={() => { setTab(t.key); setCurrentPage(1); }} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${tab === t.key ? "bg-[#1ABC9C] text-white" : "bg-[#f0f1f7] text-[#64748b] hover:bg-[#e8edf2]"}`}>
                  <t.Icon className="w-4 h-4" /> {t.label}
                </button>
              ))}
            </div>
            {displayData.length > 0 && (
              <div className="border-t border-[#e8edf2] pt-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <p className="text-sm text-[#64748b]">Showing page <input type="text" inputMode="numeric" value={pageInput} onChange={(e) => setPageInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { const num = parseInt(e.currentTarget.value); if (!e.currentTarget.value || isNaN(num) || num < 1) { setCurrentPage(1); setPageInput("1"); } else if (num > totalPages) { setCurrentPage(totalPages); setPageInput(String(totalPages)); } else { setCurrentPage(num); setPageInput(String(num)); } e.currentTarget.blur(); } }} onBlur={(e) => { const num = parseInt(e.target.value); if (!e.target.value || isNaN(num) || num < 1) { setCurrentPage(1); setPageInput("1"); } else if (num > totalPages) { setCurrentPage(totalPages); setPageInput(String(totalPages)); } else { setCurrentPage(num); setPageInput(String(num)); } }} className="w-12 px-2 py-1 rounded-lg border-2 border-[#1ABC9C] text-center font-bold text-[#0D1B2A] focus:outline-none focus:border-[#1ABC9C] bg-[#1ABC9C]/5" /> of {totalPages}</p>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 rounded-lg bg-[#1ABC9C] text-white font-bold text-sm hover:bg-[#16A085] disabled:opacity-40 disabled:cursor-not-allowed transition-all">← Previous</button>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 rounded-lg bg-[#1ABC9C] text-white font-bold text-sm hover:bg-[#16A085] disabled:opacity-40 disabled:cursor-not-allowed transition-all">Next →</button>
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl border border-[#e8edf2] p-12 text-center">
              <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-[#94a3b8]">Loading...</p>
            </div>
          ) : tab === "payments" ? (
            <div className="bg-white rounded-2xl border border-[#e8edf2] overflow-hidden">
              <div className="overflow-x-auto"><table className="w-full">
                <thead>
                  <tr className="border-b border-[#e8edf2] bg-[#f8f9fc]">
                    <th className="text-left px-3 sm:px-6 py-4 text-xs font-bold text-[#94a3b8] uppercase whitespace-nowrap">Amount</th>
                    <th className="text-left px-3 sm:px-6 py-4 text-xs font-bold text-[#94a3b8] uppercase whitespace-nowrap">Event</th>
                    <th className="text-left px-3 sm:px-6 py-4 text-xs font-bold text-[#94a3b8] uppercase whitespace-nowrap">Organizer</th>
                    <th className="text-left px-3 sm:px-6 py-4 text-xs font-bold text-[#94a3b8] uppercase whitespace-nowrap">Provider</th>
                    <th className="text-left px-3 sm:px-6 py-4 text-xs font-bold text-[#94a3b8] uppercase whitespace-nowrap">Status</th>
                    <th className="text-left px-3 sm:px-6 py-4 text-xs font-bold text-[#94a3b8] uppercase whitespace-nowrap">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((p) => (
                    <tr key={p.id} className="border-b border-[#e8edf2] hover:bg-[#f8f9fc]">
                      <td className="px-6 py-4 text-sm font-bold text-[#0D1B2A]">{p.currency} {p.amount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-[#64748b]">{p.event_title}</td>
                      <td className="px-6 py-4 text-sm text-[#64748b]">{p.organizer_name}</td>
                      <td className="px-6 py-4 text-sm text-[#64748b]">{p.provider}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${p.status === "paid" ? "bg-green-50 text-green-600" : p.status === "failed" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>{p.status}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#64748b]">{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : new Date(p.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
              {payments.length === 0 && <p className="text-center text-[#94a3b8] py-12">No payments found</p>}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#e8edf2] overflow-hidden">
              <div className="overflow-x-auto"><table className="w-full">
                <thead>
                  <tr className="border-b border-[#e8edf2] bg-[#f8f9fc]">
                    <th className="text-left px-3 sm:px-6 py-4 text-xs font-bold text-[#94a3b8] uppercase whitespace-nowrap">Amount</th>
                    <th className="text-left px-3 sm:px-6 py-4 text-xs font-bold text-[#94a3b8] uppercase whitespace-nowrap">User</th>
                    <th className="text-left px-3 sm:px-6 py-4 text-xs font-bold text-[#94a3b8] uppercase whitespace-nowrap">Reference</th>
                    <th className="text-left px-3 sm:px-6 py-4 text-xs font-bold text-[#94a3b8] uppercase whitespace-nowrap">Status</th>
                    <th className="text-left px-3 sm:px-6 py-4 text-xs font-bold text-[#94a3b8] uppercase whitespace-nowrap">Description</th>
                    <th className="text-left px-3 sm:px-6 py-4 text-xs font-bold text-[#94a3b8] uppercase whitespace-nowrap">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((d) => (
                    <tr key={d.id} className="border-b border-[#e8edf2] hover:bg-[#f8f9fc]">
                      <td className="px-6 py-4 text-sm font-bold text-green-600">+{d.currency} {d.amount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-[#64748b]">{d.user_name}<br /><span className="text-xs text-[#94a3b8]">{d.user_email}</span></td>
                      <td className="px-6 py-4 text-sm font-mono text-[#64748b]">{d.reference}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${d.status === "completed" ? "bg-green-50 text-green-600" : d.status === "failed" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>{d.status}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#64748b]">{d.description || "Wallet deposit"}</td>
                      <td className="px-6 py-4 text-sm text-[#64748b]">{new Date(d.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
              {deposits.length === 0 && <p className="text-center text-[#94a3b8] py-12">No deposits found</p>}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
