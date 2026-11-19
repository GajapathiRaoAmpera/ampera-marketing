"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Input, Modal, Select, Tabs } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { ApiError } from "@/lib/api/client";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import {
  whatsappStudioApi,
  type StudioApprovedTemplate,
  type StudioCampaign,
  type StudioCampaignStep,
  type WhatsAppStudioSegment,
} from "@/lib/api/whatsapp-studio";
import styles from "./page.module.scss";

function campaignError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.userMessage : fallback;
}

type Mode = "broadcast" | "drip";

const VARIABLE_PATTERN = /\{\{\d+\}\}/g;
const BUILT_IN_FIELDS = ["name", "phone", "email"] as const;

const MODE_COPY: Record<Mode, { label: string; blurb: string }> = {
  broadcast: {
    label: "One-time broadcast",
    blurb: "Send a single message to everyone in a contact list, right away or at a scheduled time.",
  },
  drip: {
    label: "Drip sequence",
    blurb: "Send a series of timed messages to nurture contacts, for example, a welcome message now, then a follow-up 24 hours later.",
  },
};

function parameterCount(template?: StudioApprovedTemplate): number {
  return (template?.components ?? []).reduce((total, component) => {
    if (["HEADER", "BODY"].includes(component.type.toUpperCase())) {
      return total + (component.text?.match(VARIABLE_PATTERN)?.length ?? 0);
    }
    if (component.type.toUpperCase() === "BUTTONS") {
      return total + (component.buttons ?? []).reduce(
        (buttonTotal, button) => buttonTotal + (button.type.toUpperCase() === "URL" ? (button.url?.match(VARIABLE_PATTERN)?.length ?? 0) : 0),
        0,
      );
    }
    return total;
  }, 0);
}

function headerMediaFormat(template?: StudioApprovedTemplate): string | null {
  const header = template?.components?.find((component) => component.type.toUpperCase() === "HEADER");
  const format = header?.format?.toUpperCase();
  return format && ["IMAGE", "VIDEO", "DOCUMENT"].includes(format) ? format : null;
}

function templateBodyText(template?: StudioApprovedTemplate): string {
  const body = template?.components?.find((component) => component.type.toUpperCase() === "BODY");
  return body?.text ?? "";
}

function emptyStep(name: string, delayMinutes: number): StudioCampaignStep {
  return { name, template_name: "", language_code: "en_US", delay_minutes: delayMinutes, parameters: [], header_media_url: null };
}

function slugifyFieldKey(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "").slice(0, 40);
}

