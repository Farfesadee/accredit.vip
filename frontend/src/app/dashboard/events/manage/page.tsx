"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import {
  Edit2,
  Trash2,
  Send,
  ChevronLeft,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";

interface UserEvent {
  id: number;
  title: string;
  host_name: string;
  event_date: string;
  event_time: string;
  venue: string;
  ticket_price?: number;
  status: "pending" | "approved" | "rejected";
  is_public: boolean;
  created_at: string;
}

export default function ManageEventsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      router.push("/auth/onboarding");
      return;
    }

    fetchUserEvents();
  }, [user, router]);

  const fetchUserEvents = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/v1/events?user_events=true");
      if (!response.ok) throw new Error("Failed to fetch events");

      const data = await response.json();
      setEvents(data.events || []);
    } catch (error) {

    } finally {
      setIsLoading(false);
    }
  };

  const handleEditEvent = (eventId: number) => {
    router.push(`/dashboard/events/${eventId}/edit`);
  };

  const handleDeleteEvent = async (eventId: number) => {
    if (!confirm("Are you sure you want to delete this event?")) return;

    try {
      setActionLoading(eventId);
      const response = await fetch(`/api/v1/events/${eventId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete event");

      setEvents(events.filter((e) => e.id !== eventId));
    } catch (error) {

      alert("Failed to delete event");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePostEvent = async (eventId: number) => {
    try {
      setActionLoading(eventId);
      const response = await fetch(`/api/v1/events/${eventId}/submit-approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) throw new Error("Failed to submit event for approval");

      // Refresh events
      await fetchUserEvents();
    } catch (error) {

      alert("Failed to submit event for approval");
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (event: UserEvent) => {
    if (event.status === "pending") {
      return (
        <div className="flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
          <Clock className="h-3 w-3" />
          Pending
        </div>
      );
    } else if (event.status === "approved") {
      return (
        <div className="flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
          <CheckCircle className="h-3 w-3" />
          Approved
        </div>
      );
    } else if (event.status === "rejected") {
      return (
        <div className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">
          <AlertCircle className="h-3 w-3" />
          Rejected
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      {/* Header */}
      <header className="border-b border-[#e8edf2] bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 px-4 py-2 text-[#1ABC9C] border border-[#1ABC9C] rounded-lg hover:bg-[#1ABC9C]/10 transition-colors font-semibold text-sm"
          >
            <ChevronLeft className="h-5 w-5" />
            Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold text-[#0D1B2A]">My Events</h1>
          <button
            onClick={() => router.push("/create-event")}
            className="px-6 py-2 bg-[#1ABC9C] text-white rounded-lg font-bold text-sm hover:bg-[#16A085] transition-colors"
          >
            Create Event
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 rounded-full border-4 border-[#1ABC9C] border-t-transparent animate-spin mx-auto mb-4" />
            <p className="text-[#64748b]">Loading your events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-[#94a3b8] mx-auto mb-4" />
            <p className="text-[#64748b] font-medium mb-4">No events yet</p>
            <button
              onClick={() => router.push("/create-event")}
              className="px-6 py-2 bg-[#1ABC9C] text-white rounded-lg font-bold text-sm hover:bg-[#16A085] transition-colors"
            >
              Create Your First Event
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <div
                key={event.id}
                className="bg-white rounded-xl border border-[#e8edf2] shadow-sm hover:shadow-md transition-shadow p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-[#0D1B2A]">
                        {event.title}
                      </h3>
                      {getStatusBadge(event)}
                    </div>
                    <p className="text-sm text-[#64748b] mb-3">
                      Hosted by <span className="font-semibold">{event.host_name}</span>
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-[#94a3b8]">Date</span>
                        <p className="font-semibold text-[#0D1B2A]">
                          {new Date(event.event_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-[#94a3b8]">Time</span>
                        <p className="font-semibold text-[#0D1B2A]">{event.event_time}</p>
                      </div>
                      <div>
                        <span className="text-[#94a3b8]">Venue</span>
                        <p className="font-semibold text-[#0D1B2A]">{event.venue}</p>
                      </div>
                      {event.ticket_price !== null && (
                        <div>
                          <span className="text-[#94a3b8]">Ticket Price</span>
                          <p className="font-semibold text-[#0D1B2A]">
                            {event.ticket_price === 0 || event.ticket_price === undefined
                              ? "Free"
                              : `₦${event.ticket_price.toLocaleString()}`}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-[#e8edf2]">
                  <button
                    onClick={() => handleEditEvent(event.id)}
                    disabled={actionLoading === event.id}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-bold text-sm hover:bg-blue-100 transition-colors disabled:opacity-50"
                  >
                    <Edit2 className="h-4 w-4" />
                    Edit
                  </button>

                  {event.status === "pending" && !event.is_public && (
                    <button
                      onClick={() => handlePostEvent(event.id)}
                      disabled={actionLoading === event.id}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold text-sm hover:bg-emerald-100 transition-colors disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                      {actionLoading === event.id ? "Posting..." : "Post Event"}
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteEvent(event.id)}
                    disabled={actionLoading === event.id}
                    className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg font-bold text-sm hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
