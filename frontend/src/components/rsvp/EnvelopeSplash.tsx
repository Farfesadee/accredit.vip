"use client";

import { useState, useRef, useCallback } from "react";

interface EnvelopeSplashProps {
  eventTitle: string;
  celebrantName: string;
  eventDate: string;
  coverImage?: string | null;
  onMusicStart: () => void;
  onOpen: () => void;
}

export default function EnvelopeSplash({
  eventTitle,
  celebrantName,
  eventDate,
  coverImage,
  onMusicStart,
  onOpen,
}: EnvelopeSplashProps) {
  const [isOpening, setIsOpening] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const openedRef = useRef(false);

  const handleOpen = useCallback(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    onMusicStart();
    setIsOpening(true);
    setTimeout(() => {
      setIsOpen(true);
      setTimeout(() => onOpen(), 800);
    }, 2000);
  }, [onMusicStart, onOpen]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #1a0a14 0%, #2d1228 50%, #1a0a14 100%)" }}
    >
      {/* Pink/rose bokeh particles */}
      {!isOpening && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                width: `${4 + Math.random() * 12}px`,
                height: `${4 + Math.random() * 12}px`,
                backgroundColor: `rgba(26, 188, 156, ${0.1 + Math.random() * 0.25})`,
                filter: `blur(${1 + Math.random() * 3}px)`,
                animation: `bokeh ${3 + Math.random() * 5}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 4}s`,
              }}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes bokeh {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.2; }
          50% { transform: translateY(-30px) scale(1.3); opacity: 0.6; }
        }
        @keyframes envelopeFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(0.5deg); }
        }
        @keyframes sealPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(26, 188, 156, 0.3); }
          50% { box-shadow: 0 0 40px rgba(26, 188, 156, 0.6); }
        }
        @keyframes envelopeOpen {
          0% { transform: scale(1); }
          30% { transform: scale(1.05); }
          100% { transform: scale(1.1) translateY(-30px); opacity: 0; }
        }
        @keyframes cardReveal {
          0% { transform: translateY(60px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      {!isOpen ? (
        <div className="flex flex-col items-center z-10">
          <p className="text-[#1ABC9C]/60 text-xs uppercase tracking-[0.4em] mb-3 font-medium">You&apos;re Invited To</p>
          {(() => {
            const parts = eventTitle.split(": ");
            return (
              <>
                <h1
                  className="text-3xl sm:text-5xl font-black text-center mb-1"
                  style={{
                    background: "linear-gradient(135deg, #1ABC9C, #f472b6, #1ABC9C)",
                    backgroundClip: "text",
                    WebkitBackgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  {parts[0]}
                </h1>
                {parts.length > 1 && (
                  <p className="text-[#1ABC9C]/50 text-sm italic text-center mb-2">Hosted by {parts.slice(1).join(": ")}</p>
                )}
              </>
            );
          })()}
          <p className="text-[#1ABC9C]/40 text-sm mb-10">{eventDate}</p>

          {/* CSS Pink Envelope */}
          <div
            onClick={handleOpen}
            className={`relative cursor-pointer group ${!isOpening ? "animate-[envelopeFloat_4s_ease-in-out_infinite]" : ""}`}
          >
            <div
              className={`relative transition-all duration-1000 ${
                isOpening ? "animate-[envelopeOpen_2s_ease-out_forwards]" : ""
              }`}
              style={{
                width: "288px",
                height: "192px",
                boxShadow: isOpening ? "none" : "0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(26, 188, 156,0.3)",
              }}
            >
              {/* Envelope body */}
              <div
                className="absolute inset-0 rounded-lg"
                style={{
                  background: "linear-gradient(145deg, #1ABC9C, #c4146e)",
                  borderRadius: "12px",
                }}
              />
              {/* Envelope flap (triangle) */}
              <div
                className="absolute top-0 left-0 right-0"
                style={{
                  height: "50%",
                  clipPath: "polygon(0 0, 100% 0, 50% 100%)",
                  background: "linear-gradient(180deg, #d61a7b, #1ABC9C)",
                  borderRadius: "12px 12px 0 0",
                  zIndex: 1,
                }}
              />
              {/* Bottom fold lines */}
              <div
                className="absolute bottom-0 left-0 right-0"
                style={{
                  height: "55%",
                  clipPath: "polygon(0 100%, 50% 0%, 100% 100%)",
                  background: "linear-gradient(0deg, #b81464, #c4146e)",
                  opacity: 0.5,
                }}
              />
              {/* Shimmer overlay */}
              <div
                className="absolute inset-0 rounded-lg"
                style={{
                  background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer 3s ease-in-out infinite",
                }}
              />
              {/* Wax seal overlay */}
              {!isOpening && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                  <div
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center animate-[sealPulse_2s_ease-in-out_infinite]"
                    style={{
                      background: "radial-gradient(circle at 35% 35%, #1ABC9C, #a01050)",
                      boxShadow: "0 4px 20px rgba(26, 188, 156,0.5), inset 0 2px 4px rgba(255,255,255,0.3)",
                    }}
                  >
                    <span className="text-white text-2xl font-bold italic" style={{ textShadow: "0 2px 4px rgba(0,0,0,0.3)" }}>A</span>
                  </div>
                </div>
              )}
            </div>

            {!isOpening && (
              <p className="text-center mt-8 text-[#1ABC9C]/50 text-sm animate-pulse tracking-widest">
                TAP TO OPEN
              </p>
            )}
          </div>

          {isOpening && (
            <div className="mt-10 text-center animate-[cardReveal_1s_ease-out]">
              <p
                className="text-2xl sm:text-3xl font-black"
                style={{
                  background: "linear-gradient(135deg, #1ABC9C, #f472b6, #1ABC9C)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  color: "transparent",
                }}
              >
                Happy Birthday {celebrantName}!
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center animate-[cardReveal_0.8s_ease-out] z-10">
          <p className="text-[#1ABC9C]/60 text-lg">Loading your invitation...</p>
        </div>
      )}
    </div>
  );
}
