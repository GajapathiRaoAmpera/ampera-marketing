"use client";

import { useCallback, useState } from "react";
import { instagramApi, ApiError } from "@/lib/api";
import { useFacebookSdk } from "@/lib/hooks/useFacebookSdk";
import { useToast } from "@/context/ToastContext";
import { Button, EmptyState } from "@/components/ui";
import styles from "./InstagramConnectPanel.module.scss";

interface InstagramConnectPanelProps {
  /** Business's AI agent, auto-linked to the Instagram connection once onboarding completes. */
  agentId?: string;
  businessId?: string;
  /** Called after a successful connect so the shared status hook re-fetches. */
  onConnected: () => void;
}

/**
 * The secondary "Connect via Facebook Page" fallback, revealed on demand
 * from the direct-login panel. Renders only the connect action; the
 * connected-account view lives at the page level.
 */
export function InstagramConnectPanel({ agentId, businessId, onConnected }: InstagramConnectPanelProps) {
  const { show } = useToast();
  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
  const { isReady: isSdkReady } = useFacebookSdk(appId);
  const [isConnecting, setIsConnecting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const configId = process.env.NEXT_PUBLIC_INSTAGRAM_CONFIG_ID;

  const handleConnect = useCallback(() => {
    setDuplicateWarning(null);
    if (!appId || !configId) {
      show("Instagram connect isn't configured on this deployment.", "error");
      return;
    }
    if (!isSdkReady || !window.FB) {
      show("Meta's signup SDK is still loading. Try again in a moment.", "error");
      return;
    }

    setIsConnecting(true);
    // Must be a plain (non-async) callback. The SDK rejects async functions.
    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;
        if (response.status !== "connected" || !code) {
          setIsConnecting(false);
          return; // user closed the popup or declined, no error toast needed
        }

        instagramApi
          .completeOnboarding(code, agentId, businessId)
          .then(() => {
            setDuplicateWarning(null);
            show("Instagram connected successfully.", "success");
            onConnected();
          })
          .catch((err) => {
            const message =
              err instanceof ApiError ? err.userMessage : "Couldn't complete Instagram connect. Please try again.";
            if (err instanceof ApiError && err.status === 409) setDuplicateWarning(message);
            show(message, "error");
          })
          .finally(() => setIsConnecting(false));
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
      }
    );
  }, [agentId, appId, businessId, configId, isSdkReady, onConnected, show]);

  return (
    <>
      {duplicateWarning && (
        <div className={styles.warning} role="alert">
          <span className={styles.warningIcon} aria-hidden="true">!</span>
          <span>{duplicateWarning}</span>
        </div>
      )}
      <EmptyState
        title="Connect your Instagram Business account"
        description="Reply to DMs automatically and turn comment keywords into DM conversations, once your Instagram Business account is connected."
        action={
          <Button onClick={handleConnect} isLoading={isConnecting} disabled={!isSdkReady}>
            Connect with Meta
          </Button>
        }
      />
    </>
  );
}
