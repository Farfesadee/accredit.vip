"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";

function PaymentCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "failed" | "pending">("loading");
  const [message, setMessage] = useState("");
  const [eventId, setEventId] = useState<number | null>(null);

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        const reference = searchParams.get("reference");
        if (!reference) {
          setStatus("failed");
          setMessage("No payment reference found");
          return;
        }

        // Verify payment with backend
        const result = await apiClient<{
          status: "success" | "failed" | "pending";
          event_id: number;
          message: string;
        }>(`/payments/verify?reference=${reference}`);

        if (result.status === "success") {
          setStatus("success");
          setMessage("Payment successful! Your event is now ready to send invites.");
          setEventId(result.event_id);
          // Redirect after 2 seconds
          setTimeout(() => {
            router.push(`/dashboard/invites/${result.event_id}/manage`);
          }, 2000);
        } else if (result.status === "pending") {
          setStatus("pending");
          setMessage("Payment is being processed. Please wait...");
        } else {
          setStatus("failed");
          setMessage(result.message || "Payment verification failed");
        }
      } catch (err) {
        setStatus("failed");
        setMessage(err instanceof Error ? err.message : "An error occurred while verifying payment");
      }
    };

    verifyPayment();
  }, [searchParams, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f9fc] px-4">
      <div className="rounded-2xl bg-white p-8 shadow-lg max-w-md w-full border border-[#e8edf2]">
        {status === "loading" && (
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#e8edf2] border-t-[#1ABC9C]" />
            <h1 className="text-2xl font-bold text-[#0D1B2A]">Verifying Payment</h1>
            <p className="mt-2 text-[#64748b]">Please wait while we confirm your payment...</p>
          </div>
        )}

        {status === "success" && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#f0fdf4]">
              <svg className="h-8 w-8 text-[#10b981]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[#0D1B2A]">Payment Successful!</h1>
            <p className="mt-2 text-[#64748b]">{message}</p>
            <p className="mt-4 text-sm text-[#94a3b8]">Redirecting to your event...</p>
            {eventId && (
              <Link
                href={`/dashboard/invites/${eventId}/manage`}
                className="mt-6 inline-block px-6 py-2 rounded-lg bg-[#1ABC9C] text-white font-bold hover:bg-[#16A085] transition-colors"
              >
                Go to Event Management
              </Link>
            )}
          </div>
        )}

        {status === "failed" && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#fef2f2]">
              <svg className="h-8 w-8 text-[#ef4444]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[#0D1B2A]">Payment Failed</h1>
            <p className="mt-2 text-[#64748b]">{message}</p>
            <div className="mt-6 flex gap-3">
              <Link
                href="/dashboard/create"
                className="flex-1 px-4 py-2 rounded-lg bg-[#1ABC9C] text-white font-bold hover:bg-[#16A085] transition-colors text-center"
              >
                Try Again
              </Link>
              <Link
                href="/dashboard"
                className="flex-1 px-4 py-2 rounded-lg border border-[#d9e2ec] text-[#0D1B2A] font-bold hover:bg-[#f8f9fc] transition-colors text-center"
              >
                Dashboard
              </Link>
            </div>
          </div>
        )}

        {status === "pending" && (
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#e8edf2] border-t-[#f59e0b]" />
            <h1 className="text-2xl font-bold text-[#0D1B2A]">Processing Payment</h1>
            <p className="mt-2 text-[#64748b]">{message}</p>
            <p className="mt-4 text-sm text-[#94a3b8]">This may take a few moments...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#e8edf2] border-t-[#1ABC9C]" />
      </div>
    }>
      <PaymentCallbackContent />
    </Suspense>
  );
}
