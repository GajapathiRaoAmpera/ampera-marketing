"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Card, EmptyState, Input, Select, Skeleton, Textarea } from "@/components/ui";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import {
  DISPOSITION_LABELS, dispositionLabel, dispositionTone, formatDuration, voiceCallsApi, voiceCenterApi,
  type CallSession,
} from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { QuickCall } from "@/components/features/voice/QuickCall";
import { ConfirmDialog } from "@/components/features/voice/ConfirmDialog";
import styles from "./page.module.scss";

const LIVE = ["queued", "initiated", "ringing", "in-progress"];

export default function VoiceCallDetailPage() {
  const { business, isLoading: isBusinessLoading } = useActiveBusiness();
  const params = useParams<{ callId: string }>();
  const { show } = useToast();
  const [call, setCall] = useState<CallSession | null>(null);
  const [loadedId, setLoadedId] = useState("");
  const [notes, setNotes] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [isCallingBack, setIsCallingBack] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const settled = useRef(false);

  const load = useCallback(() => voiceCallsApi.getCall(params.callId), [params.callId]);

  useEffect(() => {
    if (!business?.agent_id) return;
    let canceled = false;
    const refresh = () => load()
      .then((value) => { if (!canceled) setCall(value); })
      .catch(() => { if (!canceled) setCall(null); })
      .finally(() => { if (!canceled) setLoadedId(params.callId); });
    void refresh();
    // Refreshes while the call is live or being reviewed, then stops.
    const timer = setInterval(() => { if (!settled.current) void refresh(); }, 5000);
    return () => { canceled = true; clearInterval(timer); };
  }, [business?.agent_id, params.callId, load]);

  useEffect(() => {
    settled.current = Boolean(call && !LIVE.includes(call.status) && !["pending", "processing"].includes(call.analysis_status ?? ""));
  }, [call]);

  if (isBusinessLoading || (business?.agent_id && loadedId !== params.callId)) return <Skeleton height={320} />;
  if (!call) {
    return <EmptyState title="Call not found" description="This call may have been removed or belongs to a different account." />;
  }

  const number = call.direction === "inbound" ? call.from_number : call.to_number;
  const name = call.contact_name || call.caller_name || "";
  const isPhoneCall = call.direction !== "preview";
  const isLive = LIVE.includes(call.status);
  const tags = call.tags ?? [];

  async function review(patch: Parameters<typeof voiceCenterApi.reviewCall>[1], message?: string) {
    try {
      await voiceCenterApi.reviewCall(params.callId, patch);
      setCall((current) => current && { ...current, ...patch });
      if (message) show(message, "success");
    } catch {
      show("Couldn't save that change.", "error");
    }
  }

  async function blockNumber() {
    try {
      await voiceCenterApi.addDnc([number], { reason: "Added from call history" });
      show("Added to your do-not-call list.", "success");
    } catch {
      show("Couldn't add that number.", "error");
    }
  }

  async function endCall() {
    try {
      await voiceCenterApi.hangup(params.callId);
      show("Call ended.", "default");
      settled.current = false;
    } catch {
      show("Couldn't end the call. It may have just finished.", "error");
    }
  }

  function addTag() {
    const tag = tagDraft.trim();
    if (!tag || tags.includes(tag)) return;
    setTagDraft("");
    void review({ tags: [...tags, tag] });
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <Link href="/channels/voice/calls" className={styles.backLink}>
            ← Call history
          </Link>
          <div className={styles.title}>{name || number}</div>
          <div className={styles.meta}>
            {name ? <span>{number}</span> : null}
            <span>{call.direction === "inbound" ? "Incoming" : call.direction === "outbound" ? "Outgoing" : "Browser test"}</span>
            <span>{new Date(call.started_at).toLocaleString()}</span>
            {call.metrics?.duration_seconds ? <span>{formatDuration(call.metrics.duration_seconds)}</span> : null}
            {(call.attempt ?? 1) > 1 ? <span>Attempt {call.attempt}</span> : null}
          </div>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
          {call.disposition
            ? <Badge variant={dispositionTone(call.disposition)}>{dispositionLabel(call.disposition)}</Badge>
            : <Badge variant={isLive ? "info" : "neutral"}>{call.status}</Badge>}
          {isPhoneCall && (
            <>
              <Button size="sm" variant="secondary" onClick={() => review({ starred: !call.starred })}>
                {call.starred ? "★ Starred" : "☆ Star"}
              </Button>
              {isLive
                ? <Button size="sm" variant="outline-danger" onClick={endCall}>End call</Button>
                : <Button size="sm" onClick={() => setIsCallingBack(true)}>Call back</Button>}
              <Button size="sm" variant="ghost" onClick={() => setIsBlocking(true)}>Don&apos;t call again</Button>
            </>
          )}
        </div>
      </div>

      {(call.after_hours || call.returning_caller || call.transferred || call.transfer_failed || call.voicemail_left
        || call.callback_scheduled || call.retry_at || call.opted_out || call.human_requested) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
          {call.after_hours && <Badge variant="info">Came in after hours</Badge>}
          {call.returning_caller && <Badge variant="neutral">Returning caller</Badge>}
          {call.transferred && <Badge variant="info">Transferred to your team</Badge>}
          {call.transfer_failed && <Badge variant="warning">Transfer went unanswered, message taken</Badge>}
          {call.human_requested && !call.transferred && !call.transfer_failed && <Badge variant="warning">Asked for a person</Badge>}
          {call.voicemail_left && <Badge variant="neutral">Voicemail left</Badge>}
          {call.callback_scheduled && <Badge variant="success">Callback scheduled automatically</Badge>}
          {call.retry_at && <Badge variant="neutral">Retry at {new Date(call.retry_at).toLocaleString()}</Badge>}
          {call.opted_out && <Badge variant="danger">Added to do-not-call list</Badge>}
        </div>
      )}

      {call.call_context && (
        <Card style={{ marginBottom: "var(--space-5)" }}>
          <h2>Purpose of this call</h2>
          <p style={{ marginTop: "var(--space-2)" }}>{call.call_context}</p>
        </Card>
      )}

      {call.summary ? (
        <Card style={{ marginBottom: "var(--space-5)" }}>
          <h2>Summary</h2>
          <p style={{ marginTop: "var(--space-2)" }}>{call.summary.outcome}</p>
          <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)", flexWrap: "wrap" }}>
            <Badge variant={call.summary.sentiment === "positive" ? "success" : call.summary.sentiment === "negative" ? "danger" : "neutral"}>
              {call.summary.sentiment} mood
            </Badge>
            {call.resolved !== undefined && (
              <Badge variant={call.resolved ? "success" : "warning"}>{call.resolved ? "Handled by the agent" : "Needs your team"}</Badge>
            )}
            {call.lead_label && <Badge variant={call.lead_label === "hot" ? "danger" : "neutral"}>{call.lead_label} lead</Badge>}
          </div>
          {call.summary.key_points.length > 0 && (
            <>
              <h3 style={{ marginTop: "var(--space-4)", fontSize: "var(--font-size-sm)" }}>Key points</h3>
              <ul style={{ marginTop: "var(--space-2)" }}>
                {call.summary.key_points.map((point, i) => <li key={i}>{point}</li>)}
              </ul>
            </>
          )}
          {call.summary.next_steps.length > 0 && (
            <>
              <h3 style={{ marginTop: "var(--space-4)", fontSize: "var(--font-size-sm)" }}>Next steps</h3>
              <ul style={{ marginTop: "var(--space-2)" }}>
                {call.summary.next_steps.map((step, i) => <li key={i}>{step}</li>)}
              </ul>
            </>
          )}
        </Card>
      ) : call.analysis_status === "pending" || call.analysis_status === "processing" ? (
        <Card style={{ marginBottom: "var(--space-5)" }}>
          <h2>Summary</h2>
          <p style={{ marginTop: "var(--space-2)", color: "var(--color-text-secondary)" }}>Reviewing the call. The summary appears here in a few seconds.</p>
        </Card>
      ) : null}

      {(typeof call.qa_score === "number" || (call.unanswered_questions?.length ?? 0) > 0) && (
        <Card style={{ marginBottom: "var(--space-5)" }}>
          <h2>How the agent did</h2>
          {typeof call.qa_score === "number" && (
            <p style={{ marginTop: "var(--space-2)" }}>
              <strong style={{ fontSize: "var(--font-size-xl)" }}>{call.qa_score}</strong> / 100
              {call.metrics?.agent_talk_ratio !== null && call.metrics?.agent_talk_ratio !== undefined
                ? ` · the agent did ${Math.round(call.metrics.agent_talk_ratio * 100)}% of the talking`
                : ""}
            </p>
          )}
          {(call.qa_notes?.length ?? 0) > 0 && (
            <ul style={{ marginTop: "var(--space-2)" }}>
              {call.qa_notes!.map((note, i) => <li key={i}>{note}</li>)}
            </ul>
          )}
          {(call.unanswered_questions?.length ?? 0) > 0 && (
            <>
              <h3 style={{ marginTop: "var(--space-4)", fontSize: "var(--font-size-sm)" }}>Questions it couldn&apos;t answer</h3>
              <ul style={{ marginTop: "var(--space-2)" }}>
                {call.unanswered_questions!.map((question, i) => <li key={i}>{question}</li>)}
              </ul>
              <Link href="/knowledge-base">Add the answers to your knowledge base →</Link>
            </>
          )}
        </Card>
      )}

      {call.extracted_data && Object.keys(call.extracted_data).length > 0 && (
        <Card style={{ marginBottom: "var(--space-5)" }}>
          <h2>Details captured</h2>
          <dl style={{ marginTop: "var(--space-3)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" }}>
            {Object.entries(call.extracted_data).map(([key, value]) => (
              <div key={key}>
                <dt style={{ color: "var(--color-text-tertiary)", fontSize: "var(--font-size-xs)" }}>{key.replace(/_/g, " ")}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      {isPhoneCall && !isLive && (
        <Card style={{ marginBottom: "var(--space-5)" }}>
          <h2>Your notes</h2>
          <div style={{ display: "grid", gap: "var(--space-4)", marginTop: "var(--space-3)" }}>
            <div style={{ maxWidth: 280 }}>
              <Select
                label="Outcome (correct it if the agent got it wrong)"
                value={call.disposition ?? ""}
                onChange={(e) => e.target.value && review({ disposition: e.target.value }, "Outcome updated.")}
              >
                <option value="" disabled>Not set</option>
                {Object.entries(DISPOSITION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </Select>
            </div>
            <div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
                {tags.map((tag) => (
                  <Badge key={tag} variant="brand">
                    {tag}{" "}
                    <button
                      aria-label={`Remove tag ${tag}`}
                      style={{ background: "none", border: 0, cursor: "pointer", color: "inherit", padding: 0 }}
                      onClick={() => review({ tags: tags.filter((item) => item !== tag) })}
                    >×</button>
                  </Badge>
                ))}
              </div>
              <form style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-end", maxWidth: 360 }} onSubmit={(e) => { e.preventDefault(); addTag(); }}>
                <Input label="Tags" value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} placeholder="vip, refund, follow up" maxLength={30} />
                <Button type="submit" variant="secondary" disabled={!tagDraft.trim() || tags.length >= 10}>Add</Button>
              </form>
            </div>
            <Textarea
              label="Notes"
              value={notes ?? call.notes ?? ""}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything your team should know about this call"
              maxLength={4000}
            />
            {notes !== null && notes !== (call.notes ?? "") && (
              <div><Button onClick={() => review({ notes }, "Notes saved.")}>Save notes</Button></div>
            )}
          </div>
        </Card>
      )}

      {call.recording_url && (
        <Card style={{ marginBottom: "var(--space-5)" }}>
          <h2>Recording</h2>
          <audio controls src={`/api/backend/channels/voice/calls/${encodeURIComponent(call.call_sid)}/recording`} style={{ width: "100%", marginTop: "var(--space-3)" }} />
          {call.recording_duration_seconds ? (
            <p style={{ color: "var(--color-text-tertiary)", fontSize: "var(--font-size-xs)", marginTop: "var(--space-2)" }}>
              {formatDuration(call.recording_duration_seconds)}
            </p>
          ) : null}
        </Card>
      )}

      <Card>
        <h2>Transcript</h2>
        {call.turn_history.length === 0 ? (
          <EmptyState title="No transcript" description={isLive ? "The conversation will appear here as it happens." : "Nobody spoke on this call."} />
        ) : (
          <div className={styles.transcript}>
            {call.turn_history.map((turn, index) => (
              <div key={index} className={`${styles.turn} ${turn.role === "caller" ? styles.turnCaller : styles.turnAgent}`}>
                <span>{turn.text}</span>
                <span className={styles.turnMeta}>{turn.role === "caller" ? "Caller" : "Agent"} · {new Date(turn.at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog
        isOpen={isBlocking}
        title={`Stop calling ${number}?`}
        confirmLabel="Add to do-not-call list"
        danger
        onConfirm={blockNumber}
        onClose={() => setIsBlocking(false)}
      >
        Your agent will never dial this number again, and any calls queued for it are canceled. You can undo this from the Do not call tab.
      </ConfirmDialog>

      {isCallingBack && (
        <QuickCall
          isOpen
          onClose={() => setIsCallingBack(false)}
          number={number}
          name={name}
          context={call.summary?.outcome ? `Following up on an earlier call. What happened then: ${call.summary.outcome}` : ""}
        />
      )}
    </div>
  );
}
