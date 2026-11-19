"use client";

import { useEffect, useState } from "react";
import { messengerPageApi, ApiError, type MessengerAction, type MessengerKeywordFlow, type MessengerSettings } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { Button, Input, Select, Skeleton, Switch, Textarea } from "@/components/ui";
import { Section } from "@/components/features/messenger/MessengerShell";
import { ACTION_LABELS, ActionListEditor } from "@/components/features/messenger/ActionListEditor";
import styles from "@/components/features/messenger/Messenger.module.scss";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const EMPTY_FLOW: MessengerKeywordFlow = { name: "", keywords: [], match: "contains", reply: "", action: "none", value: "", enabled: true };

function ChatSetup({ pageId }: { pageId: string }) {
  const { show } = useToast();
  const [settings, setSettings] = useState<MessengerSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [syncErrors, setSyncErrors] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    messengerPageApi
      .settings(pageId)
      .then((result) => {
        if (!cancelled) setSettings(result);
      })
      .catch(() => {
        if (!cancelled) show("Couldn't load chat setup.", "error");
      });
    return () => {
      cancelled = true;
    };
  }, [pageId, show]);

  if (!settings) return <Skeleton height={320} />;

  const set = <K extends keyof MessengerSettings>(key: K, value: MessengerSettings[K]) =>
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  const patch = <K extends "get_started" | "quick_replies" | "away" | "nudge" | "hot_lead_alert" | "handover" | "persona" | "booking">(
    key: K,
    value: Partial<MessengerSettings[K]>
  ) => set(key, { ...settings[key], ...value });
  const setFlow = (index: number, value: Partial<MessengerKeywordFlow>) =>
    set("keyword_flows", settings.keyword_flows.map((flow, i) => (i === index ? { ...flow, ...value } : flow)));

  async function save() {
    if (!settings) return;
    setIsSaving(true);
    try {
      const { sync_errors, ...input } = settings;
      void sync_errors;
      const saved = await messengerPageApi.saveSettings(pageId, input);
      setSettings(saved);
      setSyncErrors(saved.sync_errors ?? []);
      show(saved.sync_errors?.length ? "Saved, but Messenger rejected part of it." : "Chat setup saved.", saved.sync_errors?.length ? "warning" : "success");
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

      <Section title="Welcome" hint="What people see before and right after they first open the chat.">
        <Textarea
          label="Greeting"
          placeholder="Hi! Ask us anything about our products."
          value={settings.greeting_text}
          onChange={(e) => set("greeting_text", e.target.value)}
          maxLength={160}
          showCharCount
          rows={2}
        />
        <Switch checked={settings.get_started.enabled} onChange={(enabled) => patch("get_started", { enabled })} label="Show a Get Started button" />
        {settings.get_started.enabled && (
          <Textarea
            label="First message after they tap it"
            value={settings.get_started.welcome_message}
            onChange={(e) => patch("get_started", { welcome_message: e.target.value })}
            maxLength={1000}
            rows={2}
          />
        )}
        <p className={styles.hint}>Starter questions people can tap instead of typing (up to 4).</p>
        {settings.ice_breakers.map((question, index) => (
          <div key={index} className={styles.row}>
            <Input
              aria-label={`Starter question ${index + 1}`}
              placeholder="e.g. What are your prices?"
              value={question}
              maxLength={80}
              onChange={(e) => set("ice_breakers", settings.ice_breakers.map((q, i) => (i === index ? e.target.value : q)))}
            />
            <button type="button" className={styles.iconButton} aria-label="Remove" onClick={() => set("ice_breakers", settings.ice_breakers.filter((_, i) => i !== index))}>✕</button>
          </div>
        ))}
        {settings.ice_breakers.length < 4 && (
          <div>
            <Button size="sm" variant="secondary" onClick={() => set("ice_breakers", [...settings.ice_breakers, ""])}>Add a starter question</Button>
          </div>
        )}
      </Section>

      <Section title="Menu" hint="Always available from the ☰ button in the chat.">
        <ActionListEditor
          items={settings.persistent_menu}
          onChange={(items) => set("persistent_menu", items)}
          max={5}
          addLabel="Add a menu item"
          exclude={["share_phone", "share_email"]}
        />
      </Section>

      <Section
        title="Suggested replies"
        hint="Tappable chips under each answer."
        right={<Switch checked={settings.quick_replies.enabled} onChange={(enabled) => patch("quick_replies", { enabled })} aria-label="Suggested replies" />}
      >
        {settings.quick_replies.enabled && (
          <ActionListEditor
            items={settings.quick_replies.items}
            onChange={(items) => patch("quick_replies", { items })}
            max={8}
            addLabel="Add a chip"
            exclude={["url"]}
          />
        )}
      </Section>

      <Section title="Instant answers" hint="When a message contains one of these words, send a fixed reply instead of asking the assistant.">
        {settings.keyword_flows.map((flow, index) => (
          <div key={flow.id ?? index} className={styles.itemCard}>
            <div className={styles.row}>
              <Input
                label="Words to match"
                placeholder="price, cost, how much"
                value={flow.keywords.join(", ")}
                onChange={(e) => setFlow(index, { keywords: e.target.value.split(",").map((word) => word.trimStart()) })}
              />
              <button type="button" className={styles.iconButton} aria-label="Remove" onClick={() => set("keyword_flows", settings.keyword_flows.filter((_, i) => i !== index))}>✕</button>
            </div>
            <Textarea label="Reply" value={flow.reply} onChange={(e) => setFlow(index, { reply: e.target.value })} maxLength={2000} rows={2} />
            <Select label="Then" value={flow.action} onChange={(e) => setFlow(index, { action: e.target.value as MessengerAction | "none" })}>
              <option value="none">Nothing else</option>
              {(["products", "human", "book", "whatsapp", "share_phone", "share_email"] as MessengerAction[]).map((action) => (
                <option key={action} value={action}>{ACTION_LABELS[action]}</option>
              ))}
            </Select>
          </div>
        ))}
        <div>
          <Button size="sm" variant="secondary" onClick={() => set("keyword_flows", [...settings.keyword_flows, { ...EMPTY_FLOW }])}>Add an instant answer</Button>
        </div>
      </Section>

      <Section
        title="Away hours"
        hint="Outside these hours, send one message and ask for a phone number or email."
        right={<Switch checked={settings.away.enabled} onChange={(enabled) => patch("away", { enabled })} aria-label="Away hours" />}
      >
        {settings.away.enabled && (
          <>
            <div className={styles.row}>
              <Input type="time" label="Open from" value={settings.away.start} onChange={(e) => patch("away", { start: e.target.value })} />
              <Input type="time" label="Until" value={settings.away.end} onChange={(e) => patch("away", { end: e.target.value })} />
              <Input label="Timezone" value={settings.away.timezone} onChange={(e) => patch("away", { timezone: e.target.value })} />
            </div>
            <div className={styles.dayRow}>
              {DAYS.map((day, index) => (
                <button
                  key={day}
                  type="button"
                  className={styles.chip}
                  data-active={settings.away.days.includes(index) || undefined}
                  onClick={() =>
                    patch("away", {
                      days: settings.away.days.includes(index) ? settings.away.days.filter((d) => d !== index) : [...settings.away.days, index],
                    })
                  }
                >
                  {day}
                </button>
              ))}
            </div>
            <Textarea label="Away message" value={settings.away.message} onChange={(e) => patch("away", { message: e.target.value })} maxLength={1000} rows={2} />
          </>
        )}
      </Section>

      <Section
        title="Follow-up before the window closes"
        hint="Messenger only lets you reply for 24 hours. Nudge people who went quiet before that runs out."
        right={<Switch checked={settings.nudge.enabled} onChange={(enabled) => patch("nudge", { enabled })} aria-label="Follow-up" />}
      >
        {settings.nudge.enabled && (
          <>
            <Input
              type="number"
              label="Hours after their last message"
              min={1}
              max={23}
              value={settings.nudge.after_hours}
              onChange={(e) => patch("nudge", { after_hours: Number(e.target.value) })}
            />
            <Textarea label="Message" value={settings.nudge.message} onChange={(e) => patch("nudge", { message: e.target.value })} maxLength={1000} rows={2} />
          </>
        )}
      </Section>

      <Section title="Your team" hint="How people and the assistant share a conversation.">
        <Switch checked={settings.hot_lead_alert.enabled} onChange={(enabled) => patch("hot_lead_alert", { enabled })} label="Alert me when a hot lead appears" />
        {settings.hot_lead_alert.enabled && (
          <Switch checked={settings.hot_lead_alert.telegram} onChange={(telegram) => patch("hot_lead_alert", { telegram })} label="Also send the alert to my connected Telegram" />
        )}
        <Switch
          checked={settings.handover.auto_pause_on_page_reply}
          onChange={(value) => patch("handover", { auto_pause_on_page_reply: value })}
          label="Pause the assistant when someone replies from Meta Business Suite"
        />
        <Switch
          checked={settings.handover.pass_to_page_inbox}
          onChange={(value) => patch("handover", { pass_to_page_inbox: value })}
          label="When a customer asks for a person, move the chat to Meta Business Suite"
        />
        <div className={styles.row}>
          <Input label="Name shown on human replies" placeholder="e.g. Priya from Support" value={settings.persona.name} onChange={(e) => patch("persona", { name: e.target.value })} />
          <Input label="Photo link" placeholder="https://…" value={settings.persona.picture_url} onChange={(e) => patch("persona", { picture_url: e.target.value })} />
        </div>
      </Section>

      <Section title="More" hint="Optional extras used by menu items, chips and instant answers.">
        <Input
          label="WhatsApp number"
          placeholder="+91 98765 43210"
          value={settings.whatsapp_number}
          onChange={(e) => set("whatsapp_number", e.target.value)}
          helperText="Used by “Continue on WhatsApp”."
        />
        <Input
          label="Appointment time slots"
          placeholder="10:00 AM, 12:00 PM, 3:00 PM"
          value={settings.booking.slots.join(", ")}
          onChange={(e) => patch("booking", { slots: e.target.value.split(",").map((slot) => slot.trimStart()) })}
          helperText="Offered by “Book an appointment”. Requests arrive as notifications for you to confirm."
        />
        <Switch checked={settings.understand_media} onChange={(value) => set("understand_media", value)} label="Let the assistant understand photos and voice notes" />
      </Section>

      <div>
        <Button onClick={save} isLoading={isSaving}>Save chat setup</Button>
      </div>
    </>
  );
}

export function ChatSetupTab({ pageId }: { pageId: string }) {
  return <ChatSetup pageId={pageId} />;
}
