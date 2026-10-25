// Shared wedding music player. A single module-level Audio element is used so
// the song keeps playing across client-side page changes (invitation page to
// Aso Ebi page and back). Pages must navigate with Next.js <Link> (no full
// reload) for the music to continue uninterrupted.

let audio: HTMLAudioElement | null = null;
let audioSrc: string | null = null;

export function getWeddingAudio(src: string): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!audio) {
    audio = new Audio(src);
    audio.loop = true;
    audio.preload = "auto";
    audioSrc = src;
  } else if (audioSrc !== src) {
    const wasPlaying = !audio.paused;
    audio.src = src;
    audioSrc = src;
    if (wasPlaying) audio.play().catch(() => {});
  }
  return audio;
}

export function playWeddingMusic(src: string) {
  try {
    const a = getWeddingAudio(src);
    if (a && a.paused) a.play().catch(() => {});
  } catch {}
}

export function isWeddingMusicPlaying(): boolean {
  return !!audio && !audio.paused;
}
