"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/contexts/auth-context";
import { ChevronLeft, Menu, X, BarChart3, Calendar, Users, Settings, Loader, Clock, AlertTriangle, Shield, UserX, Ban, CreditCard as CC, MailX, Flag, DollarSign, Database } from "lucide-react";
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

export default function AdminFraudPage() {
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
  const [flags, setFlags] = useState<any>(null);
  const [amlWithdrawals, setAmlWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [fraudData, amlData] = await Promise.all([
          apiClient<any>("/admin/fraud-flags"),
          apiClient<any>("/admin/withdrawals?status=flagged&per_page=20").catch(() => null),
        ]);
        setFlags(fraudData);
        setAmlWithdrawals(amlData?.withdrawals || []);
      } catch {}
      setLoading(false);
    };
    fetchData();
  }, []);

  if (authLoading || !user) return <div className="min-h-screen flex items-center justify-center bg-[#f8f9fc]"><Loader className="w-8 h-8 animate-spin text-[#1ABC9C]" /></div>;

  const cards = [
    { label: "Inactive Users", value: flags?.inactive_users || 0, icon: UserX, color: "bg-red-50 text-red-600" },
    { label: "Unverified Users", value: flags?.unverified_users || 0, icon: Ban, color: "bg-orange-50 text-orange-600" },
    { label: "Failed Payments", value: flags?.failed_payments || 0, icon: CC, color: "bg-red-50 text-red-600" },
    { label: "Failed Deliveries", value: flags?.failed_deliveries || 0, icon: MailX, color: "bg-amber-50 text-amber-600" },
    { label: "Flagged Events", value: flags?.flagged_events || 0, icon: Flag, color: "bg-red-50 text-red-600" },
    { label: "AML Flagged", value: flags?.aml_flagged || 0, icon: Shield, color: "bg-purple-50 text-purple-600" },
    { label: "Locked Accounts", value: flags?.locked_accounts || 0, icon: AlertTriangle, color: "bg-red-50 text-red-600" },
  ];

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
            { label: "Withdrawals", href: "/admin/withdrawals", Icon: CC },
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
              <h1 className="text-2xl font-black text-[#0D1B2A]">Fraud Detection</h1>
            </div>
            <NotificationBell admin />
          </div>
        </header>

        <main className="p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {cards.map((card) => (
                  <div key={card.label} className={`${card.color} rounded-2xl p-6`}>
                    <div className="flex items-center justify-between mb-2">
                      <card.icon className="w-8 h-8" />
                      <span className="text-3xl font-black">{card.value}</span>
                    </div>
                    <p className="text-sm font-bold">{card.label}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-[#e8edf2] p-6">
                <h2 className="text-lg font-black text-[#0D1B2A] mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-[#1ABC9C]" /> AML-Flagged Withdrawals</h2>
                {amlWithdrawals.length === 0 ? (
                  <p className="text-[#94a3b8] text-center py-8">No AML-flagged withdrawals</p>
                ) : (
                  <div className="space-y-3">
                    {amlWithdrawals.map((w) => (
                      <div key={w.id} className="flex justify-between items-center p-4 bg-red-50 rounded-xl border border-red-200">
                        <div>
                          <p className="font-bold text-[#0D1B2A]">{w.currency} {w.amount.toLocaleString()}</p>
                          <p className="text-sm text-[#64748b]">{w.user_name}: {w.aml_reason}</p>
                        </div>
                        <Link href="/admin/withdrawals" className="text-xs font-bold text-[#1ABC9C] hover:underline">View All</Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
