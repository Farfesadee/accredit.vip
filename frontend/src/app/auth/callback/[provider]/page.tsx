"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";

export default function OAuthCallbackPage() {
  const params = useParams();
  const provider = params?.provider as string;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash.substring(1);
    const search = window.location.search.substring(1);

    const hashParams = new URLSearchParams(hash);
    const searchParams = new URLSearchParams(search);

    const idToken = hashParams.get("id_token") || searchParams.get("id_token");
    const accessToken = hashParams.get("access_token") || searchParams.get("access_token");
    const token = idToken || accessToken;
    const email = hashParams.get("email") || searchParams.get("email");
    const name = hashParams.get("name") || searchParams.get("name");

    if (!token) {
      window.location.href = "/login?error=social_auth_failed";
      return;
    }

    apiClient<{ access_token: string; user: { id: number; email: string; full_name: string; role: string; is_verified: boolean } }>("/auth/social", {
      method: "POST",
      body: { provider, id_token: token, email, full_name: name },
    })
      .then(() => {
        window.location.href = "/dashboard";
      })
      .catch(() => {
        window.location.href = "/login?error=social_auth_failed";
      });
  }, [provider]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D1B2A]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/70 text-sm">Completing sign in...</p>
      </div>
    </div>
  );
}
