"use client";

import { useCallback, useState } from "react";
import { agentApi, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/utils/date";
import { Badge, Button, Modal, Skeleton, Switch } from "@/components/ui";
import styles from "./ConnectionDetailCard.module.scss";

interface ConnectionDetailCardProps {
  /** Primary identity line: phone number for WhatsApp, @username for Instagram. */
  identity: string;
  /** Secondary label under the identity, e.g. a verified business name. */
  subtitle?: string;
  /** Extra health facts to render as badges, e.g. "Webhook configured". */
  healthBadges?: { label: string; ok: boolean }[];
  connectedAt?: string;
  agentId?: string;
  onDisconnect: () => Promise<void>;
  disconnectLabel?: string;
  disconnectConfirmation?: string;
}

export function ConnectionDetailCard({
  identity,
  subtitle,
  healthBadges = [],
  connectedAt,
  agentId,
  onDisconnect,
  disconnectLabel = "Disconnect",
  disconnectConfirmation,
}: ConnectionDetailCardProps) {
  const { show } = useToast();
  const { user } = useAuth();
  const [isTogglingAgent, setIsTogglingAgent] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isConfirmingDisconnect, setIsConfirmingDisconnect] = useState(false);

  const {
    data: agent,
    isLoading: isAgentLoading,
    refresh: refreshAgent,
  } = useAsync(() => (agentId ? agentApi.get(agentId) : Promise.resolve(null)), [agentId]);

  const isAgentRunning = agent?.status === "running";

  const handleToggleAgent = useCallback(
    async (checked: boolean) => {
      if (!agentId) return;
      setIsTogglingAgent(true);
      try {
        await agentApi.setStatus(agentId, checked ? "running" : "paused");
        show(checked ? "Agent resumed." : "Agent paused, it will stop auto-replying on this channel.", "default");
        refreshAgent();
      } catch (err) {
        const message = err instanceof ApiError ? err.userMessage : "Couldn't update agent status.";
        show(message, "error");
      } finally {
        setIsTogglingAgent(false);
      }
    },
    [agentId, refreshAgent, show]
  );

  const handleDisconnect = useCallback(async () => {
    setIsDisconnecting(true);
    try {
      await onDisconnect();
      setIsConfirmingDisconnect(false);
    } catch {
      // The channel panel owns the user-facing error toast. Keep this modal
      // open so the user can retry without losing the context.
    } finally {
      setIsDisconnecting(false);
    }
  }, [onDisconnect]);

  return (
    <div className={styles.card}>
      <div className={styles.identityRow}>
        <div>
          <div className={styles.identity}>{identity}</div>
          {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
          {connectedAt && (
            <div className={styles.connectedAt}>Connected {formatDate(connectedAt, user?.timezone)}</div>
          )}
        </div>
        <Badge variant="success">Connected</Badge>
      </div>

      {healthBadges.length > 0 && (
        <div className={styles.healthRow}>
          {healthBadges.map((h) => (
            <Badge key={h.label} variant={h.ok ? "success" : "warning"}>
              {h.label}: {h.ok ? "OK" : "Not configured"}
            </Badge>
          ))}
        </div>
      )}

      {agentId && (
        <div className={styles.agentRow}>
          {isAgentLoading ? (
            <Skeleton height={24} width="60%" />
          ) : (
            <>
              <div>
                <div className={styles.agentLabel}>AI agent</div>
                <div className={styles.agentName}>{agent?.name ?? "Linked agent"}</div>
              </div>
              <div className={styles.agentToggle}>
                <span className={styles.agentStatusLabel}>{isAgentRunning ? "Running" : "Paused"}</span>
                <Switch checked={isAgentRunning} onChange={handleToggleAgent} disabled={isTogglingAgent} />
              </div>
            </>
          )}
        </div>
      )}

      <div className={styles.actions}>
        <Button
          variant="outline-danger"
          onClick={() => disconnectConfirmation ? setIsConfirmingDisconnect(true) : void handleDisconnect()}
          isLoading={isDisconnecting}
        >
          {disconnectLabel}
        </Button>
      </div>

      <Modal
        isOpen={isConfirmingDisconnect}
        onClose={() => !isDisconnecting && setIsConfirmingDisconnect(false)}
        title="Disconnect Instagram?"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setIsConfirmingDisconnect(false)}
              disabled={isDisconnecting}
            >
              Keep connected
            </Button>
            <Button variant="danger" onClick={() => void handleDisconnect()} isLoading={isDisconnecting}>
              Disconnect permanently
            </Button>
          </>
        }
      >
        <div className={styles.disconnectWarning}>
          <span className={styles.disconnectWarningIcon} aria-hidden="true">!</span>
          <div>
            <strong>This cannot be undone.</strong>
            <p>{disconnectConfirmation}</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
