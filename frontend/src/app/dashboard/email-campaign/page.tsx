"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import Link from "next/link";
import Image from "next/image";
import { Upload, Send, BarChart3, Users, MousePointerClick, Mail, Eye, Plus, RefreshCw, LogOut, Lock, Menu, X, ChevronRight, ExternalLink, Download, CheckCircle, XCircle, Clock, AlertTriangle, Edit2, UserPlus, LayoutGrid, CalendarDays, Wallet as WalletIcon } from "lucide-react";

interface Campaign {
  id: number;
  name: string;
  total_contacts: number;
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  status: string;
  created_at: string;
}

interface Recipient {
  id: number;
  name: string;
  email: string;
  sent: boolean;
  opened: boolean;
  clicked: boolean;
  error: string | null;
}

export default function EmailCampaignPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [sendingCount, setSendingCount] = useState(1000);
  const [sendingCampaign, setSendingCampaign] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [sendingSingle, setSendingSingle] = useState<number | null>(null);
  const [recipientPage, setRecipientPage] = useState(1);
  const RECIPIENTS_PER_PAGE = 50;

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    fetchCampaigns();
  }, [user, authLoading]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/email-campaign/list");
      if (res.ok) {
        const data = await res.json();
        setCampaigns(Array.isArray(data) ? data : []);
      }
    } catch {}
    setLoading(false);
  };

  const fetchRecipients = async (campaignId: number) => {
    try {
      const res = await fetch(`/api/v1/email-campaign/${campaignId}/recipients`);
      if (res.ok) {
        const data = await res.json();
        setRecipients(Array.isArray(data) ? data : []);
      }
    } catch {}
  };

  const handleUpload = async () => {
    if (!csvFile || !campaignName.trim()) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", csvFile);
      form.append("name", campaignName.trim());
      const res = await fetch("/api/v1/email-campaign/upload", { method: "POST", body: form });
      if (res.ok) {
        setShowCreateModal(false);
        setCsvFile(null);
        setCampaignName("");
        await fetchCampaigns();
      } else {
        const err = await res.json();
        alert(err.detail || "Upload failed");
      }
    } catch {}
    setUploading(false);
  };

  const handleSend = async (campaignId: number) => {
    setSendingCampaign(true);
    try {
      const res = await fetch(`/api/v1/email-campaign/${campaignId}/send?count=${sendingCount}`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setToast({ message: data.message || "Campaign sending started", type: "success" });
        await fetchCampaigns();
      } else {
        const err = await res.json();
        setToast({ message: err.detail || "Send failed", type: "error" });
      }
    } catch (e) {
      setToast({ message: "Network error: could not send campaign", type: "error" });
    }
    setSendingCampaign(false);
  };

  const handleSendSingle = async (campaignId: number, recipientId: number) => {
    setSendingSingle(recipientId);
    try {
      const res = await fetch(`/api/v1/email-campaign/${campaignId}/send-single/${recipientId}`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setToast({ message: data.message || "Email sent successfully", type: "success" });
        await fetchRecipients(campaignId);
        await fetchCampaigns();
      } else {
        const err = await res.json();
        setToast({ message: err.detail || "Send failed", type: "error" });
      }
    } catch (e) {
      setToast({ message: "Network error: could not send email", type: "error" });
    }
    setSendingSingle(null);
  };

  const handleAddGuest = async () => {
    if (!selectedCampaign || !newName.trim() || !newEmail.trim()) return;
    try {
      const form = new FormData();
      form.append("name", newName.trim());
      form.append("email", newEmail.trim());
      form.append("phone", newPhone.trim());
      const res = await fetch(`/api/v1/email-campaign/${selectedCampaign.id}/recipient`, { method: "POST", body: form });
      if (res.ok) {
        setNewName("");
        setNewEmail("");
        setNewPhone("");
        setShowAddGuest(false);
        await fetchRecipients(selectedCampaign.id);
        await fetchCampaigns();
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to add guest");
      }
    } catch {}
  };

  const handleEditRecipient = async () => {
    if (!selectedCampaign || !editingRecipient) return;
    try {
      const form = new FormData();
      form.append("name", editName.trim());
      form.append("email", editEmail.trim());
      form.append("phone", editPhone.trim());
      const res = await fetch(`/api/v1/email-campaign/${selectedCampaign.id}/recipient/${editingRecipient.id}`, { method: "PUT", body: form });
      if (res.ok) {
        setEditingRecipient(null);
        await fetchRecipients(selectedCampaign.id);
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to update");
      }
    } catch {}
  };

  const viewCampaign = async (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setRecipientPage(1);
    await fetchRecipients(campaign.id);
  };

  const paginatedRecipients = recipients.slice((recipientPage - 1) * RECIPIENTS_PER_PAGE, recipientPage * RECIPIENTS_PER_PAGE);
  const totalPages = Math.ceil(recipients.length / RECIPIENTS_PER_PAGE);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fc]">
        <RefreshCw className="w-5 h-5 animate-spin text-[#64748b]" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-[#f8f9fc]">
      {/* Inline Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 flex-col flex-shrink-0 transition-all duration-300 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:flex`} style={{ background: "#0D1B2A", width: sidebarOpen ? "256px" : "80px" }}>
        <div className="flex items-center justify-between h-24 px-4 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Link href="/" onClick={() => setMobileNavOpen(false)} className="flex items-center flex-1 min-w-0">
            <Image src="/logo-mark.png" alt="Accredit Interactive" width={4086} height={801} className="h-16 w-auto object-contain drop-shadow-[0_0_12px_rgba(26, 188, 156,0.25)]" />
          </Link>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0 hidden lg:block ml-2" title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}>
            {sidebarOpen ? <X className="w-5 h-5 text-white/80" /> : <Menu className="w-5 h-5 text-white/80" />}
          </button>
        </div>
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {sidebarOpen && <p className="px-3 text-[10px] font-bold text-white/25 uppercase tracking-widest mb-3">Main Menu</p>}
          {[
            { href: "/dashboard/email-campaign", label: "Email Campaign", icon: <Mail className="w-4 h-4" /> },
            { href: "/dashboard", label: "Dashboard", icon: <LayoutGrid className="w-4 h-4" /> },
            { href: "/dashboard/events", label: "Events", icon: <CalendarDays className="w-4 h-4" /> },
            { href: "/dashboard/create", label: "Create Event", icon: <Plus className="w-4 h-4" /> },
            { href: "/dashboard/wallet", label: "Wallet", icon: <WalletIcon className="w-4 h-4" /> },
          ].map((item) => {
            const isActive = item.href === "/dashboard/email-campaign";
            return (
              <Link key={item.href} href={item.href} onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group" style={{ background: isActive ? "rgba(26, 188, 156,0.15)" : "transparent", color: isActive ? "#1ABC9C" : "rgba(255,255,255,0.6)" }}>
                <span className={isActive ? "text-[#1ABC9C]" : "text-white/40"}>{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-4 flex-shrink-0 space-y-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: "linear-gradient(135deg, #1ABC9C, #16A085)" }}>
              {user?.full_name?.charAt(0) || "U"}
            </div>
            {sidebarOpen && <div className="min-w-0 flex-1"><p className="text-white text-xs font-semibold truncate">{user?.full_name}</p><p className="text-white/40 text-xs truncate">{user?.email}</p></div>}
          </div>
          {sidebarOpen && (
            <>
              <Link href="/dashboard/change-password" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#1ABC9C] bg-[#1ABC9C]/10 hover:bg-[#1ABC9C]/20 transition-all w-full">
                <Lock className="w-4 h-4" /> Change Password
              </Link>
              <button onClick={() => setShowLogoutConfirm(true)} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-50 border-2 border-red-200 text-red-600 hover:bg-red-100 hover:border-red-400 font-bold text-sm transition-all">
                <LogOut className="w-5 h-5" /> Sign Out
              </button>
            </>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center justify-between px-6 flex-shrink-0" style={{ background: "white", borderBottom: "1px solid #e8edf2" }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileNavOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <Menu className="w-5 h-5 text-[#0D1B2A]" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-[#0D1B2A]">Email Campaigns</h1>
              <p className="text-xs text-gray-400">Send email campaigns with click tracking</p>
            </div>
          </div>
        </header>

        <main className="flex-1 px-6 py-8 overflow-auto">
          {/* Stats Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Total Campaigns", value: campaigns.length, icon: <BarChart3 className="w-5 h-5" />, color: "#1ABC9C", bg: "rgba(26, 188, 156,0.08)" },
              { label: "Total Contacts", value: campaigns.reduce((s, c) => s + c.total_contacts, 0), icon: <Users className="w-5 h-5" />, color: "#3B82F6", bg: "rgba(59,130,246,0.08)" },
              { label: "Sent", value: campaigns.reduce((s, c) => s + c.sent_count, 0), icon: <Send className="w-5 h-5" />, color: "#22C55E", bg: "rgba(34,197,94,0.08)" },
              { label: "Clicked", value: campaigns.reduce((s, c) => s + c.clicked_count, 0), icon: <MousePointerClick className="w-5 h-5" />, color: "#8B5CF6", bg: "rgba(139,92,246,0.08)" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl p-4 flex items-center gap-4 bg-white border border-[#e8edf2]">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: stat.bg, color: stat.color }}>
                  {stat.icon}
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#0D1B2A]">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Campaign List */}
          <div className="bg-white rounded-xl border border-[#e8edf2] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8edf2]">
              <h2 className="text-lg font-bold text-[#0D1B2A]">Campaigns</h2>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-bold transition-colors"
                style={{ background: "linear-gradient(135deg, #1ABC9C, #16A085)" }}
              >
                <Upload className="w-4 h-4" />
                Upload CSV
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: "#f8f9fc", borderBottom: "1px solid #e8edf2" }}>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#64748b] uppercase tracking-wider">Campaign</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-[#64748b] uppercase tracking-wider">Contacts</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-[#64748b] uppercase tracking-wider">Sent</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-[#64748b] uppercase tracking-wider">Clicked</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-[#64748b] uppercase tracking-wider">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-[#64748b] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">Loading...</td></tr>
                  ) : campaigns.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">
                      <p className="mb-2">No campaigns yet</p>
                      <button onClick={() => setShowCreateModal(true)} className="text-[#1ABC9C] font-semibold hover:underline">Upload your first CSV</button>
                    </td></tr>
                  ) : campaigns.map((c) => (
                    <tr key={c.id} className="hover:bg-[#f8f9fc] transition-colors" style={{ borderBottom: "1px solid #f0f2f5" }}>
                      <td className="px-4 py-3">
                        <button onClick={() => viewCampaign(c)} className="text-sm font-semibold text-[#0D1B2A] hover:text-[#1ABC9C] transition-colors text-left">
                          {c.name}
                        </button>
                        <p className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString()}</p>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-[#64748b]">{c.total_contacts}</td>
                      <td className="px-4 py-3 text-center text-sm text-[#64748b]">{c.sent_count}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-semibold text-[#8B5CF6]">{c.clicked_count}</span>
                        {c.sent_count > 0 && (
                          <span className="text-xs text-gray-400 ml-1">({Math.round(c.clicked_count / c.sent_count * 100)}%)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                          c.status === "sent" ? "bg-emerald-100 text-emerald-700" :
                          c.status === "sending" ? "bg-blue-100 text-blue-700" :
                          c.status === "completed" ? "bg-amber-100 text-amber-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {c.status === "sent" ? <CheckCircle className="w-3 h-3" /> :
                           c.status === "sending" ? <Clock className="w-3 h-3" /> :
                           c.status === "completed" ? <AlertTriangle className="w-3 h-3" /> :
                           <Clock className="w-3 h-3" />}
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => viewCampaign(c)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#1ABC9C] bg-[#1ABC9C]/10 hover:bg-[#1ABC9C]/20 transition-colors">
                            Edit
                          </button>
                          <button onClick={() => { setSelectedCampaign(c); handleSend(c.id); }} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#1ABC9C] hover:bg-[#16A085] transition-colors">
                            Send
                          </button>
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

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div className={`px-5 py-3 rounded-xl shadow-lg text-sm font-semibold text-white flex items-center gap-2 ${toast.type === "success" ? "bg-emerald-600" : "bg-red-500"}`}>
            {toast.type === "success" ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {toast.message}
          </div>
        </div>
      )}

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[#0D1B2A] mb-4">Create Email Campaign</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#64748b] mb-1">Campaign Name</label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g. Airion Episode 2 Launch"
                  className="w-full h-11 px-4 rounded-lg border border-[#d9e2ec] text-sm outline-none focus:border-[#1ABC9C] focus:ring-1 focus:ring-[#1ABC9C]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#64748b] mb-1">CSV File</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-[#64748b] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#1ABC9C]/10 file:text-[#1ABC9C] hover:file:bg-[#1ABC9C]/20"
                />
                <p className="text-xs text-gray-400 mt-1">CSV must have columns: name, email, phone, code</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 rounded-lg border border-[#e8edf2] text-[#64748b] font-semibold hover:bg-[#f8f9fc] transition-colors text-sm">
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!csvFile || !campaignName.trim() || uploading}
                className="px-4 py-2 rounded-lg text-white text-sm font-bold transition-colors disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #1ABC9C, #16A085)" }}
              >
                {uploading ? "Uploading..." : "Create Campaign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Detail Modal */}
      {selectedCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedCampaign(null)}>
          <div className="bg-white rounded-xl p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-[#0D1B2A]">{selectedCampaign.name}</h2>
                <p className="text-xs text-gray-400">{selectedCampaign.total_contacts} contacts · {selectedCampaign.sent_count} sent · {selectedCampaign.clicked_count} clicked</p>
              </div>
              <button onClick={() => setSelectedCampaign(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-[#64748b]" />
              </button>
            </div>

            <div className="flex items-center justify-between mb-4 p-4 rounded-lg bg-gray-50 border border-[#e8edf2]">
              <button onClick={() => setShowAddGuest(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-[#1ABC9C] bg-[#1ABC9C]/10 hover:bg-[#1ABC9C]/20 transition-colors">
                <UserPlus className="w-4 h-4" />
                Add Guest Manually
              </button>
              <div className="flex items-center gap-3">
                <input type="number" value={sendingCount} onChange={(e) => setSendingCount(parseInt(e.target.value) || 1000)} className="w-20 h-10 px-3 rounded-lg border border-[#d9e2ec] text-sm outline-none focus:border-[#1ABC9C]" min={1} max={selectedCampaign.total_contacts} />
                <span className="text-sm text-[#64748b]">of {selectedCampaign.total_contacts}</span>
                <button onClick={() => handleSend(selectedCampaign.id)} disabled={sendingCampaign} className="px-4 py-2 rounded-lg text-white text-sm font-bold transition-colors disabled:opacity-50" style={{ background: "linear-gradient(135deg, #1ABC9C, #16A085)" }}>
                  {sendingCampaign ? "Sending..." : "Send Campaign"}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: "#f8f9fc", borderBottom: "1px solid #e8edf2" }}>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#64748b] uppercase tracking-wider">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-[#64748b] uppercase tracking-wider">Email</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-[#64748b] uppercase tracking-wider">Sent</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-[#64748b] uppercase tracking-wider">Clicked</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-[#64748b] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">No recipients yet. Add guests manually or upload a CSV.</td></tr>
                  ) : paginatedRecipients.map((r) => (
                    <tr key={r.id} className="hover:bg-[#f8f9fc] transition-colors" style={{ borderBottom: "1px solid #f0f2f5" }}>
                      <td className="px-4 py-2">
                        <span className="text-sm font-semibold text-[#0D1B2A]">{r.name}</span>
                        {r.error && <p className="text-xs text-red-500">{r.error}</p>}
                      </td>
                      <td className="px-4 py-2 text-sm text-[#64748b]">{r.email}</td>
                      <td className="px-4 py-2 text-center">
                        {r.sent ? <CheckCircle className="w-4 h-4 text-emerald-500 inline" /> : <Clock className="w-4 h-4 text-gray-300 inline" />}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {r.clicked ? <CheckCircle className="w-4 h-4 text-purple-500 inline" /> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => { setEditingRecipient(r); setEditName(r.name); setEditEmail(r.email); setEditPhone(""); }} className="p-1.5 rounded-lg text-[#64748b] hover:text-[#1ABC9C] hover:bg-[#1ABC9C]/10 transition-colors" title="Edit">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleSendSingle(selectedCampaign.id, r.id)} disabled={sendingSingle === r.id} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors" title="Send email">
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#e8edf2]">
                <span className="text-xs text-gray-400">{recipients.length} total recipients</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setRecipientPage(p => Math.max(1, p - 1))} disabled={recipientPage === 1} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#64748b] border border-[#e8edf2] disabled:opacity-30 hover:bg-[#f8f9fc] transition-colors">
                    Prev
                  </button>
                  <span className="text-xs text-[#64748b] font-semibold">{recipientPage} / {totalPages}</span>
                  <button onClick={() => setRecipientPage(p => Math.min(totalPages, p + 1))} disabled={recipientPage === totalPages} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#64748b] border border-[#e8edf2] disabled:opacity-30 hover:bg-[#f8f9fc] transition-colors">
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}