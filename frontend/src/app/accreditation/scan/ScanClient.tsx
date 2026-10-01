"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { apiClient, API_BASE } from "@/lib/api-client";
import { useAuth } from "@/contexts/auth-context";
import { Check, X, Search, Camera, User, Clock, Loader, ChevronDown, QrCode, LogOut, Scan, FileText, Plane, Building2, MapPin, Bus } from "lucide-react";

const QRScanner = dynamic(() => import("@/components/accreditation/QRScanner"), { ssr: false });

type Mode = "scanner" | "manual";

function EventDropdown({ events, selectedEvent, onEventChange, label }: { events: any[], selectedEvent: any, onEventChange: (id: number) => void, label?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="relative w-full">
      {label && <p className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-2">{label}</p>}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="appearance-none w-full bg-white/15 border border-teal-500/50 rounded-lg px-3 py-2.5 text-sm text-white cursor-pointer hover:bg-white/20 hover:border-teal-500 transition focus:outline-none focus:ring-2 focus:ring-teal-500/60 focus:border-teal-500 flex items-center justify-between"
      >
        <span className="truncate">{selectedEvent?.title || "Select event"}</span>
        <ChevronDown className={`w-5 h-5 text-teal-400 flex-shrink-0 transition ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a2940] border border-teal-500/50 rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="p-2 border-b border-white/10">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Type to filter events..."
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-teal-500/60"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
          {events.filter((ev) => (ev.title || "").toLowerCase().includes(filter.trim().toLowerCase())).map((ev) => (
            <button
              key={ev.id}
              onClick={() => { onEventChange(ev.id); setIsOpen(false); setFilter(""); }}
              className={`w-full text-left px-3 py-2.5 text-sm transition ${
                selectedEvent?.id === ev.id
                  ? "bg-teal-600/30 text-white border-l-2 border-teal-500 pl-2.5"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              {ev.title}
            </button>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface GuestResult {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  rsvp_status: string;
  rsvp_token: string;
  checked_in: boolean;
  invited_by?: string | null;
  category?: string | null;
}

interface ActivityItem {
  id: number;
  guest_id: number;
  guest_name: string;
  guest_phone: string | null;
  guest_email: string | null;
  invited_by?: string | null;
  checked_in_at: string;
  location?: string | null;
}

export function AccreditationScanClient() {
  const router = useRouter();
  const { user, loading: authLoading, logout, refetchUser } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [stats, setStats] = useState<{ checked_in: number; total_guests: number }>({ checked_in: 0, total_guests: 0 });
  const [mode, setMode] = useState<Mode>("scanner");

  // Scanner state
  const [scanResult, setScanResult] = useState<{ status: string; message: string; guest?: any; scannedToken?: string } | null>(null);

  // Manual state
  const [manualQuery, setManualQuery] = useState("");
  const [manualResults, setManualResults] = useState<GuestResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [checkingIn, setCheckingIn] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedManualGuests, setSelectedManualGuests] = useState<Set<number>>(new Set());
  const [manualReaccreditGuest, setManualReaccreditGuest] = useState<GuestResult | null>(null);
  const [manualReaccreditInfo, setManualReaccreditInfo] = useState<{ location: string; time: string } | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Gate quick-add state (walk-ins + bulk uploads from the gate)
  const [manualTab, setManualTab] = useState<"search" | "add" | "bulk">("search");
  const [qaName, setQaName] = useState("");
  const [qaPhone, setQaPhone] = useState("");
  const [qaEmail, setQaEmail] = useState("");
  const [qaCategory, setQaCategory] = useState("");
  const [qaCheckin, setQaCheckin] = useState(true);
  const [qaBusy, setQaBusy] = useState(false);
  const [qaMsg, setQaMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [bulkRows, setBulkRows] = useState<{ name: string; phone: string; email: string; category: string }[]>([]);
  const [bulkSkipped, setBulkSkipped] = useState(0);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Activity state
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activitySearch, setActivitySearch] = useState("");
  const [activityLive, setActivityLive] = useState(true);
  const [lastActivityRefresh, setLastActivityRefresh] = useState<Date | null>(null);

  const [error, setError] = useState("");
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [eventSearch, setEventSearch] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedSubLocation, setSelectedSubLocation] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const LOCATION_OPTIONS = ["Airport", "Abuja Continental", "Abuja Continental 1", "Abuja Continental 2", "Abuja Continental 3", "Abuja Continental 4", "Abuja Continental 5", "Abuja Continental 6", "Transcorp", "Transcorp 1", "Transcorp 2", "Transcorp 3", "Transcorp 4", "Transcorp 5", "ICC", "ICC Guests"];
  const AC_SUBS = ["Airport", "ICC"];
  const TRANSCORP_SUBS = ["Airport", "ICC"];
  const AIRPORT_SUBS = ["Abuja Continental", "Abuja Continental 1", "Abuja Continental 2", "Abuja Continental 3", "Abuja Continental 4", "Abuja Continental 5", "Abuja Continental 6", "Transcorp", "Transcorp 1", "Transcorp 2", "Transcorp 3", "Transcorp 4", "Transcorp 5", "Help Desk"];
  const ICC_SUBS = ["Airport", "Abuja Continental", "Abuja Continental 1", "Abuja Continental 2", "Abuja Continental 3", "Abuja Continental 4", "Abuja Continental 5", "Abuja Continental 6", "Transcorp", "Transcorp 1", "Transcorp 2", "Transcorp 3", "Transcorp 4", "Transcorp 5", "Help Desk"];
  const NBC_EVENT_ID = 71;

  const filteredEvents = events.filter((ev) =>
    ev.title?.toLowerCase().includes(eventSearch.toLowerCase())
  );

  const filteredManualResults = manualResults.filter((g) => {
    if (!statusFilter) return true;
    if (statusFilter === "checked-in") return g.checked_in;
    if (statusFilter === "not-checked-in") return !g.checked_in;
    return g.rsvp_status === statusFilter;
  });

  const checkInPercentage = stats.total_guests > 0 ? Math.round((stats.checked_in / stats.total_guests) * 100) : 0;

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!manualQuery.trim() || !selectedEvent) {
      setManualResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(() => { handleManualSearch(); }, 300);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [manualQuery, selectedEvent?.id]);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Auth check
  useEffect(() => {
    if (authLoading) return;
    if (user) return;
    const token = sessionStorage.getItem("accreditation_token");
    if (!token) { router.push("/accreditation"); return; }
    fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    }).then((r) => { if (r.ok) refetchUser(); else { sessionStorage.removeItem("accreditation_token"); router.push("/accreditation"); } })
      .catch(() => { sessionStorage.removeItem("accreditation_token"); router.push("/accreditation"); });
  }, [authLoading]);

  useEffect(() => {
    if (user) {
      apiClient<any[]>("/scanner/events")
        .then((evts) => {
          setEvents(evts);
          if (evts.length === 0) return;
          const savedId = localStorage.getItem("accreditation_event_id");
          const saved = savedId ? evts.find((e: any) => e.id === Number(savedId)) : null;
          if (saved) setSelectedEvent(saved);
          else if (evts.length === 1) setSelectedEvent(evts[0]);
        })
        .catch(() => {})
        .finally(() => setInitialLoadDone(true));
    }
  }, [user]);

  const loadStats = useCallback(async (eventId: number) => {
    try {
      const d = await apiClient<any>(`/scanner/events/${eventId}/stats`);
      setStats({ checked_in: d.checked_in || 0, total_guests: d.total_guests || 0 });
    } catch {
      // keep previous stats on error
    }
  }, []);

  const loadActivity = useCallback(async (eventId: number, page: number = 1, q: string = "") => {
    setActivityLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "20" });
      if (q) params.set("q", q);
      const d = await apiClient<{ activity: ActivityItem[]; total: number }>(`/scanner/events/${eventId}/activity?${params}`);
      setActivity(d.activity || []);
      setActivityTotal(d.total || 0);
      setActivityPage(page);
      setLastActivityRefresh(new Date());
      setActivityLive(true);
    } catch { setActivity([]); }
    setActivityLoading(false);
  }, []);

  const handleActivitySearch = (q: string) => {
    setActivitySearch(q);
    if (selectedEvent) loadActivity(selectedEvent.id, 1, q);
  };

  const handleActivityPage = (page: number) => {
    if (selectedEvent) loadActivity(selectedEvent.id, page, activitySearch);
  };

  useEffect(() => {
    if (selectedEvent) {
      localStorage.setItem("accreditation_event_id", String(selectedEvent.id));
      loadStats(selectedEvent.id);
      setActivityPage(1);
      setActivitySearch("");
      loadActivity(selectedEvent.id, 1, "");
    }
  }, [selectedEvent, loadStats, loadActivity]);

  useEffect(() => {
    if (!selectedEvent) return;
    const interval = setInterval(() => {
      if (activityPage === 1 && !activitySearch) loadActivity(selectedEvent.id, 1, "");
      loadStats(selectedEvent.id);
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedEvent, loadActivity, loadStats, activityPage, activitySearch]);

  const handleEventChange = (eventId: number) => {
    setScanResult(null);
    setManualResults([]);
    setManualQuery("");
    setError("");
    setMode("scanner");
    const ev = events.find((e) => e.id === eventId) || null;
    setSelectedEvent(ev);
    if (ev) localStorage.setItem("accreditation_event_id", String(ev.id));
    else localStorage.removeItem("accreditation_event_id");
  };

  const lastScannedRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);

  // --- Scanner handlers ---
  const handleVerify = async (token: string) => {
    const now = Date.now();
    if (token === lastScannedRef.current && now - lastScanTimeRef.current < 3000) return;
    lastScannedRef.current = token;
    lastScanTimeRef.current = now;
    setScanResult(null);
    setError("");
    try {
      const res = await apiClient<any>("/scanner/verify", { method: "POST", body: { token } });
      if (res.valid) setScanResult({ status: "found", message: `${res.guest.name}`, guest: res.guest, scannedToken: token });
      else setScanResult({ status: res.reason || "error", message: res.message, guest: res.guest, scannedToken: token });
    } catch (err: any) {
      setScanResult({ status: "error", message: err.message || "Verification failed" });
    }
  };

  const needsSubLocation = (loc: string | null) => {
    if (!loc) return false;
    if (loc === "Abuja Continental" || loc === "Transcorp" || loc === "ICC Guests") return false;
    return true;
  };

  const getEffectiveLocation = () => {
    if (!selectedLocation || selectedEvent?.id !== NBC_EVENT_ID) return null;
    if (selectedSubLocation) return selectedSubLocation;
    return selectedLocation;
  };

  const handleCheckin = async (token: string) => {
    try {
      const body: any = { token };
      const loc = getEffectiveLocation();
      if (loc) body.location = loc;
      const res = await apiClient<any>("/scanner/checkin", { method: "POST", body });
      setScanResult({ status: res.status, message: res.message });
      if (selectedEvent) { loadStats(selectedEvent.id); loadActivity(selectedEvent.id); }
    } catch (err: any) {
      setScanResult({ status: "error", message: err.message || "Check-in failed" });
    }
  };

  const handleScanCheckin = async () => {
    if (!scanResult?.guest) return;
    const token = scanResult.guest.rsvp_token || scanResult.scannedToken;
    if (!token) return;
    await handleCheckin(token);
    if (selectedEvent) { loadStats(selectedEvent.id); loadActivity(selectedEvent.id); }
  };

  // --- Manual handlers ---
  const handleManualSearch = async () => {
    if (!manualQuery.trim() || !selectedEvent) return;
    setSearching(true);
    setError("");
    try {
      const res = await apiClient<{ guests: GuestResult[] }>(`/scanner/events/${selectedEvent.id}/guests?q=${encodeURIComponent(manualQuery)}`);
      setManualResults(res.guests || []);
    } catch (err: any) { setError(err.message || "Search failed"); }
    setSearching(false);
  };

  const handleManualCheckin = async (guest: GuestResult) => {
    setCheckingIn(guest.id);
    setError("");
    try {
      const body: any = { guest_id: guest.id };
      const loc = getEffectiveLocation();
      if (loc) body.location = loc;
      const res = await apiClient<any>("/scanner/checkin", { method: "POST", body });
      if (res.status === "approved") {
        showToast(`${guest.name} checked in`, "success");
        setManualResults((prev) => prev.map((g) => g.id === guest.id ? { ...g, checked_in: true } : g));
      } else showToast(`${res.message || "Check-in failed"}`, "error");
      if (selectedEvent) { loadStats(selectedEvent.id); loadActivity(selectedEvent.id); }
    } catch (err: any) { showToast(err.message || "Check-in failed", "error"); }
    setCheckingIn(null);
  };

  const handleBatchCheckin = async () => {    if (selectedManualGuests.size === 0) return;
    setCheckingIn(-1);
    let successCount = 0;
    for (const guestId of selectedManualGuests) {
      const guest = manualResults.find((g) => g.id === guestId);
      if (guest && !guest.checked_in) {
          try {
            const body: any = { guest_id: guest.id };
            const bLoc = getEffectiveLocation();
            if (bLoc) body.location = bLoc;
            await apiClient<any>("/scanner/checkin", { method: "POST", body }); successCount++;
          } catch {}
      }
    }
    showToast(`Checked in ${successCount} guest${successCount !== 1 ? "s" : ""}`, "success");
    setSelectedManualGuests(new Set());
    if (selectedEvent) { loadStats(selectedEvent.id); loadActivity(selectedEvent.id); }
    setCheckingIn(null);
  };

  // --- Gate quick-add: walk-ins created live, immediately searchable ---
  const handleQuickAdd = async () => {
    if (!selectedEvent || !qaName.trim() || qaBusy) return;
    setQaBusy(true);
    setQaMsg(null);
    setError("");
    try {
      const res = await apiClient<{ guest: GuestResult }>(
        `/scanner/events/${selectedEvent.id}/guests/quick-add`,
        { method: "POST", body: { name: qaName, phone: qaPhone || undefined, email: qaEmail || undefined, category: qaCategory || undefined } }
      );
      const g = { ...res.guest, checked_in: false };
      setManualResults((prev) => [g, ...prev]);
      setQaMsg({ ok: true, text: `${g.name} added: ready to check in` });
      setQaName(""); setQaPhone(""); setQaEmail(""); setQaCategory("");
      if (selectedEvent) loadStats(selectedEvent.id);
      if (qaCheckin) await handleManualCheckin(g);
    } catch (err: any) { setQaMsg({ ok: false, text: err.message || "Could not add guest" }); }
    setQaBusy(false);
  };

  // --- Gate bulk upload: .xlsx/.csv parsed in-browser, auto-formatted ---
  const pickColumn = (row: Record<string, any>, names: string[]): string => {
    for (const [k, v] of Object.entries(row)) {
      if (names.includes(k.trim().toLowerCase())) return String(v ?? "").trim();
    }
    return "";
  };

  const handleBulkFile = async (file: File) => {
    setBulkMsg(null);
    setBulkRows([]);
    setBulkSkipped(0);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
      const rows: { name: string; phone: string; email: string; category: string }[] = [];
      let skipped = 0;
      for (const row of json) {
        const name = pickColumn(row, ["name", "full name", "guest name", "guest", "attendee", "fullname"]);
        if (!name) { skipped++; continue; }
        rows.push({
          name,
          phone: pickColumn(row, ["phone", "phone number", "mobile", "tel", "telephone", "phone_number"]),
          email: pickColumn(row, ["email", "email address", "e-mail", "mail"]),
          category: pickColumn(row, ["category", "ticket type", "type", "pass"]),
        });
      }
      setBulkRows(rows);
      setBulkSkipped(skipped);
      if (!rows.length) setBulkMsg({ ok: false, text: "No usable names found: need a Name column" });
    } catch { setBulkMsg({ ok: false, text: "Could not read that file (use .xlsx or .csv)" }); }
  };

  const handleBulkUpload = async () => {
    if (!selectedEvent || !bulkRows.length || bulkBusy) return;
    setBulkBusy(true);
    setBulkMsg(null);
    setError("");
    try {
      const res = await apiClient<{ added: number; skipped: { row: number; reason: string }[] }>(
        `/scanner/events/${selectedEvent.id}/guests/bulk-add`,
        { method: "POST", body: { guests: bulkRows.slice(0, 500) } }
      );
      const skipNote = res.skipped.length ? ` (${res.skipped.length} skipped)` : "";
      setBulkMsg({ ok: true, text: `Added ${res.added} guest${res.added !== 1 ? "s" : ""}${skipNote}: searchable now` });
      setBulkRows([]);
      setBulkSkipped(0);
      if (selectedEvent) { loadStats(selectedEvent.id); loadActivity(selectedEvent.id); }
    } catch (err: any) { setBulkMsg({ ok: false, text: err.message || "Bulk upload failed" }); }
    setBulkBusy(false);
  };

  const handleUndoCheckin = async (guest: GuestResult) => {
    setCheckingIn(guest.id);
    try {
      const res = await apiClient<any>("/scanner/checkin/undo", { method: "POST", body: { guest_id: guest.id } });
      showToast(res.message || "Check-in reversed", res.status === "noop" ? "error" : "success");
      if (res.status === "undone") {
        setManualResults((prev) => prev.map((g) => g.id === guest.id ? { ...g, checked_in: false } : g));
      }
      if (selectedEvent) { loadStats(selectedEvent.id); loadActivity(selectedEvent.id); }
    } catch (err: any) { showToast(err.message || "Undo failed", "error"); }
    setCheckingIn(null);
  };

  const formatDateTime = (isoString: string | null): string => {
    if (!isoString) return "";
    const d = new Date(isoString);
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const day = days[d.getDay()];
    const month = months[d.getMonth()];
    const date = d.getDate();
    const year = d.getFullYear();
    const hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const h12 = hours % 12 || 12;
    const suffix = date === 1 || date === 21 || date === 31 ? "st" : date === 2 || date === 22 ? "nd" : date === 3 || date === 23 ? "rd" : "th";
    return `${day}, ${month} ${date}${suffix} ${year} ${h12}:${minutes} ${ampm}`;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode === "manual" && e.key === "Escape") { setManualResults([]); setManualQuery(""); }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); document.getElementById("manual-search-input")?.focus(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode]);

  const handleLogout = async () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    setShowLogoutConfirm(false);
    localStorage.removeItem("accreditation_event_id");
    logout();
    router.push("/accreditation");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  const ToastComponent = () => {
    if (!toast) return null;
    return (
      <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg text-white text-sm font-semibold transition z-50 flex items-center gap-2 ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
        {toast.type === "success" ? <Check className="w-4 h-4 flex-shrink-0" /> : <X className="w-4 h-4 flex-shrink-0" />}
        {toast.message}
      </div>
    );
  };

  if (events.length === 0 && initialLoadDone) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] text-white flex flex-col">
        <header className="border-b border-white/10 bg-[#0D1B2A]/95 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image src="/logo-mark.png" alt="" width={366} height={372} className="h-14 w-auto object-contain" />
              <Image src="/logo-text.png" alt="Accredit Interactive" width={594} height={152} className="h-10 w-auto object-contain" />
            </div>
            <button onClick={handleLogout} className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold transition min-h-[44px]">
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
              <Camera className="w-8 h-8 text-white/20" />
            </div>
            <h2 className="text-xl font-bold mb-2">No Events Available</h2>
            <p className="text-white/50 text-sm leading-relaxed">This account has no events to check guests into. Sign in with an organizer account that has events.</p>
            <div className="flex flex-col sm:flex-row gap-3 mt-6 justify-center">
              <button onClick={handleLogout} className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 font-semibold text-sm transition min-h-[44px]">Sign Out</button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const renderHeader = () => (
    <header className="border-b border-white/10 bg-[#0D1B2A]/95 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">

          <Image src="/logo-mark.png" alt="" width={366} height={372} className="h-10 sm:h-12 w-auto object-contain flex-shrink-0" />
          <Image src="/logo-text.png" alt="Accredit Interactive" width={594} height={152} className="h-7 sm:h-8 w-auto object-contain flex-shrink-0" />
        </div>
        <button onClick={handleLogout} className="flex items-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold transition min-h-[44px] flex-shrink-0 shadow-lg shadow-teal-500/30">
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );

  const renderEventStats = () => (
    <div className="mb-6 rounded-xl bg-white/5 border border-white/10 p-4">
      <div className="flex flex-col gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1">Event</p>
          <p className="text-lg sm:text-xl font-bold truncate">{selectedEvent.title}</p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/50 flex items-center gap-2">
              <Check className="w-4 h-4 text-green-400" />
              {stats.checked_in} / {stats.total_guests} checked in
            </p>
            <p className="text-sm font-semibold text-white">{checkInPercentage}%</p>
          </div>
          <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-teal-500 to-teal-600 transition-all duration-500 rounded-full" style={{ width: `${checkInPercentage}%` }} />
          </div>
        </div>
        {selectedEvent?.id === NBC_EVENT_ID && (
          <div className="pt-3 border-t border-white/10">
            <p className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-2">Accreditation Location</p>
            <div className="flex flex-wrap gap-1.5">
              {LOCATION_OPTIONS.map((loc) => (
                <button
                  key={loc}
                  onClick={() => { setSelectedLocation(loc); setSelectedSubLocation(null); }}
                  className={`py-2 px-2.5 rounded-xl text-[10px] font-bold transition min-h-[36px] ${
                    selectedLocation === loc
                      ? "bg-teal-600 text-white shadow-lg shadow-teal-500/30"
                      : "bg-white/10 text-white/50 hover:bg-white/20 hover:text-white/80"
                  }`}
                >
                  {loc === "Airport" && <Plane className="w-3 h-3 mr-1 inline" />}
                  {(loc.startsWith("Abuja Continental") || loc.startsWith("Transcorp")) && <Bus className="w-3 h-3 mr-1 inline" />}
                  {loc === "ICC" && <MapPin className="w-3 h-3 mr-1 inline" />}
                  {loc}
                </button>
              ))}
            </div>
            {selectedLocation === "Airport" && (
              <div className="mt-2">
                <select
                  value={selectedSubLocation || ""}
                  onChange={(e) => setSelectedSubLocation(e.target.value || null)}
                  className="w-full bg-white/10 border border-teal-500/50 rounded-lg px-3 py-2.5 text-sm text-white cursor-pointer appearance-none"
                  style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", backgroundSize: "18px" }}
                >
                  <option value="" className="bg-[#1a2940]">Select destination...</option>
                  {AIRPORT_SUBS.map((sub) => (
                    <option key={sub} value={sub} className="bg-[#1a2940]">{sub}</option>
                  ))}
                </select>
              </div>
            )}
            {selectedLocation === "ICC" && (
              <div className="mt-2">
                <select
                  value={selectedSubLocation || ""}
                  onChange={(e) => setSelectedSubLocation(e.target.value || null)}
                  className="w-full bg-white/10 border border-teal-500/50 rounded-lg px-3 py-2.5 text-sm text-white cursor-pointer appearance-none"
                  style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", backgroundSize: "18px" }}
                >
                  <option value="" className="bg-[#1a2940]">Select destination...</option>
                  {ICC_SUBS.map((sub) => (
                    <option key={sub} value={sub} className="bg-[#1a2940]">{sub}</option>
                  ))}
                </select>
              </div>
            )}
            {selectedLocation && selectedLocation !== "Abuja Continental" && selectedLocation !== "Transcorp" && selectedLocation !== "Airport" && selectedLocation !== "ICC" && (
              <div className="mt-2">
                <select
                  value={selectedSubLocation || ""}
                  onChange={(e) => setSelectedSubLocation(e.target.value || null)}
                  className="w-full bg-white/10 border border-teal-500/50 rounded-lg px-3 py-2.5 text-sm text-white cursor-pointer appearance-none"
                  style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", backgroundSize: "18px" }}
                >
                  <option value="" className="bg-[#1a2940]">Select destination...</option>
                  {(selectedLocation.startsWith("Abuja Continental") ? AC_SUBS : TRANSCORP_SUBS).map((sub) => (
                    <option key={sub} value={sub} className="bg-[#1a2940]">{sub}</option>
                  ))}
                </select>
              </div>
            )}
            {!selectedLocation && (
              <p className="text-[10px] text-amber-400/80 mt-2 text-center">Select a location before scanning</p>
            )}
            {selectedLocation && !selectedSubLocation && (
              <p className="text-[10px] text-amber-400/80 mt-2 text-center">Select a destination</p>
            )}
          </div>
        )}
        {events.length > 1 && (
          <div className="pt-2 border-t border-white/10">
            <EventDropdown events={filteredEvents} selectedEvent={selectedEvent} onEventChange={handleEventChange} label="Change Event" />
          </div>
        )}
      </div>
    </div>
  );

  const renderActivitySidebar = () => (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-white/60 flex items-center gap-2">
          <Clock className="w-4 h-4 text-teal-500" />
          Checked In Guests
        </h2>
        <div className="flex items-center gap-2">
          {activityLive && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-semibold text-green-400">LIVE</span>
            </div>
          )}
          {lastActivityRefresh && (
            <span className="text-[10px] text-white/40">{lastActivityRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          )}
        </div>
      </div>
      <div className="rounded-2xl bg-white/5 border border-white/10 p-4 min-h-[500px] flex flex-col lg:sticky lg:top-20">
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={activitySearch}
            onChange={(e) => handleActivitySearch(e.target.value)}
            placeholder="Search checked-in guests..."
            className="w-full rounded-xl bg-white/10 border border-white/20 pl-9 pr-3 py-2.5 text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
          />
        </div>
        {activityLoading && activity.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center text-white/30">
            <div><Loader className="w-6 h-6 animate-spin mx-auto mb-2" /><p className="text-sm">Loading activity...</p></div>
          </div>
        ) : activity.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center text-white/30">
            <div><User className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-sm">{activitySearch ? "No matching check-ins" : "No check-ins yet"}</p><p className="text-xs mt-1">{activitySearch ? "Try a different search term" : "Guest check-ins will appear here"}</p></div>
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto flex-1">
            {activity.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 p-3">
                <div className="w-9 h-9 rounded-full bg-teal-600/30 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-teal-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{item.guest_name}</p>
                  <p className="text-xs text-white/50 truncate">{item.guest_email || item.guest_phone || "\u2014"}</p>
                  {item.invited_by && <p className="text-[10px] text-purple-400/70 truncate mt-0.5">{selectedEvent?.id === 71 ? item.invited_by : `Host: ${item.invited_by}`}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-900/40 text-green-400 text-[10px] font-medium">
                    <Check className="w-2.5 h-2.5" /> In
                  </div>
                  {item.location && <p className="text-[10px] text-teal-400/80 mt-0.5">{item.location}</p>}
                  <p className="text-[10px] text-white/40 mt-0.5">{formatDateTime(item.checked_in_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {activityTotal > 20 && (
          <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-white/10">
            <button onClick={() => handleActivityPage(activityPage - 1)} disabled={activityPage <= 1} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 text-xs font-semibold transition min-h-[36px]">Previous</button>
            <span className="text-xs text-white/50">Page {activityPage} of {Math.ceil(activityTotal / 20)}</span>
            <button onClick={() => handleActivityPage(activityPage + 1)} disabled={activityPage >= Math.ceil(activityTotal / 20)} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 text-xs font-semibold transition min-h-[36px]">Next</button>
          </div>
        )}
      </div>
    </div>
  );

  // --- MODE: scanner ---
  const renderScanner = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {renderEventStats()}
        {(selectedEvent?.id === NBC_EVENT_ID && !selectedLocation) || (selectedEvent?.id === NBC_EVENT_ID && needsSubLocation(selectedLocation) && !selectedSubLocation) ? (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center">
            <MapPin className="w-10 h-10 text-teal-500/60 mx-auto mb-3" />
            <p className="text-sm text-white/60 font-medium">Select a location{needsSubLocation(selectedLocation) ? " and destination" : ""} above before scanning</p>
          </div>
        ) : (
        <>
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wide text-white/60 mb-3 flex items-center gap-2">
            <QrCode className="w-4 h-4 text-teal-500" />
            Live Scanner
          </h2>
          <QRScanner
            onScan={handleVerify}
            onError={setError}
            onStart={() => { setError(""); setScanResult(null); }}
            onStop={() => {}}
            scanningDisabled={false}
          />
        </div>
        {scanResult && (
          <>
            <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setScanResult(null)} />
            <div className="fixed top-0 left-0 right-0 z-40 p-4 lg:static lg:p-0">
              <div className={`rounded-2xl border p-4 sm:p-5 lg:rounded-b-none lg:border-b-0 ${
                scanResult.status === "approved" ? "bg-green-900/70 border-green-500/60" :
                scanResult.status === "found" ? "bg-blue-900/70 border-blue-500/60" :
                scanResult.status === "declined" ? "bg-amber-900/70 border-amber-500/60" :
                "bg-red-900/70 border-red-500/60"
              }`} style={{ marginTop: "60px" }}>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {scanResult.status === "approved" ? <Check className="w-5 h-5 text-green-400 flex-shrink-0" /> :
                     scanResult.status === "found" ? <User className="w-5 h-5 text-blue-400 flex-shrink-0" /> :
                     scanResult.status === "declined" ? <X className="w-5 h-5 text-amber-400 flex-shrink-0" /> :
                     <X className="w-5 h-5 text-red-400 flex-shrink-0" />}
                    <p className="font-bold text-base sm:text-lg">
                      {scanResult.status === "approved" ? "Checked In" :
                       scanResult.status === "found" ? "Guest Found" :
                       scanResult.status === "declined" ? "Invitation Declined" :
                       scanResult.status === "error" ? "Error" : scanResult.message}
                    </p>
                  </div>
                  {scanResult.guest && (
                    <div className="space-y-2 bg-white/10 rounded-lg p-3 border border-white/20">
                      <div>
                        <p className="text-xs text-white/50 uppercase tracking-wide">Name</p>
                        <p className="font-semibold text-white break-words">{scanResult.guest.name}</p>
                      </div>
                      {scanResult.guest.phone && (
                        <div>
                          <p className="text-xs text-white/50 uppercase tracking-wide">Phone</p>
                          <p className="text-sm text-white/80 break-all">{scanResult.guest.phone}</p>
                        </div>
                      )}
                      {scanResult.guest.email && (
                        <div>
                          <p className="text-xs text-white/50 uppercase tracking-wide">Email</p>
                          <p className="text-sm text-white/80 break-all">{scanResult.guest.email}</p>
                        </div>
                      )}
                      {scanResult.guest.invited_by && (
                        <div>
                          <p className="text-xs text-white/50 uppercase tracking-wide">{selectedEvent?.id === 71 ? "Category" : "Host"}</p>
                          <p className="text-sm font-semibold text-yellow-400">{scanResult.guest.invited_by}</p>
                        </div>
                      )}
                      {scanResult.guest.category && (
                        <div>
                          <p className="text-xs text-white/50 uppercase tracking-wide">Category</p>
                          <p className="text-sm font-bold text-teal-300">{scanResult.guest.category}</p>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t border-white/10">
                        <div>
                          <p className="text-xs text-white/50 uppercase tracking-wide">RSVP Status</p>
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium mt-1 ${
                            scanResult.guest.rsvp_status === "accepted" ? "bg-green-900/50 text-green-400" :
                            scanResult.guest.rsvp_status === "declined" ? "bg-red-900/50 text-red-400" :
                            "bg-amber-900/50 text-amber-400"
                          }`}>{scanResult.guest.rsvp_status || "pending"}</span>
                        </div>
                        {scanResult.guest.checked_in && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-blue-900/50 text-blue-400">
                            <Check className="w-3 h-3" /> Already Checked In
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap pt-2">
                    {scanResult.status === "found" && !scanResult.guest?.checked_in && (
                      <button onClick={handleScanCheckin} className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 font-semibold text-sm transition min-h-[44px]">Check In</button>
                    )}
                    <button onClick={() => setScanResult(null)} className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 font-semibold text-sm transition min-h-[44px]">{scanResult.status === "found" ? "Cancel" : "Dismiss"}</button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
        </>
        )}
      </div>
      <div className="lg:col-span-1">
        {renderActivitySidebar()}
      </div>
    </div>
  );

  // --- MODE: manual ---
  const renderManual = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {renderEventStats()}
        {(selectedEvent?.id === NBC_EVENT_ID && !selectedLocation) || (selectedEvent?.id === NBC_EVENT_ID && needsSubLocation(selectedLocation) && !selectedSubLocation) ? (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center">
            <MapPin className="w-10 h-10 text-teal-500/60 mx-auto mb-3" />
            <p className="text-sm text-white/60 font-medium">Select a location{needsSubLocation(selectedLocation) ? " and destination" : ""} above before using manual entry</p>
          </div>
        ) : (
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wide text-white/60 mb-3 flex items-center gap-2">
            <Search className="w-4 h-4 text-teal-500" />
            Manual Entry
          </h2>
          <div className="flex gap-2 mb-3">
            {[["search", "Search"], ["add", "Quick add"], ["bulk", "Bulk upload"]].map(([v, l]) => (
              <button key={v} onClick={() => setManualTab(v as any)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${manualTab === v ? "bg-teal-600 text-white" : "bg-white/10 text-white/60 hover:bg-white/20"}`}>{l}</button>
            ))}
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
          {manualTab === "add" ? (
            <div className="space-y-3">
              <input
                value={qaName}
                onChange={(e) => setQaName(e.target.value)}
                placeholder="Full name *"
                className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  value={qaPhone}
                  onChange={(e) => setQaPhone(e.target.value)}
                  placeholder="Phone (optional)"
                  className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                />
                <input
                  value={qaEmail}
                  onChange={(e) => setQaEmail(e.target.value)}
                  placeholder="Email (optional)"
                  className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                />
              </div>
              <input
                value={qaCategory}
                onChange={(e) => setQaCategory(e.target.value)}
                placeholder="Category (optional, e.g. General Access)"
                className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
              />
              <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
                <input type="checkbox" checked={qaCheckin} onChange={(e) => setQaCheckin(e.target.checked)} className="w-4 h-4 rounded cursor-pointer" />
                Check in immediately after adding
              </label>
              <button onClick={handleQuickAdd} disabled={qaBusy || !qaName.trim()} className="w-full px-4 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 font-semibold text-sm transition min-h-[44px]">
                {qaBusy ? "Adding..." : "Add guest"}
              </button>
              {qaMsg && <p className={`text-xs text-center font-medium ${qaMsg.ok ? "text-green-400" : "text-red-400"}`}>{qaMsg.text}</p>}
            </div>
          ) : manualTab === "bulk" ? (
            <div className="space-y-3">
              <p className="text-xs text-white/50 leading-relaxed">
                Upload an <span className="text-white/80 font-semibold">.xlsx or .csv</span> with
                <span className="text-white/80 font-semibold"> name, phone, email, category </span>
                columns. Names are required: phones and emails are auto-formatted, blank rows skipped.
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBulkFile(f); e.target.value = ""; }}
                className="w-full text-xs text-white/60 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-600 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-teal-500 file:cursor-pointer"
              />
              {bulkRows.length > 0 && (
                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <p className="text-xs font-semibold text-white">
                    {bulkRows.length} guest{bulkRows.length !== 1 ? "s" : ""} ready{bulkSkipped > 0 ? ` (${bulkSkipped} blank skipped)` : ""}
                  </p>
                  <div className="mt-2 space-y-1">
                    {bulkRows.slice(0, 3).map((r, i) => (
                      <p key={i} className="text-xs text-white/50 truncate">{r.name}{r.email ? ` · ${r.email}` : ""}{r.phone ? ` · ${r.phone}` : ""}</p>
                    ))}
                    {bulkRows.length > 3 && <p className="text-xs text-white/30">…and {bulkRows.length - 3} more</p>}
                  </div>
                  <button onClick={handleBulkUpload} disabled={bulkBusy} className="mt-3 w-full px-4 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 font-semibold text-sm transition min-h-[44px]">
                    {bulkBusy ? "Uploading..." : `Upload ${bulkRows.length} guests`}
                  </button>
                </div>
              )}
              {bulkMsg && <p className={`text-xs text-center font-medium ${bulkMsg.ok ? "text-green-400" : "text-red-400"}`}>{bulkMsg.text}</p>}
            </div>
          ) : (
          <>
            <div className="flex gap-2 flex-col sm:flex-row">
              <input
                id="manual-search-input"
                value={manualQuery}
                onChange={(e) => setManualQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
                placeholder="Search name, email, phone, or code..."
                className="flex-1 min-w-0 rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
              />
              <button onClick={handleManualSearch} disabled={searching || !manualQuery.trim()} className="px-4 sm:px-5 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 font-semibold text-sm transition flex items-center gap-2 min-h-[44px] flex-shrink-0 whitespace-nowrap">
                {searching ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span>Search</span>
              </button>
            </div>
            {manualResults.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
                <button onClick={() => setStatusFilter(null)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${!statusFilter ? "bg-teal-600 text-white" : "bg-white/10 text-white/60 hover:bg-white/20"}`}>All ({manualResults.length})</button>
                <button onClick={() => setStatusFilter("pending")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${statusFilter === "pending" ? "bg-amber-600 text-white" : "bg-white/10 text-white/60 hover:bg-white/20"}`}>Pending</button>
                <button onClick={() => setStatusFilter("accepted")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${statusFilter === "accepted" ? "bg-green-600 text-white" : "bg-white/10 text-white/60 hover:bg-white/20"}`}>Accepted</button>
                <button onClick={() => setStatusFilter("not-checked-in")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${statusFilter === "not-checked-in" ? "bg-blue-600 text-white" : "bg-white/10 text-white/60 hover:bg-white/20"}`}>Not Checked In</button>
              </div>
            )}
            {filteredManualResults.length > 0 && selectedManualGuests.size > 0 && (
              <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-3 mt-3">
                <p className="text-xs text-white/60">{selectedManualGuests.size} selected</p>
                <button onClick={handleBatchCheckin} disabled={checkingIn !== null} className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-40 text-xs font-semibold transition flex items-center gap-1.5 min-h-[44px]">
                  {checkingIn === -1 ? <Loader className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Check In Selected
                </button>
              </div>
            )}
            {filteredManualResults.length > 0 && (
              <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                {filteredManualResults.map((g) => (
                  <div key={g.id} className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 p-3 hover:bg-white/10 transition">
                    {!g.checked_in && g.rsvp_status !== "declined" && (
                      <input type="checkbox" checked={selectedManualGuests.has(g.id)} onChange={(e) => { const n = new Set(selectedManualGuests); if (e.target.checked) n.add(g.id); else n.delete(g.id); setSelectedManualGuests(n); }} className="w-4 h-4 rounded cursor-pointer flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{g.name}</p>
                      <div className="flex items-center gap-2 text-xs text-white/50 mt-0.5">
                        {g.email && <span className="truncate">{g.email}</span>}
                        {g.phone && <span className="hidden sm:inline">{g.phone}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${g.rsvp_status === "accepted" ? "bg-green-900/50 text-green-400" : g.rsvp_status === "declined" ? "bg-red-900/50 text-red-400" : "bg-amber-900/50 text-amber-400"}`}>{g.rsvp_status || "pending"}</span>
                        {g.invited_by && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-900/50 text-purple-400" title={selectedEvent?.id === 71 ? g.invited_by : `Host: ${g.invited_by}`}>{selectedEvent?.id === 71 ? g.invited_by : `Host: ${g.invited_by}`}</span>}
                        {g.category && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-900/60 text-teal-300" title={`Category: ${g.category}`}>{g.category}</span>}
                        {g.checked_in && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-900/50 text-blue-400"><Check className="w-2.5 h-2.5" /> Checked in</span>}
                      </div>
                    </div>
                    {!g.checked_in && g.rsvp_status !== "declined" && (
                      <button onClick={() => handleManualCheckin(g)} disabled={checkingIn === g.id} className="ml-1 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-40 text-xs font-semibold transition flex items-center gap-1 flex-shrink-0 min-h-[36px]">
                        {checkingIn === g.id ? <Loader className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        <span className="hidden sm:inline">Verify</span>
                      </button>
                    )}
                    {g.checked_in && (
                      <button onClick={() => handleUndoCheckin(g)} disabled={checkingIn === g.id} title="Reverse this check-in (e.g. wrong guest scanned)" className="ml-1 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-xs font-semibold transition flex items-center gap-1 flex-shrink-0 min-h-[36px]">
                        {checkingIn === g.id ? <Loader className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                        <span className="hidden sm:inline">Undo</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {manualQuery && !searching && filteredManualResults.length === 0 && (
              <p className="text-sm text-white/40 mt-3 text-center">No guests found matching filters</p>
            )}
            </>)}
          </div>
        </div>
        )}
      </div>
      <div className="lg:col-span-1">
        {renderActivitySidebar()}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0D1B2A] text-white flex flex-col">
      {renderHeader()}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 pb-24">
        {error && (
          <div className="mb-4 rounded-xl bg-red-900/50 border border-red-500/60 p-4 flex items-center gap-3 text-sm">
            <X className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="flex-1 text-white font-medium">{error}</span>
            <button onClick={() => setError("")} className="text-red-400 hover:text-red-300 flex-shrink-0 text-xs font-semibold whitespace-nowrap ml-2">Dismiss</button>
          </div>
        )}
        {!selectedEvent ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center text-white/40">
              <Camera className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Select an event</p>
              <p className="text-sm mt-1">Choose an event from the dropdown below</p>
              {events.length > 1 && (
                <div className="mt-6 w-full max-w-md">
                  <EventDropdown events={filteredEvents} selectedEvent={selectedEvent} onEventChange={handleEventChange} />
                </div>
              )}
            </div>
          </div>
        ) : mode === "scanner" ? (
          renderScanner()
        ) : (
          renderManual()
        )}
      </main>

      {/* Bottom Nav */}
      {selectedEvent && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0D1B2A]/95 backdrop-blur border-t border-white/10">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 px-4 py-2">
            <button
              onClick={() => { setMode("scanner"); setScanResult(null); setManualResults([]); }}
              className={`flex-1 max-w-xs flex flex-col items-center gap-0.5 py-2.5 rounded-xl text-xs font-semibold transition min-h-[52px] ${
                mode === "scanner"
                  ? "bg-teal-600/20 text-teal-400 border border-teal-500/40"
                  : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80 border border-transparent"
              }`}
            >
              <Scan className="w-5 h-5" />
              Live Scanner
            </button>
            <button
              onClick={() => { setMode("manual"); setScanResult(null); setManualResults([]); }}
              className={`flex-1 max-w-xs flex flex-col items-center gap-0.5 py-2.5 rounded-xl text-xs font-semibold transition min-h-[52px] ${
                mode === "manual"
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/40"
                  : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80 border border-transparent"
              }`}
            >
              <FileText className="w-5 h-5" />
              Manual Entry
            </button>
          </div>
        </div>
      )}

      <ToastComponent />

      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a2940] border border-white/20 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                <LogOut className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <p className="font-bold text-white">Sign Out</p>
                <p className="text-xs text-white/50">Are you sure you want to sign out?</p>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold transition min-h-[44px]">Cancel</button>
              <button onClick={confirmLogout} className="flex-1 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition min-h-[44px]">Yes, Sign Out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
