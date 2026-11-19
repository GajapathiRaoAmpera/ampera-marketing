"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ApiError, businessesApi, websiteScrapeApi } from "@/lib/api";
import type { ScrapePreview } from "@/lib/api/websiteScrape";
import { useBusiness } from "@/context/BusinessContext";
import { useToast } from "@/context/ToastContext";
import { Button, Card, InfoLabel, Input, ProgressBar, Textarea } from "@/components/ui";
import { ONBOARDING_STEPS, stepCompletion } from "@/components/features/onboarding/onboarding-steps";
import type { Business, FAQItem } from "@/types/api";
import styles from "./page.module.scss";

type FormState = Record<string, string>;

const FIELD_HELP: Record<string, string> = {
  name: "The business name customers should see.",
  description: "Briefly explain what your business does and who it serves.",
  location: "Add an address, service area, or say that the business is online-only.",
  website: "We can scan this public site to organize business facts for your AI.",
  working_hours: "Include your timezone and any weekend differences.",
  products_services: "List the main products or services customers can ask about.",
  pricing: "Add prices, packages, starting prices, or how to request a quote.",
  policies: "Add return, refund, shipping, cancellation, or privacy policies.",
  additional_info: "Include any useful customer-facing facts that do not fit elsewhere.",
  faqs: "Add common customer questions and the exact answers your AI should use.",
};

function infoLabel(label: string, field: string) {
  return <InfoLabel help={FIELD_HELP[field]}>{label}</InfoLabel>;
}

