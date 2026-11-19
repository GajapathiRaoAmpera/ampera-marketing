"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, api } from "@/lib/api";
import { whatsappStudioApi, type WhatsAppGroup, type WhatsAppSettings } from "@/lib/api/whatsapp-studio";
import { useToast } from "@/context/ToastContext";
import { Button, InfoLabel, Input, Select, Skeleton, Switch } from "@/components/ui";
import { IconTile } from "@/components/ui/Icon/Icon";
import { formatRelativeTime } from "@/lib/utils/date";
import { OfficialConnectPanel } from "../OfficialConnectPanel";
import { ConnectionHealth } from "./ConnectionHealth";
import { CallingCard, OrderMessagesCard, ProfileCard } from "./AutomationCards";
import styles from "../../instagram/workspace/workspace.module.scss";

interface VoiceSettings {
  enabled: boolean;
  provider?: string | null;
  voice_id?: string | null;
  send_text_also: boolean;
}

interface Props {
  businessId: string;
  agentId?: string | null;
  settings: WhatsAppSettings;
  canAdmin: boolean;
  onChanged: (next: WhatsAppSettings) => void;
  whatsappConfigId?: string;
  tokenExpired: boolean;
  onConnectionChanged: () => void;
}

export function WhatsAppSettingsTab({ businessId, agentId, settings, canAdmin, onChanged, whatsappConfigId, tokenExpired, onConnectionChanged }: Props) {
  return (
    <div className={styles.panel}>
      {canAdmin && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <h3 className={styles.titleWithIcon}>
                <IconTile name="plug" tone={tokenExpired ? "red" : "blue"} size="sm" /> Connection
              </h3>
              <p>Reconnect if your WhatsApp login expires. Your number, contacts and settings stay as they are.</p>
            </div>
            <span className={`${styles.pill} ${tokenExpired ? styles.pillWarn : styles.pillOn}`}>
              <i aria-hidden /> {tokenExpired ? "Login expired" : "Connected"}
            </span>
          </div>
          <ConnectionHealth businessId={businessId} onChanged={onConnectionChanged} />
          <OfficialConnectPanel agentId={agentId ?? undefined} whatsappConfigId={whatsappConfigId} reconnectMode onChanged={onConnectionChanged} />
        </section>
      )}
      <ProfileCard businessId={businessId} canAdmin={canAdmin} />
      <UpiCard businessId={businessId} settings={settings} canAdmin={canAdmin} onChanged={onChanged} />
      <OrderMessagesCard businessId={businessId} settings={settings} canAdmin={canAdmin} onChanged={onChanged} />
      <CallingCard businessId={businessId} canAdmin={canAdmin} />
    </div>
  );
}

