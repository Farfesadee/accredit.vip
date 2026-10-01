"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/contexts/auth-context";
import { apiClient, API_BASE } from "@/lib/api-client";
import {
  BarChart3, Calendar, Users, Settings, LogOut, Menu, X, Loader, Clock,
  AlertTriangle, CreditCard, DollarSign, Search, Download, RefreshCw, Lock, Eye, EyeOff,
  ShieldCheck, Filter, UserCheck, UserX, TrendingUp, Database, FileSpreadsheet, ChevronLeft,
} from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";

interface AudienceProfile {
  id: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  age_bracket: string | null;
  location: string | null;
  source: string;
  is_hvp: boolean;
  hvp_reason: string | null;
  company_domain: string | null;
  created_at: string;
}

interface AudienceStats {
  total: number;
  hvp: number;
  by_source: Record<string, number>;
  by_gender: Record<string, number>;
}

interface Demographics {
  total: number;
  hvp: number;
  men: number;
  women: number;
  unknown_gender: number;
  by_age_bracket: Record<string, number>;
  by_source: Record<string, number>;
}

interface ExportLog {
  id: number;
  admin_id: number;
  admin_email: string;
  filter_description: string | null;
  row_count: number;
  export_type: string;
  created_at: string;
}

const AUDIENCE_TOKEN_KEY = "audience_auth_token";
const AUDIENCE_EXPIRES_KEY = "audience_auth_expires";

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  return `${local.slice(0, 8)}******${local.slice(-1)}@${domain}`;
}

