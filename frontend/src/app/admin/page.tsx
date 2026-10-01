"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/contexts/auth-context";
import { apiClient } from "@/lib/api-client";
import {
  BarChart3,
  Users,
  Calendar,
  TrendingUp,
  LogOut,
  Menu,
  X,
  Eye,
  EyeOff,
  Lock,
  Loader,
  ShieldCheck,
  Settings,
  Clock,
  AlertTriangle,
  CreditCard,
  DollarSign,
  Database,
} from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";

interface DashboardOverview {
  total_users: number;
  total_events: number;
  total_guests: number;
  active_events: number;
  total_revenue: number;
  new_users_7days: number;
}

interface Event {
  id: number;
  title: string;
  organizer_email: string;
  event_date: string;
  guest_count: number;
  status: string;
  created_at: string;
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visibleStart = local.slice(0, Math.min(8, local.length));
  const visibleEnd = local.length > 1 ? local.slice(-1) : "";
  return `${visibleStart}******${visibleEnd}@${domain}`;
}

export default function AdminPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useEffect(() => { if (typeof window !== "undefined" && window.innerWidth < 1024) setSidebarOpen(false); }, []);
  const [showPassword, setShowPassword] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardOverview | null>(null);
  const [recentEvents, setRecentEvents] = useState<Event[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [recovering, setRecovering] = useState(false);
  const recoveredRef = useRef(false);
  const itemsPerPage = 10;

  // Attempt recovery if user was lost mid-session
  useEffect(() => {
    if (!authLoading && !user && !recoveredRef.current) {
      recoveredRef.current = true;
      setRecovering(true);
      apiClient<Record<string, unknown>>("/auth/me")
        .then((u) => {
          if (u.role === "admin" || u.role === "super_admin") {
            localStorage.setItem("user_data", JSON.stringify(u));
            window.location.reload();
          }
        })
        .catch(() => {})
        .finally(() => setRecovering(false));
    }
  }, [authLoading, user]);

  // Fetch admin dashboard data
  useEffect(() => {
    if (user?.role === "admin" || user?.role === "super_admin") {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setDataLoading(true);
      const [overview, events] = await Promise.all([
        apiClient<DashboardOverview>("/admin/dashboard/overview"),
        apiClient<Event[]>("/admin/dashboard/events?limit=100"),
      ]);
      setDashboardData(overview);
      setRecentEvents(events);
    } catch (err) {
      // silently handled
    } finally {
      setDataLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await apiClient<{ access_token: string; user: any }>("/auth/login", {
        method: "POST", body: { email, password },
      });
      if (res.user.role !== "admin" && res.user.role !== "super_admin") {
        setError("Access denied. Admin credentials required.");
        setSubmitting(false);
        return;
      }
      localStorage.setItem("access_token", res.access_token);
      localStorage.setItem("user_data", JSON.stringify(res.user));
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
      setSubmitting(false);
    }
  };

  if (authLoading || recovering) {
    return <div className="min-h-screen flex items-center justify-center bg-[#f8f9fc]"><Loader className="w-8 h-8 animate-spin text-[#1ABC9C]" /></div>;
  }
  if (user?.role === "admin" || user?.role === "super_admin") {
    return (
      <div className="min-h-screen bg-[#f8f9fc]">
        {/* Sidebar */}
        <aside
          className={`fixed left-0 top-0 h-screen flex flex-col transition-all duration-300 z-40 ${
            sidebarOpen ? "w-20 lg:w-64" : "w-20"
          }`}
          style={{ background: "#0D1B2A", borderRight: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="h-20 flex items-center justify-between px-4 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <Link href="/" className={`flex items-center gap-2 flex-shrink-0 overflow-hidden ${sidebarOpen ? 'w-48' : 'w-10'}`}>
              <Image
                src="/logo-mark.png"
                alt=""
                width={366}
                height={372}
                className={`h-10 w-auto object-contain flex-shrink-0 transition-opacity ${sidebarOpen ? 'opacity-100' : 'opacity-50'}`}
              />
              {sidebarOpen && <Image
                src="/logo-text.png"
                alt="Accredit Interactive"
                width={584}
                height={143}
                className="h-7 w-auto object-contain min-w-0"
              />}
            </Link>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0 hidden lg:block"
            >
              {sidebarOpen ? <X className="w-5 h-5 text-white/80" /> : <Menu className="w-5 h-5 text-white/80" />}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {[
              { label: "Dashboard", href: "/admin", icon: BarChart3 },
              { label: "Event Moderation", href: "/admin/events", icon: Calendar },
              { label: "Users", href: "/admin/users", icon: Users },
              { label: "Sessions", href: "/admin/sessions", icon: Clock },
              { label: "Payments", href: "/admin/payments", icon: DollarSign },
              { label: "Withdrawals", href: "/admin/withdrawals", icon: CreditCard },
              { label: "Fraud", href: "/admin/fraud", icon: AlertTriangle },
              ...(user?.role === "super_admin" ? [{ label: "Audience Data", href: "/admin/audience", icon: Database }] : []),
              { label: "Settings", href: "/admin/settings", icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/08 transition-all"
                  style={{ "--tw-bg-opacity": "0.08" } as React.CSSProperties}
                  title={!sidebarOpen ? item.label : ""}
                >
                  <Icon className="w-5 h-5 flex-shrink-0 text-white/40" />
                  {sidebarOpen && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          {/* Logout */}
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
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500 text-white font-bold text-sm transition-all hover:bg-red-600 active:scale-95"
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span>Sign Out</span>}
            </button>
          </div>
        </aside>
      {mobileNavOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setMobileNavOpen(false)} />
      )}

        {/* Main Content */}
        <div className={`transition-all duration-300 ${sidebarOpen ? "ml-20 lg:ml-64" : "ml-20"}`}>
          {/* Header */}
          <header className="h-20 border-b border-[#e8edf2] bg-white sticky top-0 z-30">
            <div className="h-full px-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={() => setMobileNavOpen(true)} className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Open menu"><Menu className="w-5 h-5 text-[#0D1B2A]" /></button>
                <div>
                  <h1 className="text-2xl font-black text-[#0D1B2A]">Dashboard</h1>
                  <p className="text-xs text-[#64748b] font-semibold mt-1">Welcome back, {user.role === "super_admin" ? "Super Admin" : user.full_name}!</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <NotificationBell admin />
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1ABC9C] to-[#16A085] flex items-center justify-center text-white font-bold text-sm">
                  {user.role === "super_admin" ? "SA" : user.full_name.charAt(0)}
                </div>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="p-4 sm:p-6">
            {dataLoading ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <Loader className="w-8 h-8 animate-spin text-[#1ABC9C] mx-auto mb-3" />
                  <p className="text-[#64748b]">Loading dashboard...</p>
                </div>
              </div>
            ) : (
              <>
                {/* Stats Grid */}
                {dashboardData && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {[
                      {
                        label: "Total Users",
                        value: dashboardData.total_users.toLocaleString(),
                        icon: Users,
                        color: "#1ABC9C",
                        subtext: `${dashboardData.new_users_7days} new this week`,
                      },
                      {
                        label: "Total Events",
                        value: dashboardData.total_events.toLocaleString(),
                        icon: Calendar,
                        color: "#00D98E",
                        subtext: `${dashboardData.active_events} active`,
                      },
                      {
                        label: "Total Guests",
                        value: dashboardData.total_guests.toLocaleString(),
                        icon: Users,
                        color: "#FFB84D",
                        subtext: "Across all events",
                      },
                      {
                        label: "Total Revenue",
                        value: `₦${(dashboardData.total_revenue / 1000000).toFixed(1)}M`,
                        icon: TrendingUp,
                        color: "#3B82F6",
                        subtext: "All time",
                      },
                    ].map((stat) => {
                      const Icon = stat.icon;
                      return (
                        <div
                          key={stat.label}
                          className="bg-white rounded-2xl border border-[#e8edf2] p-6 hover:shadow-lg transition-all"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div
                              className="p-3 rounded-lg"
                              style={{ background: `${stat.color}15` }}
                            >
                              <Icon className="w-6 h-6" style={{ color: stat.color }} />
                            </div>
                          </div>
                          <p className="text-[#94a3b8] text-sm font-medium">{stat.label}</p>
                          <p className="text-3xl font-black text-[#0D1B2A] mt-2">{stat.value}</p>
                          <p className="text-xs text-[#94a3b8] mt-2">{stat.subtext}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Recent Activity */}
                <div className="bg-white rounded-2xl border border-[#e8edf2] p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-black text-[#0D1B2A]">Recent Events</h2>
                    <Link
                      href="/admin/events"
                      className="text-sm font-bold text-[#1ABC9C] hover:text-[#16A085] transition-colors"
                    >
                      View All →
                    </Link>
                  </div>

                  {recentEvents.length > 0 && (
                    <div className="border-b border-[#e8edf2] mb-4 pb-4 flex items-center justify-between">
                      <p className="text-sm text-[#64748b]">Showing page <input type="text" inputMode="numeric" value={pageInput} onChange={(e) => setPageInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { const maxPages = Math.ceil(recentEvents.length / itemsPerPage); const num = parseInt(e.currentTarget.value); if (!e.currentTarget.value || isNaN(num) || num < 1) { setCurrentPage(1); setPageInput("1"); } else if (num > maxPages) { setCurrentPage(maxPages); setPageInput(String(maxPages)); } else { setCurrentPage(num); setPageInput(String(num)); } e.currentTarget.blur(); } }} onBlur={(e) => { const maxPages = Math.ceil(recentEvents.length / itemsPerPage); const num = parseInt(e.target.value); if (!e.target.value || isNaN(num) || num < 1) { setCurrentPage(1); setPageInput("1"); } else if (num > maxPages) { setCurrentPage(maxPages); setPageInput(String(maxPages)); } else { setCurrentPage(num); setPageInput(String(num)); } }} className="w-12 px-2 py-1 rounded-lg border-2 border-[#1ABC9C] text-center font-bold text-[#0D1B2A] focus:outline-none focus:border-[#1ABC9C] bg-[#1ABC9C]/5" /> of {Math.ceil(recentEvents.length / itemsPerPage)}</p>
                      <div className="flex gap-2">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 rounded-lg bg-[#1ABC9C] text-white font-bold text-sm hover:bg-[#16A085] disabled:opacity-40 disabled:cursor-not-allowed transition-all">← Previous</button>
                        <button onClick={() => setCurrentPage(p => Math.min(Math.ceil(recentEvents.length / itemsPerPage), p + 1))} disabled={currentPage === Math.ceil(recentEvents.length / itemsPerPage)} className="px-4 py-2 rounded-lg bg-[#1ABC9C] text-white font-bold text-sm hover:bg-[#16A085] disabled:opacity-40 disabled:cursor-not-allowed transition-all">Next →</button>
                      </div>
                    </div>
                  )}

                  {recentEvents.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-[#e8edf2]">
                          <tr className="text-[#94a3b8] font-semibold">
                            <th className="text-left py-3 px-4">Event Title</th>
                            <th className="text-left py-3 px-4">Organizer</th>
                            <th className="text-left py-3 px-4">Date</th>
                            <th className="text-left py-3 px-4">Guests</th>
                            <th className="text-left py-3 px-4">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentEvents
                            .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime())
                            .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                            .map((event) => (
                              <tr
                                key={event.id}
                                className="border-b border-[#e8edf2] hover:bg-[#f8f9fc] transition-colors"
                              >
                                <td className="py-3 px-4">
                                  <p className="font-semibold text-[#0D1B2A]">{event.title}</p>
                                </td>
                                <td className="py-3 px-4 text-[#64748b]">{event.organizer_email}</td>
                                <td className="py-3 px-4 text-[#64748b]">
                                  {new Date(event.event_date).toLocaleDateString()}
                                </td>
                                <td className="py-3 px-4 font-semibold text-[#0D1B2A]">{event.guest_count}</td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                      event.status === "published"
                                        ? "bg-green-50 text-green-600"
                                        : event.status === "draft"
                                        ? "bg-blue-50 text-blue-600"
                                        : "bg-amber-50 text-amber-600"
                                    }`}
                                  >
                                    {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-center text-[#94a3b8] py-8">No recent events</p>
                  )}
                </div>
              </>
            )}
          </main>
        </div>

        {/* Logout Confirmation Dialog */}
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full">
              <h2 className="text-2xl font-black text-[#0D1B2A] mb-3">Sign Out?</h2>
              <p className="text-sm text-[#64748b] mb-6">
                Are you sure you want to sign out? You'll need to log in again to access the admin panel.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 px-4 py-3 rounded-xl border-2 border-[#e8edf2] bg-white text-[#0D1B2A] font-bold hover:bg-[#f0f1f7] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => logout()}
                  className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Admin Login Form
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#0D1B2A] via-[#1a2a3a] to-[#1ABC9C]/20 flex-col items-center justify-center px-4 py-12">
      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-[#1ABC9C]/10 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#00D98E]/10 rounded-full blur-3xl -z-10" />

      {/* Logo */}
      <Link href="/" className="mb-12 hover:opacity-80 transition-opacity">
        <Image
          src="/logo-stacked.png"
          alt="Accredit Interactive"
          width={834}
          height={549}
          className="h-28 w-auto object-contain"
        />
      </Link>

      {/* Login Card */}
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-[#e8edf2] shadow-[0_16px_42px_rgba(15,23,42,0.08)] p-8">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1ABC9C] text-white mb-4">
              <Lock className="w-4 h-4" />
              <p className="text-xs font-black uppercase tracking-[0.18em]">Secure Access</p>
            </div>
            <h1 className="text-3xl font-black text-[#0D1B2A] mt-3">Admin Login</h1>
            <p className="text-sm text-[#64748b] mt-2">Restricted access for authorized administrators</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleAdminLogin} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-bold text-[#23466f] mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                disabled={submitting}
                className="w-full px-4 py-3 rounded-xl border border-[#d9e2ec] bg-white text-[#0D1B2A] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20 focus:border-[#1ABC9C] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-bold text-[#23466f] mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={submitting}
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-[#d9e2ec] bg-white text-[#0D1B2A] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20 focus:border-[#1ABC9C] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#0D1B2A] transition-colors"
                  disabled={submitting}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-xl font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: submitting ? "#94a3b8" : "linear-gradient(135deg, #1ABC9C, #16A085)",
                boxShadow: submitting ? "none" : "0 6px 20px rgba(26, 188, 156,0.35)",
              }}
            >
              {submitting ? "Logging in..." : "Admin Login"}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 pt-6 border-t border-[#e8edf2] text-center">
            <p className="text-xs text-[#94a3b8]">
              Not an admin?{" "}
              <Link href="/auth/login" className="font-bold text-[#1ABC9C] hover:underline">
                User Login
              </Link>
            </p>
          </div>
        </div>

        {/* Security Notice */}
          <div className="mt-6 p-4 rounded-lg bg-[#0D1B2A] border border-[#1ABC9C]/30 flex gap-3">
            <ShieldCheck className="w-5 h-5 text-[#1ABC9C] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-white/90 font-semibold">
              Secure Access: This page is for administrators only. Unauthorized access attempts are logged.
            </p>
          </div>
      </div>
    </div>
  );
}

interface Shield {
  className: string;
}
