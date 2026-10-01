"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { getEvent, deleteEvent, type EventData } from "@/lib/api/events";
import { apiClient, API_BASE } from "@/lib/api-client";
import { initiatePayment } from "@/lib/api/payments";
import { EventDetailSkeleton } from "@/components/shared/loading-skeleton";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Toast } from "@/components/shared/toast";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, BarChart3, Users, Mail, Send, Settings, Share2, Loader, HelpCircle, Bell, Ticket, Copy, Edit2, Zap, Calendar, Clock, MapPin, ExternalLink, ImageIcon, Shirt, ChevronRight } from "lucide-react";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopbar } from "@/components/dashboard/topbar";
import GuestsTabContent from "@/components/events/GuestsTabContent";
import BurialHostDashboard from "@/components/burial/BurialHostDashboard";
import QuestionsTabContent from "@/components/events/QuestionsTabContent";
import RemindersTabContent from "@/components/events/RemindersTabContent";
import CouponsTabContent from "@/components/events/CouponsTabContent";
import TemplatesTabContent from "@/components/events/TemplatesTabContent";
import WaitlistTabContent from "@/components/events/WaitlistTabContent";
import InvitesTabContent from "@/components/events/InvitesTabContent";
import NBCLocationDashboard from "@/components/events/NBCLocationDashboard";

type Guest = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  rsvp_status: string;
  rsvp_note?: string | null;
  invite_sent: boolean;
  invite_attempts?: number;
  invite_viewed_at?: string | null;
  notes?: string | null;
  tags?: string[];
  category?: string | null;
  qr_token?: string | null;
  custom_data?: Record<string, any>;
};

type SendResult = {
  channels?: Record<string, { batch_id: number; sent: number; total: number; skipped_max_attempts?: number }>;
  total_sent?: number;
  total_guests?: number;
  batch_id?: number;
  channel?: string;
  sent?: number;
  total?: number;
};

type RSVPStats = {
  total: number;
  accepted: number;
  declined: number;
  pending: number;
};

function guestLimitFromRange(value?: string | null) {
  const numbers = value?.match(/\d+/g)?.map(Number) || [];
  return numbers.length ? Math.max(...numbers) : null;
}

function isValidPhone(value?: string | null) {
    if (!value) return false;
    const compact = value.replace(/[\s().-]/g, "");
    return /^\+?\d{7,15}$/.test(compact);
  }

function EventDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [event, setEvent] = useState<EventData | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestCategory, setGuestCategory] = useState("");
  const [generatingQR, setGeneratingQR] = useState<number | null>(null);
  const [qrMap, setQrMap] = useState<Record<number, string>>({});
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [channels, setChannels] = useState<string[]>(["email", "whatsapp"]);
  const [logs, setLogs] = useState<any[]>([]);
  const [rsvpStats, setRsvpStats] = useState<RSVPStats | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResult, setCsvResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [toastAction, setToastAction] = useState<{ label: string; onClick: () => void } | undefined>(undefined);
  const [editingGuest, setEditingGuest] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingGuest, setSavingGuest] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [coverUploading, setCoverUploading] = useState(false);
  const [flierUploading, setFlierUploading] = useState(false);
  const [fliers, setFliers] = useState<any[]>([]);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const flierInputRef = useRef<HTMLInputElement>(null);
  const [guestSearch, setGuestSearch] = useState("");
  const [guestRsvpFilter, setGuestRsvpFilter] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalGuests, setTotalGuests] = useState(0);
  const [selectedGuestIds, setSelectedGuestIds] = useState<number[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState("all");
  const [exportMsgStatus, setExportMsgStatus] = useState("all");
  const [exportMsgChannel, setExportMsgChannel] = useState("all");
  const [exportingMsg, setExportingMsg] = useState(false);
  const [publishChannel, setPublishChannel] = useState("email");
  const [publishing, setPublishing] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; variant?: "danger" | "warning" | "default"; onConfirm: () => void } | null>(null);
  const [publishError, setPublishError] = useState("");
  const [checkinStats, setCheckinStats] = useState<{ checked_in: number; rsvp_accepted: number; total_guests: number; recent_checkins: any[] } | null>(null);
  const [accreditationLog, setAccreditationLog] = useState<{ attempts: any[]; suspicious_count: number } | null>(null);
  const [showAccreditationLog, setShowAccreditationLog] = useState(false);
  const [locationSummary, setLocationSummary] = useState<Record<string, number>>({});
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabContainerRef = useRef<HTMLDivElement>(null);
  const [tabsFixed, setTabsFixed] = useState(false);
  const [tabsWidth, setTabsWidth] = useState(0);
  const [tabsLeft, setTabsLeft] = useState(0);
  const [tabsHeight, setTabsHeight] = useState(0);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const loadGuests = useCallback(async (search?: string, rsvpStatus?: string, page?: number) => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (rsvpStatus) params.set("rsvp_status", rsvpStatus);
      params.set("offset", String((page ?? currentPage) * 10));
      params.set("limit", "10");
      const qs = params.toString();
      const res = await apiClient<{ guests: Guest[]; total: number; offset: number; limit: number }>(`/events/${id}/guests${qs ? `?${qs}` : ""}`);
      setGuests(res.guests);
      setTotalGuests(res.total);
    } catch {}
  }, [id, currentPage]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }
    if (user && id) {
      setLoadError(false);
      getEvent(Number(id)).then(setEvent).catch(() => setLoadError(true));
      loadGuests();
      loadRsvpStats();
      loadPurchases();
      loadFliers();
      loadCheckinStats();
      loadAccreditationLog();
    }
  }, [user, loading, id, loadGuests]);

  useEffect(() => {
    const ref = searchParams.get("trxref") || searchParams.get("reference");
    if (ref && id) {
      getEvent(Number(id)).then(setEvent).catch(() => {});
    }
  }, [searchParams, id]);

  useEffect(() => {
    const tabsEl = tabsRef.current;
    if (!tabsEl) return;
    const onScroll = () => {
      const rect = tabsEl.getBoundingClientRect();
      const topbarH = 64;
      setTabsFixed(rect.top <= topbarH);
      setTabsWidth(rect.width);
      setTabsLeft(rect.left);
      setTabsHeight(tabsEl.offsetHeight);
    };
    const onScrollEnd = () => {
      const container = tabContainerRef.current;
      if (!container) return;
      const { scrollLeft, scrollWidth, clientWidth } = container;
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
    };
    const onPageScroll = () => { onScroll(); onScrollEnd(); };
    window.addEventListener("scroll", onPageScroll, { passive: true });
    window.addEventListener("resize", onPageScroll);
    onPageScroll();
    return () => {
      window.removeEventListener("scroll", onPageScroll);
      window.removeEventListener("resize", onPageScroll);
    };
  }, []);

  useEffect(() => {
    const container = tabContainerRef.current;
    if (!container) return;
    const onContainerScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
    };
    container.addEventListener("scroll", onContainerScroll, { passive: true });
    onContainerScroll();
    return () => container.removeEventListener("scroll", onContainerScroll);
  }, [activeTab]);

  const [couponCode, setCouponCode] = useState("");

  const handlePublish = async () => {
    setPublishError("");
    setPublishing(true);
    try {
      const res = await initiatePayment(Number(id), publishChannel, "paystack", "paystack", couponCode || undefined);
      if (res.method === "coupon") {
        getEvent(Number(id)).then(setEvent);
      } else if (res.authorization_url) {
        window.location.href = res.authorization_url;
      } else {
        getEvent(Number(id)).then(setEvent);
      }
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "Payment initiation failed");
    }
    setPublishing(false);
  };

  const handleGuestSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(0);
    loadGuests(guestSearch || undefined, guestRsvpFilter || undefined, 0);
  };

  const resetGuestFilter = () => {
    setGuestSearch("");
    setGuestRsvpFilter("");
    setCurrentPage(0);
    loadGuests(undefined, undefined, 0);
  };

  const loadLogs = async () => {
    try {
      const l = await apiClient<any[]>(`/events/${id}/delivery-logs`);
      setLogs(l);
    } catch {}
  };

  const loadRsvpStats = async () => {
    try {
      const s = await apiClient<RSVPStats>(`/events/${id}/rsvp-stats`);
      setRsvpStats(s);
    } catch {}
  };

  const loadCheckinStats = async () => {
    try {
      const s = await apiClient<any>(`/qr/events/${id}/checkin-stats`);
      setCheckinStats(s);
    } catch {}
  };

  const loadAccreditationLog = async () => {
    try {
      const l = await apiClient<{ attempts: any[]; suspicious_count: number }>(`/qr/events/${id}/accreditation-log`);
      setAccreditationLog(l);
      const locationCounts: Record<string, number> = {};
      l?.attempts?.forEach((a: any) => {
        const loc = a.location || "unknown";
        locationCounts[loc] = (locationCounts[loc] || 0) + 1;
      });
      setLocationSummary(locationCounts);
    } catch {}
  };

  const loadPurchases = async () => {
    try {
      const p = await apiClient<any[]>(`/tickets/events/${id}/purchases`);
      setPurchases(p);
    } catch {}
  };

  const loadFliers = async () => {
    try {
      const f = await apiClient<any[]>(`/events/${id}/fliers`);
      setFliers(f);
    } catch {}
  };

  const uploadCover = async (file: File) => {
    setCoverUploading(true);
    try {
      const token = localStorage.getItem("access_token");
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/events/${id}/upload-cover`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Cover upload failed");
      }
      const data = await res.json();
      if (event) setEvent({ ...event, cover_image: data.url });
      getEvent(Number(id)).then(setEvent);
      showToast("Cover image uploaded");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Cover upload failed", "error");
    }
    setCoverUploading(false);
  };

  const uploadFlier = async (file: File) => {
    setFlierUploading(true);
    try {
      const token = localStorage.getItem("access_token");
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/events/${id}/upload-flier`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Flier upload failed");
      }
      loadFliers();
      showToast("Flier uploaded");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Flier upload failed", "error");
    }
    setFlierUploading(false);
  };

  const deleteCover = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_BASE}/events/${id}/cover`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to delete cover");
      if (event) setEvent({ ...event, cover_image: null as any });
      showToast("Cover image removed");
    } catch {
      showToast("Failed to delete cover", "error");
    }
  };

  const deleteFlier = async (flierId: number) => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_BASE}/events/${id}/fliers/${flierId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to delete flier");
      loadFliers();
      showToast("Flier deleted");
    } catch {
      showToast("Failed to delete flier", "error");
    }
  };

  const showToast = (message: string, type: "success" | "error" = "success", action?: { label: string; onClick: () => void }) => {
    setToastMessage(message);
    setToastType(type);
    setToastAction(action);
    setToastVisible(true);
  };

  const addGuest = async (e: React.FormEvent, customData?: Record<string, any>) => {
    e.preventDefault();
    if (guestLimit !== null && totalGuests >= guestLimit) {
      showToast(`Guest limit reached. This event allows up to ${guestLimit} guests.`, "error");
      return;
    }
    try {
      const body: Record<string, any> = { name: guestName, phone: guestPhone || null, email: guestEmail || null, category: guestCategory || null };
      if (customData && Object.keys(customData).length > 0) {
        body.custom_data = customData;
      }
      await apiClient(`/events/${id}/guests`, { method: "POST", body });
      setGuestName(""); setGuestPhone(""); setGuestEmail(""); setGuestCategory("");
      showToast(`${guestName} added successfully`);
      loadGuests();
      loadRsvpStats();
      loadCheckinStats();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not add guest.", "error");
    }
  };

  const uploadCsv = async () => {
    if (!csvFile) return;
    setCsvUploading(true); setCsvResult(null);
    try {
      const token = localStorage.getItem("access_token");
      const formData = new FormData();
      formData.append("file", csvFile);
      const res = await fetch(`${API_BASE}/events/${id}/guests/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = typeof data.detail === "string" ? data.detail : "Upload failed";
        throw new Error(detail);
      }
      showToast(`Imported ${data.imported} guests`);
      setCsvFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadGuests(); loadRsvpStats();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Upload failed. Check CSV format (name, phone, email columns).", "error");
    }
    setCsvUploading(false);
  };

  const generateQR = async (guestId: number) => {
    setGeneratingQR(guestId);
    try {
      const qr = await apiClient<{ token: string }>(`/events/${id}/guests/${guestId}/qr`, { method: "POST" });
      setQrMap((prev) => ({ ...prev, [guestId]: qr.token }));
      await apiClient(`/events/${id}/guests/${guestId}/send-qr`, { method: "POST", body: { channels } });
      showToast("QR code sent to guest!");
      loadGuests();
    } catch (err: any) {
      const msg = err.detail || err.message || "Could not send QR";
      showToast(msg, "error");
    }
    setGeneratingQR(null);
  };

  const sendInvites = async (force: boolean = false) => {
    setSending(true); setSendResult(null); setSendError(null);
    try {
      const body: any = { channels };
      const res = await apiClient<any>(`/events/${id}/send-invites${force ? "?force=true" : ""}`, {
        method: "POST", body,
      });
      setSendResult(res);
      showToast("Invites sent successfully");
      loadLogs();
      loadGuests();
    } catch (err: any) {
      const detail = err.detail || err.message;
      if (detail?.payment_required) {
        setConfirmDialog({
          title: "Payment required to re-send",
          message: `Pay ${detail.total_cost?.toLocaleString() ?? "0"} to re-send invites to ${detail.unpaid_guest_ids?.length ?? 0} guest(s)?`,
          variant: "default",
          onConfirm: () => setSendError("Complete payment for each guest to re-send. Use the per-guest Invite button."),
        });
        setSendError("Payment required to re-send invites.");
      } else {
        const errMsg = typeof detail === "string" ? detail : "Could not send invites.";
        setSendError(errMsg);
        showToast(errMsg, "error");
      }
    }
    setSending(false);
  };

  const sendGuestInvite = async (guestId: number) => {
    setSendError(null);
    setSendResult(null);
    try {
      const res = await apiClient<any>(`/events/${id}/guests/${guestId}/send-invite?force=true`, { method: "POST", body: { channels } });
      const chs = res.channels || [];
      if (chs.some((c: any) => c.status === "max_attempts")) {
        setSendError("Maximum invite attempts reached for some channels.");
        showToast("Maximum invite attempts reached", "error");
      } else {
        const sent = chs.filter((c: any) => c.sent).map((c: any) => c.channel);
        const failed = chs.filter((c: any) => !c.sent && c.status !== "skipped").map((c: any) => c.channel);
        if (sent.length) showToast(`Invite sent via ${sent.join(" & ")}`);
        if (failed.length) showToast(`${failed.join(" & ")} failed`, "error");
        if (!sent.length && !failed.length) showToast("Invite sent successfully");
      }
      loadGuests();
    } catch (err: any) {
      const detail = err.detail || err.message;
      if (detail?.payment_required) {
        setSendError(`${detail.message} ${detail.amount?.toLocaleString() ?? "0"}`);
        setConfirmDialog({
          title: "Payment required",
          message: `Pay ${detail.amount?.toLocaleString() ?? "0"} to re-send this invite?`,
          variant: "default",
          onConfirm: async () => {
            try {
              const { checkResendPayment, initiateResendPayment } = await import("@/lib/api/payments");
              const check = await checkResendPayment(Number(id), guestId);
              if (check.has_valid_payment) {
                setSendError(null);
                await apiClient(`/events/${id}/guests/${guestId}/send-invite?force=true`, { method: "POST", body: { channels } });
                loadGuests();
              } else {
                const res = await initiateResendPayment(Number(id), guestId);
                if (res.authorization_url) {
                  window.location.href = res.authorization_url;
                } else {
                  setSendError("Payment initiated. Refresh after completing payment.");
                }
              }
            } catch {}
          },
        });
      } else {
        const errMsg = typeof detail === "string" ? detail : "Could not send invite.";
        setSendError(errMsg);
        showToast(errMsg, "error");
      }
    }
  };

  const sendGuestQr = async (guestId: number) => {
    try {
      await apiClient(`/events/${id}/guests/${guestId}/send-qr`, { method: "POST", body: { channels } });
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Could not send QR.");
    }
  };

  const sendAllQrs = async () => {
    setSending(true); setSendResult(null); setSendError(null);
    try {
      const res = await apiClient<any>(`/events/${id}/send-qrs`, { method: "POST", body: { channels } });
      setSendResult(res);
      loadLogs();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Could not send QR codes.");
    }
    setSending(false);
  };

  const testSend = async (messageSubject?: string, messageBody?: string) => {
    const results: string[] = [];
    for (const ch of channels) {
      try {
        await apiClient("/events/test-send", {
          method: "POST",
          body: {
            channel: ch,
            email: ch === "email" ? (user?.email || "") : undefined,
            phone: ch !== "email" ? (user?.phone || "") : undefined,
            ...(messageSubject ? { message_subject: messageSubject } : {}),
            ...(messageBody ? { message_body: messageBody } : {}),
          },
        });
        results.push(`${ch}: OK`);
      } catch (err: any) {
        results.push(`${ch}: ${err.message || "FAILED"}`);
      }
    }
    const allOk = results.every((r) => r.includes("OK"));
    showToast(allOk ? `Test sent! ${results.join(", ")}` : `Test result: ${results.join(", ")}`, allOk ? "success" : "error");
    if (!allOk) throw new Error(results.join(", "));
  };

  const toggleSelect = (guestId: number) => {
    setSelectedGuestIds((prev) =>
      prev.includes(guestId) ? prev.filter((id) => id !== guestId) : prev.length < 5 ? [...prev, guestId] : prev
    );
  };

  const toggleSelectAll = () => {
    if (selectedGuestIds.length === guests.length) {
      setSelectedGuestIds([]);
    } else {
      setSelectedGuestIds(guests.map((g) => g.id).slice(0, 5));
    }
  };

  const sendToSelected = async () => {
    if (selectedGuestIds.length === 0) return;
    setSending(true); setSendError(null); setSendResult(null);
    try {
      const res = await apiClient<any>(`/events/${id}/send-invites-batch`, {
        method: "POST",
        body: { channels, guest_ids: selectedGuestIds },
      });
      setSendResult(res);
      setSelectedGuestIds([]);
      loadGuests(guestSearch || undefined, guestRsvpFilter || undefined, currentPage);
      loadLogs();
    } catch (err: any) {
      const detail = err.detail || err.message;
      if (detail?.payment_required) {
        setSendError("Some guests require payment to re-send.");
      } else {
        setSendError(typeof detail === "string" ? detail : "Could not send invites.");
      }
    }
    setSending(false);
  };

  const exportGuests = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_BASE}/events/${id}/export-guests?status=${exportStatus}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `guests-event-${id}-${exportStatus}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
    setExporting(false);
  };

  const exportMessages = async () => {
    setExportingMsg(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_BASE}/events/${id}/export-messages?status=${exportMsgStatus}&channel=${exportMsgChannel}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `messages-event-${id}-${exportMsgStatus}-${exportMsgChannel}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
    setExportingMsg(false);
  };

  const pageCount = Math.ceil(totalGuests / 10);
  const goToPage = (page: number) => {
    if (page < 0 || page >= pageCount) return;
    setCurrentPage(page);
    setSelectedGuestIds([]);
    loadGuests(guestSearch || undefined, guestRsvpFilter || undefined, page);
  };

  const handleDeleteEvent = async () => {
    setDeleting(true);
    try {
      await deleteEvent(Number(id));
      router.push("/dashboard");
    } catch {}
    setDeleting(false);
  };

  const startEdit = (guest: Guest) => {
    setEditingGuest(guest.id);
    setEditName(guest.name);
    setEditPhone(guest.phone || "");
    setEditEmail(guest.email || "");
    setEditCategory(guest.category || "");
    setEditNotes(guest.notes || "");
  };

  const saveEdit = async (guestId: number, customData?: Record<string, any>) => {
    if (!editName.trim()) {
      showToast("Guest name is required", "error");
      return;
    }
    if (editEmail && !editEmail.includes("@")) {
      showToast("Please enter a valid email address", "error");
      return;
    }
    if (editPhone && editPhone.length < 10) {
      showToast("Phone number should be at least 10 digits", "error");
      return;
    }
    try {
      setSavingGuest(guestId);
      const body: Record<string, any> = { name: editName, phone: editPhone || null, email: editEmail || null, category: editCategory || null, notes: editNotes || null };
      if (customData && Object.keys(customData).length > 0) {
        body.custom_data = customData;
      }
      await apiClient(`/events/${id}/guests/${guestId}`, {
        method: "PUT",
        body,
      });
      showToast("Guest updated successfully");
      setEditingGuest(null);
      loadGuests();
    } catch (err: any) {
      showToast(err.message || "Could not update guest", "error");
    } finally {
      setSavingGuest(null);
    }
  };

  const [undoGuestId, setUndoGuestId] = useState<number | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDeleteGuest = async (guestId: number) => {
    try {
      const deletedGuest = guests.find((g) => g.id === guestId);
      await apiClient(`/events/${id}/guests/${guestId}`, { method: "DELETE" });
      setDeleteConfirm(null);
      const undo = () => {
        apiClient(`/events/${id}/guests/${guestId}/restore`, { method: "POST" }).then(() => {
          loadGuests(); loadRsvpStats();
        }).catch(() => {});
        setUndoGuestId(null);
      };
      setUndoGuestId(guestId);
      showToast(`${deletedGuest?.name || "Guest"} deleted`, "success", { label: "Undo", onClick: undo });
      loadGuests(); loadRsvpStats();
    } catch {
      showToast("Could not delete guest. They may have existing invites or payments.", "error");
    }
  };

  if (loading || !user) return null;
  if (loadError) return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-sm">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" aria-hidden="true" />
        <h2 className="text-xl font-semibold">Could not load event</h2>
        <p className="text-sm text-muted-foreground">The event may have been deleted or a network error occurred.</p>
        <button onClick={() => router.push("/dashboard")} className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-accent flex items-center gap-2 justify-center">
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </button>
      </div>
    </div>
  );
  if (!event) return <EventDetailSkeleton />;

  const guestLimit = guestLimitFromRange(event.guest_count_range);
  const remainingGuests = guestLimit === null ? null : Math.max(guestLimit - totalGuests, 0);
  const phoneChannelsSelected = channels.some((c) => c === "whatsapp" || c === "sms");
  const invalidPhoneGuests = phoneChannelsSelected ? guests.filter((guest) => !isValidPhone(guest.phone)) : [];
  const guestsWithMissingContact = guests.filter((guest) => {
    const missingEmail = channels.includes("email") && !guest.email;
    const missingPhone = channels.some((c) => c !== "email") && !guest.phone;
    return missingEmail || missingPhone;
  });
  const canSendInvites = totalGuests > 0 && invalidPhoneGuests.length === 0;

  const isNBCEvent = Number(id) === 71;

  const tabs = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    ...(isNBCEvent ? [
      { id: "airport", label: "Airport", icon: MapPin },
      { id: "abuja_continental", label: "Abuja Continental", icon: MapPin },
      { id: "transcorp", label: "Transcorp", icon: MapPin },
      { id: "icc", label: "ICC", icon: MapPin },
      { id: "bus", label: "Bus", icon: MapPin },
      { id: "analytics", label: "Analytics", icon: BarChart3 },
    ] : []),
    { id: "guests", label: "Guests", icon: Users, badge: totalGuests },
    { id: "invites", label: "Invites", icon: Send },
    { id: "questions", label: "Questions", icon: HelpCircle },
    { id: "reminders", label: "Reminders", icon: Bell },
    { id: "coupons", label: "Coupons", icon: Ticket },
    { id: "templates", label: "Templates", icon: Copy },
    { id: "waitlist", label: "Waitlist", icon: Users },
    { id: "settings", label: "Settings", icon: Settings }
  ];

  const allTabs = tabs.map((t) => {
    const IconComp = t.icon;
    const isActive = activeTab === t.id;
    return (
      <button
        key={t.id}
        onClick={() => { setActiveTab(t.id); router.replace(`/dashboard/events/${id}?tab=${t.id}`, { scroll: false }); }}
        className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap ${
          isActive
            ? "bg-primary text-white shadow-md"
            : "text-slate-700 hover:bg-slate-100"
        }`}
      >
        <IconComp className="w-4 h-4" />
        <span>{t.label}</span>
        {t.badge !== undefined && t.badge > 0 && (
          <span className="ml-auto inline-flex items-center justify-center h-5 px-2 rounded-full text-xs font-bold bg-secondary/10 text-secondary">
            {t.badge}
          </span>
        )}
      </button>
    );
  });

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f5f7fa" }}>
      <div className={`sticky top-0 z-30 transition-all duration-300 ${sidebarOpen ? "lg:ml-64" : "lg:ml-20"}`}>
        <DashboardTopbar
          title={event.title}
          subtitle="Event Details"
          onMenuClick={() => setMobileNavOpen(true)}
        />
      </div>

      <div className="flex">
        <DashboardSidebar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          mobileNavOpen={mobileNavOpen}
          onMobileNavClose={() => setMobileNavOpen(false)}
        />

        <div className={`flex-1 min-w-0 transition-all duration-300 ${sidebarOpen ? "lg:ml-64" : "lg:ml-20"}`}>
          <div
            ref={tabsRef}
            className={`z-20 bg-slate-50 pb-2 pt-2 px-4 sm:px-6 shadow-sm border-b border-slate-200 transition-none ${tabsFixed ? "fixed left-0 right-0 top-16" : ""}`}
            style={tabsFixed ? { left: tabsLeft, width: tabsWidth } : undefined}
          >
            <div className="relative">
              <div ref={tabContainerRef} className="flex items-center gap-2 overflow-x-auto whitespace-nowrap no-scrollbar">
                {allTabs}
              </div>
              <div className={`pointer-events-none absolute -right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-gradient-to-l from-slate-50 via-slate-50/80 to-transparent flex items-center justify-end pr-3 transition-opacity duration-500 rounded-full ${canScrollRight ? "opacity-100" : "opacity-0"}`}>
                <ChevronRight className="w-5 h-5 text-primary animate-bounce" />
              </div>
            </div>
          </div>

          {tabsFixed && <div style={{ height: tabsHeight }} />}
          <div className="px-4 sm:px-6 py-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
            {activeTab === "overview" && (() => {
              const heroImage = event.cover_image || (fliers.length ? [...fliers].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.url : null);
              return (
              <div>
                {/* Hero Header */}
                <div className={`relative ${heroImage ? "h-64 sm:h-80" : "h-48"} overflow-hidden`}>
                  {heroImage ? (
                    <img src={heroImage} alt={event.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">{event.title}</h1>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-white/80">
                      {event.event_date && (
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          {new Date(event.event_date).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "long", day: "numeric" })}
                        </span>
                      )}
                      {event.event_time && (
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          {(() => {
                            const parts = event.event_time.split(":");
                            if (parts.length < 2) return event.event_time;
                            const h = parseInt(parts[0]), m = parts[1];
                            return `${h % 12 || 12}:${m} ${h >= 12 ? "PM" : "AM"}`;
                          })()}
                        </span>
                      )}
                      {event.venue && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4" />
                          {event.venue}
                        </span>
                      )}
                      {event.host_name && (
                        <span className="flex items-center gap-1.5">
                          <Users className="w-4 h-4" />
                          Hosted by {event.host_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-6 sm:p-8 space-y-6">
                  {/* Stats Dashboard */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 p-3 sm:p-4">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Total Guests</p>
                      <p className="text-2xl font-bold text-slate-900">{totalGuests}</p>
                    </div>
                    <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 p-3 sm:p-4">
                      <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide mb-1">Accepted</p>
                      <p className="text-2xl font-bold text-emerald-900">{rsvpStats?.accepted ?? 0}</p>
                    </div>
                    <div className="rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 p-3 sm:p-4">
                      <p className="text-xs font-medium text-amber-600 uppercase tracking-wide mb-1">Pending</p>
                      <p className="text-2xl font-bold text-amber-900">{rsvpStats?.pending ?? 0}</p>
                    </div>
                    <div className="rounded-xl bg-gradient-to-br from-red-50 to-red-100 border border-red-200 p-3 sm:p-4">
                      <p className="text-xs font-medium text-red-600 uppercase tracking-wide mb-1">Declined</p>
                      <p className="text-2xl font-bold text-red-900">{rsvpStats?.declined ?? 0}</p>
                    </div>
                  </div>

                  {/* Check-in Progress */}
                  {checkinStats && (
                    <div className="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-bold text-blue-900">Check-in Progress</p>
                        <span className="text-xs font-medium text-blue-600">{checkinStats.checked_in} / {checkinStats.total_guests} checked in</span>
                      </div>
                      <div className="w-full bg-white/60 rounded-full h-3 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500" style={{ width: `${checkinStats.total_guests > 0 ? (checkinStats.checked_in / checkinStats.total_guests) * 100 : 0}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Location Summary */}
                  {locationSummary && Object.keys(locationSummary).length > 0 && (
                    <div className="mt-3 p-2 rounded-xl bg-slate-50 border border-slate-200 text-sm">
                      <p className="font-medium text-slate-600 mb-1">Accreditations by Location</p>
                      <div className="flex gap-2">
                        {Object.entries(locationSummary).map(([loc, count]) => (
                          <span key={loc} className="px-2 py-0.5 rounded bg-slate-100">
                            {loc}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => setActiveTab("guests")} className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-secondary text-white text-sm font-medium hover:bg-secondary/80 transition-colors">
                      <Users className="w-4 h-4" />
                      Manage Guests
                    </button>
                    {event.slug && (
                      <a href={`/e/${event.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">
                        <ExternalLink className="w-4 h-4" />
                        View Public Page
                      </a>
                    )}
                    <Link href={`/dashboard/failed-messages?event_id=${id}`} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors">
                      <AlertTriangle className="w-4 h-4" />
                      Failed Messages
                    </Link>
                  </div>

                  {/* Event Details Card */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {event.event_date && (
                      <div className="flex items-start gap-3 rounded-xl bg-slate-50 border border-slate-200 p-4">
                        <Calendar className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Date</p>
                          <p className="font-bold text-secondary">{new Date(event.event_date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
                        </div>
                      </div>
                    )}
                    {event.event_time && (
                      <div className="flex items-start gap-3 rounded-xl bg-slate-50 border border-slate-200 p-4">
                        <Clock className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Time</p>
                          <p className="font-bold text-secondary">{(() => { const p = event.event_time.split(":"); if (p.length < 2) return event.event_time; const h = parseInt(p[0]); return `${h % 12 || 12}:${p[1]} ${h >= 12 ? "PM" : "AM"}`; })()}</p>
                        </div>
                      </div>
                    )}
                    {event.venue && (
                      <div className="flex items-start gap-3 rounded-xl bg-slate-50 border border-slate-200 p-4">
                        <MapPin className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Venue</p>
                          <p className="font-bold text-secondary">{event.venue}</p>
                        </div>
                      </div>
                    )}
                    {event.dress_code && (
                      <div className="flex items-start gap-3 rounded-xl bg-slate-50 border border-slate-200 p-4">
                        <Shirt className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Dress Code</p>
                          <p className="font-bold text-secondary">{event.dress_code}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {event.description && (
                    <div>
                      <h2 className="text-sm font-bold text-secondary mb-2">About This Event</h2>
                      <p className="text-sm text-slate-600 leading-relaxed">{event.description}</p>
                    </div>
                  )}

                  {/* Fliers */}
                  {fliers.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-secondary mb-3">Event Fliers</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {fliers.map((f) => (
                          <div key={f.id} className="rounded-xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative group">
                            <img src={f.url} alt="Event flier" className="w-full object-contain max-h-64 bg-slate-100" />
                            <button onClick={() => deleteFlier(f.id)} className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700" title="Delete flier">×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Share */}
                  {event.slug && (
                    <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
                      <h3 className="text-sm font-bold text-secondary mb-2 flex items-center gap-2">
                        <Share2 className="w-4 h-4 text-blue-600" />
                        Share This Event
                      </h3>
                      <div className="bg-white rounded-lg p-3 font-mono text-xs text-slate-700 break-all border border-blue-100 select-all">
                        {typeof window !== "undefined" ? `${window.location.origin}/e/${event.slug}` : ""}
                      </div>
                    </div>
                  )}

                  {/* Publish Section */}
                  {event.status !== "published" && (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 space-y-4">
                      <h3 className="font-bold text-secondary flex items-center gap-2">
                        <Zap className="w-5 h-5 text-amber-600" />
                        Publish Event
                      </h3>
                      <p className="text-sm text-slate-600">Publish to make the event visible to the public and allow ticket purchases.</p>
                      <div className="flex flex-wrap gap-2">
                        {["email", "whatsapp", "sms"].map((ch) => (
                          <button key={ch} type="button" onClick={() => setPublishChannel(ch)}
                            className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all capitalize ${publishChannel === ch ? "bg-primary text-white border-primary" : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"}`}>{ch}</button>
                        ))}
                      </div>
                      <input type="text" placeholder="Coupon code (optional)" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                      {publishError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{publishError}</p>}
                      <button onClick={handlePublish} disabled={publishing} className="w-full h-9 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                        {publishing ? <><Loader className="w-4 h-4 animate-spin" /> Publishing...</> : <><Zap className="w-4 h-4" /> Publish Event</>}
                      </button>
                    </div>
                  )}

                  {/* Ticket Sales */}
                  {purchases.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-secondary mb-3">Ticket Sales ({purchases.length})</h3>
                      <div className="space-y-2">
                        {purchases.map((p) => (
                          <div key={p.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-slate-900">{p.buyer_name}</p>
                                <p className="text-sm text-slate-500">{p.buyer_email}{p.buyer_phone && ` • ${p.buyer_phone}`}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-slate-900">{p.quantity} ticket(s)</p>
                                <p className="text-sm text-slate-500">NGN {p.amount?.toLocaleString()}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ); })()}

            {activeTab === "guests" && (event?.event_type === "burial" ? (
              <BurialHostDashboard eventId={Number(id)} />
            ) : (
              <GuestsTabContent
                eventId={Number(id)}
                guestLimit={guestLimit}
                totalGuests={totalGuests}
                remainingGuests={remainingGuests}
                guestName={guestName}
                setGuestName={setGuestName}
                guestPhone={guestPhone}
                setGuestPhone={setGuestPhone}
                guestEmail={guestEmail}
                setGuestEmail={setGuestEmail}
                guestCategory={guestCategory}
                setGuestCategory={setGuestCategory}
                addGuest={addGuest}
                csvFile={csvFile}
                setCsvFile={setCsvFile}
                csvUploading={csvUploading}
                csvResult={csvResult}
                fileInputRef={fileInputRef}
                uploadCsv={uploadCsv}
                guests={guests}
                guestSearch={guestSearch}
                setGuestSearch={setGuestSearch}
                guestRsvpFilter={guestRsvpFilter}
                setGuestRsvpFilter={setGuestRsvpFilter}
                handleGuestSearch={handleGuestSearch}
                resetGuestFilter={resetGuestFilter}
                editingGuest={editingGuest}
                setEditingGuest={setEditingGuest}
                editName={editName}
                setEditName={setEditName}
                showToast={showToast}
                editPhone={editPhone}
                setEditPhone={setEditPhone}
                editEmail={editEmail}
                setEditEmail={setEditEmail}
                editCategory={editCategory}
                setEditCategory={setEditCategory}
                editNotes={editNotes}
                setEditNotes={setEditNotes}
                saveEdit={saveEdit}
                savingGuest={savingGuest}
                deleteConfirm={deleteConfirm}
                setDeleteConfirm={setDeleteConfirm}
                handleDeleteGuest={handleDeleteGuest}
                startEdit={startEdit}
                sendGuestInvite={sendGuestInvite}
                triggerSearch={loadGuests}
                generateQR={generateQR}
                generatingQR={generatingQR}
                currentPage={currentPage}
                pageCount={pageCount}
                goToPage={goToPage}
                exporting={exporting}
                exportStatus={exportStatus}
                setExportStatus={setExportStatus}
                exportGuests={exportGuests}
                channels={channels}
                setChannels={setChannels}
                sending={sending}
                canSendInvites={canSendInvites}
                sendInvites={sendInvites}
                sendAllQrs={sendAllQrs}
                testSend={testSend}
                sendResult={sendResult}
                sendError={sendError}
                logs={logs}
                invalidPhoneGuests={invalidPhoneGuests}
                guestsWithMissingContact={guestsWithMissingContact}
                guestCountRange={event.guest_count_range}
                exportingMsg={exportingMsg}
                exportMsgStatus={exportMsgStatus}
                setExportMsgStatus={setExportMsgStatus}
                exportMsgChannel={exportMsgChannel}
                setExportMsgChannel={setExportMsgChannel}
                exportMessages={exportMessages}
              />
            ))}

            {(activeTab === "airport" || activeTab === "abuja_continental" || activeTab === "transcorp" || activeTab === "icc" || activeTab === "bus" || activeTab === "analytics") && isNBCEvent && (
              <div className="p-6">
                <NBCLocationDashboard eventId={Number(id)} />
              </div>
            )}

            {activeTab === "questions" && (
              <QuestionsTabContent eventId={id} />
            )}

            {activeTab === "reminders" && (
              <RemindersTabContent eventId={id} />
            )}

            {activeTab === "coupons" && (
              <CouponsTabContent eventId={id} />
            )}

            {activeTab === "templates" && (
              <TemplatesTabContent eventId={id} />
            )}

            {activeTab === "waitlist" && (
              <WaitlistTabContent eventId={id} />
            )}

            {activeTab === "invites" && (
              <InvitesTabContent
                eventId={id}
                channels={channels}
                setChannels={setChannels}
                sending={sending}
                canSendInvites={canSendInvites}
                sendInvites={sendInvites}
                sendAllQrs={sendAllQrs}
                testSend={testSend}
                sendResult={sendResult}
                sendError={sendError}
                logs={logs}
                guests={guests}
                invalidPhoneGuests={invalidPhoneGuests}
                guestsWithMissingContact={guestsWithMissingContact}
                guestCountRange={event.guest_count_range}
                exportingMsg={exportingMsg}
                exportMsgStatus={exportMsgStatus}
                setExportMsgStatus={setExportMsgStatus}
                exportMsgChannel={exportMsgChannel}
                setExportMsgChannel={setExportMsgChannel}
                exportMessages={exportMessages}
                onDataChange={() => { loadGuests(); loadLogs(); }}
                inviteSubject={event?.invite_subject}
                inviteBody={event?.invite_body}
                onSaveInviteMessage={async (subject, body) => {
                  await apiClient(`/events/${id}/invite-message`, { method: "PUT", body: { invite_subject: subject, invite_body: body } });
                  getEvent(Number(id)).then(setEvent).catch(() => {});
                }}
              />
            )}

            {activeTab === "settings" && (
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-secondary">Event Settings</h2>
                    <p className="text-sm text-slate-500 mt-1">Manage event details, cover image, and fliers</p>
                  </div>
                  <Link href={`/dashboard/events/${id}/edit`} className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-secondary text-white text-sm font-medium hover:bg-secondary/80 transition-colors shadow-sm">
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </Link>
                </div>

                <div className="border-t border-slate-100 pt-6">
                  <h3 className="text-sm font-bold text-secondary mb-3 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" /> Cover Image
                  </h3>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    {event.cover_image && (
                      <div className="mb-4 rounded-lg overflow-hidden border border-slate-200 shadow-sm relative group">
                        <img src={event.cover_image} alt="Current cover" className="w-full object-contain max-h-64 bg-white" />
                        <button onClick={deleteCover} className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700" title="Remove cover">×</button>
                      </div>
                    )}
                    <label className="flex items-center justify-center w-full cursor-pointer">
                      <div className="flex flex-col items-center gap-2 py-6">
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                          <ImageIcon className="w-5 h-5 text-slate-500" />
                        </div>
                        <p className="text-sm font-medium text-slate-600">Click to upload cover image</p>
                        <p className="text-xs text-slate-400">PNG, JPG up to 10MB</p>
                      </div>
                      <input ref={coverInputRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { uploadCover(f); if (coverInputRef.current) coverInputRef.current.value = ""; } }} className="hidden" />
                    </label>
                    {coverUploading && <div className="mt-2 flex items-center gap-2 text-sm text-slate-600"><Loader className="w-4 h-4 animate-spin" /> Uploading...</div>}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-6">
                  <h3 className="text-sm font-bold text-secondary mb-3 flex items-center gap-2">
                    <Copy className="w-4 h-4" /> Event Fliers
                  </h3>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    {fliers.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                        {fliers.map((f) => (
                          <div key={f.id} className="rounded-lg overflow-hidden border border-slate-200 shadow-sm relative group bg-white">
                            <img src={f.url} alt="Flier" className="w-full object-contain max-h-48" />
                            <button onClick={() => deleteFlier(f.id)} className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700" title="Delete flier">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <label className="flex items-center justify-center w-full cursor-pointer">
                      <div className="flex flex-col items-center gap-2 py-6">
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                          <Copy className="w-5 h-5 text-slate-500" />
                        </div>
                        <p className="text-sm font-medium text-slate-600">Click to upload flier</p>
                        <p className="text-xs text-slate-400">PNG, JPG up to 10MB</p>
                      </div>
                      <input ref={flierInputRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { uploadFlier(f); if (flierInputRef.current) flierInputRef.current.value = ""; } }} className="hidden" />
                    </label>
                    {flierUploading && <div className="mt-2 flex items-center gap-2 text-sm text-slate-600"><Loader className="w-4 h-4 animate-spin" /> Uploading...</div>}
                  </div>
                </div>
              </div>
            )}
              </div>
            </div>
          </div>
        </div>

      <ConfirmDialog
        open={!!confirmDialog}
        title={confirmDialog?.title ?? ""}
        message={confirmDialog?.message ?? ""}
        variant={confirmDialog?.variant ?? "default"}
        confirmLabel="Yes, proceed"
        onConfirm={() => { confirmDialog?.onConfirm(); setConfirmDialog(null); }}
        onCancel={() => setConfirmDialog(null)}
      />
      <Toast
        message={toastMessage}
        type={toastType}
        visible={toastVisible}
        action={toastAction}
        onClose={() => { setToastVisible(false); setToastAction(undefined); }}
      />
    </div>
  );
}

export default function EventDetailPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<EventDetailSkeleton />}>
        <EventDetailContent />
      </Suspense>
    </ErrorBoundary>
  );
}
