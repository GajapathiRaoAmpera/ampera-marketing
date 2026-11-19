"use client";

import clsx from "clsx";
import { useAuth } from "@/context/AuthContext";
import { formatTime } from "@/lib/utils/date";
import type { Message } from "@/types/api";
import styles from "../../../app/(dashboard)/inbox/page.module.scss";

// Per-message feedback (👍/👎) is intentionally not offered here. The
// backend's message log has no message id to attach feedback to.
export function MessageBubble({ message }: { message: Message }) {
  const { user } = useAuth();
  const isIncoming = message.role === "user";
  const isHuman = message.role === "human_agent";
  const mediaType = message.metadata?.media_type;
  const mediaUrl = message.metadata?.media_url;
  const deliveryStatus = message.metadata?.delivery_status;
  // Transcription failures leave metadata.transcript unset while content
  // still carries the raw text (see backend fallback), content covers both
  // cases, metadata.transcript is only for messages logged before it existed.
  const transcript = mediaType === "audio" ? (message.metadata?.transcript || message.content) : undefined;
  const isPending = Boolean(message.metadata?._pending);

  return (
    <div
      className={clsx(
        styles.messageRow,
        isIncoming ? styles.messageRowIncoming : styles.messageRowOutgoing,
        isPending && styles.messageRowPending
      )}
    >
      <div
        className={clsx(
          styles.bubble,
          isIncoming ? styles.bubbleIncoming : isHuman ? styles.bubbleHuman : styles.bubbleOutgoing
        )}
      >
        {mediaUrl && mediaType === "image" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.messageImage} src={mediaUrl} alt={message.content || "WhatsApp image"} />
        )}
        {mediaUrl && mediaType === "video" && <video className={styles.messageMedia} src={mediaUrl} controls preload="metadata" />}
        {mediaUrl && mediaType === "audio" && (
          <>
            <div className={styles.voiceNoteLabel}>🎤 Voice message</div>
            <audio className={styles.messageAudio} src={mediaUrl} controls preload="metadata" />
            {transcript && transcript !== "[audio received]" ? (
              <div className={styles.transcript}>
                <span className={styles.transcriptLabel}>Transcript</span>
                <span>{transcript}</span>
              </div>
            ) : (
              <div className={styles.transcriptUnavailable}>Transcript unavailable</div>
            )}
          </>
        )}
        {mediaUrl && mediaType === "document" && (
          <a className={styles.documentLink} href={mediaUrl} target="_blank" rel="noreferrer">
            {message.metadata?.filename || "Open document"}
          </a>
        )}
        {mediaType !== "audio" && (!mediaUrl || (message.content && message.content !== `[${mediaType}]`)) && <span>{message.content}</span>}
      </div>
      <div className={styles.messageMeta}>
        <span>{isPending ? "Sending…" : message.created_at ? formatTime(message.created_at, user?.timezone) : ""}</span>
        {isHuman && !isPending && <span>· Human agent</span>}
        {isHuman && !isPending && deliveryStatus && <span>· {deliveryStatus}</span>}
      </div>
    </div>
  );
}
