"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ReactNode } from "react";
import { CheckCircle2, XCircle, Clock, AlertTriangle, Package, Shield } from "lucide-react";

interface VerifyResponse {
  valid: boolean;
  reason?: string;
  customer_name?: string;
  code?: string;
  expires_at?: string;
  expires_at_formatted?: string;
}

export default function VerifyPickupPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<VerifyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`/api/v1/pickups/qr/${token}/data`);
        if (res.ok) {
          setData(await res.json());
        } else {
          setData({ valid: false, reason: "not_found" });
        }
      } catch {
        setData({ valid: false, reason: "not_found" });
      }
      setLoading(false);
    })();
  }, [token]);

  const handleConfirmPickup = async () => {
    setConfirming(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/pickups/qr/${token}/scan`, { method: "POST" });
      if (res.ok) {
        setConfirmed(true);
      } else {
        const err = await res.json();
        setError(err.detail || "Failed to confirm pickup");
      }
    } catch {
      setError("Network error");
    }
    setConfirming(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fc]">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-[#6F3D14] border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-gray-500">Verifying QR code...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fc]">
        <div className="bg-white rounded-xl p-8 max-w-md mx-4 text-center" style={{ border: "1px solid #e8edf2" }}>
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[#0D1B2A] mb-2">Invalid QR Code</h1>
          <p className="text-sm text-gray-500">This QR code could not be recognized.</p>
        </div>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fc]">
        <div className="bg-white rounded-xl p-8 max-w-md mx-4 text-center" style={{ border: "1px solid #e8edf2" }}>
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-[#0D1B2A] mb-2">Pickup Confirmed!</h1>
          <p className="text-sm text-emerald-700 font-semibold mb-1">{data.customer_name}</p>
          <p className="text-xs text-gray-500">Order has been successfully picked up.</p>
        </div>
      </div>
    );
  }

  if (!data.valid) {
    const icons: Record<string, ReactNode> = {
      already_picked_up: <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />,
      expired: <Clock className="w-16 h-16 text-red-400 mx-auto mb-4" />,
    };
    const titles: Record<string, string> = {
      already_picked_up: "Already Picked Up",
      expired: "QR Code Expired",
    };
    const messages: Record<string, string> = {
      already_picked_up: "This order has already been collected.",
      expired: "This QR code expired and is no longer valid for pickup.",
    };
    const reason = data.reason || "not_found";

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fc]">
        <div className="bg-white rounded-xl p-8 max-w-md mx-4 text-center" style={{ border: "1px solid #e8edf2" }}>
          {icons[reason] || <XCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />}
          <h1 className="text-xl font-bold text-[#0D1B2A] mb-2">{titles[reason] || "Invalid QR Code"}</h1>
          {data.customer_name && <p className="text-sm text-gray-500 mb-1">Customer: <strong>{data.customer_name}</strong></p>}
          <p className="text-sm text-gray-500">{messages[reason] || "This QR code is not valid."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fc] p-4">
      <div className="bg-white rounded-xl p-8 max-w-md w-full" style={{ border: "1px solid #e8edf2" }}>
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <Package className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-[#0D1B2A]">Valid QR Code</h1>
          <p className="text-sm text-emerald-700 font-semibold mt-1">Ready for Pickup</p>
        </div>

        {/* Customer info */}
        <div className="bg-[#fef6ee] rounded-xl p-5 mb-6" style={{ border: "1px solid #e8d5b5" }}>
          <div className="text-center mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Customer</p>
            <p className="text-lg font-bold text-[#0D1B2A]">{data.customer_name}</p>
          </div>
          <div className="text-center mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Pickup Code</p>
            <p className="text-3xl font-bold text-[#6F3D14] tracking-[8px]">{data.code}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Expires</p>
            <p className="text-sm font-semibold text-[#64748b]">{data.expires_at_formatted}</p>
          </div>
        </div>

        {/* Security notice */}
        <div className="flex items-start gap-3 mb-6 p-3 rounded-lg bg-amber-50 border border-amber-200">
          <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-amber-800">Security Notice</p>
            <p className="text-xs text-amber-700">Only an authorized staff member should scan this code. Once confirmed, this QR will no longer be valid.</p>
          </div>
        </div>

        {/* Confirm button */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 font-semibold">
            {error}
          </div>
        )}
        <button
          onClick={handleConfirmPickup}
          disabled={confirming}
          className="w-full h-12 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {confirming ? (
            <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Confirming...</>
          ) : (
            <><CheckCircle2 className="w-5 h-5" /> Confirm Pickup</>
          )}
        </button>

        <p className="text-xs text-gray-400 text-center mt-4">
          Service delivered by <strong>Lajokes Fashion</strong>
        </p>
      </div>
    </div>
  );
}
