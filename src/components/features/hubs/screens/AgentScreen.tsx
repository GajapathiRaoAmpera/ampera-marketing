"use client";

import { useEffect, useState } from "react";
import { businessesApi, whatsappTemplatesApi } from "@/lib/api";
import type { WhatsAppTemplate } from "@/lib/api/whatsapp-templates";
import { useBusiness } from "@/context/BusinessContext";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import { useToast } from "@/context/ToastContext";
import { Button, Card, EmptyState, InfoLabel, Input, Select, Skeleton, Switch, Textarea } from "@/components/ui";
import { TestChatModal } from "@/components/features/agent-config/TestChatModal";
import { QualificationCriteriaEditor } from "@/components/features/agent-config/QualificationCriteriaEditor";
import { BotIcon } from "@/components/layout/icons";
import type { QualificationCriterion } from "@/types/api";
import styles from "@/app/(dashboard)/agent-config/page.module.scss";
import { useEmbedded } from "@/components/layout/Embedded";

const AGENT_FIELD_HELP = {
  agent_name: "The name customers see when the AI introduces itself.",
  tone: "The emotional voice of replies, such as friendly, professional, playful, or formal.",
  language: "The default language; the agent can still follow a customer who writes in another language.",
  response_style: "The shape and length of replies, such as concise, detailed, or conversational.",
  purpose: "The primary outcome this agent should help the business and its customers achieve.",
  custom_instructions: "Exact rules the agent should follow, including things it should always do or never do.",
};

function agentInfoLabel(label: string, help: string) {
  return <InfoLabel help={help}>{label}</InfoLabel>;
}

