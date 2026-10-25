"use client";

import { useEffect, useState } from "react";

/**
 * One song, one audio element, one visit.
 *
 * The montage invitations (The Art of Attention, Nelkon & Blessing) start their
 * music on the welcome screen, before the invitation component even mounts, and
 * keep it running through the cover, the film and the invitation. A module level
 * element (created with `document.createElement`, not part of the React tree) is
 * what makes that possible: no re-render, no remount and no route inside the
 * invitation can stop it or start it again.
 *
 * Browsers refuse audible autoplay until the visitor has interacted with the
 * page, and some refuse the very first call while the document is still
 * settling. So the start is: try to play, raise the volume to full, retry a few
 * times if the browser is not ready yet, and if the sound is still held back
 * keep the same track running silently and in time, then unmute inside the
 * first real gesture of any kind (a click, a tap, a key press, a wheel).
 * Nothing on the page ever asks the guest to press anything for sound.
 */

/** Full scale on purpose: the client wants the song to arrive with the page.
 *  1 is the loudest an audio element can be; a Web Audio gain stage could go
 *  further but it stays silent until a gesture, which defeats the point. */
const VOLUME = 1;
const RETRY_MS = 250;
const MAX_RETRIES = 20;

export type InviteMusicState = {
  /** The element exists and has been told to play. */
  started: boolean;
  /** Not paused. */
  playing: boolean;
  /** Unmuted and audible (the guest can actually hear it). */
  audible: boolean;
  /** The browser refused audible playback for now. */
  blocked: boolean;
};

const INITIAL: InviteMusicState = {
  started: false,
  playing: false,
  audible: false,
  blocked: false,
};

class InviteMusicController {
  private el: HTMLAudioElement | null = null;
  private url: string | null = null;
  private state: InviteMusicState = INITIAL;
  private listeners = new Set<(state: InviteMusicState) => void>();
  private userMuted = false;
  private settling = false;
  private gesturesBound = false;
  private retries = 0;
  private retryTimer: number | null = null;
  private wantPlay = false;

  getState(): InviteMusicState {
    return this.state;
  }

  subscribe(listener: (state: InviteMusicState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(patch: Partial<InviteMusicState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.state));
  }

  private ensure(): HTMLAudioElement | null {
    if (typeof window === "undefined") return null;
    if (!this.el) {
      const el = document.createElement("audio");
      el.loop = true;
      el.preload = "auto";
      el.volume = VOLUME;
      el.addEventListener("play", () => this.emit({ playing: true }));
      el.addEventListener("pause", this.onNativePause);
      // Data arriving is the most common reason a first attempt was refused.
      el.addEventListener("loadedmetadata", () => this.retryNow());
      el.addEventListener("loadeddata", () => this.retryNow());
      el.addEventListener("canplay", () => this.retryNow());
      this.el = el;
      this.bindGestures();
    }
    return this.el;
  }

  /** Start the song for this event. Safe to call on every render and remount. */
  start(url?: string | null) {
    if (!url) return;
    const a = this.ensure();
    if (!a) return;
    if (this.url !== url) {
      this.url = url;
      a.src = url;
      this.userMuted = false;
      this.retries = 0;
    }
    if (this.userMuted) return;
    this.wantPlay = true;
    if (!a.paused && !a.muted) {
      this.emit({ started: true, playing: true, audible: true, blocked: false });
      return;
    }
    this.attempt();
  }

  /** Play inaudibly first (always permitted), then bring the volume straight up. */
  private attempt() {
    const a = this.el;
    if (!a || this.userMuted || !this.wantPlay) return;
    this.clearRetry();
    this.settling = true;
    try {
      a.muted = false;
      a.volume = 0;
      a.play()
        .then(() => {
          a.volume = VOLUME;
          window.setTimeout(() => {
            this.settling = false;
            const el = this.el;
            if (!el) return;
            if (el.paused) {
              this.playSilent();
              return;
            }
            this.retries = 0;
            this.emit({ started: true, playing: true, audible: true, blocked: false });
          }, 300);
        })
        .catch(() => {
          this.settling = false;
          this.playSilent();
        });
    } catch {
      this.settling = false;
      this.playSilent();
    }
  }

