"use client";

import { useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";
import { Button, Card, EmptyState, Input, Select, Skeleton, Switch, Textarea } from "@/components/ui";
import { ApiError, voiceCenterApi, type CallPolicy, type VoiceCapability } from "@/lib/api";
import { voiceRealtimeApi, type CostReport } from "@/lib/api/voice-realtime";
import { useToast } from "@/context/ToastContext";
import styles from "./VoiceCenter.module.scss";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIMEZONES = [
  "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney", "Europe/London", "Europe/Berlin",
  "Africa/Lagos", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Sao_Paulo", "UTC",
];

function Rule({ title, hint, enabled, onToggle, children }: {
  title: string; hint: string; enabled?: boolean; onToggle?: (value: boolean) => void; children?: ReactNode;
}) {
  return (
    <Card>
      <div className={styles.ruleHeader}>
        <div>
          <div className={styles.sectionTitle}>{title}</div>
          <div className={styles.sectionHint}>{hint}</div>
        </div>
        {onToggle && <Switch checked={Boolean(enabled)} onChange={onToggle} aria-label={title} />}
      </div>
      {(enabled ?? true) && children}
    </Card>
  );
}

function DayPicker({ value, onChange }: { value: number[]; onChange: (days: number[]) => void }) {
  return (
    <div className={styles.days} role="group" aria-label="Days">
      {DAYS.map((label, index) => {
        const isOn = value.includes(index);
        return (
          <button
            key={label}
            type="button"
            aria-pressed={isOn}
            className={clsx(styles.day, isOn && styles.dayOn)}
            onClick={() => onChange(isOn ? value.filter((day) => day !== index) : [...value, index].sort())}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

interface RulesTabProps {
  connected: boolean;
  capabilities: VoiceCapability[];
  providerName: string;
}

export function RulesTab({ connected, capabilities, providerName }: RulesTabProps) {
  const { show } = useToast();
  const [policy, setPolicy] = useState<CallPolicy | null>(null);
  const [saved, setSaved] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [costs, setCosts] = useState<CostReport | null>(null);

  useEffect(() => { voiceRealtimeApi.costs(30).then(setCosts).catch(() => {}); }, []);

  useEffect(() => {
    let canceled = false;
    voiceCenterApi.getPolicy()
      .then((value) => { if (!canceled) { setPolicy(value); setSaved(JSON.stringify(value)); setFailed(false); } })
      .catch(() => { if (!canceled) setFailed(true); });
    return () => { canceled = true; };
  }, [attempt]);

  if (!connected) {
    return <EmptyState title="Connect a phone number first" description="Call rules apply to your connected number. Set one up under Setup." />;
  }
  if (failed && !policy) {
    return (
      <EmptyState
        title="Couldn't load your call rules"
        description="Check your connection and try again."
        action={<Button onClick={() => { setFailed(false); setAttempt((value) => value + 1); }}>Try again</Button>}
      />
    );
  }
  if (!policy) return <Skeleton height={420} />;

  const can = (capability: VoiceCapability) => capabilities.includes(capability);
  const problems = [
    policy.business_hours_enabled && policy.business_days.length === 0 && "Choose at least one open day, or turn business hours off.",
    policy.business_hours_enabled && policy.business_open === policy.business_close && "Opening and closing time can't be the same.",
    policy.calling_window_enabled && policy.calling_days.length === 0 && "Choose at least one calling day, or turn calling hours off.",
    policy.calling_window_enabled && policy.calling_start === policy.calling_end && "Calling hours can't start and end at the same time.",
    policy.transfer_number && !/^\+[1-9]\d{7,14}$/.test(policy.transfer_number) && "The transfer number needs its country code, for example +919876543210.",
    !(policy.max_call_minutes >= 1 && policy.max_call_minutes <= 60) && "Longest call must be between 1 and 60 minutes.",
  ].filter(Boolean) as string[];

  const set = (patch: Partial<CallPolicy>) => setPolicy({ ...policy, ...patch });
  const isDirty = JSON.stringify(policy) !== saved;
  const zones = TIMEZONES.includes(policy.timezone) ? TIMEZONES : [policy.timezone, ...TIMEZONES];

  async function save() {
    if (!policy) return;
    setIsSaving(true);
    try {
      const value = await voiceCenterApi.savePolicy(policy);
      setPolicy(value);
      setSaved(JSON.stringify(value));
      show("Call rules saved. They apply from the next call.", "success");
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't save your rules. Nothing was changed; please try again.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={styles.stack}>
      <Card>
        <div className={styles.formGrid} style={{ marginTop: 0 }}>
          <Select label="Your timezone" value={policy.timezone} onChange={(e) => set({ timezone: e.target.value })}>
            {zones.map((zone) => <option key={zone} value={zone}>{zone.replace("_", " ")}</option>)}
          </Select>
          <Input
            label="Longest a call can run (minutes)"
            type="number" min={1} max={60}
            value={policy.max_call_minutes}
            onChange={(e) => set({ max_call_minutes: Math.round(Number(e.target.value)) || 0 })}
            errorText={policy.max_call_minutes >= 1 && policy.max_call_minutes <= 60 ? undefined : "Between 1 and 60"}
            helperText="The agent wraps up politely at the limit, so one call can't run up your bill."
          />
        </div>
      </Card>

      <Rule
        title="Business hours"
        hint="Decide what callers get when you're closed. Off means your agent answers the same way around the clock."
        enabled={policy.business_hours_enabled}
        onToggle={(value) => set({ business_hours_enabled: value })}
      >
        <div className={styles.formGrid}>
          <div className={styles.fullWidth}>
            <div className={styles.fieldLabel}>Open on</div>
            <DayPicker value={policy.business_days} onChange={(days) => set({ business_days: days })} />
          </div>
          <Input label="Opens" type="time" value={policy.business_open} onChange={(e) => set({ business_open: e.target.value })} />
          <Input label="Closes" type="time" value={policy.business_close} onChange={(e) => set({ business_close: e.target.value })} />
          <Select
            label="When closed"
            value={policy.after_hours_mode}
            onChange={(e) => set({ after_hours_mode: e.target.value as CallPolicy["after_hours_mode"] })}
          >
            <option value="take_message">Take a message for the team</option>
            <option value="ai_answers">Answer as usual</option>
          </Select>
          {policy.after_hours_mode === "take_message" && (
            <div className={styles.fullWidth}>
              <Textarea
                label="What the agent says when closed"
                value={policy.after_hours_message}
                onChange={(e) => set({ after_hours_message: e.target.value })}
                maxLength={600}
                helperText="The message lands in your follow-ups with the caller's name, reason and best time to call back."
              />
            </div>
          )}
        </div>
      </Rule>

      <Rule
        title="Hand off to a person"
        hint="When a caller asks for a human, or presses 0, the call is connected to this number. Your team member first hears who is calling and why. If nobody picks up, the agent takes a message instead."
      >
        <div className={styles.formGrid}>
          <Input
            label="Transfer calls to"
            type="tel"
            value={policy.transfer_number}
            onChange={(e) => set({ transfer_number: e.target.value.replace(/[\s\-()]/g, "") })}
            placeholder="+919876543210"
            helperText="Leave empty and the agent offers a callback instead."
            errorText={policy.transfer_number && !/^\+[1-9]\d{7,14}$/.test(policy.transfer_number) ? "Include the country code, for example +91" : undefined}
          />
          <div style={{ alignSelf: "center" }}>
            <Switch
              checked={policy.transfer_on_request}
              onChange={(value) => set({ transfer_on_request: value })}
              label="Transfer when the caller asks for a person"
            />
          </div>
        </div>
        <p className={styles.muted} style={{ marginTop: "var(--space-3)" }}>
          {can("whisper")
            ? "Your team member hears a short briefing before the caller is put through."
            : `On ${providerName} the caller is put through directly, without a briefing first.`}
          {can("live_transfer") ? " On real-time calls the agent tells the caller it is connecting them, then puts them through." : can("realtime") ? " On real-time streaming calls the agent offers a callback instead of transferring." : ""}
        </p>
      </Rule>

      <Rule
        title="Calling hours"
        hint="Outgoing calls are only placed inside this window. A call due outside it waits for the next opening. In India, promotional calls are allowed 9am to 9pm."
        enabled={policy.calling_window_enabled}
        onToggle={(value) => set({ calling_window_enabled: value })}
      >
        <div className={styles.formGrid}>
          <div className={styles.fullWidth}>
            <div className={styles.fieldLabel}>Call on</div>
            <DayPicker value={policy.calling_days} onChange={(days) => set({ calling_days: days })} />
          </div>
          <Input label="From" type="time" value={policy.calling_start} onChange={(e) => set({ calling_start: e.target.value })} />
          <Input label="Until" type="time" value={policy.calling_end} onChange={(e) => set({ calling_end: e.target.value })} />
        </div>
        {policy.local_time && <p className={styles.muted} style={{ marginTop: "var(--space-3)" }}>Your local time when this page loaded: {policy.local_time}</p>}
      </Rule>

      <Rule
        title="Voicemail"
        hint="Detects an answering machine on outgoing calls, so your agent doesn't hold a conversation with a recording."
        enabled={policy.voicemail_detection}
        onToggle={(value) => set({ voicemail_detection: value })}
      >
        <div className={styles.formGrid}>
          <div className={styles.fullWidth}>
            <Textarea
              label="Message to leave after the beep"
              value={policy.voicemail_message}
              onChange={(e) => set({ voicemail_message: e.target.value })}
              placeholder="Hi {name}, this is Asha from Bright Dental about your appointment. Please call us back on this number."
              helperText="Leave empty to hang up without a message. {name} is replaced with the contact's name."
              maxLength={600}
            />
          </div>
        </div>
      </Rule>

      <Rule
        title="Try again when nobody answers"
        hint="Unanswered and busy outgoing calls are redialled automatically, inside your calling hours."
        enabled={policy.retry_enabled}
        onToggle={(value) => set({ retry_enabled: value })}
      >
        <div className={styles.formGrid}>
          <Select label="Extra attempts" value={policy.retry_max_attempts} onChange={(e) => set({ retry_max_attempts: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
          <Select label="Wait between attempts" value={policy.retry_delay_minutes} onChange={(e) => set({ retry_delay_minutes: Number(e.target.value) })}>
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>1 hour</option>
            <option value={120}>2 hours</option>
            <option value={240}>4 hours</option>
            <option value={1440}>1 day</option>
          </Select>
          <div style={{ alignSelf: "center" }}>
            <Switch checked={policy.retry_on_voicemail} onChange={(value) => set({ retry_on_voicemail: value })} label="Also retry after voicemail" />
          </div>
        </div>
      </Rule>

      <Rule
        title="Text people you missed"
        hint="When a caller hangs up before speaking, they get this text from your number right away."
        enabled={policy.missed_call_text_enabled}
        onToggle={(value) => set({ missed_call_text_enabled: value })}
      >
        <div className={styles.formGrid}>
          <div className={styles.fullWidth}>
            <Textarea label="Message" value={policy.missed_call_text} onChange={(e) => set({ missed_call_text: e.target.value })} maxLength={320} showCharCount />
          </div>
        </div>
        {can("texts")
          ? <p className={styles.muted}>Your phone number must be able to send SMS. Your provider&apos;s message rates apply.</p>
          : <div className={styles.callout} style={{ marginTop: "var(--space-3)" }}>{providerName} can&apos;t send text messages, so this won&apos;t be sent. It needs Plivo, Twilio, Telnyx or SignalWire.</div>}
      </Rule>

      <Rule
        title="Text a recap after each conversation"
        hint="Sends the caller a short summary of what was agreed."
        enabled={policy.post_call_text_enabled}
        onToggle={(value) => set({ post_call_text_enabled: value })}
      >
        <div className={styles.formGrid}>
          <div className={styles.fullWidth}>
            <Textarea
              label="Message"
              value={policy.post_call_text}
              onChange={(e) => set({ post_call_text: e.target.value })}
              helperText="{outcome} is replaced with a one-line summary of the call, {name} with the caller's name."
              maxLength={320}
              showCharCount
            />
          </div>
        </div>
        {!can("texts") && <div className={styles.callout} style={{ marginTop: "var(--space-3)" }}>{providerName} can&apos;t send text messages, so this won&apos;t be sent.</div>}
      </Rule>

      <Rule
        title="Say it's an AI"
        hint="Spoken before the greeting on every call. Many regions require telling people they are talking to an AI or being recorded."
        enabled={policy.disclosure_enabled}
        onToggle={(value) => set({ disclosure_enabled: value })}
      >
        <div className={styles.formGrid}>
          <div className={styles.fullWidth}>
            <Input label="Disclosure" value={policy.disclosure_text} onChange={(e) => set({ disclosure_text: e.target.value })} maxLength={300} />
          </div>
        </div>
      </Rule>

      <Card>
        <div className={styles.stack}>
          <div className={styles.ruleHeader}>
            <div>
              <div className={styles.sectionTitle}>Call back when asked</div>
              <div className={styles.sectionHint}>If someone says &quot;call me tomorrow at 5&quot;, the call is scheduled for that time automatically.</div>
            </div>
            <Switch checked={policy.auto_callback_enabled} onChange={(value) => set({ auto_callback_enabled: value })} aria-label="Call back when asked" />
          </div>
          <div className={styles.ruleHeader}>
            <div>
              <div className={styles.sectionTitle}>Remember returning callers</div>
              <div className={styles.sectionHint}>Your agent knows how the last conversation with this number ended, so nobody has to repeat themselves.</div>
            </div>
            <Switch checked={policy.remember_callers} onChange={(value) => set({ remember_callers: value })} aria-label="Remember returning callers" />
          </div>
        </div>
      </Card>

      <Card>
        <div className={styles.stack}>
          <div className={styles.ruleHeader}>
            <div>
              <div className={styles.sectionTitle}>Ring back people who didn&apos;t get help</div>
              <div className={styles.sectionHint}>Someone who rang and hung up before saying why, or left with a question nobody answered, is a lead going cold. The agent rings them back inside your calling hours, knowing what happened, and never a number on your do-not-call list.</div>
            </div>
          </div>
          <div className={styles.ruleHeader}>
            <div className={styles.sectionHint}>Callers who hung up before saying why</div>
            <Switch checked={policy.callback_dropped_enabled} onChange={(value) => set({ callback_dropped_enabled: value })} aria-label="Ring back callers who hung up" />
          </div>
          <div className={styles.ruleHeader}>
            <div className={styles.sectionHint}>Callers who left without an answer</div>
            <Switch checked={policy.callback_unresolved_enabled} onChange={(value) => set({ callback_unresolved_enabled: value })} aria-label="Ring back callers who left without an answer" />
          </div>
          {(policy.callback_dropped_enabled || policy.callback_unresolved_enabled) && (
            <div className={styles.formGrid}>
              <Select label="Ring back after" value={policy.callback_delay_minutes} onChange={(e) => set({ callback_delay_minutes: Number(e.target.value) })}>
                <option value={5}>5 minutes</option><option value={15}>15 minutes</option><option value={60}>1 hour</option><option value={240}>4 hours</option><option value={1440}>1 day</option>
              </Select>
              <Select label="At most, per number per day" value={policy.callback_daily_limit} onChange={(e) => set({ callback_daily_limit: Number(e.target.value) })}>
                <option value={1}>1 call</option><option value={2}>2 calls</option><option value={3}>3 calls</option>
              </Select>
            </div>
          )}
        </div>
      </Card>

      <Rule
        title="WhatsApp recap after each conversation"
        hint="Sends the caller the outcome on WhatsApp. Someone who phoned has not messaged you there, so WhatsApp only allows an approved template to start the chat."
        enabled={policy.post_call_whatsapp_enabled}
        onToggle={(value) => set({ post_call_whatsapp_enabled: value })}
      >
        <div className={styles.formGrid}>
          <div className={styles.fullWidth}>
            <Input
              label="Approved template name"
              value={policy.post_call_whatsapp_template}
              onChange={(e) => set({ post_call_whatsapp_template: e.target.value })}
              helperText="Its text takes up to two variables: {{1}} is the caller's name, {{2}} is a one-line summary. Create and approve it under WhatsApp templates."
              maxLength={80}
            />
          </div>
        </div>
      </Rule>

      <Card>
        <div className={styles.stack}>
          <div className={styles.sectionTitle}>Protect the people you call</div>
          <div className={styles.ruleHeader}>
            <div>
              <div className={styles.sectionHint}>Respect calling hours where the person is, not only where you are. A call to California at 6pm Mumbai time is 5:30am there. For countries with several timezones, a call is placed only when the hours hold in all of them.</div>
            </div>
            <Switch checked={policy.callee_local_window} onChange={(value) => set({ callee_local_window: value })} aria-label="Respect the other person's local calling hours" />
          </div>
          <div className={styles.ruleHeader}>
            <div>
              <div className={styles.sectionHint}>Always say so when a call is being recorded, even if you have not set an AI notice above.</div>
            </div>
            <Switch checked={policy.enforce_recording_notice} onChange={(value) => set({ enforce_recording_notice: value })} aria-label="Always announce recording" />
          </div>
          <p className={styles.muted}>These are sensible defaults, not legal advice. Telemarketing and recording rules differ by country and state; to scrub a do-not-disturb registry, import its numbers under Do not call.</p>
        </div>
      </Card>

      <Card>
        <div className={styles.stack}>
          <div>
            <div className={styles.sectionTitle}>Where the agent may call</div>
            <div className={styles.sectionHint}>
              By default the agent only calls numbers in the same country as your own phone number. Calling abroad is how stolen accounts run up phone bills, so it is something you turn on. Premium-rate and satellite numbers are never dialled.
            </div>
          </div>
          <div className={styles.formGrid}>
            <Input
              label="Allowed countries (two-letter codes, comma separated)"
              placeholder="e.g. IN, US, GB"
              value={(policy.allowed_countries ?? []).join(", ")}
              onChange={(e) =>
                set({
                  allowed_countries: e.target.value
                    .split(/[\s,]+/)
                    .map((code) => code.trim().toUpperCase())
                    .filter((code) => /^[A-Z]{2}$/.test(code))
                    .slice(0, 40),
                })
              }
              helperText={(policy.allowed_countries ?? []).length ? "Only these countries. Add your own country's code too if you still call it." : "Empty: only your own country."}
            />
            <Input label="Most outgoing calls in 24 hours" type="number" min={1} max={5000} value={policy.outbound_daily_cap ?? 300} onChange={(e) => set({ outbound_daily_cap: Math.min(5000, Math.max(1, Number(e.target.value) || 300)) })} />
          </div>
        </div>
      </Card>

      <Card>
        <div className={styles.stack}>
          <div>
            <div className={styles.sectionTitle}>Spending limit</div>
            <div className={styles.sectionHint}>
              An estimate, not your invoice: minutes times per-minute rates for the phone line and the AI. At the limit, new outgoing calls pause, and new real-time calls move to the free engine where it speaks the language. You are told at the alert and at the limit.
            </div>
          </div>
          <div className={styles.formGrid}>
            <Input label="Monthly limit (₹, 0 = none)" type="number" min={0} value={policy.monthly_cost_cap} onChange={(e) => set({ monthly_cost_cap: Math.max(0, Number(e.target.value) || 0) })} />
            <Select label="Warn me at" value={policy.cost_alert_percent} onChange={(e) => set({ cost_alert_percent: Number(e.target.value) })}>
              <option value={50}>50%</option><option value={70}>70%</option><option value={80}>80%</option><option value={90}>90%</option>
            </Select>
          </div>
          {costs && (
            <p className={styles.muted}>
              This month so far: about ₹{Math.round(costs.month.spent).toLocaleString("en-IN")}
              {costs.month.cap ? ` of ₹${costs.month.cap.toLocaleString("en-IN")} (${costs.month.percent}%)` : ""}.
              {costs.by_engine.length > 0 && ` Last 30 days: ${costs.by_engine.map((row) => `${row.engine.replace("_", " ")} ₹${Math.round(row.total)}`).join(", ")}.`}
              {" "}Rates are set on the server from your own bills.
            </p>
          )}
        </div>
      </Card>

      <Rule
        title="Text voicemails to the right desk"
        hint="When someone leaves a message after hours, the owner is notified. With this on, the desk it belongs to (set under Departments) is also texted a short summary, so it does not wait for someone to open the dashboard."
        enabled={policy.voicemail_route_text}
        onToggle={(value) => set({ voicemail_route_text: value })}
      >
        {!can("texts") && <div className={styles.callout}>{providerName} can&apos;t send text messages, so desks will not be texted.</div>}
      </Rule>

      <Rule
        title="Stop abuse and spam calls"
        hint="A caller who keeps swearing is warned once, then the call ends. A recording or an automated menu that calls you is ended at once. A number that rings over and over is not answered. Real anger about a problem never ends a call."
        enabled={policy.abuse_guard}
        onToggle={(value) => set({ abuse_guard: value })}
      >
        <div className={styles.formGrid}>
          <Select label="Don't answer a number that has rung" value={policy.inbound_rate_limit} onChange={(e) => set({ inbound_rate_limit: Number(e.target.value) })}>
            {[3, 5, 8, 12, 20].map((count) => <option key={count} value={count}>{count} times in 10 minutes</option>)}
          </Select>
        </div>
      </Rule>

      {isDirty && (
        <div className={styles.saveBar} role="status">
          <span className={styles.muted} style={{ flex: 1 }}>{problems[0] ?? "You have unsaved changes"}</span>
          <Button variant="ghost" onClick={() => setPolicy(JSON.parse(saved) as CallPolicy)} disabled={isSaving}>Discard</Button>
          <Button onClick={save} isLoading={isSaving} disabled={problems.length > 0}>Save rules</Button>
        </div>
      )}
    </div>
  );
}
