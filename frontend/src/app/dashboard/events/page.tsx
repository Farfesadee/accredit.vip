"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/auth-context";
import { getEvents, type EventData } from "@/lib/api/events";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopbar } from "@/components/dashboard/topbar";
import { EventCard, EventCardSkeleton } from "@/components/dashboard/event-card";
import { CalendarDays } from "lucide-react";

export default function EventsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<EventData[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) { router.push("/login"); return; }
    if (user) {
      apiClient("/events/claim-trial", { method: "POST" }).catch(() => {});
      getEvents().then(setEvents).catch(() => {}).finally(() => setEventsLoading(false));
    }
  }, [user, loading, router]);

  if (loading || !user) return null;

  return (
    <div className="flex min-h-screen bg-[#f8f9fc]">
      <DashboardSidebar sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} mobileNavOpen={mobileNavOpen} onMobileNavClose={() => setMobileNavOpen(false)} />

      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${sidebarOpen ? "lg:ml-64" : "lg:ml-20"}`}>
        <DashboardTopbar title="My Events" subtitle={`${events.length} total`} onMenuClick={() => setMobileNavOpen(true)} />

        <main className="flex-1 px-6 py-8 overflow-auto">
          {eventsLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => <EventCardSkeleton key={i} />)}
            </div>
          ) : events.length === 0 ? (
            <div className="rounded-2xl p-12 text-center" style={{ background: "white", border: "2px dashed #e8edf2" }}>
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-5" style={{ background: "rgba(26, 188, 156,0.08)" }}>
                <CalendarDays className="h-8 w-8 text-[#1ABC9C]" />
              </div>
              <h3 className="text-lg font-bold text-[#0D1B2A] mb-2">No events yet</h3>
              <p className="text-sm text-gray-400 mb-6">Create your first event to get started.</p>
              <a href="/dashboard/create" className="btn-primary inline-flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Create Your First Event
              </a>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {events.map((event) => <EventCard key={event.id} event={event} />)}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
