"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { getEvents, type EventData, type EventFilters } from "@/lib/api/events";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopbar } from "@/components/dashboard/topbar";
import { EventCard, EventCardSkeleton } from "@/components/dashboard/event-card";
import { CalendarDays, CheckCircle2, FileText } from "lucide-react";

function DashboardContent() {
  const { user, loading } = useAuth();
  const [events, setEvents] = useState<EventData[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const router = useRouter();

  const loadEvents = useCallback(async (filters?: EventFilters) => {
    setEventsLoading(true);
    try {
      const data = await getEvents(filters);
      setEvents(data);
    } catch {}
    setEventsLoading(false);
  }, []);

  useEffect(() => {
    if (!loading && !user) { router.push("/login"); return; }
    if (user) { loadEvents(); }
  }, [user, loading, router, loadEvents]);

  if (loading || !user) return null;

  const totalEvents = events.length;
  const activeEvents = events.filter((e) => e.status === "active" || e.status === "published").length;
  const draftEvents = events.filter((e) => e.status === "draft").length;

  return (
    <div className="flex min-h-screen bg-[#f8f9fc]">
      <DashboardSidebar sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} mobileNavOpen={mobileNavOpen} onMobileNavClose={() => setMobileNavOpen(false)} />

      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${sidebarOpen ? "lg:ml-64" : "lg:ml-20"}`}>
        <DashboardTopbar title="Dashboard" subtitle={`${totalEvents} event${totalEvents !== 1 ? "s" : ""}`} onMenuClick={() => setMobileNavOpen(true)} />

        <main className="flex-1 px-4 py-4 sm:px-6 sm:py-8 overflow-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5 mb-6 sm:mb-8">
            {[
              { label: "Total Events", value: totalEvents, icon: <CalendarDays className="h-5 w-5 sm:h-6 sm:w-6" />, color: "#1ABC9C", bg: "rgba(26, 188, 156,0.08)" },
              { label: "Active Events", value: activeEvents, icon: <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6" />, color: "#10b981", bg: "rgba(16,185,129,0.08)" },
              { label: "Draft Events", value: draftEvents, icon: <FileText className="h-5 w-5 sm:h-6 sm:w-6" />, color: "#f59e0b", bg: "rgba(245,158,11,0.08)" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4" style={{ background: "white", border: "1px solid #e8edf2", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: stat.bg, color: stat.color }}>
                  {stat.icon}
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-extrabold text-[#0D1B2A]">{stat.value}</p>
                  <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#0D1B2A]">My Events</h2>
            <Link href="/dashboard/events" className="text-xs font-semibold hover:underline" style={{ color: "#1ABC9C" }}>
              View all &rarr;
            </Link>
          </div>

          {eventsLoading ? (
            <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => <EventCardSkeleton key={i} />)}
            </div>
          ) : events.length === 0 ? (
            <div className="rounded-2xl p-12 text-center" style={{ background: "white", border: "2px dashed #e8edf2" }}>
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-3xl mb-5" style={{ background: "rgba(26, 188, 156,0.08)" }}>
                <CalendarDays className="h-8 w-8 text-[#1ABC9C]" />
              </div>
              <h3 className="text-lg font-bold text-[#0D1B2A] mb-2">No events yet</h3>
              <p className="text-sm text-gray-400 mb-6">Create your first event to get started.</p>
              <Link href="/dashboard/create" className="btn-primary inline-flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Create Your First Event
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {events.map((event) => <EventCard key={event.id} event={event} />)}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ErrorBoundary>
      <DashboardContent />
    </ErrorBoundary>
  );
}
