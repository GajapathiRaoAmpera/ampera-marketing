"use client";

import { useEffect, useState } from "react";

export interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Milliseconds left, never below zero. */
  totalMs: number;
  expired: boolean;
}

export function timeLeft(endsAt: string | null | undefined, now: number): TimeLeft | null {
  if (!endsAt) return null;
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(end)) return null;
  const totalMs = Math.max(end - now, 0);
  const totalSeconds = Math.floor(totalMs / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalMs,
    expired: end <= now,
  };
}

/** "12d 4h 32m", or "04:12:09" in the last day, so the last hours visibly tick. */
export function formatTimeLeft(left: TimeLeft): string {
  if (left.expired) return "Ended";
  if (left.days > 0) return `${left.days}d ${left.hours}h ${left.minutes}m`;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(left.hours)}:${pad(left.minutes)}:${pad(left.seconds)}`;
}

/**
 * Time left until `endsAt` (an ISO time), recomputed from the clock so it never
 * drifts. Ticks every second in the last day and once a minute before that.
 */
export function useCountdown(endsAt: string | null | undefined): TimeLeft | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endsAt) return;
    const end = new Date(endsAt).getTime();
    if (Number.isNaN(end)) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (end <= current) return; // nothing left to count
      timer = setTimeout(tick, end - current <= 86_400_000 ? 1000 : 60_000);
    };
    tick();
    return () => clearTimeout(timer);
  }, [endsAt]);

  return timeLeft(endsAt, now);
}
