"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { apiClient } from "@/lib/api-client";

function ScannerPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ status: string; message: string; guest?: any; event?: any } | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [stats, setStats] = useState({ checked_in: 0, total_guests: 0 });
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const locationOptions = ["airport", "hotel", "venue"];
  const scanTimer = useRef<any>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      apiClient<any[]>("/scanner/events").then((data) => setEvents(data)).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (selectedEvent) {
      apiClient<any>(`/scanner/events/${selectedEvent.id}/stats`).then((d: any) => setStats(d)).catch(() => {});
    }
  }, [selectedEvent]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) videoRef.current.srcObject = stream;
      setScanning(true);
      scanLoop();
    } catch { setResult({ status: "error", message: "Camera access denied. Use manual entry instead." }); }
  };

  const scanLoop = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = detectBarcode(imageData);
      if (code) {
        handleScan(code);
        return;
      }
    }
    scanTimer.current = requestAnimationFrame(scanLoop);
  };

  const detectBarcode = (imageData: ImageData): string | null => {
    return null;
  };

  const extractToken = (raw: string) => {
    try {
      const url = new URL(raw);
      const segments = url.pathname.split("/").filter(Boolean);
      return segments.pop() || raw;
    } catch {
      return raw;
    }
  };

  const handleScan = async (raw: string) => {
    setScanning(false);
    if (scanTimer.current) cancelAnimationFrame(scanTimer.current);
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
    }
    const token = extractToken(raw);
    try {
      const res = await apiClient<any>("/scanner/checkin", { method: "POST", body: { token, location: selectedLocation } });
      setResult(res);
      if (selectedEvent) {
      apiClient<any>(`/scanner/events/${selectedEvent.id}/stats`).then((d: any) => setStats(d)).catch(() => {});
      }
    } catch (err: any) {
      setResult({ status: "error", message: err.message || "Check-in failed" });
    }
  };

  const handleManualLookup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const raw = (form.elements.namedItem("token") as HTMLInputElement).value.trim();
    if (!raw) return;
    setResult(null);
    const token = extractToken(raw);
    try {
      const res = await apiClient<any>("/scanner/verify", { method: "POST", body: { token } });
      if (res.valid) {
        setResult({ status: "found", message: `Found: ${res.guest?.name}`, guest: res.guest, event: res.event });
      } else {
        setResult({ status: "error", message: res.message });
      }
    } catch (err: any) {
      setResult({ status: "error", message: err.message || "Lookup failed" });
    }
  };

  const confirmCheckin = async () => {
    if (!result?.guest) return;
    try {
      const form = document.getElementById("scan-form") as HTMLFormElement;
      const raw = (form?.elements.namedItem("token") as HTMLInputElement)?.value || "";
      await handleScan(raw);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-[#0D1B2A] text-white">
      <header className="border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <button onClick={() => router.push("/dashboard")} className="text-sm text-teal-400 hover:underline">&larr; Dashboard</button>
        <h1 className="font-bold text-lg">QR Scanner</h1>
        <div className="w-16" />
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {events.length > 0 && (
          <select onChange={(e) => setSelectedEvent(events.find((ev) => ev.id === Number(e.target.value)))} className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-sm text-white">
            <option value="">Select event</option>
            {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
          </select>
        )}

        {selectedEvent && (
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-white/5 p-3"><p className="text-2xl font-black text-green-400">{stats.checked_in}</p><p className="text-xs text-white/60">Checked In</p></div>
            <div className="rounded-xl bg-white/5 p-3"><p className="text-2xl font-black">{stats.total_guests}</p><p className="text-xs text-white/60">Total Guests</p></div>
          </div>
        )}
        <div className="mt-3">
          <label className="block text-sm text-white/60 mb-1">Scan Location</label>
          <select onChange={(e) => setSelectedLocation(e.target.value || null)} className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm text-white">
            <option value="">Select location</option>
            {locationOptions.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
          </select>
        </div>

        {!scanning ? (
          <div className="space-y-3">
            <button onClick={startCamera} className="w-full rounded-xl bg-teal-600 py-4 font-bold hover:bg-teal-700 transition">Scan QR Code</button>
            <details className="rounded-xl bg-white/5 border border-white/10">
              <summary className="px-4 py-3 text-sm font-semibold cursor-pointer">Manual Entry</summary>
              <form id="scan-form" onSubmit={handleManualLookup} className="p-4 space-y-3">
                <input name="token" placeholder="Paste QR token" className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-sm" />
                <button type="submit" className="w-full rounded-xl bg-teal-600 py-3 font-bold text-sm hover:bg-teal-700 transition">Look Up</button>
              </form>
            </details>
          </div>
        ) : (
          <div className="relative">
            <video ref={videoRef} autoPlay playsInline className="w-full rounded-xl" />
            <canvas ref={canvasRef} className="hidden" />
            <p className="text-center text-sm text-white/60 mt-2">Point camera at QR code...</p>
            <button onClick={() => { setScanning(false); if (videoRef.current?.srcObject) { (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop()); } }} className="mt-2 w-full rounded-xl bg-red-600/80 py-3 font-bold text-sm hover:bg-red-700 transition">Cancel Scan</button>
          </div>
        )}

        {result && (
          <div className={`rounded-xl p-4 ${result.status === "approved" ? "bg-green-900/50 border border-green-500" : result.status === "found" ? "bg-blue-900/50 border border-blue-500" : result.status === "declined" ? "bg-amber-900/50 border border-amber-500" : "bg-red-900/50 border border-red-500"}`}>
            <p className="font-bold">{result.status === "approved" ? "Checked In" : result.status === "found" ? "Guest Found" : result.status === "declined" ? "Invitation Declined" : result.status === "error" ? "Error" : result.message}</p>
            <p className="text-sm text-white/70">{result.message}</p>
            {result.guest && <p className="text-sm mt-1">{result.guest.name} &middot; {result.guest.phone}</p>}
            {result.status === "found" && <button onClick={confirmCheckin} className="mt-3 w-full rounded-xl bg-green-600 py-3 font-bold text-sm hover:bg-green-700 transition">Confirm Check-in</button>}
            {result.status !== "found" && <button onClick={() => setResult(null)} className="mt-3 w-full rounded-xl bg-white/10 py-3 font-bold text-sm hover:bg-white/20 transition">Scan Again</button>}
          </div>
        )}
      </div>
    </div>
  );
}

import { Suspense } from "react";

export default function ScanPage() {
  return <Suspense fallback={null}><ScannerPage /></Suspense>;
}
