"use client";

import { useEffect, useState } from "react";
import { copyText } from "@/lib/utils/browser";
import { agentApi, ApiError, type WidgetBehaviour, type WidgetLeadField } from "@/lib/api";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import { useToast } from "@/context/ToastContext";
import { Button, Card, EmptyState, Input, Select, Skeleton, Switch, Textarea } from "@/components/ui";
import { WidgetIcon } from "@/components/layout/icons";
import { WidgetTemplateGallery } from "@/components/features/widget/WidgetTemplateGallery";
import { WidgetPlaygroundCard } from "@/components/features/widget/WidgetPlayground";
import { WidgetVisitors } from "@/components/features/widget/WidgetVisitors";
import { ChannelWorkspace, type WorkspacePill } from "@/components/features/channels/workspace/ChannelWorkspace";
import hubStyles from "@/components/features/messenger/Messenger.module.scss";
import styles from "./page.module.scss";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

const THEMES = [
  { value: "auto", label: "Match the visitor's device" },
  { value: "light", label: "Always light" },
  { value: "dark", label: "Always dark" },
];

const POSITIONS = [
  { value: "bottom-right", label: "Bottom right" },
  { value: "bottom-left", label: "Bottom left" },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LEAD_FIELDS: { value: WidgetLeadField; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
];

// Mirrors WIDGET_DEFAULTS in the backend's chat_widget.py.
const DEFAULT_BEHAVIOUR: WidgetBehaviour = {
  widget_lead_form: { enabled: false, title: "Before we start, how can we reach you?", fields: ["name", "email"], required: false },
  widget_quick_replies: [],
  widget_proactive: { enabled: false, delay_seconds: 8, message: "Hi! Need any help? Ask me anything." },
  widget_allowed_domains: [],
  widget_away: {
    enabled: false,
    timezone: "Asia/Kolkata",
    start: "09:00",
    end: "19:00",
    days: [0, 1, 2, 3, 4, 5],
    message: "Thanks for your message. We're away right now. Leave your details and we'll get back to you.",
  },
};

export default function WidgetChannelPage() {
  const { business, businessId, isLoading, hasNoBusinesses } = useActiveBusiness();
  const { show } = useToast();

  const [form, setForm] = useState({
    widget_greeting: "",
    widget_color: "#bc953a",
    widget_position: "bottom-right",
    widget_template: "bubble",
    widget_theme: "auto",
    widget_launcher_label: "",
    widget_subtitle: "",
  });
  const [behaviour, setBehaviour] = useState<WidgetBehaviour>(DEFAULT_BEHAVIOUR);
  const [domainsText, setDomainsText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const agentId = business?.agent_id as string | undefined;

  useEffect(() => {
    if (!agentId) return;
    agentApi
      .get(agentId)
      .then((agent) => {
        setForm({
          widget_greeting: agent.widget_greeting ?? `Hi! How can I help you today?`,
          widget_color: agent.widget_color ?? "#bc953a",
          widget_position: agent.widget_position ?? "bottom-right",
          widget_template: agent.widget_template ?? "bubble",
          widget_theme: agent.widget_theme ?? "auto",
          widget_launcher_label: agent.widget_launcher_label ?? "",
          widget_subtitle: agent.widget_subtitle ?? "",
        });
        setBehaviour({
          widget_lead_form: { ...DEFAULT_BEHAVIOUR.widget_lead_form, ...agent.widget_lead_form },
          widget_quick_replies: agent.widget_quick_replies ?? [],
          widget_proactive: { ...DEFAULT_BEHAVIOUR.widget_proactive, ...agent.widget_proactive },
          widget_allowed_domains: agent.widget_allowed_domains ?? [],
          widget_away: { ...DEFAULT_BEHAVIOUR.widget_away, ...agent.widget_away },
        });
        setDomainsText((agent.widget_allowed_domains ?? []).join("\n"));
      })
      .catch(() => {
        // Keep defaults on failure. The form is still usable, save will just
        // start from these defaults instead of any prior saved values.
      });
  }, [agentId]);

  async function handleSave() {
    if (!agentId) return;
    setIsSaving(true);
    try {
      await agentApi.updateWidget(agentId, {
        ...form,
        ...behaviour,
        widget_quick_replies: behaviour.widget_quick_replies.map((item) => item.trim()).filter(Boolean),
        widget_allowed_domains: domainsText.split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
      });
      show("Widget settings saved. Reload the test preview to see the changes.", "success");
    } catch (err) {
      const message = err instanceof ApiError ? err.userMessage : "Couldn't save. Please try again.";
      show(message, "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await copyText(text);
      show("Embed code copied to clipboard.", "default");
    } catch {
      show("Couldn't copy, please select and copy manually.", "error");
    }
  }

  if (isLoading) return <Skeleton height={400} />;
  if (hasNoBusinesses || !businessId || !agentId) {
    return (
      <EmptyState
        title="Create a business first"
        description="You'll need a business (with its AI agent) set up before you can embed a chat widget."
      />
    );
  }

  const lead = behaviour.widget_lead_form;
  const nudge = behaviour.widget_proactive;
  const away = behaviour.widget_away;
  const patch = <K extends keyof WidgetBehaviour>(key: K, value: Partial<WidgetBehaviour[K]>) =>
    setBehaviour((current) => ({ ...current, [key]: { ...(current[key] as object), ...(value as object) } }));

  // One line: the widget reads its settings from the server each time it
  // loads, so changes saved here show up without touching the website again.
  const embedSnippet = `<script src="${API_BASE}/widget/script/${agentId}" async></script>`;

  // What is on screen now, in the widget script's own setting names, so the
  // preview shows edits before they are saved.
  const preview = {
    template: form.widget_template,
    primaryColor: /^#[0-9a-fA-F]{6}$/.test(form.widget_color) ? form.widget_color : "#bc953a",
    position: form.widget_position,
    greeting: form.widget_greeting,
    theme: form.widget_theme,
    launcherLabel: form.widget_launcher_label,
    subtitle: form.widget_subtitle,
    leadForm: lead,
    quickReplies: behaviour.widget_quick_replies.map((item) => item.trim()).filter(Boolean),
    proactive: nudge,
  };

  // The same live preview sits beside every tab that changes how the widget looks or acts.
  const withPreview = (children: React.ReactNode) => (
    <div className={styles.layout}>
      <div className={styles.settings}>{children}</div>
      <aside className={styles.preview}>
        <WidgetPlaygroundCard agentId={agentId} preview={preview} />
      </aside>
    </div>
  );

  const saveFooter = (
    <div className={styles.footer}>
      <Button onClick={handleSave} isLoading={isSaving}>
        Save changes
      </Button>
    </div>
  );

  const pills: WorkspacePill[] = [
    { label: lead.enabled ? "Collecting contact details" : "Contact form off", tone: lead.enabled ? "on" : "off", goTo: "behaviour" },
    { label: nudge.enabled ? "Pop-up invite on" : "Pop-up invite off", tone: nudge.enabled ? "on" : "off", goTo: "behaviour" },
    { label: away.enabled ? "Away hours on" : "Away hours off", tone: away.enabled ? "on" : "off", goTo: "behaviour" },
    {
      label: behaviour.widget_allowed_domains.length ? `Only ${behaviour.widget_allowed_domains.length} website${behaviour.widget_allowed_domains.length === 1 ? "" : "s"}` : "Any website can embed it",
      tone: behaviour.widget_allowed_domains.length ? "on" : "warn",
      title: "Restrict which websites may show your chat so others can't use up your AI replies.",
      goTo: "install",
    },
  ];

  return (
    <ChannelWorkspace
      color="#bc953a"
      icon={<WidgetIcon size={34} />}
      name="Website Widget"
      identity="Website chat"
      subtitle="An AI chat bubble for your website"
      pills={pills}
      connected
      legacyTabs={{ design: "design" }}
      landing={{ headline: "", text: "", steps: [], panel: null }}
      tabs={[
        {
          value: "install",
          label: "Install",
          icon: "plug",
          intro: "Paste one line on your website and the chat appears. Everything you change in the other tabs shows up on your site by itself; you never paste it again.",
          render: () => (
            <>
              <Card className={styles.section}>
                <div className={styles.sectionTitle}>Add it to your website</div>
                <p className={styles.helperText}>
                  Paste this one line just before the closing <code>&lt;/body&gt;</code> tag on every page that should have the chat.
                </p>
                <pre className={styles.codeBlock}>{embedSnippet}</pre>
                <div className={styles.footer}>
                  <Button variant="secondary" onClick={() => copyToClipboard(embedSnippet)}>
                    Copy embed code
                  </Button>
                </div>
              </Card>

              <Card className={styles.section}>
                <div className={styles.sectionTitle}>Allowed websites</div>
                <div className={hubStyles.sectionBody} style={{ marginTop: 0 }}>
                  <Textarea
                    label="Only these websites may use your widget"
                    placeholder={"myshop.com\nblog.myshop.com"}
                    value={domainsText}
                    rows={3}
                    onChange={(e) => setDomainsText(e.target.value)}
                    helperText="One per line. Subdomains are included. Leave empty to allow any website."
                  />
                  <p className={hubStyles.hint}>Stops other sites from embedding your widget and using up your AI replies. Each visitor is also limited to 15 messages a minute.</p>
                </div>
                {saveFooter}
              </Card>

              <Card className={styles.section}>
                <div className={styles.sectionTitle}>Taking over a chat</div>
                <p className={styles.helperText}>
                  Open the conversation in your <a href="/inbox">inbox</a>, pause the AI and type a reply. It appears in the visitor&apos;s chat within a few seconds, and they see a badge on the chat button if the window is closed.
                </p>
              </Card>
            </>
          ),
        },
        {
          value: "design",
          label: "Look",
          icon: "palette",
          minRole: "manager",
          intro: "Choose how the chat looks on your site: its shape, colour and greeting. The preview on the right is the real widget.",
          render: () =>
            withPreview(
              <>
                <Card className={styles.section}>
                  <div className={styles.sectionTitle}>Widget style</div>
                  <WidgetTemplateGallery value={form.widget_template} onChange={(t) => setForm((f) => ({ ...f, widget_template: t }))} color={form.widget_color} />
                </Card>

                <Card className={styles.section}>
                  <div className={styles.sectionTitle}>Customize</div>
                  <div className={styles.fieldGrid}>
                    <Textarea label="Greeting message" value={form.widget_greeting} onChange={(e) => setForm((f) => ({ ...f, widget_greeting: e.target.value }))} placeholder="Hi! How can I help you today?" />
                    <Select label="Position" value={form.widget_position} onChange={(e) => setForm((f) => ({ ...f, widget_position: e.target.value }))}>
                      {POSITIONS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </Select>
                    <Select label="Light or dark" value={form.widget_theme} onChange={(e) => setForm((f) => ({ ...f, widget_theme: e.target.value }))}>
                      {THEMES.map((theme) => (
                        <option key={theme.value} value={theme.value}>
                          {theme.label}
                        </option>
                      ))}
                    </Select>
                    <Input label="Line under your agent's name" placeholder="Online · replies in seconds" value={form.widget_subtitle} maxLength={60} onChange={(e) => setForm((f) => ({ ...f, widget_subtitle: e.target.value }))} />
                    {form.widget_template !== "bubble" && (
                      <Input
                        label={form.widget_template === "panel" ? "Text on the side tab" : "Text in the ask bar"}
                        placeholder={form.widget_template === "panel" ? "Chat with us" : "Ask us anything…"}
                        value={form.widget_launcher_label}
                        maxLength={40}
                        onChange={(e) => setForm((f) => ({ ...f, widget_launcher_label: e.target.value }))}
                      />
                    )}
                    <div className={styles.colorField}>
                      <label className={styles.colorLabel}>Brand color</label>
                      <div className={styles.colorRow}>
                        <input type="color" className={styles.colorSwatch} value={form.widget_color} onChange={(e) => setForm((f) => ({ ...f, widget_color: e.target.value }))} />
                        <Input value={form.widget_color} onChange={(e) => setForm((f) => ({ ...f, widget_color: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                  {saveFooter}
                </Card>
              </>
            ),
        },
        {
          value: "behaviour",
          label: "Chat behaviour",
          icon: "bolt",
          minRole: "manager",
          intro: "What the chat does: ask for contact details, suggest questions, invite visitors to chat, and reply with a fixed message outside your hours.",
          render: () =>
            withPreview(
              <>
                <Card className={styles.section}>
                  <div className={styles.sectionTitle}>Capture leads</div>
                  <div className={hubStyles.sectionBody} style={{ marginTop: 0 }}>
                    <Switch checked={lead.enabled} onChange={(enabled) => patch("widget_lead_form", { enabled })} label="Ask for contact details before the chat starts" />
                    {lead.enabled && (
                      <>
                        <Input label="Question shown above the form" value={lead.title} maxLength={120} onChange={(e) => patch("widget_lead_form", { title: e.target.value })} />
                        <div className={hubStyles.dayRow}>
                          {LEAD_FIELDS.map((field) => (
                            <button
                              key={field.value}
                              type="button"
                              className={hubStyles.chip}
                              data-active={lead.fields.includes(field.value) || undefined}
                              onClick={() => patch("widget_lead_form", { fields: lead.fields.includes(field.value) ? lead.fields.filter((item) => item !== field.value) : [...lead.fields, field.value] })}
                            >
                              {field.label}
                            </button>
                          ))}
                        </div>
                        <Switch checked={lead.required} onChange={(required) => patch("widget_lead_form", { required })} label="Required (visitors can't skip it)" />
                        <p className={hubStyles.hint}>Details land on the conversation in your inbox and customer list, and you get a notification for each new lead.</p>
                      </>
                    )}
                  </div>
                </Card>

                <Card className={styles.section}>
                  <div className={styles.sectionTitle}>Start the conversation</div>
                  <div className={hubStyles.sectionBody} style={{ marginTop: 0 }}>
                    <p className={hubStyles.hint}>Suggested questions visitors can tap instead of typing (up to 6).</p>
                    {behaviour.widget_quick_replies.map((question, index) => (
                      <div key={index} className={hubStyles.row}>
                        <Input
                          aria-label={`Suggested question ${index + 1}`}
                          placeholder="e.g. What are your prices?"
                          value={question}
                          maxLength={60}
                          onChange={(e) => setBehaviour((current) => ({ ...current, widget_quick_replies: current.widget_quick_replies.map((q, i) => (i === index ? e.target.value : q)) }))}
                        />
                        <button
                          type="button"
                          className={hubStyles.iconButton}
                          aria-label="Remove question"
                          onClick={() => setBehaviour((current) => ({ ...current, widget_quick_replies: current.widget_quick_replies.filter((_, i) => i !== index) }))}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    {behaviour.widget_quick_replies.length < 6 && (
                      <div>
                        <Button size="sm" variant="secondary" onClick={() => setBehaviour((current) => ({ ...current, widget_quick_replies: [...current.widget_quick_replies, ""] }))}>
                          Add a suggested question
                        </Button>
                      </div>
                    )}

                    <Switch checked={nudge.enabled} onChange={(enabled) => patch("widget_proactive", { enabled })} label="Invite visitors to chat with a small pop-up message" />
                    {nudge.enabled && (
                      <div className={hubStyles.row}>
                        <Input label="Message" value={nudge.message} maxLength={200} onChange={(e) => patch("widget_proactive", { message: e.target.value })} />
                        <Input type="number" label="Show after (seconds)" min={1} max={600} value={nudge.delay_seconds} onChange={(e) => patch("widget_proactive", { delay_seconds: Number(e.target.value) })} />
                      </div>
                    )}
                  </div>
                </Card>

                <Card className={styles.section}>
                  <div className={styles.sectionTitle}>Away hours</div>
                  <div className={hubStyles.sectionBody} style={{ marginTop: 0 }}>
                    <Switch checked={away.enabled} onChange={(enabled) => patch("widget_away", { enabled })} label="Outside business hours, send one message instead of an AI reply" />
                    {away.enabled && (
                      <>
                        <div className={hubStyles.row}>
                          <Input type="time" label="Open from" value={away.start} onChange={(e) => patch("widget_away", { start: e.target.value })} />
                          <Input type="time" label="Until" value={away.end} onChange={(e) => patch("widget_away", { end: e.target.value })} />
                          <Input label="Timezone" value={away.timezone} onChange={(e) => patch("widget_away", { timezone: e.target.value })} />
                        </div>
                        <div className={hubStyles.dayRow}>
                          {DAYS.map((day, index) => (
                            <button
                              key={day}
                              type="button"
                              className={hubStyles.chip}
                              data-active={away.days.includes(index) || undefined}
                              onClick={() => patch("widget_away", { days: away.days.includes(index) ? away.days.filter((d) => d !== index) : [...away.days, index] })}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                        <Textarea label="Away message" value={away.message} maxLength={1000} rows={2} onChange={(e) => patch("widget_away", { message: e.target.value })} />
                      </>
                    )}
                  </div>
                  {saveFooter}
                </Card>
              </>
            ),
        },
        {
          value: "visitors",
          label: "Visitors",
          icon: "team",
          intro: "People who have chatted with the widget on your website, newest first.",
          render: () => <WidgetVisitors agentId={agentId} />,
        },
      ]}
    />
  );
}
