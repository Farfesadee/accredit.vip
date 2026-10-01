"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Mail } from "lucide-react";
import { API_BASE } from "@/lib/api-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch(`${API_BASE}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setDone(true);
    } catch {}
    setSubmitting(false);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-hero-gradient flex items-center justify-center px-4">
        <div
          className="w-full max-w-md p-10 rounded-3xl text-center"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div
            className="w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-6 text-4xl"
            style={{
              background: "linear-gradient(135deg, #1ABC9C, #16A085)",
              boxShadow: "0 8px 30px rgba(26, 188, 156,0.5)",
            }}
          >
            <Mail className="h-9 w-9 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white mb-3">Check Your Inbox</h1>
          <p className="text-white/65 text-sm leading-relaxed mb-2">
            If an account exists for <strong className="text-white">{email}</strong>, we&apos;ve
            sent a password reset link.
          </p>
          <p className="text-white/40 text-xs mb-8">
            Check your inbox (and spam folder) and click the link to reset your password.
          </p>
          <Link href="/login" className="btn-primary w-full justify-center">
            Back to Sign In
          </Link>
          <Link
            href="/"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-[rgba(255,255,255,0.08)] px-4 py-3 text-sm font-semibold text-white transition-all hover:border-[#1ABC9C]/45 hover:text-[#1ABC9C]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel: brand art ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-hero-gradient flex-col justify-between p-12 relative overflow-hidden">
        {/* Background orbs */}
        <div
          className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-20 animate-orb"
          style={{ background: "radial-gradient(circle, #1ABC9C 0%, transparent 70%)", filter: "blur(60px)" }}
        />
        <div
          className="absolute bottom-10 left-0 w-64 h-64 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #4f7cdc 0%, transparent 70%)", filter: "blur(80px)" }}
        />

        {/* Logo */}
        <Link href="/" className="relative z-10 flex items-center gap-3">
          <Image src="/logo-mark.png" alt="" width={366} height={372} className="h-14 w-auto object-contain" />
          <Image src="/logo-text.png" alt="Accredit Interactive" width={594} height={152} className="h-10 w-auto object-contain" />
        </Link>

        {/* Copy */}
        <div className="relative z-10 space-y-6">
          <h2 className="text-3xl font-extrabold text-white leading-tight">
            Forgot your<br />
            <span style={{ color: "#1ABC9C" }}>password?</span>
          </h2>
          <p className="text-white/60 text-sm leading-relaxed max-w-xs">
            No worries: it happens to the best of us. Enter your email and we&apos;ll
            send you a secure reset link in seconds.
          </p>
          <div className="space-y-3">
            {[
              "Secure one-time reset link",
              "Link expires in 15 minutes",
              "No account exposure",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(26, 188, 156,0.3)", border: "1px solid #1ABC9C" }}
                >
                  <svg className="w-2.5 h-2.5 text-[#1ABC9C]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-white/75 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/25 text-xs relative z-10">
          © {new Date().getFullYear()} Accredit Interactive
        </p>
      </div>

      {/* ── Right panel: form ── */}
      <div className="flex-1 flex flex-col">
        {/* Mobile logo */}
        <div className="lg:hidden bg-[#0D1B2A] px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-mark.png" alt="" width={366} height={372} className="h-10 w-auto object-contain" />
            <Image src="/logo-text.png" alt="Accredit Interactive" width={594} height={152} className="h-7 w-auto object-contain" />
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            {/* Back link */}
            <div className="mb-6">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-[#0D1B2A] transition-all hover:border-gray-300 hover:bg-white hover:shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Sign In
              </Link>
            </div>

            {/* Header */}
            <div className="mb-8">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                style={{ background: "rgba(26, 188, 156,0.08)" }}
              >
                <svg className="w-6 h-6 text-[#1ABC9C]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h1 className="text-3xl font-extrabold text-[#0D1B2A] tracking-tight">Reset your password</h1>
              <p className="mt-2 text-gray-500 text-sm">
                Enter your email address and we&apos;ll send you a reset link.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-semibold text-[#0D1B2A]">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-premium"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full justify-center py-3 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Sending reset link...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-gray-500">
              Remember your password?{" "}
              <Link href="/login" className="font-semibold hover:underline" style={{ color: "#1ABC9C" }}>
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
