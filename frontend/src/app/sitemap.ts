import type { MetadataRoute } from "next";

const BASE = "https://accredit.vip";

const STATIC_ROUTES = [
  "",
  "/attend",
  "/pricing",
  "/community",
  "/contact",
  "/create-event",
  "/features/post-invite",
  "/features/post-event",
  "/features/qr-accreditation",
  "/features/guest-management",
  "/features/live-analytics",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const urls: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${BASE}${path || "/"}`,
    lastModified: now,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : path === "/attend" ? 0.9 : 0.7,
  }));

  // Include public ticketed events so each discoverable event gets indexed.
  try {
    const res = await fetch(`${BASE}/api/v1/events/public`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const data = await res.json();
      const events = Array.isArray(data) ? data : data.events || [];
      for (const e of events) {
        if (e?.id) {
          urls.push({
            url: `${BASE}/events/${e.id}`,
            lastModified: now,
            changeFrequency: "daily",
            priority: 0.8,
          });
        }
      }
    }
  } catch {
    // Search engines still get every static route.
  }
  return urls;
}
