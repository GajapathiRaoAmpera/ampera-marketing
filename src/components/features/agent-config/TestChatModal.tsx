"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { agentApi } from "@/lib/api";
import type { AgentConfigOverride } from "@/lib/api/agent";
import { Button, Input, Modal, Switch } from "@/components/ui";
import styles from "./TestChatModal.module.scss";

interface ChatTurn {
  role: "user" | "agent";
  content: string;
  isHuman?: boolean;
}

export function TestChatModal({
  isOpen,
  onClose,
  agentId,
  configOverride,
}: {
  isOpen: boolean;
  onClose: () => void;
  agentId: string | null;
  configOverride: AgentConfigOverride;
}) {
  const [sessionId] = useState(() =>
    `draft-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`
  );
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => () => {
    if (agentId) void agentApi.clearTestHistory(agentId, sessionId).catch(() => undefined);
  }, [agentId, sessionId]);
  const [isPaused, setIsPaused] = useState(false);

  async function handleSend() {
    if (!input.trim() || !agentId) return;
    const message = input.trim();
    setInput("");
    setIsSending(true);

    if (isPaused) {
      // Human takeover, append directly as the agent's reply, no LLM call.
      setTurns((t) => [...t, { role: "agent", content: message, isHuman: true }]);
      try {
        await agentApi.sendManualReply(agentId, message, sessionId);
      } catch {
        // Best-effort persistence. The turn already shows in the UI either way.
      } finally {
        setIsSending(false);
      }
      return;
    }

    setTurns((t) => [...t, { role: "user", content: message }]);
    try {
      const result = await agentApi.testChat(agentId, message, sessionId, configOverride);
      setTurns((t) => [...t, { role: "agent", content: result.reply }]);
    } catch {
      setTurns((t) => [...t, { role: "agent", content: "Sorry, something went wrong testing this message." }]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Test your AI agent"
      size="lg"
    >
      <div className={styles.chatBody}>
        <div className={styles.controlRow}>
          <Switch checked={isPaused} onChange={setIsPaused} label="Take over as a human agent" />
        </div>

        {isPaused && (
          <div className={styles.disclaimer}>
            You&apos;re now typing as a human agent, the AI is paused. Messages you send below are added directly
            to this test conversation and won&apos;t call the AI, just like pausing a real live channel.
          </div>
        )}

        <div className={styles.messages}>
          {turns.length === 0 && (
            <p style={{ color: "var(--color-text-tertiary)", fontSize: "var(--font-size-sm)" }}>
              Send a message as if you were a customer, this uses your current unsaved draft and won&apos;t be
              visible to real customers.
            </p>
          )}
          {turns.map((turn, i) => (
            <div key={i} className={clsx(styles.bubbleRow, turn.role === "user" ? styles.bubbleRowUser : styles.bubbleRowAgent)}>
              <div
                className={clsx(
                  styles.bubble,
                  turn.role === "user" ? styles.bubbleUser : styles.bubbleAgent,
                  turn.isHuman && styles.bubbleHuman
                )}
              >
                {turn.isHuman && <div className={styles.humanLabel}>You (as agent)</div>}
                {turn.content}
              </div>
            </div>
          ))}
        </div>
        <div className={styles.inputRow}>
          <Input
            placeholder={isPaused ? "Type your reply as the human agent…" : "Type a test message…"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            disabled={!agentId}
          />
          <Button onClick={handleSend} isLoading={isSending} disabled={!input.trim() || !agentId}>
            Send
          </Button>
        </div>
      </div>
    </Modal>
  );
}