  /** The browser is holding the sound back: run the same track silently and in
   *  time, so the guest's first touch only has to raise the volume. */
  private playSilent() {
    const a = this.el;
    if (!a || this.userMuted || !this.wantPlay) return;
    a.muted = true;
    a.volume = VOLUME;
    a.play()
      .then(() => this.emit({ started: true, playing: true, audible: false, blocked: true }))
      .catch(() => {
        this.emit({ started: true, playing: false, audible: false, blocked: true });
        this.scheduleRetry();
      });
  }

  /** A browser that pauses the element itself (policy, or a stalled stream)
   *  gets the track back without the guest noticing. */
  private onNativePause = () => {
    this.emit({ playing: false });
    if (this.userMuted || this.settling || !this.wantPlay) return;
    window.setTimeout(() => {
      const a = this.el;
      if (!a || this.userMuted || !a.paused) return;
      if (a.muted) this.playSilent();
      else this.attempt();
    }, 200);
  };

  private retryNow() {
    if (!this.wantPlay || this.userMuted) return;
    const a = this.el;
    if (!a || !a.paused) return;
    this.attempt();
  }

  private scheduleRetry() {
    if (this.retryTimer !== null || !this.wantPlay || this.userMuted) return;
    if (this.retries >= MAX_RETRIES) return;
    this.retries += 1;
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = null;
      if (this.userMuted || !this.wantPlay) return;
      const a = this.el;
      if (a && !a.paused) return;
      this.attempt();
    }, RETRY_MS);
  }

  private clearRetry() {
    if (this.retryTimer !== null) {
      window.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private bindGestures() {
    if (this.gesturesBound || typeof window === "undefined") return;
    this.gesturesBound = true;
    const release = () => {
      const a = this.el;
      if (!a || this.userMuted) return;
      this.retries = 0;
      this.wantPlay = true;
      if (a.paused) {
        this.attempt();
        return;
      }
      if (!a.muted && a.volume > 0) return;
      // Running silently: this gesture is the permission we were waiting for.
      a.muted = false;
      a.volume = VOLUME;
      a.play()
        .then(() => this.emit({ started: true, playing: true, audible: true, blocked: false }))
        .catch(() => {
          a.muted = true;
          a.volume = VOLUME;
          this.emit({ audible: false, blocked: true });
        });
    };
    ["pointerdown", "pointerup", "touchstart", "touchend", "click", "keydown", "wheel"].forEach(
      (event) => window.addEventListener(event, release, { passive: true })
    );
    // A gesture in another tab or a return to this one also counts.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") this.retryNow();
    });
  }

  /** The guest's own control. This is the only thing that stops the song. */
  toggle() {
    const a = this.el ?? this.ensure();
    if (!a) return;
    if (!a.paused && (a.muted || a.volume === 0)) {
      // Running silently: the press itself is the permission.
      this.userMuted = false;
      this.wantPlay = true;
      a.muted = false;
      a.volume = VOLUME;
      a.play()
        .then(() => this.emit({ started: true, playing: true, audible: true, blocked: false }))
        .catch(() => {
          a.muted = true;
          this.emit({ audible: false, blocked: true });
        });
      return;
    }
    if (!a.paused) {
      this.userMuted = true;
      this.wantPlay = false;
      this.clearRetry();
      a.pause();
      this.emit({ playing: false, audible: false, blocked: false });
      return;
    }
    this.userMuted = false;
    this.wantPlay = true;
    this.retries = 0;
    this.attempt();
  }

  /** Leaving the invitation: nothing of this song should follow the guest. */
  stop() {
    const a = this.el;
    this.wantPlay = false;
    this.clearRetry();
    if (a) {
      a.pause();
      a.removeAttribute("src");
      try {
        a.load();
      } catch {
        /* ignore */
      }
    }
    this.el = null;
    this.url = null;
    this.userMuted = false;
    this.settling = false;
    this.retries = 0;
    this.emit(INITIAL);
  }
}

export const inviteMusic = new InviteMusicController();

/** Subscribe a component to the one song. Starting it is idempotent. */
export function useInviteMusic(url?: string | null) {
  const [state, setState] = useState<InviteMusicState>(() => inviteMusic.getState());

  useEffect(() => {
    const unsubscribe = inviteMusic.subscribe(setState);
    if (url) inviteMusic.start(url);
    setState(inviteMusic.getState());
    return unsubscribe;
  }, [url]);

  return {
    ...state,
    toggle: () => inviteMusic.toggle(),
  };
}
