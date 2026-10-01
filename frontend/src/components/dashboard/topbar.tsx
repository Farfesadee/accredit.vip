"use client";

import Link from "next/link";
import { Menu, Plus } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";

export function DashboardTopbar({
  title,
  subtitle,
  onMenuClick,
  actions,
}: {
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <header className="h-16 flex items-center justify-between px-6 flex-shrink-0" style={{ background: "white", borderBottom: "1px solid #e8edf2" }}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button onClick={onMenuClick} className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0">
          <Menu className="w-5 h-5 text-[#0D1B2A]" />
        </button>
        <div className="min-w-0">
          <h1 className="text-sm sm:text-lg font-bold text-[#0D1B2A] sm:truncate">{title}</h1>
          {subtitle && <p className="text-xs text-gray-400 sm:truncate">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <NotificationBell />
        {actions || (
          <Link href="/dashboard/create" className="btn-primary text-xs py-1.5 sm:py-2 px-2 sm:px-4 inline-flex items-center gap-1 sm:gap-2">
            <Plus className="w-4 h-4" />
            <span className="max-[400px]:hidden">New Event</span>
          </Link>
        )}
      </div>
    </header>
  );
}
