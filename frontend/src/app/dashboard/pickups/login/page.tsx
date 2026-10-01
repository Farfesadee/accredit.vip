"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Package, Eye, EyeOff } from "lucide-react";

export default function PickupLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const token = document.cookie
      .split("; ")
      .find((r) => r.startsWith("pickup_token="));
    if (token) {
      router.push("/dashboard/pickups");
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/pickups/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Invalid credentials");
      }
      const data = await res.json();
      document.cookie = `pickup_token=${data.access_token}; path=/; max-age=43200; SameSite=Strict`;
      router.push("/dashboard/pickups");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fc] p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl p-8" style={{ border: "1px solid #e8edf2" }}>
          {/* Brand */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "#6F3D14" }}>
              <Package className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-[#0D1B2A]">Lajokes Fashion</h1>
            <p className="text-sm text-gray-500 mt-1">Pickup Management Portal</p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200">
              <p className="text-sm font-semibold text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@lajokesfashion.com"
                className="w-full h-12 px-4 rounded-xl border border-[#d9e2ec] text-sm outline-none focus:border-[#6F3D14] focus:ring-1 focus:ring-[#6F3D14]"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full h-12 px-4 pr-12 rounded-xl border border-[#d9e2ec] text-sm outline-none focus:border-[#6F3D14] focus:ring-1 focus:ring-[#6F3D14]"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-[#6F3D14] text-white font-bold text-sm hover:bg-[#5a3110] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-6">
            Authorized staff only
          </p>
        </div>
      </div>
    </div>
  );
}
