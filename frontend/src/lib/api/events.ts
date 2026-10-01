import { apiClient } from "@/lib/api-client";
import type { PassPackage } from "@/lib/event-form-options";

type SavedLineupPerson = {
  role: string;
  name: string;
  attach_headshot?: boolean;
  headshot_source?: "upload" | "ai";
  headshot_file_name?: string;
  generated_headshot?: boolean;
};

export type EventData = {
  id: number;
  title: string;
  event_type: string;
  host_name: string;
  event_date: string;
  event_time: string;
  timezone: string;
  venue: string;
  city: string | null;
  state: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  guest_count_range: string;
  status: string;
  is_public: boolean;
  spotlight?: boolean;
  category: string | null;
  description: string | null;
  dress_code: string | null;
  male_dress_code: string | null;
  female_dress_code: string | null;
  map_link: string | null;
  cover_image: string | null;
  ticket_price: number | null;
  currency: string;
  tickets_available: number | null;
  pass_packages: PassPackage[] | null;
  lineup: SavedLineupPerson[] | null;
  after_party_enabled: boolean;
  after_party_location: string | null;
  after_party_time: string | null;
  slug: string | null;
  distance_km?: number;
  invite_subject?: string | null;
  invite_body?: string | null;
};

export type EventFilters = {
  search?: string;
  category?: string;
  location?: string;
  month?: number;
  price_type?: string;
  date_from?: string;
  date_to?: string;
  near_lat?: number;
  near_lng?: number;
  radius_km?: number;
  sort_by?: string;
  past_only?: boolean;
};

export type CreateEventInput = {
  title: string;
  event_type: string;
  host_name: string;
  event_date: string;
  event_time: string;
  timezone?: string;
  venue: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  guest_count_range: string;
  is_public?: boolean;
  category?: string;
  description?: string;
  dress_code?: string;
  male_dress_code?: string;
  female_dress_code?: string;
  map_link?: string;
  cover_image?: string;
  ticket_price?: number;
  currency?: string;
  tickets_available?: number;
  pass_packages?: PassPackage[];
  lineup?: SavedLineupPerson[];
  after_party_enabled?: boolean;
  after_party_location?: string;
  after_party_time?: string;
  qr_delivery?: string;

  qr_message?: string;
  invite_subject?: string;
  invite_body?: string;
};

export async function getEvents(filters?: EventFilters): Promise<EventData[]> {
  const params = new URLSearchParams();
  if (filters?.search) params.set("search", filters.search);
  if (filters?.category) params.set("category", filters.category);
  if (filters?.date_from) params.set("date_from", filters.date_from);
  if (filters?.date_to) params.set("date_to", filters.date_to);
  const qs = params.toString();
  return apiClient(`/events/${qs ? `?${qs}` : ""}`);
}

export async function getPublicEvents(filters?: EventFilters): Promise<EventData[]> {
  const params = new URLSearchParams();
  if (filters?.search) params.set("search", filters.search);
  if (filters?.category) params.set("category", filters.category);
  if (filters?.location) params.set("location", filters.location);
  if (filters?.month) params.set("month", String(filters.month));
  if (filters?.price_type) params.set("price_type", filters.price_type);
  if (filters?.date_from) params.set("date_from", filters.date_from);
  if (filters?.date_to) params.set("date_to", filters.date_to);
  if (filters?.near_lat) params.set("near_lat", String(filters.near_lat));
  if (filters?.near_lng) params.set("near_lng", String(filters.near_lng));
  if (filters?.radius_km) params.set("radius_km", String(filters.radius_km));
  if (filters?.sort_by) params.set("sort", filters.sort_by);
  if (filters?.past_only) params.set("past_only", "true");
  const qs = params.toString();
  return apiClient(`/events/public${qs ? `?${qs}` : ""}`);
}

export async function getEvent(id: number): Promise<EventData> {
  return apiClient(`/events/${id}`);
}

export async function createEvent(data: CreateEventInput): Promise<EventData> {
  return apiClient("/events/", {
    method: "POST",
    body: data,
  });
}

export async function updateEvent(id: number, data: CreateEventInput): Promise<EventData> {
  return apiClient(`/events/${id}`, {
    method: "PUT",
    body: data,
  });
}

export async function deleteEvent(id: number): Promise<void> {
  return apiClient(`/events/${id}`, {
    method: "DELETE",
  });
}
