"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff, Shield } from "lucide-react";
import { apiClient } from "@/lib/api-client";

export default function AccreditationLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await apiClient<{ access_token: string; user: any }>("/scanner/accreditation-login", {
        method: "POST",
        body: { email, password },
      });

      if (res.access_token) {
        sessionStorage.setItem("accreditation_token", res.access_token);
      }

      router.push("/accreditation/scan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4 py-4">
      <Link href="/" className="mb-8 hover:opacity-80 transition-opacity">
        <Image
          src="/logo-stacked.png"
          alt="Accredit Interactive"
          width={834}
          height={549}
          className="h-28 w-auto object-contain"
        />
      </Link>

      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-[#e8edf2] shadow-[0_16px_42px_rgba(15,23,42,0.08)] p-8">
          <div className="mb-8 text-center">
            <div className="inline-block px-4 py-2 rounded-lg bg-[#1ABC9C]/10 mb-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1ABC9C]">Accreditation Access</p>
            </div>
            <h1 className="text-3xl font-black text-[#0D1B2A] mt-3">Sign In</h1>
            <p className="text-sm text-[#64748b] mt-2">
              Sign in to scan guest QR codes and manage venue access
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-bold text-[#23466f] mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl border border-[#d9e2ec] bg-white text-[#0D1B2A] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20 focus:border-[#1ABC9C] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-bold text-[#23466f] mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-[#d9e2ec] bg-white text-[#0D1B2A] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20 focus:border-[#1ABC9C] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#0D1B2A] transition-colors"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: loading ? "#94a3b8" : "linear-gradient(135deg, #1ABC9C, #16A085)",
                boxShadow: loading ? "none" : "0 6px 20px rgba(26, 188, 156,0.35)",
              }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[#e8edf2] text-center">
            <p className="text-xs text-[#94a3b8]">
              Not an accreditation officer?{" "}
              <Link href="/login" className="font-bold text-[#1ABC9C] hover:underline">
                User Login
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 p-4 rounded-xl bg-[#0D1B2A] flex gap-3 shadow-lg">
          <Shield className="w-5 h-5 text-[#1ABC9C] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-white mb-1">Secure Access Required</p>
            <p className="text-xs text-white/70 leading-snug">
              This portal is for authorized event staff only. Sign in with your organizer account to scan guest QR codes and manage check-ins.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
