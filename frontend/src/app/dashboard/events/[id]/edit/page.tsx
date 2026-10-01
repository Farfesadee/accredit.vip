"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { getEvent, updateEvent, type EventData } from "@/lib/api/events";
import { VenueInput } from "@/components/shared/venue-input";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopbar } from "@/components/dashboard/topbar";
import { AlertTriangle, ArrowLeft } from "lucide-react";

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [event, setEvent] = useState<EventData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    event_type: "wedding",
    host_name: "",
    event_date: "",
    event_time: "",
    timezone: "WAT",
    venue: "",
    guest_count_range: "1-100",
    description: "",
    male_dress_code: "",
    female_dress_code: "",
    map_link: "",
    ticket_price: "",
    tickets_available: "",
    invite_subject: "",
    invite_body: "",
  });
  const [locationData, setLocationData] = useState<{ city: string | null; state: string | null; country: string | null; lat: number | null; lng: number | null }>({ city: null, state: null, country: "Nigeria", lat: null, lng: null });
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }
    if (user && id) {
      setLoadError(false);
      getEvent(Number(id)).then((e) => {
        setEvent(e);
        setForm({
          title: e.title,
          event_type: e.event_type,
          host_name: e.host_name,
          event_date: e.event_date,
          event_time: e.event_time,
          timezone: e.timezone || "WAT",
          venue: e.venue,
          guest_count_range: e.guest_count_range,
          description: e.description || "",
          male_dress_code: e.male_dress_code || "",
          female_dress_code: e.female_dress_code || "",
          map_link: e.map_link || "",
          ticket_price: e.ticket_price?.toString() || "",
          tickets_available: e.tickets_available?.toString() || "",
          invite_subject: e.invite_subject || "",
          invite_body: e.invite_body || "",
        });
      }).catch(() => setLoadError(true));
    }
  }, [user, loading, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await updateEvent(Number(id), {
        ...form,
        dress_code: form.male_dress_code || undefined,
        male_dress_code: form.male_dress_code || undefined,
        female_dress_code: form.female_dress_code || undefined,
        timezone: form.timezone || "WAT",
        is_public: event?.is_public || false,
        category: form.event_type,
        ticket_price: form.ticket_price ? Number(form.ticket_price) : undefined,
        tickets_available: form.tickets_available ? Number(form.tickets_available) : undefined,
        city: locationData.city || event?.city || undefined,
        state: locationData.state || event?.state || undefined,
        country: locationData.country || event?.country || "Nigeria",
        latitude: locationData.lat ?? event?.latitude ?? undefined,
        longitude: locationData.lng ?? event?.longitude ?? undefined,
      });
      router.push(`/dashboard/events/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update event");
    }
    setSubmitting(false);
  };

  if (loading || !user) return null;
  if (loadError) return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-sm">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" aria-hidden="true" />
        <h2 className="text-xl font-semibold">Could not load event</h2>
        <p className="text-sm text-muted-foreground">The event may have been deleted or a network error occurred.</p>
        <button onClick={() => router.push("/dashboard")} className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-accent">Go to Dashboard</button>
      </div>
    </div>
  );
  if (!event) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className={`transition-all duration-300 ${sidebarOpen ? "lg:ml-64" : "lg:ml-20"}`}>
        <DashboardTopbar
          title="Edit Event"
          subtitle={event.title}
          onMenuClick={() => setMobileNavOpen(true)}
        />
      </div>

      <div className="flex flex-1">
        <DashboardSidebar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          mobileNavOpen={mobileNavOpen}
          onMobileNavClose={() => setMobileNavOpen(false)}
        />

        <div className={`flex-1 px-4 py-6 transition-all duration-300 ${sidebarOpen ? "lg:ml-64" : "lg:ml-20"}`}>
          <div className="container mx-auto max-w-7xl">
            <Link href={`/dashboard/events/${id}`} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 mb-6">
              <ArrowLeft className="w-4 h-4" />
              Back to Event
            </Link>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
              <form className="space-y-8 max-w-3xl" onSubmit={handleSubmit}>
                {error && (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                {/* Basic Info Section */}
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 mb-4">Basic Information</h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Event Title</label>
                      <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Event Type</label>
                      <select value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
                        <option value="wedding">Wedding</option>
                        <option value="birthday">Birthday</option>
                        <option value="corporate">Corporate</option>
                        <option value="concert">Concert</option>
                        <option value="conference">Conference</option>
                        <option value="festival">Festival</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Host Name</label>
                      <input value={form.host_name} onChange={(e) => setForm({ ...form, host_name: e.target.value })} className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Guest Count</label>
                      <select value={form.guest_count_range} onChange={(e) => setForm({ ...form, guest_count_range: e.target.value })} className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
                        <option value="1-100">1-100</option>
                        <option value="101-200">101-200</option>
                        <option value="201-400">201-400</option>
                        <option value="400+">400+</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Date & Time Section */}
                <div className="pt-6 border-t border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-900 mb-4">Date & Time</h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Date</label>
                      <input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Time</label>
                      <input type="time" value={form.event_time} onChange={(e) => setForm({ ...form, event_time: e.target.value })} className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" required />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium text-slate-700">Timezone</label>
                      <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
                        <option value="WAT">NG WAT (UTC+1): Lagos, Nigeria</option>
                        <option value="GMT">GH GMT (UTC+0): Accra, Abidjan</option>
                        <option value="EST">US EST (UTC-5): New York</option>
                        <option value="PST">US PST (UTC-8): Los Angeles</option>
                        <option value="CET">FR CET (UTC+1): Paris, Berlin</option>
                        <option value="JST">JP JST (UTC+9): Tokyo</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Location Section */}
                <div className="pt-6 border-t border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-900 mb-4">Location</h2>
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Venue</label>
                      <VenueInput
                        value={form.venue}
                        onChange={(v) => setForm({ ...form, venue: v })}
                        onLocationChange={setLocationData}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Map Link</label>
                      <input value={form.map_link} onChange={(e) => setForm({ ...form, map_link: e.target.value })} className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="Google Maps or similar" />
                    </div>
                  </div>
                </div>

                {/* Details Section */}
                <div className="pt-6 border-t border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-900 mb-4">Details</h2>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Description</label>
                      <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm min-h-[120px] resize-none focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="Tell guests about your event..." />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Dress Code</label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Female</p>
                          <input value={form.female_dress_code} onChange={(e) => setForm({ ...form, female_dress_code: e.target.value })}
                            className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="e.g. Evening gown, Casual" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Male</p>
                          <input value={form.male_dress_code} onChange={(e) => setForm({ ...form, male_dress_code: e.target.value })}
                            className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="e.g. All white, Black tie" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-6 border-t border-slate-200">
                  <Button type="submit" disabled={submitting} className="w-full bg-slate-900 hover:bg-slate-800 text-white h-11 font-medium">
                    {submitting ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
