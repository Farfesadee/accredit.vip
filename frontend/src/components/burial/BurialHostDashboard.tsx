"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { ChevronLeft, Users, Send, QrCode, Trash2, Edit2, Loader, Check, Phone, Mail, X, Search, AlertTriangle, MessageSquare, CheckCircle, XCircle } from "lucide-react";

type Host = {
  name: string;
  total_guests: number;
  accepted: number;
  declined: number;
  pending: number;
};

type Guest = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  rsvp_status: string;
  qr_sent: boolean;
  delivery_status: string;
  delivery_confirmatory_whatsapp: string;
  delivery_confirmatory_email: string;
  delivery_qr_whatsapp: string;
  delivery_qr_email: string;
  message_counts?: Record<string, number>;
  created_at: string | null;
};

type BurialHostDashboardProps = {
  eventId: number;
};

export default function BurialHostDashboard({ eventId }: BurialHostDashboardProps) {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [selectedHost, setSelectedHost] = useState<string | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [guestsLoading, setGuestsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [selectedGuests, setSelectedGuests] = useState<Set<number>>(new Set());
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkSendingQr, setBulkSendingQr] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [themeColor, setThemeColor] = useState("#1A2554");

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Modals
  const [confirmModal, setConfirmModal] = useState<Guest | null>(null);
  const [qrModal, setQrModal] = useState<Guest | null>(null);
  const [editModal, setEditModal] = useState<Guest | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editingSubmit, setEditingSubmit] = useState(false);

  const fetchHosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient<{ event: { title: string; theme_color: string }; hosts: Host[] }>(`/events/${eventId}/hosts`);
      setHosts(data.hosts);
      setEventTitle(data.event.title);
      setThemeColor(data.event.theme_color || "#1A2554");
    } catch (err: any) {
      setError(err.detail || err.message || "Failed to load hosts");
    }
    setLoading(false);
  }, [eventId]);

  const fetchGuests = useCallback(async (hostName: string) => {
    setGuestsLoading(true);
    setError(null);
    try {
      const data = await apiClient<{ host: string; guests: Guest[] }>(`/events/${eventId}/hosts/${encodeURIComponent(hostName)}/guests`);
      setGuests(data.guests);
    } catch (err: any) {
      setError(err.detail || err.message || "Failed to load guests");
    }
    setGuestsLoading(false);
  }, [eventId]);

  useEffect(() => { fetchHosts(); }, [fetchHosts]);

  const selectHost = (hostName: string) => {
    setSelectedHost(hostName);
    setSelectedGuests(new Set());
    fetchGuests(hostName);
  };

  const goBack = () => {
    setSelectedHost(null);
    setGuests([]);
    setDeleteConfirm(null);
    setConfirmModal(null);
    setQrModal(null);
    setEditModal(null);
  };

  const doSendConfirmation = async (guestId: number) => {
    if (!selectedHost) return;
    setSending(guestId);
    try {
      await apiClient(`/events/${eventId}/hosts/${encodeURIComponent(selectedHost)}/guests/send-message`, {
        method: "POST",
        body: { guest_ids: [guestId], message_type: "confirmation", resend_anyway: true },
      });
      setConfirmModal(null);
      fetchGuests(selectedHost);
    } catch {}
    setSending(null);
  };

  const doSendQrCode = async (guestId: number) => {
    if (!selectedHost) return;
    setSending(guestId);
    try {
      await apiClient(`/events/${eventId}/hosts/${encodeURIComponent(selectedHost)}/guests/send-message`, {
        method: "POST",
        body: { guest_ids: [guestId], message_type: "qr_only", resend_anyway: true },
      });
      setQrModal(null);
      fetchGuests(selectedHost);
    } catch {}
    setSending(null);
  };

  const doEditGuest = async () => {
    if (!selectedHost || !editModal) return;
    setEditingSubmit(true);
    try {
      await apiClient(`/events/${eventId}/hosts/${encodeURIComponent(selectedHost)}/guests/${editModal.id}`, {
        method: "PUT",
        body: { name: editName, phone: editPhone, email: editEmail },
      });
      setEditModal(null);
      fetchGuests(selectedHost);
    } catch {}
    setEditingSubmit(false);
  };

  const deleteGuest = async (guestId: number) => {
    if (!selectedHost) return;
    setDeleting(guestId);
    try {
      await apiClient(`/events/${eventId}/hosts/${encodeURIComponent(selectedHost)}/guests/${guestId}`, {
        method: "DELETE",
      });
      setDeleteConfirm(null);
      fetchGuests(selectedHost);
    } catch {}
    setDeleting(null);
  };

  const bulkSendConfirmation = async () => {
    if (!selectedHost || selectedGuests.size === 0) return;
    setBulkSending(true);
    try {
      await apiClient(`/events/${eventId}/hosts/${encodeURIComponent(selectedHost)}/guests/send-message`, {
        method: "POST",
        body: { guest_ids: Array.from(selectedGuests), message_type: "confirmation", resend_anyway: true },
      });
      setSelectedGuests(new Set());
      fetchGuests(selectedHost);
    } catch {}
    setBulkSending(false);
  };

  const bulkSendQr = async () => {
    if (!selectedHost || selectedGuests.size === 0) return;
    setBulkSendingQr(true);
    try {
      await apiClient(`/events/${eventId}/hosts/${encodeURIComponent(selectedHost)}/guests/send-message`, {
        method: "POST",
        body: { guest_ids: Array.from(selectedGuests), message_type: "qr_only", resend_anyway: true },
      });
      setSelectedGuests(new Set());
      fetchGuests(selectedHost);
    } catch {}
    setBulkSendingQr(false);
  };

  const sendAllConfirmations = async () => {
    if (!selectedHost) return;
    const unsent = guests.filter(g =>
      g.delivery_confirmatory_whatsapp !== "delivered" &&
      g.delivery_confirmatory_whatsapp !== "read" &&
      g.delivery_confirmatory_email !== "delivered" &&
      g.delivery_confirmatory_email !== "read"
    );
    if (unsent.length === 0) {
      setToast({ message: "All guests have been sent confirmations", type: "success" });
      return;
    }
    const batch = unsent.slice(0, 5);
    setBulkSending(true);
    try {
      const data = await apiClient<{ message: string }>(`/events/${eventId}/hosts/${encodeURIComponent(selectedHost)}/guests/send-message`, {
        method: "POST",
        body: { guest_ids: batch.map(g => g.id), message_type: "confirmation", resend_anyway: true },
      });
      setToast({ message: data.message || `Confirmation sent to ${batch.length} guest(s)`, type: "success" });
      await fetchGuests(selectedHost);
    } catch (err: any) {
      setToast({ message: err.detail || err.message || "Failed to send confirmations", type: "error" });
    }
    setBulkSending(false);
  };

  const sendAllQr = async () => {
    if (!selectedHost) return;
    const unsent = guests.filter(g =>
      g.delivery_qr_whatsapp !== "delivered" &&
      g.delivery_qr_whatsapp !== "read" &&
      g.delivery_qr_email !== "delivered" &&
      g.delivery_qr_email !== "read"
    );
    if (unsent.length === 0) {
      setToast({ message: "All guests have been sent QR codes", type: "success" });
      return;
    }
    const batch = unsent.slice(0, 5);
    setBulkSendingQr(true);
    try {
      const data = await apiClient<{ message: string }>(`/events/${eventId}/hosts/${encodeURIComponent(selectedHost)}/guests/send-message`, {
        method: "POST",
        body: { guest_ids: batch.map(g => g.id), message_type: "qr_only", resend_anyway: true },
      });
      setToast({ message: data.message || `QR codes sent to ${batch.length} guest(s)`, type: "success" });
      await fetchGuests(selectedHost);
    } catch (err: any) {
      setToast({ message: err.detail || err.message || "Failed to send QR codes", type: "error" });
    }
    setBulkSendingQr(false);
  };

  const toggleAll = () => {
    const filtered = guests.filter(g => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return g.name.toLowerCase().includes(q) || (g.phone || "").includes(q) || (g.email || "").toLowerCase().includes(q);
    });
    if (selectedGuests.size === filtered.length) {
      setSelectedGuests(new Set());
    } else {
      setSelectedGuests(new Set(filtered.map(g => g.id)));
    }
  };

  const toggleGuest = (id: number) => {
    setSelectedGuests(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredGuests = guests.filter(g => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return g.name.toLowerCase().includes(q) || (g.phone || "").includes(q) || (g.email || "").toLowerCase().includes(q);
  });

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
      declined: "bg-red-50 text-red-700 border-red-200",
      pending: "bg-amber-50 text-amber-700 border-amber-200",
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colors[status] || "bg-slate-50 text-slate-600 border-slate-200"}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const confirmIcon = (status: string) => {
    const base = <MessageSquare className="w-3.5 h-3.5" />;
    switch (status) {
      case "read":
        return <span className="flex items-center gap-0.5 text-emerald-600">{base}<span className="text-[8px] font-medium">R</span></span>;
      case "delivered":
        return <span className="text-emerald-600">{base}</span>;
      case "sent":
        return <span className="text-blue-500">{base}</span>;
      case "failed":
        return <span className="text-red-600">{base}</span>;
      case "pending":
        return <Loader className="w-3.5 h-3.5 text-amber-500 animate-spin" />;
      default:
        return <span className="text-slate-300">{base}</span>;
    }
  };

  const qrIcon = (status: string) => {
    const base = <QrCode className="w-3.5 h-3.5" />;
    switch (status) {
      case "read":
        return <span className="flex items-center gap-0.5 text-emerald-600">{base}<span className="text-[8px] font-medium">R</span></span>;
      case "delivered":
        return <span className="text-emerald-600">{base}</span>;
      case "sent":
        return <span className="text-blue-500">{base}</span>;
      case "failed":
        return <span className="text-red-600">{base}</span>;
      case "pending":
        return <Loader className="w-3.5 h-3.5 text-amber-500 animate-spin" />;
      default:
        return <span className="text-slate-300">{base}</span>;
    }
  };

  // ── Modals ──

  const renderConfirmModal = () => {
    if (!confirmModal) return null;
    const g = confirmModal;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setConfirmModal(null)}>
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
          <h3 className="text-lg font-bold text-slate-900 mb-4">Send Confirmation</h3>
          <div className="space-y-3 mb-4">
            <div className="bg-slate-50 rounded-xl p-3 space-y-1">
              <p className="text-sm text-slate-500"><span className="font-medium text-slate-700">Name:</span> {g.name}</p>
              {g.phone && <p className="text-sm text-slate-500"><span className="font-medium text-slate-700">Phone:</span> {g.phone}</p>}
              {g.email && <p className="text-sm text-slate-500"><span className="font-medium text-slate-700">Email:</span> {g.email}</p>}
              <p className="text-sm text-slate-500"><span className="font-medium text-slate-700">Status:</span> {statusBadge(g.rsvp_status)}</p>
              <p className="text-sm text-slate-500"><span className="font-medium text-slate-700">Times sent:</span> {g.message_counts?.confirmation || 0}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-xs font-medium text-blue-800 mb-1">Message Preview — WhatsApp &amp; Email</p>
              <p className="text-xs text-blue-700 leading-relaxed">
                Dear {g.name},<br />
                Thank you for confirming your attendance...<br />
                Your QR code will be sent shortly before the event.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => setConfirmModal(null)} variant="outline" className="flex-1">Cancel</Button>
            <Button onClick={() => doSendConfirmation(g.id)} disabled={sending === g.id} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
              {sending === g.id ? <><Loader className="w-4 h-4 animate-spin mr-1" /> Sending...</> : "Send Confirmation"}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderQrModal = () => {
    if (!qrModal) return null;
    const g = qrModal;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setQrModal(null)}>
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
          <h3 className="text-lg font-bold text-slate-900 mb-4">Send QR Code</h3>
          <div className="space-y-3 mb-4">
            <div className="bg-slate-50 rounded-xl p-3 space-y-1">
              <p className="text-sm text-slate-500"><span className="font-medium text-slate-700">Name:</span> {g.name}</p>
              {g.phone && <p className="text-sm text-slate-500"><span className="font-medium text-slate-700">Phone:</span> {g.phone}</p>}
              {g.email && <p className="text-sm text-slate-500"><span className="font-medium text-slate-700">Email:</span> {g.email}</p>}
              <p className="text-sm text-slate-500"><span className="font-medium text-slate-700">Times sent:</span> {g.message_counts?.qr_only || 0}</p>
            </div>
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
              <p className="text-xs font-medium text-violet-800 mb-1">Message Preview — WhatsApp &amp; Email</p>
              <p className="text-xs text-violet-700 leading-relaxed">
                A QR code with the deceased's photo overlay will be sent to {g.name}.<br />
                The QR links to their unique check-in page.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => setQrModal(null)} variant="outline" className="flex-1">Cancel</Button>
            <Button onClick={() => doSendQrCode(g.id)} disabled={sending === g.id} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white">
              {sending === g.id ? <><Loader className="w-4 h-4 animate-spin mr-1" /> Sending...</> : "Send QR Code"}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderEditModal = () => {
    if (!editModal) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setEditModal(null)}>
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
          <h3 className="text-lg font-bold text-slate-900 mb-4">Edit Guest</h3>
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
              <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
              <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => setEditModal(null)} variant="outline" className="flex-1">Cancel</Button>
            <Button onClick={doEditGuest} disabled={editingSubmit} className="flex-1 bg-slate-800 hover:bg-slate-900 text-white">
              {editingSubmit ? <><Loader className="w-4 h-4 animate-spin mr-1" /> Saving...</> : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // ── Views ──

  const renderHostList = () => (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Hosts
        </h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {hosts.map((host, idx) => {
          const colors = ["bg-blue-50 text-blue-800 border-blue-200", "bg-rose-50 text-rose-800 border-rose-200", "bg-amber-50 text-amber-800 border-amber-200", "bg-green-50 text-green-800 border-green-200", "bg-purple-50 text-purple-800 border-purple-200", "bg-cyan-50 text-cyan-800 border-cyan-200"];
          const c = colors[idx % colors.length];
          return (
            <button
              key={host.name}
              onClick={() => selectHost(host.name)}
              className="text-left rounded-xl border border-slate-200 bg-white hover:shadow-md hover:border-slate-300 transition-all overflow-hidden"
            >
              <div className={`px-4 py-3 border-b ${c} font-semibold text-sm`}>{host.name}</div>
              <div className="p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-2xl font-bold text-slate-900">{host.total_guests}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Total</p>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3">
                    <p className="text-2xl font-bold text-emerald-600">{host.accepted}</p>
                    <p className="text-[10px] text-emerald-600 uppercase tracking-wide">Confirmed</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3">
                    <p className="text-2xl font-bold text-amber-600">{host.pending}</p>
                    <p className="text-[10px] text-amber-600 uppercase tracking-wide">Pending</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3">
                    <p className="text-2xl font-bold text-red-600">{host.declined}</p>
                    <p className="text-[10px] text-red-600 uppercase tracking-wide">Declined</p>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderGuestList = () => {
    const anySelected = selectedGuests.size > 0;

    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={goBack} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-slate-900">{selectedHost}</h2>
            <p className="text-xs text-slate-500">{guests.length} guest(s)</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={sendAllConfirmations} disabled={bulkSending} className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white">
              {bulkSending ? <Loader className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
              Confirm All (5)
            </Button>
            <Button size="sm" onClick={sendAllQr} disabled={bulkSendingQr} className="h-8 text-xs bg-violet-600 hover:bg-violet-700 text-white">
              {bulkSendingQr ? <Loader className="w-3 h-3 animate-spin mr-1" /> : <QrCode className="w-3 h-3 mr-1" />}
              QR All (5)
            </Button>
          </div>
        </div>

        {anySelected && (
          <div className="mb-4 p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2 flex-wrap">
            <span className="text-sm text-slate-600 font-medium">{selectedGuests.size} selected</span>
            <Button size="sm" variant="outline" onClick={bulkSendConfirmation} disabled={bulkSending} className="h-8 text-xs">
              {bulkSending ? <Loader className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
              Confirm
            </Button>
            <Button size="sm" variant="outline" onClick={bulkSendQr} disabled={bulkSendingQr} className="h-8 text-xs">
              {bulkSendingQr ? <Loader className="w-3 h-3 animate-spin mr-1" /> : <QrCode className="w-3 h-3 mr-1" />}
              Send QR
            </Button>
            <button onClick={() => setSelectedGuests(new Set())} className="text-xs text-slate-500 hover:text-slate-700 ml-auto">Clear</button>
          </div>
        )}

        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search guests..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {guestsLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : filteredGuests.length === 0 ? (
          <div className="bg-slate-50 rounded-lg border border-slate-200 border-dashed p-12 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-600">
              {searchQuery ? "No guests match your search" : "No guests yet for this host"}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="w-10 px-3 py-3">
                      <input type="checkbox" checked={selectedGuests.size === filteredGuests.length && filteredGuests.length > 0} onChange={toggleAll} className="rounded" />
                    </th>
                    <th className="text-left px-3 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Name</th>
                    <th className="text-left px-3 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Contact</th>
                    <th className="text-left px-3 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="text-center px-3 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Sent</th>
                    <th className="text-center px-3 py-3 text-xs font-medium text-blue-600 uppercase tracking-wide">Confirm</th>
                    <th className="text-center px-3 py-3 text-xs font-medium text-violet-600 uppercase tracking-wide">QR</th>
                    <th className="text-right px-3 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredGuests.map((guest) => (
                    <tr key={guest.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={selectedGuests.has(guest.id)} onChange={() => toggleGuest(guest.id)} className="rounded" />
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-sm font-medium text-slate-900">{guest.name}</p>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-0.5">
                          {guest.phone && <span className="text-xs text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" />{guest.phone}</span>}
                          {guest.email && <span className="text-xs text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3" />{guest.email}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3">{statusBadge(guest.rsvp_status)}</td>
                      <td className="px-3 py-3 text-center">
                        <div className="inline-flex items-center gap-1">
                          {Object.entries(guest.message_counts || {}).length > 0 ? Object.entries(guest.message_counts || {}).map(([t, c], i) => (
                            <span key={t} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                              <span className="text-slate-400">{t === "confirmation" ? "C" : t === "qr_only" ? "Q" : t}</span>
                              <span>{c}</span>
                            </span>
                          )) : <span className="text-xs text-slate-400">0</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => { setConfirmModal(guest); }}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 hover:scale-110 active:scale-95 transition-all cursor-pointer shadow-sm"
                          title={`WhatsApp: ${guest.delivery_confirmatory_whatsapp}, Email: ${guest.delivery_confirmatory_email}`}
                        >
                          {confirmIcon(guest.delivery_confirmatory_whatsapp === "delivered" || guest.delivery_confirmatory_whatsapp === "read" || guest.delivery_confirmatory_email === "delivered" || guest.delivery_confirmatory_email === "read" ? "delivered" : guest.delivery_confirmatory_whatsapp === "failed" && guest.delivery_confirmatory_email === "failed" ? "failed" : guest.delivery_confirmatory_whatsapp || guest.delivery_confirmatory_email || "")}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => { setQrModal(guest); }}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 hover:scale-110 active:scale-95 transition-all cursor-pointer shadow-sm"
                          title={`WhatsApp: ${guest.delivery_qr_whatsapp}, Email: ${guest.delivery_qr_email}`}
                        >
                          {qrIcon(guest.delivery_qr_whatsapp === "delivered" || guest.delivery_qr_whatsapp === "read" || guest.delivery_qr_email === "delivered" || guest.delivery_qr_email === "read" ? "delivered" : guest.delivery_qr_whatsapp === "failed" && guest.delivery_qr_email === "failed" ? "failed" : guest.delivery_qr_whatsapp || guest.delivery_qr_email || "")}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost"
                            onClick={() => { setEditModal(guest); setEditName(guest.name); setEditPhone(guest.phone || ""); setEditEmail(guest.email || ""); }}
                            title="Edit Guest" className="h-9 w-9 p-0 hover:bg-amber-50">
                            <Edit2 className="w-4 h-4 text-amber-600" />
                          </Button>
                          {deleteConfirm === guest.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => deleteGuest(guest.id)} disabled={deleting === guest.id} className="h-9 px-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                {deleting === guest.id ? <Loader className="w-4 h-4 animate-spin" /> : "Delete"}
                              </button>
                              <button onClick={() => setDeleteConfirm(null)} className="h-9 px-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                            </div>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(guest.id)} title="Delete" className="h-9 w-9 p-0 hover:bg-red-50">
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="sm:hidden space-y-3">
              {filteredGuests.map((guest) => (
                <div key={guest.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{guest.name}</p>
                      <div className="flex flex-col gap-0.5 mt-1">
                        {guest.phone && <span className="text-xs text-slate-500">{guest.phone}</span>}
                        {guest.email && <span className="text-xs text-slate-500">{guest.email}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={selectedGuests.has(guest.id)} onChange={() => toggleGuest(guest.id)} className="rounded" />
                      {statusBadge(guest.rsvp_status)}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 mb-2">
                    Sent: {Object.entries(guest.message_counts || {}).map(([t, c]) => `${t}:${c}`).join(", ") || "0"}
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">
                      {confirmIcon(guest.delivery_confirmatory_whatsapp === "delivered" || guest.delivery_confirmatory_whatsapp === "read" || guest.delivery_confirmatory_email === "delivered" || guest.delivery_confirmatory_email === "read" ? "delivered" : guest.delivery_confirmatory_whatsapp === "failed" && guest.delivery_confirmatory_email === "failed" ? "failed" : guest.delivery_confirmatory_whatsapp || guest.delivery_confirmatory_email || "")}
                      Confirm
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-violet-50 text-violet-700 text-xs font-medium">
                      {qrIcon(guest.delivery_qr_whatsapp === "delivered" || guest.delivery_qr_whatsapp === "read" || guest.delivery_qr_email === "delivered" || guest.delivery_qr_email === "read" ? "delivered" : guest.delivery_qr_whatsapp === "failed" && guest.delivery_qr_email === "failed" ? "failed" : guest.delivery_qr_whatsapp || guest.delivery_qr_email || "")}
                      QR
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                    <button onClick={() => { setConfirmModal(guest); }} disabled={sending === guest.id}
                      className="flex-1 flex items-center justify-center gap-1 h-9 rounded-lg bg-blue-100 text-blue-800 text-xs font-semibold hover:bg-blue-200 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer shadow-sm disabled:opacity-50">
                      <Send className="w-3.5 h-3.5" /> Confirm
                    </button>
                    <button onClick={() => { setQrModal(guest); }} disabled={sending === guest.id}
                      className="flex-1 flex items-center justify-center gap-1 h-9 rounded-lg bg-violet-100 text-violet-800 text-xs font-semibold hover:bg-violet-200 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer shadow-sm disabled:opacity-50">
                      <QrCode className="w-3.5 h-3.5" /> QR
                    </button>
                    <button onClick={() => { setEditModal(guest); setEditName(guest.name); setEditPhone(guest.phone || ""); setEditEmail(guest.email || ""); }}
                      className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-amber-50 transition-colors">
                      <Edit2 className="w-4 h-4 text-amber-600" />
                    </button>
                    {deleteConfirm === guest.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => deleteGuest(guest.id)} disabled={deleting === guest.id}
                          className="h-9 px-3 rounded-lg bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100">
                          {deleting === guest.id ? <Loader className="w-3 h-3 animate-spin" /> : "Delete"}
                        </button>
                        <button onClick={() => setDeleteConfirm(null)} className="h-9 px-3 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(guest.id)} className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-center">
        <p className="text-sm text-red-700">{error}</p>
        <button onClick={fetchHosts} className="mt-3 text-sm text-red-600 underline hover:no-underline">Try again</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {selectedHost ? renderGuestList() : renderHostList()}
      {renderConfirmModal()}
      {renderQrModal()}
      {renderEditModal()}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div className={`px-5 py-3 rounded-xl shadow-lg text-sm font-semibold text-white flex items-center gap-2 ${toast.type === "success" ? "bg-emerald-600" : "bg-red-500"}`}>
            {toast.type === "success" ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
