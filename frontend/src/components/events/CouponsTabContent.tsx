"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Ticket, Percent, Coins, Loader, AlertTriangle } from "lucide-react";

type CouponsTabContentProps = {
  eventId: string;
};

export default function CouponsTabContent({ eventId }: CouponsTabContentProps) {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiClient<any[]>(`/coupons/${eventId}`)
      .then((data) => setCoupons(data))
      .catch(() => setError("Failed to load coupons. Please try again."))
      .finally(() => setLoading(false));
  }, [eventId]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-secondary flex items-center gap-2">
          <Ticket className="w-5 h-5" />
          Applied Coupons
          {!loading && <span className="text-sm font-normal text-slate-400 ml-1">({coupons.length})</span>}
        </h2>
        <p className="text-sm text-slate-500 mt-1">Coupons created by the admin and applied to this event</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      ) : coupons.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 sm:p-16 text-center bg-slate-50">
          <Ticket className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-600">No coupons applied yet</p>
          <p className="text-xs text-slate-400 mt-1">Admin-created coupons will appear here</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {coupons.map((c) => (
            <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-5 hover:shadow-md transition-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary opacity-80 flex items-center justify-center text-white">
                  {c.discount_percent ? <Percent className="w-5 h-5" /> : <Coins className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-secondary text-lg tracking-wide truncate">{c.code}</p>
                  <p className="text-sm text-slate-500">
                    {c.discount_percent
                      ? `${c.discount_percent}% off`
                      : c.discount_fixed
                        ? `₦${c.discount_fixed.toLocaleString()} off`
                        : "No discount"}
                  </p>
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-auto sm:ml-0">
                <p className="text-sm font-semibold text-secondary">{c.used_count}{c.max_uses ? `/${c.max_uses}` : " used (unlimited)"}</p>
                <p className="text-xs text-slate-400">{c.max_uses ? "used" : "no limit"}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
