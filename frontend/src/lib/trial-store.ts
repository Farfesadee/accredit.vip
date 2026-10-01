// Trial Event Store - Manages localStorage for trial mode data
export interface TrialEvent {
  id: string;
  mode: 'invite' | 'event';
  form: Record<string, any>;
  passPackages: Array<{ name: string; price: string }>;
  socialHandles: Array<{ platform: string; handle: string }>;
  lineup: Array<any>;
  uploadedImageData: any;
  createdAt: string;
  tested: boolean;
  testedVia?: 'email' | 'whatsapp' | 'sms';
  testRecipient?: string;
}

const TRIAL_STORAGE_KEY = 'accredit_trial_events';

export const TrialStore = {
  // Get all trial events
  getAll(): TrialEvent[] {
    try {
      const data = localStorage.getItem(TRIAL_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  // Get specific trial event
  get(id: string): TrialEvent | null {
    const events = this.getAll();
    return events.find(e => e.id === id) || null;
  },

  // Create new trial event
  create(mode: 'invite' | 'event'): TrialEvent {
    const id = `trial_${Date.now()}`;
    const event: TrialEvent = {
      id,
      mode,
      form: {},
      passPackages: [{ name: 'Regular', price: '' }],
      socialHandles: [{ platform: 'instagram', handle: '' }],
      lineup: [{ role: '', name: '', attachHeadshot: true, headshotSource: 'upload', headshotFileName: '', generatedHeadshot: false }],
      uploadedImageData: null,
      createdAt: new Date().toISOString(),
      tested: false,
    };
    this.save(event);
    return event;
  },

  // Save/update trial event
  save(event: TrialEvent): void {
    try {
      const events = this.getAll();
      const index = events.findIndex(e => e.id === event.id);
      if (index >= 0) {
        events[index] = event;
      } else {
        events.push(event);
      }
      localStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify(events));
    } catch (e) {

    }
  },

  // Mark as tested
  markTested(id: string, channel: 'email' | 'whatsapp' | 'sms', recipient: string): void {
    const event = this.get(id);
    if (event) {
      event.tested = true;
      event.testedVia = channel;
      event.testRecipient = recipient;
      this.save(event);
    }
  },

  // Delete trial event
  delete(id: string): void {
    try {
      const events = this.getAll().filter(e => e.id !== id);
      localStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify(events));
    } catch (e) {

    }
  },

  // Get latest tested event
  getLatestTested(): TrialEvent | null {
    const events = this.getAll();
    const tested = events.filter(e => e.tested);
    if (tested.length === 0) return null;
    return tested.reduce((latest, current) =>
      new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest
    );
  },

  // Clear all trial events
  clearAll(): void {
    try {
      localStorage.removeItem(TRIAL_STORAGE_KEY);
    } catch (e) {

    }
  },
};
