"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { apiClient } from "@/lib/api-client";
import { getEvent, type EventData } from "@/lib/api/events";
import { Menu, X, MapPin, Calendar, Clock, Edit2, Trash2, Users, BarChart3, Mail, Settings, Plus, ArrowLeft, Bell } from "lucide-react";

type Rule = {
  id?: number;
  trigger: string;
  offset_value: number;
  offset_unit: string;
  channel: string;
  message: string;
  enabled: boolean;
};

const DEFAULT_RULE: Rule = {
  trigger: "before_event",
  offset_value: 1,
  offset_unit: "days",
  channel: "email",
  message: "Reminder: {{event_title}} is coming up on {{event_date}}!",
  enabled: true,
};

export default function RemindersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const eventId = params?.id;
  const [event, setEvent] = useState<EventData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rules, setRules] = useState<Rule[]>([{ ...DEFAULT_RULE }]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (user && eventId) {
      getEvent(Number(eventId)).then(setEvent).catch(() => {});
    }
  }, [user, eventId]);

  const updateRule = (i: number, field: string, value: any) => {
    setRules((prev) => prev.map((r, j) => (j === i ? { ...r, [field]: value } : r)));
  };

  const addRule = () => setRules((prev) => [...prev, { ...DEFAULT_RULE }]);

  const removeRule = (i: number) => setRules((prev) => prev.filter((_, j) => j !== i));

  const saveRules = async () => {
    try {
      await apiClient(`/events/${eventId}/settings`, { method: "PUT", body: { reminder_rules: rules } });
      alert("Reminder rules saved!");
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
            className="block px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Questions
          </a>
          <a
            href={`/dashboard/events/${eventId}/reminders`}
            className="block px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium transition-colors"
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
            <h1 className="text-lg font-bold text-slate-900 ml-auto">Automated Reminders</h1>
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl space-y-4">
            {/* Description */}
            <p className="text-sm text-slate-600">
              Guests will receive reminders automatically based on these rules. You can use template variables like <code className="bg-slate-100 px-2 py-1 rounded text-xs">{'{{event_title}}'}</code>, <code className="bg-slate-100 px-2 py-1 rounded text-xs">{'{{event_date}}'}</code>, and <code className="bg-slate-100 px-2 py-1 rounded text-xs">{'{{venue}}'}</code>.
            </p>

            {/* Rules List */}
            <div className="space-y-3">
              {rules.map((rule, i) => (
                <div key={i} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="space-y-3">
                    {/* Rule Header */}
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-slate-900">Rule {i + 1}</h3>
                      {rules.length > 1 && (
                        <button
                          onClick={() => removeRule(i)}
                          className="text-xs text-red-600 hover:text-red-700 font-medium"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {/* Trigger Configuration */}
                    <div className="flex gap-2 items-center flex-wrap">
                      <span className="text-sm text-slate-700">Send</span>
                      <select
                        value={rule.offset_value}
                        onChange={(e) => updateRule(i, "offset_value", Number(e.target.value))}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                      >
                        {[1, 2, 3, 7, 14].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                      <select
                        value={rule.offset_unit}
                        onChange={(e) => updateRule(i, "offset_unit", e.target.value)}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                      >
                        <option value="hours">hour(s)</option>
                        <option value="days">day(s)</option>
                        <option value="weeks">week(s)</option>
                      </select>
                      <select
                        value={rule.trigger}
                        onChange={(e) => updateRule(i, "trigger", e.target.value)}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                      >
                        <option value="before_event">before event</option>
                        <option value="after_rsvp">after RSVP</option>
                      </select>
                    </div>

                    {/* Channel Selection */}
                    <div>
                      <label className="text-xs font-medium text-slate-700 mb-1 block">Delivery Channel</label>
                      <select
                        value={rule.channel}
                        onChange={(e) => updateRule(i, "channel", e.target.value)}
                        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                      >
                        <option value="email">Email</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="sms">SMS</option>
                      </select>
                    </div>

                    {/* Message */}
                    <div>
                      <label className="text-xs font-medium text-slate-700 mb-1 block">Message</label>
                      <textarea
                        placeholder="Message (use {{event_title}}, {{event_date}}, {{venue}})"
                        value={rule.message}
                        onChange={(e) => updateRule(i, "message", e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Rule Button */}
            <button
              onClick={addRule}
              className="w-full h-10 rounded-lg border-2 border-dashed border-slate-300 text-slate-600 font-medium hover:border-slate-900 hover:text-slate-900 transition-colors flex items-center justify-center gap-2"
              title="Add a new reminder rule"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>

            {/* Save Button */}
            {rules.length > 0 && (
              <button
                onClick={saveRules}
                className="w-full h-10 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium transition-colors flex items-center justify-center gap-2"
                title="Save all reminder rules"
              >
                <Bell className="w-4 h-4" />
                Save Rules
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
