"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OldChangePasswordRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/change-password");
  }, [router]);
  return null;
}
