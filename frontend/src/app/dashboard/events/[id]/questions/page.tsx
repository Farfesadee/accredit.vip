"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { apiClient } from "@/lib/api-client";
import { getEvent, type EventData } from "@/lib/api/events";
import { Menu, X, MapPin, Calendar, Clock, Edit2, Delete, Users, BarChart3, Mail, Settings, Plus, ArrowLeft, HelpCircle, Trash2 } from "lucide-react";

export default function QuestionsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const eventId = params?.id;
  const [event, setEvent] = useState<EventData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [questions, setQuestions] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (user && eventId) {
      getEvent(Number(eventId)).then(setEvent).catch(() => {});
      apiClient<any[]>(`/rsvp-questions/${eventId}`).then(setQuestions).catch(() => {});
    }
  }, [user, eventId]);

  const addQuestion = () =>
    setQuestions((prev) => [...prev, { label: "", type: "text", required: false, options: null }]);

  const update = (i: number, field: string, value: any) => {
    setQuestions((prev) => prev.map((q, j) => (j === i ? { ...q, [field]: value } : q)));
  };

  const remove = (i: number) => setQuestions((prev) => prev.filter((_, j) => j !== i));

  const save = async () => {
    try {
      await apiClient(`/rsvp-questions/${eventId}`, { method: "POST", body: questions });
      alert("Questions saved!");
    } catch (err: any) {
      alert(err.message);
    }
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
            className="block px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium transition-colors"
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
            className="block px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
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
            <h1 className="text-lg font-bold text-slate-900 ml-auto">RSVP Questions</h1>
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl space-y-4">
            {/* Info */}
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 flex gap-3">
              <HelpCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-900">
                Add custom questions that guests will answer during RSVP. Use these to gather additional information for your event.
              </p>
            </div>

            {/* Questions List */}
            <div className="space-y-3">
              {questions.map((q, i) => (
                <div key={i} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="space-y-3">
                    <input
                      placeholder="Question text"
                      value={q.label}
                      onChange={(e) => update(i, "label", e.target.value)}
                      className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    <div className="flex gap-2">
                      <select
                        value={q.type}
                        onChange={(e) => update(i, "type", e.target.value)}
                        className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                      >
                        <option value="text">Text</option>
                        <option value="select">Dropdown</option>
                        <option value="checkbox">Checkbox</option>
                      </select>
                      <label className="flex items-center gap-2 text-sm h-10 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={q.required}
                          onChange={(e) => update(i, "required", e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span>Required</span>
                      </label>
                      <button
                        onClick={() => remove(i)}
                        className="ml-auto h-10 px-3 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 text-sm font-medium transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove
                      </button>
                    </div>
                    {q.type === "select" && (
                      <input
                        placeholder="Options (comma separated)"
                        onChange={(e) =>
                          update(i, "options", e.target.value.split(",").map((s: string) => s.trim()))
                        }
                        className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add Button */}
            <button
              onClick={addQuestion}
              className="w-full h-10 rounded-lg border-2 border-dashed border-slate-300 text-slate-600 font-medium hover:border-slate-900 hover:text-slate-900 transition-colors flex items-center justify-center gap-2"
              title="Add a new question"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>

            {/* Save Button */}
            {questions.length > 0 && (
              <button
                onClick={save}
                className="w-full h-10 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium transition-colors"
                title="Save all questions"
              >
                Save
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
