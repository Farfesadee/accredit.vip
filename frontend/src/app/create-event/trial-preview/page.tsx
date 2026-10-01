"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getTrialEvent, clearTrialEvent } from "@/lib/post-event-trial";
import { CalendarDays, MapPin, Users, ChevronLeft, Play, Check, Ticket, Beaker, Pencil, PartyPopper } from "lucide-react";

interface TrialEventData {
  title: string;
  host_name: string;
  event_date: string;
  event_time: string;
  venue: string;
  description: string;
  guest_count_range: string;
  event_type: string;
  category?: string;
  ticket_price?: number;
}

export default function TrialPreviewPage() {
  const router = useRouter();
  const [trialEvent, setTrialEvent] = useState<TrialEventData | null>(null);
  const [testingComplete, setTestingComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const event = getTrialEvent();
    if (!event) {
      router.push("/create-event");
      return;
    }
    setTrialEvent(event);
  }, [router]);

  if (!trialEvent) {
    return null;
  }

  const handleTestFeature = () => {
    setIsLoading(true);
    // Simulate test/preview
    setTimeout(() => {
      setTestingComplete(true);
      setIsLoading(false);
    }, 1000);
  };

  const handleCreateAccount = () => {
    // Store the trial event in sessionStorage for post-signup migration
    sessionStorage.setItem("post_event_trial_data", JSON.stringify(trialEvent));
    router.push("/register?source=post_event_trial");
  };

  const handleLogin = () => {
    sessionStorage.setItem("post_event_trial_data", JSON.stringify(trialEvent));
    router.push("/login?source=post_event_trial");
  };

  const handleEditEvent = () => {
    router.push("/create-event?mode=event&resume_trial=true");
  };

  const handleStartOver = () => {
    clearTrialEvent();
    router.push("/create-event");
  };

  if (testingComplete) {
    return (
      <div className="min-h-screen bg-[#f8f9fc]">
        {/* Header */}
        <header className="border-b border-[#e8edf2] bg-white sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
            <button
              onClick={() => setTestingComplete(false)}
              className="flex items-center gap-2 px-4 py-2 text-[#1ABC9C] border border-[#1ABC9C] rounded-lg hover:bg-[#1ABC9C]/10 transition-colors font-semibold text-sm"
            >
              <ChevronLeft className="h-5 w-5" />
              Back to Preview
            </button>
            <h1 className="text-xl font-bold text-[#0D1B2A]">Almost There!</h1>
            <div className="w-10"></div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-12">
          {/* Success Message */}
          <div className="bg-white rounded-2xl border border-[#e8edf2] shadow-lg overflow-hidden mb-8">
            <div className="h-32 bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
              <Check className="w-24 h-24 text-white" />
            </div>

            <div className="p-8">
              <h2 className="text-3xl font-bold text-[#0D1B2A] mb-3">
                Your Event Preview Looks Amazing!
              </h2>
              <p className="text-[#64748b] text-lg mb-8">
                This is exactly how your event will appear once it's live. Now create an account to officially post it and reach the public on Discover Events.
              </p>

              {/* Event Summary */}
              <div className="bg-[#f8f9fc] rounded-xl p-6 mb-8">
                <h3 className="font-bold text-[#0D1B2A] mb-4">Event Summary</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="font-bold text-[#0D1B2A] w-24">Event:</span>
                    <span className="text-[#64748b]">{trialEvent.title}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="font-bold text-[#0D1B2A] w-24">Host:</span>
                    <span className="text-[#64748b]">{trialEvent.host_name}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="font-bold text-[#0D1B2A] w-24">Date:</span>
                    <span className="text-[#64748b]">
                      {new Date(trialEvent.event_date).toLocaleDateString()} at{" "}
                      {trialEvent.event_time}
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="font-bold text-[#0D1B2A] w-24">Venue:</span>
                    <span className="text-[#64748b]">{trialEvent.venue}</span>
                  </div>
                  {trialEvent.ticket_price && (
                    <div className="flex items-start gap-3">
                      <span className="font-bold text-[#0D1B2A] w-24">Ticket:</span>
                      <span className="text-[#64748b]">
                        ₦{trialEvent.ticket_price.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* What Happens Next */}
              <div className="bg-[#fff1f8] rounded-xl p-6 mb-8 border border-[#1ABC9C]/20">
                <h3 className="font-bold text-[#0D1B2A] mb-3">What Happens Next</h3>
                <ol className="space-y-2 text-sm text-[#64748b]">
                  <li className="flex gap-2">
                    <span className="font-bold text-[#1ABC9C] flex-shrink-0">1.</span>
                    <span>Create your account or login</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-[#1ABC9C] flex-shrink-0">2.</span>
                    <span>Your event appears in your dashboard</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-[#1ABC9C] flex-shrink-0">3.</span>
                    <span>You can edit, delete, or hit "Post Event"</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-[#1ABC9C] flex-shrink-0">4.</span>
                    <span>Admin reviews and approves it</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-[#1ABC9C] flex-shrink-0">5.</span>
                    <span>Event goes live on Discover Events</span>
                  </li>
                </ol>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleCreateAccount}
              className="flex-1 rounded-lg bg-[#1ABC9C] px-6 py-3 text-sm font-bold text-white transition-all hover:bg-[#16A085] hover:shadow-lg"
            >
              Create Account
            </button>

            <button
              onClick={handleLogin}
              className="flex-1 rounded-lg border border-[#d9e2ec] bg-white px-6 py-3 text-sm font-bold text-[#0D1B2A] transition-all hover:border-[#1ABC9C] hover:text-[#1ABC9C]"
            >
              Already Have Account? Login
            </button>
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={() => setTestingComplete(false)}
              className="text-sm text-[#64748b] hover:text-[#1ABC9C] font-medium transition-colors"
            >
              Back to Preview
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      {/* Header */}
      <header className="border-b border-[#e8edf2] bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2 text-[#1ABC9C] border border-[#1ABC9C] rounded-lg hover:bg-[#1ABC9C]/10 transition-colors font-semibold text-sm"
          >
            <ChevronLeft className="h-5 w-5" />
            Back
          </button>
          <h1 className="text-xl font-bold text-[#0D1B2A]">Event Preview</h1>
          <div className="w-10"></div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Preview Card */}
        <div className="bg-white rounded-2xl border border-[#e8edf2] shadow-lg overflow-hidden mb-8">
          {/* Event Header */}
          <div className="h-64 bg-gradient-to-br from-[#1ABC9C] to-[#16A085] relative flex items-center justify-center">
            <div className="text-center text-white">
              <PartyPopper className="w-20 h-20 mx-auto mb-4" />
              <p className="text-sm font-semibold uppercase tracking-widest opacity-90">
                {trialEvent.category || trialEvent.event_type}
              </p>
            </div>
          </div>

          {/* Event Details */}
          <div className="p-8">
            <h2 className="text-3xl font-bold text-[#0D1B2A] mb-2">{trialEvent.title}</h2>
            <p className="text-[#64748b] mb-6">Hosted by {trialEvent.host_name}</p>

            {/* Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 pb-8 border-b border-[#e8edf2]">
              <div>
                <div className="flex items-center gap-2 text-[#64748b] mb-2">
                  <CalendarDays className="h-5 w-5 text-[#1ABC9C]" />
                  <span className="text-sm font-semibold">Date & Time</span>
                </div>
                <p className="text-[#0D1B2A] font-bold">
                  {new Date(trialEvent.event_date).toLocaleDateString()} at {trialEvent.event_time}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 text-[#64748b] mb-2">
                  <MapPin className="h-5 w-5 text-[#1ABC9C]" />
                  <span className="text-sm font-semibold">Venue</span>
                </div>
                <p className="text-[#0D1B2A] font-bold">{trialEvent.venue}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 text-[#64748b] mb-2">
                  <Users className="h-5 w-5 text-[#1ABC9C]" />
                  <span className="text-sm font-semibold">Expected Guests</span>
                </div>
                <p className="text-[#0D1B2A] font-bold">{trialEvent.guest_count_range}</p>
              </div>
            </div>

            {/* Description */}
            <div className="mb-8">
              <h3 className="text-sm font-bold text-[#0D1B2A] mb-3 uppercase tracking-widest">
                About This Event
              </h3>
              <p className="text-[#64748b] leading-relaxed">
                {trialEvent.description || "No description provided"}
              </p>
            </div>

            {/* Pricing */}
            {trialEvent.ticket_price ? (
              <div className="mb-8 p-4 bg-[#f8f9fc] rounded-xl border border-[#e8edf2]">
                <h3 className="text-sm font-bold text-[#0D1B2A] mb-2">Ticket Price</h3>
                <p className="text-2xl font-bold text-[#1ABC9C]">
                  ₦{trialEvent.ticket_price.toLocaleString()}
                </p>
              </div>
            ) : (
              <div className="mb-8 p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-2">
                <Ticket className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <p className="text-sm font-bold text-emerald-700">Free Event</p>
              </div>
            )}

            {/* Trial Badge */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm text-amber-800 flex items-center gap-2">
                <Beaker className="w-4 h-4 flex-shrink-0" />
                <span className="font-bold">This is a preview</span>: Your event will look
                exactly like this once it's live. No payment required to test.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleEditEvent}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-[#d9e2ec] bg-white px-6 py-3 text-sm font-bold text-[#0D1B2A] transition-all hover:border-[#1ABC9C] hover:text-[#1ABC9C]"
          >
            <Pencil className="w-4 h-4" />
            Edit Event
          </button>

          <button
            onClick={handleTestFeature}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#1ABC9C] px-6 py-3 text-sm font-bold text-white transition-all hover:bg-[#16A085] hover:shadow-lg disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Test This Feature
              </>
            )}
          </button>
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={handleStartOver}
            className="text-sm text-[#64748b] hover:text-[#1ABC9C] font-medium transition-colors"
          >
            Start Over
          </button>
        </div>
      </main>
    </div>
  );
}
