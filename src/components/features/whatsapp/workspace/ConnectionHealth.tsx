"use client";

import { useEffect, useState } from "react";
import { ApiError, agentApi } from "@/lib/api";
import { whatsappStudioApi, type WhatsAppConnectionHealth } from "@/lib/api/whatsapp-studio";
import { useToast } from "@/context/ToastContext";
import { Button, InfoLabel, Select, Skeleton } from "@/components/ui";
import { formatDateTime } from "@/lib/utils/date";
import styles from "../../instagram/workspace/workspace.module.scss";

/** Which agent answers this number, whether messages can get through, and the fix if not. */
export function ConnectionHealth({ businessId, onChanged }: { businessId: string; onChanged: () => void }) {
  const { show } = useToast();
  const [health, setHealth] = useState<WhatsAppConnectionHealth | null>(null);
  const [failed, setFailed] = useState(false);
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    whatsappStudioApi
      .connectionHealth(businessId)
      .then((result) => !cancelled && setHealth(result))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [businessId, reload]);

  async function act(work: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await work();
      show(done, "success");
      setReload((value) => value + 1);
      onChanged();
    } catch (error) {
      show(error instanceof ApiError ? error.userMessage : "That didn't work. Please try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (failed) return <p className={styles.muted}>The connection check couldn&apos;t be loaded.</p>;
  if (!health) return <Skeleton height={80} />;
  if (!health.connection) return null;

  const linked = health.linked_agent;
  const wabaId = health.connection.waba_id;
  const selected = choice || linked?.id || "";

  return (
    <>
      {health.problems.map((problem) => (
        <div key={problem.code} className={`${styles.notice} ${styles.noticeWarn}`} role="alert">
          {problem.message}
        </div>
      ))}

      <div className={styles.settingRow}>
        <div>
          <strong>{linked ? `Answered by “${linked.name}”` : "No agent linked"}</strong>
          <p>
            {linked
              ? linked.status === "running"
                ? "Running. Incoming messages are received. Whether the AI replies is set by the AI agent switch below."
                : `Status: ${linked.status}. Resume it so messages get through.`
              : "Every number needs one agent to receive its messages, even if the AI switch stays off."}
          </p>
        </div>
        {linked && linked.status !== "running" && (
          <Button size="sm" isLoading={busy} onClick={() => void act(() => agentApi.setStatus(linked.id, "running"), "Agent resumed. Messages will get through now.")}>
            Resume
          </Button>
        )}
      </div>

      <div className={styles.checks}>
        <Select
          label={<InfoLabel help="The agent that receives this number's messages. A number can only use one agent at a time.">Agent for this number</InfoLabel>}
          value={selected}
          onChange={(event) => setChoice(event.target.value)}
        >
          {!selected && <option value="">Choose an agent</option>}
          {health.agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name} ({agent.status})
            </option>
          ))}
        </Select>
      </div>
      {health.agents.length === 0 && <p className={styles.muted}>You have no agents yet. Create one under AI Agent first.</p>}
      {wabaId && selected && selected !== linked?.id && (
        <div className={styles.rowActions}>
          <Button isLoading={busy} onClick={() => void act(() => whatsappStudioApi.linkAgent(wabaId, selected), "Agent linked. Messages will get through now.")}>
            Use this agent
          </Button>
        </div>
      )}

      {health.last_issue && (
        <details className={styles.details}>
          <summary>Last problem: {formatDateTime(health.last_issue.at)}</summary>
          <p>{health.last_issue.message}</p>
        </details>
      )}
    </>
  );
}
