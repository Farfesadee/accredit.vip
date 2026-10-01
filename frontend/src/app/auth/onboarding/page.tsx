"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/contexts/auth-context";
import { TrialStore } from "@/lib/trial-store";

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<"signup" | "login">("signup");
  const [trialEvent, setTrialEvent] = useState<any>(null);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (!loading && user) {
      // Migrate trial events and POST EVENT trial
      const events = TrialStore.getAll();
      const postEventTrialData = sessionStorage.getItem("post_event_trial_data");

      if (events.length > 0 || postEventTrialData) {
        migrateTrialEvents(events, postEventTrialData);
      } else {
        router.push("/dashboard");
      }
    }
  }, [user, loading, router]);

  // Get the latest tested trial event
  useEffect(() => {
    const latest = TrialStore.getLatestTested();
    if (latest) {
      setTrialEvent(latest);
    }
  }, []);

  const migrateTrialEvents = async (events: any[], postEventData: string | null) => {
    try {
      // Migrate CREATE INVITE trial events
      if (events.length > 0) {
        const response = await fetch("/api/v1/trial/migrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(events),
        });

        if (response.ok) {
          TrialStore.clearAll();
        }
      }

      // Migrate POST EVENT trial event
      if (postEventData) {
        try {
          const trialEvent = JSON.parse(postEventData);
          // Create the event with pending status (not public yet)
          const response = await fetch("/api/v1/events", {
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

          if (response.ok) {
            const createdEvent = await response.json();
            sessionStorage.removeItem("post_event_trial_data");
            // Redirect to dashboard showing the new event
            router.push(`/dashboard?migrated=true`);
            return;
          }
        } catch (err) {

        }
      }

      // Redirect to dashboard with success message
      router.push("/dashboard?migrated=true");
    } catch (err) {

      router.push("/dashboard");
    }
  };

  if (loading || user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 rounded-full border-4 border-[#1ABC9C] border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-[#64748b]">Setting up your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0D1B2A] to-[#1a2f4a] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#e8edf2]/10 bg-[#0D1B2A]/50 backdrop-blur">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center hover:opacity-75 transition-opacity">
            <Image src="/logo-mark.png" alt="Accredit Interactive" width={4071} height={761} className="h-8 w-auto object-contain" />
          </Link>
          <p className="text-sm text-[#94a3b8]">Welcome back!</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Trial Event Summary */}
          {trialEvent && (
            <div className="mb-8 rounded-2xl border border-[#1ABC9C]/30 bg-[#1ABC9C]/5 p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1ABC9C]/20">
                  <svg className="h-6 w-6 text-[#1ABC9C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-white">You tested your {trialEvent.mode === "invite" ? "invitation" : "event"}!</p>
                  <p className="text-sm text-[#94a3b8] mt-1">
                    {trialEvent.tested && (
                      <>
                        Sent via <span className="font-semibold text-[#1ABC9C]">{trialEvent.testedVia}</span> to{" "}
                        <span className="font-semibold text-[#1ABC9C]">{trialEvent.testRecipient}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Auth Tabs */}
          <div className="mb-6 flex gap-2 border-b border-[#e8edf2]/20">
            <button
              onClick={() => setTab("signup")}
              className={`flex-1 pb-3 text-sm font-bold transition-all ${
                tab === "signup"
                  ? "border-b-2 border-[#1ABC9C] text-[#1ABC9C]"
                  : "text-[#94a3b8] hover:text-white"
              }`}
            >
              Create Account
            </button>
            <button
              onClick={() => setTab("login")}
              className={`flex-1 pb-3 text-sm font-bold transition-all ${
                tab === "login"
                  ? "border-b-2 border-[#1ABC9C] text-[#1ABC9C]"
                  : "text-[#94a3b8] hover:text-white"
              }`}
            >
              Login
            </button>
          </div>

          {/* Auth Forms */}
          <div className="space-y-6">
            {tab === "signup" ? (
              <div className="space-y-4">
                <p className="text-center text-sm text-[#94a3b8] mb-6">
                  Create an account to save your {trialEvent?.mode === "invite" ? "invitation" : "event"} and send to more people
                </p>
                <Link
                  href="/register"
                  className="block w-full py-3 rounded-xl bg-[#1ABC9C] text-white font-bold text-center hover:bg-[#16A085] transition-colors"
                >
                  Create Account
                </Link>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#e8edf2]/20" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-[#0D1B2A] px-2 text-[#94a3b8]">or</span>
                  </div>
                </div>
                <Link
                  href="/auth/google?mode=signup"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-[#e8edf2]/30 text-white font-bold hover:bg-[#1a2f4a] transition-colors"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.85 4.05-1.26 1.24-3.16 2.06-5.99 2.06-4.45 0-8.16-3.09-8.16-6.9 0-3.8 3.71-6.9 8.16-6.9 2.33 0 4.34.89 5.8 2.26l2.45-2.45C21.12 2.94 18.27 1 12.48 1 5.84 1 .73 6.11.73 12.75c0 6.62 5.38 11.23 11.75 11.23 3.45 0 6.58-1.14 8.86-3.09 2.45-2.12 3.71-5.26 3.71-8.93 0-.88-.07-1.63-.19-2.3H12.48Z" />
                  </svg>
                  Sign up with Google
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-center text-sm text-[#94a3b8] mb-6">
                  Login to access your {trialEvent?.mode === "invite" ? "invitation" : "event"} and dashboard
                </p>
                <Link
                  href="/login"
                  className="block w-full py-3 rounded-xl bg-[#1ABC9C] text-white font-bold text-center hover:bg-[#16A085] transition-colors"
                >
                  Login
                </Link>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#e8edf2]/20" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-[#0D1B2A] px-2 text-[#94a3b8]">or</span>
                  </div>
                </div>
                <Link
                  href="/auth/google?mode=login"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-[#e8edf2]/30 text-white font-bold hover:bg-[#1a2f4a] transition-colors"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.85 4.05-1.26 1.24-3.16 2.06-5.99 2.06-4.45 0-8.16-3.09-8.16-6.9 0-3.8 3.71-6.9 8.16-6.9 2.33 0 4.34.89 5.8 2.26l2.45-2.45C21.12 2.94 18.27 1 12.48 1 5.84 1 .73 6.11.73 12.75c0 6.62 5.38 11.23 11.75 11.23 3.45 0 6.58-1.14 8.86-3.09 2.45-2.12 3.71-5.26 3.71-8.93 0-.88-.07-1.63-.19-2.3H12.48Z" />
                  </svg>
                  Login with Google
                </Link>
              </div>
            )}

            <p className="text-center text-xs text-[#64748b]">
              By signing up, you agree to our{" "}
              <Link href="/terms" className="text-[#1ABC9C] hover:underline">
                Terms of Service
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 rounded-full border-4 border-[#1ABC9C] border-t-transparent animate-spin" /></div>}>
      <OnboardingContent />
    </Suspense>
  );
}
