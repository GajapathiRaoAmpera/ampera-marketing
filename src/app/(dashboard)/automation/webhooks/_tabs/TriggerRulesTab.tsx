"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, Input, Select, Skeleton, Switch } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import {
  triggerRulesApi,
  type TriggerAction,
  type TriggerRule,
  type TriggerSource,
} from "@/lib/api/integrations";
import styles from "../page.module.scss";

const SOURCE_LABELS: Record<TriggerSource, string> = {
  instagram_comment: "Instagram comment contains a keyword",
  lead_scored: "A lead score is computed",
  sentiment_negative: "Sentiment turns negative",
  shopify_order_created: "A new Shopify order is placed",
};

const ACTION_LABELS: Record<TriggerAction, string> = {
  whatsapp_broadcast: "Send a WhatsApp broadcast",
  telegram_post: "Post to Telegram",
  sms_send: "Send an SMS",
  outbound_webhook: "Call a webhook URL",
};

// Per-source trigger_config fields: only instagram_comment has a
// meaningful filter today (a substring match on the comment text); the
// other sources fire on every occurrence with no additional filter, since
// the backend's _matches_trigger_config treats an empty config as "always match".
function needsKeywordFilter(source: TriggerSource) {
  return source === "instagram_comment";
}

function formatDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString();
}

