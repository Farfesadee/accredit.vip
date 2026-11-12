"use client";

// The sign-in screen for the couple's own dashboard. It is rendered only when
// the portal build sets NEXT_PUBLIC_PORTAL_NAME, so the platform login at
// accredit.vip is untouched. Nothing on this screen names the platform: the
// palette and the photograph come from the wedding itself.
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/contexts/auth-context";
import { PORTAL, PORTAL_SITE_URL, PORTAL_TAGLINE } from "@/lib/portal";

const GOLD = "#C9A227";
const INK = "#1F1B16";
const CREAM = "#FAF7F0";
const MUTED = "#8A8074";

function PortalLoginForm() {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password, rememberMe);
      router.push(redirect || "/admin");
    } catch (err: any) {
      const msg = err?.message || err?.detail || "That email and password did not match. Please try again.";
      setError(msg);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2" style={{ background: CREAM }}>
      {/* Photograph */}
      <div className="relative hidden lg:block overflow-hidden">
        <Image
          src="/uploads/wedding-7e961344fddf.jpg"
          alt=""
          fill
          priority
          sizes="50vw"
          style={{ objectFit: "cover", objectPosition: "center 30%" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(20,16,12,0.55) 0%, rgba(20,16,12,0.18) 38%, rgba(20,16,12,0.72) 100%)",
          }}
        />
        <div className="absolute inset-0 flex flex-col justify-between p-14">
          <p className="text-[11px] font-semibold uppercase" style={{ color: "rgba(255,255,255,0.72)", letterSpacing: "0.32em" }}>
            The Wedding of
          </p>
          <div>
            <h1
              className="font-serif text-white leading-[1.05]"
              style={{ fontSize: "clamp(38px, 3.4vw, 56px)", letterSpacing: "-0.01em" }}
            >
              {PORTAL || "Patrick & Sarah"}
            </h1>
            {PORTAL_TAGLINE && (
              <p className="mt-4 text-sm" style={{ color: "rgba(255,255,255,0.78)", letterSpacing: "0.02em" }}>
                {PORTAL_TAGLINE}
              </p>
            )}
            <div className="mt-6 h-px w-16" style={{ background: GOLD }} />
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex flex-col">
        <div className="relative h-44 lg:hidden overflow-hidden">
          <Image
            src="/uploads/wedding-7e961344fddf.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            style={{ objectFit: "cover", objectPosition: "center 30%" }}
          />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(180deg, rgba(20,16,12,0.35) 0%, rgba(20,16,12,0.75) 100%)" }}
          />
          <div className="absolute inset-0 flex flex-col justify-end p-6">
            <p className="text-[9px] font-semibold uppercase" style={{ color: "rgba(255,255,255,0.7)", letterSpacing: "0.3em" }}>
              The Wedding of
            </p>
            <h1 className="mt-2 font-serif text-white text-2xl leading-tight">{PORTAL || "Patrick & Sarah"}</h1>
          </div>
        </div>

        <div className="flex-1 flex items-start lg:items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-sm">
            <p className="text-[10px] font-semibold uppercase" style={{ color: GOLD, letterSpacing: "0.3em" }}>
              Private Dashboard
            </p>
            <h2 className="mt-3 font-serif text-3xl" style={{ color: INK }}>
              Sign in
            </h2>
            <p className="mt-2 text-sm" style={{ color: MUTED }}>
              Guest list, invitations and entry codes for {PORTAL || "the wedding"}.
            </p>

            {error && (
              <div className="mt-6 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "#E7C9C4", background: "#FBEFED", color: "#8C2F21" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-semibold" style={{ color: INK }}>
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition-colors"
                  style={{ borderColor: "#E4DCCF", color: INK }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = GOLD)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#E4DCCF")}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-sm font-semibold" style={{ color: INK }}>
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="w-full rounded-xl border bg-white px-4 py-3 pr-12 text-sm outline-none transition-colors"
                    style={{ borderColor: "#E4DCCF", color: INK }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = GOLD)}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#E4DCCF")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    aria-label={showPass ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-3 flex items-center"
                    style={{ color: MUTED }}
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

              <label className="flex items-center gap-2 text-sm" style={{ color: MUTED }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border"
                  style={{ accentColor: GOLD }}
                />
                Keep me signed in for 7 days
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl px-4 py-3 text-sm font-bold transition-all disabled:opacity-60"
                style={{ background: GOLD, color: "#20180A" }}
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <p className="mt-6 text-xs leading-relaxed" style={{ color: MUTED }}>
              Forgot your password? Ask your planner to reset it for you.
            </p>

            {PORTAL_SITE_URL && (
              <a
                href={PORTAL_SITE_URL}
                className="mt-8 inline-block text-xs font-semibold"
                style={{ color: GOLD, letterSpacing: "0.02em" }}
              >
                Visit the wedding website
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PortalLogin() {
  return (
    <Suspense fallback={null}>
      <PortalLoginForm />
    </Suspense>
  );
}
