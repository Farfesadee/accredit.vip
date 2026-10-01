"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, X } from "lucide-react";

interface QRScannerProps {
  onScan: (token: string) => void;
  onError: (message: string) => void;
  onStart: () => void;
  onStop: () => void;
  scanningDisabled?: boolean;
}

export default function QRScanner({ onScan, onError, onStart, onStop, scanningDisabled }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const frameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [scannerStarted, setScannerStarted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stopMedia();
    };
  }, []);

  function stopMedia() {
    if (frameTimerRef.current) {
      clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  const stopScanner = () => {
    stopMedia();
    setScannerStarted(false);
    onStop();
  };

  const decodeFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || scanningDisabled) return;

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (width === 0 || height === 0) return;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (code) {
      const token = code.data;
      onScan(token);
    }
  };

  const startScanner = async () => {
    setError("");
    onStart();
    setScannerStarted(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });

      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;

      // Wait for next render so the <video> element is mounted
      await new Promise((r) => setTimeout(r, 50));
      if (!mountedRef.current) return;

      const video = videoRef.current;
      if (!video) {
        stopMedia();
        setScannerStarted(false);
        onStop();
        return;
      }

      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play();

      // Give the camera a moment to stabilize
      await new Promise((r) => setTimeout(r, 300));

      if (!mountedRef.current) return;

      setTimeout(() => {
        videoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);

      // Scan every 250ms: faster feel without wasting CPU on every frame
      frameTimerRef.current = setInterval(decodeFrame, 250);
    } catch (err: any) {
      if (!mountedRef.current) return;
      stopMedia();
      setScannerStarted(false);
      onStop();

      const errorMsg = err.message || "";
      let userMessage = "Camera access denied. Use manual search instead.";

      if (errorMsg.includes("NotAllowedError") || errorMsg.includes("Permission denied")) {
        userMessage = "Camera permission denied. Please enable camera access in your browser settings and try again.";
      } else if (errorMsg.includes("NotFoundError") || errorMsg.includes("No camera")) {
        userMessage = "No camera found. Please use manual search to check in guests.";
      } else if (errorMsg.includes("NotSupportedError")) {
        userMessage = "Your browser doesn't support camera access. Use manual search instead.";
      } else if (errorMsg.includes("HTTPS")) {
        userMessage = "Camera access requires HTTPS. Please ensure you're using a secure connection.";
      }

      setError(userMessage);
      onError(userMessage);
    }
  };

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
      {scannerStarted && (
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <p className="text-xs font-semibold text-green-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            SCANNING
          </p>
          <button onClick={stopScanner} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600/80 hover:bg-red-700 text-sm font-semibold transition min-h-[44px]">
            <X className="w-4 h-4" />
            Stop
          </button>
        </div>
      )}
      <div className={`relative w-full ${scannerStarted ? "min-h-[350px]" : "min-h-[280px]"}`}>
        {scannerStarted ? (
          <div className="relative w-full h-full">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas
              ref={canvasRef}
              className="hidden"
            />
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div
                className="absolute left-0 right-0 h-1 bg-gradient-to-b from-teal-500 to-transparent"
                style={{
                  animation: "scannerJsQrLine 2s ease-in-out infinite",
                  boxShadow: "0 0 20px rgba(236, 72, 153, 0.8)"
                }}
              />
            </div>
            <style>{`
              @keyframes scannerJsQrLine {
                0% { top: 5%; }
                50% { top: 95%; }
                100% { top: 5%; }
              }
            `}</style>
          </div>
        ) : (
          <button
            onClick={startScanner}
            className="w-full min-h-[280px] flex flex-col items-center justify-center text-white/30 cursor-pointer hover:bg-white/[0.02] transition group"
          >
            <div className="relative mb-4">
              <Camera className="w-20 h-20 text-teal-500/60 group-hover:text-teal-400/80 transition" style={{ animation: "breathe 2.5s ease-in-out infinite" }} />
              <div className="absolute inset-0 rounded-full bg-teal-500/10 blur-xl" style={{ animation: "breathe 2.5s ease-in-out infinite" }} />
            </div>
            <p className="font-semibold text-base text-white/60 group-hover:text-white/80 transition">Start Live Scanner</p>
            <p className="text-xs mt-1.5 text-white/30">Tap anywhere to activate the camera</p>
            <style>{`@keyframes breathe { 0%,100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.06); opacity: 1; } }`}</style>
          </button>
        )}
      </div>
      {error && (
        <div className="p-4 border-t border-white/10 text-center text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
