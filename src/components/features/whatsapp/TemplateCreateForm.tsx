"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Button, Card, Input, Select, Textarea } from "@/components/ui";
import { whatsappTemplatesApi, ApiError, type TemplateButton, type TemplateComponent } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { useAsync } from "@/lib/hooks/useAsync";
import { TemplatePreview } from "./TemplatePreview";
import styles from "./TemplateCreateForm.module.scss";

type Category = "UTILITY" | "MARKETING" | "AUTHENTICATION";

const CATEGORY_INFO: Record<Category, { label: string; description: string; drawback: string }> = {
  UTILITY: {
    label: "Utility",
    description: "Transactional updates the customer expects: order confirmations, shipping updates, appointment reminders.",
    drawback: "Meta will re-categorize as Marketing (and may reject) if the content includes any promotional language.",
  },
  MARKETING: {
    label: "Marketing",
    description: "Promotions, offers, new product announcements, newsletters, anything promotional.",
    drawback: "Slower approval, higher rejection risk, and Meta charges a per-message conversation fee for these outside free tiers. Customers can also opt out at any time: you must honor STOP requests.",
  },
  AUTHENTICATION: {
    label: "Authentication",
    description: "One-time passcodes (OTPs) for login or verification. Meta writes the message text itself, you only choose the code delivery style and expiry.",
    drawback: "The header, body, and footer text below are ignored: Meta generates fixed wording around your code ({{1}}) so it can be trusted and auto-filled by users.",
  },
};

function extractVariables(text: string): number[] {
  const matches = [...text.matchAll(/\{\{(\d+)\}\}/g)];
  const nums = matches.map((m) => parseInt(m[1], 10));
  return [...new Set(nums)].sort((a, b) => a - b);
}

