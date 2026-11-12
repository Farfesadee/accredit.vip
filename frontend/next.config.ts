import type { NextConfig } from "next";

// The couple's portal serves one dashboard on /admin and nothing else, so it is
// built with these rewrites in front. The platform build has none of them.
const PORTAL = process.env.NEXT_PUBLIC_PORTAL_NAME || "";
const PORTAL_EVENT_ID = process.env.NEXT_PUBLIC_PORTAL_EVENT_ID || "";
const PORTAL_EVENT_PATH = PORTAL_EVENT_ID ? `/dashboard/events/${PORTAL_EVENT_ID}` : "/dashboard";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  async rewrites() {
    return {
      beforeFiles: PORTAL
        ? [
            // https://portal.sarahandpatrick.co.uk/admin is the event dashboard.
            // Listed before the catch-all so the exact path wins.
            { source: "/admin", destination: PORTAL_EVENT_PATH },
            // Everything else under /admin is the platform's admin area, which
            // this portal does not serve. Send those to the couple's login.
            { source: "/admin/:path*", destination: "/login" },
            // The portal has one entry point: the sign-in screen.
            { source: "/", destination: "/login" },
          ]
        : [],
      afterFiles: [
        { source: "/uploads/:path*", destination: "http://localhost:8000/uploads/:path*" },
      ],
      fallback: [],
    };
  },
};

export default nextConfig;