export function TriggerRulesTab({ businessId }: { businessId: string }) {
  const { show } = useToast();
  const [items, setItems] = useState<TriggerRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [source, setSource] = useState<TriggerSource>("instagram_comment");
  const [action, setAction] = useState<TriggerAction>("whatsapp_broadcast");
  const [keyword, setKeyword] = useState("");
  const [message, setMessage] = useState("");
  const [leadLabelFilter, setLeadLabelFilter] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [smsTo, setSmsTo] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await triggerRulesApi.list(businessId);
      setItems(result.rules);
    } catch {
      show("Couldn't load trigger rules.", "error");
    } finally {
      setLoading(false);
    }
  }, [businessId, show]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const actionConfigValid = useMemo(() => {
    if (action === "outbound_webhook") return webhookUrl.trim().length > 0;
    if (action === "sms_send") return smsTo.trim().length > 0 && message.trim().length > 0;
    if (action === "telegram_post") return message.trim().length > 0;
    if (action === "whatsapp_broadcast") return message.trim().length > 0;
    return false;
  }, [action, webhookUrl, smsTo, message]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return show("Give this rule a name.", "error");
    if (needsKeywordFilter(source) && !keyword.trim()) return show("Enter a keyword to match.", "error");
    if (!actionConfigValid) return show("Fill in the required fields for this action.", "error");

    const triggerConfig: Record<string, unknown> = {};
    if (needsKeywordFilter(source)) triggerConfig.comment_text = keyword.trim();

    const actionConfig: Record<string, unknown> = {};
    if (action === "whatsapp_broadcast") {
      actionConfig.message = message.trim();
      if (leadLabelFilter) actionConfig.lead_label_filter = leadLabelFilter;
    } else if (action === "telegram_post") {
      actionConfig.message = message.trim();
      if (telegramChatId.trim()) actionConfig.chat_id = telegramChatId.trim();
    } else if (action === "sms_send") {
      actionConfig.message = message.trim();
      actionConfig.to = smsTo.trim();
    } else if (action === "outbound_webhook") {
      actionConfig.url = webhookUrl.trim();
    }

    setBusy(true);
    try {
      await triggerRulesApi.create(businessId, {
        name: name.trim(),
        trigger_source: source,
        trigger_config: triggerConfig,
        action_type: action,
        action_config: actionConfig,
      });
      show("Trigger rule created.", "success");
      setName("");
      setKeyword("");
      setMessage("");
      setLeadLabelFilter("");
      setWebhookUrl("");
      setSmsTo("");
      setTelegramChatId("");
      await load();
    } catch {
      show("Couldn't create the trigger rule.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(rule: TriggerRule) {
    setBusy(true);
    try {
      await triggerRulesApi.setActive(businessId, rule.id, !rule.active);
      show(rule.active ? "Rule paused." : "Rule resumed.", "success");
      await load();
    } catch {
      show("Couldn't update the rule.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(rule: TriggerRule) {
    if (!confirm(`Delete "${rule.name}"?`)) return;
    setBusy(true);
    try {
      await triggerRulesApi.remove(businessId, rule.id);
      show("Rule deleted.", "success");
      await load();
    } catch {
      show("Couldn't delete the rule.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Skeleton height={420} />;

  return (
    <>
      <div className={styles.guide}>
        <strong>Connect your platforms to each other</strong>
        <span>
          E.g. when someone comments &quot;price&quot; on an Instagram post, automatically send a
          WhatsApp broadcast, no external tool needed. For anything not listed here, use a
          webhook (Webhooks tab) or the Public API (API Keys tab) to build it externally.
        </span>
      </div>

      <div className={styles.columns}>
        <Card>
          <h2>Create a rule</h2>
          <form className={styles.form} onSubmit={create}>
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Price comment → broadcast" required />

            <Select label="When" value={source} onChange={(e) => setSource(e.target.value as TriggerSource)}>
              {(Object.keys(SOURCE_LABELS) as TriggerSource[]).map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </option>
              ))}
            </Select>

            {needsKeywordFilter(source) && (
              <Input
                label="Keyword to match"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="price"
                required
              />
            )}

            <Select label="Then" value={action} onChange={(e) => setAction(e.target.value as TriggerAction)}>
              {(Object.keys(ACTION_LABELS) as TriggerAction[]).map((a) => (
                <option key={a} value={a}>
                  {ACTION_LABELS[a]}
                </option>
              ))}
            </Select>

            {action === "outbound_webhook" ? (
              <Input
                label="Webhook URL"
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://example.com/hook"
                required
              />
            ) : (
              <Input
                label="Message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Thanks for your interest! Check your DMs for pricing."
                required
              />
            )}

            {action === "whatsapp_broadcast" && (
              <Select
                label="Only send to (optional)"
                value={leadLabelFilter}
                onChange={(e) => setLeadLabelFilter(e.target.value)}
              >
                <option value="">All contacts</option>
                <option value="hot">Hot leads</option>
                <option value="warm">Warm leads</option>
                <option value="cold">Cold leads</option>
              </Select>
            )}

            {action === "sms_send" && (
              <Input
                label="Send to (phone number)"
                value={smsTo}
                onChange={(e) => setSmsTo(e.target.value)}
                placeholder="+15551234567"
                required
              />
            )}

            {action === "telegram_post" && (
              <Input
                label="Chat ID (optional, defaults to your connected chat)"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
              />
            )}

            <Button type="submit" isLoading={busy}>
              Create rule
            </Button>
          </form>
        </Card>

        <section className={styles.list}>
          <h2>Rules</h2>
          {items.length === 0 ? (
            <EmptyState title="No trigger rules yet" description="Create one to automate an action across platforms." />
          ) : (
            items.map((rule) => (
              <Card key={rule.id} className={styles.endpoint}>
                <div className={styles.endpointTop}>
                  <div>
                    <h3>{rule.name}</h3>
                    <span>
                      {SOURCE_LABELS[rule.trigger_source]} → {ACTION_LABELS[rule.action_type]}
                    </span>
                  </div>
                  <Badge variant={rule.active ? "success" : "neutral"}>{rule.active ? "Active" : "Paused"}</Badge>
                </div>
                <div className={styles.metrics}>
                  <span>Fired {rule.fire_count} time{rule.fire_count === 1 ? "" : "s"}</span>
                  {rule.created_at && <span>Created {formatDate(rule.created_at)}</span>}
                </div>
                <div className={styles.actions}>
                  <Switch checked={rule.active} onChange={() => void toggle(rule)} label={rule.active ? "On" : "Off"} disabled={busy} />
                  <Button size="sm" variant="danger" onClick={() => void remove(rule)} disabled={busy}>
                    Delete
                  </Button>
                </div>
              </Card>
            ))
          )}
        </section>
      </div>
    </>
  );
}
