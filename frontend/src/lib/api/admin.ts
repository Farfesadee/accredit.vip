import { apiClient, API_BASE } from "@/lib/api-client";

export type AdminStats = {
  users: number;
  events: number;
  guests: number;
  payments: number;
  checkins: number;
  tickets: number;
  accreditation_requests: number;
  total_revenue: number;
  pending_reviews: number;
};

export type AdminUser = {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login?: string | null;
};

export type AdminUserDetail = AdminUser & {
  phone: string | null;
  is_verified: boolean;
  event_count: number;
  payment_count: number;
  ticket_count: number;
};

export type AdminEvent = {
  id: number;
  title: string;
  event_type: string;
  status: string;
  is_public: boolean;
  organizer: string;
  created_at: string;
};

export type AdminEventDetail = {
  id: number;
  title: string;
  event_type: string;
  host_name: string;
  event_date: string;
  event_time: string;
  timezone: string;
  venue: string | null;
  description: string;
  status: string;
  is_public: boolean;
  category: string;
  organizer: string;
  cover_image: string;
  guest_count: number;
  checkin_count: number;
  revenue: number;
  created_at: string;
};

export type RevenueRow = {
  provider: string;
  count: number;
  total: number;
};

export type TimelinePoint = {
  date: string;
  count: number;
};

export type RevenueTimelinePoint = {
  date: string;
  revenue: number;
  transactions: number;
};

export type DeliveryStats = {
  total_batches: number;
  total_messages: number;
  delivered: number;
  failed: number;
  pending: number;
  by_channel: Record<string, number>;
};

export type DeliveryClient = {
  organizer_id: number;
  full_name: string;
  email: string;
  total_events: number;
  total_messages: number;
  delivered: number;
  failed: number;
  queued: number;
  sending: number;
};

export type DeliveryClientsResponse = {
  total: number;
  page: number;
  per_page: number;
  clients: DeliveryClient[];
};

export type DeliveryClientDetail = {
  organizer: { id: number; full_name: string; email: string };
  events: {
    event_id: number;
    title: string;
    total_guests: number;
    delivered: number;
    failed: number;
    queued: number;
    sending: number;
  }[];
};

export type DeliveryEventGuest = {
  message_id: number;
  guest_id: number;
  name: string;
  email: string | null;
  phone: string | null;
  channel: string;
  status: string;
  error: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
};

export type DeliveryEventDetail = {
  event: { id: number; title: string; organizer_id: number };
  status_counts: { delivered: number; failed: number; queued: number; sending: number; total: number };
  total: number;
  page: number;
  per_page: number;
  guests: DeliveryEventGuest[];
};

export async function getAdminDeliveryClients(
  page: number = 1,
  per_page: number = 50,
  search?: string
): Promise<DeliveryClientsResponse> {
  const params = new URLSearchParams({ page: String(page), per_page: String(per_page) });
  if (search) params.set("search", search);
  return apiClient(`/admin/delivery/clients?${params}`);
}

export async function getAdminDeliveryClientDetail(organizerId: number): Promise<DeliveryClientDetail> {
  return apiClient(`/admin/delivery/clients/${organizerId}`);
}

export async function getAdminDeliveryEventGuests(
  eventId: number,
  page: number = 1,
  per_page: number = 50,
  filters?: { status?: string; channel?: string; search?: string }
): Promise<DeliveryEventDetail> {
  const params = new URLSearchParams({ page: String(page), per_page: String(per_page) });
  if (filters?.status) params.set("status", filters.status);
  if (filters?.channel) params.set("channel", filters.channel);
  if (filters?.search) params.set("search", filters.search);
  return apiClient(`/admin/delivery/events/${eventId}/guests?${params}`);
}

export type SupportTicket = {
  id: number;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  user_name: string;
  user_email: string;
};

export type CheckInLog = {
  id: number;
  guest_name: string;
  guest_email: string;
  event_title: string;
  event_id: number;
  scanned_by: string;
  checked_in_at: string;
};

export type StaffAssignment = {
  id: number;
  staff_name: string;
  staff_email: string;
  event_title: string;
  role: string;
  assigned_at: string;
};