export default function AgentConfigPage() {
  const embedded = useEmbedded();
  const { business, businessId, isLoading, hasNoBusinesses } = useActiveBusiness();
  const { refresh } = useBusiness();
  const { show } = useToast();

  const [form, setForm] = useState({
    agent_name: "",
    tone: "",
    language: "",
    response_style: "",
    purpose: "",
    custom_instructions: "",
  });
  const [qualificationCriteria, setQualificationCriteria] = useState<QualificationCriterion[]>([]);
  const [followUpForm, setFollowUpForm] = useState({
    follow_up_enabled: false,
    follow_up_no_response_hours: 24,
  });
  const [resendForm, setResendForm] = useState({
    resend_enabled: false,
    resend_delay_minutes: 30,
    resend_max_attempts: 1,
    resend_template_name: "",
  });
  const [approvedTemplates, setApprovedTemplates] = useState<WhatsAppTemplate[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestChatOpen, setIsTestChatOpen] = useState(false);

  /* Business changes replace the editor draft intentionally. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (business) {
      setForm({
        agent_name: business.agent_name ?? "",
        tone: business.tone ?? "",
        language: business.language ?? "",
        response_style: business.response_style ?? "",
        purpose: business.purpose ?? "",
        custom_instructions: business.personality?.trim()
          ? `Style guidance: ${business.personality.trim()}${business.custom_instructions?.trim() ? `\n\n${business.custom_instructions.trim()}` : ""}`
          : business.custom_instructions ?? "",
      });
      setQualificationCriteria(business.qualification_criteria ?? []);
      setFollowUpForm({
        follow_up_enabled: business.follow_up_enabled ?? false,
        follow_up_no_response_hours: business.follow_up_no_response_hours ?? 24,
      });
      setResendForm({
        resend_enabled: business.resend_enabled ?? false,
        resend_delay_minutes: business.resend_delay_minutes ?? 30,
        resend_max_attempts: business.resend_max_attempts ?? 1,
        resend_template_name: business.resend_template_name ?? "",
      });
    }
  }, [business]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    whatsappTemplatesApi
      .listLocal({ status: "APPROVED" })
      .then(setApprovedTemplates)
      .catch(() => {
        // Non-fatal. The resend-template dropdown just stays empty if this fails.
      });
  }, []);

  async function handleSave() {
    if (!businessId) return;
    if (form.purpose.length > 500 || form.custom_instructions.length > 1000) {
      show("Purpose is limited to 500 characters and custom instructions to 1,000. Shorten the highlighted content before saving.", "error");
      return;
    }
    setIsSaving(true);
    try {
      await businessesApi.update(businessId, {
        ...form,
        personality: "",
        qualification_criteria: qualificationCriteria,
        ...followUpForm,
        ...resendForm,
      });
      show("Agent configuration saved.", "success");
      refresh();
    } catch {
      show("Couldn't save your changes. Please try again.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  function handleOpenTestChat() {
    if (form.purpose.length > 500 || form.custom_instructions.length > 1000) {
      show("Shorten Purpose or Custom Instructions before testing this draft.", "error");
      return;
    }
    setIsTestChatOpen(true);
  }

  if (isLoading) return <Skeleton height={400} />;
  if (hasNoBusinesses || !business) {
    return <EmptyState title="Create a business first" description="Set up a business before configuring its AI agent." />;
  }

  return (
    <div>
      {embedded ? (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-4)" }}>
          <Button variant="secondary" leftIcon={<BotIcon size={16} />} onClick={handleOpenTestChat}>
            Test chat
          </Button>
        </div>
      ) : (
        <div className={styles.header}>
          <div>
            <div className={styles.title}>AI Agent</div>
            <div className={styles.subtitle}>
              These settings feed directly into your agent&apos;s system prompt, changes apply to the next customer
              message.
            </div>
          </div>
          <Button variant="secondary" leftIcon={<BotIcon size={16} />} onClick={handleOpenTestChat}>
            Test chat
          </Button>
        </div>
      )}

      <Card>
        <div className={styles.sectionTitle}>Persona</div>
        <div className={styles.fieldGrid}>
          <Input
            label={agentInfoLabel("Agent name", AGENT_FIELD_HELP.agent_name)}
            value={form.agent_name}
            onChange={(e) => setForm((f) => ({ ...f, agent_name: e.target.value }))}
            placeholder="e.g. Aria"
          />
          <Select label={agentInfoLabel("Tone", AGENT_FIELD_HELP.tone)} value={form.tone} onChange={(e) => setForm((f) => ({ ...f, tone: e.target.value }))}>
            <option value="">Select a tone</option>
            <option value="friendly">Friendly</option>
            <option value="professional">Professional</option>
            <option value="playful">Playful</option>
            <option value="formal">Formal</option>
          </Select>
          <Select
            label={agentInfoLabel("Language", AGENT_FIELD_HELP.language)}
            value={form.language}
            onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
          >
            <option value="">Select a language</option>
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="es">Spanish</option>
          </Select>
          <Select
            label={agentInfoLabel("Response style", AGENT_FIELD_HELP.response_style)}
            value={form.response_style}
            onChange={(e) => setForm((f) => ({ ...f, response_style: e.target.value }))}
          >
            <option value="">Select a style</option>
            <option value="concise">Concise</option>
            <option value="detailed">Detailed</option>
            <option value="conversational">Conversational</option>
          </Select>
        </div>
      </Card>

      <div style={{ height: "var(--space-5)" }} />

      <Card>
        <div className={styles.sectionTitle}>Behavior</div>
        <div className={styles.fieldGrid}>
          <div className={styles.fullWidth}>
            <Textarea
              label={agentInfoLabel("Purpose", AGENT_FIELD_HELP.purpose)}
              value={form.purpose}
              onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
              placeholder="What should this agent help customers accomplish?"
              maxLength={500}
              showCharCount
            />
          </div>
          <div className={styles.fullWidth}>
            <Textarea
              label={agentInfoLabel("Custom instructions", AGENT_FIELD_HELP.custom_instructions)}
              value={form.custom_instructions}
              onChange={(e) => setForm((f) => ({ ...f, custom_instructions: e.target.value }))}
              placeholder="Any specific rules the agent should always follow."
              showCharCount
              maxLength={1000}
            />
          </div>
        </div>
      </Card>

      <div style={{ height: "var(--space-5)" }} />

      <Card>
        <div className={styles.sectionTitle}>Follow-up reminders</div>
        <p className={styles.sectionDescription}>
          When a customer stops responding, create a reminder for you to follow up manually, this never
          messages the customer on its own.
        </p>
        <div className={styles.fieldGrid}>
          <Switch
            label="Enable follow-up reminders"
            checked={followUpForm.follow_up_enabled}
            onChange={(checked) => setFollowUpForm((f) => ({ ...f, follow_up_enabled: checked }))}
          />
          <Input
            label="No-response threshold (hours)"
            type="number"
            min={1}
            value={followUpForm.follow_up_no_response_hours}
            onChange={(e) =>
              setFollowUpForm((f) => ({ ...f, follow_up_no_response_hours: Number(e.target.value) || 24 }))
            }
            disabled={!followUpForm.follow_up_enabled}
          />
        </div>
      </Card>

      <div style={{ height: "var(--space-5)" }} />

      <Card>
        <div className={styles.sectionTitle}>No-reply auto-resend</div>
        <p className={styles.sectionDescription}>
          When a customer goes quiet after your agent&apos;s last message, automatically send one context-aware
          check-in, unlike follow-up reminders above, this actually messages the customer.
        </p>
        <div className={styles.fieldGrid}>
          <Switch
            label="Enable auto-resend"
            checked={resendForm.resend_enabled}
            onChange={(checked) => setResendForm((f) => ({ ...f, resend_enabled: checked }))}
          />
          <div />
          <Input
            label="Delay before resend (minutes)"
            type="number"
            min={1}
            value={resendForm.resend_delay_minutes}
            onChange={(e) =>
              setResendForm((f) => ({ ...f, resend_delay_minutes: Number(e.target.value) || 30 }))
            }
            disabled={!resendForm.resend_enabled}
          />
          <Input
            label="Max resend attempts"
            type="number"
            min={1}
            value={resendForm.resend_max_attempts}
            onChange={(e) =>
              setResendForm((f) => ({ ...f, resend_max_attempts: Number(e.target.value) || 1 }))
            }
            disabled={!resendForm.resend_enabled}
          />
          <div className={styles.fullWidth}>
            <Select
              label="WhatsApp fallback template (used after the 24h session window closes)"
              value={resendForm.resend_template_name}
              onChange={(e) => setResendForm((f) => ({ ...f, resend_template_name: e.target.value }))}
              disabled={!resendForm.resend_enabled}
            >
              <option value="">No template selected</option>
              {approvedTemplates.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      <div style={{ height: "var(--space-5)" }} />

      <Card>
        <div className={styles.sectionTitle}>Lead Qualification</div>
        <QualificationCriteriaEditor criteria={qualificationCriteria} onChange={setQualificationCriteria} />
      </Card>

      <div className={styles.footer}>
        <Button onClick={handleSave} isLoading={isSaving}>
          Save changes
        </Button>
      </div>

      {isTestChatOpen && (
        <TestChatModal
          isOpen
          onClose={() => setIsTestChatOpen(false)}
          agentId={(business.agent_id as string) ?? null}
          configOverride={{ ...form, personality: "" }}
        />
      )}
    </div>
  );
}
