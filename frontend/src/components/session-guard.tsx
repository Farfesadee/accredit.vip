"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { PORTAL } from "@/lib/portal";

const PROTECTED_ROUTES = ["/dashboard", "/admin", "/create-event"];

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    // Wait until auth has initialized before deciding anything.
    if (loading) return;

    const isProtectedRoute = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
    // The pickup portal handles its own gate (separate staff login at
    // /dashboard/pickups/login), so the global redirect must not hijack it.
    const isPickupRoute = pathname.startsWith("/dashboard/pickups");

    // Unauthenticated visitors get sent to login. Authenticated users are
    // NEVER logged out for navigating: sessions persist across public
    // pages, tab switches, and browser restarts (until token/idle expiry).
    // The couple's portal has only one login, so its /admin shortcut goes
    // there rather than to the platform's admin gate, which it does not serve.
    if (!user && isProtectedRoute && !isPickupRoute) {
      router.push(PORTAL || !pathname.startsWith("/admin") ? "/login" : "/admin/login");
    }
  }, [pathname, user, loading, router]);

  return <>{children}</>;
}
