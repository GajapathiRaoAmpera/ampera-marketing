// A short two-tone "new message" chime, synthesized with the Web Audio API
// instead of shipping an audio file: keeps this dependency-free and avoids
// needing to host/version an asset for a two-note beep.
//
// Browsers block audio until a user gesture has happened on the page at
// least once (autoplay policy), so playNewMessageChime() silently no-ops if
// the AudioContext can't start yet - a missed chime on the very first
// message before any click is an acceptable tradeoff for never throwing.

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioContext) return audioContext;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audioContext = new Ctor();
  return audioContext;
}

function playTone(ctx: AudioContext, frequency: number, startTime: number, duration: number, peakGain: number) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

export const SOUND_PREFERENCE_KEY = "sound-new-messages";

/** Whether the new-message chime is on (Account settings → Preferences). On by default. */
export function isChimeEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_PREFERENCE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function playNewMessageChime(): void {
  if (!isChimeEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    playTone(ctx, 880, now, 0.14, 0.18);
    playTone(ctx, 1175, now + 0.09, 0.16, 0.16);
  } catch {
    // Autoplay-blocked or unsupported: a missed chime is fine, never throw.
  }
}
