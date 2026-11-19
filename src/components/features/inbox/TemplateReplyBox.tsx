"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError, conversationsApi } from "@/lib/api";
import { whatsappStudioApi, type StudioApprovedTemplate } from "@/lib/api/whatsapp-studio";
import { useToast } from "@/context/ToastContext";
import { Button, Input, Select } from "@/components/ui";
import styles from "../../../app/(dashboard)/inbox/page.module.scss";

const VARIABLE = /\{\{(\d+)\}\}/g;

function bodyOf(template?: StudioApprovedTemplate): string {
  return template?.components?.find((component) => component.type.toUpperCase() === "BODY")?.text ?? "";
}

function variableCount(text: string): number {
  return new Set(Array.from(text.matchAll(VARIABLE), (match) => match[1])).size;
}

/**
 * WhatsApp only lets you write freely for 24 hours after the customer's last
 * message. After that, an approved template is the only way to reach them.
 */
export function TemplateReplyBox({
  businessId,
  conversationKey,
  customerName,
  onSent,
}: {
  businessId: string;
  conversationKey: string;
  customerName?: string;
  onSent: () => void;
}) {
  const { show } = useToast();
  const [templates, setTemplates] = useState<StudioApprovedTemplate[] | null>(null);
  const [choice, setChoice] = useState("");
  const [values, setValues] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    whatsappStudioApi
      .campaignTemplates(businessId)
      .then((list) => !cancelled && setTemplates(list))
      .catch(() => !cancelled && setTemplates([]));
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const template = useMemo(() => templates?.find((item) => `${item.name}::${item.language}` === choice), [templates, choice]);
  const body = bodyOf(template);
  const needed = variableCount(body);

  function pick(next: string) {
    setChoice(next);
    const picked = templates?.find((item) => `${item.name}::${item.language}` === next);
    const first = (customerName ?? "").split(" ")[0];
    // The first value is usually the customer's name.
    setValues(Array.from({ length: variableCount(bodyOf(picked)) }, (_, index) => (index === 0 ? first : "")));
  }

  const preview = body.replace(VARIABLE, (_, number: string) => values[Number(number) - 1]?.trim() || `{{${number}}}`);
  const ready = Boolean(template) && values.length === needed && values.every((value) => value.trim());

  async function send() {
    if (!template) return;
    setSending(true);
    try {
      await conversationsApi.sendTemplateReply(conversationKey, { template_name: template.name, language: template.language, parameters: values.map((value) => value.trim()) });
      show("Template sent.", "success");
      setChoice("");
      setValues([]);
      onSent();
    } catch (error) {
      show(error instanceof ApiError ? error.userMessage : "Couldn't send that template.", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={styles.templateBox}>
      <div className={styles.composerHint}>
        It&apos;s been more than 24 hours since they last wrote, so WhatsApp only allows an approved template. Once they reply, you can chat freely again.
      </div>
      {templates === null ? (
        <p className={styles.templateEmpty}>Loading your templates…</p>
      ) : templates.length === 0 ? (
        <p className={styles.templateEmpty}>
          You have no approved templates yet. Create one in WhatsApp → Templates (Meta usually approves within minutes).
        </p>
      ) : (
        <>
          <Select label="Template" value={choice} onChange={(event) => pick(event.target.value)}>
            <option value="">Choose a template…</option>
            {templates.map((item) => (
              <option key={`${item.name}-${item.language}`} value={`${item.name}::${item.language}`}>
                {item.name.replace(/_/g, " ")} · {item.language}
              </option>
            ))}
          </Select>
          {template && needed > 0 && (
            <div className={styles.templateFields}>
              {values.map((value, index) => (
                <Input
                  key={index}
                  label={`Value for {{${index + 1}}}`}
                  value={value}
                  onChange={(event) => setValues((current) => current.map((item, position) => (position === index ? event.target.value : item)))}
                  placeholder={index === 0 ? "Customer's name" : ""}
                />
              ))}
            </div>
          )}
          {template && (
            <div className={styles.templatePreview} aria-label="Message preview">
              {preview || "(This template has no text.)"}
            </div>
          )}
          <Button onClick={() => void send()} isLoading={sending} disabled={!ready}>
            Send template
          </Button>
        </>
      )}
    </div>
  );
}
