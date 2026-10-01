"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { InviteMotionBanner } from "@/components/invite-motion-banner";

export default function EmbedEventPage() {
  const params = useParams();
  const id = params?.id;
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiClient(`/events/${id}`).then(setEvent).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ padding: 20, textAlign: "center", fontFamily: "sans-serif", color: "#64748b" }}>Loading event...</div>;
  if (!event) return <div style={{ padding: 20, textAlign: "center", fontFamily: "sans-serif", color: "#ef4444" }}>Event not found</div>;

  return (
    <>
      <InviteMotionBanner />
      <div style={{ fontFamily: "system-ui, sans-serif", padding: 16, maxWidth: 400, margin: "0 auto" }}>
      <div style={{ borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden", background: "white" }}>
        {event.cover_image && <img src={event.cover_image} alt="" style={{ width: "100%", height: 160, objectFit: "cover" }} />}
        <div style={{ padding: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{event.title}</h2>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>{event.venue} &middot; {event.event_date}</p>
          {event.ticket_price ? (
            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 20, fontWeight: 900 }}>₦{event.ticket_price.toLocaleString()}</span>
              <a href={`/events/${id}`} target="_parent" style={{ background: "#1ABC9C", color: "white", padding: "8px 20px", borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 700 }}>Get Ticket</a>
            </div>
          ) : (
            <a href={`/events/${id}`} target="_parent" style={{ display: "block", marginTop: 12, background: "#059669", color: "white", padding: "8px 20px", borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 700, textAlign: "center" }}>Save My Spot</a>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
