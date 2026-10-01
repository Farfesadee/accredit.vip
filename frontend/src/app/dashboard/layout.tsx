"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { TrialStore } from "@/lib/trial-store";
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const migrated = useRef(false);

  // Silently migrate any trial events left in localStorage after signup/login
  useEffect(() => {
    if (!user || migrated.current) return;
    migrated.current = true;
    const migrate = async () => {
      const events = TrialStore.getAll();
      const postEventTrialData = sessionStorage.getItem("post_event_trial_data");
      if (events.length === 0 && !postEventTrialData) return;
      try {
        if (events.length > 0) {
          const res = await fetch("/api/v1/trial/migrate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(events),
          });
          if (res.ok) TrialStore.clearAll();
        }
        if (postEventTrialData) {
          const trialEvent = JSON.parse(postEventTrialData);
          const res = await fetch("/api/v1/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: trialEvent.title,
              event_type: trialEvent.event_type,
              host_name: trialEvent.host_name,
              event_date: trialEvent.event_date,
              event_time: trialEvent.event_time,
              venue: trialEvent.venue,
              city: "",
              state: "",
              country: "Nigeria",
              dress_code: "",
              description: trialEvent.description,
              is_public: false,
              category: trialEvent.category,
              guest_count_range: trialEvent.guest_count_range,
              ticket_price: trialEvent.ticket_price,
              pass_packages: trialEvent.pass_packages,
              lineup: trialEvent.lineup,
              status: "pending",
            }),
          });
          if (res.ok) sessionStorage.removeItem("post_event_trial_data");
        }
      } catch (err) {

      }
      router.refresh();
    };
    migrate();
  }, [user, router]);

  // NOTE: sessions intentionally persist here. Do NOT auto-logout on
  // tab hide/close: the backend token lasts 7 days and the idle timeout
  // (4h, 7d with remember-me) is enforced at auth init instead.

  return (
    <>
      {children}
    </>
  );
}
