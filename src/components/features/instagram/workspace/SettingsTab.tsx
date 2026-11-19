"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  instagramAutomationsApi,
  type InstagramCommentModeration,
  type InstagramConnectionHealth,
  type InstagramProfile,
} from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { Button, InfoLabel, Input, Modal, Skeleton, Switch } from "@/components/ui";
import { InstagramSafetyPanel } from "../InstagramSafetyPanel";
import { InstagramRemovalRequiredModal } from "../InstagramRemovalRequiredModal";
import { IconTile } from "./icons";
import { apiErrorMessage } from "./media";
import styles from "./workspace.module.scss";

interface SettingsTabProps {
  businessId: string;
  connectionId: string;
  profile: InstagramProfile | null;
  canAdmin: boolean;
  canManage: boolean;
  onAiChanged: (enabled: boolean) => void;
  onDisconnected: () => void;
}

export function SettingsTab({ businessId, connectionId, profile, canAdmin, canManage, onAiChanged, onDisconnected }: SettingsTabProps) {
  return (
    <div className={styles.panel}>
      <AiCard businessId={businessId} connectionId={connectionId} profile={profile} canAdmin={canAdmin} onChanged={onAiChanged} />
      <ModerationCard businessId={businessId} connectionId={connectionId} canManage={canManage} />
      <LimitsCard businessId={businessId} connectionId={connectionId} />
      <ConnectionCard businessId={businessId} connectionId={connectionId} username={profile?.username} canAdmin={canAdmin} onDisconnected={onDisconnected} />
      <details className={`${styles.card} ${styles.details}`}>
        <summary>What Instagram doesn&apos;t allow automations to do</summary>
        <p>
          Instagram doesn&apos;t tell apps when someone new follows you, so “DM new followers” isn&apos;t possible. You can only send one private
          reply per comment, within 7 days of it. After that, you can message someone only within 24 hours of their last message to you.
          Stories that mention you and posts shared to you in a DM are supported.
        </p>
      </details>
    </div>
  );
}

// ── AI agent ────────────────────────────────────────────────────────────────