function downloadCsv(filename: string, headers: string[], sampleRow: string[]) {
  const csv = `${headers.join(",")}\n${sampleRow.join(",")}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const DELAY_UNITS = [
  { value: 1440, label: "days" },
  { value: 60, label: "hours" },
  { value: 1, label: "minutes" },
] as const;

function formatDelay(minutes: number): string {
  const unit = DELAY_UNITS.find((item) => minutes > 0 && minutes % item.value === 0) ?? DELAY_UNITS[2];
  const count = minutes / unit.value;
  return `${count} ${count === 1 ? unit.label.slice(0, -1) : unit.label}`;
}

/** A drip wait in plain units: "2 days" rather than "2880 minutes". */
function DelayInput({ label, minutes, onChange }: { label: string; minutes: number; onChange: (minutes: number) => void }) {
  const [unit, setUnit] = useState<number>(() => DELAY_UNITS.find((item) => minutes > 0 && minutes % item.value === 0)?.value ?? 60);
  return <div className={styles.delayRow}>
    <Input label={label} type="number" min="0" step="any" value={String(minutes / unit)} onChange={(event) => onChange(Math.max(0, Math.round(Number(event.target.value) * unit)))} />
    <Select label="Unit" value={String(unit)} onChange={(event) => setUnit(Number(event.target.value))}>
      {DELAY_UNITS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
    </Select>
  </div>;
}

export default function StudioCampaignsPage() {
  const { businessId } = useActiveBusiness();
  const { show } = useToast();
  const [mode, setMode] = useState<Mode>("broadcast");
  const [campaigns, setCampaigns] = useState<StudioCampaign[]>([]);
  const [segments, setSegments] = useState<WhatsAppStudioSegment[]>([]);
  const [templates, setTemplates] = useState<StudioApprovedTemplate[]>([]);
  const [knownCustomFields, setKnownCustomFields] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [steps, setSteps] = useState<StudioCampaignStep[]>([emptyStep("Send message", 0)]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [activating, setActivating] = useState(false);

  const load = useCallback(async () => {
    if (!businessId) return;
    try {
      const [campaignResult, segmentResult, templateResult, customFieldResult] = await Promise.all([
        whatsappStudioApi.campaigns(businessId), whatsappStudioApi.segments(businessId),
        whatsappStudioApi.campaignTemplates(businessId), whatsappStudioApi.customFieldKeys(businessId),
      ]);
      setCampaigns(campaignResult); setSegments(segmentResult); setTemplates(templateResult);
      setKnownCustomFields(customFieldResult);
      setSegmentId((current) => current || segmentResult[0]?.id || "");
    } catch { show("Could not load campaigns, contact lists, or approved templates.", "error"); }
  }, [businessId, show]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  // Every custom field (not "name"/"phone"/"email") referenced by any step's
  // parameter mapping: this is what drives the "columns needed" panel and
  // the matching CSV template download.
  const requiredCustomFields = Array.from(new Set(
    steps.flatMap((step) => step.parameters.filter((field) => !(BUILT_IN_FIELDS as readonly string[]).includes(field)))
  ));

  function downloadCampaignTemplate() {
    const headers = ["phone", "name", ...requiredCustomFields];
    const sample = ["+919876543210", "Asha Verma", ...requiredCustomFields.map(() => "value")];
    downloadCsv("campaign-contacts-template.csv", headers, sample);
  }

  function setCampaignMode(next: Mode) {
    setMode(next);
    setSteps(next === "broadcast" ? [emptyStep("Send message", 0)] : [
      emptyStep("Welcome", 0),
      emptyStep("Follow up", 1440),
    ]);
  }

  const selectedSegment = segments.find((segment) => segment.id === segmentId);

  // Reviewing is purely client-side (no backend call) so cancelling out of
  // the review modal leaves nothing behind. The campaign is only actually
  // created+activated together on confirm. See 5.1 in the Campaigns audit:
  // this used to be one click straight to a live send, no review step.
  const [reviewOpen, setReviewOpen] = useState(false);

  function openReview(event: FormEvent) {
    event.preventDefault();
    if (!businessId || !segmentId || steps.some((step) => !step.template_name)) return;
    setReviewOpen(true);
  }

  async function confirmActivate() {
    if (!businessId || !segmentId) return;
    setActivating(true);
    try {
      const result = await whatsappStudioApi.createCampaign(businessId, { name, mode, segment_id: segmentId, steps, scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null });
      const activated = await whatsappStudioApi.activateCampaign(businessId, result.campaign.id);
      show(`${mode === "broadcast" ? "Broadcast" : "Sequence"} activated for ${activated.enrolled} opted-in contacts.`, "success");
      setName(""); setReviewOpen(false); await load();
    } catch (error) {
      show(campaignError(error, "Activation failed. Confirm the WhatsApp connection, approved templates, contact consent, and schedule."), "error");
    } finally {
      setActivating(false);
    }
  }

  return <div className={styles.page}>
    <header>
      <div><Link href="/channels/whatsapp">← WhatsApp</Link><h1>Campaigns</h1><p>Message subscribed contacts: one-off announcements or timed follow-up sequences.</p></div>
      <Badge variant="success">Consent enforced</Badge>
    </header>

    <>
      <div className={styles.explainer}><div><strong>1. Pick a list</strong><span>Lists are made in the Contacts tab. Only subscribed people in it get the message.</span></div><div><strong>2. Pick an approved template</strong><span>Meta must approve a message before you can send it to many people.</span></div><div><strong>3. Review, then send or schedule</strong><span>You&apos;ll see sent, delivered, read and failed counts here.</span></div></div>
      <div className={styles.grid}>
        <Card className={styles.formCard}>
          <Tabs value={mode} onChange={(value) => setCampaignMode(value)} options={[{ value: "broadcast", label: "One-time broadcast" }, { value: "drip", label: "Drip sequence" }]} />
          <p className={styles.modeBlurb}>{MODE_COPY[mode].blurb}</p>
          <form onSubmit={openReview} className={styles.form}>
            <Input label="Campaign name" value={name} onChange={(event) => setName(event.target.value)} required placeholder={mode === "broadcast" ? "September announcement" : "September onboarding sequence"} />
            <label>Contact list<select value={segmentId} onChange={(event) => setSegmentId(event.target.value)} required><option value="">Choose a contact list</option>{segments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name} ({segment.contact_count})</option>)}</select></label>
            {!segments.length ? <p className={styles.warning}>No lists yet. <Link className={styles.inlineLink} href="/channels/whatsapp?tab=contacts">Add contacts to a list</Link> first.</p> : null}
            {steps.map((step, index) => {
              const selectedTemplate = templates.find((template) => template.name === step.template_name && template.language === step.language_code);
              const requiredParameters = parameterCount(selectedTemplate);
              const mediaFormat = headerMediaFormat(selectedTemplate);
              return <div className={styles.step} key={index}>
                {mode === "drip" ? <div className={styles.stepHead}><strong>Step {index + 1} of {steps.length}</strong>{index > 0 ? <button type="button" onClick={() => setSteps((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button> : null}</div> : null}
                <Input label="Step name" value={step.name} onChange={(event) => setSteps((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} />
                <label>Approved WhatsApp template<select value={step.template_name ? `${step.template_name}::${step.language_code}` : ""} onChange={(event) => {
                  const template = templates.find((item) => `${item.name}::${item.language}` === event.target.value);
                  const count = parameterCount(template);
                  setSteps((current) => current.map((item, itemIndex) => itemIndex === index ? {
                    ...item, template_name: template?.name ?? "", language_code: template?.language ?? "en_US",
                    parameters: Array.from({ length: count }, () => "name"), header_media_url: null,
                  } : item));
                }} required><option value="">Choose template</option>{templates.map((template) => <option key={`${template.name}-${template.language}`} value={`${template.name}::${template.language}`}>{template.name} · {template.language}</option>)}</select></label>
                {Array.from({ length: requiredParameters }, (_, parameterIndex) => {
                  const currentField = step.parameters[parameterIndex] ?? "name";
                  const isCustom = !(BUILT_IN_FIELDS as readonly string[]).includes(currentField);
                  function setField(index2: number, parameterIndex2: number, field: string) {
                    setSteps((current) => current.map((item, itemIndex) => itemIndex === index2 ? { ...item, parameters: Array.from({ length: requiredParameters }, (_, mappingIndex) => mappingIndex === parameterIndex2 ? field : item.parameters[mappingIndex] ?? "name") } : item));
                  }
                  return <div className={styles.paramField} key={parameterIndex}>
                    <label>Value for {`{{${parameterIndex + 1}}}`}
                      <select
                        value={isCustom ? "__custom__" : currentField}
                        onChange={(event) => setField(index, parameterIndex, event.target.value === "__custom__" ? "" : event.target.value)}
                      >
                        <option value="name">Contact name</option>
                        <option value="phone">WhatsApp number</option>
                        <option value="email">Email address</option>
                        {knownCustomFields.length ? <optgroup label="Custom fields already in use">{knownCustomFields.map((field) => <option key={field} value={field}>{field}</option>)}</optgroup> : null}
                        <option value="__custom__">New custom field…</option>
                      </select>
                    </label>
                    {isCustom ? (
                      <Input
                        aria-label={`Custom field name for {{${parameterIndex + 1}}}`}
                        value={currentField}
                        onChange={(event) => setField(index, parameterIndex, slugifyFieldKey(event.target.value))}
                        placeholder="e.g. location"
                        helperText="Contacts in the list need this field filled in."
                      />
                    ) : null}
                  </div>;
                })}
                {mediaFormat ? <Input label={`${mediaFormat[0]}${mediaFormat.slice(1).toLowerCase()} header URL`} type="url" value={step.header_media_url ?? ""} onChange={(event) => setSteps((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, header_media_url: event.target.value } : item))} helperText="Use a public HTTPS URL that Meta can download." required /> : null}
                {mediaFormat === "IMAGE" && step.header_media_url ? <div className={styles.mediaPreview}><img src={step.header_media_url} alt="Header preview" onError={(event) => { event.currentTarget.style.display = "none"; }} /></div> : null}
                {mode === "drip" ? <DelayInput label={index === 0 ? "Wait before the first message" : "Wait after the previous message"} minutes={step.delay_minutes} onChange={(minutes) => setSteps((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, delay_minutes: minutes } : item))} /> : null}
              </div>;
            })}
            {mode === "drip" && steps.length < 20 ? <Button type="button" variant="secondary" onClick={() => setSteps((current) => [...current, emptyStep(`Follow up ${current.length}`, 1440)])}>Add sequence step</Button> : null}

            {requiredCustomFields.length ? (
              <div className={styles.fieldsNeeded}>
                <div>
                  <strong>This message needs: </strong>
                  phone, name, {requiredCustomFields.join(", ")}
                  <span>Contacts in the list must have these fields filled in.</span>
                </div>
                <button type="button" className={styles.inlineLink} onClick={downloadCampaignTemplate}>Download a matching CSV template →</button>
              </div>
            ) : null}

            <Input label="Start date and time" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} helperText="Leave empty to start as soon as the scheduler runs." />
            <Button type="submit" disabled={!segments.length || !templates.length}>Review before sending</Button>
            {!templates.length ? <p className={styles.warning}>No approved templates yet. <Link className={styles.inlineLink} href="/channels/whatsapp?tab=templates">Create one in Templates</Link>; Meta usually approves within minutes.</p> : null}
          </form>
        </Card>
        <Card>
          <h2>Campaign activity</h2>
          <div className={campaigns.length ? styles.list : styles.listEmpty}>
            {campaigns.length ? campaigns.map((campaign) => <article key={campaign.id}>
              <div><strong>{campaign.name}</strong><span>{campaign.mode === "drip" ? `${campaign.steps.length}-step sequence` : "One-time broadcast"}</span></div>
              <Badge variant={campaign.status === "paused" || campaign.status === "completed_with_errors" ? "warning" : campaign.status === "draft" ? "info" : "success"}>{campaign.status.replaceAll("_", " ")}</Badge>
              <div className={styles.metrics}><span>{campaign.audience?.total ?? 0} enrolled</span><span>{campaign.sent_count ?? 0} sent</span><span>{campaign.audience?.delivered ?? 0} delivered</span><span>{campaign.audience?.read ?? 0} read</span><span>{campaign.audience?.failed ?? 0} failed</span><span>{campaign.audience?.converted ?? 0} converted</span></div>
              {["active", "scheduled"].includes(campaign.status) ? <Button variant="secondary" onClick={async () => { if (!businessId) return; try { await whatsappStudioApi.pauseCampaign(businessId, campaign.id); await load(); } catch (error) { show(campaignError(error, "Couldn't pause this campaign."), "error"); } }}>Pause</Button> : null}
              {campaign.status === "paused" ? <Button onClick={async () => { if (!businessId) return; try { await whatsappStudioApi.activateCampaign(businessId, campaign.id); await load(); } catch (error) { show(campaignError(error, "Couldn't resume this campaign."), "error"); } }}>Resume</Button> : null}
            </article>) : <EmptyState title="No campaigns yet" description="Your first broadcast or sequence will appear here once you send it." />}
          </div>
        </Card>
      </div>
    </>

    {reviewOpen ? (
      <Modal
        isOpen
        onClose={() => !activating && setReviewOpen(false)}
        title="Review before sending"
        footer={<>
          <Button variant="secondary" onClick={() => setReviewOpen(false)} disabled={activating}>Back to edit</Button>
          <Button onClick={() => void confirmActivate()} isLoading={activating}>
            {mode === "broadcast" ? "Send now" : "Start sequence"}
          </Button>
        </>}
      >
        <div className={styles.reviewBody}>
          <p>
            You&apos;re about to message <strong>{selectedSegment?.contact_count ?? 0} opted-in contact{selectedSegment?.contact_count === 1 ? "" : "s"}</strong> in
            {" "}<strong>{selectedSegment?.name ?? "this list"}</strong>.
          </p>
          <p className={styles.reviewNote}>
            The actual send list is re-checked against current opt-in status when this activates. It may be smaller
            than the count above if anyone has opted out since this group was last calculated. Message templates are
            re-verified as still Meta-approved at the same time.
          </p>
          <ul className={styles.reviewSteps}>
            {steps.map((step, index) => {
              const selectedTemplate = templates.find((template) => template.name === step.template_name && template.language === step.language_code);
              const bodyText = templateBodyText(selectedTemplate);
              const mediaFormat = headerMediaFormat(selectedTemplate);
              return (
                <li key={index} className={styles.reviewStep}>
                  <div><strong>{step.name || (mode === "drip" ? `Step ${index + 1}` : "Message")}</strong> - {step.template_name || "no template chosen"}{mode === "drip" && index > 0 ? ` (${formatDelay(step.delay_minutes)} after previous)` : null}</div>
                  {mediaFormat === "IMAGE" && step.header_media_url ? (
                    <img className={styles.reviewImage} src={step.header_media_url} alt="Message header" onError={(event) => { event.currentTarget.style.display = "none"; }} />
                  ) : null}
                  {bodyText ? <p className={styles.reviewMessageText}>{bodyText}</p> : null}
                </li>
              );
            })}
          </ul>
          {scheduledAt ? <p>Starts at {new Date(scheduledAt).toLocaleString()}.</p> : <p>Starts as soon as the scheduler next runs (within a minute).</p>}
        </div>
      </Modal>
    ) : null}
  </div>;
}