export type PaymentRecord = {
  id: number;
  amount: number;
  currency: string;
  provider: string;
  reference: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  event_title: string;
  organizer_name: string;
};

export type TicketPurchaseRecord = {
  id: number;
  reference: string;
  event_title: string;
  buyer_name: string;
  buyer_email: string;
  quantity: number;
  amount: number;
  platform_fee: number;
  status: string;
  created_at: string;
};

export type AuditLogEntry = {
  id: number;
  user_id: number | null;
  action: string;
  resource: string;
  resource_id: number | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
};

export type FraudFlags = {
  inactive_users: number;
  unverified_users: number;
  failed_payments: number;
  failed_deliveries: number;
  flagged_events: number;
};

export type AccreditationRequest = {
  id: number;
  staff_count: number;
  scanner_rental: boolean;
  status: string;
  notes: string;
  event_title: string;
  organizer_name: string;
  created_at: string;
};

export type PaginatedResponse<T> = {
  total: number;
  page: number;
  per_page: number;
};

export type UserListResponse = PaginatedResponse<AdminUser> & { users: AdminUser[] };
export type EventListResponse = PaginatedResponse<AdminEvent> & { events: AdminEvent[] };
export type CheckinListResponse = PaginatedResponse<CheckInLog> & { checkins: CheckInLog[] };
export type PaymentListResponse = PaginatedResponse<PaymentRecord> & { payments: PaymentRecord[] };
export type TicketPurchaseListResponse = PaginatedResponse<TicketPurchaseRecord> & { ticket_purchases: TicketPurchaseRecord[] };
export type AuditLogResponse = PaginatedResponse<AuditLogEntry> & { logs: AuditLogEntry[] };

export async function getAdminStats(): Promise<AdminStats> {
  return apiClient("/admin/stats");
}

export async function getAdminUsers(params?: {
  search?: string;
  role?: string;
  is_active?: boolean;
  page?: number;
  per_page?: number;
}): Promise<UserListResponse> {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.role) q.set("role", params.role);
  if (params?.is_active !== undefined) q.set("is_active", String(params.is_active));
  if (params?.page) q.set("page", String(params.page));
  if (params?.per_page) q.set("per_page", String(params.per_page));
  return apiClient(`/admin/users?${q.toString()}`);
}

export async function getAdminUserDetail(userId: number): Promise<AdminUserDetail> {
  return apiClient(`/admin/users/${userId}`);
}

export async function getAdminEvents(params?: {
  search?: string;
  status?: string;
  event_type?: string;
  is_public?: boolean;
  page?: number;
  per_page?: number;
}): Promise<EventListResponse> {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.status) q.set("status", params.status);
  if (params?.event_type) q.set("event_type", params.event_type);
  if (params?.is_public !== undefined) q.set("is_public", String(params.is_public));
  if (params?.page) q.set("page", String(params.page));
  if (params?.per_page) q.set("per_page", String(params.per_page));
  return apiClient(`/admin/events?${q.toString()}`);
}

export async function getAdminEventDetail(eventId: number): Promise<AdminEventDetail> {
  return apiClient(`/admin/events/${eventId}`);
}

export async function getAdminRevenue(): Promise<RevenueRow[]> {
  return apiClient("/admin/revenue");
}

export async function getAdminRevenueTimeline(days: number = 30): Promise<RevenueTimelinePoint[]> {
  return apiClient(`/admin/revenue/timeline?days=${days}`);
}

export async function getAdminUsersTimeline(days: number = 30): Promise<TimelinePoint[]> {
  return apiClient(`/admin/users/timeline?days=${days}`);
}

export async function getAdminEventsTimeline(days: number = 30): Promise<TimelinePoint[]> {
  return apiClient(`/admin/events/timeline?days=${days}`);
}

export async function updateUserRole(userId: number, role: string): Promise<void> {
  return apiClient(`/admin/users/${userId}/role?role=${role}`, { method: "PATCH" });
}

export async function getAdminDeliveryStats(): Promise<DeliveryStats> {
  return apiClient("/admin/delivery-stats");
}

export async function getAdminTickets(status?: string): Promise<SupportTicket[]> {
  const q = status ? `?status=${status}` : "";
  return apiClient(`/admin/tickets${q}`);
}

