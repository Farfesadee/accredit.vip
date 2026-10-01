"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  LayoutGrid,
  Lock,
  LogOut,
  Menu,
  Plus,
  Wallet,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/dashboard/events", label: "Events", icon: CalendarDays },
  { href: "/dashboard/create", label: "Create Event", icon: Plus },
  { href: "/dashboard/wallet", label: "Wallet", icon: Wallet },
  { href: "/dashboard/failed-messages", label: "Failed Messages", icon: AlertTriangle },
];

export function DashboardSidebar({
  sidebarOpen,
  onToggleSidebar,
  mobileNavOpen,
  onMobileNavClose,
}: {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  mobileNavOpen: boolean;
  onMobileNavClose: () => void;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    logout();
  };

  function maskEmail(email: string) {
    const [local, domain] = email.split("@");
    if (!local || !domain) return email;
    const visibleStart = local.slice(0, Math.min(8, local.length));
    const visibleEnd = local.length > 1 ? local.slice(-1) : "";
    return `${visibleStart}******${visibleEnd}@${domain}`;
  }

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col transition-all duration-300 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
        style={{
          background: "#0D1B2A",
          width: sidebarOpen ? "256px" : "80px",
        }}
      >
        <div className="flex items-center justify-between h-24 px-4 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Link href="/" onClick={onMobileNavClose} className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
            <Image src="/logo-mark.png" alt="" width={366} height={372} className="h-10 w-auto object-contain flex-shrink-0" />
            {sidebarOpen && <Image src="/logo-text.png" alt="Accredit Interactive" width={594} height={152} className="h-8 w-auto object-contain min-w-0" />}
          </Link>
          <button
            onClick={onToggleSidebar}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0 hidden lg:block ml-2"
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? <X className="w-5 h-5 text-white/80" /> : <Menu className="w-5 h-5 text-white/80" />}
          </button>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {sidebarOpen && <p className="px-3 text-[10px] font-bold text-white/25 uppercase tracking-widest mb-3">Main Menu</p>}

          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onMobileNavClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: active ? "rgba(26, 188, 156,0.15)" : "transparent",
                  color: active ? "#1ABC9C" : "rgba(255,255,255,0.6)",
                }}
                title={!sidebarOpen ? item.label : ""}
              >
                <span className={active ? "text-[#1ABC9C]" : "text-white/40"}><item.icon className="w-4 h-4" /></span>
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 flex-shrink-0 space-y-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: "linear-gradient(135deg, #1ABC9C, #16A085)" }}>
              {user?.full_name?.charAt(0) || "U"}
            </div>
            {sidebarOpen && (
              <div className="min-w-0 flex-1">
                <p className="text-white text-xs font-semibold truncate">{user?.full_name}</p>
                <p className="text-white/40 text-xs truncate" title={user?.email && maskEmail(user.email)}>{user?.email && maskEmail(user.email)}</p>
              </div>
            )}
          </div>

          {sidebarOpen && (
            <>
              <Link href="/dashboard/change-password" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#1ABC9C] bg-[#1ABC9C]/10 hover:bg-[#1ABC9C]/20 transition-all w-full">
                <Lock className="w-4 h-4" />
                Change Password
              </Link>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-red-500 border-2 border-red-200 hover:bg-red-50 hover:border-red-300 font-bold text-sm transition-all"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </>
          )}
        </div>
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={onMobileNavClose} />
      )}

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowLogoutConfirm(false)}>
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[#0D1B2A] mb-2">Sign Out?</h2>
            <p className="text-[#64748b] mb-6">Are you sure you want to sign out?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 px-4 py-2 rounded-lg border border-[#e8edf2] text-[#0D1B2A] font-semibold hover:bg-[#f8f9fc] transition-colors">Cancel</button>
              <button onClick={handleLogout} className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors">Sign Out</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
