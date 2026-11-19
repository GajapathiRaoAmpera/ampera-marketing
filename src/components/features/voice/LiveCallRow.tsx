"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import type { LiveCall } from "@/lib/api";
import { voiceRealtimeApi } from "@/lib/api/voice-realtime";
import { useLiveListen } from "@/lib/hooks/useLiveListen";
import { useToast } from "@/context/ToastContext";
import styles from "./VoiceCenter.module.scss";

interface Props {
  call: LiveCall;
  onEnd: (call: LiveCall) => void;
  onChanged: () => void;
}

/** One call in progress: what is being said, whether the caller is upset, and what you can do about it. */
export function LiveCallRow({ call, onEnd, onChanged }: Props) {
  const { show } = useToast();
  const { state, error, start, stop } = useLiveListen(call.id);
  const [taking, setTaking] = useState(false);
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const alert = call.live_alert;

  async function takeOver() {
    setBusy(true);
    try {
      const result = await voiceRealtimeApi.takeover(call.id, number.trim() || undefined);
      stop();
      setTaking(false);
      show(`Calling ${result.number} now. Answer it to take over the call (press 1 if asked).`, "default");
      onChanged();
    } catch (failure) {
      show(failure instanceof Error ? failure.message : "Couldn't hand over that call. It may have just ended.", "error");
    } finally { setBusy(false); }
  }

  return (
    <div className={styles.listRow}>
      <span className={styles.livePulse} aria-hidden />
      <div className={styles.listMain}>
        <div className={styles.listTitle}>
          {call.name || call.number} · {call.direction === "inbound" ? "incoming" : "outgoing"} · {call.status}
          {alert && (
            <Badge variant={alert.level === "urgent" ? "danger" : "warning"} style={{ marginLeft: "var(--space-2)" }}>
              {alert.level === "urgent" ? "Needs you" : "Upset"}
            </Badge>
          )}
          {call.experiment && <Badge variant="neutral" style={{ marginLeft: "var(--space-2)" }}>Test {call.experiment.variant.toUpperCase()}</Badge>}
        </div>
        {alert && <div className={styles.muted}>{alert.reason}</div>}
        {call.last_line && (
          <div className={styles.muted}>{call.last_speaker === "caller" ? "Caller" : "Agent"}: {call.last_line}</div>
        )}
        {error && <div className={styles.muted} role="alert">{error}</div>}
        {taking && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
            <input
              type="tel"
              aria-label="Number to ring"
              placeholder="Your number, e.g. +919876543210 (blank = team number)"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              style={{ flex: 1, minWidth: 220, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-background)", color: "inherit" }}
            />
            <Button size="sm" isLoading={busy} onClick={takeOver}>Ring me</Button>
            <Button size="sm" variant="ghost" onClick={() => setTaking(false)}>Cancel</Button>
          </div>
        )}
      </div>
      {call.listenable && (
        state === "idle"
          ? <Button size="sm" variant="secondary" onClick={start}>Listen</Button>
          : <Button size="sm" variant="secondary" onClick={stop}>{state === "connecting" ? "Connecting…" : "Stop listening"}</Button>
      )}
      {!call.transferred && <Button size="sm" variant="secondary" onClick={() => setTaking(true)} disabled={taking}>Take over</Button>}
      <Link href={`/channels/voice/calls/${call.id}`}>Follow transcript</Link>
      <Button size="sm" variant="outline-danger" onClick={() => onEnd(call)}>End call</Button>
    </div>
  );
}
