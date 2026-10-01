"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

/** Admin sidebar sign-out with an "Are you sure?" confirm step. */
export function AdminLogoutButton({ collapsed = false }: { collapsed?: boolean }) {
  const { logout } = useAuth();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500 text-white font-bold text-sm transition-all hover:bg-red-600 active:scale-95"
      >
        <LogOut className="w-5 h-5" />
        {!collapsed && <span>Logout</span>}
      </button>
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirming(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-black text-[#0D1B2A]">Sign out?</h3>
            <p className="text-sm text-[#64748b] mt-1">Are you sure you want to log out of the admin panel?</p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 py-2.5 rounded-xl border-2 border-[#e8edf2] text-sm font-bold text-[#64748b] hover:bg-[#f8fafc]"
              >
                Cancel
              </button>
              <button
                onClick={() => { setConfirming(false); logout(); }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-sm font-bold text-white hover:bg-red-600"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
