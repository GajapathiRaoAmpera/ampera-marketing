"use client";

import { useState } from "react";
import { ApiError, telegramApi } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/context/ToastContext";
import { Button, Input } from "@/components/ui";
import { TelegramIcon } from "@/components/layout/icons";
import { ConnectionDetailCard } from "@/components/features/channels/ConnectionDetailCard";
import { ChannelAnalyticsTab, ChannelChatSetup, ChannelContacts, ChannelGrow } from "@/components/features/channels/ChannelHubTabs";
import { ChannelGate } from "@/components/features/channels/workspace/ChannelGate";
import { Block, ChannelWorkspace, type WorkspacePill } from "@/components/features/channels/workspace/ChannelWorkspace";
import styles from "@/components/features/messenger/Messenger.module.scss";

function TelegramChannel({ agentId }: { agentId?: string }) {
  const { show } = useToast();
  const { data: status, isLoading, refresh } = useAsync(() => telegramApi.status(), []);
  const [token, setToken] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

  const fail = (err: unknown, fallback: string) => show(err instanceof ApiError ? err.userMessage : fallback, "error");

  async function connect() {
    setIsConnecting(true);
    try {
      const result = await telegramApi.connect(token.trim());
      // A bot with no assistant behind it stays silent, so link this business's assistant straight away.
      if (agentId) await telegramApi.linkAgent(agentId);
      setToken("");
      show(`@${result.bot_username} is connected.`, "success");
      refresh();
    } catch (err) {
      fail(err, "Couldn't connect the bot. Check the token and try again.");
    } finally {
      setIsConnecting(false);
    }
  }

  async function linkAgent() {
    if (!agentId) return;
    setIsLinking(true);
    try {
      await telegramApi.linkAgent(agentId);
      show("This business's assistant now answers on Telegram.", "success");
      refresh();
    } catch (err) {
      fail(err, "Couldn't link the assistant.");
    } finally {
      setIsLinking(false);
    }
  }

  async function disconnect() {
    try {
      await telegramApi.disconnect();
      show("Telegram bot disconnected.", "default");
      refresh();
    } catch (err) {
      fail(err, "Couldn't disconnect. Please try again.");
      throw err;
    }
  }

  const health = status?.health;
  const unhealthy = Boolean(health && health.status !== "healthy");
  const linkedElsewhere = !!agentId && status?.agent_id !== agentId;
  const noAssistant = !status?.agent_id || linkedElsewhere;

  const pills: WorkspacePill[] = [
    { label: unhealthy ? "Problem receiving messages" : "Receiving messages", tone: unhealthy ? "warn" : "on", title: health?.last_error ?? undefined },
    { label: noAssistant ? "No assistant linked" : "Assistant answering", tone: noAssistant ? "warn" : "on", goTo: "home" },
  ];

  return (
    <ChannelWorkspace
      color="#229ED9"
      icon={<TelegramIcon size={34} />}
      name="Telegram"
      identity={status?.bot_username ? `@${status.bot_username}` : "Telegram"}
      subtitle={status?.bot_link ?? undefined}
      pills={pills}
      connected={isLoading ? null : Boolean(status?.connected)}
      alert={
        unhealthy ? <span>{health?.last_error ?? "Telegram reported a problem delivering messages to this app."}</span> : undefined
      }
      legacyTabs={{ connection: "home" }}
      landing={{
        headline: "Answer every Telegram message with your AI assistant.",
        text: "Create a free bot in a minute, paste its token here, and your assistant starts replying in private chats and groups.",
        steps: [
          { title: "Create the bot", text: "Chat with @BotFather on Telegram and send /newbot. Pick a name and a username." },
          { title: "Copy the token", text: "BotFather replies with a long token. That is the bot's password: keep it private." },
          { title: "Paste it below", text: "We check it with Telegram and start listening for messages right away." },
        ],
        panel: (
          <div className={styles.row}>
            <Input label="Bot token" type="password" autoComplete="off" placeholder="123456789:AAH…" value={token} onChange={(e) => setToken(e.target.value)} />
            <Button onClick={connect} isLoading={isConnecting} disabled={!token.trim()}>
              Connect bot
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
                    {status?.agent_id ? "This bot is answering with a different business's assistant." : "No assistant is linked, so the bot won't reply yet."}{" "}
                    <button type="button" className={styles.linkButton} onClick={linkAgent} disabled={isLinking || !agentId}>
                      {isLinking ? "Linking…" : "Use this business's assistant"}
                    </button>
                  </p>
                </div>
              )}
              <Block title="Try it" hint="Open your bot, tap Start and ask a question. It answers from your knowledge base.">
                {status?.bot_link && (
                  <div>
                    <a href={status.bot_link} target="_blank" rel="noreferrer">
                      <Button variant="secondary">Open @{status.bot_username} in Telegram</Button>
                    </a>
                  </div>
                )}
                <p className={styles.hint}>To use it in a group, add the bot to the group. It replies when mentioned, unless you change that under Chat setup.</p>
              </Block>
              <ConnectionDetailCard
                identity={`@${status?.bot_username ?? "your bot"}`}
                subtitle={status?.bot_link ?? undefined}
                healthBadges={[{ label: "Receiving messages", ok: health?.status !== "disconnected" }]}
                connectedAt={status?.connected_at ?? undefined}
                agentId={status?.agent_id ?? undefined}
                onDisconnect={disconnect}
                disconnectConfirmation="The bot will stop replying on Telegram. Your contacts and chat setup are kept."
              />
            </>
          ),
        },
        {
          value: "setup",
          label: "Chat setup",
          icon: "gear",
          minRole: "manager",
          intro: "How the bot greets people and what it does in groups: the welcome message, buttons and commands like /start and /help.",
          render: () => <ChannelChatSetup channel="telegram" />,
        },
        {
          value: "contacts",
          label: "Contacts",
          icon: "team",
          intro: "Everyone who has messaged the bot. Open a person to see the chat, add a tag, or pause the AI for them.",
          render: () => <ChannelContacts channel="telegram" />,
        },
        {
          value: "grow",
          label: "Grow",
          icon: "share",
          minRole: "manager",
          intro: "Get more people talking to the bot: share a link or QR code, and see which one brought each person.",
          render: () => <ChannelGrow channel="telegram" />,
        },
        {
          value: "analytics",
          label: "Analytics",
          icon: "chart",
          intro: "How many people wrote in, how many messages the AI answered, and how fast.",
          render: () => <ChannelAnalyticsTab channel="telegram" />,
        },
      ]}
    />
  );
}

export default function TelegramChannelPage() {
  return <ChannelGate channel="Telegram">{(_businessId, agentId) => <TelegramChannel agentId={agentId} />}</ChannelGate>;
}
