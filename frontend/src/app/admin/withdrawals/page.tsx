"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/contexts/auth-context";
import { ChevronLeft, Menu, X, BarChart3, Calendar, Users, Settings, Loader, Clock, AlertTriangle, CheckCircle, XCircle, Eye, CreditCard, DollarSign, Database } from "lucide-react";
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

export default function AdminWithdrawalsPage() {
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
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const itemsPerPage = 10;

  const fetchWithdrawals = async () => {
    setLoading(true);
    try {
      let url = "/admin/withdrawals?per_page=100";
      if (filter !== "all") url += `&status=${filter}`;
      const data = await apiClient<any>(url);
      setWithdrawals(data.withdrawals || []);
    } catch { setWithdrawals([]); }
    setLoading(false);
  };

  useEffect(() => { fetchWithdrawals(); }, [filter]);

  const handleAction = async (id: number, action: string) => {
    try {
      await apiClient(`/admin/withdrawals/${id}/process?action=${action}`, { method: "POST" });
      fetchWithdrawals();
    } catch {}
  };

  if (authLoading || !user) return <div className="min-h-screen flex items-center justify-center bg-[#f8f9fc]"><Loader className="w-8 h-8 animate-spin text-[#1ABC9C]" /></div>;

  const totalPages = Math.ceil(withdrawals.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = withdrawals.slice(startIndex, startIndex + itemsPerPage);

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
              <h1 className="text-2xl font-black text-[#0D1B2A]">Withdrawals</h1>
            </div>
            <div className="flex items-center gap-3 text-sm text-[#64748b]">
              <NotificationBell admin />
              <span>{withdrawals.length} withdrawal{withdrawals.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6">
          <div className="bg-white rounded-2xl border border-[#e8edf2] p-6 mb-6">
            <div className="flex gap-2 mb-4">
              {["pending", "processing", "completed", "failed", "flagged", "all"].map((f) => (
                <button key={f} onClick={() => { setFilter(f); setCurrentPage(1); }} className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${filter === f ? "bg-[#1ABC9C] text-white" : "bg-[#f0f1f7] text-[#64748b] hover:bg-[#e8edf2]"}`}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            {withdrawals.length > 0 && (
              <div className="border-t border-[#e8edf2] pt-4 flex items-center justify-between">
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
              <p className="text-[#94a3b8]">Loading withdrawals...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {paginatedItems.map((w) => (
                <div key={w.id} className="bg-white rounded-2xl border border-[#e8edf2] hover:border-[#1ABC9C] p-6">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-black text-[#0D1B2A]">{w.currency} {w.amount.toLocaleString()}</h3>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${w.status === "pending" ? "bg-amber-50 text-amber-600" : w.status === "completed" ? "bg-green-50 text-green-600" : w.status === "failed" || w.status === "flagged" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>{w.status.toUpperCase()}</span>
                        {w.is_aml_flagged && <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-red-100 text-red-700">AML FLAGGED</span>}
                      </div>
                      <p className="text-sm text-[#64748b]">{w.user_name} ({w.user_email})</p>
                    </div>
                    <div className="text-right text-xs text-[#94a3b8]">
                      <p>Ref: {w.reference}</p>
                      <p>{new Date(w.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  {w.aml_reason && <p className="text-xs text-red-600 mb-2">AML: {w.aml_reason}</p>}
                  {w.failure_reason && <p className="text-xs text-red-600 mb-2">Failed: {w.failure_reason}</p>}
                  {w.status === "pending" && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-[#e8edf2]">
                      <button onClick={() => handleAction(w.id, "approve")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 font-bold text-xs"><CheckCircle className="w-4 h-4" /> Approve</button>
                      <button onClick={() => handleAction(w.id, "flag")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-bold text-xs"><AlertTriangle className="w-4 h-4" /> Flag</button>
                      <button onClick={() => handleAction(w.id, "fail")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#f0f1f7] text-[#64748b] hover:bg-[#e8edf2] font-bold text-xs"><XCircle className="w-4 h-4" /> Reject</button>
                    </div>
                  )}
                  {w.status === "processing" && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-[#e8edf2]">
                      <button onClick={() => handleAction(w.id, "complete")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 font-bold text-xs"><CheckCircle className="w-4 h-4" /> Mark Complete</button>
                      <button onClick={() => handleAction(w.id, "fail")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-bold text-xs"><XCircle className="w-4 h-4" /> Mark Failed</button>
                    </div>
                  )}
                </div>
              ))}
              {withdrawals.length === 0 && <div className="bg-white rounded-2xl border border-[#e8edf2] p-12 text-center"><p className="text-[#94a3b8]">No withdrawals found</p></div>}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