export default function OnboardingPage() {
  const { businesses, activeBusiness, isLoading, refresh, setActiveBusinessId } = useBusiness();
  const { show } = useToast();
  const router = useRouter();

  const [business, setBusiness] = useState<Business | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState<FormState>({});
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [websitePreview, setWebsitePreview] = useState<ScrapePreview | null>(null);
  const [selectedWebsiteProducts, setSelectedWebsiteProducts] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!isLoading && businesses.length > 0 && !activeBusiness) {
      setActiveBusinessId(businesses[0].id);
    }
  }, [isLoading, businesses, activeBusiness, setActiveBusinessId]);

  /* Existing business selection is mirrored into this multi-step draft. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (activeBusiness) {
      setBusiness(activeBusiness);
      setForm(
        Object.fromEntries(
          Object.entries(activeBusiness).filter(([, v]) => typeof v === "string" || v === undefined)
        ) as FormState
      );
      setFaqs(activeBusiness.faqs ?? []);
    }
  }, [activeBusiness]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const isComplete = business?.onboarding?.is_complete ?? false;

  const steps = useMemo(
    () => {
      const missingFields = business?.onboarding?.missing_fields ?? [];
      return ONBOARDING_STEPS.map((step) => ({ ...step, completion: stepCompletion(step, missingFields) }));
    },
    [business?.onboarding?.missing_fields]
  );

  const totalDone = steps.reduce((sum, s) => sum + s.completion.done, 0);
  const totalFields = steps.reduce((sum, s) => sum + s.completion.total, 0);

  async function handleCreateBusiness() {
    setIsCreating(true);
    try {
      const created = await businessesApi.create({ name: form.name || "My Business" });
      show("Business created, let's finish setting it up.", "success");
      await refresh();
      setActiveBusinessId(created.id);
    } catch {
      show("Couldn't create your business. Please try again.", "error");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleSaveStep(): Promise<Business | null> {
    if (!business) return null;
    setIsSaving(true);
    try {
      const step = ONBOARDING_STEPS[activeStep];
      const payload: Partial<Business> = Object.fromEntries(
        step.fields.filter((field) => field !== "faqs").map((field) => [field, form[field] ?? ""])
      );
      if (step.id === "basics") payload.name = form.name || business.name;
      if (step.id === "guidance") {
        payload.faqs = faqs.filter((faq) => faq.question.trim() || faq.answer.trim());
      }
      const website = form.website?.trim();
      if (step.id === "contact" && website && website !== (business.website ?? "") && websitePreview?.scraped_url !== website) {
        try {
          const preview = await websiteScrapeApi.preview(business.id, website);
          setWebsitePreview(preview);
          setSelectedWebsiteProducts(new Set(preview.candidate_products.map((_, index) => index)));
          show(`We scanned ${preview.pages.length} page${preview.pages.length === 1 ? "" : "s"}. Review the content before continuing.`, "success");
          return null;
        } catch {
          setWebsitePreview(null);
          setSelectedWebsiteProducts(new Set());
          show("The website could not be scanned, but your setup can continue. You can retry it later from Business profile.", "default");
        }
      }

      let updated: Business;
      if (step.id === "contact" && websitePreview) {
        try {
          const confirmation = await websiteScrapeApi.confirm(business.id, {
            fields: { ...websitePreview.extracted, website },
            products_to_add: websitePreview.candidate_products.filter((_, index) => selectedWebsiteProducts.has(index)),
            source_content: websitePreview.source_content,
            source_pages: websitePreview.pages,
          });
          confirmation.warnings?.forEach((warning) => show(warning.message, "default"));
          setWebsitePreview(null);
        } catch {
          show("Website knowledge could not be saved, but the details you entered were kept.", "default");
        }
        updated = await businessesApi.update(business.id, payload);
      } else {
        updated = await businessesApi.update(business.id, payload);
      }
      setBusiness(updated);
      show("Saved.", "success");
      if (activeStep < ONBOARDING_STEPS.length - 1) {
        setActiveStep((s) => s + 1);
      } else if (updated.onboarding?.is_complete) {
        show("Your business is fully set up!", "success");
      }
      return updated;
    } catch (error) {
      show(error instanceof ApiError ? error.userMessage : "Couldn't save. Please check your inputs and try again.", "error");
    } finally {
      setIsSaving(false);
    }
    return null;
  }

  if (isLoading) return null;

  if (!business) {
    return (
      <Card style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className={styles.stepHeading}>Create your business</div>
        <p className={styles.stepDescription}>
          This becomes the home for your AI agent, conversations, and everything else.
        </p>
        <Input
          label={infoLabel("Business name", "name")}
          required
          value={form.name ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Acme Dental Clinic"
        />
        <div style={{ marginTop: "var(--space-5)" }}>
          <Button fullWidth onClick={handleCreateBusiness} isLoading={isCreating} disabled={!form.name}>
            Create business
          </Button>
        </div>
      </Card>
    );
  }

  const step = ONBOARDING_STEPS[activeStep];

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>Set up {business.name}</h1>
        <p className={styles.subtitle}>Complete these steps to get your AI agent ready to talk to customers.</p>
      </div>

      <div className={styles.layout}>
        <div className={styles.sidebar}>
          <Card padding="sm" className={styles.progressCard}>
            <ProgressBar value={totalDone} max={totalFields} label="Required setup progress" />
          </Card>
          <Card padding="none">
            {steps.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className={clsx(styles.stepButton, i === activeStep && styles.stepButtonActive)}
                onClick={() => setActiveStep(i)}
              >
                <span
                  className={clsx(
                    styles.stepCircle,
                    s.completion.done === s.completion.total && styles.stepCircleDone,
                    i === activeStep && styles.stepCircleActive
                  )}
                >
                  {s.completion.done === s.completion.total ? "✓" : i + 1}
                </span>
                <span className={styles.stepInfo}>
                  <div className={styles.stepTitle}>{s.title}</div>
                  <div className={styles.stepMeta}>
                    {s.completion.total === 0
                      ? "Optional"
                      : `${s.completion.done}/${s.completion.total} required`}
                  </div>
                </span>
              </button>
            ))}
          </Card>
        </div>

        <Card className={styles.formCard}>
          {isComplete && (
            <div
              style={{
                padding: "var(--space-3) var(--space-4)",
                background: "var(--color-success-50)",
                color: "var(--color-success-600)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--font-size-sm)",
              }}
            >
              Required business details are complete. You can now configure your AI agent or edit these details.
            </div>
          )}

          <div>
            <div className={styles.stepHeading}>{step.title}</div>
            <p className={styles.stepDescription}>{step.description}</p>
          </div>

          <div className={styles.fieldGrid}>
            {step.id === "basics" && (
              <>
                <Input
                  label={infoLabel("Business name", "name")}
                  value={form.name ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
                <div className={styles.fullWidth}>
                  <Textarea
                    label={infoLabel("Description", "description")}
                    value={form.description ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="What does your business do?"
                  />
                </div>
                <Input
                  label={infoLabel("Location", "location")}
                  value={form.location ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="Pune, Maharashtra or Online only"
                />
              </>
            )}

            {step.id === "contact" && (
              <>
                <Input
                  label={infoLabel("Website (optional)", "website")}
                  value={form.website ?? ""}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, website: e.target.value }));
                    setWebsitePreview(null);
                  }}
                  placeholder="https://"
                  helperText="When you continue, we'll scan and organize the site for you to review."
                />
                <Input
                  label={infoLabel("Working hours", "working_hours")}
                  value={form.working_hours ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, working_hours: e.target.value }))}
                  placeholder="Mon–Fri, 9:00 AM–6:00 PM IST"
                />
                {websitePreview && (
                  <div className={styles.fullWidth}>
                    <div className={styles.websiteReview}>
                      <div className={styles.websiteReviewHeader}>
                        <div>
                          <strong>Review website knowledge</strong>
                          <span>{websitePreview.pages.length} pages · {websitePreview.source_content.length.toLocaleString()} characters</span>
                        </div>
                        <span>Nothing is saved until you continue</span>
                      </div>
                      <Textarea
                        label="Full scraped content used by your AI"
                        value={websitePreview.source_content}
                        onChange={(event) => setWebsitePreview((current) => current ? { ...current, source_content: event.target.value, source_character_count: event.target.value.length } : current)}
                        maxLength={500000}
                        showCharCount
                        rows={12}
                        helperText="Summary field limits do not remove anything from this full source."
                      />
                      {websitePreview.candidate_products.length > 0 && (
                        <div className={styles.websiteProducts}>
                          <strong>Products found</strong>
                          {websitePreview.candidate_products.map((product, index) => (
                            <label key={`${product.name}-${index}`}>
                              <input type="checkbox" checked={selectedWebsiteProducts.has(index)} onChange={() => setSelectedWebsiteProducts((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next; })} />
                              <span>{product.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {step.id === "offerings" && (
              <>
                <div className={styles.fullWidth}>
                  <Textarea
                    label={infoLabel("Products & services", "products_services")}
                    value={form.products_services ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, products_services: e.target.value }))}
                    placeholder="What can customers buy or book?"
                    rows={5}
                  />
                </div>
                <div className={styles.fullWidth}>
                  <Textarea
                    label={infoLabel("Pricing (optional)", "pricing")}
                    value={form.pricing ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, pricing: e.target.value }))}
                    placeholder="Prices, packages, discounts, or quote instructions"
                  />
                </div>
              </>
            )}

            {step.id === "guidance" && (
              <>
                <div className={styles.fullWidth}>
                  <Textarea
                    label={infoLabel("Policies (optional)", "policies")}
                    value={form.policies ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, policies: e.target.value }))}
                    placeholder="Returns, refunds, cancellations, shipping, and privacy"
                  />
                </div>
                <div className={styles.fullWidth}>
                  <Textarea
                    label={infoLabel("Additional information (optional)", "additional_info")}
                    value={form.additional_info ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, additional_info: e.target.value }))}
                    placeholder="Anything else customers commonly need to know"
                  />
                </div>
                <div className={styles.fullWidth}>
                  <div className={styles.faqHeading}>
                    {infoLabel("Frequently asked questions (optional)", "faqs")}
                    <Button variant="secondary" size="sm" onClick={() => setFaqs((items) => [...items, { question: "", answer: "" }])}>
                      + Add FAQ
                    </Button>
                  </div>
                  <div className={styles.faqList}>
                    {faqs.map((faq, index) => (
                      <div className={styles.faqRow} key={index}>
                        <Input
                          aria-label={`FAQ ${index + 1} question`}
                          placeholder="Question"
                          value={faq.question}
                          onChange={(event) => setFaqs((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, question: event.target.value } : item))}
                        />
                        <Textarea
                          aria-label={`FAQ ${index + 1} answer`}
                          placeholder="Answer"
                          value={faq.answer}
                          rows={2}
                          onChange={(event) => setFaqs((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, answer: event.target.value } : item))}
                        />
                        <Button variant="ghost" size="sm" onClick={() => setFaqs((items) => items.filter((_, itemIndex) => itemIndex !== index))}>
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className={styles.footer}>
            <span className={styles.saveHint}>Changes save when you continue.</span>
            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              {activeStep > 0 && (
                <Button variant="secondary" onClick={() => setActiveStep((s) => s - 1)}>
                  Back
                </Button>
              )}
              {activeStep === ONBOARDING_STEPS.length - 1 ? (
                <Button onClick={async () => {
                  const updated = await handleSaveStep();
                  if (updated?.onboarding?.is_complete) router.push("/agent-config");
                }} isLoading={isSaving}>
                  Save &amp; configure agent
                </Button>
              ) : (
                <Button onClick={handleSaveStep} isLoading={isSaving}>
                  Save &amp; continue
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
