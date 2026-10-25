"use client";

import { useEffect, useState } from "react";
import { getWeddingAudio, isWeddingMusicPlaying } from "@/lib/wedding-music";

export default function WeddingMusicButton({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const a = getWeddingAudio(src);
    if (!a) return;
    setPlaying(!a.paused);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
    };
  }, [src]);

  const toggle = () => {
    const a = getWeddingAudio(src);
    if (!a) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  };

  return (
    <button
      onClick={toggle}
      aria-label={playing ? "Pause music" : "Play music"}
      className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center shadow-lg border transition-transform hover:scale-105"
      style={{
        background: "linear-gradient(160deg, #e8c05f, #b8892f)",
        borderColor: "#fbe8a8",
      }}
    >
      {playing ? (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff">
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      )}
      {playing && (
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full animate-ping" style={{ background: "#b8892f" }} />
      )}
    </button>
  );
}
