"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Download,
  Loader,
  MapPin,
  Printer,
  QrCode,
  RefreshCw,
  RotateCcw,
  Users,
} from "lucide-react";
import { apiClient, API_BASE } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/contexts/auth-context";

type HeadcountDay = {
  id: number;
  day_number: number;
  date: string;
  label: string | null;
  name: string;
  heading: string;
  start_time: string | null;
  is_today: boolean;
  accreditation_open: boolean;
  count: number;
};

type HeadcountStats = {
  headcount: true;
  event: {
    id: number;
    title: string;
    slug: string;
    venue: string | null;
    city: string | null;
    event_time: string | null;
    event_date: string | null;
    theme_color: string | null;
    target: number | null;
  };
  total: number;
  night_total: number;
  today_total: number;
  selected_day: HeadcountDay | null;
  days: HeadcountDay[];
  hourly: { hour: number; count: number }[];
  gates: { location: string; count: number }[];
  recent: {
    id: number;
    scanned_at: string | null;
    location: string;
    staff: string | null;
    day_id: number | null;
  }[];
  last_scan_at: string | null;
  target: number | null;
};

const FALLBACK_ACCENT = "#E31E24";

function dayDate(value: string) {
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? value : d;
}

function longDate(value: string) {
  const d = dayDate(value);
  if (typeof d === "string") return value;
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function shortDate(value: string) {
  const d = dayDate(value);
  if (typeof d === "string") return value;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function hourLabel(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}${suffix}`;
}

function timeLabel(value: string | null) {
  if (!value) return "No scans yet";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "No scans yet";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fullTime(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function HeadcountDashboard({ eventId }: { eventId: number | string }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const [stats, setStats] = useState<HeadcountStats | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undoTarget, setUndoTarget] = useState<number | "last" | null>(null);
  const [undoing, setUndoing] = useState(false);

  const accent = stats?.event.theme_color || FALLBACK_ACCENT;

  const load = useCallback(
    async (dayId?: number | null, silent = false) => {
      if (!silent) setRefreshing(true);
      try {
        const qs = dayId ? `?event_day_id=${dayId}` : "";
        const data = await apiClient<HeadcountStats>(`/headcount/events/${eventId}${qs}`);
        setStats(data);
        setError(null);
        if (dayId == null && data.selected_day?.id) setSelectedDayId(data.selected_day.id);
      } catch (err: any) {
        if (!silent) setError(err?.message || "Could not load the headcount dashboard.");
      } finally {
        if (!silent) {
          setRefreshing(false);
          setLoading(false);
        }
      }
    },
    [eventId]
  );

  useEffect(() => {
    load(selectedDayId);
  }, [load, selectedDayId]);

  useEffect(() => {
    const timer = setInterval(() => load(selectedDayId, true), 20000);
    return () => clearInterval(timer);
  }, [load, selectedDayId]);

  const nightsWithScans = useMemo(
    () => (stats?.days || []).filter((d) => d.count > 0),
    [stats]
  );

  const averagePerNight = nightsWithScans.length
    ? Math.round((stats?.total || 0) / nightsWithScans.length)
    : 0;

  const recentNights = useMemo(() => {
    if (!stats) return [];
    const active = stats.days.filter((d) => d.count > 0).slice(-6);
    if (
      stats.selected_day &&
      !active.some((d) => d.id === stats.selected_day?.id) &&
      stats.days.some((d) => d.id === stats.selected_day?.id)
    ) {
      active.push(stats.selected_day);
    }
    return active;
  }, [stats]);

  const peakHour = useMemo(() => {
    if (!stats?.hourly.length) return null;
    return stats.hourly.reduce((best, row) => (row.count > best.count ? row : best), stats.hourly[0]);
  }, [stats]);

  async function handleUndo(scanId?: number) {
    if (!isAdmin) return;
    setUndoing(true);
    try {
      const body: Record<string, unknown> = {};
      if (scanId) body.scan_id = scanId;
      else if (selectedDayId) body.event_day_id = selectedDayId;
      const data = await apiClient<HeadcountStats & { removed: boolean }>(
        `/headcount/events/${eventId}/undo`,
        { method: "POST", body }
      );
      setStats(data);
      setUndoTarget(null);
    } catch (err: any) {
      setError(err?.message || "Could not undo that scan.");
      setUndoTarget(null);
    } finally {
      setUndoing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader className="mx-auto h-7 w-7 animate-spin text-[#94a3b8]" />
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.28em] text-[#94a3b8]">
            Loading headcount
          </p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <Users className="mx-auto h-9 w-9 text-[#cbd5e1]" />
        <h2 className="mt-4 text-lg font-bold text-[#0D1B2A]">Headcount dashboard unavailable</h2>
        <p className="mt-2 text-sm text-[#64748b]">
          {error || "This dashboard belongs to another account."}
        </p>
        <Link
          href="/dashboard/events"
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-[#d9e2ec] px-4 py-2 text-sm font-semibold text-[#475569] hover:bg-[#f8f9fc]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to events
        </Link>
      </div>
    );
  }

  const selected = stats.selected_day;
  const maxHour = Math.max(...stats.hourly.map((h) => h.count), 1);
  const maxGate = Math.max(...stats.gates.map((g) => g.count), 1);
  const csvHref = `${API_BASE}/headcount/events/${eventId}/export.csv`;
  const qrHref = `${API_BASE}/headcount/events/${eventId}/qr.png?size=1200`;

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={isAdmin && undoTarget !== null}
        title="Undo this scan?"
        message="The scan is removed and the count goes down by one. Use this for a wristband scanned twice, or the poster scanned by mistake."
        confirmLabel={undoing ? "Removing..." : "Undo scan"}
        variant="warning"
        onConfirm={() => handleUndo(undoTarget === "last" ? undefined : (undoTarget as number))}
        onCancel={() => setUndoTarget(null)}
      />

      <div className="overflow-hidden rounded-2xl border border-[#e8edf2] bg-white shadow-sm">
        <div className="h-1.5 w-full" style={{ backgroundColor: accent }} />
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-white"
                style={{ backgroundColor: accent }}
              >
                Headcount
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#94a3b8]">
                Every scan is one guest
              </span>
            </div>
            <h1 className="mt-3 truncate text-2xl font-black text-[#0D1B2A] sm:text-3xl">
              {stats.event.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#64748b]">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {stats.event.venue}
                {stats.event.city ? `, ${stats.event.city}` : ""}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {selected ? longDate(selected.date) : "Every Monday"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => load(selectedDayId)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d9e2ec] px-3 text-xs font-bold text-[#475569] transition-colors hover:bg-[#f8f9fc]"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <Link
              href={`/dashboard/events/${eventId}/headcount/poster`}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d9e2ec] px-3 text-xs font-bold text-[#475569] transition-colors hover:bg-[#f8f9fc]"
            >
              <Printer className="h-3.5 w-3.5" />
              QR and poster
            </Link>
            <a
              href={csvHref}
              className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: accent }}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </a>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-[#e8edf2] bg-white p-4 shadow-sm sm:p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#94a3b8]">
            Total entries
          </p>
          <p className="mt-2 text-3xl font-black text-[#0D1B2A] sm:text-4xl">{stats.total}</p>
          <p className="mt-1 text-[11px] text-[#94a3b8]">Every night counted</p>
        </div>
        <div className="rounded-2xl border border-[#e8edf2] bg-white p-4 shadow-sm sm:p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#94a3b8]">
            {selected?.is_today ? "Tonight" : "Selected night"}
          </p>
          <p className="mt-2 text-3xl font-black sm:text-4xl" style={{ color: accent }}>
            {stats.night_total}
          </p>
          <p className="mt-1 text-[11px] text-[#94a3b8]">
            {selected ? shortDate(selected.date) : "No night selected"}
          </p>
        </div>
        <div className="rounded-2xl border border-[#e8edf2] bg-white p-4 shadow-sm sm:p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#94a3b8]">
            Last scan
          </p>
          <p className="mt-2 text-xl font-black text-[#0D1B2A] sm:text-2xl">
            {timeLabel(stats.last_scan_at)}
          </p>
          <p className="mt-1 text-[11px] text-[#94a3b8]">
            {stats.recent[0]?.location || "Main gate"}
          </p>
        </div>
        <div className="rounded-2xl border border-[#e8edf2] bg-white p-4 shadow-sm sm:p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#94a3b8]">
            Average night
          </p>
          <p className="mt-2 text-3xl font-black text-[#0D1B2A] sm:text-4xl">{averagePerNight}</p>
          <p className="mt-1 text-[11px] text-[#94a3b8]">
            Across {nightsWithScans.length} {nightsWithScans.length === 1 ? "night" : "nights"}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#e8edf2] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#94a3b8]">
              Choose a night
            </p>
            <p className="mt-1 text-sm text-[#64748b]">
              {stats.today_total} in tonight so far. Switch nights to review any Monday.
            </p>
          </div>
          <select
            value={selectedDayId ?? ""}
            onChange={(e) => setSelectedDayId(e.target.value ? Number(e.target.value) : null)}
            className="h-10 w-full rounded-xl border border-[#d9e2ec] bg-white px-3 text-sm font-semibold text-[#0D1B2A] sm:w-64"
          >
            {stats.days.map((d) => (
              <option key={d.id} value={d.id}>
                {shortDate(d.date)} ({d.count})
              </option>
            ))}
          </select>
        </div>

        {recentNights.length > 0 && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {recentNights.map((d) => {
              const active = selectedDayId === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => setSelectedDayId(d.id)}
                  className="flex-shrink-0 rounded-xl border px-3 py-2 text-left transition-colors"
                  style={{
                    borderColor: active ? accent : "#e8edf2",
                    backgroundColor: active ? `${accent}0F` : "#ffffff",
                  }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#94a3b8]">
                    {shortDate(d.date)}
                  </p>
                  <p className="text-lg font-black text-[#0D1B2A]">{d.count}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-[#e8edf2] bg-white p-4 shadow-sm sm:p-5 lg:col-span-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#94a3b8]">
              Arrivals by hour
            </p>
            {peakHour && peakHour.count > 0 && (
              <p className="text-[11px] font-semibold text-[#64748b]">
                Peak {hourLabel(peakHour.hour)} ({peakHour.count})
              </p>
            )}
          </div>
          <div className="mt-5 flex h-44 items-end gap-1.5 sm:gap-2">
            {stats.hourly.map((row) => (
              <div key={row.hour} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[10px] font-bold text-[#94a3b8]">
                  {row.count > 0 ? row.count : ""}
                </span>
                <div
                  className="w-full rounded-t-md transition-all"
                  style={{
                    height: `${Math.max(3, Math.round((row.count / maxHour) * 100))}%`,
                    backgroundColor: row.count > 0 ? accent : "#eef2f7",
                    minHeight: 3,
                  }}
                />
                <span className="text-[9px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                  {hourLabel(row.hour)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#e8edf2] bg-white p-4 shadow-sm sm:p-5 lg:col-span-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#94a3b8]">
            Gates
          </p>
          {stats.gates.length === 0 ? (
            <p className="mt-6 text-sm text-[#94a3b8]">No scans on this night yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {stats.gates.map((gate) => (
                <div key={gate.location}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0D1B2A]">{gate.location}</span>
                    <span className="font-bold text-[#64748b]">{gate.count}</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#eef2f7]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(4, Math.round((gate.count / maxGate) * 100))}%`,
                        backgroundColor: accent,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-[#e8edf2] bg-white shadow-sm lg:col-span-3">
          <div className="flex items-center justify-between border-b border-[#eef2f7] px-4 py-3 sm:px-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#94a3b8]">
              Recent entries
            </p>
            {isAdmin && (
              <button
                onClick={() => setUndoTarget("last")}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#64748b] hover:text-[#0D1B2A]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Undo last scan
              </button>
            )}
          </div>
          {stats.recent.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-[#94a3b8]">
              No entries recorded on this night yet.
            </p>
          ) : (
            <ul className="divide-y divide-[#f1f5f9]">
              {stats.recent.slice(0, 12).map((scan, index) => (
                <li key={scan.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                  <span className="w-8 flex-shrink-0 text-[11px] font-bold text-[#cbd5e1]">
                    #{stats.night_total - index}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#0D1B2A]">
                      {timeLabel(scan.scanned_at)}
                    </p>
                    <p className="truncate text-[11px] text-[#94a3b8]">
                      {scan.location}
                      {scan.staff ? ` · ${scan.staff}` : ""}
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => setUndoTarget(scan.id)}
                      title="Undo this scan"
                      className="rounded-lg p-2 text-[#94a3b8] transition-colors hover:bg-[#fef2f2] hover:text-red-500"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-[#e8edf2] bg-white p-5 shadow-sm lg:col-span-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#94a3b8]">
            Wristband QR
          </p>
          <div className="mt-4 flex justify-center rounded-xl border border-[#eef2f7] p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrHref}
              alt="OBI's House wristband QR code"
              className="h-40 w-40"
            />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-[#94a3b8]">
            One QR, printed on every wristband. Guests scan in at the gate and the
            count moves up by one each time.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <a
              href={`${qrHref}&download=1`}
              download={`${stats.event.slug}-wristband-qr.png`}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#d9e2ec] text-xs font-bold text-[#475569] hover:bg-[#f8f9fc]"
            >
              <QrCode className="h-3.5 w-3.5" />
              Download QR
            </a>
            <Link
              href={`/dashboard/events/${eventId}/headcount/poster`}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[#d9e2ec] text-xs font-bold text-[#475569] hover:bg-[#f8f9fc]"
            >
              <Printer className="h-3.5 w-3.5" />
              Print the poster
            </Link>
          </div>
          {stats.last_scan_at && (
            <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-[#cbd5e1]">
              Last scan {fullTime(stats.last_scan_at)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
