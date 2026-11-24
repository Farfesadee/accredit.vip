"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { HeadcountDashboard } from "@/components/headcount/HeadcountDashboard";

export default function HeadcountPage() {
  const params = useParams();
  const eventId = Number(params.id);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <HeadcountDashboard eventId={eventId} />
    </div>
  );
}