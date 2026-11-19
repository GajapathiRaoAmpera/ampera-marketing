"use client";

import { useEffect, useState } from "react";
import { ApiError, businessesApi, websiteScrapeApi } from "@/lib/api";
import type { ScrapeCandidateProduct, ScrapedPage, StoredWebsiteContent } from "@/lib/api/websiteScrape";
import { useBusiness } from "@/context/BusinessContext";
import { useToast } from "@/context/ToastContext";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import { Badge, Button, Card, EmptyState, InfoLabel, Input, Modal, Skeleton, Tabs, Textarea } from "@/components/ui";
import { BuildingIcon, GlobeIcon, PlusIcon } from "@/components/layout/icons";
import type { Business, FAQItem } from "@/types/api";
import styles from "@/app/(dashboard)/business-profile/page.module.scss";
import { useEmbedded } from "@/components/layout/Embedded";

const FIELD_LIMITS = {
  description: 1500,
  products_services: 4000,
  pricing: 2500,
  policies: 4000,
  additional_info: 4000,
} as const;
const SOURCE_LIMIT = 2_000_000;

const FIELD_HELP = {
  website: "The public website to scan for business facts and AI knowledge.",
  name: "The business name customers should see in conversations.",
  location: "Your address, service area, or a note that the business is online-only.",
  working_hours: "Include opening hours, timezone, and any weekend differences.",
  description: "A short explanation of what the business does and who it serves.",
  products_services: "List the main products or services customers can ask the AI about.",
  pricing: "Add prices, starting prices, packages, or how customers can request a quote.",
  policies: "Add relevant return, refund, shipping, cancellation, or privacy policies.",
  additional_info: "Add useful customer-facing details that do not fit elsewhere.",
} as const;

function infoLabel(label: string, help: string) {
  return <InfoLabel help={help}>{label}</InfoLabel>;
}

interface ProfileForm {
  name: string;
  website: string;
  description: string;
  location: string;
  working_hours: string;
  products_services: string;
  pricing: string;
  policies: string;
  additional_info: string;
}

function initialForm(business: Business): ProfileForm {
  return {
    name: business.name ?? "",
    website: business.website ?? "",
    description: business.description ?? "",
    location: business.location ?? "",
    working_hours: business.working_hours ?? "",
    products_services: business.products_services ?? "",
    pricing: business.pricing ?? "",
    policies: business.policies ?? "",
    additional_info: business.additional_info ?? "",
  };
}

