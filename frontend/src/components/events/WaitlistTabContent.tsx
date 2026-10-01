"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { CheckCircle, UserPlus, Users, Volume2, Loader, AlertTriangle } from "lucide-react";

type WaitlistEntry = {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  quantity: number;
  notified: boolean;
};

type WaitlistTabContentProps = {
  eventId: string;
};

export default function WaitlistTabContent({ eventId }: WaitlistTabContentProps) {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [promotingId, setPromotingId] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    apiClient<WaitlistEntry[]>(`/waitlist/${eventId}`)
      .then(setEntries)
      .catch(() => setError("Failed to load waitlist entries."))
      .finally(() => setLoading(false));
  }, [eventId]);

  const markNotified = async (entryId: number) => {
    setMarkingId(entryId);
    try {
      await apiClient(`/waitlist/${entryId}/notify`, { method: "POST" });
      setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, notified: true } : e)));
    } catch {
      setError("Failed to mark as notified. Please try again.");
    }
    setMarkingId(null);
  };

  const promoteToGuest = async (entry: WaitlistEntry) => {
    setPromotingId(entry.id);
    try {
      await apiClient(`/waitlist/${entry.id}/promote`, { method: "POST" });
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    } catch {
      setError("Failed to promote guest. Please try again.");
    }
    setPromotingId(null);
  };

  const notifiedCount = entries.filter((e) => e.notified).length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-secondary flex items-center gap-2">
          <Users className="w-5 h-5" />
          Waitlist
        </h2>
        <p className="text-sm text-slate-500 mt-1">Guests who signed up after tickets sold out</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Waiting</p>
          <p className="text-3xl font-bold text-secondary mt-1">{entries.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Notified</p>
          <p className="text-3xl font-bold text-emerald-600 mt-1">{notifiedCount}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={() => setError(null)} className="text-xs text-red-600 underline mt-1">Dismiss</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 sm:p-16 text-center bg-slate-50">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-600">No waitlist entries yet</p>
          <p className="text-xs text-slate-400 mt-1">When guests sign up after tickets sell out, they&apos;ll appear here</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {entries.map((e) => (
            <div key={e.id} className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md transition-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-secondary">{e.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{e.email}{e.phone && ` • ${e.phone}`}</p>
                <p className="text-xs text-slate-400 mt-0.5">Qty: {e.quantity}</p>
              </div>
              <div className="flex-shrink-0 flex items-center gap-2">
                {e.notified ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 text-xs font-medium text-emerald-700 border border-emerald-200">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Notified
                  </span>
                ) : (
                  <button
                    onClick={() => markNotified(e.id)}
                    disabled={markingId === e.id}
                    className="px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {markingId === e.id ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
                    {markingId === e.id ? "Marking..." : "Mark Notified"}
                  </button>
                )}
                <button
                  onClick={() => promoteToGuest(e)}
                  disabled={promotingId === e.id}
                  className="px-3 py-2 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {promotingId === e.id ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  {promotingId === e.id ? "Promoting..." : "Promote"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
