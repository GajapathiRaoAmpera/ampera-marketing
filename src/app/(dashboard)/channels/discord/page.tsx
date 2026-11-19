"use client";

import { useState } from "react";
import { ApiError, discordApi, type DiscordConnection, type DiscordLookup } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/context/ToastContext";
import { Button, Input, Select, Skeleton } from "@/components/ui";
import { DiscordIcon } from "@/components/layout/icons";
import frameStyles from "@/components/features/channels/ChannelFrame.module.scss";
import { ConnectionDetailCard } from "@/components/features/channels/ConnectionDetailCard";
import { ChannelAnalyticsTab, ChannelChatSetup, ChannelContacts } from "@/components/features/channels/ChannelHubTabs";
import { ChannelGate } from "@/components/features/channels/workspace/ChannelGate";
import { Block, ChannelWorkspace, type WorkspacePill } from "@/components/features/channels/workspace/ChannelWorkspace";
import styles from "@/components/features/messenger/Messenger.module.scss";

function useFail() {
  const { show } = useToast();
  return (err: unknown, fallback: string) => show(err instanceof ApiError ? err.userMessage : fallback, "error");
}

/** Tick boxes for a server's text channels. Nothing ticked means the bot listens everywhere it can see. */
function ChannelPicker({
  channels,
  selected,
  onChange,
}: {
  channels: Array<{ id: string; name: string }>;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  if (!channels.length) {
    return <p className={styles.hint}>We couldn&apos;t read this server&apos;s channels. The bot will listen in every channel it can see.</p>;
  }
  return (
    <>
      <div className={frameStyles.checkList}>
        {channels.map((channel) => (
          <label key={channel.id}>
            <input
              type="checkbox"
              checked={selected.includes(channel.id)}
              onChange={(e) => onChange(e.target.checked ? [...selected, channel.id] : selected.filter((id) => id !== channel.id))}
            />
            #{channel.name}
          </label>
        ))}
      </div>
      <p className={styles.hint}>
        {selected.length ? `Listening in ${selected.length} channel${selected.length === 1 ? "" : "s"}.` : "None ticked: the bot listens in every channel it can see."}
      </p>
    </>
  );
}

function ConnectDiscord({ agentId, onConnected }: { agentId?: string; onConnected: () => void }) {
  const { show } = useToast();
  const fail = useFail();
  const [token, setToken] = useState("");
  const [bot, setBot] = useState<DiscordLookup | null>(null);
  const [serverId, setServerId] = useState("");
  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const server = bot?.servers.find((item) => item.id === serverId) ?? bot?.servers[0];

  async function check() {
    setIsChecking(true);
    try {
      const result = await discordApi.lookup(token.trim());
      setBot(result);
      setServerId(result.servers[0]?.id ?? "");
      setChannelIds([]);
    } catch (err) {
      fail(err, "Discord didn't accept that token.");
    } finally {
      setIsChecking(false);
    }
  }

  async function connect() {
    if (!agentId || !server) return;
    setIsConnecting(true);
    try {
      const result = await discordApi.connect({ agent_id: agentId, bot_token: token.trim(), guild_id: server.id, channel_ids: channelIds });
      show(
        result.warnings.length ? `Connected, but: ${result.warnings[0]}` : `${result.bot_name} is live in ${result.guild_name}.`,
        result.warnings.length ? "warning" : "success"
      );
      onConnected();
    } catch (err) {
      fail(err, "Couldn't connect the bot.");
    } finally {
      setIsConnecting(false);
    }
  }

  return (
    <>
      <Block title="Connect it" hint="Paste the bot token, pick the server and the channels it should answer in.">
        <div className={styles.row}>
          <Input
            label="Bot token"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              setBot(null);
            }}
          />
          <Button variant={bot ? "secondary" : "primary"} onClick={check} isLoading={isChecking} disabled={!token.trim()}>
            {bot ? "Check again" : "Check token"}
          </Button>
        </div>

        {bot && !bot.servers.length && (
          <div className={styles.notice}>
            <p>
              <strong>{bot.bot_name}</strong> isn&apos;t in any server yet.{" "}
              <a href={bot.invite_url} target="_blank" rel="noreferrer">Add it to your server</a>, then press “Check again”.
            </p>
          </div>
        )}

        {bot && server && (
          <>
            <Select label="Server" value={server.id} onChange={(e) => { setServerId(e.target.value); setChannelIds([]); }}>
              {bot.servers.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </Select>
            <p className={styles.hint}>Which channels should {bot.bot_name} answer in?</p>
            <ChannelPicker channels={server.channels} selected={channelIds} onChange={setChannelIds} />
            <div className={frameStyles.footerRow}>
              <Button onClick={connect} isLoading={isConnecting} disabled={!agentId}>Connect {bot.bot_name}</Button>
              <a href={bot.invite_url} target="_blank" rel="noreferrer">
                <Button variant="ghost">Add to another server</Button>
              </a>
            </div>
          </>
        )}
      </Block>
    </>
  );
}

