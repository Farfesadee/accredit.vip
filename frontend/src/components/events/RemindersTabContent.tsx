"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Plus, Bell, Save, Info, Loader, AlertTriangle } from "lucide-react";

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

type RemindersTabContentProps = {
  eventId: string;
};

export default function RemindersTabContent({ eventId }: RemindersTabContentProps) {
  const [rules, setRules] = useState<Rule[]>([{ ...DEFAULT_RULE }]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);

    apiClient<any>(`/events/${eventId}/settings`)
      .then((s) => {
        if (s.reminder_rules) {
          setRules(s.reminder_rules.length > 0 ? s.reminder_rules : [{ ...DEFAULT_RULE }]);
        }
      })
      .catch(() => setError("Failed to load reminder settings."))
      .finally(() => setLoading(false));
  }, [eventId]);

  const updateRule = (i: number, field: string, value: any) => {
    setRules((prev) => prev.map((r, j) => (j === i ? { ...r, [field]: value } : r)));
  };

  const addRule = () => setRules((prev) => [...prev, { ...DEFAULT_RULE }]);

  const removeRule = (i: number) => setRules((prev) => prev.filter((_, j) => j !== i));

  const saveRules = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await apiClient(`/events/${eventId}/settings`, { method: "PUT", body: { reminder_rules: rules } });
      setSaveSuccess(true);
    } catch (err: any) {
      setSaveError(err.message || "Error saving rules");
    }
    setSaving(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-secondary flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Reminder Rules
        </h2>
        <p className="text-sm text-slate-500 mt-1">Automatically remind guests before your event</p>
      </div>

      <div className="rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-5 flex gap-3">
        <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900">
          <p className="font-semibold mb-1">How reminders work</p>
          <p>Guests receive automatic reminders based on these rules. Use variables like <code className="bg-amber-100/60 px-1.5 py-0.5 rounded text-xs font-mono">{'{{event_title}}'}</code>, <code className="bg-amber-100/60 px-1.5 py-0.5 rounded text-xs font-mono">{'{{event_date}}'}</code>, and <code className="bg-amber-100/60 px-1.5 py-0.5 rounded text-xs font-mono">{'{{venue}}'}</code> in your message.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {saveSuccess && (
        <div className="rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 p-3 text-sm font-medium">
          Reminder rules saved!
        </div>
      )}

      {saveError && (
        <div className="rounded-lg bg-red-50 text-red-700 border border-red-200 p-3 text-sm font-medium">
          {saveError}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {rules.map((rule, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-secondary flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                    Rule {i + 1}
                  </h3>
                  <button onClick={() => removeRule(i)} className="text-sm text-red-600 hover:text-red-700 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">Remove</button>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-sm text-slate-600">Send</span>
                    <select value={rule.offset_value} onChange={(e) => updateRule(i, "offset_value", Number(e.target.value))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      {[1, 2, 3, 7, 14].map((n) => (<option key={n} value={n}>{n}</option>))}
                    </select>
                    <select value={rule.offset_unit} onChange={(e) => updateRule(i, "offset_unit", e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="hours">hour(s)</option>
                      <option value="days">day(s)</option>
                      <option value="weeks">week(s)</option>
                    </select>
                    <select value={rule.trigger} onChange={(e) => updateRule(i, "trigger", e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="before_event">before event</option>
                      <option value="after_rsvp">after RSVP</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1.5 block">Delivery Channel</label>
                    <select value={rule.channel} onChange={(e) => updateRule(i, "channel", e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="email">Email</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="sms">SMS</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1.5 block">Message Template</label>
                    <textarea
                      placeholder='Message (use {{event_title}}, {{event_date}}, {{venue}})'
                      value={rule.message}
                      onChange={(e) => updateRule(i, "message", e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={addRule} className="w-full h-10 rounded-xl border-2 border-dashed border-slate-300 text-slate-600 font-medium hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2 bg-white hover:bg-slate-50">
            <Plus className="w-4 h-4" /> Add Rule
          </button>

          <button onClick={saveRules} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-medium transition-colors disabled:opacity-50 h-10 px-4 text-sm shadow-sm">
            {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving..." : "Save Reminder Rules"}
          </button>
        </>
      )}
    </div>
  );
}
