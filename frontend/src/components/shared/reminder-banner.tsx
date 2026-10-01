"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Bell } from "lucide-react";

type ReminderEvent = { id: number; title: string };

export function ReminderBanner() {
  const [reminders, setReminders] = useState<ReminderEvent[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem("event_reminders");
    if (!raw) return;
    try {
      const map: Record<number, string> = JSON.parse(raw);
      const list = Object.entries(map).map(([id, title]) => ({
        id: Number(id),
        title,
      }));
      setReminders(list);
    } catch {}
  }, []);

  if (reminders.length === 0) return null;

  const dismiss = (id: number) => {
    const map: Record<number, string> = JSON.parse(localStorage.getItem("event_reminders") || "{}");
    delete map[id];
    localStorage.setItem("event_reminders", JSON.stringify(map));
    setReminders((cur) => cur.filter((r) => r.id !== id));
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
      {reminders.map((r) => (
        <div
          key={r.id}
          className="flex items-center gap-3 rounded-2xl bg-[#0D1B2A] text-white px-4 py-3 shadow-xl border border-white/10 animate-slideUp"
        >
          <Bell className="w-5 h-5 flex-shrink-0 text-[#1ABC9C]" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{r.title}</p>
            <p className="text-[10px] text-white/50">You saved this event</p>
          </div>
          <Link
            href={`/events/${r.id}`}
            className="text-[10px] font-bold text-[#1ABC9C] hover:underline whitespace-nowrap flex-shrink-0"
          >
            View
          </Link>
          <button
            onClick={() => dismiss(r.id)}
            className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors flex-shrink-0"
          >
            <X className="w-3.5 h-3.5 text-white/50" />
          </button>
        </div>
      ))}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
      `}</style>
    </div>
  );
}