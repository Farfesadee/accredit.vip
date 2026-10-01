"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { Copy, FolderOpen, Save, Loader, AlertTriangle } from "lucide-react";

type TemplatesTabContentProps = {
  eventId: string;
};

export default function TemplatesTabContent({ eventId }: TemplatesTabContentProps) {
  const router = useRouter();
  const [templates, setTemplates] = useState<any[]>([]);
  const [eventData, setEventData] = useState<any>(null);
  const [templateName, setTemplateName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    Promise.all([
      apiClient<any[]>("/event-templates"),
      apiClient<any>(`/events/${eventId}`),
    ])
      .then(([tmpl, evt]) => {
        setTemplates(tmpl);
        setEventData(evt);
      })
      .catch(() => setError("Failed to load data."))
      .finally(() => setLoading(false));
  }, [eventId]);

  const saveAsTemplate = async () => {
    if (!templateName || !eventData) return;
    setSaving(true);
    setSaveError(null);
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
      setSaveError(err.message || "Failed to save template");
    }
    setSaving(false);
  };

  const loadTemplate = (template: any) => {
    router.push(`/dashboard/create?template=${template.id}`);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-secondary flex items-center gap-2">
          <Copy className="w-5 h-5" />
          Event Templates
        </h2>
        <p className="text-sm text-slate-500 mt-1">Save this event as a template to reuse later</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
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
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-secondary flex items-center gap-2 mb-4">
              <Save className="w-4 h-4" />
              Save Current Event as Template
            </h3>
            <div className="space-y-3">
              <input
                placeholder="e.g. Monthly Networking, Annual Conference"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-slate-400"
              />
              <button onClick={saveAsTemplate} disabled={!templateName || saving} className="w-full h-10 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm">
                {saving ? "Saving..." : "Save Template"}
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-secondary mb-3 flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              Your Templates ({templates.length})
            </h3>
            {templates.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 sm:p-16 text-center bg-slate-50">
                <Copy className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-sm font-medium text-slate-600">No templates saved yet</p>
                <p className="text-xs text-slate-400 mt-1">Save your first template above</p>
              </div>
            ) : (
              <div className="grid gap-2">
                {templates.map((t) => (
                  <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md transition-shadow flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-secondary truncate">{t.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-medium uppercase">{t.mode}</span>
                        <span>·</span>
                        {t.created_at
                          ? new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : "Unknown date"}
                      </p>
                    </div>
                    <button onClick={() => loadTemplate(t)} className="ml-4 px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex-shrink-0 shadow-sm">
                      Use Template
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