function BusinessProfileEditor({ business }: { business: Business }) {
  const embedded = useEmbedded();
  const { refresh } = useBusiness();
  const { show } = useToast();
  const [form, setForm] = useState<ProfileForm>(() => initialForm(business));
  const [faqs, setFaqs] = useState<FAQItem[]>(() => business.faqs ?? []);
  const [sourceContent, setSourceContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourcePages, setSourcePages] = useState<ScrapedPage[]>([]);
  const [products, setProducts] = useState<ScrapeCandidateProduct[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [isSourceDirty, setIsSourceDirty] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [sources, setSources] = useState<StoredWebsiteContent[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState(true);
  const [isSourcesModalOpen, setIsSourcesModalOpen] = useState(false);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [extraSites, setExtraSites] = useState<string[]>([]);
  const [isScrapingExtra, setIsScrapingExtra] = useState(false);

  async function loadSources() {
    setIsLoadingSources(true);
    try {
      const list = await websiteScrapeApi.sources(business.id);
      setSources(list);
      const primary = list.find((item) => item.source_url === (form.website || business.website)) ?? list[0];
      if (primary) {
        setSourceContent(primary.source_content);
        setSourceUrl(primary.source_url);
        setSourcePages(primary.pages.map((page) => ({ ...page, content: "" })));
      }
    } catch {
      // Website knowledge is optional; a failed fetch leaves the editor blank.
    } finally {
      setIsLoadingSources(false);
    }
  }

  useEffect(() => {
    loadSources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business.id]);

  function updateForm(key: keyof ProfileForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function scanWebsite(): Promise<boolean> {
    if (!form.website.trim()) return false;
    setIsScraping(true);
    try {
      const preview = await websiteScrapeApi.preview(business.id, form.website.trim());
      setForm((current) => ({
        ...current,
        name: preview.extracted.name || current.name,
        website: preview.scraped_url,
        description: preview.extracted.description || current.description,
        location: preview.extracted.location || current.location,
        working_hours: preview.extracted.working_hours || current.working_hours,
        products_services: preview.extracted.products_services || current.products_services,
        pricing: preview.extracted.pricing || current.pricing,
        policies: preview.extracted.policies || current.policies,
        additional_info: preview.extracted.additional_info || current.additional_info,
      }));
      if (preview.extracted.faqs.length) setFaqs(preview.extracted.faqs);
      setSourceContent(preview.source_content);
      setIsSourceDirty(true);
      setSourceUrl(preview.scraped_url);
      setSourcePages(preview.pages);
      setProducts(preview.candidate_products);
      setSelectedProducts(new Set(preview.candidate_products.map((_, index) => index)));
      const renderedPages = preview.pages.filter((page) => page.extraction_mode === "browser").length;
      const renderedNote = renderedPages
        ? ` ${renderedPages} JavaScript page${renderedPages === 1 ? " was" : "s were"} fully rendered.`
        : "";
      show(`Scanned ${preview.pages.length} page${preview.pages.length === 1 ? "" : "s"}.${renderedNote} Review everything before saving.`, "success");
      return true;
    } catch (error) {
      show(error instanceof ApiError ? error.userMessage : "Couldn't scan that website.", "error");
      return false;
    } finally {
      setIsScraping(false);
    }
  }

  async function saveProfile() {
    let scanFailed = false;
    if (form.website.trim() && form.website.trim() !== sourceUrl && form.website.trim() !== (business.website ?? "")) {
      const scanned = await scanWebsite();
      if (scanned) {
        show("We found content from this new website. Review it, then save again.", "default");
        return;
      }
      // Website enrichment is optional. A blocked or temporarily unavailable
      // site must not prevent the manually entered profile from being saved.
      scanFailed = true;
    }
    setIsSaving(true);
    try {
      const fields = { ...form, faqs: faqs.filter((faq) => faq.question.trim() || faq.answer.trim()) };
      if (!scanFailed && sourceContent && form.website.trim() && (isSourceDirty || products.length > 0)) {
        const confirmation = await websiteScrapeApi.confirm(business.id, {
          fields,
          products_to_add: products.filter((_, index) => selectedProducts.has(index)),
          source_content: sourceContent,
          source_pages: sourcePages,
        });
        confirmation.warnings?.forEach((warning) => show(warning.message, "default"));
      } else {
        await businessesApi.update(business.id, fields);
      }
      await refresh();
      setProducts([]);
      setSelectedProducts(new Set());
      setIsSourceDirty(false);
      if (scanFailed) {
        setSourceContent("");
        setSourcePages([]);
      }
      setSourceUrl(form.website.trim());
      await loadSources();
      show(
        scanFailed
          ? "Business profile saved. The website could not be scanned, so you can add its knowledge later."
          : "Business profile and AI knowledge saved.",
        "success"
      );
    } catch (error) {
      show(error instanceof ApiError ? error.userMessage : "Couldn't save the business profile.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  function addExtraSiteField() {
    setExtraSites((current) => [...current, ""]);
  }

  function updateExtraSite(index: number, value: string) {
    setExtraSites((current) => current.map((site, i) => (i === index ? value : site)));
  }

  function removeExtraSiteField(index: number) {
    setExtraSites((current) => current.filter((_, i) => i !== index));
  }

  async function scanExtraSites() {
    const urls = extraSites.map((site) => site.trim()).filter(Boolean);
    if (!urls.length) return;
    setIsScrapingExtra(true);
    let scanned = 0;
    try {
      for (const url of urls) {
        try {
          const preview = await websiteScrapeApi.preview(business.id, url);
          await websiteScrapeApi.confirm(business.id, {
            fields: {},
            products_to_add: [],
            source_content: preview.source_content,
            source_pages: preview.pages,
            source_url: preview.scraped_url,
          });
          scanned += 1;
        } catch (error) {
          show(error instanceof ApiError ? error.userMessage : `Couldn't scan ${url}.`, "error");
        }
      }
      if (scanned) {
        setExtraSites([]);
        await loadSources();
        show(`Added ${scanned} site${scanned === 1 ? "" : "s"} to the knowledge base.`, "success");
      }
    } finally {
      setIsScrapingExtra(false);
    }
  }

  async function removeSource(sourceId: string) {
    try {
      await websiteScrapeApi.removeSource(business.id, sourceId);
      setSources((current) => current.filter((item) => item.id !== sourceId));
      show("Website source removed.", "success");
    } catch (error) {
      show(error instanceof ApiError ? error.userMessage : "Couldn't remove that source.", "error");
    }
  }

  function openSourcesModal() {
    setActiveSourceId((current) => current ?? sources[0]?.id ?? null);
    setIsSourcesModalOpen(true);
  }

  return (
    <div className={styles.page}>
      {!embedded && (
        <div className={styles.header}>
          <div className={styles.headingIcon}><BuildingIcon size={24} /></div>
          <div>
            <div className={styles.eyebrow}>Current business</div>
            <h1>{business.name}</h1>
            <p>Shape the facts your AI agent uses in every customer conversation.</p>
          </div>
          <Badge variant="success">Used by your AI</Badge>
        </div>
      )}

      <Card className={styles.websiteCard}>
        <div className={styles.cardHeading}>
          <span className={styles.cardIcon}><GlobeIcon size={22} /></span>
          <div><h2>Start with your website</h2><p>We scan useful pages, organize the information, and let you approve it before anything changes.</p></div>
        </div>
        <div className={styles.websiteRow}>
          <Input label={infoLabel("Business website", FIELD_HELP.website)} placeholder="https://yourbusiness.com" value={form.website} onChange={(event) => updateForm("website", event.target.value)} />
          <Button variant="secondary" onClick={openSourcesModal} disabled={isLoadingSources || sources.length === 0}>View scraped content</Button>
          <Button onClick={scanWebsite} isLoading={isScraping} disabled={!form.website.trim()}>Scan &amp; organize</Button>
        </div>
        {sourceContent && (
          <div className={styles.scanSummary}>
            <span className={styles.readyDot} />
            <strong>{sources.length || 1} site{sources.length === 1 ? "" : "s"} captured</strong>
            <span>{sourceContent.length.toLocaleString()} characters</span>
            <span>Full source indexed for AI answers</span>
          </div>
        )}

        <div className={styles.extraSites}>
          {extraSites.map((site, index) => (
            <div className={styles.extraSiteRow} key={index}>
              <Input
                aria-label={`Additional site ${index + 1}`}
                placeholder="https://anotherpage.com"
                value={site}
                onChange={(event) => updateExtraSite(index, event.target.value)}
              />
              <Button variant="ghost" size="sm" onClick={() => removeExtraSiteField(index)}>Remove</Button>
            </div>
          ))}
          <div className={styles.extraSiteActions}>
            <Button variant="ghost" size="sm" leftIcon={<PlusIcon />} onClick={addExtraSiteField}>Add another site</Button>
            {extraSites.some((site) => site.trim()) && (
              <Button size="sm" onClick={scanExtraSites} isLoading={isScrapingExtra}>Scan added sites</Button>
            )}
          </div>
        </div>
      </Card>

      <div className={styles.twoColumn}>
        <div className={styles.mainColumn}>
          <Card>
            <div className={styles.cardHeading}>
              <span className={styles.cardIcon}><BuildingIcon size={21} /></span>
              <div><h2>Organized business profile</h2><p>Concise customer-facing facts. Character limits keep everyday replies focused.</p></div>
            </div>
            <div className={styles.fieldGrid}>
              <Input label={infoLabel("Business name", FIELD_HELP.name)} value={form.name} maxLength={200} onChange={(event) => updateForm("name", event.target.value)} />
              <Input label={infoLabel("Location", FIELD_HELP.location)} value={form.location} maxLength={500} onChange={(event) => updateForm("location", event.target.value)} />
              <Input label={infoLabel("Working hours", FIELD_HELP.working_hours)} value={form.working_hours} maxLength={750} onChange={(event) => updateForm("working_hours", event.target.value)} />
            </div>
            {(Object.keys(FIELD_LIMITS) as Array<keyof typeof FIELD_LIMITS>).map((key) => (
              <Textarea
                key={key}
                label={infoLabel(
                  { description: "Description", products_services: "Products & services", pricing: "Pricing", policies: "Policies", additional_info: "Additional information" }[key],
                  FIELD_HELP[key]
                )}
                value={form[key]}
                maxLength={FIELD_LIMITS[key]}
                showCharCount
                rows={key === "products_services" || key === "policies" ? 5 : 3}
                onChange={(event) => updateForm(key, event.target.value)}
              />
            ))}
          </Card>

          <Card>
            <div className={styles.cardHeading}><div><h2>Frequently asked questions</h2><p>Answers are included directly in the agent&apos;s business context.</p></div></div>
            <div className={styles.faqList}>
              {faqs.map((faq, index) => (
                <div className={styles.faqRow} key={index}>
                  <Input aria-label={`FAQ ${index + 1} question`} placeholder="Question" value={faq.question} maxLength={300} onChange={(event) => setFaqs((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, question: event.target.value } : item))} />
                  <Textarea aria-label={`FAQ ${index + 1} answer`} placeholder="Answer" value={faq.answer} maxLength={1500} rows={2} onChange={(event) => setFaqs((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, answer: event.target.value } : item))} />
                  <Button variant="ghost" size="sm" onClick={() => setFaqs((items) => items.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button>
                </div>
              ))}
            </div>
            <Button variant="secondary" size="sm" onClick={() => setFaqs((items) => [...items, { question: "", answer: "" }])}>+ Add FAQ</Button>
          </Card>
        </div>

        {products.length > 0 && (
          <aside className={styles.sourceColumn}>
            <Card>
              <div className={styles.cardHeading}><div><h2>Products found</h2><p>Selected products will be added when you save.</p></div></div>
              <div className={styles.products}>{products.map((product, index) => <label key={`${product.name}-${index}`}><input type="checkbox" checked={selectedProducts.has(index)} onChange={() => setSelectedProducts((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next; })} /><span><strong>{product.name}</strong>{product.description && <small>{product.description}</small>}</span></label>)}</div>
            </Card>
          </aside>
        )}
      </div>

      <div className={styles.saveBar}>
        <div><strong>Review before saving</strong><span>Profile edits and full website knowledge are applied together.</span></div>
        <Button onClick={saveProfile} isLoading={isSaving} disabled={!form.name.trim()}>Save business profile</Button>
      </div>

      <Modal
        isOpen={isSourcesModalOpen}
        onClose={() => setIsSourcesModalOpen(false)}
        title="Scraped content"
        size="xl"
      >
        {sources.length === 0 ? (
          <div className={styles.emptySource}><GlobeIcon size={28} /><strong>No website knowledge yet</strong><span>Enter your website above to create an editable source.</span></div>
        ) : (
          <div className={styles.sourcesModal}>
            {sources.length > 1 && (
              <Tabs
                options={sources.map((source) => ({ value: source.id, label: new URL(source.source_url).hostname + new URL(source.source_url).pathname.replace(/\/$/, "") }))}
                value={activeSourceId ?? sources[0].id}
                onChange={setActiveSourceId}
              />
            )}
            {sources
              .filter((source) => source.id === (activeSourceId ?? sources[0].id))
              .map((source) => (
                <div key={source.id} className={styles.sourceDetail}>
                  <div className={styles.sourceDetailHeader}>
                    <a href={source.source_url} target="_blank" rel="noreferrer">{source.source_url}</a>
                    <Button variant="danger" size="sm" onClick={() => removeSource(source.id)}>Remove site</Button>
                  </div>
                  <Textarea
                    aria-label={`Scraped content for ${source.source_url}`}
                    value={source.id === (activeSourceId ?? sources[0].id) && source.source_url === sourceUrl ? sourceContent : source.source_content}
                    onChange={(event) => {
                      if (source.source_url === sourceUrl) {
                        setSourceContent(event.target.value);
                        setIsSourceDirty(true);
                      }
                      setSources((current) => current.map((item) => item.id === source.id ? { ...item, source_content: event.target.value } : item));
                    }}
                    maxLength={SOURCE_LIMIT}
                    showCharCount
                    rows={16}
                    helperText={source.source_url === sourceUrl
                      ? "This is the primary source. Edits here are saved together with the business profile below."
                      : "Additional sources are saved immediately when scanned and aren't affected by the profile save bar."}
                  />
                  {source.pages.length > 0 && (
                    <details className={styles.pageList}>
                      <summary>Pages included ({source.pages.length})</summary>
                      {source.pages.map((page) => (
                        <a href={page.url} target="_blank" rel="noreferrer" key={page.url}>
                          <span className={styles.pageAddress}>{page.url}<small>{page.extraction_mode === "browser" ? "JavaScript rendered" : page.extraction_mode === "pdf" ? "PDF extracted" : "HTML extracted"}{page.truncated ? " · source limit reached" : ""}</small></span>
                          <span>{page.character_count.toLocaleString()} chars</span>
                        </a>
                      ))}
                    </details>
                  )}
                </div>
              ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function BusinessProfilePage() {
  const { business, isLoading, hasNoBusinesses } = useActiveBusiness();
  if (isLoading) return <Skeleton height={420} />;
  if (hasNoBusinesses || !business) return <EmptyState title="No business selected" description="Create or select a business to manage its profile." />;
  return <BusinessProfileEditor key={business.id} business={business} />;
}
