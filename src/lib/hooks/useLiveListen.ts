"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { voiceRealtimeApi } from "@/lib/api/voice-realtime";

export type ListenState = "idle" | "connecting" | "listening";

// If playback falls this far behind real time, skip ahead: a live call is worth hearing now or not at all.
const MAX_LAG_SECONDS = 1.5;
// A little head start so a late packet does not make the audio stutter.
const HEAD_START_SECONDS = 0.12;

/**
 * Hears a live call in the browser: the caller and the agent, as it happens.
 *
 * Each message from the call service is one frame of audio:
 *   byte 0 = track (0 caller, 1 agent), bytes 1-4 = sample rate (big-endian),
 *   the rest = 16-bit little-endian mono PCM. Each track is played at its own
 *   rate, queued back to back, and the browser's audio engine resamples.
 */
export function useLiveListen(callId: string) {
  const [state, setState] = useState<ListenState>("idle");
  const [error, setError] = useState("");
  const socket = useRef<WebSocket | null>(null);
  const context = useRef<AudioContext | null>(null);
  const playAt = useRef<[number, number]>([0, 0]);

  const stop = useCallback(() => {
    const ws = socket.current;
    socket.current = null;
    ws?.close();
    const audio = context.current;
    context.current = null;
    void audio?.close().catch(() => {});
    setState("idle");
  }, []);

  const play = useCallback((data: ArrayBuffer) => {
    const audio = context.current;
    if (!audio || data.byteLength <= 5) return;
    const view = new DataView(data);
    const track = view.getUint8(0) === 1 ? 1 : 0;
    const rate = view.getUint32(1);
    const samples = (data.byteLength - 5) >> 1;
    if (rate < 8000 || rate > 96000 || samples === 0) return;

    const buffer = audio.createBuffer(1, samples, rate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < samples; i++) channel[i] = view.getInt16(5 + i * 2, true) / 32768;

    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(audio.destination);
    const now = audio.currentTime;
    let start = Math.max(playAt.current[track], now + HEAD_START_SECONDS);
    if (start - now > MAX_LAG_SECONDS) start = now + HEAD_START_SECONDS;
    source.start(start);
    playAt.current[track] = start + buffer.duration;
  }, []);

  const start = useCallback(async () => {
    setError("");
    setState("connecting");
    // Created now, inside the click that started this, so the browser lets it play.
    const audio = new AudioContext();
    context.current = audio;
    playAt.current = [0, 0];
    void audio.resume();
    try {
      const { url, token } = await voiceRealtimeApi.listenToken(callId);
      const ws = new WebSocket(`${url}?token=${encodeURIComponent(token)}`);
      ws.binaryType = "arraybuffer";
      ws.onopen = () => setState("listening");
      ws.onmessage = (event) => { if (event.data instanceof ArrayBuffer) play(event.data); };
      ws.onerror = () => setError("Could not connect to the call's audio. It may have just ended.");
      ws.onclose = () => { if (socket.current === ws) stop(); };
      socket.current = ws;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not start listening.");
      stop();
    }
  }, [callId, play, stop]);

  // Leaving the page must not leave a socket and an audio device open.
  useEffect(() => stop, [stop]);

  return { state, error, start, stop };
}
