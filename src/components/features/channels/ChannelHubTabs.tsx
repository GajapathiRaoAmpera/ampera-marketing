"use client";

import { useEffect, useMemo, useState } from "react";
import { copyText } from "@/lib/utils/browser";
import {
  ApiError,
  channelHubApi,
  type ChannelCommand,
  type ChannelContact,
  type ChannelKeywordFlow,
  type ChannelMenuAction,
  type ChannelQr,
  type ChannelSettings,
  type HubChannel,
} from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/context/ToastContext";
import { Badge, Button, EmptyState, Input, Modal, Select, Skeleton, Switch, Tabs, Textarea } from "@/components/ui";
import { Section } from "@/components/features/messenger/MessengerShell";
import styles from "@/components/features/messenger/Messenger.module.scss";

interface HubProps {
  channel: HubChannel;
  /** Discord only: which server connection these settings belong to. */
  connectionId?: string;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** What each channel can actually do, so the setup screen only shows options that work there. */
const FEATURES: Record<
  HubChannel,
  {
    name: string;
    welcomeHint: string;
    menu: boolean;
    commands: boolean;
    commandHint: string;
    groups: boolean;
    groupLabel: string;
    dms: boolean;
    media: boolean;
    collectPhone: boolean;
    signature: boolean;
    memberWelcome: boolean;
    messageLimit: number;
  }
> = {
  telegram: {
    name: "Telegram",
    welcomeHint: "Sent when someone opens your bot and taps Start.",
    menu: true,
    commands: true,
    commandHint: "Shown in the bot's menu button. /start, /help, /products, /human and /stop are built in.",
    groups: true,
    groupLabel: "In group chats",
    dms: false,
    media: true,
    collectPhone: true,
    signature: false,
    memberWelcome: false,
    messageLimit: 4096,
  },
  sms: {
    name: "SMS",
    welcomeHint: "Sent when someone texts one of your campaign keywords that has no opening message of its own.",
    menu: false,
    commands: false,
    commandHint: "",
    groups: false,
    groupLabel: "",
    dms: false,
    media: false,
    collectPhone: false,
    signature: true,
    memberWelcome: false,
    messageLimit: 1500,
  },
  discord: {
    name: "Discord",
    welcomeHint: "Sent the first time someone messages the bot directly.",
    menu: false,
    commands: true,
    commandHint: "Added as slash commands in your server. /ask, /products and /human are built in.",
    groups: true,
    groupLabel: "In server channels",
    dms: true,
    media: false,
    collectPhone: false,
    signature: false,
    memberWelcome: true,
    messageLimit: 2000,
  },
  twitter: {
    name: "X",
    welcomeHint: "Sent the first time someone sends you a direct message.",
    menu: false,
    commands: false,
    commandHint: "",
    groups: false,
    groupLabel: "",
    dms: false,
    media: false,
    collectPhone: false,
    signature: false,
    memberWelcome: false,
    messageLimit: 10000,
  },
};

const MENU_ACTIONS: Record<ChannelMenuAction, string> = {
  ask: "Ask the assistant",
  url: "Open a link",
  products: "Show products",
  human: "Talk to a person",
};

function useErrorToast() {
  const { show } = useToast();
  return (err: unknown, fallback: string) => show(err instanceof ApiError ? err.userMessage : fallback, "error");
}

// ── Chat setup ──

export function ChannelChatSetup({ channel, connectionId }: HubProps) {
  const { show } = useToast();
  const hub = useMemo(() => channelHubApi(channel, connectionId), [channel, connectionId]);
  const feature = FEATURES[channel];
  const [settings, setSettings] = useState<ChannelSettings | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [syncErrors, setSyncErrors] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    hub
      .settings()
      .then((result) => {
        if (!cancelled) setSettings(result);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [hub]);

  if (loadFailed) return <EmptyState title="Couldn't load chat setup" description="Refresh the page to try again." />;
  if (!settings) return <Skeleton height={320} />;

  const set = <K extends keyof ChannelSettings>(key: K, value: ChannelSettings[K]) =>
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  const setAway = (value: Partial<ChannelSettings["away"]>) => set("away", { ...settings.away, ...value });
  const setFlow = (index: number, value: Partial<ChannelKeywordFlow>) =>
    set("keyword_flows", settings.keyword_flows.map((flow, i) => (i === index ? { ...flow, ...value } : flow)));
  const setCommand = (index: number, value: Partial<ChannelCommand>) =>
    set("commands", settings.commands.map((item, i) => (i === index ? { ...item, ...value } : item)));

  async function save() {
    if (!settings) return;
    // Half-filled rows would be rejected by the server; drop them instead of blocking the save.
    const input: Partial<ChannelSettings> = {
      ...settings,
      menu: settings.menu.filter((item) => item.title.trim()),
      commands: settings.commands.filter((item) => item.command.trim() && item.reply.trim()),
      keyword_flows: settings.keyword_flows
        .map((flow) => ({ ...flow, keywords: flow.keywords.map((word) => word.trim()).filter(Boolean) }))
        .filter((flow) => flow.keywords.length && flow.reply.trim()),
    };
    delete input.sync_errors;
    setIsSaving(true);
    try {
      const saved = await hub.saveSettings(input);
      setSettings(saved);
      setSyncErrors(saved.sync_errors ?? []);
      show(
        saved.sync_errors?.length ? `Saved, but ${feature.name} rejected part of it.` : "Chat setup saved.",
        saved.sync_errors?.length ? "warning" : "success"
      );
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't save. Please try again.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      {syncErrors.length > 0 && (
        <div className={styles.notice} role="alert">
          {syncErrors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}

      <Section title="Welcome message" hint={feature.welcomeHint}>
        <Textarea
          aria-label="Welcome message"
          placeholder="Hi! Ask us anything about our products."
          value={settings.welcome_message}
          onChange={(e) => set("welcome_message", e.target.value)}
          maxLength={channel === "sms" ? 320 : 2000}
          showCharCount
          rows={2}
        />
        {feature.collectPhone && (
          <Switch
            checked={settings.collect_phone}
            onChange={(value) => set("collect_phone", value)}
            label="Offer a one-tap button to share their phone number"
          />
        )}
      </Section>

      {feature.memberWelcome && (
        <Section
          title="Welcome new members"
          hint="Send each person who joins your server a direct message from the bot."
          right={
            <Switch
              checked={settings.member_welcome.enabled}
              onChange={(enabled) => set("member_welcome", { ...settings.member_welcome, enabled })}
              aria-label="Welcome new members"
            />
          }
        >
          {settings.member_welcome.enabled && (
            <>
              <Textarea
                aria-label="Message to new members"
                value={settings.member_welcome.message}
                onChange={(e) => set("member_welcome", { ...settings.member_welcome, message: e.target.value })}
                maxLength={1500}
                showCharCount
                rows={3}
                helperText="{name} becomes their name and {server} your server's name."
              />
              <p className={styles.hint}>
                Needs “Server Members Intent” switched on for the bot in the Discord Developer Portal (Bot tab). The bot reconnects when you save.
              </p>
            </>
          )}
        </Section>
      )}

      {feature.menu && (
        <Section title="Buttons" hint="Shown under the welcome message. People tap instead of typing.">
          {settings.menu.map((item, index) => (
            <div key={index} className={styles.itemCard}>
              <div className={styles.row}>
                <Input
                  label="Button text"
                  placeholder="e.g. See prices"
                  value={item.title}
                  maxLength={40}
                  onChange={(e) => set("menu", settings.menu.map((m, i) => (i === index ? { ...m, title: e.target.value } : m)))}
                />
                <Select
                  label="When tapped"
                  value={item.action}
                  onChange={(e) =>
                    set("menu", settings.menu.map((m, i) => (i === index ? { ...m, action: e.target.value as ChannelMenuAction } : m)))
                  }
                >
                  {(Object.keys(MENU_ACTIONS) as ChannelMenuAction[]).map((action) => (
                    <option key={action} value={action}>{MENU_ACTIONS[action]}</option>
                  ))}
                </Select>
                <button type="button" className={styles.iconButton} aria-label="Remove button" onClick={() => set("menu", settings.menu.filter((_, i) => i !== index))}>✕</button>
              </div>
              {(item.action === "ask" || item.action === "url") && (
                <Input
                  label={item.action === "url" ? "Link" : "Question to ask (optional)"}
                  placeholder={item.action === "url" ? "https://…" : "Defaults to the button text"}
                  value={item.value}
                  maxLength={500}
                  onChange={(e) => set("menu", settings.menu.map((m, i) => (i === index ? { ...m, value: e.target.value } : m)))}
                />
              )}
            </div>
          ))}
          {settings.menu.length < 10 && (
            <div>
              <Button size="sm" variant="secondary" onClick={() => set("menu", [...settings.menu, { title: "", action: "ask", value: "" }])}>
                Add a button
              </Button>
            </div>
          )}
        </Section>
      )}

      {feature.commands && (
        <Section title="Your own commands" hint={feature.commandHint}>
          {settings.commands.map((item, index) => (
            <div key={index} className={styles.itemCard}>
              <div className={styles.row}>
                <Input
                  label="Command"
                  placeholder="hours"
                  value={item.command}
                  maxLength={32}
                  onChange={(e) => setCommand(index, { command: e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase() })}
                  helperText="Letters, numbers and underscores."
                />
                <Input
                  label="Short description"
                  placeholder="Our opening hours"
                  value={item.description}
                  maxLength={100}
                  onChange={(e) => setCommand(index, { description: e.target.value })}
                />
                <button type="button" className={styles.iconButton} aria-label="Remove command" onClick={() => set("commands", settings.commands.filter((_, i) => i !== index))}>✕</button>
              </div>
              <Textarea label="Reply" value={item.reply} onChange={(e) => setCommand(index, { reply: e.target.value })} maxLength={2000} rows={2} />
            </div>
          ))}
          {settings.commands.length < 20 && (
            <div>
              <Button size="sm" variant="secondary" onClick={() => set("commands", [...settings.commands, { command: "", description: "", reply: "" }])}>
                Add a command
              </Button>
            </div>
          )}
        </Section>
      )}

      <Section title="Instant answers" hint="When a message contains one of these words, send a fixed reply instead of asking the assistant.">
        {settings.keyword_flows.map((flow, index) => (
          <div key={index} className={styles.itemCard}>
            <div className={styles.row}>
              <Input
                label="Words to match"
                placeholder="price, cost, how much"
                value={flow.keywords.join(", ")}
                onChange={(e) => setFlow(index, { keywords: e.target.value.split(",").map((word) => word.trimStart()) })}
              />
              <button type="button" className={styles.iconButton} aria-label="Remove instant answer" onClick={() => set("keyword_flows", settings.keyword_flows.filter((_, i) => i !== index))}>✕</button>
            </div>
            <Textarea label="Reply" value={flow.reply} onChange={(e) => setFlow(index, { reply: e.target.value })} maxLength={2000} rows={2} />
            <Switch checked={flow.enabled} onChange={(enabled) => setFlow(index, { enabled })} label="On" />
          </div>
        ))}
        <div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => set("keyword_flows", [...settings.keyword_flows, { keywords: [], match: "contains", reply: "", enabled: true }])}
          >
            Add an instant answer
          </Button>
        </div>
      </Section>

      <Section
        title="Away hours"
        hint="Outside these hours, send one message instead of an AI reply and mark the person as waiting for a callback."
        right={<Switch checked={settings.away.enabled} onChange={(enabled) => setAway({ enabled })} aria-label="Away hours" />}
      >
        {settings.away.enabled && (
          <>
            <div className={styles.row}>
              <Input type="time" label="Open from" value={settings.away.start} onChange={(e) => setAway({ start: e.target.value })} />
              <Input type="time" label="Until" value={settings.away.end} onChange={(e) => setAway({ end: e.target.value })} />
              <Input label="Timezone" value={settings.away.timezone} onChange={(e) => setAway({ timezone: e.target.value })} />
            </div>
            <div className={styles.dayRow}>
              {DAYS.map((day, index) => (
                <button
                  key={day}
                  type="button"
                  className={styles.chip}
                  data-active={settings.away.days.includes(index) || undefined}
                  onClick={() =>
                    setAway({ days: settings.away.days.includes(index) ? settings.away.days.filter((d) => d !== index) : [...settings.away.days, index] })
                  }
                >
                  {day}
                </button>
              ))}
            </div>
            <Textarea label="Away message" value={settings.away.message} onChange={(e) => setAway({ message: e.target.value })} maxLength={1000} rows={2} />
          </>
        )}
      </Section>

      <Section title="Behaviour" hint="When the assistant answers, and what it tells you about.">
        {feature.groups && (
          <Select label={feature.groupLabel} value={settings.group_mode} onChange={(e) => set("group_mode", e.target.value as ChannelSettings["group_mode"])}>
            <option value="mention">Reply only when the bot is mentioned</option>
            <option value="all">Reply to every message</option>
            <option value="off">Never reply</option>
          </Select>
        )}
        {feature.dms && (
          <Switch checked={settings.reply_in_dms} onChange={(value) => set("reply_in_dms", value)} label="Reply to direct messages sent to the bot" />
        )}
        {feature.media && (
          <Switch checked={settings.understand_media} onChange={(value) => set("understand_media", value)} label="Let the assistant understand photos and voice notes" />
        )}
        {feature.signature && (
          <Input
            label="Sign-off added to every text"
            placeholder="- Team Aria"
            value={settings.signature}
            maxLength={60}
            onChange={(e) => set("signature", e.target.value)}
          />
        )}
        <Switch
          checked={settings.hot_lead_alert.enabled}
          onChange={(enabled) => set("hot_lead_alert", { enabled })}
          label="Notify me when someone looks ready to buy"
        />
      </Section>

      <div>
        <Button onClick={save} isLoading={isSaving}>Save chat setup</Button>
      </div>
    </>
  );
}

// ── Contacts ──

function contactTitle(contact: ChannelContact) {
  return contact.name ?? contact.username ?? contact.phone ?? contact.user_key;
}

export function ChannelContacts({ channel, connectionId }: HubProps) {
  const { show } = useToast();
  const fail = useErrorToast();
  const hub = useMemo(() => channelHubApi(channel, connectionId), [channel, connectionId]);
  const feature = FEATURES[channel];
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const { data: contacts, isLoading, refresh } = useAsync(() => hub.contacts(query || undefined), [hub, query]);
  const [target, setTarget] = useState<ChannelContact | null>(null);
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function send() {
    if (!target) return;
    setIsSending(true);
    try {
      await hub.send(target.user_key, text.trim());
      show("Message sent.", "success");
      setTarget(null);
      setText("");
      refresh();
    } catch (err) {
      fail(err, "Couldn't send the message.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      <form
        className={styles.toolbar}
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search.trim());
        }}
      >
        <Input aria-label="Search contacts" placeholder="Search by name, username, phone or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button type="submit" variant="secondary">Search</Button>
      </form>

      {isLoading ? (
        <Skeleton height={200} />
      ) : !contacts?.length ? (
        <EmptyState
          title={query ? "No one matches that search" : "No contacts yet"}
          description={query ? "Try a different name or number." : `People appear here as soon as they message you on ${feature.name}.`}
        />
      ) : (
        <div className={styles.list}>
          {contacts.map((contact) => (
            <div key={contact.user_key} className={styles.listRow}>
              <div className={styles.rowMain}>
                <div className={styles.rowTitle}>{contactTitle(contact)}</div>
                <div className={styles.rowMeta}>
                  {contact.kind === "group" && <Badge variant="neutral">Group</Badge>}
                  {contact.username && contact.name && <span>@{contact.username.replace(/^@/, "")}</span>}
                  {contact.phone && contact.phone !== contactTitle(contact) && <span>{contact.phone}</span>}
                  {contact.email && <span>{contact.email}</span>}
                  {contact.lead_label && (
                    <Badge variant={contact.lead_label.includes("hot") ? "danger" : contact.lead_label === "warm" ? "warning" : "neutral"}>
                      {contact.lead_label.replace("_", " ")}
                    </Badge>
                  )}
                  {contact.source?.name && <span>via {contact.source.name}</span>}
                  {contact.needs_callback && <Badge variant="warning">Wants a callback</Badge>}
                  {contact.opted_out && <Badge variant="neutral">Opted out</Badge>}
                  {contact.blocked && <Badge variant="neutral">Can&apos;t be reached</Badge>}
                  <span>{contact.messages} message{contact.messages === 1 ? "" : "s"}</span>
                </div>
              </div>
              <div className={styles.rowActions}>
                <Button size="sm" variant="secondary" disabled={contact.blocked} onClick={() => setTarget(contact)}>
                  Message
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {target && (
        <Modal
          isOpen
          onClose={() => setTarget(null)}
          title={`Message ${contactTitle(target)}`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setTarget(null)}>Cancel</Button>
              <Button onClick={send} isLoading={isSending} disabled={!text.trim()}>Send</Button>
            </>
          }
        >
          <div className={styles.modalStack}>
            <Textarea
              aria-label="Message"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={feature.messageLimit}
              showCharCount
              rows={4}
            />
            <p className={styles.hint}>
              Sent from your connected {feature.name} {channel === "sms" ? "number" : channel === "twitter" ? "account" : "bot"} and added to the conversation in your inbox.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}

// ── Grow: tracked links and broadcasts ──

function Links({ channel, connectionId }: HubProps) {
  const { show } = useToast();
  const fail = useErrorToast();
  const hub = useMemo(() => channelHubApi(channel, connectionId), [channel, connectionId]);
  const isSms = channel === "sms";
  const { data: links, isLoading, refresh } = useAsync(() => hub.links(), [hub]);
  const [name, setName] = useState("");
  const [opening, setOpening] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [qr, setQr] = useState<ChannelQr | null>(null);

  async function create() {
    setIsCreating(true);
    try {
      setQr(await hub.createLink(name.trim(), opening));
      setName("");
      setOpening("");
      refresh();
    } catch (err) {
      fail(err, isSms ? "Couldn't create the keyword." : "Couldn't create the link.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <>
      <Section
        title={isSms ? "New campaign keyword" : "New link"}
        hint={
          isSms
            ? "People text this word to your number. Print it on a poster or packaging and see how many people and hot leads it brings in."
            : "Put it on a poster, your bio or packaging, and see how many people and hot leads it brings in."
        }
      >
        <div className={styles.row}>
          <Input
            label={isSms ? "Keyword" : "Where will you use it?"}
            placeholder={isSms ? "e.g. DIWALI" : "e.g. Shop counter QR"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={isSms ? 20 : 60}
            helperText={isSms ? "Letters and numbers only. It is saved in capitals." : undefined}
          />
          <Button onClick={create} isLoading={isCreating} disabled={!name.trim()}>{isSms ? "Create keyword" : "Create link"}</Button>
        </div>
        <Input
          label="Opening message (optional)"
          placeholder={isSms ? "Sent to people who text this keyword" : "Sent to people who arrive through this link"}
          value={opening}
          onChange={(e) => setOpening(e.target.value)}
          maxLength={isSms ? 320 : 1000}
        />
      </Section>

      {isLoading ? (
        <Skeleton height={120} />
      ) : !links?.length ? (
        <EmptyState
          title={isSms ? "No keywords yet" : "No links yet"}
          description="Create one above to start tracking where your chats come from."
        />
      ) : (
        <div className={styles.list}>
          {links.map((link) => (
            <div key={link.ref} className={styles.listRow}>
              <div className={styles.rowMain}>
                <div className={styles.rowTitle}>{isSms ? link.ref : link.name}</div>
                <div className={styles.rowMeta}>
                  <span>{link.opens} {isSms ? "texts" : "opens"}</span>
                  <span>{link.people} people</span>
                  <span>{link.hot_leads} hot leads</span>
                </div>
              </div>
              <div className={styles.rowActions}>
                {!isSms && (
                  <Button size="sm" variant="secondary" onClick={() => copyText(link.url).then(() => show("Link copied.", "success"))}>
                    Copy
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => hub.linkQr(link.ref).then(setQr).catch((err) => fail(err, "Couldn't load the QR code."))}>
                  QR code
                </Button>
                <Button size="sm" variant="ghost" onClick={() => hub.deleteLink(link.ref).then(refresh).catch((err) => fail(err, "Couldn't delete it."))}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {qr && (
        <Modal isOpen onClose={() => setQr(null)} title={isSms ? "Scan to text the keyword" : "Your link"}>
          <div className={styles.qr}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr.qr_data_uri} alt="QR code" />
            <code>{qr.url}</code>
            <a href={qr.qr_data_uri} download={`${channel}-qr.png`}>
              <Button variant="secondary">Download QR code</Button>
            </a>
          </div>
        </Modal>
      )}
    </>
  );
}

function Broadcasts({ channel, connectionId }: HubProps) {
  const { show } = useToast();
  const fail = useErrorToast();
  const hub = useMemo(() => channelHubApi(channel, connectionId), [channel, connectionId]);
  const feature = FEATURES[channel];
  const { data, isLoading, refresh } = useAsync(() => hub.broadcasts(), [hub]);
  const [message, setMessage] = useState("");
  const [leadLabel, setLeadLabel] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const reachable = data?.audience.reachable ?? 0;

  async function send() {
    setIsSending(true);
    try {
      await hub.sendBroadcast({ message: message.trim(), lead_label: leadLabel || undefined });
      setMessage("");
      setConfirming(false);
      show("Broadcast is going out.", "success");
      window.setTimeout(refresh, 2500);
    } catch (err) {
      fail(err, "Couldn't send the broadcast.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      <Section
        title="New broadcast"
        hint={
          data
            ? `${reachable} ${reachable === 1 ? "person" : "people"} can be reached${data.audience.unreachable ? `, ${data.audience.unreachable} opted out or blocked you` : ""}.`
            : "Send one message to everyone who has written to you."
        }
      >
        <Textarea label="Message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={feature.messageLimit} showCharCount rows={3} />
        <div className={styles.row}>
          <Select label="Send to" value={leadLabel} onChange={(e) => setLeadLabel(e.target.value)}>
            <option value="">Everyone reachable</option>
            <option value="hot">Hot leads only</option>
            <option value="warm">Warm leads only</option>
            <option value="cold">Cold leads only</option>
          </Select>
          <Button onClick={() => setConfirming(true)} disabled={!message.trim() || reachable === 0}>Send broadcast</Button>
        </div>
        <p className={styles.hint}>
          {channel === "sms"
            ? "Each text is billed by Twilio. Numbers that replied STOP are skipped automatically."
            : "People who sent /stop or blocked the bot are skipped automatically."}
        </p>
      </Section>

      {isLoading ? (
        <Skeleton height={100} />
      ) : (
        !!data?.broadcasts.length && (
          <div className={styles.list}>
            {data.broadcasts.map((item) => (
              <div key={item.id} className={styles.listRow}>
                <div className={styles.rowMain}>
                  <div className={styles.rowTitle}>{item.message}</div>
                  <div className={styles.rowMeta}>
                    {item.status === "sending" ? <Badge variant="info">Sending…</Badge> : <span>Sent to {item.sent}</span>}
                    {item.failed > 0 && <span>{item.failed} failed</span>}
                    {item.skipped > 0 && <span>{item.skipped} skipped</span>}
                    {item.lead_label && <span>{item.lead_label} leads</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {confirming && (
        <Modal
          isOpen
          onClose={() => setConfirming(false)}
          title="Send this broadcast?"
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirming(false)}>Cancel</Button>
              <Button onClick={send} isLoading={isSending}>Send now</Button>
            </>
          }
        >
          <p className={styles.hint}>
            This goes out right away to {leadLabel ? `your ${leadLabel} leads` : `up to ${reachable} ${reachable === 1 ? "person" : "people"}`} on {feature.name} and can&apos;t be undone.
          </p>
        </Modal>
      )}
    </>
  );
}

export function ChannelGrow({ channel, connectionId }: HubProps) {
  const [tab, setTab] = useState<"links" | "broadcasts">("links");
  return (
    <>
      <Tabs<"links" | "broadcasts">
        options={[
          { value: "links", label: channel === "sms" ? "Campaign keywords" : "Links & QR codes" },
          { value: "broadcasts", label: "Broadcasts" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "links" ? <Links channel={channel} connectionId={connectionId} /> : <Broadcasts channel={channel} connectionId={connectionId} />}
    </>
  );
}

// ── Analytics ──

type Range = "7" | "30" | "90";

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className={styles.stat}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export function ChannelAnalyticsTab({ channel, connectionId }: HubProps) {
  const hub = useMemo(() => channelHubApi(channel, connectionId), [channel, connectionId]);
  const [range, setRange] = useState<Range>("30");
  const { data, isLoading, error } = useAsync(() => hub.analytics(Number(range)), [hub, range]);
  const peak = Math.max(1, ...(data?.new_per_day ?? []).map((day) => day.count));
  const topSource = Math.max(1, ...(data?.sources ?? []).map((source) => source.people));
  const hot = (data?.leads.hot ?? 0) + (data?.leads.very_hot ?? 0);

  return (
    <>
      <Tabs<Range>
        options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }]}
        value={range}
        onChange={setRange}
      />
      {isLoading ? (
        <Skeleton height={280} />
      ) : !data ? (
        <EmptyState title="Couldn't load analytics" description={error ?? "Please try again."} />
      ) : (
        <>
          <div className={styles.statGrid}>
            <Stat value={data.new_contacts} label="New people" />
            <Stat value={data.total_contacts} label="People in total" />
            <Stat value={hot} label="Hot leads" />
            <Stat value={data.messages_received} label="Messages received" />
            <Stat value={data.messages_sent} label="Replies sent" />
            <Stat value={data.instant_answers} label="Instant answers used" />
            <Stat value={data.callbacks_waiting} label="Waiting for a callback" />
            <Stat value={data.opted_out} label="Opted out or blocked" />
          </div>

          <Section title="New people per day">
            <div className={styles.bars} role="img" aria-label="New people per day">
              {data.new_per_day.map((day) => (
                <span key={day.date} style={{ height: `${(day.count / peak) * 100}%` }} title={`${day.date}: ${day.count}`} />
              ))}
            </div>
            <div className={styles.barAxis}>
              <span>{data.new_per_day[0]?.date}</span>
              <span>{data.new_per_day[data.new_per_day.length - 1]?.date}</span>
            </div>
          </Section>

          <Section title="Where people came from" hint="Links, QR codes and keywords you track show up by name.">
            {data.sources.length === 0 ? (
              <p className={styles.hint}>Nobody has written in yet.</p>
            ) : (
              data.sources.map((source) => (
                <div key={source.name}>
                  <div className={styles.rowMeta}>
                    <strong>{source.name}</strong>
                    <span>{source.people} people</span>
                    <span>{source.hot_leads} hot leads</span>
                  </div>
                  <div className={styles.sourceBar}>
                    <span style={{ width: `${(source.people / topSource) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </Section>
        </>
      )}
    </>
  );
}
