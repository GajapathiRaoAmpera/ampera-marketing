"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, Input, Modal, Select, Skeleton, Textarea } from "@/components/ui";
import { ApiError, dispositionLabel, parseContactText, voiceCenterApi, type VoiceCampaign } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { ConfirmDialog } from "./ConfirmDialog";
import styles from "./VoiceCenter.module.scss";

const MAX_CONTACTS = 2000;

const STATUS_BADGE: Record<VoiceCampaign["status"], "success" | "warning" | "neutral" | "info"> = {
  running: "info", paused: "warning", canceled: "neutral", completed: "success",
};

const emptyDraft = { name: "", context: "", opening: "", contacts: "", pace: 4, when: "", countryCode: "+91" };

export function CampaignsTab({ canCall, onViewCalls }: { canCall: boolean; onViewCalls: (campaignId: string) => void }) {
  const { show } = useToast();
  const [campaigns, setCampaigns] = useState<VoiceCampaign[] | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [formError, setFormError] = useState("");
  const [canceling, setCanceling] = useState<VoiceCampaign | null>(null);

  const load = useCallback(() => {
    voiceCenterApi.listCampaigns()
      .then((value) => { setCampaigns(value); setFailed(false); })
      // Keep showing the last good list if a background refresh fails.
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  const contacts = useMemo(() => parseContactText(draft.contacts), [draft.contacts]);
  const minutes = Math.ceil(contacts.length / draft.pace);

  async function readFile(file?: File) {
    if (!file) return;
    if (file.size > 1_000_000) {
      show("That file is too large. Keep it under 1 MB (about 2,000 contacts).", "error");
      return;
    }
    setDraft((d) => ({ ...d, contacts: "" }));
    const text = await file.text();
    setDraft((d) => ({ ...d, contacts: text }));
  }

  async function create() {
    setIsSaving(true);
    setFormError("");
    try {
      const campaign = await voiceCenterApi.createCampaign({
        name: draft.name.trim(),
        context: draft.context.trim(),
        opening_message: draft.opening.trim() || undefined,
        contacts,
        calls_per_minute: draft.pace,
        start_at: draft.when ? new Date(draft.when).toISOString() : undefined,
        default_country_code: draft.countryCode.trim(),
      });
      const dropped = (campaign.excluded.invalid ?? 0) + (campaign.excluded.duplicates ?? 0) + (campaign.excluded.do_not_call ?? 0);
      show(`Campaign started for ${campaign.contacts_total} contacts.${dropped ? ` ${dropped} rows were left out.` : ""}`, "success");
      setIsCreating(false);
      setDraft(emptyDraft);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.userMessage : "Couldn't start the campaign. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function act(campaign: VoiceCampaign, action: "pause" | "resume" | "cancel") {
    try {
      await voiceCenterApi.campaignAction(campaign.id, action);
      load();
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't update the campaign.", "error");
    }
  }

  if (!campaigns) {
    return failed
      ? <EmptyState title="Couldn't load campaigns" description="Check your connection and try again." action={<Button onClick={load}>Try again</Button>} />
      : <Skeleton height={280} />;
  }
  const isOverLimit = contacts.length > MAX_CONTACTS;

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <div>
          <div className={styles.sectionTitle}>Campaigns</div>
          <div className={styles.sectionHint}>
            Have your agent call a list of contacts with one goal. Calls stay inside your calling hours, skip your do-not-call list, and unanswered numbers are retried.
          </div>
        </div>
        <div className={styles.spacer} />
        <Button onClick={() => setIsCreating(true)} disabled={!canCall}>New campaign</Button>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <EmptyState
            title="No campaigns yet"
            description={canCall
              ? "Good first campaigns: appointment reminders, following up on enquiries, or winning back past customers."
              : "Connect a phone number and link your agent to start calling."}
            action={canCall ? <Button onClick={() => setIsCreating(true)}>Create your first campaign</Button> : undefined}
          />
        </Card>
      ) : campaigns.map((campaign) => {
        const done = Math.max(0, campaign.contacts_total - Math.min(campaign.pending, campaign.contacts_total));
        return (
          <Card key={campaign.id}>
            <div className={styles.ruleHeader}>
              <div>
                <div className={styles.sectionTitle}>
                  {campaign.name} <Badge variant={STATUS_BADGE[campaign.status]}>{campaign.status}</Badge>
                </div>
                <div className={styles.sectionHint}>{campaign.context}</div>
              </div>
              <div style={{ display: "flex", gap: "var(--space-2)", flexShrink: 0 }}>
                {campaign.status === "running" && <Button size="sm" variant="secondary" onClick={() => act(campaign, "pause")}>Pause</Button>}
                {campaign.status === "paused" && <Button size="sm" onClick={() => act(campaign, "resume")}>Resume</Button>}
                {(campaign.status === "running" || campaign.status === "paused") && (
                  <Button size="sm" variant="outline-danger" onClick={() => setCanceling(campaign)}>Cancel</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => onViewCalls(campaign.id)}>View calls</Button>
              </div>
            </div>

            <div
              className={styles.progress}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={campaign.contacts_total}
              aria-valuenow={done}
              aria-label="Contacts called"
            >
              <div className={styles.progressFill} style={{ width: `${(done / Math.max(1, campaign.contacts_total)) * 100}%` }} />
            </div>
            <div className={styles.statRow}>
              <span><span className={styles.statValue}>{done}/{campaign.contacts_total}</span> contacts called</span>
              <span><span className={styles.statValue}>{campaign.reached}</span> reached</span>
              <span><span className={styles.statValue}>{campaign.positive}</span> positive ({campaign.booked} booked)</span>
              <span><span className={styles.statValue}>{campaign.voicemails}</span> voicemails</span>
              <span><span className={styles.statValue}>{campaign.pending}</span> waiting</span>
              {campaign.opt_outs > 0 && <span><span className={styles.statValue}>{campaign.opt_outs}</span> opted out</span>}
              {campaign.needs_review > 0 && <span><span className={styles.statValue}>{campaign.needs_review}</span> need review</span>}
            </div>
            {campaign.dispositions.length > 0 && (
              <div className={styles.badgeRow} style={{ marginTop: "var(--space-3)" }}>
                {campaign.dispositions.map((item) => <Badge key={item.key} variant="neutral">{dispositionLabel(item.key)} · {item.count}</Badge>)}
              </div>
            )}
            {campaign.next_call_at && campaign.status === "running" && (
              <div className={styles.muted} style={{ marginTop: "var(--space-3)" }}>
                Next call at {new Date(campaign.next_call_at).toLocaleString()}
              </div>
            )}
          </Card>
        );
      })}

      <Modal
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        title="New campaign"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
            <Button onClick={create} isLoading={isSaving} disabled={!draft.name.trim() || !draft.context.trim() || contacts.length === 0 || isOverLimit}>
              {draft.when ? "Schedule" : "Start"} campaign{contacts.length ? ` (${contacts.length})` : ""}
            </Button>
          </>
        }
      >
        <div className={styles.stack}>
          <Input label="Campaign name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="October appointment reminders" required />
          <Textarea
            label="Goal of each call"
            value={draft.context}
            onChange={(e) => setDraft({ ...draft, context: e.target.value })}
            placeholder="Remind the customer about their appointment this week, confirm they are coming, and offer to reschedule if not."
            helperText="Your agent works toward this on every call, on top of its usual instructions."
            maxLength={2000}
          />
          <Textarea
            label="Opening line (optional)"
            value={draft.opening}
            onChange={(e) => setDraft({ ...draft, opening: e.target.value })}
            placeholder="Hi {name}, this is Asha calling from Bright Dental."
            helperText="Use {name} or any column from your list, for example {city}."
            maxLength={1000}
          />
          <div>
            <Textarea
              label="Contacts"
              value={draft.contacts}
              onChange={(e) => setDraft({ ...draft, contacts: e.target.value })}
              placeholder={"number, name\n+919876543210, Priya\n+919123456780, Rahul"}
              helperText="One per line, or paste a spreadsheet with a header row. Up to 2,000."
              rows={6}
            />
            <div className={styles.toolbar} style={{ marginTop: "var(--space-2)" }}>
              <input type="file" accept=".csv,.txt" aria-label="Upload a CSV file" onChange={(e) => void readFile(e.target.files?.[0])} />
              {contacts.length > 0 && <span className={styles.muted}>{contacts.length} contacts found</span>}
              {draft.contacts.trim() && contacts.length === 0 && <span className={styles.muted}>No phone numbers found yet</span>}
            </div>
          </div>
          <div className={styles.formGrid} style={{ marginTop: 0 }}>
            <Input
              label="Country code for numbers without one"
              value={draft.countryCode}
              onChange={(e) => setDraft({ ...draft, countryCode: e.target.value })}
              placeholder="+91"
            />
            <Select label="Pace" value={draft.pace} onChange={(e) => setDraft({ ...draft, pace: Number(e.target.value) })}>
              <option value={1}>1 call a minute (gentle)</option>
              <option value={2}>2 calls a minute</option>
              <option value={4}>4 calls a minute</option>
              <option value={8}>8 calls a minute</option>
              <option value={15}>15 calls a minute (fast)</option>
            </Select>
            <Input label="Start (leave empty to start now)" type="datetime-local" value={draft.when} onChange={(e) => setDraft({ ...draft, when: e.target.value })} />
          </div>
          {isOverLimit && (
            <div className={styles.errorBox} role="alert">
              A campaign can hold up to {MAX_CONTACTS.toLocaleString()} contacts. This list has {contacts.length.toLocaleString()}; split it into smaller campaigns.
            </div>
          )}
          {formError && <div className={styles.errorBox} role="alert">{formError}</div>}
          {contacts.length > 0 && !isOverLimit && (
            <div className={styles.callout}>
              {contacts.length} contacts at {draft.pace} a minute takes about {minutes < 60 ? `${minutes} minutes` : `${(minutes / 60).toFixed(1)} hours`} of calling time.
              Calls outside your calling hours wait for the next day.
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(canceling)}
        title={`Cancel "${canceling?.name ?? ""}"?`}
        confirmLabel="Cancel campaign"
        danger
        onConfirm={async () => { if (canceling) await act(canceling, "cancel"); }}
        onClose={() => setCanceling(null)}
      >
        The {canceling?.pending ?? 0} calls still waiting will not be placed. Calls already made stay in your history. This can&apos;t be undone.
      </ConfirmDialog>
    </div>
  );
}
