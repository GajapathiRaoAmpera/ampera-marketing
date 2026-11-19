"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  WEEK_DAYS,
  whatsappStudioApi,
  type WeekDay,
  type WhatsAppAutomation,
  type WhatsAppAutomationChange,
  type WhatsAppBusinessProfile,
  type WhatsAppSettings,
} from "@/lib/api/whatsapp-studio";
import { useToast } from "@/context/ToastContext";
import { Button, InfoLabel, Input, Select, Skeleton, Switch, Textarea } from "@/components/ui";
import { IconTile } from "@/components/ui/Icon/Icon";
import styles from "../../instagram/workspace/workspace.module.scss";
import local from "./whatsapp.module.scss";

const DAY_LABEL: Record<WeekDay, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
const ZONES = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "America/New_York", "America/Los_Angeles", "Australia/Sydney", "UTC"];

function errorText(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.userMessage : fallback;
}

/** Saves a piece of automation and hands the fresh settings back. */
function useAutomationSave(businessId: string, onChanged: (next: WhatsAppSettings) => void) {
  const { show } = useToast();
  const [saving, setSaving] = useState(false);
  async function save(change: WhatsAppAutomationChange, done: string) {
    setSaving(true);
    try {
      onChanged(await whatsappStudioApi.updateSettings(businessId, { automation: change }));
      show(done, "success");
      return true;
    } catch (error) {
      show(errorText(error, "Couldn't save that."), "error");
      return false;
    } finally {
      setSaving(false);
    }
  }
  return { saving, save };
}

interface CardProps {
  businessId: string;
  settings: WhatsAppSettings;
  canAdmin: boolean;
  onChanged: (next: WhatsAppSettings) => void;
}

/** When you're open, and what customers hear when you're not. */
export function HoursCard({ businessId, settings, canAdmin, onChanged }: CardProps) {
  const { saving, save } = useAutomationSave(businessId, onChanged);
  const stored = settings.automation.hours;
  const [days, setDays] = useState(stored.days);
  const [zone, setZone] = useState(stored.timezone);
  const dirty = JSON.stringify(days) !== JSON.stringify(stored.days) || zone !== stored.timezone;

  function setDay(day: WeekDay, range: [string, string] | null) {
    setDays((current) => ({ ...current, [day]: range ? [range] : [] }));
  }

  function copyMondayToWeekdays() {
    setDays((current) => ({ ...current, tue: current.mon, wed: current.mon, thu: current.mon, fri: current.mon }));
  }

  const invalid = WEEK_DAYS.find((day) => days[day]?.[0] && days[day][0][0] >= days[day][0][1]);

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <h3 className={styles.titleWithIcon}>
            <IconTile name="clock" tone="amber" size="sm" /> Business hours
          </h3>
          <p>Tell customers when you&apos;re open. Outside these hours the away message below goes out, and menus and the AI keep working as usual.</p>
        </div>
        <span className={`${styles.pill} ${stored.enabled ? styles.pillOn : styles.pillOff}`}>
          <i aria-hidden /> {stored.enabled ? "ON" : "OFF"}
        </span>
      </div>
      <div className={styles.settingRow}>
        <div>
          <strong>Use opening hours</strong>
          <p>{stored.enabled ? "Customers who message while you're closed get your away message." : "Off: you count as always open."}</p>
        </div>
        <Switch
          checked={stored.enabled}
          disabled={!canAdmin || saving}
          onChange={(value) => void save({ hours: { enabled: value, days, timezone: zone } }, value ? "Opening hours are on." : "Opening hours are off.")}
          aria-label="Use opening hours"
        />
      </div>
      <div className={local.hoursGrid}>
        {WEEK_DAYS.map((day) => {
          const range = days[day]?.[0] ?? null;
          return (
            <div key={day} className={local.hoursRow}>
              <label className={local.dayToggle}>
                <input type="checkbox" checked={Boolean(range)} disabled={!canAdmin} onChange={(event) => setDay(day, event.target.checked ? ["10:00", "19:00"] : null)} />
                <strong>{DAY_LABEL[day]}</strong>
              </label>
              {range ? (
                <span className={local.timeRange}>
                  <input type="time" value={range[0]} disabled={!canAdmin} aria-label={`${DAY_LABEL[day]} opens`} onChange={(event) => setDay(day, [event.target.value, range[1]])} />
                  <span>to</span>
                  <input type="time" value={range[1]} disabled={!canAdmin} aria-label={`${DAY_LABEL[day]} closes`} onChange={(event) => setDay(day, [range[0], event.target.value])} />
                </span>
              ) : (
                <span className={styles.muted}>Closed</span>
              )}
            </div>
          );
        })}
      </div>
      <div className={local.stackForm}>
        <Select label="Time zone" value={zone} disabled={!canAdmin} onChange={(event) => setZone(event.target.value)}>
          {(ZONES.includes(zone) ? ZONES : [zone, ...ZONES]).map((item) => (
            <option key={item} value={item}>{item.replace(/_/g, " ")}</option>
          ))}
        </Select>
      </div>
      {invalid && <p className={styles.warning}>On {DAY_LABEL[invalid]}, closing time must be after opening time.</p>}
      {canAdmin && (
        <div className={styles.rowActions}>
          <Button variant="secondary" onClick={copyMondayToWeekdays}>Copy Monday to Tue–Fri</Button>
          <Button isLoading={saving} disabled={!dirty || Boolean(invalid)} onClick={() => void save({ hours: { days, timezone: zone } }, "Opening hours saved.")}>
            Save hours
          </Button>
        </div>
      )}
    </section>
  );
}

