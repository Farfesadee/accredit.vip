"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Plus, Trash2, HelpCircle, Eye, Save, Loader, AlertTriangle } from "lucide-react";

type QuestionsTabContentProps = {
  eventId: string;
};

export default function QuestionsTabContent({ eventId }: QuestionsTabContentProps) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);

    apiClient<any[]>(`/rsvp-questions/${eventId}`)
      .then(setQuestions)
      .catch(() => setError("Failed to load questions."))
      .finally(() => setLoading(false));
  }, [eventId]);

  const addQuestion = () =>
    setQuestions((prev) => [...prev, { label: "", type: "text", required: false, options: null }]);

  const update = (i: number, field: string, value: any) => {
    setQuestions((prev) => prev.map((q, j) => (j === i ? { ...q, [field]: value } : q)));
  };

  const remove = (i: number) => setQuestions((prev) => prev.filter((_, j) => j !== i));

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await apiClient(`/rsvp-questions/${eventId}`, { method: "POST", body: questions });
      setSaveSuccess(true);
    } catch (err: any) {
      setSaveError(err.message || "Error saving questions");
    }
    setSaving(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-secondary flex items-center gap-2">
          <HelpCircle className="w-5 h-5" />
          RSVP Questions
        </h2>
        <p className="text-sm text-slate-500 mt-1">Add questions guests must answer before confirming attendance</p>
      </div>

      <div className="rounded-xl bg-gradient-to-r from-blue-50 to-sky-50 border border-blue-200 p-5 flex gap-3">
        <HelpCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-semibold mb-1">How it works</p>
          <p>Questions appear on guests&apos; RSVP pages. Required questions must be answered before they can confirm. Supports text, dropdown, and checkbox types.</p>
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
          Questions saved!
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
            {questions.map((q, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                    Question {i + 1}{q.required && <span className="text-red-500 font-bold text-[10px] bg-red-50 px-1.5 py-0.5 rounded">REQUIRED</span>}
                  </span>
                  <button onClick={() => remove(i)} className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
                <div className="space-y-3">
                  <input
                    placeholder="e.g. What meal would you prefer?"
                    value={q.label}
                    onChange={(e) => update(i, "label", e.target.value)}
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-slate-400"
                  />
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={q.type}
                      onChange={(e) => update(i, "type", e.target.value)}
                      className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="text">Text (short answer)</option>
                      <option value="select">Dropdown (choose one)</option>
                      <option value="checkbox">Checkbox (yes/no)</option>
                    </select>
                    <label className="flex items-center gap-2 text-sm h-10 px-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer transition-colors select-none">
                      <input type="checkbox" checked={q.required} onChange={(e) => update(i, "required", e.target.checked)} className="w-4 h-4 accent-primary" />
                      Required
                    </label>
                  </div>
                  {q.type === "select" && (
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1.5 block">Options (one per line)</label>
                      <textarea
                        placeholder="Chicken&#10;Fish&#10;Vegetarian"
                        value={q.options?.join("\n") || ""}
                        onChange={(e) => update(i, "options", e.target.value.split("\n").map((s: string) => s.trim()).filter(Boolean))}
                        rows={3}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button onClick={addQuestion} className="w-full h-10 rounded-xl border-2 border-dashed border-slate-300 text-slate-600 font-medium hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2 bg-white hover:bg-slate-50">
            <Plus className="w-4 h-4" />
            Add Question
          </button>

          {questions.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Preview
              </h3>
              <div className="space-y-2">
                {questions.map((q, i) => (
                  <div key={i} className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
                    <p className="text-sm font-medium text-slate-900">{q.label || "Untitled question"}{q.required ? <span className="text-red-500 ml-1">*</span> : ""}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {q.type === "text" ? "Short answer text field" : q.type === "select" ? "Dropdown selection" : "Yes/No checkbox"}
                      {q.options?.length > 0 ? `: ${q.options.join(", ")}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {questions.length > 0 && (
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-medium transition-colors disabled:opacity-50 h-10 px-4 text-sm shadow-sm">
              {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving..." : "Save Questions"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
