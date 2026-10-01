"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";

const PROTECTED_ROUTES = ["/dashboard", "/admin", "/create-event"];

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    // Wait until auth has initialized before deciding anything.
    if (loading) return;

    const isProtectedRoute = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));

    // Unauthenticated visitors get sent to login. Authenticated users are
    // NEVER logged out for navigating: sessions persist across public
    // pages, tab switches, and browser restarts (until token/idle expiry).
    if (!user && isProtectedRoute) {
      router.push(pathname.startsWith("/admin") ? "/admin/login" : "/login");
    }
  }, [pathname, user, loading, router]);

  return <>{children}</>;
}