function MessageCard({
  businessId, settings, canAdmin, onChanged, section, title, tone, icon, intro, switchLabel, onText, offText, warning,
}: CardProps & {
  section: "away" | "missed_call";
  title: string;
  tone: "violet" | "red";
  icon: "shield" | "phone";
  intro: string;
  switchLabel: string;
  onText: string;
  offText: string;
  warning?: string | null;
}) {
  const { saving, save } = useAutomationSave(businessId, onChanged);
  const stored = settings.automation[section];
  const [message, setMessage] = useState(stored.message);
  const dirty = message.trim() !== stored.message;

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <h3 className={styles.titleWithIcon}>
            <IconTile name={icon} tone={tone} size="sm" /> {title}
          </h3>
          <p>{intro}</p>
        </div>
        <span className={`${styles.pill} ${stored.enabled ? styles.pillOn : styles.pillOff}`}>
          <i aria-hidden /> {stored.enabled ? "ON" : "OFF"}
        </span>
      </div>
      <div className={styles.settingRow}>
        <div>
          <strong>{switchLabel}</strong>
          <p>{stored.enabled ? onText : offText}</p>
        </div>
        <Switch
          checked={stored.enabled}
          disabled={!canAdmin || saving}
          onChange={(value) => void save({ [section]: { enabled: value, message: message.trim() || stored.message } }, value ? `${title} is on.` : `${title} is off.`)}
          aria-label={switchLabel}
        />
      </div>
      {warning && <p className={styles.warning}>{warning}</p>}
      <Textarea label="Message" rows={3} maxLength={1000} value={message} disabled={!canAdmin} onChange={(event) => setMessage(event.target.value)} />
      {canAdmin && (
        <div className={styles.rowActions}>
          <Button isLoading={saving} disabled={!dirty || !message.trim()} onClick={() => void save({ [section]: { message: message.trim() } }, "Message saved.")}>
            Save message
          </Button>
        </div>
      )}
    </section>
  );
}

export function AwayCard(props: CardProps) {
  const hoursOn = props.settings.automation.hours.enabled;
  return (
    <MessageCard
      {...props}
      section="away"
      title="Away message"
      tone="violet"
      icon="shield"
      intro="Sent when someone messages while you're closed. Each customer gets it at most once every 12 hours."
      switchLabel="Send an away message"
      onText="Customers who write outside your hours get this."
      offText="Off: nothing is sent when you're closed."
      warning={props.settings.automation.away.enabled && !hoursOn ? "Turn on business hours above, or this never sends (without hours you count as always open)." : null}
    />
  );
}

export function MissedCallCard(props: CardProps) {
  return (
    <MessageCard
      {...props}
      section="missed_call"
      title="Missed-call reply"
      tone="red"
      icon="phone"
      intro="If a customer calls you on WhatsApp and you can't pick up, they get this in the chat, and the missed call shows in your inbox."
      switchLabel="Reply to missed calls"
      onText="They'll get this message right after a missed call."
      offText="Off: missed calls are only logged."
    />
  );
}