const LANGUAGES = [
  { value: "en_US", label: "English (US)" },
  { value: "en_GB", label: "English (UK)" },
  { value: "es_ES", label: "Spanish" },
  { value: "pt_BR", label: "Portuguese (Brazil)" },
  { value: "hi", label: "Hindi" },
  { value: "ar", label: "Arabic" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
];

export function TemplateCreateForm({ onCreated, businessId }: { onCreated: () => void; businessId: string }) {
  const { show } = useToast();
  const { data: metaFlows, isLoading: flowsLoading } = useAsync(() => whatsappTemplatesApi.flows(businessId), [businessId]);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("UTILITY");
  const [language, setLanguage] = useState("en_US");
  const [templateMode, setTemplateMode] = useState<"standard" | "carousel">("standard");
  const [otpType, setOtpType] = useState<"COPY_CODE" | "ONE_TAP">("COPY_CODE");
  const [addSecurityRecommendation, setAddSecurityRecommendation] = useState(true);
  const [codeExpirationMinutes, setCodeExpirationMinutes] = useState(10);
  const [carouselCards, setCarouselCards] = useState([
    { body: "", mediaHandle: "", filename: "", uploading: false },
    { body: "", mediaHandle: "", filename: "", uploading: false },
  ]);

  const [headerEnabled, setHeaderEnabled] = useState(false);
  const [headerText, setHeaderText] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [footerEnabled, setFooterEnabled] = useState(false);
  const [footerText, setFooterText] = useState("");
  const [buttons, setButtons] = useState<TemplateButton[]>([]);

  const [headerSamples, setHeaderSamples] = useState<string[]>([]);
  const [bodySamples, setBodySamples] = useState<string[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const headerVars = useMemo(() => extractVariables(headerText), [headerText]);
  const bodyVars = useMemo(() => extractVariables(bodyText), [bodyText]);

  function addButton(type: TemplateButton["type"]) {
    if (buttons.length >= 3) {
      show("WhatsApp allows a maximum of 3 buttons per template.", "error");
      return;
    }
    setButtons((b) => [...b, {
      type,
      text: "",
      url: type === "URL" ? "https://" : undefined,
      phone_number: type === "PHONE_NUMBER" ? "" : undefined,
      flow_action: type === "FLOW" ? "navigate" : undefined,
    }]);
  }

  function updateButton(index: number, patch: Partial<TemplateButton>) {
    setButtons((bs) => bs.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }

  function removeButton(index: number) {
    setButtons((bs) => bs.filter((_, i) => i !== index));
  }

  async function uploadCarouselImage(index: number, file?: File) {
    if (!file) return;
    setCarouselCards((cards) => cards.map((card, cardIndex) => cardIndex === index ? { ...card, uploading: true } : card));
    try {
      const result = await whatsappTemplatesApi.uploadMedia(file, businessId);
      setCarouselCards((cards) => cards.map((card, cardIndex) => cardIndex === index ? { ...card, mediaHandle: result.handle, filename: file.name, uploading: false } : card));
    } catch (err) {
      setCarouselCards((cards) => cards.map((card, cardIndex) => cardIndex === index ? { ...card, uploading: false } : card));
      show(err instanceof ApiError ? err.userMessage : "Could not upload carousel image.", "error");
    }
  }

  const components: TemplateComponent[] = useMemo(() => {
    const list: TemplateComponent[] = [];
    if (category === "AUTHENTICATION") {
      list.push({ type: "BODY", add_security_recommendation: addSecurityRecommendation });
      list.push({ type: "FOOTER", code_expiration_minutes: codeExpirationMinutes });
      list.push({ type: "BUTTONS", buttons: [{ type: "OTP", text: otpType === "ONE_TAP" ? "Autofill" : "Copy code", otp_type: otpType }] });
      return list;
    }
    const bodyComp: TemplateComponent = { type: "BODY", text: bodyText.trim() };
    if (bodyVars.length > 0) {
      bodyComp.example = { body_text: [bodyVars.map((_, i) => bodySamples[i] || `Sample${i + 1}`)] };
    }
    if (templateMode === "carousel") {
      list.push(bodyComp);
      list.push({
        type: "CAROUSEL",
        cards: carouselCards.map((card) => ({ components: [
          { type: "HEADER", format: "IMAGE", example: { header_handle: [card.mediaHandle] } },
          { type: "BODY", text: card.body.trim() },
          { type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "View item" }] },
        ] })),
      });
      return list;
    }
    if (headerEnabled && headerText.trim()) {
      const comp: TemplateComponent = { type: "HEADER", format: "TEXT", text: headerText.trim() };
      if (headerVars.length > 0) {
        comp.example = { header_text: headerVars.map((_, i) => headerSamples[i] || `Sample${i + 1}`) };
      }
      list.push(comp);
    }
    list.push(bodyComp);
    if (footerEnabled && footerText.trim()) {
      list.push({ type: "FOOTER", text: footerText.trim() });
    }
    if (buttons.length > 0) {
      list.push({ type: "BUTTONS", buttons: buttons.filter((b) => b.text.trim()) });
    }
    return list;
  }, [category, addSecurityRecommendation, codeExpirationMinutes, otpType, templateMode, carouselCards, headerEnabled, headerText, headerVars, headerSamples, bodyText, bodyVars, bodySamples, footerEnabled, footerText, buttons]);

  const nameError = name && !/^[a-z0-9_]+$/.test(name) ? "Only lowercase letters, digits, and underscores allowed." : null;
  const buttonsValid = buttons.every((button) =>
    button.text.trim() &&
    (button.type !== "URL" || /^https:\/\//i.test(button.url || "")) &&
    (button.type !== "PHONE_NUMBER" || /^\+?[1-9]\d{7,14}$/.test(button.phone_number || "")) &&
    (button.type !== "FLOW" || Boolean(button.flow_id && button.navigate_screen))
  );
  const carouselValid = templateMode !== "carousel" || carouselCards.every((card) => card.body.trim() && card.mediaHandle && !card.uploading);
  const canSubmit = category === "AUTHENTICATION"
    ? Boolean(name.trim()) && !nameError && codeExpirationMinutes >= 1 && !isSubmitting
    : Boolean(name.trim()) && !nameError && Boolean(bodyText.trim()) && buttonsValid && carouselValid && !isSubmitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const res = await whatsappTemplatesApi.create({ name: name.trim(), category, language, components }, businessId);
      if (res.success) {
        show(`Template "${name}" submitted to Meta for approval.`, "success");
        onCreated();
      } else {
        show(res.error || "Meta rejected this template. Check the details and try again.", "error");
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.userMessage : "Couldn't create template. Please try again.";
      show(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.layout}>
      <div className={styles.formColumn}>
        <Card className={styles.section}>
          <div className={styles.sectionTitle}>Basics</div>
          <div className={styles.fieldGrid}>
            <Input
              label="Template name"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
              placeholder="order_confirmation"
              errorText={nameError ?? undefined}
            />
            <Select label="Language" value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </Select>
            <Select
              label="Template format"
              value={templateMode}
              disabled={category === "AUTHENTICATION"}
              onChange={(event) => {
                const mode = event.target.value as "standard" | "carousel";
                setTemplateMode(mode);
                if (mode === "carousel") setCategory("MARKETING");
              }}
            >
              <option value="standard">Standard message</option>
              <option value="carousel">Image carousel</option>
            </Select>
          </div>
        </Card>

        <Card className={styles.section}>
          <div className={styles.sectionTitle}>Category</div>
          <div className={styles.categoryGrid}>
            {(Object.keys(CATEGORY_INFO) as Category[]).map((cat) => (
              <button
                key={cat}
                type="button"
                className={`${styles.categoryOption} ${category === cat ? styles.categoryOptionActive : ""}`}
                onClick={() => { setCategory(cat); if (cat === "AUTHENTICATION") setTemplateMode("standard"); }}
                disabled={templateMode === "carousel" && cat !== "MARKETING"}
              >
                <div className={styles.categoryLabel}>{CATEGORY_INFO[cat].label}</div>
                <div className={styles.categoryDescription}>{CATEGORY_INFO[cat].description}</div>
              </button>
            ))}
          </div>
          <div className={styles.disclaimer}>
            <strong>Heads up:</strong> {CATEGORY_INFO[category].drawback}
          </div>
        </Card>

        {category === "AUTHENTICATION" && <Card className={styles.section}>
          <div className={styles.sectionTitle}>Code delivery</div>
          <div className={styles.fieldGrid}>
            <Select label="Button style" value={otpType} onChange={(e) => setOtpType(e.target.value as "COPY_CODE" | "ONE_TAP")}>
              <option value="COPY_CODE">Copy code - customer taps a button to copy the code</option>
              <option value="ONE_TAP">One-tap autofill - code fills into your app automatically (requires extra app setup with Meta)</option>
            </Select>
            <Input
              label="Code expires after (minutes)"
              type="number"
              min={1}
              max={90}
              value={String(codeExpirationMinutes)}
              onChange={(e) => setCodeExpirationMinutes(Math.max(1, Math.min(90, Number(e.target.value) || 1)))}
            />
          </div>
          <label className={styles.checkboxRow}>
            <input type="checkbox" checked={addSecurityRecommendation} onChange={(e) => setAddSecurityRecommendation(e.target.checked)} />
            Add Meta&apos;s standard &quot;don&apos;t share this code&quot; security line
          </label>
          <p className={styles.helperText}>
            You don&apos;t write the message text for authentication templates. Meta generates it from these choices
            so the format stays consistent and trusted. When you send this template later, you&apos;ll pass the actual
            OTP as the <code>{"{{1}}"}</code> value.
          </p>
        </Card>}

        {templateMode === "standard" && category !== "AUTHENTICATION" && <Card className={styles.section}>
          <div className={styles.sectionTitle}>
            Header (optional) {headerEnabled && <span className={styles.countHint}>{headerText.length}/60</span>}
          </div>
          <label className={styles.checkboxRow}>
            <input type="checkbox" checked={headerEnabled} onChange={(e) => setHeaderEnabled(e.target.checked)} />
            Add a header line
          </label>
          {headerEnabled && (
            <>
              <Input
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                placeholder="Order update from {{1}}"
                maxLength={60}
              />
              {headerVars.length > 0 && (
                <div className={styles.sampleGrid}>
                  {headerVars.map((v, i) => (
                    <Input
                      key={v}
                      label={`Sample for {{${v}}}`}
                      value={headerSamples[i] || ""}
                      onChange={(e) => setHeaderSamples((s) => { const next = [...s]; next[i] = e.target.value; return next; })}
                      placeholder="e.g. Acme Store"
                    />
                  ))}
                </div>
              )}
              <p className={styles.helperText}>Media headers (image/video/document) are coming soon, text headers only for now.</p>
            </>
          )}
        </Card>}

        {category !== "AUTHENTICATION" && <Card className={styles.section}>
          <div className={styles.sectionTitle}>
            Body <span className={styles.countHint}>{bodyText.length}/1024</span>
          </div>
          <Textarea
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            placeholder="Hi {{1}}, your order {{2}} has shipped and will arrive by {{3}}."
            rows={4}
            maxLength={1024}
          />
          {bodyVars.length > 0 && (
            <div className={styles.sampleGrid}>
              {bodyVars.map((v, i) => (
                <Input
                  key={v}
                  label={`Sample for {{${v}}}`}
                  value={bodySamples[i] || ""}
                  onChange={(e) => setBodySamples((s) => { const next = [...s]; next[i] = e.target.value; return next; })}
                  placeholder="e.g. John"
                />
              ))}
            </div>
          )}
          <p className={styles.helperText}>
            Use <code>{"{{1}}"}</code>, <code>{"{{2}}"}</code>… for values that change per customer. Meta requires a sample
            value for every variable before it will review the template.
          </p>
        </Card>}

        {templateMode === "carousel" && category !== "AUTHENTICATION" && (
          <Card className={styles.section}>
            <div className={styles.sectionTitle}>Carousel cards <span className={styles.countHint}>{carouselCards.length}/10</span></div>
            <p className={styles.helperText}>Use 2–10 cards. Each card needs review media and body text; all cards use the same quick-reply button structure required by Meta.</p>
            {carouselCards.map((card, index) => (
              <div className={styles.buttonEditor} key={index}>
                <strong>Card {index + 1}</strong>
                <Textarea
                  value={card.body}
                  onChange={(event) => setCarouselCards((cards) => cards.map((item, itemIndex) => itemIndex === index ? { ...item, body: event.target.value } : item))}
                  placeholder="Describe this item"
                  maxLength={160}
                />
                <label className={styles.checkboxRow}>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadCarouselImage(index, event.target.files?.[0])} />
                  {card.uploading ? "Uploading to Meta…" : card.filename || "Choose card image (max 5 MB)"}
                </label>
                {carouselCards.length > 2 && <Button variant="ghost" onClick={() => setCarouselCards((cards) => cards.filter((_, itemIndex) => itemIndex !== index))}>Remove card</Button>}
              </div>
            ))}
            {carouselCards.length < 10 && <Button variant="secondary" onClick={() => setCarouselCards((cards) => [...cards, { body: "", mediaHandle: "", filename: "", uploading: false }])}>+ Add carousel card</Button>}
          </Card>
        )}

        {templateMode === "standard" && category !== "AUTHENTICATION" && <Card className={styles.section}>
          <div className={styles.sectionTitle}>
            Footer (optional) {footerEnabled && <span className={styles.countHint}>{footerText.length}/60</span>}
          </div>
          <label className={styles.checkboxRow}>
            <input type="checkbox" checked={footerEnabled} onChange={(e) => setFooterEnabled(e.target.checked)} />
            Add a footer line
          </label>
          {footerEnabled && (
            <Input
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder="Reply STOP to opt out"
              maxLength={60}
            />
          )}
        </Card>}

        {templateMode === "standard" && category !== "AUTHENTICATION" && <Card className={styles.section}>
          <div className={styles.sectionTitle}>
            Buttons (optional) <span className={styles.countHint}>{buttons.length}/3</span>
          </div>
          {buttons.map((btn, i) => (
            <div key={i} className={styles.buttonEditor}>
              <Select value={btn.type} onChange={(e) => updateButton(i, { type: e.target.value as TemplateButton["type"] })}>
                <option value="QUICK_REPLY">Quick reply</option>
                <option value="URL">Website URL</option>
                <option value="PHONE_NUMBER">Call phone number</option>
                <option value="FLOW">Open WhatsApp form</option>
              </Select>
              <Input
                value={btn.text}
                onChange={(e) => updateButton(i, { text: e.target.value })}
                placeholder="Button text"
                maxLength={25}
              />
              {btn.type === "URL" && (
                <Input value={btn.url || ""} onChange={(e) => updateButton(i, { url: e.target.value })} placeholder="https://example.com" />
              )}
              {btn.type === "PHONE_NUMBER" && (
                <Input value={btn.phone_number || ""} onChange={(e) => updateButton(i, { phone_number: e.target.value })} placeholder="+14155552671" />
              )}
              {btn.type === "FLOW" && (
                <>
                  <Select value={btn.flow_id || ""} onChange={(e) => {
                    const flow = metaFlows?.find((item) => item.id === e.target.value);
                    updateButton(i, { flow_id: flow?.id || "", flow_name: flow?.name || "", navigate_screen: flow ? "FORM" : "" });
                  }} disabled={flowsLoading}>
                    <option value="">Select a published Meta Flow</option>
                    {metaFlows?.filter((flow) => flow.status === "PUBLISHED").map((flow) => (
                      <option key={flow.id} value={flow.id}>{flow.name}</option>
                    ))}
                  </Select>
                  <Input value={btn.navigate_screen || ""} onChange={(e) => updateButton(i, { navigate_screen: e.target.value })} placeholder="First screen ID (from Flow JSON)" />
                  {!flowsLoading && !metaFlows?.some((flow) => flow.status === "PUBLISHED") && (
                    <p className={styles.helperText}>No published Meta Flow is available yet. <Link href="/channels/whatsapp-studio/forms">Build and publish one in WhatsApp Studio</Link>, then return here.</p>
                  )}
                </>
              )}
              <Button variant="ghost" onClick={() => removeButton(i)}>
                Remove
              </Button>
            </div>
          ))}
          {buttons.length < 3 && (
            <div className={styles.addButtonRow}>
              <Button variant="secondary" onClick={() => addButton("QUICK_REPLY")}>
                + Quick reply
              </Button>
              <Button variant="secondary" onClick={() => addButton("URL")}>
                + URL button
              </Button>
              <Button variant="secondary" onClick={() => addButton("PHONE_NUMBER")}>
                + Call button
              </Button>
              <Button variant="secondary" onClick={() => addButton("FLOW")}>
                + WhatsApp form
              </Button>
            </div>
          )}
        </Card>}

        <div className={styles.submitRow}>
          <Button onClick={handleSubmit} isLoading={isSubmitting} disabled={!canSubmit}>
            Submit to Meta for approval
          </Button>
        </div>
      </div>

      <div className={styles.previewColumn}>
        <div className={styles.previewSticky}>
          <div className={styles.previewLabel}>
            Live preview <Badge variant="neutral">PENDING after submit</Badge>
          </div>
          <TemplatePreview components={components} />
          <p className={styles.previewNote}>
            This is a simulation: Meta typically reviews templates within a few minutes to a day. Marketing templates
            can take longer and are more likely to be rejected for promotional language outside the Marketing category.
            You&apos;ll get a notification and the status here will update automatically once Meta decides, no need to
            keep checking back, though you can always hit Sync on the list to check sooner.
          </p>
        </div>
      </div>
    </div>
  );
}
