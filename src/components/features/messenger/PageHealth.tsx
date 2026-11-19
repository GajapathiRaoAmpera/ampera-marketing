"use client";

import { useState } from "react";
import { messengerPageApi, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/context/ToastContext";
import styles from "./Messenger.module.scss";

/** Stays silent while a Page is healthy; otherwise says what's wrong and offers the fix. */
export function PageHealth({ pageId }: { pageId: string }) {
  const { show } = useToast();
  const { data: health, refresh } = useAsync(() => messengerPageApi.health(pageId), [pageId]);
  const [isFixing, setIsFixing] = useState(false);

  if (!health || health.status === "healthy") return null;

  async function fix() {
    setIsFixing(true);
    try {
      await messengerPageApi.resubscribe(pageId);
      show("Connection repaired.", "success");
      refresh();
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't repair the connection.", "error");
    } finally {
      setIsFixing(false);
    }
  }

  return (
    <div className={styles.notice} role="alert">
      {!health.token_valid ? (
        <p>Facebook no longer accepts this Page&apos;s connection. Disconnect it and connect again.</p>
      ) : !health.agent_linked ? (
        <p>No AI agent is linked to this Page, so messages won&apos;t be answered.</p>
      ) : (
        <p>
          This Page isn&apos;t receiving every Messenger event.{" "}
          <button type="button" className={styles.linkButton} onClick={fix} disabled={isFixing}>
            {isFixing ? "Repairing…" : "Repair connection"}
          </button>
        </p>
      )}
    </div>
  );
}
