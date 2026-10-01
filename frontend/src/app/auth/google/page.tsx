"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function GoogleAuthRedirect() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const mode = searchParams.get("mode") || "login";
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
    const redirectUri = window.location.origin + "/auth/callback/google";
    const nonce = Math.random().toString(36).substring(2);
    const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=id_token&scope=openid%20email%20profile&nonce=${nonce}`;
    window.location.href = googleUrl;
  }, [searchParams]);

  return null;
}

export default function GoogleAuthPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D1B2A]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/70 text-sm">Redirecting to Google...</p>
      </div>
      <Suspense fallback={null}>
        <GoogleAuthRedirect />
      </Suspense>
    </div>
  );
}
