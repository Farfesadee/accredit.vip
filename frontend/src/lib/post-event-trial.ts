/**
 * POST EVENT Trial Mode - allows users to test creating public events before signing up
 */

const TRIAL_KEY = "post_event_trial_data";

export interface PostEventTrialData {
  title: string;
  host_name: string;
  event_date: string;
  event_time: string;
  venue: string;
  description: string;
  guest_count_range: string;
  event_type: string;
  category?: string;
  currency?: string;
  ticket_price?: number;
  pass_packages?: any[];
  lineup?: any[];
  created_at: string;
}

/**
 * Save trial event data to sessionStorage
 */
export function saveTrialEvent(eventData: Partial<PostEventTrialData>): void {
  const trialData: PostEventTrialData = {
    title: eventData.title || "",
    host_name: eventData.host_name || "",
    event_date: eventData.event_date || "",
    event_time: eventData.event_time || "",
    venue: eventData.venue || "",
    description: eventData.description || "",
    guest_count_range: eventData.guest_count_range || "1-100",
    event_type: eventData.event_type || "concert",
    category: eventData.category,
    ticket_price: eventData.ticket_price,
    pass_packages: eventData.pass_packages,
    lineup: eventData.lineup,
    created_at: new Date().toISOString(),
  };

  sessionStorage.setItem(TRIAL_KEY, JSON.stringify(trialData));
}

/**
 * Get saved trial event data (sessionStorage first, fallback to localStorage for backwards compat)
 */
export function getTrialEvent(): PostEventTrialData | null {
  const saved = sessionStorage.getItem(TRIAL_KEY) || localStorage.getItem("accredit_post_event_trial");
  if (!saved) return null;

  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

/**
 * Clear trial event data
 */
export function clearTrialEvent(): void {
  sessionStorage.removeItem(TRIAL_KEY);
  localStorage.removeItem("accredit_post_event_trial");
}

/**
 * Check if trial event exists
 */
export function hasTrialEvent(): boolean {
  return sessionStorage.getItem(TRIAL_KEY) !== null || localStorage.getItem("accredit_post_event_trial") !== null;
}
