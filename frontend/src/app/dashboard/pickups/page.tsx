"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Package, X, Menu,
  LogOut, Mail, MessageCircle,
  Search, UserPlus, CheckCircle2, Clock, AlertTriangle,
  Send, Pencil, Trash2, Users, UserCog, Printer, FileText,
} from "lucide-react";

interface Pickup {
  id: number;
  customer_name: string;
  email: string | null;
  phone: string | null;
  code: string;
  qr_token: string;
  status: string;
  valid_from: string | null;
  expires_at: string;
  picked_up_at: string | null;
  location: string;
  venue_phone: string | null;
  created_at: string;
  email_sent: boolean;
  whatsapp_sent: boolean;
  email_sent_at: string | null;
  whatsapp_sent_at: string | null;
}

interface StaffUser {
  id: number;
  email: string;
  name: string;
  role: string;
  created_at: string | null;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : null;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Strict`;
}

const BRAND_NAME = "Lajokes Fashion";

function PickupsContent() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string>("staff");
  const [userName, setUserName] = useState<string>("");
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newValidFrom, setNewValidFrom] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notifMsg, setNotifMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [editTarget, setEditTarget] = useState<Pickup | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editValidFrom, setEditValidFrom] = useState("");
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Pickup | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sendingMsg, setSendingMsg] = useState<number | null>(null);
  const [collectTarget, setCollectTarget] = useState<Pickup | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffLoading, setStaffLoading] = useState(false);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    const token = getCookie("pickup_token");
    if (!token) {
      router.push("/dashboard/pickups/login");
      return;
    }
    setAuthenticated(true);
    fetchPickups();
    fetchMe();
  }, [router]);

  const fetchMe = async () => {
    try {
      const res = await fetch("/api/v1/pickups/me");
      if (res.ok) {
        const data = await res.json();
        setUserRole(data.role);
        setUserName(data.name);
      }
    } catch {}
  };

  const fetchPickups = async () => {
    try {
      const res = await fetch("/api/v1/pickups");
      if (res.ok) {
        const data = await res.json();
        setPickups(Array.isArray(data) ? data : []);
      } else if (res.status === 401) {
        deleteCookie("pickup_token");
        router.push("/dashboard/pickups/login");
        return;
      }
    } catch {}
    setLoading(false);
  };

  const showNotif = (text: string, type: "success" | "error") => {
    setNotifMsg({ text, type });
    setTimeout(() => setNotifMsg(null), 4000);
  };

  const handleAddClient = async () => {
    if (!newName.trim()) return;
    setSubmitting(true);
    try {
      const body: Record<string, any> = {
        customer_name: newName.trim(),
        email: newEmail.trim() || null,
        phone: newPhone.trim() || null,
      };
      if (newValidFrom) {
        body.valid_from = new Date(newValidFrom).toISOString();
      }

      const res = await fetch("/api/v1/pickups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to create");
      setShowAddModal(false);
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      setNewValidFrom("");
      showNotif("Client added successfully", "success");
      await fetchPickups();
    } catch {
      showNotif("Failed to add client", "error");
    }
    setSubmitting(false);
  };

  const handleSendAll = async (p: Pickup) => {
    if (!p.email && !p.phone) { showNotif("No email or phone for this client", "error"); return; }
    setSendingMsg(p.id);
    try {
      const res = await fetch(`/api/v1/pickups/${p.id}/send-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        showNotif("Email & WhatsApp sent successfully", "success");
        await fetchPickups();
      } else {
        const err = await res.json();
        showNotif(err.detail || "Failed to send", "error");
      }
    } catch { showNotif("Network error", "error"); }
    setSendingMsg(null);
  };

  function toDatetimeLocal(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const handleEdit = (p: Pickup) => {
    setEditTarget(p);
    setEditName(p.customer_name);
    setEditEmail(p.email || "");
    setEditPhone(p.phone || "");
    setEditValidFrom(toDatetimeLocal(p.valid_from));
    setEditExpiresAt(toDatetimeLocal(p.expires_at));
  };

  const handleSaveEdit = async () => {
    if (!editTarget || !editName.trim()) return;
    setSubmitting(true);
    try {
      const body: Record<string, any> = {
        customer_name: editName.trim(),
        email: editEmail.trim() || null,
        phone: editPhone.trim() || null,
      };
      if (editValidFrom) body.valid_from = new Date(editValidFrom).toISOString();
      const res = await fetch(`/api/v1/pickups/${editTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setEditTarget(null);
        showNotif("Client updated successfully", "success");
        await fetchPickups();
      } else {
        const err = await res.json();
        showNotif(err.detail || "Failed to update", "error");
      }
    } catch { showNotif("Network error", "error"); }
    setSubmitting(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/pickups/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteTarget(null);
        showNotif("Client deleted", "success");
        await fetchPickups();
      } else {
        const err = await res.json();
        showNotif(err.detail || "Failed to delete", "error");
      }
    } catch { showNotif("Network error", "error"); }
    setDeleting(false);
  };

  const handleCollect = async () => {
    if (!collectTarget) return;
    setCollecting(true);
    try {
      const res = await fetch(`/api/v1/pickups/${collectTarget.id}/collect`, { method: "POST" });
      if (res.ok) {
        setCollectTarget(null);
        showNotif(`Pickup confirmed for ${collectTarget.customer_name}`, "success");
        await fetchPickups();
      } else {
        const err = await res.json();
        showNotif(err.detail || "Failed to confirm pickup", "error");
      }
    } catch { showNotif("Network error", "error"); }
    setCollecting(false);
  };

  const handleStaffModalOpen = async () => {
    setShowStaffModal(true);
    setStaffLoading(true);
    try {
      const res = await fetch("/api/v1/pickups/staff/list");
      if (res.ok) {
        setStaffList(await res.json());
      }
    } catch {}
    setStaffLoading(false);
  };

  const handleCreateStaff = async () => {
    if (!staffName.trim() || !staffEmail.trim() || !staffPassword.trim()) {
      showNotif("All staff fields required", "error");
      return;
    }
    setStaffLoading(true);
    try {
      const res = await fetch("/api/v1/pickups/staff/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: staffName.trim(),
          email: staffEmail.trim(),
          password: staffPassword,
        }),
      });
      if (res.ok) {
        showNotif("Staff created successfully", "success");
        setStaffName("");
        setStaffEmail("");
        setStaffPassword("");
        const r2 = await fetch("/api/v1/pickups/staff/list");
        if (r2.ok) setStaffList(await r2.json());
      } else {
        const err = await res.json();
        showNotif(err.detail || "Failed to create staff", "error");
      }
    } catch { showNotif("Network error", "error"); }
    setStaffLoading(false);
  };

  const handleDeleteStaff = async (staffId: number) => {
    try {
      const res = await fetch(`/api/v1/pickups/staff/${staffId}`, { method: "DELETE" });
      if (res.ok) {
        showNotif("Staff deleted", "success");
        const r2 = await fetch("/api/v1/pickups/staff/list");
        if (r2.ok) setStaffList(await r2.json());
      } else {
        const err = await res.json();
        showNotif(err.detail || "Failed to delete staff", "error");
      }
    } catch { showNotif("Network error", "error"); }
  };

  const handleLogout = () => {
    deleteCookie("pickup_token");
    router.push("/dashboard/pickups/login");
  };

  const isSuperAdmin = userRole === "super_admin";

  const statusBadge = (status: string, expires_at: string) => {
    if (status === "picked_up") {
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3" />Picked Up</span>;
    }
    if (new Date(expires_at) < new Date()) {
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700"><AlertTriangle className="w-3 h-3" />Expired</span>;
    }
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700"><Clock className="w-3 h-3" />Pending</span>;
  };

  const filtered = pickups.filter((p) =>
    p.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.phone || "").includes(searchQuery)
  );

  if (!authenticated) return null;

  return (
    <div className="flex min-h-screen bg-[#f8f9fc]">
      {mobileNavOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileNavOpen(false)} />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${sidebarOpen ? "w-64" : "w-20"}`}
        style={{ background: "linear-gradient(180deg, #0D1B2A 0%, #1a2d42 100%)" }}
      >
        <div className="h-16 flex items-center justify-between px-4 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <Package className="w-6 h-6 text-[#6F3D14]" />
              <span className="font-bold text-white text-sm">Lajokes Fashion</span>
            </div>
          )}
          <button onClick={() => { setSidebarOpen(!sidebarOpen); setMobileNavOpen(false); }} className="p-2 hover:bg-white/10 rounded-lg transition-colors" title={sidebarOpen ? "Collapse" : "Expand"}>
            {sidebarOpen ? <X className="w-5 h-5 text-white/80" /> : <Menu className="w-5 h-5 text-white/80" />}
          </button>
        </div>

        <nav className="flex-1 px-3 py-6">
          {sidebarOpen && <p className="px-3 text-[10px] font-bold text-white/25 uppercase tracking-widest mb-3">Pickup Management</p>}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium" style={{ background: "rgba(111,61,20,0.15)", color: "#6F3D14" }}>
            <Package className="w-4 h-4" />
            {sidebarOpen && <span>Pickups</span>}
          </div>
          {isSuperAdmin && sidebarOpen && (
            <button onClick={handleStaffModalOpen} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 mt-2 transition-colors">
              <UserCog className="w-4 h-4" />
              <span>Manage Staff</span>
            </button>
          )}
        </nav>

        <div className="px-3 py-4 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {sidebarOpen && (
            <p className="px-3 text-xs text-white/40 mb-2 truncate">
              {userName} ({isSuperAdmin ? "Admin" : "Staff"})
            </p>
          )}
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-50 border-2 border-red-200 text-red-600 hover:bg-red-100 hover:border-red-400 font-bold text-sm transition-all"
          >
            <LogOut className="w-5 h-5" /> {sidebarOpen && "Sign Out"}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center justify-between px-6 flex-shrink-0" style={{ background: "white", borderBottom: "1px solid #e8edf2" }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileNavOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <Menu className="w-5 h-5 text-[#0D1B2A]" />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-[#0D1B2A] truncate">Pickup Management</h1>
              <p className="text-xs text-gray-400 truncate">Lajokes Fashion - Order pickup tracking</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowReport(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#d9e2ec] text-[#0D1B2A] text-sm font-semibold hover:bg-[#f8f9fc] transition-colors">
              <FileText className="w-4 h-4" /> View Report
            </button>
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#6F3D14] text-white text-sm font-bold hover:bg-[#5a3110] transition-colors">
              <UserPlus className="w-4 h-4" /> Add Client
            </button>
          </div>
        </header>

        <main className="flex-1 px-6 py-8 overflow-auto">
          {notifMsg && (
            <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-semibold ${
              notifMsg.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
            }`}>
              {notifMsg.text}
            </div>
          )}

          <div className="mb-6 relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, code, email, or phone..."
              className="w-full h-11 pl-10 pr-4 rounded-lg border border-[#d9e2ec] text-sm outline-none focus:border-[#6F3D14] focus:ring-1 focus:ring-[#6F3D14]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[
              { label: "Total Clients", value: pickups.length, color: "#6F3D14", bg: "rgba(111,61,20,0.08)" },
              { label: "Pending Pickups", value: pickups.filter((p) => p.status === "pending" && new Date(p.expires_at) >= new Date()).length, color: "#f59e0b", bg: "rgba(245,158,11,0.08)" },
              { label: "Completed", value: pickups.filter((p) => p.status === "picked_up").length, color: "#10b981", bg: "rgba(16,185,129,0.08)" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl p-4 flex items-center gap-4" style={{ background: "white", border: "1px solid #e8edf2" }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: stat.bg, color: stat.color }}>
                  {stat.label === "Total Clients" ? <Package className="w-5 h-5" /> : stat.label === "Pending Pickups" ? <Clock className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#0D1B2A]">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-[#e8edf2] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: "#f8f9fc", borderBottom: "1px solid #e8edf2" }}>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#64748b] uppercase tracking-wider">Client</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#64748b] uppercase tracking-wider">Phone</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#64748b] uppercase tracking-wider">Code</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#64748b] uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#64748b] uppercase tracking-wider">Sent</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-[#64748b] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">Loading...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">No pickups found</td></tr>
                  ) : filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-[#f8f9fc] transition-colors" style={{ borderBottom: "1px solid #f0f2f5" }}>
                      <td className="px-4 py-4">
                        <p className="text-sm font-semibold text-[#0D1B2A]">{p.customer_name}</p>
                        <p className="text-xs text-gray-400">{p.email || "-"}</p>
                      </td>
                      <td className="px-4 py-4">
                        {p.phone ? (
                          <a href={`https://wa.me/${p.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-sm font-mono text-[#6F3D14] hover:underline">
                            {p.phone}
                          </a>
                        ) : <span className="text-sm font-mono text-[#64748b]">-</span>}
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-mono font-bold text-sm text-[#6F3D14]">{p.code}</span>
                      </td>
                      <td className="px-4 py-4">{statusBadge(p.status, p.expires_at)}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${p.email_sent ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`} title={p.email_sent_at ? `Sent: ${new Date(p.email_sent_at).toLocaleString("en-GB")}` : "Not sent"}>
                            <Mail className="w-3 h-3" />
                            {p.email_sent_at && <span className="text-[9px] font-normal ml-0.5">{new Date(p.email_sent_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} {new Date(p.email_sent_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${p.whatsapp_sent ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`} title={p.whatsapp_sent_at ? `Sent: ${new Date(p.whatsapp_sent_at).toLocaleString("en-GB")}` : "Not sent"}>
                            <MessageCircle className="w-3 h-3" />
                            {p.whatsapp_sent_at && <span className="text-[9px] font-normal ml-0.5">{new Date(p.whatsapp_sent_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} {new Date(p.whatsapp_sent_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {p.status === "pending" && new Date(p.expires_at) >= new Date() && (
                            <button
                              onClick={() => setCollectTarget(p)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                              style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}
                              title="Mark as Collected"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Collect
                            </button>
                          )}
                          <button
                            onClick={() => handleSendAll(p)}
                            disabled={(!p.email && !p.phone) || sendingMsg === p.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ background: "rgba(111,61,20,0.12)", color: "#6F3D14" }}
                            title="Send Email & WhatsApp"
                          >
                            {sendingMsg === p.id ? <><Clock className="w-3.5 h-3.5 animate-spin" /> Sending...</> : <><Send className="w-3.5 h-3.5" /> Send</>}
                          </button>
                          <button onClick={() => handleEdit(p)} className="p-1.5 rounded-lg hover:bg-[#f0e6db] transition-colors" title="Edit">
                            <Pencil className="w-4 h-4 text-[#6F3D14]" />
                          </button>
                          {isSuperAdmin && (
                            <button onClick={() => setDeleteTarget(p)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Delete">
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {showReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid #e8edf2" }}>
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-[#6F3D14]" />
                <h2 className="text-lg font-bold text-[#0D1B2A]">Pickup Report - {BRAND_NAME}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#d9e2ec] text-[#0D1B2A] text-sm font-semibold hover:bg-[#f8f9fc] transition-colors">
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button onClick={() => setShowReport(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {(() => {
                  const total = pickups.length;
                  const pending = pickups.filter(p => p.status === "pending" && new Date(p.expires_at) >= new Date()).length;
                  const completed = pickups.filter(p => p.status === "picked_up").length;
                  const expired = pickups.filter(p => p.status === "pending" && new Date(p.expires_at) < new Date()).length;
                  return [
                    { label: "Total Clients", value: total, color: "#6F3D14", bg: "rgba(111,61,20,0.08)" },
                    { label: "Pending", value: pending, color: "#f59e0b", bg: "rgba(245,158,11,0.08)" },
                    { label: "Completed", value: completed, color: "#10b981", bg: "rgba(16,185,129,0.08)" },
                    { label: "Expired", value: expired, color: "#ef4444", bg: "rgba(239,68,68,0.08)" },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: "white", border: "1px solid #e8edf2" }}>
                      <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                      <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                    </div>
                  ));
                })()}
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-bold text-[#0D1B2A] uppercase tracking-wider mb-3">Client Details</h3>
                {pickups.length === 0 ? (
                  <p className="text-sm text-gray-400 py-8 text-center">No pickups found</p>
                ) : (
                  pickups.map((p) => {
                    const isExpired = p.status === "pending" && new Date(p.expires_at) < new Date();
                    const isCompleted = p.status === "picked_up";
                    const isPending = p.status === "pending" && !isExpired;
                    const borderColor = isCompleted ? "#10b981" : isExpired ? "#ef4444" : "#f59e0b";
                    return (
                      <div key={p.id} className="rounded-xl p-4" style={{ background: "white", border: `1px solid ${borderColor}20`, borderLeft: `4px solid ${borderColor}` }}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-[#0D1B2A]">{p.customer_name}</p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                              {p.email && <span>Email: {p.email}</span>}
                              {p.phone && <span>Phone: <a href={`https://wa.me/${p.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-[#6F3D14] hover:underline">{p.phone}</a></span>}
                              <span>Code: <strong className="font-mono text-[#6F3D14]">{p.code}</strong></span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {isCompleted && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3" />Picked Up</span>}
                            {isExpired && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700"><AlertTriangle className="w-3 h-3" />Expired</span>}
                            {isPending && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700"><Clock className="w-3 h-3" />Pending</span>}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-xs text-gray-400">
                          <span>Valid: {new Date(p.valid_from || p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                          <span>Expires: {new Date(p.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                          {p.picked_up_at && <span>Picked: {new Date(p.picked_up_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div className="px-6 py-3 flex-shrink-0 text-xs text-gray-400 text-center" style={{ borderTop: "1px solid #e8edf2" }}>
              Report generated {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} &mdash; {BRAND_NAME}
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-[#0D1B2A] mb-6">Add Pickup Client</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Full Name *</label>
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Customer name" className="w-full h-11 px-3 rounded-lg border border-[#d9e2ec] text-sm outline-none focus:border-[#6F3D14] focus:ring-1 focus:ring-[#6F3D14]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Email *</label>
                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="customer@email.com" className="w-full h-11 px-3 rounded-lg border border-[#d9e2ec] text-sm outline-none focus:border-[#6F3D14] focus:ring-1 focus:ring-[#6F3D14]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Phone (WhatsApp) *</label>
                <input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+2348012345678" className="w-full h-11 px-3 rounded-lg border border-[#d9e2ec] text-sm outline-none focus:border-[#6F3D14] focus:ring-1 focus:ring-[#6F3D14]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Valid From (leave empty for current time)</label>
                <input type="datetime-local" value={newValidFrom} onChange={(e) => setNewValidFrom(e.target.value)} className="w-full h-11 px-3 rounded-lg border border-[#d9e2ec] text-sm outline-none focus:border-[#6F3D14] focus:ring-1 focus:ring-[#6F3D14]" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-[#e8edf2] text-[#0D1B2A] font-semibold hover:bg-[#f8f9fc] transition-colors text-sm">Cancel</button>
              <button onClick={handleAddClient} disabled={submitting || !newName.trim() || !newEmail.trim() || !newPhone.trim()} className="flex-1 px-4 py-2.5 rounded-lg bg-[#6F3D14] text-white font-bold hover:bg-[#5a3110] disabled:opacity-50 transition-colors text-sm">
                {submitting ? "Adding..." : "Add Client"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold text-[#0D1B2A] mb-2">Sign Out</h3>
            <p className="text-sm text-[#64748b] mb-6">Are you sure you want to sign out?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-[#e8edf2] text-[#0D1B2A] font-semibold hover:bg-[#f8f9fc] transition-colors text-sm">Cancel</button>
              <button onClick={handleLogout} className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition-colors text-sm">Sign Out</button>
            </div>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-[#0D1B2A] mb-6">Edit Pickup Client</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Full Name *</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Customer name" className="w-full h-11 px-3 rounded-lg border border-[#d9e2ec] text-sm outline-none focus:border-[#6F3D14] focus:ring-1 focus:ring-[#6F3D14]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Email *</label>
                <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="customer@email.com" className="w-full h-11 px-3 rounded-lg border border-[#d9e2ec] text-sm outline-none focus:border-[#6F3D14] focus:ring-1 focus:ring-[#6F3D14]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Phone (WhatsApp) *</label>
                <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+2348012345678" className="w-full h-11 px-3 rounded-lg border border-[#d9e2ec] text-sm outline-none focus:border-[#6F3D14] focus:ring-1 focus:ring-[#6F3D14]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Valid From</label>
                <input type="datetime-local" value={editValidFrom} onChange={(e) => {
                  setEditValidFrom(e.target.value);
                  if (e.target.value) {
                    const d = new Date(e.target.value);
                    d.setHours(d.getHours() + 48);
                    const pad = (n: number) => n.toString().padStart(2, "0");
                    setEditExpiresAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
                  }
                }} className="w-full h-11 px-3 rounded-lg border border-[#d9e2ec] text-sm outline-none focus:border-[#6F3D14] focus:ring-1 focus:ring-[#6F3D14]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Expires At (auto: +48h)</label>
                <input type="datetime-local" value={editExpiresAt} disabled className="w-full h-11 px-3 rounded-lg border border-[#d9e2ec] text-sm outline-none bg-gray-50 text-gray-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditTarget(null)} className="flex-1 px-4 py-2.5 rounded-lg border border-[#e8edf2] text-[#0D1B2A] font-semibold hover:bg-[#f8f9fc] transition-colors text-sm">Cancel</button>
              <button onClick={handleSaveEdit} disabled={submitting || !editName.trim() || !editEmail.trim() || !editPhone.trim()} className="flex-1 px-4 py-2.5 rounded-lg bg-[#6F3D14] text-white font-bold hover:bg-[#5a3110] disabled:opacity-50 transition-colors text-sm">
                {submitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {collectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold text-[#0D1B2A] mb-2">Confirm Pickup</h3>
            <p className="text-sm text-[#64748b] mb-2">Mark <strong>{collectTarget.customer_name}</strong> as picked up?</p>
            <p className="text-xs text-gray-400 mb-6">Code: <strong className="font-mono text-[#6F3D14]">{collectTarget.code}</strong>: Verify customer&apos;s code matches.</p>
            <div className="flex gap-3">
              <button onClick={() => setCollectTarget(null)} className="flex-1 px-4 py-2.5 rounded-lg border border-[#e8edf2] text-[#0D1B2A] font-semibold hover:bg-[#f8f9fc] transition-colors text-sm">Cancel</button>
              <button onClick={handleCollect} disabled={collecting} className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors text-sm flex items-center justify-center gap-2">
                {collecting ? <><Clock className="w-4 h-4 animate-spin" /> Confirming...</> : <><CheckCircle2 className="w-4 h-4" /> Confirm Pickup</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold text-[#0D1B2A] mb-2">Delete Client</h3>
            <p className="text-sm text-[#64748b] mb-6">Are you sure you want to delete <strong>{deleteTarget.customer_name}</strong>? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2.5 rounded-lg border border-[#e8edf2] text-[#0D1B2A] font-semibold hover:bg-[#f8f9fc] transition-colors text-sm">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50 transition-colors text-sm">
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showStaffModal && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[#0D1B2A]">Manage Staff</h2>
              <button onClick={() => setShowStaffModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="mb-6 p-4 rounded-lg bg-[#f8f9fc] border border-[#e8edf2]">
              <h3 className="text-sm font-bold text-[#0D1B2A] mb-3">Add New Staff</h3>
              <div className="space-y-3">
                <input type="text" value={staffName} onChange={(e) => setStaffName(e.target.value)} placeholder="Staff name" className="w-full h-10 px-3 rounded-lg border border-[#d9e2ec] text-sm outline-none focus:border-[#6F3D14]" />
                <input type="email" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} placeholder="staff@email.com" className="w-full h-10 px-3 rounded-lg border border-[#d9e2ec] text-sm outline-none focus:border-[#6F3D14]" />
                <input type="password" value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)} placeholder="Temporary password" className="w-full h-10 px-3 rounded-lg border border-[#d9e2ec] text-sm outline-none focus:border-[#6F3D14]" />
                <button onClick={handleCreateStaff} disabled={staffLoading} className="w-full px-4 py-2 rounded-lg bg-[#6F3D14] text-white font-bold hover:bg-[#5a3110] disabled:opacity-50 transition-colors text-sm">
                  {staffLoading ? "Creating..." : "Create Staff"}
                </button>
              </div>
            </div>

            <h3 className="text-sm font-bold text-[#0D1B2A] mb-3">Current Staff</h3>
            {staffLoading ? (
              <p className="text-sm text-gray-400">Loading...</p>
            ) : staffList.length === 0 ? (
              <p className="text-sm text-gray-400">No staff found</p>
            ) : (
              <div className="space-y-2">
                {staffList.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-[#e8edf2]">
                    <div>
                      <p className="text-sm font-semibold text-[#0D1B2A]">{s.name}</p>
                      <p className="text-xs text-gray-400">{s.email}</p>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${s.role === "super_admin" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                        {s.role === "super_admin" ? "Super Admin" : "Staff"}
                      </span>
                    </div>
                    {s.role !== "super_admin" && (
                      <button onClick={() => handleDeleteStaff(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Delete staff">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PickupsPage() {
  return <PickupsContent />;
}
