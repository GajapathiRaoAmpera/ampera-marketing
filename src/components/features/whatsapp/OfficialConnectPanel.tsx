"use client";

import { useCallback, useState } from "react";
import { whatsappApi, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { useFacebookSdk } from "@/lib/hooks/useFacebookSdk";
import { useToast } from "@/context/ToastContext";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { ManualConnectForm } from "./ManualConnectForm";
import { ConnectionDetailCard } from "@/components/features/channels/ConnectionDetailCard";
import styles from "./ConnectPanel.module.scss";

interface OfficialConnectPanelProps {
  /** Business's AI agent, auto-linked to the WhatsApp connection once signup completes. */
  agentId?: string;
  /** WhatsApp Embedded Signup Login Config ID (server-provided, not a NEXT_PUBLIC_ var). */
  whatsappConfigId?: string;
  /** Shown on a connected number: refresh its login instead of adding another number. */
  reconnectMode?: boolean;
  /** Called after a connect, reconnect or disconnect, so the page can update. */
  onChanged?: () => void;
}

export function OfficialConnectPanel({ agentId, whatsappConfigId, reconnectMode, onChanged }: OfficialConnectPanelProps) {
  const { show } = useToast();
  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
  const { isReady: isSdkReady } = useFacebookSdk(appId);
  const [isConnecting, setIsConnecting] = useState(false);
  const { data: connections, isLoading, error, refresh } = useAsync(
    () => whatsappApi.official.listConnections(),
    []
  );
  const configId = whatsappConfigId;

  const handleConnect = useCallback(() => {
    if (!appId || !configId) {
      show("WhatsApp embedded signup isn't configured on this deployment.", "error");
      return;
    }
    if (!isSdkReady || !window.FB) {
      show("Meta's signup SDK is still loading. Try again in a moment.", "error");
      return;
    }

    setIsConnecting(true);
    // FB.login's SDK internally rejects an async callback ("Expression is of
    // type asyncfunction, not function"). It must be a plain synchronous
    // function. Fire the async completion work from inside it instead.
    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;
        if (response.status !== "connected" || !code) {
          setIsConnecting(false);
          show("Meta login didn't finish, so nothing changed. Try again and complete every step in the popup.", "warning");
          return;
        }

        whatsappApi.official
          .completeOnboarding(code, agentId)
          .then(() => {
            show(reconnectMode ? "WhatsApp reconnected." : "WhatsApp connected successfully.", "success");
            refresh();
            onChanged?.();
          })
          .catch((err) => {
            const message = err instanceof ApiError ? err.userMessage : "Couldn't complete WhatsApp signup. Please try again.";
            show(message, "error");
          })
          .finally(() => setIsConnecting(false));
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          featureType: "whatsapp_business_app_onboarding",
          sessionInfoVersion: "3",
          version: "v3",
          setup: {},
        },
      }
    );
  }, [agentId, appId, configId, isSdkReady, onChanged, reconnectMode, refresh, show]);

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

  if (!connections || connections.length === 0) {
    return (
      <EmptyState
        title="Connect via Meta's official WhatsApp API"
        description="Best for businesses that want the official WhatsApp Business Platform: higher throughput, message templates, and Meta-verified status."
        action={
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)" }}>
            <Button onClick={handleConnect} isLoading={isConnecting} disabled={!isSdkReady}>
              Connect with Meta
            </Button>
            <ManualConnectForm
              agentId={agentId}
              onConnected={() => {
                refresh();
                onChanged?.();
              }}
            />
          </div>
        }
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {connections.map((c) => (
        <ConnectionDetailCard
          key={c.id}
          identity={c.phone_number}
          subtitle={c.business_name ?? c.verified_name ?? c.display_name}
          healthBadges={[{ label: "Webhook", ok: !!c.webhook_configured }]}
          connectedAt={c.connected_at}
          agentId={reconnectMode ? undefined : c.agent_id ?? agentId}
          disconnectLabel="Disconnect number"
          onDisconnect={async () => {
            if (!c.whatsapp_business_account_id) return;
            try {
              await whatsappApi.official.disconnect(c.whatsapp_business_account_id);
              show("WhatsApp number disconnected.", "default");
              refresh();
              onChanged?.();
            } catch (err) {
              const message = err instanceof ApiError ? err.userMessage : "Couldn't disconnect. Please try again.";
              show(message, "error");
            }
          }}
        />
      ))}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)" }}>
        <Button variant={reconnectMode ? "primary" : "secondary"} onClick={handleConnect} isLoading={isConnecting} disabled={!isSdkReady}>
          {reconnectMode ? "Reconnect with Meta" : "Connect another number"}
        </Button>
        {reconnectMode ? (
          connections.map((c) =>
            c.whatsapp_business_account_id && c.phone_number_id ? (
              <ManualConnectForm
                key={c.id}
                agentId={c.agent_id ?? agentId}
                known={{ wabaId: String(c.whatsapp_business_account_id), phoneNumberId: String(c.phone_number_id) }}
                onConnected={() => {
                  refresh();
                  onChanged?.();
                }}
              />
            ) : null
          )
        ) : (
          <ManualConnectForm agentId={agentId} onConnected={refresh} />
        )}
      </div>
    </div>
  );
}
