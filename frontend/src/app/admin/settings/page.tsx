"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/contexts/auth-context";
import { apiClient } from "@/lib/api-client";
import {
  ChevronLeft, Menu, X, BarChart3, Calendar, Users, Settings, Loader,
  Shield, User, Mail, Key, Clock, AlertTriangle, CreditCard, DollarSign, Database,
  Plus, Trash2, Eye, EyeOff, CheckCircle, XCircle,
} from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { AdminLogoutButton } from "@/components/admin/logout-button";

interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  return `${local.slice(0, 8)}******${local.slice(-1)}@${domain}`;
}

export default function AdminSettingsPage() {
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

  const [tab, setTab] = useState<"profile" | "admins" | "platform">("profile");

  // Profile
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailMsg, setEmailMsg] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurPw, setShowCurPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  // Admin management
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createName, setCreateName] = useState("Admin");
  const [createLoading, setCreateLoading] = useState(false);
  const [createMsg, setCreateMsg] = useState("");
  const [createError, setCreateError] = useState("");

  // Edit admin
  const [editingAdmin, setEditingAdmin] = useState<number | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editMsg, setEditMsg] = useState("");

  // Platform pricing
  const [pricing, setPricing] = useState<any[]>([]);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingMsg, setPricingMsg] = useState("");

  const loadPricing = async () => {
    try {
      const res = await apiClient<{ settings: Record<string, any> }>("/admin/settings/platform");
      const list = res.settings?.pricing_channels;
      if (Array.isArray(list) && list.length) {
        setPricing(list);
        return;
      }
    } catch {}
    setPricing([
      { id: "email", name: "Email", price: "₦100k", note: "Formal, branded delivery for 1-100 guests.", features: ["QR code included", "Invite preview", "RSVP tracking", "Delivery report", "Guest list upload"] },
      { id: "whatsapp", name: "WhatsApp", price: "₦200k", note: "Fast, familiar delivery for 1-100 guests.", features: ["QR code included", "Invite preview", "RSVP tracking", "Reminder-ready flow", "Delivery report"], highlight: true },
      { id: "sms", name: "SMS", price: "₦300k", note: "Reliable delivery for 1-100 guests, even without internet.", features: ["QR code included", "Short invite message", "RSVP tracking", "Delivery report", "Guest list upload"] },
    ]);
  };

  const updatePricing = (i: number, patch: any) => {
    setPricing((prev) => prev.map((ch, j) => (j === i ? { ...ch, ...patch } : ch)));
  };

  const savePricing = async () => {
    setPricingSaving(true);
    setPricingMsg("");
    try {
      await apiClient("/admin/settings/platform/pricing_channels", { method: "PUT", body: { value: pricing } });
      setPricingMsg("Pricing updated — live on the pricing page now.");
    } catch (err: any) {
      setPricingMsg("");
      alert(err.message || "Save failed");
    }
    setPricingSaving(false);
  };

  const isSuperAdmin = user?.role === "super_admin";

  const fetchAdmins = useCallback(async () => {
    setAdminsLoading(true);
    try {
      const data = await apiClient<{ users: AdminUser[] }>("/admin/users?role=admin&per_page=200");
      setAdmins(data.users || []);
    } catch { setAdmins([]); }
    setAdminsLoading(false);
  }, []);

  useEffect(() => {
    if (isSuperAdmin) fetchAdmins();
  }, [isSuperAdmin, fetchAdmins]);

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailMsg(""); setEmailError(""); setEmailLoading(true);
    try {
      const res = await apiClient<{ message: string }>("/auth/email", {
        method: "PUT", body: { new_email: newEmail, password: emailPassword },
      });
      setEmailMsg(res.message);
      setNewEmail(""); setEmailPassword("");
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Failed");
    }
    setEmailLoading(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(""); setPwError(""); setPwLoading(true);
    try {
      const res = await apiClient<{ message: string }>("/auth/change-password", {
        method: "POST", body: { current_password: currentPassword, new_password: newPassword },
      });
      setPwMsg(res.message);
      setCurrentPassword(""); setNewPassword("");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Failed");
    }
    setPwLoading(false);
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateMsg(""); setCreateError(""); setCreateLoading(true);
    try {
      const params = new URLSearchParams({
        email: createEmail, password: createPassword, full_name: createName,
      });
      await apiClient(`/admin/users?${params}`, { method: "POST" });
      setCreateMsg(`Admin ${createEmail} created`);
      setCreateEmail(""); setCreatePassword(""); setCreateName("Admin");
      fetchAdmins();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed");
    }
    setCreateLoading(false);
  };

  const handleEditAdminEmail = async (id: number) => {
    if (!editEmail) return;
    setEditLoading(true); setEditMsg("");
    try {
      await apiClient(`/admin/users/${id}/email?new_email=${encodeURIComponent(editEmail)}`, { method: "PUT" });
      setEditMsg("Email updated");
      setEditEmail("");
      setEditingAdmin(null);
      fetchAdmins();
    } catch (err) {
      setEditMsg(err instanceof Error ? err.message : "Failed");
    }
    setEditLoading(false);
  };

  const handleEditAdminPassword = async (id: number) => {
    if (!editPassword) return;
    setEditLoading(true); setEditMsg("");
    try {
      await apiClient(`/admin/users/${id}/password?new_password=${encodeURIComponent(editPassword)}`, { method: "PUT" });
      setEditMsg("Password updated");
      setEditPassword("");
      setEditingAdmin(null);
      fetchAdmins();
    } catch (err) {
      setEditMsg(err instanceof Error ? err.message : "Failed");
    }
    setEditLoading(false);
  };

  const handleDeleteAdmin = async (id: number, email: string) => {
    if (!confirm(`Delete admin ${email}? This cannot be undone.`)) return;
    try {
      await apiClient(`/admin/users/${id}`, { method: "DELETE" });
      fetchAdmins();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  if (authLoading || !user) return <div className="min-h-screen flex items-center justify-center bg-[#f8f9fc]"><Loader className="w-8 h-8 animate-spin text-[#1ABC9C]" /></div>;

  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      <aside className={`fixed left-0 top-0 h-screen flex flex-col transition-all duration-300 z-40 ${mobileNavOpen ? "translate-x-0 w-64" : "-translate-x-full w-64"} lg:translate-x-0 ${sidebarOpen ? "lg:w-64" : "lg:w-20"}`} style={{ background: "#0D1B2A", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="h-20 flex items-center justify-between px-4 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {sidebarOpen && <Link href="/admin" className="flex items-center gap-2"><Image src="/logo-mark.png" alt="" width={366} height={372} className="h-8 w-auto object-contain min-w-0" /><Image src="/logo-text.png" alt="Accredit Interactive" width={594} height={152} className="h-6 w-auto object-contain" /></Link>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-white/10 rounded-lg transition-colors hidden lg:block">
            {sidebarOpen ? <X className="w-5 h-5 text-white/80" /> : <Menu className="w-5 h-5 text-white/80" />}
          </button>
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
              <div className="text-xs text-white font-medium truncate" title={maskEmail(user.email)}>{maskEmail(user.email)}</div>
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
              <h1 className="text-2xl font-black text-[#0D1B2A]">Settings</h1>
            </div>
            <NotificationBell admin />
          </div>
        </header>

        <main className="p-4 sm:p-6 max-w-4xl">
          <div className="flex gap-2 mb-6 border-b border-[#e8edf2] pb-2">
            <button onClick={() => setTab("profile")}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${tab === "profile" ? "bg-[#1ABC9C] text-white" : "text-[#64748b] hover:text-[#0D1B2A]"}`}>
              My Profile
            </button>
            {isSuperAdmin && (
              <button onClick={() => setTab("admins")}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${tab === "admins" ? "bg-[#1ABC9C] text-white" : "text-[#64748b] hover:text-[#0D1B2A]"}`}>
                Manage Admins
              </button>
            )}
            {isSuperAdmin && (
              <button onClick={() => { setTab("platform"); loadPricing(); }}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${tab === "platform" ? "bg-[#1ABC9C] text-white" : "text-[#64748b] hover:text-[#0D1B2A]"}`}>
                Platform
              </button>
            )}
          </div>

          {tab === "profile" && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-[#e8edf2] p-6">
                <h2 className="text-lg font-black text-[#0D1B2A] mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-[#1ABC9C]" /> Admin Profile
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-sm">
                    <User className="w-4 h-4 text-[#94a3b8] flex-shrink-0" />
                    <span className="text-[#64748b] w-20 flex-shrink-0">Name</span>
                    <span className="text-[#0D1B2A] font-medium break-all min-w-0">{user.full_name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="w-4 h-4 text-[#94a3b8] flex-shrink-0" />
                    <span className="text-[#64748b] w-20 flex-shrink-0">Email</span>
                    <span className="text-[#0D1B2A] font-medium break-all min-w-0">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Shield className="w-4 h-4 text-[#94a3b8]" />
                    <span className="text-[#64748b] w-20">Role</span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-purple-50 text-purple-600 uppercase">{user.role}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#e8edf2] p-6">
                <h2 className="text-lg font-black text-[#0D1B2A] mb-4 flex items-center gap-2">
                  <Mail className="w-5 h-5 text-[#1ABC9C]" /> Change Email
                </h2>
                {emailMsg && <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">{emailMsg}</div>}
                {emailError && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{emailError}</div>}
                <form onSubmit={handleChangeEmail} className="space-y-4">
                  <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="New email address" required
                    className="w-full px-4 py-3 rounded-xl border border-[#d9e2ec] text-sm focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20 focus:border-[#1ABC9C]" />
                  <input type="password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)}
                    placeholder="Current password (required)" required
                    className="w-full px-4 py-3 rounded-xl border border-[#d9e2ec] text-sm focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20 focus:border-[#1ABC9C]" />
                  <button type="submit" disabled={emailLoading}
                    className="px-6 py-3 rounded-xl bg-[#1ABC9C] text-white font-bold text-sm hover:bg-[#16A085] transition-all disabled:opacity-50">
                    {emailLoading ? "Updating..." : "Update Email"}
                  </button>
                </form>
              </div>

              <div className="bg-white rounded-2xl border border-[#e8edf2] p-6">
                <h2 className="text-lg font-black text-[#0D1B2A] mb-4 flex items-center gap-2">
                  <Key className="w-5 h-5 text-[#1ABC9C]" /> Change Password
                </h2>
                {pwMsg && <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">{pwMsg}</div>}
                {pwError && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{pwError}</div>}
                <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                  <div className="relative">
                    <input type={showCurPw ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Current password" required
                      className="w-full px-4 py-3 pr-12 rounded-xl border border-[#d9e2ec] text-sm focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20 focus:border-[#1ABC9C]" />
                    <button type="button" onClick={() => setShowCurPw(!showCurPw)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94a3b8]">
                      {showCurPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="relative">
                    <input type={showNewPw ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password" required
                      className="w-full px-4 py-3 pr-12 rounded-xl border border-[#d9e2ec] text-sm focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20 focus:border-[#1ABC9C]" />
                    <button type="button" onClick={() => setShowNewPw(!showNewPw)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94a3b8]">
                      {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button type="submit" disabled={pwLoading}
                    className="px-6 py-3 rounded-xl bg-[#1ABC9C] text-white font-bold text-sm hover:bg-[#16A085] transition-all disabled:opacity-50">
                    {pwLoading ? "Changing..." : "Change Password"}
                  </button>
                </form>
              </div>
            </div>
          )}

          {tab === "admins" && isSuperAdmin && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-[#e8edf2] p-6">
                <h2 className="text-lg font-black text-[#0D1B2A] mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-[#1ABC9C]" /> Create New Admin
                </h2>
                {createMsg && <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">{createMsg}</div>}
                {createError && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{createError}</div>}
                <form onSubmit={handleCreateAdmin} className="space-y-4 max-w-md">
                  <input type="text" value={createName} onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Full name" required
                    className="w-full px-4 py-3 rounded-xl border border-[#d9e2ec] text-sm focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20 focus:border-[#1ABC9C]" />
                  <input type="email" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)}
                    placeholder="Admin email" required
                    className="w-full px-4 py-3 rounded-xl border border-[#d9e2ec] text-sm focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20 focus:border-[#1ABC9C]" />
                  <input type="text" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="Set password" required
                    className="w-full px-4 py-3 rounded-xl border border-[#d9e2ec] text-sm focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20 focus:border-[#1ABC9C]" />
                  <button type="submit" disabled={createLoading}
                    className="px-6 py-3 rounded-xl bg-[#1ABC9C] text-white font-bold text-sm hover:bg-[#16A085] transition-all disabled:opacity-50">
                    {createLoading ? "Creating..." : "Create Admin"}
                  </button>
                </form>
              </div>

              <div className="bg-white rounded-2xl border border-[#e8edf2] p-6">
                <h2 className="text-lg font-black text-[#0D1B2A] mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#1ABC9C]" /> All Admins
                </h2>
                {adminsLoading ? (
                  <div className="flex justify-center py-8"><Loader className="w-6 h-6 animate-spin text-[#1ABC9C]" /></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-[#e8edf2]">
                        <tr className="text-[#94a3b8] font-semibold">
                          <th className="text-left py-3 px-4">Name</th>
                          <th className="text-left py-3 px-4">Email</th>
                          <th className="text-left py-3 px-4">Role</th>
                          <th className="text-left py-3 px-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {admins.filter(a => a.role === "admin" || a.role === "super_admin").map((a) => (
                          <tr key={a.id} className="border-b border-[#e8edf2] hover:bg-[#f8f9fc] transition-colors">
                            <td className="py-3 px-4 font-semibold text-[#0D1B2A]">{a.full_name}</td>
                            <td className="py-3 px-4 text-[#64748b]">{a.email}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded-lg text-xs font-bold uppercase ${a.role === "super_admin" ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600"}`}>{a.role}</span>
                            </td>
                            <td className="py-3 px-4">
                              {a.role !== "super_admin" ? (
                                <div className="flex gap-2">
                                  <button onClick={() => setEditingAdmin(editingAdmin === a.id ? null : a.id)}
                                    className="px-3 py-1.5 rounded-lg bg-[#f0f1f7] text-[#0D1B2A] font-bold text-xs hover:bg-[#e8edf2] transition-all">
                                    Edit
                                  </button>
                                  <button onClick={() => handleDeleteAdmin(a.id, a.email)}
                                    className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 font-bold text-xs hover:bg-red-100 transition-all">
                                    <Trash2 className="w-3 h-3 inline" /> Delete
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-[#94a3b8]">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {editingAdmin && (
                          <tr>
                            <td colSpan={4} className="px-4 py-4 bg-[#f8f9fc]">
                              <div className="flex gap-4 items-end">
                                <div>
                                  <label className="text-xs font-bold text-[#64748b] block mb-1">New Email</label>
                                  <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                                    placeholder="Leave blank to skip"
                                    className="px-3 py-2 rounded-lg border border-[#d9e2ec] text-sm focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20" />
                                </div>
                                <button onClick={() => handleEditAdminEmail(editingAdmin)} disabled={editLoading || !editEmail}
                                  className="px-3 py-2 rounded-lg bg-[#1ABC9C] text-white font-bold text-xs hover:bg-[#16A085] transition-all disabled:opacity-50">
                                  Update Email
                                </button>
                                <div>
                                  <label className="text-xs font-bold text-[#64748b] block mb-1">New Password</label>
                                  <input type="text" value={editPassword} onChange={(e) => setEditPassword(e.target.value)}
                                    placeholder="Leave blank to skip"
                                    className="px-3 py-2 rounded-lg border border-[#d9e2ec] text-sm focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20" />
                                </div>
                                <button onClick={() => handleEditAdminPassword(editingAdmin)} disabled={editLoading || !editPassword}
                                  className="px-3 py-2 rounded-lg bg-[#0D1B2A] text-white font-bold text-xs hover:bg-[#1a2a3a] transition-all disabled:opacity-50">
                                  Update Password
                                </button>
                                {editMsg && <span className="text-xs text-green-600">{editMsg}</span>}
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "platform" && isSuperAdmin && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-[#e8edf2] p-6">
                <h2 className="text-lg font-black text-[#0D1B2A] mb-1">Channel Pricing</h2>
                <p className="text-xs text-[#94a3b8] mb-4">Shown on the public pricing page. Changes go live immediately.</p>
                {pricingMsg && <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">{pricingMsg}</div>}
                <div className="space-y-4">
                  {pricing.map((ch, i) => (
                    <div key={ch.id} className="rounded-xl border border-[#e8edf2] p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-black text-[#0D1B2A] capitalize">{ch.name}</p>
                        <label className="flex items-center gap-2 text-xs font-bold text-[#64748b] cursor-pointer">
                          <input type="checkbox" checked={!!ch.highlight} onChange={(e) => updatePricing(i, { highlight: e.target.checked })} className="w-4 h-4 rounded" />
                          Highlight
                        </label>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input value={ch.price} onChange={(e) => updatePricing(i, { price: e.target.value })} placeholder="Price (e.g. ₦100k)"
                          className="px-3 py-2.5 rounded-xl border border-[#d9e2ec] text-sm focus:outline-none focus:border-[#1ABC9C]" />
                        <input value={ch.note} onChange={(e) => updatePricing(i, { note: e.target.value })}
                          placeholder="Short note"
                          className="px-3 py-2.5 rounded-xl border border-[#d9e2ec] text-sm focus:outline-none focus:border-[#1ABC9C]" />
                      </div>
                      <textarea value={(ch.features || []).join(", ")} onChange={(e) => updatePricing(i, { features: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                        placeholder="Features, comma separated"
                        className="mt-2 w-full px-3 py-2.5 rounded-xl border border-[#d9e2ec] text-sm focus:outline-none focus:border-[#1ABC9C] resize-none" rows={2} />
                    </div>
                  ))}
                </div>
                <button onClick={savePricing} disabled={pricingSaving} className="mt-4 px-6 py-3 rounded-xl bg-[#1ABC9C] text-white font-bold text-sm hover:bg-[#16A085] transition-all disabled:opacity-50">
                  {pricingSaving ? "Saving..." : "Save pricing"}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