export function AiCard({ businessId, settings, canAdmin, onChanged }: { businessId: string; settings: WhatsAppSettings; canAdmin: boolean; onChanged: (next: WhatsAppSettings) => void }) {
  const { show } = useToast();
  const [saving, setSaving] = useState(false);
  const on = settings.ai_enabled && settings.ai_allowed;

  async function toggle(next: boolean) {
    setSaving(true);
    try {
      onChanged(await whatsappStudioApi.updateSettings(businessId, { ai_enabled: next }));
      show(next ? "AI agent is on. It now answers WhatsApp messages." : "AI agent is off. Messages wait in your inbox.", "success");
    } catch (error) {
      show(error instanceof ApiError ? error.userMessage : "Couldn't change the AI agent.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <h3 className={styles.titleWithIcon}>
            <IconTile name="bot" tone="violet" size="sm" /> AI agent
          </h3>
          <p>Answers WhatsApp messages for you, using your business details, knowledge base and products.</p>
        </div>
        <span className={`${styles.pill} ${!settings.ai_allowed ? styles.pillWarn : on ? styles.pillOn : styles.pillOff}`}>
          <i aria-hidden /> {!settings.ai_allowed ? "Not in your plan" : on ? "ON" : "OFF"}
        </span>
      </div>
      <div className={styles.settingRow}>
        <div>
          <strong>{on ? "The AI agent is answering" : "The AI agent is off"}</strong>
          <p>
            {!settings.ai_allowed
              ? "AI replies aren't included in your plan. Contact support to turn them on. Flows, templates and campaigns still work."
              : on
                ? "It replies within seconds. You can take over any chat from the inbox."
                : "Only your flows and greetings reply. Everything else waits in your inbox for you."}
          </p>
        </div>
        <Switch checked={on} disabled={!settings.ai_allowed || !canAdmin || saving} onChange={(value) => void toggle(value)} aria-label="AI agent" />
      </div>
      <ul className={styles.bullets}>
        <li>Make it smarter in <Link href="/knowledge-base">Knowledge base</Link> and <Link href="/products">Products</Link>.</li>
        <li>Questions it can&apos;t answer show up in <Link href="/knowledge-gaps">Knowledge gaps</Link>.</li>
      </ul>
    </section>
  );
}

export function VoiceCard({ agentId, aiOn, canAdmin }: { agentId?: string | null; aiOn: boolean; canAdmin: boolean }) {
  const { show } = useToast();
  const [voice, setVoice] = useState<VoiceSettings | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!agentId) return;
    let cancelled = false;
    api
      .get<{ voice_settings: Partial<VoiceSettings> }>(`/voice/settings/${agentId}`)
      .then((result) => !cancelled && setVoice({ ...result.voice_settings, enabled: Boolean(result.voice_settings.enabled), send_text_also: result.voice_settings.send_text_also ?? true }))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  async function save(next: VoiceSettings) {
    if (!agentId) return;
    setVoice(next);
    setSaving(true);
    try {
      await api.post(`/voice/settings/${agentId}`, {
        enabled: next.enabled,
        provider: next.provider || undefined,
        voice_id: next.voice_id || undefined,
        send_text_also: next.send_text_also,
      });
      show(next.enabled ? "Voice replies are on." : "Voice replies are off.", "success");
    } catch (error) {
      show(error instanceof ApiError ? error.userMessage : "Couldn't save voice replies.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <h3 className={styles.titleWithIcon}>
            <IconTile name="phone" tone="green" size="sm" /> Voice-note replies
          </h3>
          <p>The AI also replies with a voice note, which feels personal and helps customers who prefer listening.</p>
        </div>
        {voice && (
          <span className={`${styles.pill} ${voice.enabled ? styles.pillOn : styles.pillOff}`}>
            <i aria-hidden /> {voice.enabled ? "ON" : "OFF"}
          </span>
        )}
      </div>
      {!agentId ? (
        <p className={styles.muted}>Set up your AI agent first.</p>
      ) : failed ? (
        <p className={styles.muted}>Only the business owner can change voice replies.</p>
      ) : !voice ? (
        <Skeleton height={90} />
      ) : (
        <>
          <div className={styles.settingRow}>
            <div>
              <strong>Send AI replies as voice notes</strong>
              <p>{aiOn ? "Each AI reply is also sent as audio, in the customer's language." : "Turn the AI agent on above to use voice notes."}</p>
            </div>
            <Switch checked={voice.enabled} disabled={!canAdmin || saving || !aiOn} onChange={(value) => void save({ ...voice, enabled: value })} aria-label="Voice-note replies" />
          </div>
          {voice.enabled && (
            <div className={styles.checks}>
              <Select
                label={<InfoLabel help="Different services have different voices. Google works for most languages; ElevenLabs sounds the most natural.">Voice service</InfoLabel>}
                value={voice.provider || ""}
                disabled={!canAdmin || saving}
                onChange={(event) => void save({ ...voice, provider: event.target.value || null })}
              >
                <option value="">Default</option>
                <option value="google">Google</option>
                <option value="elevenlabs">ElevenLabs</option>
                <option value="openai">OpenAI</option>
              </Select>
              {voice.provider === "elevenlabs" && (
                <Input
                  label={<InfoLabel help="Paste the ID of an ElevenLabs voice to use your own or a cloned voice. Leave empty for the default.">ElevenLabs voice ID (optional)</InfoLabel>}
                  defaultValue={voice.voice_id || ""}
                  disabled={!canAdmin}
                  onBlur={(event) => event.target.value !== (voice.voice_id || "") && void save({ ...voice, voice_id: event.target.value || null })}
                />
              )}
              <label className={styles.checkOption}>
                <input type="checkbox" checked={voice.send_text_also} disabled={!canAdmin || saving} onChange={(event) => void save({ ...voice, send_text_also: event.target.checked })} />
                <span>
                  <strong>Also send the text</strong>
                  <small>Recommended: customers can read it if they can&apos;t listen.</small>
                </span>
              </label>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function GroupsCard({ businessId, settings, canAdmin, canManage, onChanged }: { businessId: string; settings: WhatsAppSettings; canAdmin: boolean; canManage: boolean; onChanged: (next: WhatsAppSettings) => void }) {
  const { show } = useToast();
  const [groups, setGroups] = useState<WhatsAppGroup[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    whatsappStudioApi
      .groups(businessId)
      .then((result) => !cancelled && setGroups(result.groups))
      .catch(() => !cancelled && setGroups([]));
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  async function toggleAll(next: boolean) {
    setSaving(true);
    try {
      onChanged(await whatsappStudioApi.updateSettings(businessId, { group_replies_enabled: next }));
      show(next ? "The AI will answer in your WhatsApp groups." : "The AI won't reply in groups.", "success");
    } catch (error) {
      show(error instanceof ApiError ? error.userMessage : "Couldn't change group replies.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleGroup(group: WhatsAppGroup, next: boolean) {
    setGroups((list) => list?.map((item) => (item.group_id === group.group_id ? { ...item, ai_enabled: next } : item)) ?? list);
    try {
      await whatsappStudioApi.setGroupAi(businessId, group.group_id, next);
    } catch {
      setGroups((list) => list?.map((item) => (item.group_id === group.group_id ? { ...item, ai_enabled: !next } : item)) ?? list);
      show("Couldn't change that group.", "error");
    }
  }

  const on = settings.group_replies_enabled && settings.ai_enabled && settings.ai_allowed;

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <h3 className={styles.titleWithIcon}>
            <IconTile name="team" tone="blue" size="sm" /> AI in group chats
          </h3>
          <p>Let the AI answer questions in WhatsApp groups your number is part of, like a community or customer group.</p>
        </div>
        <span className={`${styles.pill} ${on ? styles.pillOn : styles.pillOff}`}>
          <i aria-hidden /> {on ? "ON" : "OFF"}
        </span>
      </div>
      <div className={styles.settingRow}>
        <div>
          <strong>Reply in groups</strong>
          <p>{settings.ai_enabled ? "When on, you can still switch off individual groups below." : "Turn the AI agent on above first."}</p>
        </div>
        <Switch
          checked={settings.group_replies_enabled}
          disabled={!canAdmin || saving || !settings.ai_enabled || !settings.ai_allowed}
          onChange={(value) => void toggleAll(value)}
          aria-label="Reply in groups"
        />
      </div>
      {groups === null ? (
        <Skeleton height={60} />
      ) : groups.length === 0 ? (
        <p className={styles.muted}>No group messages yet. Add your WhatsApp number to a group and it will appear here.</p>
      ) : (
        <ul className={styles.miniList}>
          {groups.map((group) => (
            <li key={group.group_id}>
              <span>
                <strong style={{ fontSize: "var(--font-size-sm)" }}>Group …{group.group_id.replace(/@g\.us$/, "").slice(-6)}</strong>
                <span className={styles.muted} style={{ display: "block", fontSize: "var(--font-size-xs)" }}>
                  {group.messages} messages · last {formatRelativeTime(group.last_at)}
                </span>
              </span>
              <Switch checked={group.ai_enabled && on} disabled={!canManage || !on} onChange={(value) => void toggleGroup(group, value)} aria-label={`AI in group ${group.group_id}`} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function UpiCard({ businessId, settings, canAdmin, onChanged }: { businessId: string; settings: WhatsAppSettings; canAdmin: boolean; onChanged: (next: WhatsAppSettings) => void }) {
  const { show } = useToast();
  const [upiId, setUpiId] = useState(settings.upi_id ?? "");
  const [payee, setPayee] = useState(settings.upi_payee_name ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = upiId !== (settings.upi_id ?? "") || payee !== (settings.upi_payee_name ?? "");

  async function save() {
    setSaving(true);
    try {
      onChanged(await whatsappStudioApi.updateSettings(businessId, { upi_id: upiId.trim(), upi_payee_name: payee.trim() }));
      show(upiId.trim() ? "UPI saved. Orders now ask customers to pay with any UPI app." : "UPI removed.", "success");
    } catch (error) {
      show(error instanceof ApiError ? error.userMessage : "Couldn't save your UPI details.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <h3 className={styles.titleWithIcon}>
            <IconTile name="key" tone="amber" size="sm" /> Get paid by UPI
          </h3>
          <p>Customers pay for WhatsApp orders straight to your UPI ID: GPay, PhonePe, Paytm or any bank app. No gateway, no fees.</p>
        </div>
        <span className={`${styles.pill} ${settings.upi_id ? styles.pillOn : styles.pillOff}`}>
          <i aria-hidden /> {settings.upi_id ? "Set up" : "Not set"}
        </span>
      </div>
      <div className={styles.checks}>
        <Input
          label={<InfoLabel help="Find it in your UPI app's profile, e.g. yourname@okhdfcbank or 9876543210@ybl. Money goes straight to the linked bank account.">Your UPI ID</InfoLabel>}
          value={upiId}
          disabled={!canAdmin}
          onChange={(event) => setUpiId(event.target.value)}
          placeholder="yourname@okhdfcbank"
        />
        <Input
          label={<InfoLabel help="Shown to the customer in their UPI app, so they know who they're paying.">Name customers see</InfoLabel>}
          value={payee}
          disabled={!canAdmin}
          maxLength={50}
          onChange={(event) => setPayee(event.target.value)}
        />
      </div>
      <ul className={styles.bullets}>
        <li>The customer gets a link that opens their UPI app with the amount filled in.</li>
        <li>UPI doesn&apos;t tell us when money arrives, so check your bank app and tap “Mark as paid” on the order (Shop → Orders).</li>
      </ul>
      {canAdmin && (
        <div className={styles.rowActions}>
          <Button onClick={() => void save()} isLoading={saving} disabled={!dirty}>
            Save UPI details
          </Button>
        </div>
      )}
    </section>
  );
}
