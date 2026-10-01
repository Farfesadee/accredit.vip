"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { apiClient } from "@/lib/api-client";
import { getEvent, type EventData } from "@/lib/api/events";
import { Menu, X, MapPin, Calendar, Clock, Edit2, Trash2, Users, BarChart3, Mail, Settings, Plus, ArrowLeft, Copy } from "lucide-react";

export default function TemplatesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const eventId = params?.id;
  const [event, setEvent] = useState<EventData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [eventData, setEventData] = useState<any>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      apiClient<any[]>("/event-templates").then(setTemplates).catch(() => {});
      if (eventId) {
        getEvent(Number(eventId)).then(setEvent).catch(() => {});
        apiClient<any>(`/events/${eventId}`).then(setEventData).catch(() => {});
      }
    }
  }, [user, eventId]);

  const saveAsTemplate = async () => {
    if (!templateName || !eventData) return;
    try {
      const config = {
        title: eventData.title,
        event_type: eventData.event_type,
        venue: eventData.venue,
        dress_code: eventData.dress_code,
        description: eventData.description,
        guest_count_range: eventData.guest_count_range,
      };
      const mode = eventData.ticket_price ? "event" : "invite";
      await apiClient("/event-templates", { method: "POST", body: { name: templateName, mode, config } });
      setTemplateName("");
      const updated = await apiClient<any[]>("/event-templates");
      setTemplates(updated);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const loadTemplate = async (template: any) => {
    try {
      await apiClient(`/event-templates/${template.id}`);
      router.push(`/dashboard/create?template=${template.id}`);
    } catch {}
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-white flex">
      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-screen w-96 bg-white border-r border-slate-200 z-50 transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Event Info */}
        <div className="p-6 border-b border-slate-200 space-y-4">
          {/* Cover Image or Gradient */}
          <div className="h-32 bg-gradient-to-br from-slate-300 to-slate-400 rounded-lg" />

          {/* Event Title */}
          <div>
            <h2 className="text-lg font-bold text-slate-900">{event?.title || "Event"}</h2>
            <p className="text-xs text-slate-500 mt-1">Event ID: {eventId}</p>
          </div>

          {/* Event Details */}
          <div className="space-y-2 text-sm">
            {event?.venue && (
              <div className="flex items-start gap-2 text-slate-700">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{event.venue}</span>
              </div>
            )}
            {event?.event_date && (
              <div className="flex items-center gap-2 text-slate-700">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span>{new Date(event.event_date).toLocaleDateString()}</span>
              </div>
            )}
            {event?.event_time && (
              <div className="flex items-center gap-2 text-slate-700">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span>{event.event_time}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => router.push(`/dashboard/events/${eventId}/edit`)}
              className="flex-1 h-9 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-900 flex items-center justify-center gap-2 transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="flex-1 h-9 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors"
            >
              View Details
            </button>
          </div>

          {/* RSVP Stats */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-xs text-emerald-600 font-medium">Accepted</p>
              <p className="text-lg font-bold text-emerald-900">0</p>
            </div>
            <div className="rounded-lg bg-slate-100 p-3">
              <p className="text-xs text-slate-600 font-medium">Total</p>
              <p className="text-lg font-bold text-slate-900">0</p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="p-4 space-y-1">
          <a
            href={`/dashboard/events/${eventId}`}
            className="block px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Overview
          </a>
          <a
            href={`/dashboard/events/${eventId}#guests`}
            className="block px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Guests
          </a>
          <a
            href={`/dashboard/events/${eventId}#invites`}
            className="block px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Send Invites
          </a>
          <a
            href={`/dashboard/events/${eventId}/questions`}
            className="block px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Questions
          </a>
          <a
            href={`/dashboard/events/${eventId}/reminders`}
            className="block px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Reminders
          </a>
          <a
            href={`/dashboard/events/${eventId}/coupons`}
            className="block px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Coupons
          </a>
          <a
            href={`/dashboard/events/${eventId}/templates`}
            className="block px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium transition-colors"
          >
            Templates
          </a>
          <a
            href={`/dashboard/events/${eventId}/waitlist`}
            className="block px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Waitlist
          </a>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="border-b border-slate-200 bg-white sticky top-0 z-30">
          <div className="flex items-center gap-4 px-6 py-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <a
              href="/dashboard"
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </a>
            <h1 className="text-lg font-bold text-slate-900 ml-auto">Event Templates</h1>
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl space-y-6">
            {/* Save as Template */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Save Current Event as Template
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Template Name</label>
                  <input
                    placeholder="e.g. Monthly Networking, Annual Conference"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <button
                  onClick={saveAsTemplate}
                  disabled={!templateName}
                  className="w-full h-10 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Save current event as a template"
                >
                  Save
                </button>
              </div>
            </div>

            {/* Existing Templates */}
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Copy className="w-5 h-5" />
                Your Templates ({templates.length})
              </h2>
              {templates.length === 0 ? (
                <div className="rounded-xl border border-slate-200 border-dashed p-12 text-center bg-slate-50">
                  <p className="text-sm text-slate-600">No templates saved yet. Save your current event as a template to get started.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map((t) => (
                    <div key={t.id} className="rounded-lg border border-slate-200 bg-white p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900">{t.name}</p>
                          <p className="text-xs text-slate-600 mt-1">
                            {t.mode} · {new Date(t.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => loadTemplate(t)}
                          className="ml-4 px-3 py-2 text-sm font-medium text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex-shrink-0"
                        >
                          Use
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
