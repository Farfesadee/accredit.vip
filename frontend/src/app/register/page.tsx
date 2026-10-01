"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, Mail, Smartphone } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { PhoneInput } from "@/components/shared/phone-input";
import { PasswordChecklist } from "@/components/shared/password-checklist";
import { TrialStore } from "@/lib/trial-store";
import { parseTimeInputTo24Hour } from "@/lib/event-form-options";

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

export default function RegisterPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [phone, setPhone] = useState("");
  const [verifyChannel, setVerifyChannel] = useState("email");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!phone.trim()) {
      setVerifyChannel("email");
    }
  }, [phone]);

  const redirectToOAuth = (provider: string, url: string) => {
    window.location.href = url;
  };

  const migrateTrialEvents = async () => {
    const events = TrialStore.getAll();
    const postEventTrialData = sessionStorage.getItem("post_event_trial_data");

    if (events.length > 0) {
      try {
        const response = await fetch("/api/v1/trial/migrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(events),
        });
        if (response.ok) {
          TrialStore.clearAll();
        }
      } catch (err) {
        // Trial migration failed - silently continue
      }
    }

    if (postEventTrialData) {
      try {
        const trialEvent = JSON.parse(postEventTrialData);
        const response = await fetch("/api/v1/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: trialEvent.title,
            event_type: trialEvent.event_type,
            host_name: trialEvent.host_name,
            event_date: trialEvent.event_date,
            event_time: parseTimeInputTo24Hour(trialEvent.event_time || ""),
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
          sessionStorage.removeItem("post_event_trial_data");
        }
      } catch (err) {
        // POST EVENT migration failed - silently continue
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register({ email, password, first_name: firstName, last_name: lastName, phone: phone || undefined, verification_channel: verifyChannel });
      await migrateTrialEvents();
      router.push("/dashboard?migrated=true");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel: product visual */}
      <div
        className="hidden lg:flex lg:w-5/12 flex-col justify-between p-12 relative overflow-hidden"
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

        <Link href="/" className="relative z-10 flex items-center gap-3">
          <Image
            src="/logo-mark.png"
            alt=""
            width={346}
            height={352}
            className="h-20 w-auto object-contain"
          />
          <Image
            src="/logo-text.png"
            alt="Accredit Interactive"
            width={565}
            height={123}
            className="h-14 w-auto object-contain"
          />
        </Link>

        {/* Central product visual */}
        <div className="relative z-10 flex flex-col items-center justify-center flex-1 py-8">

          {/* Glow */}
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: 300, height: 300,
            background: "radial-gradient(circle, rgba(26, 188, 156,0.28) 0%, transparent 65%)",
            filter: "blur(55px)", pointerEvents: "none",
          }} />

          {/* Invitation card */}
          <div style={{
            background: "linear-gradient(145deg, #1ABC9C 0%, #16A085 100%)",
            borderRadius: 22, padding: "24px 20px", width: 255,
            boxShadow: "0 40px 100px rgba(26, 188, 156,0.5), 0 14px 44px rgba(0,0,0,0.45)",
            position: "relative", zIndex: 3,
            animation: "float 5s ease-in-out infinite",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ color: "rgba(255,255,255,0.72)", fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Your Invitation
              </span>
              <span style={{
                display: "flex", alignItems: "center", gap: 4,
                background: "rgba(255,255,255,0.2)", color: "white",
                fontSize: 9, fontWeight: 800, padding: "2px 9px", borderRadius: 99,
              }}>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
                Delivered
              </span>
            </div>

            <div style={{ background: "white", borderRadius: 11, padding: 11, marginBottom: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 2, aspectRatio: "1" }}>
                {QR_PATTERN.map((cell, i) => (
                  <div key={i} style={{ background: cell ? "#0D1B2A" : "white", borderRadius: 1.5 }} />
                ))}
              </div>
            </div>

            <p style={{ color: "white", fontWeight: 800, fontSize: 13, marginBottom: 3 }}>Victoria&apos;s Birthday</p>
            <p style={{ color: "rgba(255,255,255,0.72)", fontSize: 11 }}>Sat, 21 Jun &middot; 7:00 PM</p>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, marginTop: 2 }}>The Wheatbaker, Ikoyi</p>
            <div style={{
              marginTop: 13, paddingTop: 11, borderTop: "1px solid rgba(255,255,255,0.18)",
              display: "flex", justifyContent: "space-between",
            }}>
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: 600 }}>QR Code Included</span>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 9.5 }}>via WhatsApp</span>
            </div>
          </div>

          {/* Scan confirmed */}
          <div style={{
            position: "absolute", top: "14%", right: "5%",
            background: "linear-gradient(135deg, #0f1e32, #162033)",
            border: "1px solid rgba(74,222,128,0.32)", borderRadius: 13,
            padding: "9px 13px", display: "flex", alignItems: "center", gap: 8,
            boxShadow: "0 8px 26px rgba(0,0,0,0.3)", zIndex: 5,
            animation: "float 4s ease-in-out infinite 0.6s",
          }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(74,222,128,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Check className="h-4 w-4 text-[#4ade80]" strokeWidth={3} />
            </div>
            <div>
              <p style={{ color: "white", fontSize: 11, fontWeight: 800, marginBottom: 1 }}>Scan Confirmed</p>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 9 }}>QR verified &middot; Gate 1</p>
            </div>
          </div>

          {/* Invites sent */}
          <div style={{
            position: "absolute", bottom: "14%", left: "2%",
            background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)",
            borderRadius: 12, padding: "8px 12px", display: "flex", alignItems: "center", gap: 7,
            zIndex: 5, animation: "float 3.8s ease-in-out infinite 0.9s",
          }}>
            <Smartphone className="h-4 w-4 text-[#4ade80]" />
            <div>
              <p style={{ color: "white", fontSize: 11, fontWeight: 700, marginBottom: 1 }}>800 Invites Sent</p>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 9.5 }}>98% delivered &middot; WhatsApp</p>
            </div>
          </div>
        </div>

        {/* Bottom tagline */}
        <div className="relative z-10">
          <p className="text-white font-extrabold text-xl leading-snug tracking-tight">
            Africa&apos;s premium<br />
            <span style={{ color: "#1ABC9C" }}>event platform.</span>
          </p>
          <p className="text-white/30 text-xs mt-2">&copy; {new Date().getFullYear()} Accredit Interactive</p>
        </div>
      </div>

      {/* Right panel: form */}
      <div className="flex-1 flex flex-col">
        <div className="lg:hidden bg-[#0D1B2A] px-6 py-6 flex items-center">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-mark.png" alt="" width={366} height={372} className="h-12 w-auto object-contain" />
            <Image src="/logo-text.png" alt="Accredit Interactive" width={594} height={152} className="h-9 w-auto object-contain" />
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-md">
            <div className="mb-7">
              <Link href="/" className="mb-6 inline-flex items-center gap-2 rounded-lg border border-[rgba(13,27,42,0.14)] bg-white px-4 py-2 text-sm font-semibold text-[#0D1B2A] shadow-sm transition-all hover:border-[rgba(26, 188, 156,0.35)] hover:text-[#1ABC9C] hover:shadow-md">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to home
              </Link>
              <h1 className="text-3xl font-extrabold text-[#0D1B2A] tracking-tight">Create your account</h1>
              <p className="mt-2 text-gray-500 text-sm">Start managing events like a pro</p>
            </div>

            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="firstName" className="block text-sm font-semibold text-[#0D1B2A]">First Name <span className="text-red-500">*</span></label>
                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="input-premium"
                    placeholder="John"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="lastName" className="block text-sm font-semibold text-[#0D1B2A]">Last Name <span className="text-red-500">*</span></label>
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="input-premium"
                    placeholder="Doe"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-semibold text-[#0D1B2A]">Email address <span className="text-red-500">*</span></label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-premium"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="reg-password" className="block text-sm font-semibold text-[#0D1B2A]">Password <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    id="reg-password"
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-premium pr-11"
                    placeholder="Create a strong password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      {showPass
                        ? <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        : <><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                      }
                    </svg>
                  </button>
                </div>
                <PasswordChecklist password={password} />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#0D1B2A]">Phone number</label>
                <PhoneInput value={phone} onChange={setPhone} placeholder="Phone number (for verification)" />
              </div>

              {/* Verify channel: only show if phone is provided */}
              {phone.trim() ? (
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-[#0D1B2A]">Verify account via</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: "email", label: "Email", icon: <Mail className="h-4 w-4" /> },
                      { value: "sms", label: "SMS", icon: <Smartphone className="h-4 w-4" /> },
                      {
                        value: "whatsapp",
                        label: "WhatsApp",
                        icon: (
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                        ),
                      },
                    ].map((ch) => (
                      <button
                        key={ch.value}
                        type="button"
                        onClick={() => setVerifyChannel(ch.value)}
                        className="py-2.5 px-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition-all"
                        style={{
                          background: verifyChannel === ch.value ? "rgba(26, 188, 156,0.08)" : "transparent",
                          border: `1.5px solid ${verifyChannel === ch.value ? "#1ABC9C" : "#e2e8f0"}`,
                          color: verifyChannel === ch.value ? "#1ABC9C" : "#64748b",
                        }}
                      >
                        <span className="text-base">{ch.icon}</span>
                        {ch.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400 mt-1">Verification code will be sent to your email</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-3 text-sm mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating account...
                  </>
                ) : (
                  "Create Free Account"
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

            <p className="mt-7 text-center text-sm text-gray-500">
              Already have an account?{" "}
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