export default function AdminAudiencePage() {
  const { user, loading: authLoading, logout } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useEffect(() => { if (typeof window !== 'undefined' && window.innerWidth < 1024) setSidebarOpen(false); }, []);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [verifying, setVerifying] = useState(false);

  const [tab, setTab] = useState<"profiles" | "demographics" | "exports">("demographics");

  const [stats, setStats] = useState<AudienceStats | null>(null);
  const [demographics, setDemographics] = useState<Demographics | null>(null);
  const [profiles, setProfiles] = useState<AudienceProfile[]>([]);
  const [exportLogs, setExportLogs] = useState<ExportLog[]>([]);
  const [totalProfiles, setTotalProfiles] = useState(0);
  const [totalExportLogs, setTotalExportLogs] = useState(0);
  const [dataLoading, setDataLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterHvp, setFilterHvp] = useState<string>("");
  const [filterGender, setFilterGender] = useState("");
  const [filterAgeBracket, setFilterAgeBracket] = useState("");
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const perPage = 50;

  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(AUDIENCE_TOKEN_KEY);
    const expires = localStorage.getItem(AUDIENCE_EXPIRES_KEY);
    if (token && expires && new Date(expires) > new Date()) {
      setIsAuthorized(true);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const s = await apiClient<AudienceStats>("/admin/audience/stats");
      setStats(s);
    } catch { /* ignore */ }
  }, []);

  const fetchDemographics = useCallback(async () => {
    try {
      const d = await apiClient<Demographics>("/admin/audience/demographics");
      setDemographics(d);
    } catch { /* ignore */ }
  }, []);

  const fetchProfiles = useCallback(async () => {
    setDataLoading(true);
    try {
      const token = localStorage.getItem(AUDIENCE_TOKEN_KEY);
      const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
      if (searchQuery) params.set("search", searchQuery);
      if (filterSource) params.set("source", filterSource);
      if (filterHvp) params.set("is_hvp", filterHvp);
      if (filterGender) params.set("gender", filterGender);
      if (filterAgeBracket) params.set("age_bracket", filterAgeBracket);
      const data = await apiClient<{ total: number; profiles: AudienceProfile[] }>(
        `/admin/audience/profiles?${params}`,
        { headers: { "X-Audience-Auth": token || "" } }
      );
      setProfiles(data.profiles);
      setTotalProfiles(data.total);
    } catch { setProfiles([]); }
    setDataLoading(false);
  }, [page, searchQuery, filterSource, filterHvp, filterGender, filterAgeBracket]);

  const fetchExportLogs = useCallback(async () => {
    setDataLoading(true);
    try {
      const token = localStorage.getItem(AUDIENCE_TOKEN_KEY);
      const data = await apiClient<{ total: number; logs: ExportLog[] }>(
        `/admin/audience/export-logs?page=${page}&per_page=${perPage}`,
        { headers: { "X-Audience-Auth": token || "" } }
      );
      setExportLogs(data.logs);
      setTotalExportLogs(data.total);
    } catch { setExportLogs([]); }
    setDataLoading(false);
  }, [page]);

  useEffect(() => {
    if (isAuthorized) {
      fetchStats();
      fetchDemographics();
    }
  }, [isAuthorized, fetchStats, fetchDemographics]);

  useEffect(() => {
    if (!isAuthorized) return;
    if (tab === "profiles") fetchProfiles();
    if (tab === "exports") fetchExportLogs();
  }, [tab, fetchProfiles, fetchExportLogs, isAuthorized]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setVerifying(true);
    try {
      const res = await apiClient<{ token: string; expires_at: string }>(
        `/admin/audience/verify-password?password=${encodeURIComponent(password)}`,
        { method: "POST" }
      );
      localStorage.setItem(AUDIENCE_TOKEN_KEY, res.token);
      localStorage.setItem(AUDIENCE_EXPIRES_KEY, res.expires_at);
      setIsAuthorized(true);
      setPassword("");
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Authentication failed");
    }
    setVerifying(false);
  };

  const handleSync = async () => {
    setDataLoading(true);
    try {
      await apiClient("/admin/audience/sync", { method: "POST" });
      await fetchStats();
      await fetchDemographics();
    } catch (err) {
      /* silent */
    }
    setDataLoading(false);
  };

  const handleExport = async (format: string) => {
    try {
      const token = localStorage.getItem(AUDIENCE_TOKEN_KEY);
      const params = new URLSearchParams({ format });
      if (searchQuery) params.set("search", searchQuery);
      if (filterSource) params.set("source", filterSource);
      if (filterHvp) params.set("is_hvp", filterHvp);
      if (filterGender) params.set("gender", filterGender);
      if (filterAgeBracket) params.set("age_bracket", filterAgeBracket);
      const res = await fetch(
        `${API_BASE}/admin/audience/export?${params}`,
        { headers: { "X-Audience-Auth": token || "" }, credentials: "include" }
      );
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audience_export.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      /* silent */
    }
  };

  const totalPages = tab === "profiles" ? Math.ceil(totalProfiles / perPage) : Math.ceil(totalExportLogs / perPage);

  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      <aside
        className={`fixed left-0 top-0 h-screen flex flex-col transition-all duration-300 z-40 ${mobileNavOpen ? "translate-x-0 w-64" : "-translate-x-full w-64"} lg:translate-x-0 ${sidebarOpen ? "lg:w-64" : "lg:w-20"}`}
        style={{ background: "#0D1B2A", borderRight: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="h-20 flex items-center justify-between px-4 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Link href="/" className={`flex items-center gap-2 flex-shrink-0 overflow-hidden ${sidebarOpen ? "w-48" : "w-10"}`}>
            <Image src="/logo-mark.png" alt="" width={366} height={372}
              className={`h-10 w-auto object-contain transition-opacity ${sidebarOpen ? "opacity-100" : "opacity-50"}`} />
            {sidebarOpen && <Image src="/logo-text.png" alt="Accredit Interactive" width={594} height={152}
              className="h-7 w-auto object-contain" />}
          </Link>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0 hidden lg:block">
            {sidebarOpen ? <X className="w-5 h-5 text-white/80" /> : <Menu className="w-5 h-5 text-white/80" />}
          </button>
        </div>
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
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  item.href === "/admin/audience" ? "text-white bg-white/10" : "text-white/60 hover:text-white hover:bg-white/08"
                }`}
                title={!sidebarOpen ? item.label : ""}>
                <Icon className="w-5 h-5 flex-shrink-0 text-white/40" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-4 flex-shrink-0 space-y-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {sidebarOpen && (
            <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wide">Account</div>
              <div className="text-xs text-white font-medium truncate">{user ? maskEmail(user.email) : ""}</div>
            </div>
          )}
          <button onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500 text-white font-bold text-sm transition-all hover:bg-red-600 active:scale-95">
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span>Sign Out</span>}
          </button>
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
              <div>
                <h1 className="text-2xl font-black text-[#0D1B2A]">Audience Data</h1>
                <p className="text-xs text-[#94a3b8] mt-1">Marketplace with privacy-controlled access</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isAuthorized && (
                <button onClick={handleSync} disabled={dataLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0D1B2A] text-white font-bold text-sm hover:bg-[#1a2a3a] transition-all disabled:opacity-50">
                  <RefreshCw className={`w-4 h-4 ${dataLoading ? "animate-spin" : ""}`} />
                  Sync Data
                </button>
              )}
              <NotificationBell admin />
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1ABC9C] to-[#16A085] flex items-center justify-center text-white font-bold text-sm">
                {user?.full_name?.charAt(0) || "A"}
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6">
          {!isAuthorized ? (
            <div className="max-w-md mx-auto mt-6">
              <div className="bg-white rounded-2xl border border-[#e8edf2] shadow-[0_16px_42px_rgba(15,23,42,0.08)] p-8">
                <div className="mb-6 text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1ABC9C] text-white mb-4">
                    <Lock className="w-4 h-4" />
                    <p className="text-xs font-black uppercase tracking-[0.18em]">Re-authentication Required</p>
                  </div>
                  <h2 className="text-xl font-black text-[#0D1B2A]">Verify Admin Password</h2>
                  <p className="text-sm text-[#64748b] mt-2">Enter your admin password to access audience data</p>
                </div>
                {authError && (
                  <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-sm text-red-700 font-medium">{authError}</p>
                  </div>
                )}
                <form onSubmit={handleAuth} className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-[#23466f] mb-2">Password</label>
                    <div className="relative">
                      <input type={showPassword ? "text" : "password"} value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter admin password" required disabled={verifying}
                        className="w-full px-4 py-3 pr-12 rounded-xl border border-[#d9e2ec] bg-white text-[#0D1B2A] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20 focus:border-[#1ABC9C] disabled:opacity-50 transition-all" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#0D1B2A]">
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <button type="submit" disabled={verifying}
                    className="w-full h-12 rounded-xl font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: verifying ? "#94a3b8" : "linear-gradient(135deg, #1ABC9C, #16A085)", boxShadow: verifying ? "none" : "0 6px 20px rgba(26, 188, 156,0.35)" }}>
                    {verifying ? "Verifying..." : "Unlock Audience Data"}
                  </button>
                </form>
                <div className="mt-6 pt-6 border-t border-[#e8edf2]">
                  <p className="text-xs text-[#94a3b8] text-center">Session expires after 15 minutes of inactivity</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                  {[
                    { label: "Total Profiles", value: stats.total.toLocaleString(), icon: Users, color: "#1ABC9C", subtext: "Across all sources" },
                    { label: "HVP Contacts", value: stats.hvp.toLocaleString(), icon: UserCheck, color: "#00D98E", subtext: "High value profiles" },
                    { label: "From Users", value: (stats.by_source?.user || 0).toLocaleString(), icon: Database, color: "#3B82F6", subtext: "Registered accounts" },
                    { label: "From Tickets", value: (stats.by_source?.ticket || 0).toLocaleString(), icon: FileSpreadsheet, color: "#FFB84D", subtext: "Ticket purchases" },
                  ].map((stat) => {
                    const Icon = stat.icon;
                    return (
                      <div key={stat.label} className="bg-white rounded-2xl border border-[#e8edf2] p-6 hover:shadow-lg transition-all">
                        <div className="flex items-start justify-between mb-4">
                          <div className="p-3 rounded-lg" style={{ background: `${stat.color}15` }}>
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

              <div className="bg-white rounded-2xl border border-[#e8edf2] overflow-hidden mb-8">
                <div className="flex border-b border-[#e8edf2]">
                  {[
                    { key: "demographics", label: "Demographics", icon: TrendingUp },
                    { key: "profiles", label: "Profiles", icon: Users },
                    { key: "exports", label: "Export Logs", icon: Download },
                  ].map((t) => {
                    const Icon = t.icon;
                    return (
                      <button key={t.key} onClick={() => { setTab(t.key as any); setPage(1); setPageInput("1"); }}
                        className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all ${
                          tab === t.key ? "text-[#1ABC9C] border-b-2 border-[#1ABC9C] bg-[#1ABC9C]/5" : "text-[#94a3b8] hover:text-[#0D1B2A]"
                        }`}>
                        <Icon className="w-4 h-4" />
                        {t.label}
                      </button>
                    );
                  })}
                </div>

                {tab === "demographics" && demographics && (
                  <div className="p-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      {[
                        { label: "Men", value: demographics.men, color: "#3B82F6" },
                        { label: "Women", value: demographics.women, color: "#1ABC9C" },
                        { label: "Unknown Gender", value: demographics.unknown_gender, color: "#94a3b8" },
                        { label: "HVP Profiles", value: demographics.hvp, color: "#00D98E" },
                      ].map((item) => (
                        <div key={item.label} className="bg-[#f8f9fc] rounded-xl p-4 text-center">
                          <p className="text-2xl font-black text-[#0D1B2A]" style={{ color: item.color }}>{item.value.toLocaleString()}</p>
                          <p className="text-xs text-[#94a3b8] mt-1">{item.label}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-sm font-bold text-[#0D1B2A] mb-3">Age Brackets</h3>
                        <div className="space-y-2">
                          {Object.entries(demographics.by_age_bracket).map(([bracket, count]) => (
                            <div key={bracket} className="flex items-center justify-between bg-[#f8f9fc] rounded-lg px-4 py-2">
                              <span className="text-sm text-[#0D1B2A] font-medium">{bracket}</span>
                              <span className="text-sm font-bold text-[#1ABC9C]">{count.toLocaleString()}</span>
                            </div>
                          ))}
                          {Object.keys(demographics.by_age_bracket).length === 0 && (
                            <p className="text-sm text-[#94a3b8]">No age data available</p>
                          )}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[#0D1B2A] mb-3">By Source</h3>
                        <div className="space-y-2">
                          {Object.entries(demographics.by_source).map(([src, count]) => (
                            <div key={src} className="flex items-center justify-between bg-[#f8f9fc] rounded-lg px-4 py-2">
                              <span className="text-sm text-[#0D1B2A] font-medium capitalize">{src}</span>
                              <span className="text-sm font-bold text-[#1ABC9C]">{count.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {tab === "profiles" && (
                  <div className="p-6">
                    <div className="flex flex-wrap gap-3 mb-4">
                      <div className="flex-1 min-w-[200px]">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                          <input type="text" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                            placeholder="Search name, email, phone..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#d9e2ec] text-sm focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20 focus:border-[#1ABC9C]" />
                        </div>
                      </div>
                      <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)}
                        className="px-3 py-2.5 rounded-xl border border-[#d9e2ec] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20">
                        <option value="">All Sources</option>
                        <option value="user">Users</option>
                        <option value="ticket">Tickets</option>
                        <option value="guest">Guests</option>
                      </select>
                      <select value={filterHvp} onChange={(e) => setFilterHvp(e.target.value)}
                        className="px-3 py-2.5 rounded-xl border border-[#d9e2ec] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20">
                        <option value="">All Profiles</option>
                        <option value="true">HVP Only</option>
                        <option value="false">Non-HVP</option>
                      </select>
                      <select value={filterGender} onChange={(e) => setFilterGender(e.target.value)}
                        className="px-3 py-2.5 rounded-xl border border-[#d9e2ec] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20">
                        <option value="">All Genders</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                      <select value={filterAgeBracket} onChange={(e) => setFilterAgeBracket(e.target.value)}
                        className="px-3 py-2.5 rounded-xl border border-[#d9e2ec] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20">
                        <option value="">All Ages</option>
                        <option value="Under 18">Under 18</option>
                        <option value="18-24">18-24</option>
                        <option value="25-34">25-34</option>
                        <option value="35-49">35-49</option>
                        <option value="50+">50+</option>
                      </select>
                      <div className="flex gap-2">
                        <button onClick={() => handleExport("csv")}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1ABC9C] text-white font-bold text-sm hover:bg-[#16A085] transition-all">
                          <Download className="w-4 h-4" /> CSV
                        </button>
                        <button onClick={() => handleExport("json")}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0D1B2A] text-white font-bold text-sm hover:bg-[#1a2a3a] transition-all">
                          <FileSpreadsheet className="w-4 h-4" /> JSON
                        </button>
                      </div>
                    </div>

                    {dataLoading ? (
                      <div className="flex justify-center py-12">
                        <Loader className="w-6 h-6 animate-spin text-[#1ABC9C]" />
                      </div>
                    ) : profiles.length > 0 ? (
                      <>
                        <div className="overflow-x-auto mb-4">
                          <table className="w-full text-sm">
                            <thead className="border-b border-[#e8edf2]">
                              <tr className="text-[#94a3b8] font-semibold">
                                <th className="text-left py-3 px-4">Name</th>
                                <th className="text-left py-3 px-4">Email</th>
                                <th className="text-left py-3 px-4">Phone</th>
                                <th className="text-left py-3 px-4">Source</th>
                                <th className="text-left py-3 px-4">Gender</th>
                                <th className="text-left py-3 px-4">Age</th>
                                <th className="text-left py-3 px-4">HVP</th>
                                <th className="text-left py-3 px-4">Domain</th>
                              </tr>
                            </thead>
                            <tbody>
                              {profiles.map((p) => (
                                <tr key={p.id} className="border-b border-[#e8edf2] hover:bg-[#f8f9fc] transition-colors">
                                  <td className="py-3 px-4 font-semibold text-[#0D1B2A]">{p.full_name}</td>
                                  <td className="py-3 px-4 text-[#64748b]">{p.email || "—"}</td>
                                  <td className="py-3 px-4 text-[#64748b]">{p.phone || "—"}</td>
                                  <td className="py-3 px-4">
                                    <span className={`px-2 py-1 rounded-lg text-xs font-bold capitalize ${
                                      p.source === "user" ? "bg-blue-50 text-blue-600"
                                      : p.source === "ticket" ? "bg-green-50 text-green-600"
                                      : "bg-amber-50 text-amber-600"
                                    }`}>{p.source}</span>
                                  </td>
                                  <td className="py-3 px-4 text-[#64748b]">{p.gender || "—"}</td>
                                  <td className="py-3 px-4 text-[#64748b]">{p.age_bracket || "—"}</td>
                                  <td className="py-3 px-4">
                                    {p.is_hvp ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-50 text-green-600 text-xs font-bold">
                                        <UserCheck className="w-3 h-3" /> HVP
                                      </span>
                                    ) : (
                                      <span className="text-xs text-[#94a3b8]">—</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-[#94a3b8] text-xs">{p.company_domain || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between pt-4 border-t border-[#e8edf2]">
                            <p className="text-sm text-[#64748b]">Page <input type="text" inputMode="numeric" value={pageInput}
                              onChange={(e) => setPageInput(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") { const n = parseInt(e.currentTarget.value); if (isNaN(n) || n < 1) { setPage(1); setPageInput("1"); } else if (n > totalPages) { setPage(totalPages); setPageInput(String(totalPages)); } else { setPage(n); setPageInput(String(n)); } } }}
                              className="w-12 px-2 py-1 rounded-lg border-2 border-[#1ABC9C] text-center font-bold text-[#0D1B2A] focus:outline-none bg-[#1ABC9C]/5 mx-1" /> of {totalPages}</p>
                            <div className="flex gap-2">
                              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                className="px-4 py-2 rounded-lg bg-[#1ABC9C] text-white font-bold text-sm hover:bg-[#16A085] disabled:opacity-40 transition-all">← Previous</button>
                              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                className="px-4 py-2 rounded-lg bg-[#1ABC9C] text-white font-bold text-sm hover:bg-[#16A085] disabled:opacity-40 transition-all">Next →</button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <Database className="w-12 h-12 text-[#94a3b8] mx-auto mb-3" />
                        <p className="text-[#94a3b8]">No profiles found. Click "Sync Data" to populate.</p>
                      </div>
                    )}
                  </div>
                )}

                {tab === "exports" && (
                  <div className="p-6">
                    {dataLoading ? (
                      <div className="flex justify-center py-12">
                        <Loader className="w-6 h-6 animate-spin text-[#1ABC9C]" />
                      </div>
                    ) : exportLogs.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-[#e8edf2]">
                            <tr className="text-[#94a3b8] font-semibold">
                              <th className="text-left py-3 px-4">Admin</th>
                              <th className="text-left py-3 px-4">Rows</th>
                              <th className="text-left py-3 px-4">Type</th>
                              <th className="text-left py-3 px-4">Filters</th>
                              <th className="text-left py-3 px-4">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {exportLogs.map((log) => (
                              <tr key={log.id} className="border-b border-[#e8edf2] hover:bg-[#f8f9fc] transition-colors">
                                <td className="py-3 px-4 font-semibold text-[#0D1B2A]">{log.admin_email}</td>
                                <td className="py-3 px-4 font-bold text-[#1ABC9C]">{log.row_count}</td>
                                <td className="py-3 px-4">
                                  <span className="px-2 py-1 rounded-lg text-xs font-bold uppercase bg-[#f0f1f7] text-[#0D1B2A]">{log.export_type}</span>
                                </td>
                                <td className="py-3 px-4 text-[#64748b] text-xs max-w-[200px] truncate">{log.filter_description || "—"}</td>
                                <td className="py-3 px-4 text-[#94a3b8] text-xs">{new Date(log.created_at).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Download className="w-12 h-12 text-[#94a3b8] mx-auto mb-3" />
                        <p className="text-[#94a3b8]">No exports yet</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full">
            <h2 className="text-2xl font-black text-[#0D1B2A] mb-3">Sign Out?</h2>
            <p className="text-sm text-[#64748b] mb-6">Are you sure you want to sign out?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-4 py-3 rounded-xl border-2 border-[#e8edf2] bg-white text-[#0D1B2A] font-bold hover:bg-[#f0f1f7] transition-all">Cancel</button>
              <button onClick={() => logout()}
                className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all">Sign Out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
