"use client";

import { useEffect, useState, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import { Users, Plane, Building2, MapPin, BarChart3, Loader, Search, UserCheck, Clock } from "lucide-react";

type LocationTab = string | "analytics";

interface GuestEntry {
  id: number;
  guest_id: number;
  name: string;
  phone: string | null;
  email: string | null;
  invited_by?: string | null;
  checked_in_at: string | null;
  location: string | null;
}

interface LocationStats {
  locations: Record<string, number>;
  total_checked_in: number;
}

const ALL_LOCATIONS = [
  "Airport",
  "Abuja Continental",
  "Abuja Continental 1", "Abuja Continental 2", "Abuja Continental 3",
  "Abuja Continental 4", "Abuja Continental 5", "Abuja Continental 6",
  "Transcorp",
  "Transcorp 1", "Transcorp 2", "Transcorp 3", "Transcorp 4", "Transcorp 5",
  "ICC",
  "ICC Guests",
  "Help Desk",
];

const PIE_COLORS = [
  "#16a34a",
  "#2563eb", "#3b82f6", "#1d4ed8", "#60a5fa", "#93c5fd", "#bfdbfe",
  "#9333ea", "#a855f7", "#c084fc", "#d8b4fe", "#e9d5ff", "#7c3aed",
  "#e11d48", "#0891b2", "#f59e0b",
];

function PieChart({ data, size = 200 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <div className="w-32 h-32 rounded-full border-4 border-dashed border-slate-200" />
      </div>
    );
  }

  let cumulative = 0;
  const r = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2;

  const slices = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const startAngle = (cumulative / total) * 2 * Math.PI;
      cumulative += d.value;
      const endAngle = (cumulative / total) * 2 * Math.PI;
      const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
      const x1 = cx + r * Math.cos(startAngle - Math.PI / 2);
      const y1 = cy + r * Math.sin(startAngle - Math.PI / 2);
      const x2 = cx + r * Math.cos(endAngle - Math.PI / 2);
      const y2 = cy + r * Math.sin(endAngle - Math.PI / 2);
      const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      return { path, color: d.color, label: d.label, value: d.value, pct: Math.round((d.value / total) * 100) };
    });

  return (
    <div className="flex items-center gap-6 flex-wrap justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth="2" />
        ))}
        <circle cx={cx} cy={cy} r={r * 0.45} fill="white" />
        <text x={cx} y={cy - 6} textAnchor="middle" className="text-lg font-black fill-slate-900">{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="text-[10px] fill-slate-400">TOTAL</text>
      </svg>
      <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-slate-600 truncate max-w-[120px]">{s.label}</span>
            <span className="font-bold text-slate-900">{s.value}</span>
            <span className="text-slate-400">({s.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDateTime(isoString: string | null): string {
  if (!isoString) return "---";
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
}

function getLocationIcon(loc: string) {
  if (loc === "Airport") return Plane;
  if (loc === "Help Desk") return Users;
  if (loc.startsWith("Abuja Continental") || loc.startsWith("Transcorp")) return Building2;
  return MapPin;
}

function getLocationColor(loc: string): { bg: string; text: string; border: string; light: string; badge: string } {
  if (loc === "Airport") return { bg: "bg-green-500", text: "text-green-700", border: "border-green-200", light: "bg-green-50", badge: "bg-green-100 text-green-700" };
  if (loc.startsWith("Abuja Continental")) return { bg: "bg-blue-500", text: "text-blue-700", border: "border-blue-200", light: "bg-blue-50", badge: "bg-blue-100 text-blue-700" };
  if (loc.startsWith("Transcorp")) return { bg: "bg-purple-500", text: "text-purple-700", border: "border-purple-200", light: "bg-purple-50", badge: "bg-purple-100 text-purple-700" };
  if (loc === "ICC Guests") return { bg: "bg-cyan-500", text: "text-cyan-700", border: "border-cyan-200", light: "bg-cyan-50", badge: "bg-cyan-100 text-cyan-700" };
  if (loc === "Help Desk") return { bg: "bg-amber-500", text: "text-amber-700", border: "border-amber-200", light: "bg-amber-50", badge: "bg-amber-100 text-amber-700" };
  return { bg: "bg-rose-500", text: "text-rose-700", border: "border-rose-200", light: "bg-rose-50", badge: "bg-rose-100 text-rose-700" };
}

export default function NBCLocationDashboard({ eventId }: { eventId: number }) {
  const [activeTab, setActiveTab] = useState<LocationTab>("analytics");
  const [activeSubTab, setActiveSubTab] = useState<string | null>(null);
  const [stats, setStats] = useState<LocationStats | null>(null);
  const [guests, setGuests] = useState<GuestEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadStats = useCallback(async () => {
    try {
      const d = await apiClient<LocationStats>(`/scanner/events/${eventId}/location-stats`);
      setStats(d);
    } catch {}
  }, [eventId]);

  const loadGuests = useCallback(async (location: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ location });
      if (searchQuery) params.set("q", searchQuery);
      const d = await apiClient<{ guests: GuestEntry[]; total: number }>(`/scanner/events/${eventId}/location-guests?${params}`);
      setGuests(d.guests || []);
    } catch { setGuests([]); }
    setLoading(false);
  }, [eventId, searchQuery]);

  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    if (activeTab !== "analytics") {
      const loc = activeSubTab || activeTab;
      loadGuests(loc);
    }
  }, [activeTab, activeSubTab, loadGuests]);

  useEffect(() => {
    if (activeTab !== "analytics") {
      const loc = activeSubTab || activeTab;
      loadGuests(loc);
    }
  }, [searchQuery]);

  const totalGuests = stats?.total_checked_in || 0;

  const renderLocationTab = (location: string) => {
    const filtered = guests.filter((g) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return g.name?.toLowerCase().includes(q) || g.email?.toLowerCase().includes(q) || g.phone?.includes(q);
    });

    const colors = getLocationColor(location);

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search guests..."
              className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            />
          </div>
          <span className="text-sm text-slate-500">{filtered.length} guest{filtered.length !== 1 ? "s" : ""} checked in</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader className="w-6 h-6 animate-spin text-teal-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No guests checked in at {location} yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="pb-2 font-medium text-slate-500">Name</th>
                  <th className="pb-2 font-medium text-slate-500">Email</th>
                  <th className="pb-2 font-medium text-slate-500">Phone</th>
                  <th className="pb-2 font-medium text-slate-500">Category</th>
                  <th className="pb-2 font-medium text-slate-500">Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => (
                  <tr key={g.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2.5 font-medium text-slate-900">{g.name}</td>
                    <td className="py-2.5 text-slate-600">{g.email || "---"}</td>
                    <td className="py-2.5 text-slate-600">{g.phone || "---"}</td>
                    <td className="py-2.5 text-slate-500">{g.invited_by || "---"}</td>
                    <td className="py-2.5 text-slate-500 text-xs whitespace-nowrap">{formatDateTime(g.checked_in_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderAnalytics = () => {
    const pieData = ALL_LOCATIONS.map((loc, i) => ({
      label: loc,
      value: stats?.locations?.[loc] || 0,
      color: PIE_COLORS[i],
    })).filter((d) => d.value > 0);

    const unassignedCount = stats?.locations?.["unassigned"] || 0;
    if (unassignedCount > 0) pieData.push({ label: "Unassigned", value: unassignedCount, color: "#94a3b8" });

    const maxCount = Math.max(...ALL_LOCATIONS.map((loc) => stats?.locations?.[loc] || 0), 1);

    return (
      <div className="space-y-6">
        <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <UserCheck className="w-5 h-5 text-slate-500" />
          </div>
          <p className="text-3xl font-black text-slate-900">{totalGuests}</p>
          <p className="text-xs font-medium text-slate-500 uppercase mt-1">Total Accredited</p>
        </div>

        <div className="rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Accreditation by Location</h3>
          <div className="flex justify-center">
            <PieChart data={pieData} size={220} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-700 mb-2">Breakdown</h3>
          {ALL_LOCATIONS.map((loc) => {
            const count = stats?.locations?.[loc] || 0;
            const Icon = getLocationIcon(loc);
            const colors = getLocationColor(loc);
            return (
              <div key={loc} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium text-slate-700">
                    <Icon className="w-4 h-4" /> {loc}
                  </span>
                  <span className="font-bold text-slate-900">{count}</span>
                </div>
                <div className={`w-full rounded-full h-3 overflow-hidden ${colors.light}`}>
                  <div className={`h-full rounded-full ${colors.bg} transition-all duration-500`} style={{ width: `${(count / maxCount) * 100}%` }} />
                </div>
              </div>
            );
          })}
          {unassignedCount > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-500">Unassigned</span>
                <span className="font-bold text-slate-600">{unassignedCount}</span>
              </div>
              <div className="w-full rounded-full h-3 overflow-hidden bg-slate-100">
                <div className="h-full rounded-full bg-slate-400 transition-all duration-500" style={{ width: `${(unassignedCount / maxCount) * 100}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Quick Actions</h3>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {ALL_LOCATIONS.map((loc) => {
              const Icon = getLocationIcon(loc);
              const colors = getLocationColor(loc);
              const count = stats?.locations?.[loc] || 0;
              return (
                <button key={loc} onClick={() => { setActiveTab(loc); setActiveSubTab(loc); setSearchQuery(""); }} className={`flex flex-col items-center gap-1.5 p-3 rounded-xl ${colors.light} border ${colors.border} hover:opacity-80 transition`}>
                  <Icon className={`w-5 h-5 ${colors.text}`} />
                  <span className={`text-[10px] font-bold ${colors.text}`}>{loc}</span>
                  <span className="text-xs font-black text-slate-900">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const mainGroups = [
    { id: "airport", label: "Airport", icon: Plane, locations: ["Airport"] },
    { id: "abuja_continental", label: "Abuja Continental", icon: Building2, locations: ["Abuja Continental", "Abuja Continental 1", "Abuja Continental 2", "Abuja Continental 3", "Abuja Continental 4", "Abuja Continental 5", "Abuja Continental 6"] },
    { id: "transcorp", label: "Transcorp", icon: Building2, locations: ["Transcorp", "Transcorp 1", "Transcorp 2", "Transcorp 3", "Transcorp 4", "Transcorp 5"] },
    { id: "icc", label: "ICC", icon: MapPin, locations: ["ICC", "ICC Guests"] },
    { id: "helpdesk", label: "Help Desk", icon: Users, locations: ["Help Desk"] },
  ];

  const activeGroup = mainGroups.find((g) => g.id === activeTab || g.locations.includes(activeTab));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {mainGroups.map((group) => {
          const Icon = group.icon;
          const isActive = activeGroup?.id === group.id;
          return (
            <button
              key={group.id}
              onClick={() => { setActiveTab(group.id); setActiveSubTab(group.locations[0]); setSearchQuery(""); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                isActive
                  ? "bg-teal-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {group.label}
            </button>
          );
        })}
        <button
          onClick={() => { setActiveTab("analytics"); setSearchQuery(""); }}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap ${
            activeTab === "analytics"
              ? "bg-teal-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Analytics
        </button>
      </div>

      {activeGroup && activeGroup.locations.length > 1 && activeTab !== "analytics" && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {activeGroup.locations.map((loc) => {
            const colors = getLocationColor(loc);
            const isActive = (activeSubTab || activeTab) === loc;
            return (
              <button
                key={loc}
                onClick={() => { setActiveSubTab(loc); setSearchQuery(""); }}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition whitespace-nowrap ${
                  isActive
                    ? `${colors.bg} text-white`
                    : `${colors.light} ${colors.text} hover:opacity-80`
                }`}
              >
                {loc}
              </button>
            );
          })}
        </div>
      )}

      {activeTab === "analytics" ? renderAnalytics() : renderLocationTab(activeSubTab || activeTab)}
    </div>
  );
}
