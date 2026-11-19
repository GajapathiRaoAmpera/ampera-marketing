"use client";

import { useState } from "react";
import { copyText } from "@/lib/utils/browser";
import {
  messengerPageApi,
  ApiError,
  type MessengerBroadcast,
  type MessengerCommentRule,
} from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/context/ToastContext";
import { Badge, Button, EmptyState, Input, Modal, Select, Skeleton, Switch, Tabs, Textarea } from "@/components/ui";
import { Section } from "@/components/features/messenger/MessengerShell";
import styles from "@/components/features/messenger/Messenger.module.scss";

type Tab = "links" | "comments" | "broadcasts";

function useErrorToast() {
  const { show } = useToast();
  return (err: unknown, fallback: string) => show(err instanceof ApiError ? err.userMessage : fallback, "error");
}

// ── Links and QR codes ──

function Links({ pageId }: { pageId: string }) {
  const { show } = useToast();
  const fail = useErrorToast();
  const { data: links, isLoading, refresh } = useAsync(() => messengerPageApi.links(pageId), [pageId]);
  const [name, setName] = useState("");
  const [opening, setOpening] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [qr, setQr] = useState<{ url: string; qr_data_uri: string } | null>(null);

  async function create() {
    setIsCreating(true);
    try {
      setQr(await messengerPageApi.createLink(pageId, name.trim(), opening));
      setName("");
      setOpening("");
      refresh();
    } catch (err) {
      fail(err, "Couldn't create the link.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <>
      <Section title="New link" hint="Put it on a poster, your bio or packaging, and see how many people and hot leads it brings in.">
        <div className={styles.row}>
          <Input label="Where will you use it?" placeholder="e.g. Shop counter QR" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          <Button onClick={create} isLoading={isCreating} disabled={!name.trim()}>Create link</Button>
        </div>
        <Input
          label="Opening message (optional)"
          placeholder="Sent to people who arrive through this link"
          value={opening}
          onChange={(e) => setOpening(e.target.value)}
        />
      </Section>

      {isLoading ? (
        <Skeleton height={120} />
      ) : !links?.length ? (
        <EmptyState title="No links yet" description="Create one above to start tracking where your chats come from." />
      ) : (
        <div className={styles.list}>
          {links.map((link) => (
            <div key={link.ref} className={styles.listRow}>
              <div className={styles.rowMain}>
                <div className={styles.rowTitle}>{link.name}</div>
                <div className={styles.rowMeta}>
                  <span>{link.people} people</span>
                  <span>{link.hot_leads} hot leads</span>
                </div>
              </div>
              <div className={styles.rowActions}>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => copyText(link.url).then(() => show("Link copied.", "success"))}
                >
                  Copy
                </Button>
                <Button size="sm" variant="secondary" onClick={() => messengerPageApi.linkQr(pageId, link.ref).then(setQr).catch((err) => fail(err, "Couldn't load the QR code."))}>
                  QR code
                </Button>
                <Button size="sm" variant="ghost" onClick={() => messengerPageApi.deleteLink(pageId, link.ref).then(refresh).catch((err) => fail(err, "Couldn't delete the link."))}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {qr && (
        <Modal isOpen onClose={() => setQr(null)} title="Your link">
          <div className={styles.qr}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr.qr_data_uri} alt="QR code for this link" />
            <code>{qr.url}</code>
            <a href={qr.qr_data_uri} download="messenger-qr.png">
              <Button variant="secondary">Download QR code</Button>
            </a>
          </div>
        </Modal>
      )}
    </>
  );
}

// ── Comments on Page posts ──

const EMPTY_RULE: Omit<MessengerCommentRule, "id" | "runs"> = {
  name: "", keywords: [], match: "contains", post_ids: [], private_message: "", public_reply: "", enabled: true,
};

function Comments({ pageId }: { pageId: string }) {
  const { show } = useToast();
  const fail = useErrorToast();
  const { data, isLoading, refresh } = useAsync(() => messengerPageApi.commentRules(pageId), [pageId]);
  const { data: health, refresh: refreshHealth } = useAsync(() => messengerPageApi.health(pageId), [pageId]);
  const { data: settings, refresh: refreshSettings } = useAsync(() => messengerPageApi.settings(pageId), [pageId]);
  const [editing, setEditing] = useState<{ id?: string; rule: Omit<MessengerCommentRule, "id" | "runs"> } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);

  async function enable() {
    setIsEnabling(true);
    try {
      const result = await messengerPageApi.resubscribe(pageId);
      show(result.comments_ready ? "Comments are now connected." : "Facebook didn't grant access to comments for this Page yet.", result.comments_ready ? "success" : "warning");
      refreshHealth();
    } catch (err) {
      fail(err, "Couldn't connect comments.");
    } finally {
      setIsEnabling(false);
    }
  }

  async function save() {
    if (!editing) return;
    setIsSaving(true);
    try {
      await messengerPageApi.saveCommentRule(pageId, { ...editing.rule, keywords: editing.rule.keywords.map((w) => w.trim()).filter(Boolean) }, editing.id);
      setEditing(null);
      refresh();
    } catch (err) {
      fail(err, "Couldn't save the rule.");
    } finally {
      setIsSaving(false);
    }
  }

  const patch = (value: Partial<MessengerCommentRule>) => setEditing((current) => (current ? { ...current, rule: { ...current.rule, ...value } } : current));

  return (
    <>
      {health && !health.comments_ready && (
        <div className={styles.notice}>
          <p>
            Comments aren&apos;t connected for this Page yet.{" "}
            <button type="button" className={styles.linkButton} onClick={enable} disabled={isEnabling}>
              {isEnabling ? "Connecting…" : "Connect comments"}
            </button>
          </p>
        </div>
      )}

      <Section
        title="Let the assistant reply to comments"
        hint="Answers questions publicly from your knowledge base when no rule below matches."
        right={
          <Switch
            checked={settings?.comments.ai_reply ?? false}
            aria-label="AI replies to comments"
            onChange={(value) =>
              messengerPageApi
                .saveSettings(pageId, { comments: { ai_reply: value } })
                .then(refreshSettings)
                .catch((err) => fail(err, "Couldn't update this setting."))
            }
          />
        }
      />

      <Section
        title="Comment rules"
        hint="When someone comments a word you choose, message them privately and reply in public."
        right={<Button size="sm" onClick={() => setEditing({ rule: { ...EMPTY_RULE } })}>New rule</Button>}
      >
        {isLoading ? (
          <Skeleton height={80} />
        ) : !data?.rules.length ? (
          <p className={styles.hint}>No rules yet. Try one for the word “price”.</p>
        ) : (
          <div className={styles.list}>
            {data.rules.map((rule) => (
              <div key={rule.id} className={styles.listRow}>
                <div className={styles.rowMain}>
                  <div className={styles.rowTitle}>{rule.name}</div>
                  <div className={styles.rowMeta}>
                    <span>{rule.keywords.join(", ")}</span>
                    <span>Used {rule.runs} times</span>
                    {!rule.enabled && <Badge variant="neutral">Off</Badge>}
                  </div>
                </div>
                <div className={styles.rowActions}>
                  <Button size="sm" variant="secondary" onClick={() => setEditing({ id: rule.id, rule })}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => messengerPageApi.deleteCommentRule(pageId, rule.id).then(refresh).catch((err) => fail(err, "Couldn't delete the rule."))}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {!!data?.recent.length && (
        <Section title="Recent comments">
          <div className={styles.list}>
            {data.recent.map((event, index) => (
              <div key={index} className={styles.listRow}>
                <div className={styles.rowMain}>
                  <div className={styles.rowTitle}>{event.author ?? "Someone"}: {event.text}</div>
                  <div className={styles.rowMeta}>
                    {event.private && <span>Messaged privately</span>}
                    {event.public && <span>{event.ai ? "Assistant replied" : "Replied publicly"}</span>}
                    {!event.private && !event.public && !event.error && <span>No reply needed</span>}
                    {event.error && <span className={styles.error}>{event.error}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {editing && (
        <Modal
          isOpen
          onClose={() => setEditing(null)}
          title={editing.id ? "Edit rule" : "New comment rule"}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button
                onClick={save}
                isLoading={isSaving}
                disabled={!editing.rule.name.trim() || !editing.rule.keywords.join("").trim() || (!editing.rule.private_message.trim() && !editing.rule.public_reply.trim())}
              >
                Save rule
              </Button>
            </>
          }
        >
          <div className={styles.modalStack}>
            <Input label="Name" placeholder="e.g. Price requests" value={editing.rule.name} onChange={(e) => patch({ name: e.target.value })} maxLength={60} />
            <Input
              label="When a comment contains"
              placeholder="price, cost, details"
              value={editing.rule.keywords.join(", ")}
              onChange={(e) => patch({ keywords: e.target.value.split(",").map((word) => word.trimStart()) })}
            />
            <Textarea label="Message them privately" value={editing.rule.private_message} onChange={(e) => patch({ private_message: e.target.value })} maxLength={2000} rows={3} />
            <Textarea label="Reply under the comment (optional)" placeholder="Sent you the details!" value={editing.rule.public_reply} onChange={(e) => patch({ public_reply: e.target.value })} maxLength={2000} rows={2} />
            <Switch checked={editing.rule.enabled} onChange={(enabled) => patch({ enabled })} label="Rule is on" />
          </div>
        </Modal>
      )}
    </>
  );
}

// ── Broadcasts ──

const AUDIENCE_LABEL: Record<MessengerBroadcast["audience"], string> = {
  both: "Everyone I'm allowed to message",
  open_window: "People who wrote in the last 24 hours",
  subscribers: "People who subscribed to updates",
};

function Broadcasts({ pageId }: { pageId: string }) {
  const { show } = useToast();
  const fail = useErrorToast();
  const { data, isLoading, refresh } = useAsync(() => messengerPageApi.broadcasts(pageId), [pageId]);
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<MessengerBroadcast["audience"]>("both");
  const [isSending, setIsSending] = useState(false);

  async function send() {
    setIsSending(true);
    try {
      await messengerPageApi.sendBroadcast(pageId, { message: message.trim(), audience });
      setMessage("");
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
            ? `Right now you can reach ${data.audience.open_window} people inside the 24-hour window and ${data.audience.subscribers} subscribers.`
            : "Messenger only lets you message people who wrote recently or subscribed to updates."
        }
      >
        <Textarea label="Message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} showCharCount rows={3} />
        <div className={styles.row}>
          <Select label="Send to" value={audience} onChange={(e) => setAudience(e.target.value as MessengerBroadcast["audience"])}>
            {(Object.keys(AUDIENCE_LABEL) as MessengerBroadcast["audience"][]).map((key) => (
              <option key={key} value={key}>{AUDIENCE_LABEL[key]}</option>
            ))}
          </Select>
          <Button onClick={send} isLoading={isSending} disabled={!message.trim()}>Send broadcast</Button>
        </div>
        <p className={styles.hint}>To grow subscribers, open a contact and choose “Invite to get updates”.</p>
      </Section>

      {isLoading ? (
        <Skeleton height={100} />
      ) : !!data?.broadcasts.length && (
        <div className={styles.list}>
          {data.broadcasts.map((item) => (
            <div key={item.id} className={styles.listRow}>
              <div className={styles.rowMain}>
                <div className={styles.rowTitle}>{item.message}</div>
                <div className={styles.rowMeta}>
                  {item.status === "sending" ? <Badge variant="info">Sending…</Badge> : <span>Sent to {item.sent}</span>}
                  {item.failed > 0 && <span>{item.failed} failed</span>}
                  {item.skipped > 0 && <span>{item.skipped} not reachable</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function GrowTab({ pageId }: { pageId: string }) {
  const [tab, setTab] = useState<Tab>("links");
  return (
    <>
      <Tabs<Tab>
        options={[
          { value: "links", label: "Links & QR codes" },
          { value: "comments", label: "Comments" },
          { value: "broadcasts", label: "Broadcasts" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "links" && <Links pageId={pageId} />}
      {tab === "comments" && <Comments pageId={pageId} />}
      {tab === "broadcasts" && <Broadcasts pageId={pageId} />}
    </>
  );
}
