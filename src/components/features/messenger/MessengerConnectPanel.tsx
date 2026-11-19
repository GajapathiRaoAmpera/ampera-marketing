"use client";

import { useCallback, useState } from "react";
import { messengerApi, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/context/ToastContext";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { ConnectionDetailCard } from "@/components/features/channels/ConnectionDetailCard";
import { ManualMessengerConnectForm } from "./ManualMessengerConnectForm";
import { PageHealth } from "./PageHealth";
import styles from "../whatsapp/ConnectPanel.module.scss";

interface MessengerConnectPanelProps {
  agentId?: string;
  /** Called after a Page is connected or disconnected, for a parent showing the same list. */
  onChanged?: () => void;
}

export function MessengerConnectPanel({ agentId, onChanged }: MessengerConnectPanelProps) {
  const { show } = useToast();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const { data: connections, isLoading, error, refresh } = useAsync(
    () => messengerApi.listConnections(),
    []
  );

  const activeConnections = (connections ?? []).filter((c) => c.active);

  const handleConnect = useCallback(async () => {
    setIsRedirecting(true);
    try {
      const { url } = await messengerApi.connect();
      window.location.href = url;
    } catch (err) {
      const message = err instanceof ApiError ? err.userMessage : "Couldn't start Messenger connect. Please try again.";
      show(message, "error");
      setIsRedirecting(false);
    }
  }, [show]);

  if (isLoading) {
    return (
      <div className={styles.panel}>
        <Skeleton height={120} width="100%" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.panel}>
        <p className={styles.helperText}>{error}</p>
      </div>
    );
  }

  if (activeConnections.length === 0) {
    return (
      <EmptyState
        title="Connect a Facebook Page"
        description="Reply to Messenger conversations automatically once a Page is connected."
        action={
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)" }}>
            <Button onClick={handleConnect} isLoading={isRedirecting}>
              Connect with Facebook
            </Button>
            <ManualMessengerConnectForm agentId={agentId} onConnected={refresh} />
          </div>
        }
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {activeConnections.map((c) => (
        <div key={c.id} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <PageHealth pageId={c.page_id} />
        <ConnectionDetailCard
          identity={c.page_name}
          subtitle={c.page_category}
          healthBadges={[{ label: "Webhook", ok: !!c.webhook_subscribed }]}
          connectedAt={c.connected_at ?? undefined}
          agentId={c.agent_id ?? agentId}
          disconnectLabel="Disconnect Page"
          onDisconnect={async () => {
            try {
              await messengerApi.disconnect(c.page_id);
              show("Facebook Page disconnected.", "default");
              refresh();
              onChanged?.();
            } catch (err) {
              const message = err instanceof ApiError ? err.userMessage : "Couldn't disconnect. Please try again.";
              show(message, "error");
            }
          }}
        />
        </div>
      ))}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)" }}>
        <Button variant="secondary" onClick={handleConnect} isLoading={isRedirecting}>
          Connect another Page
        </Button>
        <ManualMessengerConnectForm agentId={agentId} onConnected={refresh} />
      </div>
    </div>
  );
}
