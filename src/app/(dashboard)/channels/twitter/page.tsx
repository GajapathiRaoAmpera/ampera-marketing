"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, twitterApi } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/context/ToastContext";
import { Button, EmptyState } from "@/components/ui";
import { XIcon } from "@/components/layout/icons";
import { ConnectionDetailCard } from "@/components/features/channels/ConnectionDetailCard";
import { ChannelAnalyticsTab, ChannelChatSetup, ChannelContacts } from "@/components/features/channels/ChannelHubTabs";
import { ChannelGate } from "@/components/features/channels/workspace/ChannelGate";
import { Block, ChannelWorkspace, type WorkspacePill } from "@/components/features/channels/workspace/ChannelWorkspace";
import styles from "@/components/features/messenger/Messenger.module.scss";

function TwitterChannel({ agentId }: { agentId?: string }) {
  const { show } = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const returned = params.get("status");
  const { data: status, isLoading, refresh } = useAsync(() => twitterApi.status(), []);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

  const fail = (err: unknown, fallback: string) => show(err instanceof ApiError ? err.userMessage : fallback, "error");

  // X sends the browser back here with ?status=success|error after sign-in.
  useEffect(() => {
    if (!returned) return;
    show(returned === "success" ? "Your X account is connected." : "X sign-in didn't complete. Please try again.", returned === "success" ? "success" : "error");
    // An account with no assistant behind it stays silent, so link this business's assistant straight away.
    if (returned === "success" && agentId) twitterApi.linkAgent(agentId).then(refresh).catch(() => {});
    router.replace("/channels/twitter");
  }, [returned, router, show, agentId, refresh]);

  async function connect() {
    setIsConnecting(true);
    try {
      window.location.href = await twitterApi.connect();
    } catch (err) {
      fail(err, "Couldn't start X sign-in.");
      setIsConnecting(false);
    }
  }

  async function linkAgent() {
    if (!agentId) return;
    setIsLinking(true);
    try {
      await twitterApi.linkAgent(agentId);
      show("This business's assistant now answers your X direct messages.", "success");
      refresh();
    } catch (err) {
      fail(err, "Couldn't link the assistant.");
    } finally {
      setIsLinking(false);
    }
  }

  async function disconnect() {
    try {
      await twitterApi.disconnect();
      show("X account disconnected.", "default");
      refresh();
    } catch (err) {
      fail(err, "Couldn't disconnect. Please try again.");
      throw err;
    }
  }

  const linkedElsewhere = !!agentId && status?.agent_id !== agentId;
  const noAssistant = !status?.agent_id || linkedElsewhere;
  const minutes = Math.max(1, Math.round((status?.check_every_seconds ?? 120) / 60));
  const unavailable = !status?.configured && !status?.connected;

  const pills: WorkspacePill[] = [
    { label: status?.problem ? "Problem reading messages" : "Reading direct messages", tone: status?.problem ? "warn" : "on", title: status?.problem ?? undefined },
    { label: noAssistant ? "No assistant linked" : "Assistant answering", tone: noAssistant ? "warn" : "on", goTo: "home" },
  ];

  return (
    <ChannelWorkspace
      color="#0f1419"
      icon={<XIcon size={30} />}
      name="X (Twitter)"
      identity={status?.twitter_username ? `@${status.twitter_username}` : "X (Twitter)"}
      subtitle="X direct messages"
      pills={pills}
      connected={isLoading ? null : Boolean(status?.connected)}
      alert={status?.problem ? <span>{status.problem}</span> : undefined}
      legacyTabs={{ connection: "home" }}
      landing={{
        headline: "Answer your X direct messages automatically.",
        text: "Sign in with the X account your customers message. Your assistant reads new direct messages and replies for you.",
        steps: [
          { title: "Check your X plan", text: "X charges for direct-message access. The developer app behind this workspace needs a paid X API plan; the free plan refuses to read or send DMs." },
          { title: "Sign in with X", text: "You'll be asked to allow reading and sending direct messages." },
          { title: "Replies arrive shortly", text: "New messages are checked every couple of minutes, so answers are quick but not instant." },
        ],
        panel: unavailable ? (
          <EmptyState
            title="X isn't available on this workspace yet"
            description="Connecting X needs an X developer app set up by your administrator. Ask them to add the X app credentials to the server."
          />
        ) : (
          <div>
            <Button onClick={connect} isLoading={isConnecting}>
              Sign in with X
            </Button>
          </div>
        ),
      }}
      tabs={[
        {
          value: "home",
          label: "Home",
          icon: "overview",
          render: () => (
            <>
              {noAssistant && (
                <div className={styles.notice} role="alert">
                  <p>
                    {status?.agent_id ? "This account is answering with a different business's assistant." : "No assistant is linked, so direct messages won't be answered yet."}{" "}
                    <button type="button" className={styles.linkButton} onClick={linkAgent} disabled={isLinking || !agentId}>
                      {isLinking ? "Linking…" : "Use this business's assistant"}
                    </button>
                  </p>
                </div>
              )}
              <Block title="How it works">
                <p className={styles.hint}>
                  New direct messages are checked about every {minutes} minute{minutes === 1 ? "" : "s"}
                  {status?.last_checked_at ? `, last at ${new Date(status.last_checked_at).toLocaleTimeString()}` : ""}. Messages sent before you connected are not answered. To reply yourself, pause the AI on the conversation in your inbox.
                </p>
              </Block>
              <ConnectionDetailCard
                identity={`@${status?.twitter_username ?? "your account"}`}
                subtitle="X direct messages"
                healthBadges={[{ label: "Reading direct messages", ok: !status?.problem }]}
                connectedAt={status?.connected_at ?? undefined}
                agentId={status?.agent_id ?? undefined}
                onDisconnect={disconnect}
                disconnectConfirmation="Direct messages will stop being answered. Your contacts and chat setup are kept."
              />
            </>
          ),
        },
        { value: "setup", label: "Chat setup", icon: "gear", minRole: "manager", intro: "How the assistant answers direct messages: its greeting and tone.", render: () => <ChannelChatSetup channel="twitter" /> },
        { value: "contacts", label: "Contacts", icon: "team", intro: "People who have sent you a direct message.", render: () => <ChannelContacts channel="twitter" /> },
        { value: "analytics", label: "Analytics", icon: "chart", intro: "Direct messages received and answered.", render: () => <ChannelAnalyticsTab channel="twitter" /> },
      ]}
    />
  );
}

export default function TwitterChannelPage() {
  return <ChannelGate channel="X">{(_businessId, agentId) => <TwitterChannel agentId={agentId} />}</ChannelGate>;
}
