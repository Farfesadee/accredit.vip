"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/contexts/auth-context";
import { ChevronLeft, Search, CheckCircle2, XCircle, Eye, Trash2, Menu, X, BarChart3, Calendar, Users, Settings, Loader, Clock, AlertTriangle, CreditCard, DollarSign, Database } from "lucide-react";
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

export default function AdminEventsPage() {
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
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [rejectModal, setRejectModal] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const itemsPerPage = 10;

  // Event Controls panel state
  const CAP_PRESETS = ["100", "200", "500", "1000", "2000", "Unlimited"];
  const [ctrlQuery, setCtrlQuery] = useState("");
  const [ctrlResults, setCtrlResults] = useState<any[]>([]);
  const [ctrlEvent, setCtrlEvent] = useState<any | null>(null);
  const [capInput, setCapInput] = useState("");
  const [regOpen, setRegOpen] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [statusSel, setStatusSel] = useState("draft");
  const [ctrlMsg, setCtrlMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [ctrlBusy, setCtrlBusy] = useState(false);

  // Extended controls
  const [rsvpOpen, setRsvpOpen] = useState(true);
  const [closeAtInput, setCloseAtInput] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [availInput, setAvailInput] = useState("");
  const [spotlightOn, setSpotlightOn] = useState(false);
  const [inviteSubj, setInviteSubj] = useState("");
  const [inviteBody, setInviteBody] = useState("");
  const [fTitle, setFTitle] = useState("");
  const [fVenue, setFVenue] = useState("");
  const [fCity, setFCity] = useState("");
  const [fDate, setFDate] = useState("");
  const [fTime, setFTime] = useState("");
  const [fDesc, setFDesc] = useState("");

  // Guest manager state
  const [guestQuery, setGuestQuery] = useState("");
  const [guestList, setGuestList] = useState<any[]>([]);
  const [guestCats, setGuestCats] = useState<{ name: string; count: number }[]>([]);
  const [editingGuest, setEditingGuest] = useState<any | null>(null);
  const [gName, setGName] = useState("");
  const [gPhone, setGPhone] = useState("");
  const [gEmail, setGEmail] = useState("");
  const [gCat, setGCat] = useState("");
  const [gOrg, setGOrg] = useState("");
  const [gNotes, setGNotes] = useState("");
  const [gRsvp, setGRsvp] = useState("pending");
  const [guestMsg, setGuestMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Announcements state
  const [annList, setAnnList] = useState<any[]>([]);
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");

  useEffect(() => {
    if (!ctrlQuery.trim() || ctrlEvent) return;
    const q = ctrlQuery;
    const t = setTimeout(() => { searchCtrlEvents(q, true); }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctrlQuery]);

  const searchCtrlEvents = async (q?: string, quiet?: boolean) => {
    const query = (q ?? ctrlQuery).trim();
    if (!query) { setCtrlResults([]); return; }
    setCtrlBusy(true);
    if (!quiet) setCtrlMsg(null);
    setCtrlEvent(null);
    try {
      const res = await apiClient<{ events: any[] }>(`/admin/events/search?q=${encodeURIComponent(query)}`);
      setCtrlResults(res.events || []);
      if (!quiet && !(res.events || []).length) setCtrlMsg({ ok: false, text: "No events found" });
    } catch (err: any) {
      if (!quiet) setCtrlMsg({ ok: false, text: err.message || "Search failed" });
    }
    setCtrlBusy(false);
  };

  const selectCtrlEvent = (e: any) => {
    setCtrlEvent(e);
    setCtrlResults([]);
    setCapInput(e.guest_count_range || "");
    setRegOpen(e.registration_open !== false);
    setRsvpOpen(e.rsvp_open !== false);
    setCloseAtInput(e.registration_close_at ? String(e.registration_close_at).slice(0, 16) : "");
    setPriceInput(e.ticket_price === null || e.ticket_price === undefined ? "" : String(e.ticket_price));
    setAvailInput(e.tickets_available === null || e.tickets_available === undefined ? "" : String(e.tickets_available));
    setSpotlightOn(!!e.spotlight);
    setInviteSubj(e.invite_subject || "");
    setInviteBody(e.invite_body || "");
    setFTitle(e.title || "");
    setFVenue(e.venue || "");
    setFCity(e.city || "");
    setFDate(e.event_date ? String(e.event_date).slice(0, 10) : "");
    setFTime(e.event_time ? String(e.event_time).slice(0, 5) : "");
    setFDesc(e.description || "");
    setIsPublic(!!e.is_public);
    setStatusSel(e.status || "draft");
    setCtrlMsg(null);
    resetGuestForm();
    searchGuests(e.id, "");
  };

  const saveCtrlEvent = async () => {
    if (!ctrlEvent) return;
    setCtrlBusy(true);
    setCtrlMsg(null);
    try {
      const body: any = {
        guest_count_range: capInput.trim() || undefined,
        registration_open: regOpen,
        rsvp_open: rsvpOpen,
        is_public: isPublic,
        status: statusSel,
        spotlight: spotlightOn,
      };
      body.registration_close_at = closeAtInput ? new Date(closeAtInput).toISOString() : "";
      if (fTitle.trim()) body.title = fTitle.trim();
      if (fVenue.trim()) body.venue = fVenue.trim();
      body.city = fCity.trim();
      if (fDate.trim()) body.event_date = fDate.trim();
      if (fTime.trim()) body.event_time = fTime.trim();
      if (fDesc !== (ctrlEvent.description || "")) body.description = fDesc;
      if (priceInput.trim() !== "") {
        const v = parseInt(priceInput, 10);
        if (isNaN(v)) throw new Error("Ticket price must be a number");
        body.ticket_price = v;
      }
      if (availInput.trim() !== "") {
        const v = parseInt(availInput, 10);
        if (isNaN(v)) throw new Error("Tickets available must be a number");
        body.tickets_available = v;
      }
      const res = await apiClient<{ event: any; changes: string[] }>(`/admin/events/${ctrlEvent.id}/controls`, {
        method: "PATCH",
        body,
      });
      setCtrlEvent(res.event);
      setCtrlMsg({ ok: true, text: `Saved: ${(res.changes || []).join("; ")}` });
      fetchEvents();
    } catch (err: any) {
      setCtrlMsg({ ok: false, text: err.message || "Save failed" });
    }
    setCtrlBusy(false);
  };

  const saveInviteMessage = async () => {
    if (!ctrlEvent) return;
    setCtrlBusy(true);
    setCtrlMsg(null);
    try {
      await apiClient(`/admin/events/${ctrlEvent.id}/invite-message`, {
        method: "PUT",
        body: { invite_subject: inviteSubj, invite_body: inviteBody },
      });
      setCtrlMsg({ ok: true, text: "Invite message saved" });
    } catch (err: any) {
      setCtrlMsg({ ok: false, text: err.message || "Save failed" });
    }
    setCtrlBusy(false);
  };

  const downloadReport = async () => {
    if (!ctrlEvent) return;
    setCtrlMsg(null);
    try {
      const res = await fetch(`/api/v1/admin/events/${ctrlEvent.id}/report-download`, { credentials: "include" });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `event-${ctrlEvent.id}-report.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setCtrlMsg({ ok: true, text: "Report downloaded" });
    } catch (err: any) {
      setCtrlMsg({ ok: false, text: err.message || "Download failed" });
    }
  };

  const markPaidPublish = async () => {    if (!ctrlEvent) return;
    if (!confirm(`Mark pending payments as paid and publish "${ctrlEvent.title}"? Use this when the organizer already paid offline.`)) return;
    setCtrlBusy(true);
    setCtrlMsg(null);
    try {
      const res = await apiClient<{ completed_payments: number; status: string; is_public: boolean }>(
        `/admin/events/${ctrlEvent.id}/mark-paid-publish`, { method: "POST", body: { make_public: true } }
      );
      setCtrlMsg({ ok: true, text: `Completed ${res.completed_payments} payment(s). Event is ${res.status}, public: ${res.is_public}` });
      fetchEvents();
    } catch (err: any) {
      setCtrlMsg({ ok: false, text: err.message || "Action failed" });
    }
    setCtrlBusy(false);
  };

  const impersonateOrganizer = async () => {    if (!ctrlEvent?.organizer_id) return;
    if (!confirm(`Open the organizer dashboard for "${ctrlEvent.title}"? You will be logged out as admin and must log back in afterwards.`)) return;
    try {
      await apiClient(`/admin/users/${ctrlEvent.organizer_id}/impersonate`, { method: "POST" });
      window.location.href = "/dashboard";
    } catch (err: any) {
      setCtrlMsg({ ok: false, text: err.message || "Impersonation failed" });
    }
  };

  // ---- Guest manager ----
  const resetGuestForm = () => {
    setEditingGuest(null);
    setGName(""); setGPhone(""); setGEmail(""); setGCat(""); setGOrg(""); setGNotes(""); setGRsvp("pending");
  };

  const searchGuests = async (eventId: number, q: string) => {
    try {
      const res = await apiClient<{ guests: any[]; categories: { name: string; count: number }[] }>(
        `/admin/events/${eventId}/guests?search=${encodeURIComponent(q)}&limit=50`
      );
      setGuestList(res.guests || []);
      setGuestCats(res.categories || []);
    } catch {
      setGuestList([]);
    }
  };

  const editGuestLoad = (g: any) => {
    setEditingGuest(g);
    setGName(g.name || ""); setGPhone(g.phone || ""); setGEmail(g.email || "");
    setGCat(g.category || ""); setGOrg(g.custom_data?.organization || "");
    setGNotes(g.notes || ""); setGRsvp(g.rsvp_status || "pending");
    setGuestMsg(null);
  };

  const saveGuest = async () => {
    if (!ctrlEvent || !gName.trim()) { setGuestMsg({ ok: false, text: "Name is required" }); return; }
    setGuestMsg(null);
    try {
      if (editingGuest) {
        const res = await apiClient<{ guest: any }>(`/admin/events/${ctrlEvent.id}/guests/${editingGuest.id}`, {
          method: "PUT",
          body: { name: gName, phone: gPhone, email: gEmail, category: gCat, organization: gOrg, notes: gNotes, rsvp_status: gRsvp },
        });
        setGuestMsg({ ok: true, text: `Updated ${res.guest.name}` });
      } else {
        const res = await apiClient<{ guest: any }>(`/admin/events/${ctrlEvent.id}/guests`, {
          method: "POST",
          body: { name: gName, phone: gPhone, email: gEmail, category: gCat, organization: gOrg, notes: gNotes, rsvp_status: gRsvp },
        });
        setGuestMsg({ ok: true, text: `Added ${res.guest.name}` });
      }
      resetGuestForm();
      searchGuests(ctrlEvent.id, guestQuery);
    } catch (err: any) {
      setGuestMsg({ ok: false, text: err.message || "Save failed" });
    }
  };

  const deleteGuest = async (id: number, name: string) => {
    if (!ctrlEvent || !confirm(`Remove ${name} from this event?`)) return;
    try {
      await apiClient(`/admin/events/${ctrlEvent.id}/guests/${id}`, { method: "DELETE" });
      setGuestMsg({ ok: true, text: `Removed ${name}` });
      if (editingGuest?.id === id) resetGuestForm();
      searchGuests(ctrlEvent.id, guestQuery);
    } catch (err: any) {
      setGuestMsg({ ok: false, text: err.message || "Delete failed" });
    }
  };

  // ---- Announcements ----
  const loadAnns = async () => {
    try {
      const res = await apiClient<{ announcements: any[] }>(`/admin/announcements`);
      setAnnList(res.announcements || []);
    } catch { setAnnList([]); }
  };

  const saveAnn = async () => {
    if (!annTitle.trim() || !annBody.trim()) return;
    try {
      await apiClient(`/admin/announcements`, { method: "POST", body: { title: annTitle, body: annBody, active: true } });
      setAnnTitle(""); setAnnBody("");
      loadAnns();
    } catch {}
  };

  const toggleAnn = async (a: any) => {
    try {
      await apiClient(`/admin/announcements/${a.id}`, { method: "PATCH", body: { active: !a.active } });
      loadAnns();
    } catch {}
  };

  const deleteAnn = async (id: number) => {
    if (!confirm("Delete this announcement?")) return;
    try {
      await apiClient(`/admin/announcements/${id}`, { method: "DELETE" });
      loadAnns();
    } catch {}
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      let data: any;
      if (filterStatus === "all") {
        data = await apiClient<any>("/admin/events?per_page=50");
      } else if (filterStatus === "pending") {
        data = await apiClient<any>("/admin/events/pending?limit=50");
      } else if (filterStatus === "flagged") {
        data = await apiClient<any>("/admin/events/flagged?limit=50");
      } else if (filterStatus === "approved") {
        data = await apiClient<any>("/admin/events?per_page=50");
      }
      setEvents(data?.events || []);
    } catch {
      setEvents([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, [filterStatus]);

  const handleAction = async (eventId: number, action: "approve" | "reject" | "delete") => {
    try {
      if (action === "delete") {
        await apiClient(`/admin/events/${eventId}`, { method: "DELETE" });
      } else if (action === "reject") {
        setRejectModal(eventId);
        return;
      } else {
        await apiClient(`/admin/events/${eventId}/${action}`, { method: "POST" });
      }
      fetchEvents();
    } catch {}
  };

  const confirmReject = async () => {
    if (!rejectModal) return;
    try {
      await apiClient(`/admin/events/${rejectModal}/reject`, {
        method: "POST",
        body: { reason: rejectReason || "No reason provided" },
      });
      setRejectModal(null);
      setRejectReason("");
      fetchEvents();
    } catch {}
  };

  if (authLoading || !user) return <div className="min-h-screen flex items-center justify-center bg-[#f8f9fc]"><Loader className="w-8 h-8 animate-spin text-[#1ABC9C]" /></div>;

  const totalPages = Math.ceil(events.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = events.slice(startIndex, startIndex + itemsPerPage);

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
              <h1 className="text-2xl font-black text-[#0D1B2A]">Event Moderation</h1>
            </div>
            <NotificationBell admin />
          </div>
        </header>

        <main className="p-4 sm:p-6">
          <div className="bg-white rounded-2xl border border-[#e8edf2] p-4 sm:p-6 mb-6">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94a3b8]" />
                <input type="text" placeholder="Search events..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-[#e8edf2] focus:outline-none focus:border-[#1ABC9C] text-[#0D1B2A]" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {["All", "Pending", "Approved", "Flagged"].map((label) => (
                  <button key={label} onClick={() => setFilterStatus(label.toLowerCase())} className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${filterStatus === label.toLowerCase() ? "bg-[#1ABC9C] text-white" : "bg-[#f0f1f7] text-[#64748b] hover:bg-[#e8edf2]"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {events.length > 0 && (
              <div className="border-t border-[#e8edf2] pt-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <p className="text-sm text-[#64748b]">Showing page <input type="text" inputMode="numeric" value={pageInput} onChange={(e) => setPageInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { const maxPages = Math.ceil(events.length / itemsPerPage); const num = parseInt(e.currentTarget.value); if (!e.currentTarget.value || isNaN(num) || num < 1) { setCurrentPage(1); setPageInput("1"); } else if (num > maxPages) { setCurrentPage(maxPages); setPageInput(String(maxPages)); } else { setCurrentPage(num); setPageInput(String(num)); } e.currentTarget.blur(); } }} onBlur={(e) => { const maxPages = Math.ceil(events.length / itemsPerPage); const num = parseInt(e.target.value); if (!e.target.value || isNaN(num) || num < 1) { setCurrentPage(1); setPageInput("1"); } else if (num > maxPages) { setCurrentPage(maxPages); setPageInput(String(maxPages)); } else { setCurrentPage(num); setPageInput(String(num)); } }} className="w-12 px-2 py-1 rounded-lg border-2 border-[#1ABC9C] text-center font-bold text-[#0D1B2A] focus:outline-none focus:border-[#1ABC9C] bg-[#1ABC9C]/5" /> of {Math.ceil(events.length / itemsPerPage)}</p>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 rounded-lg bg-[#1ABC9C] text-white font-bold text-sm hover:bg-[#16A085] disabled:opacity-40 disabled:cursor-not-allowed transition-all">← Previous</button>
                  <button onClick={() => setCurrentPage(p => Math.min(Math.ceil(events.length / itemsPerPage), p + 1))} disabled={currentPage === Math.ceil(events.length / itemsPerPage)} className="px-4 py-2 rounded-lg bg-[#1ABC9C] text-white font-bold text-sm hover:bg-[#16A085] disabled:opacity-40 disabled:cursor-not-allowed transition-all">Next →</button>
                </div>
              </div>
            )}
          </div>

          {/* Event Controls: caps, registration, visibility, status */}
          <div className="bg-white rounded-2xl border border-[#e8edf2] p-6 mb-6">
            <h2 className="text-base font-black text-[#0D1B2A] mb-1">Event Controls</h2>
            <p className="text-xs text-[#94a3b8] mb-4">Find any event by ID or title, then override its guest cap, registration link, visibility, or status.</p>
            <div className="relative">
              <div className="flex gap-2 mb-1">
                <input
                  type="text"
                  placeholder="Type event ID or title (e.g. 67) — suggestions appear as you type"
                  value={ctrlQuery}
                  onChange={(e) => { setCtrlQuery(e.target.value); setCtrlEvent(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") searchCtrlEvents(); }}
                  className="flex-1 px-4 py-2.5 rounded-xl border-2 border-[#e8edf2] focus:outline-none focus:border-[#1ABC9C] text-[#0D1B2A] text-sm"
                />
                <button onClick={() => searchCtrlEvents()} disabled={ctrlBusy} className="px-5 py-2.5 rounded-xl bg-[#0D1B2A] text-white font-bold text-sm hover:bg-[#1ABC9C] transition-all disabled:opacity-50">
                  Find
                </button>
              </div>
              {ctrlResults.length > 0 && !ctrlEvent && (
                <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white rounded-xl border-2 border-[#e8edf2] shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                  {ctrlResults.map((e: any) => (
                    <button key={e.id} onClick={() => selectCtrlEvent(e)} className="w-full text-left px-4 py-2.5 hover:bg-[#f0fdf9] border-b border-[#f1f5f9] last:border-0 transition-all">
                      <span className="text-sm font-bold text-[#0D1B2A]">#{e.id} {e.title}</span>
                      <span className="block text-xs text-[#94a3b8]">{e.event_date} · cap {e.guest_count_range} · registration {e.registration_open ? "open" : "closed"} · {e.is_public ? "public" : "private"} · {e.status}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {ctrlEvent && (
              <div className="rounded-xl border-2 border-[#1ABC9C]/30 bg-[#f8fffe] p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-black text-[#0D1B2A]">#{ctrlEvent.id} {ctrlEvent.title}</p>
                  <div className="flex gap-2">
                    <button onClick={impersonateOrganizer} title="Open this organizer's dashboard as them (logged, support only)" className="text-xs font-bold text-[#1ABC9C] hover:underline">Open organizer dashboard</button>
                    <button onClick={() => { setCtrlEvent(null); setCtrlMsg(null); }} className="text-xs font-bold text-[#94a3b8] hover:text-[#0D1B2A]">Change event</button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-[#64748b] mb-1.5">Guest cap</label>
                    <div className="flex gap-2">
                      <select value={CAP_PRESETS.includes(capInput) ? capInput : "custom"} onChange={(e) => { if (e.target.value !== "custom") setCapInput(e.target.value); else setCapInput(""); }} className="px-3 py-2.5 rounded-xl border-2 border-[#e8edf2] text-sm bg-white focus:outline-none focus:border-[#1ABC9C]">
                        {CAP_PRESETS.map((c) => <option key={c} value={c}>{c}</option>)}
                        <option value="custom">Custom…</option>
                      </select>
                      <input value={capInput} onChange={(e) => setCapInput(e.target.value)} placeholder="e.g. 500 or Unlimited" className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border-2 border-[#e8edf2] text-sm focus:outline-none focus:border-[#1ABC9C]" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#64748b] mb-1.5">Status</label>
                    <select value={statusSel} onChange={(e) => setStatusSel(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border-2 border-[#e8edf2] text-sm bg-white focus:outline-none focus:border-[#1ABC9C]">
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <button onClick={() => setRegOpen(!regOpen)} className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${regOpen ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                    Registration: {regOpen ? "OPEN" : "CLOSED"}
                  </button>
                  <button onClick={() => setRsvpOpen(!rsvpOpen)} className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${rsvpOpen ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                    RSVP links: {rsvpOpen ? "ACTIVE" : "PAUSED"}
                  </button>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#64748b] mb-1.5">Auto-close registration at (empty = no schedule{ctrlEvent.registration_close_at ? ` — currently ${String(ctrlEvent.registration_close_at).slice(0, 16).replace("T", " ")}` : ""})</label>
                    <div className="flex gap-2">
                      <input type="datetime-local" value={closeAtInput} onChange={(e) => setCloseAtInput(e.target.value)} className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border-2 border-[#e8edf2] text-sm focus:outline-none focus:border-[#1ABC9C]" />
                      <button onClick={() => setCloseAtInput("")} className="px-3 py-2.5 rounded-xl border-2 border-[#e8edf2] text-xs font-bold text-[#64748b] hover:border-red-300 hover:text-red-600">Clear</button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#64748b] mb-1.5">Ticket price</label>
                    <input type="number" min="0" value={priceInput} onChange={(e) => setPriceInput(e.target.value)} placeholder="e.g. 2000" className="w-full px-3 py-2.5 rounded-xl border-2 border-[#e8edf2] text-sm focus:outline-none focus:border-[#1ABC9C]" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#64748b] mb-1.5">Tickets available</label>
                    <input type="number" min="0" value={availInput} onChange={(e) => setAvailInput(e.target.value)} placeholder="e.g. 500" className="w-full px-3 py-2.5 rounded-xl border-2 border-[#e8edf2] text-sm focus:outline-none focus:border-[#1ABC9C]" />
                  </div>
                  <button onClick={() => setIsPublic(!isPublic)} className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${isPublic ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                    Visibility: {isPublic ? "PUBLIC" : "PRIVATE"}
                  </button>
                  <button onClick={() => setSpotlightOn(!spotlightOn)} className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${spotlightOn ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-600"}`}>
                    Spotlight: {spotlightOn ? "FEATURED" : "OFF"}
                  </button>
                  <div className="sm:col-span-2 grid gap-2 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-bold text-[#64748b] mb-1.5">Title</label>
                      <input value={fTitle} onChange={(e) => setFTitle(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border-2 border-[#e8edf2] text-sm focus:outline-none focus:border-[#1ABC9C]" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#64748b] mb-1.5">Venue</label>
                      <input value={fVenue} onChange={(e) => setFVenue(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border-2 border-[#e8edf2] text-sm focus:outline-none focus:border-[#1ABC9C]" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#64748b] mb-1.5">City</label>
                      <input value={fCity} onChange={(e) => setFCity(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border-2 border-[#e8edf2] text-sm focus:outline-none focus:border-[#1ABC9C]" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#64748b] mb-1.5">Date</label>
                      <input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border-2 border-[#e8edf2] text-sm focus:outline-none focus:border-[#1ABC9C]" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#64748b] mb-1.5">Time</label>
                      <input type="time" value={fTime} onChange={(e) => setFTime(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border-2 border-[#e8edf2] text-sm focus:outline-none focus:border-[#1ABC9C]" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#64748b] mb-1.5">Description</label>
                      <input value={fDesc} onChange={(e) => setFDesc(e.target.value)} placeholder="Short blurb" className="w-full px-3 py-2.5 rounded-xl border-2 border-[#e8edf2] text-sm focus:outline-none focus:border-[#1ABC9C]" />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#64748b] mb-1.5">Invite subject (what guests see)</label>
                    <input value={inviteSubj} onChange={(e) => setInviteSubj(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border-2 border-[#e8edf2] text-sm focus:outline-none focus:border-[#1ABC9C]" />
                    <label className="block text-xs font-bold text-[#64748b] mb-1.5 mt-2">Invite body</label>
                    <textarea value={inviteBody} onChange={(e) => setInviteBody(e.target.value)} rows={2} className="w-full px-3 py-2.5 rounded-xl border-2 border-[#e8edf2] text-sm focus:outline-none focus:border-[#1ABC9C] resize-none" />
                    <button onClick={saveInviteMessage} disabled={ctrlBusy} className="mt-2 px-4 py-2 rounded-xl border-2 border-[#1ABC9C] text-[#1ABC9C] text-xs font-bold hover:bg-[#1ABC9C] hover:text-white transition-all disabled:opacity-50">
                      Save invite message
                    </button>
                  </div>
                </div>
                {ctrlMsg && <p className={`text-xs font-semibold mt-3 ${ctrlMsg.ok ? "text-emerald-600" : "text-red-600"}`}>{ctrlMsg.text}</p>}
                <button onClick={saveCtrlEvent} disabled={ctrlBusy} className="mt-3 w-full py-3 rounded-xl bg-[#1ABC9C] text-white font-bold text-sm hover:bg-[#16A085] transition-all disabled:opacity-50">
                  {ctrlBusy ? "Saving..." : "Save changes"}
                </button>
                <button onClick={markPaidPublish} disabled={ctrlBusy} className="mt-2 w-full py-2.5 rounded-xl border-2 border-amber-300 text-amber-700 font-bold text-sm hover:bg-amber-50 transition-all disabled:opacity-50">
                  Mark offline payments as paid + publish
                </button>
                <button onClick={downloadReport} disabled={ctrlBusy} className="mt-2 w-full py-2.5 rounded-xl border-2 border-[#0D1B2A] text-[#0D1B2A] font-bold text-sm hover:bg-[#0D1B2A] hover:text-white transition-all disabled:opacity-50">
                  Download full report (Excel)
                </button>
              </div>
            )}
          </div>

          {/* Guest manager: add/edit/remove names on any dashboard */}
          {ctrlEvent && (
          <div className="bg-white rounded-2xl border border-[#e8edf2] p-6 mb-6">
            <h2 className="text-base font-black text-[#0D1B2A] mb-1">Guests on #{ctrlEvent.id} {ctrlEvent.title}</h2>
            <p className="text-xs text-[#94a3b8] mb-4">Add names, edit details and categories, or remove guests — changes apply to the organizer dashboard instantly.</p>
            {guestCats.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {guestCats.map((c) => (
                  <button key={c.name} onClick={() => setGCat(c.name)} title={`${c.count} guests`} className={`px-2.5 py-1 rounded-full text-xs font-bold border ${gCat === c.name ? "bg-[#1ABC9C] text-white border-[#1ABC9C]" : "bg-slate-50 text-slate-600 border-[#e8edf2] hover:border-[#1ABC9C]"}`}>
                    {c.name} ({c.count})
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2 mb-3">
              <input value={guestQuery} onChange={(e) => setGuestQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") searchGuests(ctrlEvent.id, guestQuery); }} placeholder="Search guests by name, email, phone..." className="flex-1 px-4 py-2.5 rounded-xl border-2 border-[#e8edf2] text-sm focus:outline-none focus:border-[#1ABC9C]" />
              <button onClick={() => searchGuests(ctrlEvent.id, guestQuery)} className="px-4 py-2.5 rounded-xl bg-[#0D1B2A] text-white text-sm font-bold hover:bg-[#1ABC9C]">Search</button>
            </div>
            {guestList.length > 0 && (
              <div className="max-h-64 overflow-y-auto border border-[#e8edf2] rounded-xl divide-y divide-[#f1f5f9] mb-4">
                {guestList.map((g: any) => (
                  <div key={g.id} className="flex items-center gap-2 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#0D1B2A] truncate">{g.name}</p>
                      <p className="text-xs text-[#94a3b8] truncate">{[g.email, g.phone, g.category].filter(Boolean).join(" · ")}</p>
                    </div>
                    <button onClick={() => editGuestLoad(g)} className="text-xs font-bold text-[#1ABC9C] hover:underline flex-shrink-0">Edit</button>
                    <button onClick={() => deleteGuest(g.id, g.name)} className="text-xs font-bold text-red-500 hover:underline flex-shrink-0">Remove</button>
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-xl bg-[#f8f9fc] border border-[#e8edf2] p-4">
              <p className="text-xs font-black uppercase tracking-wider text-[#64748b] mb-3">{editingGuest ? `Editing ${editingGuest.name}` : "Quick add guest"}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input value={gName} onChange={(e) => setGName(e.target.value)} placeholder="Full name *" className="px-3 py-2.5 rounded-xl border-2 border-[#e8edf2] text-sm focus:outline-none focus:border-[#1ABC9C]" />
                <input value={gPhone} onChange={(e) => setGPhone(e.target.value)} placeholder="Phone" className="px-3 py-2.5 rounded-xl border-2 border-[#e8edf2] text-sm focus:outline-none focus:border-[#1ABC9C]" />
                <input value={gEmail} onChange={(e) => setGEmail(e.target.value)} placeholder="Email" className="px-3 py-2.5 rounded-xl border-2 border-[#e8edf2] text-sm focus:outline-none focus:border-[#1ABC9C]" />
                <input value={gCat} onChange={(e) => setGCat(e.target.value)} placeholder="Category (e.g. General Access)" className="px-3 py-2.5 rounded-xl border-2 border-[#e8edf2] text-sm focus:outline-none focus:border-[#1ABC9C]" />
                <input value={gOrg} onChange={(e) => setGOrg(e.target.value)} placeholder="Organization" className="px-3 py-2.5 rounded-xl border-2 border-[#e8edf2] text-sm focus:outline-none focus:border-[#1ABC9C]" />
                <select value={gRsvp} onChange={(e) => setGRsvp(e.target.value)} className="px-3 py-2.5 rounded-xl border-2 border-[#e8edf2] text-sm bg-white focus:outline-none focus:border-[#1ABC9C]">
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="declined">Declined</option>
                  <option value="maybe">Maybe</option>
                </select>
              </div>
              <input value={gNotes} onChange={(e) => setGNotes(e.target.value)} placeholder="Notes (optional)" className="mt-2 w-full px-3 py-2.5 rounded-xl border-2 border-[#e8edf2] text-sm focus:outline-none focus:border-[#1ABC9C]" />
              {guestMsg && <p className={`text-xs font-semibold mt-2 ${guestMsg.ok ? "text-emerald-600" : "text-red-600"}`}>{guestMsg.text}</p>}
              <div className="flex gap-2 mt-3">
                <button onClick={saveGuest} className="flex-1 py-2.5 rounded-xl bg-[#1ABC9C] text-white text-sm font-bold hover:bg-[#16A085]">{editingGuest ? "Save changes" : "Add guest"}</button>
                {editingGuest && <button onClick={resetGuestForm} className="px-4 py-2.5 rounded-xl border-2 border-[#e8edf2] text-sm font-bold text-[#64748b]">Cancel</button>}
              </div>
            </div>
          </div>
          )}

          {/* Platform announcements */}
          <div className="bg-white rounded-2xl border border-[#e8edf2] p-6 mb-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-black text-[#0D1B2A]">Platform Announcements</h2>
              <button onClick={loadAnns} className="text-xs font-bold text-[#1ABC9C] hover:underline">Refresh</button>
            </div>
            <p className="text-xs text-[#94a3b8] mb-4">Shown as a banner inside every organizer dashboard until removed.</p>
            <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] mb-3">
              <input value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} placeholder="Title" className="px-3 py-2.5 rounded-xl border-2 border-[#e8edf2] text-sm focus:outline-none focus:border-[#1ABC9C]" />
              <input value={annBody} onChange={(e) => setAnnBody(e.target.value)} placeholder="Message..." className="px-3 py-2.5 rounded-xl border-2 border-[#e8edf2] text-sm focus:outline-none focus:border-[#1ABC9C]" />
              <button onClick={saveAnn} className="px-5 py-2.5 rounded-xl bg-[#0D1B2A] text-white text-sm font-bold hover:bg-[#1ABC9C]">Post</button>
            </div>
            <div className="space-y-2">
              {annList.map((a: any) => (
                <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#e8edf2]">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#0D1B2A] truncate">{a.title}</p>
                    <p className="text-xs text-[#64748b] truncate">{a.body}</p>
                  </div>
                  <button onClick={() => toggleAnn(a)} className={`text-xs font-bold px-3 py-1.5 rounded-lg ${a.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>{a.active ? "Live" : "Off"}</button>
                  <button onClick={() => deleteAnn(a.id)} className="text-xs font-bold text-red-500 hover:underline">Delete</button>
                </div>
              ))}
              {annList.length === 0 && <p className="text-xs text-[#94a3b8]">No announcements yet. Click Refresh to load.</p>}
            </div>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl border border-[#e8edf2] p-12 text-center">
              <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-[#94a3b8]">Loading events...</p>
            </div>
          ) : (
            <div className="space-y-4">
                {events
                  .sort((a, b) => new Date(b.created_at || b.event_date || 0).getTime() - new Date(a.created_at || a.event_date || 0).getTime())
                  .filter((e) => !searchQuery || e.title?.toLowerCase().includes(searchQuery.toLowerCase()) || e.host_name?.toLowerCase().includes(searchQuery.toLowerCase()))
                  .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                  .map((event) => {
                    const displayStatus = event.review_status || event.status || "unknown";
                    const statusColor = displayStatus === "pending_review" || displayStatus === "pending" ? "bg-amber-50 text-amber-600" : displayStatus === "approved" || displayStatus === "published" ? "bg-green-50 text-green-600" : displayStatus === "flagged" || displayStatus === "rejected" ? "bg-red-50 text-red-600" : "bg-gray-50 text-gray-600";
                    return (
                      <div key={event.id} className="bg-white rounded-2xl border border-[#e8edf2] hover:border-[#1ABC9C] p-4 sm:p-6 flex flex-col sm:flex-row sm:justify-between gap-3 sm:items-start">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-black text-[#0D1B2A]">{event.title}</h3>
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${statusColor}`}>
                              {displayStatus.replace("_", " ").toUpperCase()}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-sm text-[#64748b]">
                            <div><p className="text-xs text-[#94a3b8]">Organizer</p><p className="text-[#0D1B2A] font-medium">{event.host_name || event.organizer || event.organizer_email || "Unknown"}</p></div>
                            <div><p className="text-xs text-[#94a3b8]">Date</p><p className="text-[#0D1B2A] font-medium">{event.event_date || event.date || "N/A"}</p></div>
                            <div><p className="text-xs text-[#94a3b8]">Venue</p><p className="text-[#0D1B2A] font-medium">{event.venue || "N/A"}</p></div>
                            <div><p className="text-xs text-[#94a3b8]">Type</p><p className="text-[#0D1B2A] font-medium">{event.event_type || "N/A"}</p></div>
                          </div>
                        </div>
              <div className="flex gap-2 flex-wrap">
                          {(displayStatus === "pending_review" || displayStatus === "flagged") && (
                            <>
                              <button onClick={() => handleAction(event.id, "approve")} className="p-3 hover:bg-green-50 rounded-xl" title="Approve"><CheckCircle2 className="w-5 h-5 text-green-600" /></button>
                              <button onClick={() => handleAction(event.id, "reject")} className="p-3 hover:bg-red-50 rounded-xl" title="Reject"><XCircle className="w-5 h-5 text-red-600" /></button>
                            </>
                          )}
                          <button onClick={() => { if (confirm("Are you sure you want to delete this event? This action cannot be undone.")) handleAction(event.id, "delete"); }} className="p-3 hover:bg-red-50 rounded-xl" title="Delete"><Trash2 className="w-5 h-5 text-[#94a3b8]" /></button>
                        </div>
                      </div>
                    );
                  })}
              {events.length === 0 && (
                <div className="bg-white rounded-2xl border border-[#e8edf2] p-12 text-center">
                  <p className="text-[#94a3b8]">No events found</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setRejectModal(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#0D1B2A] mb-2">Reject Event</h3>
            <p className="text-sm text-[#64748b] mb-4">Provide a reason for rejection (optional):</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full h-24 rounded-xl border border-[#d9e2ec] p-3 text-sm outline-none focus:border-[#1ABC9C] resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => { setRejectModal(null); setRejectReason(""); }} className="flex-1 h-11 rounded-xl border border-[#d9e2ec] text-sm font-semibold text-[#64748b] hover:bg-[#f8fafc]">Cancel</button>
              <button onClick={confirmReject} className="flex-1 h-11 rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-700">Reject Event</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