export async function updateTicketStatus(
  ticketId: number,
  status: string,
  assignedTo?: number
): Promise<void> {
  let url = `/admin/tickets/${ticketId}?status=${status}`;
  if (assignedTo) url += `&assigned_to=${assignedTo}`;
  return apiClient(url, { method: "PATCH" });
}

export async function getAdminCheckins(page: number = 1, per_page: number = 50): Promise<CheckinListResponse> {
  return apiClient(`/admin/checkins?page=${page}&per_page=${per_page}`);
}

export async function getAdminStaff(): Promise<StaffAssignment[]> {
  return apiClient("/admin/staff");
}

export async function createStaffAssignment(userId: number, eventId: number, role: string = "accreditation"): Promise<void> {
  await apiClient(`/admin/staff?user_id=${userId}&event_id=${eventId}&role=${role}`, { method: "POST" });
}

export async function deleteStaffAssignment(assignmentId: number): Promise<void> {
  await apiClient(`/admin/staff/${assignmentId}`, { method: "DELETE" });
}

export async function getAdminPayments(page: number = 1, per_page: number = 50): Promise<PaymentListResponse> {
  return apiClient(`/admin/payments?page=${page}&per_page=${per_page}`);
}

export async function getAdminTicketPurchases(page: number = 1, per_page: number = 50, status?: string): Promise<TicketPurchaseListResponse> {
  const q = new URLSearchParams();
  q.set("page", String(page));
  q.set("per_page", String(per_page));
  if (status) q.set("status", status);
  return apiClient(`/admin/ticket-purchases?${q.toString()}`);
}

export async function getAdminAuditLogs(params?: {
  action?: string;
  page?: number;
  per_page?: number;
}): Promise<AuditLogResponse> {
  const q = new URLSearchParams();
  if (params?.action) q.set("action", params.action);
  if (params?.page) q.set("page", String(params.page));
  if (params?.per_page) q.set("per_page", String(params.per_page));
  return apiClient(`/admin/audit-logs?${q.toString()}`);
}

export async function getAdminFraudFlags(): Promise<FraudFlags> {
  return apiClient("/admin/fraud-flags");
}

export async function getAdminAccreditationRequests(): Promise<AccreditationRequest[]> {
  return apiClient("/admin/accreditation-requests");
}

