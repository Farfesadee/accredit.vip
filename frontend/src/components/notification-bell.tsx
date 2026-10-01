"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface NotificationItem {
  id: number;
  title: string;
  message: string;
  notification_type: string;
  created_at: string;
  read: boolean;
  data?: Record<string, any>;
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.setValueAtTime(1000, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

export function NotificationBell({ admin = false }: { admin?: boolean }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [ringing, setRinging] = useState(false);
  const prevUnread = useRef(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const ringRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await apiClient<any[]>("/notifications?limit=10");
      setNotifications(data || []);
      const u = (data || []).filter((n: NotificationItem) => !n.read).length;
      if (u > prevUnread.current && prevUnread.current > 0) {
        playNotificationSound();
      }
      prevUnread.current = u;
      setUnread(u);
    } catch {}
  }, []);

  useEffect(() => {
    fetchNotifications();
    pollRef.current = setInterval(fetchNotifications, 15000);
    ringRef.current = setInterval(() => {
      if (unread > 0) {
        setRinging(true);
        setTimeout(() => setRinging(false), 600);
      }
    }, 30000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (ringRef.current) clearInterval(ringRef.current);
    };
  }, [fetchNotifications, unread]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const markRead = async (id: number) => {
    try {
      await apiClient(`/notifications/${id}/read`, { method: "PUT" });
      fetchNotifications();
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await apiClient("/notifications/read-all", { method: "PUT" });
      fetchNotifications();
    } catch {}
  };

  const bgColor = admin ? "bg-[#f0f1f7]" : "bg-[#f0f1f7]";
  const dropdownBg = admin ? "bg-white border border-[#e8edf2]" : "bg-white border border-[#e8edf2]";

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}
        className={`relative p-2.5 rounded-xl ${bgColor} hover:bg-[#e8edf2] transition-all hover:scale-110 hover:shadow-lg ${ringing ? "animate-bell-swing" : ""} ${unread > 0 ? "ring-2 ring-[#1ABC9C]/30 ring-offset-2" : ""}`}
        style={unread > 0 ? { boxShadow: "0 0 20px rgba(26, 188, 156,0.2)" } : {}}
      >
        <Bell className={`w-5 h-5 text-[#64748b] transition-all ${unread > 0 ? "text-[#1ABC9C]" : ""} ${ringing ? "animate-bell-swing" : ""}`} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-[#1ABC9C] text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse shadow-lg">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute right-0 mt-2 w-80 rounded-2xl shadow-2xl ${dropdownBg} z-50 max-h-96 overflow-y-auto backdrop-blur-sm`} style={{ animation: "slide-down-soft 0.3s ease-out" }}>
          <div className="flex items-center justify-between px-4 py-4 border-b border-[#e8edf2] bg-gradient-to-r from-white to-[#f8f9fc]">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#0D1B2A]">Notifications</span>
              {unread > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-[#1ABC9C] rounded-full">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </div>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-[#1ABC9C] font-bold hover:text-[#16A085] transition-colors">Mark all read</button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#94a3b8]">No notifications</div>
          ) : (
            notifications.map((n, idx) => (
              <div
                key={n.id}
                onClick={() => { if (!n.read) markRead(n.id); }}
                className={`px-4 py-3 border-b border-[#e8edf2] hover:bg-[#f8f9fc] cursor-pointer transition-all duration-200 ${!n.read ? "bg-[#fef2f8]" : "hover:shadow-inset"}`}
                style={{ animation: `slide-down-soft 0.3s ease-out ${0.05 * idx}s backwards` }}
              >
                <div className="flex items-start gap-2">
                  {!n.read && <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-[#1ABC9C] animate-pulse" />}
                  {n.read && <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-transparent" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-[#0D1B2A] truncate flex-1">{n.title}</p>
                      {!n.read && <span className="inline-flex w-1.5 h-1.5 bg-[#1ABC9C] rounded-full flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-[#64748b] mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-[#94a3b8] mt-1">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