function ConnectionTab({ connection, onChanged }: { connection: DiscordConnection; onChanged: () => void }) {
  const { show } = useToast();
  const fail = useFail();
  const { data, isLoading } = useAsync(() => discordApi.channels(connection.id), [connection.id]);
  // null until the person changes a tick box; until then the saved selection is shown.
  const [draft, setDraft] = useState<string[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const selected = draft ?? data?.selected ?? connection.channel_ids;

  async function retry() {
    setIsRetrying(true);
    try {
      await discordApi.retry(connection.id);
      show("Reconnecting. Check back in a minute.", "default");
      // The bot reports its state a few seconds after it tries to log in.
      window.setTimeout(onChanged, 8000);
    } catch (err) {
      fail(err, "Couldn't reconnect the bot.");
    } finally {
      setIsRetrying(false);
    }
  }

  async function save() {
    setIsSaving(true);
    try {
      await discordApi.update(connection.id, { channel_ids: selected });
      setDraft(null);
      show("Channels updated.", "success");
      onChanged();
    } catch (err) {
      fail(err, "Couldn't update the channels.");
    } finally {
      setIsSaving(false);
    }
  }

  async function disconnect() {
    try {
      await discordApi.disconnect(connection.id);
      show("Discord bot disconnected.", "default");
      onChanged();
    } catch (err) {
      fail(err, "Couldn't disconnect. Please try again.");
      throw err;
    }
  }

  return (
    <>
      {connection.gateway_error && (
        <div className={styles.notice} role="alert">
          <p>
            <strong>The bot is offline.</strong> {connection.gateway_error}{" "}
            <button type="button" className={styles.linkButton} onClick={retry} disabled={isRetrying}>
              {isRetrying ? "Reconnecting…" : "I've fixed it, try again"}
            </button>
          </p>
        </div>
      )}
      {connection.gateway_warning && (
        <div className={styles.notice} role="alert">
          <p>{connection.gateway_warning}</p>
        </div>
      )}
      <ConnectionDetailCard
        identity={connection.bot_name}
        subtitle={`In ${connection.guild_name}`}
        connectedAt={connection.connected_at ?? undefined}
        agentId={connection.agent_id}
        onDisconnect={disconnect}
        disconnectConfirmation="The bot will go offline in this server. Reconnecting later starts with a fresh chat setup."
      />
      <Block title="Channels" hint="Where the bot listens. It replies when mentioned unless you change that under Chat setup.">
        {isLoading ? <Skeleton height={80} /> : <ChannelPicker channels={data?.channels ?? []} selected={selected} onChange={setDraft} />}
        {draft && (
          <div>
            <Button onClick={save} isLoading={isSaving}>Save channels</Button>
          </div>
        )}
      </Block>
      <Block title="How people use it">
        <p className={styles.hint}>
          Mention the bot in a channel, send it a direct message, or use the slash commands /ask, /products and /human. It can take up to a minute after connecting for the bot to show as online.
        </p>
      </Block>
    </>
  );
}

function DiscordChannel({ agentId }: { agentId?: string }) {
  const { data: connections, isLoading, refresh } = useAsync(() => discordApi.connections(), []);
  const [selectedId, setSelectedId] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const active = (connections ?? []).filter((item) => item.active);
  const connection = active.find((item) => item.id === selectedId) ?? active[0];
  const showConnect = !connection || isAdding;

  const pills: WorkspacePill[] = connection
    ? [
        { label: connection.gateway_error ? "Bot offline" : "Bot online", tone: connection.gateway_error ? "warn" : "on", title: connection.gateway_error ?? undefined, goTo: "home" },
        ...(active.length > 1 ? [{ label: `${active.length} servers`, tone: "on" as const }] : []),
      ]
    : [];

  return (
    <ChannelWorkspace
      color="#5865F2"
      icon={<DiscordIcon size={34} />}
      name="Discord"
      identity={connection?.bot_name ?? "Discord"}
      subtitle={connection ? `In ${connection.guild_name}` : undefined}
      pills={pills}
      connected={isLoading ? null : !showConnect}
      legacyTabs={{ connection: "home" }}
      landing={{
        headline: "Put your AI assistant in your Discord server.",
        text: "Members can mention it, message it, or use slash commands, and it answers from your knowledge base.",
        steps: [
          { title: "Create the bot", text: "In Discord's Developer Portal choose New Application. It is free." },
          { title: "Turn on Message Content Intent", text: "On the Bot tab, switch it on, or the bot can't read what people write. Then press Reset Token and copy the token." },
          { title: "Paste the token below", text: "Check it, pick the server and the channels it should answer in, and connect." },
        ],
        panel: (
          <>
            {isAdding && (
              <div>
                <Button variant="ghost" onClick={() => setIsAdding(false)}>← Back</Button>
              </div>
            )}
            <ConnectDiscord
              agentId={agentId}
              onConnected={() => {
                setIsAdding(false);
                refresh();
              }}
            />
          </>
        ),
      }}
      tabs={
        connection
          ? [
              {
                value: "home",
                label: "Home",
                icon: "overview",
                render: () => (
                  <div key={connection.id} className={styles.body}>
                    <Block
                      title="Servers"
                      hint="Each server the bot is in has its own channels and chat setup."
                      right={<Button variant="secondary" size="sm" onClick={() => setIsAdding(true)}>Add a server</Button>}
                    >
                      {active.length > 1 && (
                        <Select aria-label="Server" value={connection.id} onChange={(e) => setSelectedId(e.target.value)}>
                          {active.map((item) => (
                            <option key={item.id} value={item.id}>{item.guild_name}</option>
                          ))}
                        </Select>
                      )}
                    </Block>
                    <ConnectionTab connection={connection} onChanged={refresh} />
                  </div>
                ),
              },
              { value: "setup", label: "Chat setup", icon: "gear", minRole: "manager", intro: "When the bot replies (every message or only when mentioned), its greeting and tone, for this server.", render: () => <div key={connection.id}><ChannelChatSetup channel="discord" connectionId={connection.id} /></div> },
              { value: "contacts", label: "Members", icon: "team", intro: "Members who have talked to the bot in this server.", render: () => <div key={connection.id}><ChannelContacts channel="discord" connectionId={connection.id} /></div> },
              { value: "analytics", label: "Analytics", icon: "chart", intro: "Questions asked and answered in this server.", render: () => <div key={connection.id}><ChannelAnalyticsTab channel="discord" connectionId={connection.id} /></div> },
            ]
          : []
      }
    />
  );
}

export default function DiscordChannelPage() {
  return <ChannelGate channel="Discord">{(_businessId, agentId) => <DiscordChannel agentId={agentId} />}</ChannelGate>;
}