export type CommunityPost = {
  id: number;
  title: string;
  excerpt: string | null;
  content: string | null;
  tag: string | null;
  image: string | null;
  author: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export async function getAdminCommunityPosts(): Promise<CommunityPost[]> {
  return apiClient("/posts?published=false");
}

export async function createAdminCommunityPost(data: {
  title: string;
  excerpt?: string;
  content?: string;
  tag?: string;
  image?: string;
  author?: string;
  is_published?: boolean;
}): Promise<CommunityPost> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`${API_BASE}/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create post");
  return res.json();
}

export async function updateAdminCommunityPost(postId: number, data: {
  title?: string;
  excerpt?: string;
  content?: string;
  tag?: string;
  image?: string;
  author?: string;
  is_published?: boolean;
}): Promise<CommunityPost> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`${API_BASE}/posts/${postId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update post");
  return res.json();
}

export async function deleteAdminCommunityPost(postId: number): Promise<void> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  await fetch(`${API_BASE}/posts/${postId}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export async function downloadAdminExport(resource: string): Promise<void> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`${API_BASE}/admin/export/${resource}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${resource}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export type DeliveryRecord = {
  id: number;
  organizer_name: string;
  organizer_email: string;
  event_title: string;
  event_id: number;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  channel: string;
  status: string;
  error: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
};

export type DeliveriesResponse = {
  total: number;
  page: number;
  per_page: number;
  deliveries: DeliveryRecord[];
};

export async function getAdminDeliveries(
  page: number = 1,
  per_page: number = 50,
  filters?: {
    organizer_id?: number;
    event_id?: number;
    status?: string;
    channel?: string;
    search?: string;
  }
): Promise<DeliveriesResponse> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const params = new URLSearchParams({
    page: page.toString(),
    per_page: per_page.toString(),
  });

  if (filters?.organizer_id) params.append("organizer_id", filters.organizer_id.toString());
  if (filters?.event_id) params.append("event_id", filters.event_id.toString());
  if (filters?.status) params.append("status", filters.status);
  if (filters?.channel) params.append("channel", filters.channel);
  if (filters?.search) params.append("search", filters.search);

  const res = await fetch(`${API_BASE}/admin/deliveries?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) throw new Error("Failed to fetch deliveries");
  return res.json();
}

export type EventReviewRecord = {
  id: number;
  title: string;
  status: string;
  review_status: string;
  flagged_keywords: string[] | null;
  organizer_name: string;
  organizer_email: string;
  created_at: string;
  review_note: string | null;
};

export type DataGroup = {
  id: number;
  name: string;
  description: string | null;
  category: string;
  profile_count: number;
  is_active: boolean;
  created_at: string;
};

export type DataProfile = {
  id: number;
  group_id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  age_range: string | null;
  gender: string | null;
  income_level: string | null;
  location: string | null;
  consent_given: boolean;
  created_at: string;
};

export type DataRequest = {
  id: number;
  requester_name: string;
  requester_email: string;
  requester_org: string | null;
  group_id: number;
  group_name: string;
  purpose: string;
  status: string;
  notes: string | null;
  requested_at: string;
  resolved_at: string | null;
};

export async function getDataGroups(is_active?: boolean): Promise<DataGroup[]> {
  const params = new URLSearchParams();
  if (is_active !== undefined) params.set("is_active", String(is_active));
  return apiClient(`/admin/data/groups?${params}`);
}

export async function createDataGroup(name: string, description?: string, category?: string, is_active: boolean = true): Promise<{ id: number; name: string; category: string }> {
  const params = new URLSearchParams({ name });
  if (description) params.set("description", description);
  if (category) params.set("category", category);
  params.set("is_active", String(is_active));
  return apiClient(`/admin/data/groups?${params}`, { method: "POST" });
}

export async function updateDataGroup(groupId: number, name?: string, description?: string, is_active?: boolean): Promise<{ message: string }> {
  const params = new URLSearchParams();
  if (name) params.set("name", name);
  if (description !== undefined) params.set("description", description);
  if (is_active !== undefined) params.set("is_active", String(is_active));
  return apiClient(`/admin/data/groups/${groupId}?${params}`, { method: "PATCH" });
}

export async function getDataProfiles(groupId: number, page: number = 1, per_page: number = 50, consent_given?: boolean): Promise<{ total: number; page: number; per_page: number; profiles: DataProfile[] }> {
  const params = new URLSearchParams({ page: String(page), per_page: String(per_page) });
  if (consent_given !== undefined) params.set("consent_given", String(consent_given));
  return apiClient(`/admin/data/groups/${groupId}/profiles?${params}`);
}

export async function importDataProfiles(groupId: number, profiles: Partial<DataProfile>[]): Promise<{ message: string; count: number }> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`${API_BASE}/admin/data/groups/${groupId}/profiles`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(profiles),
  });
  if (!res.ok) throw new Error("Failed to import profiles");
  return res.json();
}

export async function getDataRequests(status?: string): Promise<DataRequest[]> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  return apiClient(`/admin/data/requests?${params}`);
}

export async function submitDataRequest(requester_name: string, requester_email: string, group_id: number, purpose: string, requester_org?: string): Promise<{ id: number; status: string }> {
  const params = new URLSearchParams({ requester_name, requester_email, group_id: String(group_id), purpose });
  if (requester_org) params.set("requester_org", requester_org);
  const res = await fetch(`${API_BASE}/admin/data/requests?${params}`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to submit request");
  return res.json();
}

export async function resolveDataRequest(requestId: number, status: string, notes?: string): Promise<{ message: string }> {
  const params = new URLSearchParams({ status });
  if (notes) params.set("notes", notes);
  return apiClient(`/admin/data/requests/${requestId}?${params}`, { method: "PATCH" });
}

export async function downloadDataExport(groupId: number): Promise<void> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`${API_BASE}/admin/data/export/${groupId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `data_group_export_${groupId}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function changeEmail(newEmail: string, password: string) {
  return apiClient<{ message: string; email: string }>("/auth/email", {
    method: "PUT",
    body: { new_email: newEmail, password },
  });
}