/** Messages about orders and how payment works. */
export function OrderMessagesCard({ businessId, settings, canAdmin, onChanged }: CardProps) {
  const { saving, save } = useAutomationSave(businessId, onChanged);
  const automation: WhatsAppAutomation = settings.automation;
  const reminder = automation.cart_reminder;
  const [reminderText, setReminderText] = useState(reminder.message);
  const [minutes, setMinutes] = useState(String(reminder.after_minutes));
  const [configuration, setConfiguration] = useState(automation.payment_configuration ?? "");
  const reminderDirty = reminderText.trim() !== reminder.message || Number(minutes) !== reminder.after_minutes;

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <h3 className={styles.titleWithIcon}>
            <IconTile name="box" tone="green" size="sm" /> Order messages
          </h3>
          <p>What customers hear about their order, without you typing it each time.</p>
        </div>
      </div>
      <div className={styles.settingRow}>
        <div>
          <strong>Tell customers when their order moves</strong>
          <p>A message when you start packing, ship (with the tracking number you enter) and deliver. Sent while WhatsApp still allows a free message; otherwise the order notes it.</p>
        </div>
        <Switch
          checked={automation.order_updates.enabled}
          disabled={!canAdmin || saving}
          onChange={(value) => void save({ order_updates: { enabled: value } }, value ? "Order updates are on." : "Order updates are off.")}
          aria-label="Order updates"
        />
      </div>
      <div className={styles.settingRow}>
        <div>
          <strong>Remind customers about unpaid orders</strong>
          <p>One gentle reminder with the pay link, if an order is still unpaid after the time below.</p>
        </div>
        <Switch
          checked={reminder.enabled}
          disabled={!canAdmin || saving}
          onChange={(value) => void save({ cart_reminder: { enabled: value } }, value ? "Reminders are on." : "Reminders are off.")}
          aria-label="Unpaid order reminders"
        />
      </div>
      {reminder.enabled && (
        <div className={local.stackForm}>
          <Input label="Remind after (minutes)" type="number" min={15} max={1380} value={minutes} disabled={!canAdmin} onChange={(event) => setMinutes(event.target.value)} helperText="Between 15 minutes and 23 hours." />
          <Textarea label="Reminder message" rows={2} maxLength={1000} value={reminderText} disabled={!canAdmin} onChange={(event) => setReminderText(event.target.value)} />
          {canAdmin && (
            <div className={styles.rowActions}>
              <Button
                isLoading={saving}
                disabled={!reminderDirty || !reminderText.trim() || Number(minutes) < 15 || Number(minutes) > 1380}
                onClick={() => void save({ cart_reminder: { message: reminderText.trim(), after_minutes: Number(minutes) } }, "Reminder saved.")}
              >
                Save reminder
              </Button>
            </div>
          )}
        </div>
      )}
      <div className={local.stackForm}>
        <Input
          label={<InfoLabel help="For India: if you've set up WhatsApp payments in WhatsApp Manager, enter the payment configuration name here. Customers then pay inside the chat. Leave empty to keep using the UPI pay link.">In-chat payment (optional)</InfoLabel>}
          value={configuration}
          disabled={!canAdmin}
          maxLength={60}
          onChange={(event) => setConfiguration(event.target.value)}
          placeholder="Payment configuration name"
          helperText={automation.payment_configuration ? "Customers pay inside WhatsApp. If it can't be sent, they get the pay link instead." : "Not set: customers get a UPI pay link."}
        />
        {canAdmin && (
          <div className={styles.rowActions}>
            <Button isLoading={saving} disabled={configuration.trim() === (automation.payment_configuration ?? "")} onClick={() => void save({ payment_configuration: configuration.trim() }, configuration.trim() ? "In-chat payment is on." : "In-chat payment is off.")}>
              Save
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

/** How the business looks to customers inside WhatsApp. */
export function ProfileCard({ businessId, canAdmin }: { businessId: string; canAdmin: boolean }) {
  const { show } = useToast();
  const [profile, setProfile] = useState<WhatsAppBusinessProfile | null>(null);
  const [verticals, setVerticals] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState<WhatsAppBusinessProfile>({});
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function apply(result: { profile: WhatsAppBusinessProfile; verticals?: string[] }) {
    setProfile(result.profile);
    setDraft(result.profile);
    if (result.verticals) setVerticals(result.verticals);
  }

  useEffect(() => {
    let cancelled = false;
    whatsappStudioApi
      .profile(businessId)
      .then((result) => !cancelled && apply(result))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const dirty = profile !== null && (["about", "description", "address", "email", "vertical"] as const).some((key) => (draft[key] ?? "") !== (profile[key] ?? "")) || (draft.websites ?? []).join() !== (profile?.websites ?? []).join();

  async function saveProfile() {
    setSaving(true);
    try {
      apply(await whatsappStudioApi.updateProfile(businessId, { about: draft.about ?? "", description: draft.description ?? "", address: draft.address ?? "", email: draft.email ?? "", websites: draft.websites ?? [], vertical: draft.vertical || undefined }));
      show("Your WhatsApp profile is updated.", "success");
    } catch (error) {
      show(errorText(error, "Couldn't update your profile."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhoto(file?: File) {
    if (!file) return;
    setSaving(true);
    try {
      const result = await whatsappStudioApi.uploadProfilePhoto(businessId, file);
      setProfile(result.profile);
      show("Photo updated. It can take a few minutes to show in WhatsApp.", "success");
    } catch (error) {
      show(errorText(error, "Couldn't upload that photo."), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <h3 className={styles.titleWithIcon}>
            <IconTile name="user" tone="blue" size="sm" /> Business profile
          </h3>
          <p>What customers see when they tap your name in WhatsApp. Changes go straight to WhatsApp.</p>
        </div>
      </div>
      {failed ? (
        <p className={styles.muted}>Couldn&apos;t load your profile from WhatsApp. Reconnect your number in Settings and try again.</p>
      ) : !profile ? (
        <Skeleton height={160} />
      ) : (
        <>
          <div className={local.profilePhoto}>
            {profile.profile_picture_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.profile_picture_url} alt="Your WhatsApp profile photo" />
            ) : (
              <span aria-hidden>🏪</span>
            )}
            <div>
              <strong>Profile photo</strong>
              <p className={styles.muted}>A square JPG or PNG, up to 5 MB. Your logo works well.</p>
              {canAdmin && (
                <>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png" className={local.hiddenFile} onChange={(event) => { void uploadPhoto(event.target.files?.[0]); event.currentTarget.value = ""; }} />
                  <Button variant="secondary" size="sm" isLoading={saving} onClick={() => fileRef.current?.click()}>Change photo</Button>
                </>
              )}
            </div>
          </div>
          <div className={local.profileForm}>
            <Input label="About (shown under your name)" value={draft.about ?? ""} maxLength={139} disabled={!canAdmin} onChange={(event) => setDraft({ ...draft, about: event.target.value })} helperText={`${(draft.about ?? "").length}/139`} />
            <Textarea label="Description" rows={3} maxLength={512} value={draft.description ?? ""} disabled={!canAdmin} onChange={(event) => setDraft({ ...draft, description: event.target.value })} helperText="What you sell or do." />
            <Input label="Address" value={draft.address ?? ""} maxLength={256} disabled={!canAdmin} onChange={(event) => setDraft({ ...draft, address: event.target.value })} />
            <Input label="Email" type="email" value={draft.email ?? ""} disabled={!canAdmin} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
            <Input label="Website" type="url" value={(draft.websites ?? [])[0] ?? ""} disabled={!canAdmin} placeholder="https://yourshop.com" onChange={(event) => setDraft({ ...draft, websites: event.target.value ? [event.target.value] : [] })} />
            <Select label="Category" value={draft.vertical ?? "UNDEFINED"} disabled={!canAdmin} onChange={(event) => setDraft({ ...draft, vertical: event.target.value })}>
              {verticals.map((item) => (
                <option key={item} value={item}>{item.replace(/_/g, " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase())}</option>
              ))}
            </Select>
          </div>
          {canAdmin && (
            <div className={styles.rowActions}>
              <Button isLoading={saving} disabled={!dirty} onClick={() => void saveProfile()}>Save profile</Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Let customers call the number from WhatsApp. */
export function CallingCard({ businessId, canAdmin }: { businessId: string; canAdmin: boolean }) {
  const { show } = useToast();
  const [state, setState] = useState<{ available: boolean; enabled: boolean; show_call_button: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    whatsappStudioApi
      .calling(businessId)
      .then((result) => !cancelled && setState(result))
      .catch(() => !cancelled && setState({ available: false, enabled: false, show_call_button: false }));
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  async function change(next: { enabled: boolean; show_call_button?: boolean }) {
    setSaving(true);
    try {
      setState(await whatsappStudioApi.updateCalling(businessId, next));
      show(next.enabled ? "Customers can now call you on WhatsApp." : "Calling is off.", "success");
    } catch (error) {
      show(errorText(error, "Couldn't change calling."), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <h3 className={styles.titleWithIcon}>
            <IconTile name="phone" tone="teal" size="sm" /> Calls on WhatsApp
          </h3>
          <p>Customers tap a call button in the chat to phone you for free over the internet. Missed calls get your missed-call reply and show in your inbox.</p>
        </div>
        {state?.available && (
          <span className={`${styles.pill} ${state.enabled ? styles.pillOn : styles.pillOff}`}>
            <i aria-hidden /> {state.enabled ? "ON" : "OFF"}
          </span>
        )}
      </div>
      {state === null ? (
        <Skeleton height={60} />
      ) : !state.available ? (
        <p className={styles.muted}>Calling isn&apos;t available for this number yet. Meta is rolling it out by country and account.</p>
      ) : (
        <>
          <div className={styles.settingRow}>
            <div>
              <strong>Allow calls</strong>
              <p>Answer them on your own WhatsApp Business app or the team phone. This app logs missed calls.</p>
            </div>
            <Switch checked={state.enabled} disabled={!canAdmin || saving} onChange={(value) => void change({ enabled: value, show_call_button: state.show_call_button })} aria-label="Allow calls" />
          </div>
          {state.enabled && (
            <label className={styles.checkOption}>
              <input type="checkbox" checked={state.show_call_button} disabled={!canAdmin || saving} onChange={(event) => void change({ enabled: true, show_call_button: event.target.checked })} />
              <span>
                <strong>Show the call button in chats</strong>
                <small>Untick to take calls only from links you share.</small>
              </span>
            </label>
          )}
        </>
      )}
    </section>
  );
}
