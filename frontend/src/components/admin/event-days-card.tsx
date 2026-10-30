"use client";

import { useCallback, useEffect, useState } from "react";
import { Calendar, Loader, Plus, Trash2, Eye, EyeOff, FileText } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

/**
 * Multi-day control for one event.
 *
 * An event with no days here is a single-day event and nothing changes for it.
 * Adding a day switches the gate and the reports to per-day behaviour, and every
 * switch on this card (accreditation open/closed, day visible/hidden) applies on
 * the next scan with no deploy.
 */

type Day = {
  id: number;
  day_number: number;
  date: string;
  label: string | null;
  name: string;
  heading: string;
  start_time: string | null;
  end_time: string | null;
  accreditation_open: boolean;
  is_active: boolean;
  is_today: boolean;
  note: string | null;
  checked_in?: number;
};

type Summary = {
  event_id: number;
  event_title: string;
  event_date: string | null;
  multi_day: boolean;
  total_guests: number;
  total_checked_in: number;
  days: Day[];
};

type Props = {
  eventId: number;
  eventDate?: string | null;
};

function prettyDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function EventDaysCard({ eventId, eventDate }: Props) {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [startDate, setStartDate] = useState("");
  const [count, setCount] = useState("2");
  const [label, setLabel] = useState("");

  const [singleDate, setSingleDate] = useState("");
  const [singleLabel, setSingleLabel] = useState("");
  const [showSingle, setShowSingle] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<Day | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient<Summary>(`/admin/events/${eventId}/days`);
      setData(res);
    } catch (err: any) {
      setMsg({ ok: false, text: err.message || "Could not load the days for this event" });
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    setMsg(null);
    setData(null);
    setShowSingle(false);
    const fallback = (eventDate ? String(eventDate).slice(0, 10) : "") || todayIso();
    setStartDate(fallback);
    setSingleDate(fallback);
    setCount("2");
    setLabel("");
    setSingleLabel("");
    load();
  }, [eventId, eventDate, load]);

  const apply = (res: Summary, text: string) => {
    setData(res);
    setMsg({ ok: true, text });
  };

  const bulkAdd = async () => {
    if (!startDate) { setMsg({ ok: false, text: "Pick a start date" }); return; }
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiClient<Summary & { added: number; skipped: string[] }>(
        `/admin/events/${eventId}/days/bulk`,
        { method: "POST", body: { start_date: startDate, count: Number(count) || 1, label: label.trim() || null } }
      );
      const skipped = res.skipped?.length ? ` (${res.skipped.length} already scheduled)` : "";
      apply(res, `${res.added} day${res.added === 1 ? "" : "s"} scheduled${skipped}`);
      setLabel("");
    } catch (err: any) {
      setMsg({ ok: false, text: err.message || "Could not schedule the days" });
    }
    setBusy(false);
  };

  const addOne = async () => {
    if (!singleDate) { setMsg({ ok: false, text: "Pick a date" }); return; }
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiClient<Summary & { day: Day }>(`/admin/events/${eventId}/days`, {
        method: "POST",
        body: { date: singleDate, label: singleLabel.trim() || null },
      });
      apply(res, `${res.day.heading} added`);
      setSingleLabel("");
      setShowSingle(false);
    } catch (err: any) {
      setMsg({ ok: false, text: err.message || "Could not add that day" });
    }
    setBusy(false);
  };

  const patch = async (day: Day, body: Record<string, unknown>, text: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiClient<Summary>(`/admin/events/${eventId}/days/${day.id}`, { method: "PATCH", body });
      apply(res, text);
    } catch (err: any) {
      setMsg({ ok: false, text: err.message || "Could not update that day" });
    }
    setBusy(false);
  };

  const remove = async (day: Day) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiClient<Summary>(`/admin/events/${eventId}/days/${day.id}`, { method: "DELETE" });
      apply(
        res,
        res.multi_day
          ? `${day.heading} removed`
          : `${day.heading} removed. This event is back to a single day (${res.event_date || "its event date"}).`
      );
    } catch (err: any) {
      setMsg({ ok: false, text: err.message || "Could not remove that day" });
    }
    setBusy(false);
  };

  const days = data?.days || [];
  const multi = !!data?.multi_day;

  return (
    <div className="mt-4 pt-4 border-t-2 border-[#e8edf2]">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h3 className="text-sm font-black text-[#0D1B2A] flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#1ABC9C]" />
            Event Days
          </h3>
          <p className="text-xs text-[#94a3b8] mt-0.5">
            Accreditation and reports are counted per day. A day can be closed without touching the others.
          </p>
        </div>
        <span
          className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-black ${
            multi ? "bg-[#1ABC9C]/10 text-[#16A085]" : "bg-slate-100 text-slate-500"
          }`}
        >
          {loading ? "..." : multi ? `${days.length}-DAY EVENT` : "SINGLE DAY"}
        </span>
      </div>

      {!multi && !loading && (
        <p className="text-xs text-[#64748b] bg-[#f8f9fc] border border-[#e8edf2] rounded-xl px-3 py-2.5 mt-3">
          This event runs on a single day{data?.event_date ? ` (${prettyDate(data.event_date)})` : ""}. Its gate and
          reports use that date. Schedule more than one day below only if it runs across several dates.
        </p>
      )}

      {days.length > 0 && (
        <div className="mt-3 space-y-2">
          {days.map((d) => (
            <div
              key={d.id}
              className={`rounded-xl border-2 p-3 ${
                d.is_today ? "border-[#1ABC9C]/50 bg-[#f8fffe]" : "border-[#e8edf2] bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-black text-[#0D1B2A] truncate">
                    {d.name}
                    {d.is_today && (
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-[#1ABC9C] text-white text-[10px] font-black align-middle">
                        TODAY
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-[#64748b] mt-0.5">{prettyDate(d.date)}</p>
                  {(d.start_time || d.end_time) && (
                    <p className="text-[11px] text-[#94a3b8] mt-0.5">
                      {[d.start_time, d.end_time].filter(Boolean).join(" to ")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="px-2 py-1 rounded-lg bg-slate-100 text-[11px] font-bold text-slate-600 whitespace-nowrap">
                    {d.checked_in ?? 0} in
                  </span>
                  <button
                    onClick={() =>
                      patch(
                        d,
                        { accreditation_open: !d.accreditation_open },
                        d.accreditation_open
                          ? `Accreditation closed for ${d.heading}`
                          : `Accreditation open for ${d.heading}`
                      )
                    }
                    disabled={busy}
                    title={d.accreditation_open ? "Close accreditation for this day" : "Open accreditation for this day"}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all disabled:opacity-50 ${
                      d.accreditation_open
                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        : "bg-red-100 text-red-700 hover:bg-red-200"
                    }`}
                  >
                    {d.accreditation_open ? "OPEN" : "CLOSED"}
                  </button>
                  <button
                    onClick={() => patch(d, { is_active: !d.is_active }, d.is_active ? `${d.heading} hidden` : `${d.heading} shown`)}
                    disabled={busy}
                    title={d.is_active ? "Hide this day from the gate and reports" : "Show this day again"}
                    className="p-1.5 rounded-lg border border-[#e8edf2] text-[#64748b] hover:border-[#1ABC9C] hover:text-[#1ABC9C] transition-all disabled:opacity-50"
                  >
                    {d.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                  <a
                    href={`/api/v1/admin/events/${eventId}/report-html?day_id=${d.id}`}
                    target="_blank"
                    rel="noreferrer"
                    title={`Open the report for ${d.heading}`}
                    className="p-1.5 rounded-lg border border-[#e8edf2] text-[#64748b] hover:border-[#0D1B2A] hover:text-[#0D1B2A] transition-all"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => setPendingDelete(d)}
                    disabled={busy}
                    title="Remove this day"
                    className="p-1.5 rounded-lg border border-[#e8edf2] text-red-500 hover:border-red-300 hover:bg-red-50 transition-all disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          <p className="text-[11px] text-[#94a3b8]">
            {data?.total_checked_in ?? 0} of {data?.total_guests ?? 0} guests accredited across the whole run.
            Each day counts on its own, so a guest accredited on day 1 is still expected on day 2.
          </p>
        </div>
      )}

      {/* Schedule a run of days */}
      <div className="mt-3 rounded-xl bg-[#f8f9fc] border border-[#e8edf2] p-3">
        <p className="text-[11px] font-black uppercase tracking-wider text-[#64748b] mb-2">
          {multi ? "Add more days" : "Make it a multi-day event"}
        </p>
        <div className="grid gap-2 sm:grid-cols-[1fr_90px]">
          <div>
            <label className="block text-[11px] font-bold text-[#64748b] mb-1">First day</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border-2 border-[#e8edf2] text-sm focus:outline-none focus:border-[#1ABC9C]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#64748b] mb-1">Days</label>
            <input
              type="number"
              min="1"
              max="60"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border-2 border-[#e8edf2] text-sm focus:outline-none focus:border-[#1ABC9C]"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold text-[#64748b] mb-1">
              Label for these days (optional, e.g. Summit)
            </label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Leave empty for Day 1, Day 2..."
              className="w-full px-3 py-2 rounded-xl border-2 border-[#e8edf2] text-sm focus:outline-none focus:border-[#1ABC9C]"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <button
            onClick={bulkAdd}
            disabled={busy || !startDate}
            className="px-4 py-2 rounded-xl bg-[#1ABC9C] text-white text-xs font-bold hover:bg-[#16A085] transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            {busy ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Schedule {Number(count) > 1 ? `${count} days` : "day"}
          </button>
          {startDate && Number(count) > 1 && (
            <span className="text-[11px] text-[#94a3b8] self-center">
              {prettyDate(startDate)} to {prettyDate(addDays(startDate, (Number(count) || 1) - 1))}
            </span>
          )}
          <button
            onClick={() => setShowSingle(!showSingle)}
            className="px-3 py-2 rounded-xl border-2 border-[#e8edf2] text-xs font-bold text-[#64748b] hover:border-[#1ABC9C] hover:text-[#1ABC9C] transition-all"
          >
            {showSingle ? "Cancel" : "Add one date"}
          </button>
        </div>

        {showSingle && (
          <div className="grid gap-2 sm:grid-cols-2 mt-2">
            <input
              type="date"
              value={singleDate}
              onChange={(e) => setSingleDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border-2 border-[#e8edf2] text-sm focus:outline-none focus:border-[#1ABC9C]"
            />
            <div className="flex gap-2">
              <input
                value={singleLabel}
                onChange={(e) => setSingleLabel(e.target.value)}
                placeholder="Label (optional)"
                className="flex-1 min-w-0 px-3 py-2 rounded-xl border-2 border-[#e8edf2] text-sm focus:outline-none focus:border-[#1ABC9C]"
              />
              <button
                onClick={addOne}
                disabled={busy || !singleDate}
                className="px-4 py-2 rounded-xl bg-[#0D1B2A] text-white text-xs font-bold hover:bg-[#1ABC9C] transition-all disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {msg && (
        <p className={`text-xs font-semibold mt-2 ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Remove this day?"
        message={
          pendingDelete
            ? `${pendingDelete.heading} will be taken off the schedule. Check-ins already recorded for it are kept in the history and never deleted.`
            : ""
        }
        confirmLabel="Remove day"
        variant="danger"
        onConfirm={() => {
          const d = pendingDelete;
          setPendingDelete(null);
          if (d) remove(d);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