function AiCard({
  businessId,
  connectionId,
  profile,
  canAdmin,
  onChanged,
}: {
  businessId: string;
  connectionId: string;
  profile: InstagramProfile | null;
  canAdmin: boolean;
  onChanged: (enabled: boolean) => void;
}) {
  const { show } = useToast();
  const [saving, setSaving] = useState(false);
  const enabled = Boolean(profile?.ai_enabled);
  const allowed = profile?.ai_allowed ?? true;

  async function toggle(next: boolean) {
    setSaving(true);
    try {
      await instagramAutomationsApi.setAi(businessId, connectionId, next);
      onChanged(next);
      show(next ? "AI agent is on. It will now answer DMs on this account." : "AI agent is off. Only your automations will reply.", "success");
    } catch (error) {
      show(apiErrorMessage(error, "Couldn't change the AI agent."), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.card} id="ai-agent">
      <div className={styles.cardHead}>
        <div>
          <h3 className={styles.titleWithIcon}>
            <IconTile name="bot" tone="violet" size="sm" /> AI agent
          </h3>
          <p>Answers DMs for you in your own words, using your business details, knowledge base and products.</p>
        </div>
        <span className={`${styles.pill} ${!allowed ? styles.pillWarn : enabled ? styles.pillOn : styles.pillOff}`}>
          <i aria-hidden /> {!allowed ? "Not in your plan" : enabled ? "ON" : "OFF"}
        </span>
      </div>

      <div className={styles.settingRow}>
        <div>
          <strong>{enabled ? "The AI agent is answering DMs" : "The AI agent is off"}</strong>
          <p>
            {!allowed
              ? "AI replies aren't included in your plan. Contact support to turn them on. Your automations keep working without it."
              : enabled
                ? "When no automation matches a DM, or after an automation hands over, the AI replies within seconds."
                : "Only your automations reply. DMs they don't cover wait in your inbox for you."}
          </p>
        </div>
        <Switch checked={enabled} disabled={!allowed || !canAdmin || saving || !profile} onChange={(value) => void toggle(value)} aria-label="AI agent" />
      </div>

      <ul className={styles.bullets}>
        <li>Automations (comment replies, DMs) work the same whether the AI is on or off.</li>
        <li>You can pause the AI for a single conversation from the inbox at any time.</li>
        <li>
          Want better answers? Add details in <Link href="/agent-config">AI agent</Link>, <Link href="/knowledge-base">Knowledge base</Link> and{" "}
          <Link href="/products">Products</Link>. None of these are needed for automations.
        </li>
      </ul>
    </section>
  );
}

// ── Comment moderation ──────────────────────────────────────────────────────

const OPTIONS: Array<{ key: "phone_numbers" | "emails" | "links"; label: string; detail: string }> = [
  { key: "phone_numbers", label: "Phone numbers", detail: "e.g. 98765 43210, +1 415 555 0123" },
  { key: "emails", label: "Email addresses", detail: "e.g. name@gmail.com" },
  { key: "links", label: "Links", detail: "e.g. www.site.com, bit.ly/…" },
];

function ModerationCard({ businessId, connectionId, canManage }: { businessId: string; connectionId: string; canManage: boolean }) {
  const { show } = useToast();
  const [settings, setSettings] = useState<InstagramCommentModeration | null>(null);
  const [failed, setFailed] = useState(false);
  const [keywords, setKeywords] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    instagramAutomationsApi
      .moderation(businessId, connectionId)
      .then((result) => {
        if (cancelled) return;
        setSettings(result);
        setKeywords(result.keywords.join(", "));
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [businessId, connectionId]);

  function change(partial: Partial<InstagramCommentModeration>) {
    setSettings((current) => (current ? { ...current, ...partial } : current));
    setDirty(true);
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const saved = await instagramAutomationsApi.updateModeration(businessId, connectionId, {
        ...settings,
        keywords: keywords.split(",").map((item) => item.trim()).filter(Boolean),
      });
      setSettings(saved);
      setKeywords(saved.keywords.join(", "));
      setDirty(false);
      show(saved.enabled ? "Comment rules saved. Matching comments will be removed automatically." : "Comment rules saved (turned off).", "success");
    } catch (error) {
      show(apiErrorMessage(error, "Couldn't save the comment rules."), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <h3 className={styles.titleWithIcon}>
            <IconTile name="shield" tone="teal" size="sm" /> Auto-remove comments
          </h3>
          <p>Remove comments that share phone numbers, emails, links or words you choose, before anyone else sees them.</p>
        </div>
        {settings && (
          <span className={`${styles.pill} ${settings.enabled ? styles.pillOn : styles.pillOff}`}>
            <i aria-hidden /> {settings.enabled ? "ON" : "OFF"}
          </span>
        )}
      </div>

      {failed ? (
        <p className={styles.muted}>These settings couldn&apos;t be loaded right now.</p>
      ) : !settings ? (
        <Skeleton height={120} />
      ) : (
        <>
          <div className={styles.settingRow}>
            <div>
              <strong>
                <InfoLabel help="Checked the moment a comment arrives, before any automation replies. Use it to stop people sharing phone numbers or links that scammers use to contact your followers.">Remove matching comments automatically</InfoLabel>
              </strong>
              <p>A removed comment gets no automated reply.</p>
            </div>
            <Switch checked={settings.enabled} disabled={!canManage} onChange={(value) => change({ enabled: value })} aria-label="Auto-remove comments" />
          </div>

          {settings.enabled && (
            <>
              <div className={styles.checks}>
                {OPTIONS.map((option) => (
                  <label key={option.key} className={styles.checkOption}>
                    <input type="checkbox" checked={settings[option.key]} disabled={!canManage} onChange={(event) => change({ [option.key]: event.target.checked })} />
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.detail}</small>
                    </span>
                  </label>
                ))}
              </div>
              <Input
                label={<InfoLabel help="Whole words only: “scam” removes “this is a scam” but not “scamper”.">Also remove comments with these words (comma-separated)</InfoLabel>}
                value={keywords}
                disabled={!canManage}
                onChange={(event) => {
                  setKeywords(event.target.value);
                  setDirty(true);
                }}
                placeholder="scam, fake, dm me"
              />
              <div className={styles.checks}>
                <label className={styles.checkOption}>
                  <input type="radio" name="moderation-action" checked={settings.action === "delete"} disabled={!canManage} onChange={() => change({ action: "delete" })} />
                  <span>
                    <strong>Delete</strong>
                    <small>Removed for everyone, permanently.</small>
                  </span>
                </label>
                <label className={styles.checkOption}>
                  <input type="radio" name="moderation-action" checked={settings.action === "hide"} disabled={!canManage} onChange={() => change({ action: "hide" })} />
                  <span>
                    <strong>Hide</strong>
                    <small>Only the person who wrote it still sees it.</small>
                  </span>
                </label>
              </div>
            </>
          )}

          {canManage && (
            <div className={styles.rowActions}>
              <Button onClick={() => void save()} isLoading={saving} disabled={!dirty}>
                Save comment rules
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ── Sending limits (kept out of the way) ────────────────────────────────────

function LimitsCard({ businessId, connectionId }: { businessId: string; connectionId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <h3 className={styles.titleWithIcon}>
            <IconTile name="gauge" tone="amber" size="sm" /> Reply speed &amp; limits
          </h3>
          <p>Safe defaults are already set to keep your account in Instagram&apos;s good books. Most people never need to change these.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          {open ? "Hide" : "Show limits"}
        </Button>
      </div>
      {open && <InstagramSafetyPanel businessId={businessId} connectionId={connectionId} />}
    </section>
  );
}

// ── Connection ──────────────────────────────────────────────────────────────

function ConnectionCard({
  businessId,
  connectionId,
  username,
  canAdmin,
  onDisconnected,
}: {
  businessId: string;
  connectionId: string;
  username?: string;
  canAdmin: boolean;
  onDisconnected: () => void;
}) {
  const { show } = useToast();
  const [health, setHealth] = useState<InstagramConnectionHealth | null>(null);
  const [checking, setChecking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [removalUrl, setRemovalUrl] = useState<string | null>(null);

  async function check(repair: boolean) {
    setChecking(true);
    try {
      if (repair) await instagramAutomationsApi.subscribe(businessId, connectionId);
      const result = await instagramAutomationsApi.health(businessId, connectionId);
      setHealth(result);
      show(result.status === "healthy" ? "Everything is connected and working." : "Instagram needs attention, see below.", result.status === "healthy" ? "success" : "warning");
    } catch (error) {
      show(apiErrorMessage(error, "Couldn't check the connection."), "error");
    } finally {
      setChecking(false);
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      const result = await instagramAutomationsApi.disconnect(businessId, connectionId);
      setConfirming(false);
      if (result.manual_removal_required) {
        setRemovalUrl(result.instagram_removal_url || "https://www.instagram.com/accounts/manage_access/");
      } else {
        show("Instagram disconnected.", "default");
        onDisconnected();
      }
    } catch (error) {
      show(apiErrorMessage(error, "Couldn't disconnect. Please try again."), "error");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <section className={`${styles.card} ${styles.dangerZone}`}>
      <div className={styles.cardHead}>
        <div>
          <h3 className={styles.titleWithIcon}>
            <IconTile name="plug" tone="blue" size="sm" /> Connection
          </h3>
          <p>Check that Instagram is sending comments and messages here, or disconnect this account.</p>
        </div>
      </div>
      {health && (
        <div className={`${styles.notice} ${health.status !== "healthy" ? styles.noticeWarn : ""}`}>
          {health.status === "healthy"
            ? "Connected. Comments and messages are arriving."
            : health.missing_webhook_fields.length
              ? `Some updates aren't arriving (${health.missing_webhook_fields.join(", ")}). Use “Fix connection”.`
              : health.errors[0] || "Instagram needs attention. Try reconnecting."}
        </div>
      )}
      <div className={styles.rowActions}>
        <Button variant="secondary" isLoading={checking} onClick={() => void check(false)}>
          Check connection
        </Button>
        {health && health.status !== "healthy" && canAdmin && (
          <Button isLoading={checking} onClick={() => void check(true)}>
            Fix connection
          </Button>
        )}
        {canAdmin && (
          <Button variant="outline-danger" onClick={() => setConfirming(true)}>
            Disconnect @{username || "account"}
          </Button>
        )}
      </div>

      <Modal
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        title="Disconnect Instagram?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button variant="danger" isLoading={disconnecting} onClick={() => void disconnect()}>
              Disconnect
            </Button>
          </>
        }
      >
        <p className={styles.muted}>
          This removes @{username || "this account"} and permanently deletes its automations and their history. You can connect again later, but
          automations will need to be rebuilt.
        </p>
      </Modal>

      <InstagramRemovalRequiredModal
        isOpen={Boolean(removalUrl)}
        removalUrl={removalUrl || "https://www.instagram.com/accounts/manage_access/"}
        onClose={() => {
          setRemovalUrl(null);
          onDisconnected();
        }}
      />
    </section>
  );
}
