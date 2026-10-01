"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Check, Circle } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

const QR_PATTERN = [
  1,1,1,0,1,0,1,1,
  1,0,1,0,0,1,0,1,
  1,0,1,1,1,0,1,0,
  0,0,0,1,0,0,1,1,
  1,1,0,0,1,1,0,1,
  0,1,1,1,0,1,0,0,
  1,0,0,1,1,0,1,1,
  1,1,1,0,0,1,0,0,
];

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");

  const redirectToOAuth = (provider: string, url: string) => {
    window.location.href = url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password, rememberMe);
      router.push(redirect || "/dashboard");
    } catch (err: any) {
      const msg = err?.message || err?.detail || "Login failed. Please check your credentials.";
      setError(msg);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel: product visual ── */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{
          backgroundImage:
            "linear-gradient(160deg, rgba(7,15,28,0.93) 0%, rgba(13,27,42,0.88) 50%, rgba(10,18,32,0.95) 100%), url('https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1400&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Ambient orb */}
        <div
          className="absolute top-0 right-0 w-96 h-96 opacity-25 pointer-events-none"
          style={{ background: "radial-gradient(circle, #1ABC9C 0%, transparent 70%)", filter: "blur(80px)" }}
        />

        {/* Logo */}
        <Link href="/" className="relative z-10 flex items-center gap-4">
          <Image
            src="/logo-mark.png"
            alt=""
            width={346}
            height={352}
            className="h-24 w-auto object-contain"
          />
          <Image
            src="/logo-text.png"
            alt="Accredit Interactive"
            width={565}
            height={123}
            className="h-16 w-auto object-contain"
          />
        </Link>

        {/* Central product visual */}
        <div className="relative z-10 flex flex-col items-center justify-center flex-1 py-10">

          {/* Glow behind card */}
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: 320, height: 320,
            background: "radial-gradient(circle, rgba(26, 188, 156,0.3) 0%, transparent 65%)",
            filter: "blur(60px)", pointerEvents: "none",
          }} />

          {/* ─ Invitation card ─ */}
          <div
            style={{
              background: "linear-gradient(145deg, #1ABC9C 0%, #16A085 100%)",
              borderRadius: 24, padding: "26px 22px", width: 270,
              boxShadow: "0 44px 110px rgba(26, 188, 156,0.52), 0 16px 48px rgba(0,0,0,0.45)",
              position: "relative", zIndex: 3,
              animation: "float 5s ease-in-out infinite",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ color: "rgba(255,255,255,0.72)", fontSize: 9.5, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Your Invitation
              </span>
              <span style={{
                display: "flex", alignItems: "center", gap: 4,
                background: "rgba(255,255,255,0.2)", color: "white",
                fontSize: 9.5, fontWeight: 800, padding: "3px 10px", borderRadius: 99,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
                Delivered
              </span>
            </div>

            {/* Large QR */}
            <div style={{ background: "white", borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 2.5, aspectRatio: "1" }}>
                {QR_PATTERN.map((cell, i) => (
                  <div key={i} style={{ background: cell ? "#0D1B2A" : "white", borderRadius: 2 }} />
                ))}
              </div>
            </div>

            <p style={{ color: "white", fontWeight: 800, fontSize: 14, marginBottom: 3 }}>Victoria&apos;s Birthday</p>
            <p style={{ color: "rgba(255,255,255,0.72)", fontSize: 11.5 }}>Sat, 21 Jun &middot; 7:00 PM</p>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 10.5, marginTop: 2 }}>The Wheatbaker, Ikoyi</p>
            <div style={{
              marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.18)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ color: "rgba(255,255,255,0.62)", fontSize: 10.5, fontWeight: 600 }}>QR Code Included</span>
              <span style={{ color: "rgba(255,255,255,0.42)", fontSize: 10 }}>via WhatsApp</span>
            </div>
          </div>

          {/* ─ Scan confirmed badge ─ */}
          <div style={{
            position: "absolute", top: "15%", right: "8%",
            background: "linear-gradient(135deg, #0f1e32, #162033)",
            border: "1px solid rgba(74,222,128,0.32)", borderRadius: 14,
            padding: "10px 14px", display: "flex", alignItems: "center", gap: 9,
            boxShadow: "0 8px 28px rgba(0,0,0,0.3)", zIndex: 5,
            animation: "float 4s ease-in-out infinite 0.6s",
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9, background: "rgba(74,222,128,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Check aria-hidden="true" size={17} strokeWidth={3} style={{ color: "#4ade80" }} />
            </div>
            <div>
              <p style={{ color: "white", fontSize: 11.5, fontWeight: 800, marginBottom: 1 }}>Scan Confirmed</p>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 9.5 }}>QR verified &middot; Gate 1</p>
            </div>
          </div>

          {/* ─ Live check-ins badge ─ */}
          <div style={{
            position: "absolute", bottom: "12%", left: "4%",
            background: "rgba(255,255,255,0.055)", backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14,
            padding: "12px 14px", zIndex: 4,
            animation: "float 5.5s ease-in-out infinite 1s",
          }}>
            <p style={{ color: "rgba(255,255,255,0.38)", fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
              Live Check-ins
            </p>
            {[
              { name: "Adaeze N.", init: "AN", in: true },
              { name: "Kofi M.", init: "KM", in: true },
              { name: "Temi A.", init: "TA", in: false },
            ].map((g) => (
              <div key={g.name} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                  background: "linear-gradient(135deg,#1ABC9C,#16A085)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ color: "white", fontSize: 8, fontWeight: 800 }}>{g.init}</span>
                </div>
                <span style={{ flex: 1, color: "rgba(255,255,255,0.78)", fontSize: 10.5, fontWeight: 600 }}>{g.name}</span>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: g.in ? "#4ade80" : "rgba(255,255,255,0.25)" }}>
                  {g.in ? (
                    <Check aria-hidden="true" size={13} strokeWidth={3} />
                  ) : (
                    <Circle aria-hidden="true" size={11} strokeWidth={2.5} />
                  )}
                </span>
              </div>
            ))}
            <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 9.5, marginTop: 8 }}>247 / 300 checked in</p>
          </div>
        </div>

        {/* Bottom tagline */}
        <div className="relative z-10">
          <p className="text-white font-extrabold text-xl leading-snug tracking-tight">
            Your events deserve<br />
            <span style={{ color: "#1ABC9C" }}>premium infrastructure.</span>
          </p>
          <p className="text-white/35 text-xs mt-2">&copy; {new Date().getFullYear()} Accredit Interactive</p>
        </div>
      </div>

      {/* ── Right panel: form ── */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Mobile logo */}
        <div className="lg:hidden bg-[#0D1B2A] px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo-mark.png"
              alt=""
              width={346}
              height={352}
              className="h-10 w-auto object-contain"
            />
            <Image
              src="/logo-text.png"
              alt="Accredit Interactive"
              width={565}
              height={123}
              className="h-8 w-auto object-contain"
            />
          </Link>
        </div>

        <div className="flex-1 flex items-start justify-center px-6 pt-6 pb-12">
          <div className="w-full max-w-md">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-lg border border-[rgba(13,27,42,0.14)] bg-white px-4 py-2 text-sm font-semibold text-[#0D1B2A] shadow-sm transition-all hover:border-[rgba(26, 188, 156,0.35)] hover:text-[#1ABC9C] hover:shadow-md"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to home
                </Link>
              </div>
              <h1 className="text-3xl font-extrabold text-[#0D1B2A] tracking-tight">Welcome back</h1>
              <p className="mt-2 text-gray-500 text-sm">Sign in to your Accredit Interactive dashboard</p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

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

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-semibold text-[#0D1B2A]">
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium hover:underline"
                    style={{ color: "#1ABC9C" }}
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-premium pr-11"
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPass ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#1ABC9C] focus:ring-[#1ABC9C]"
                />
                <span className="text-sm text-slate-600">Remember me for 7 days</span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-3 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-200" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-white px-3 text-gray-400">or continue with</span></div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <button type="button" onClick={() => {
                const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
                const redirectUri = window.location.origin + "/auth/callback/google";
                const nonce = Math.random().toString(36).substring(2);
                redirectToOAuth("google", `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=id_token&scope=openid%20email%20profile&nonce=${nonce}`);
              }} className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all">
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1.04.72-2.37 1.13-3.71 1.13-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.17c-.22-.72-.35-1.47-.35-2.17s.13-1.45.35-2.17V7.01H2.18C1.43 8.88 1 10.92 1 13s.43 4.12 1.18 5.99l2.66-2.82z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.01l3.66 2.82c.87-2.6 3.3-4.45 6.16-4.45z"/></svg>
                <span className="hidden sm:inline">Google</span>
              </button>
              <button type="button" disabled className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-400 cursor-not-allowed opacity-60 relative">
                <svg className="w-5 h-5" fill="#1877F2" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                <span className="hidden sm:inline">Facebook</span>
                <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[9px] px-1 py-0.5 rounded-full leading-none">soon</span>
              </button>
              <button type="button" disabled className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-400 cursor-not-allowed opacity-60 relative">
                <svg className="w-5 h-5" fill="black" viewBox="0 0 24 24"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                <span className="hidden sm:inline">Apple</span>
                <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[9px] px-1 py-0.5 rounded-full leading-none">soon</span>
              </button>
            </div>

            <p className="mt-8 text-center text-sm text-gray-500">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="font-semibold hover:underline" style={{ color: "#1ABC9C" }}>
                Create one free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
