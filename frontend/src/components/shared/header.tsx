"use client";

import Link from "next/link";
import Image from "next/image";
import { User, LogOut } from "lucide-react";

interface HeaderProps {
  showNav?: boolean;
  userFullName?: string;
  onLogout?: () => void;
  dashboardLink?: string;
}

export function Header({ showNav = true, userFullName, onLogout, dashboardLink = "/dashboard" }: HeaderProps) {
  return (
    <header className="border-b bg-white sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition flex-shrink-0">
          <Image src="/logo-mark.png" alt="" width={200} height={40} className="h-10 w-auto object-contain" priority />
          <Image src="/logo-text.png" alt="Accredit Interactive" width={594} height={152} className="h-6 w-auto object-contain" priority />
        </Link>

        {showNav && (
          <nav className="flex items-center gap-4 ml-auto">
            <Link href={dashboardLink} className="text-sm font-medium text-muted-foreground hover:text-foreground transition">
              Dashboard
            </Link>
            {userFullName && (
              <div className="flex items-center gap-3 pl-4 border-l">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{userFullName}</span>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="ml-2 p-1.5 rounded-lg hover:bg-gray-100 transition"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
