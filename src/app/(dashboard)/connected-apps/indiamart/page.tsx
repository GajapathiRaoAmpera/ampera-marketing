"use client";

import { useState } from "react";
import { indiamartApi } from "@/lib/api/indiamart";
import type { IndiaMartCandidateProduct, IndiaMartCatalogPreview, IndiaMartLead } from "@/lib/api/indiamart";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/context/ToastContext";
import { ApiError } from "@/lib/api";
import { Badge, Button, Card, EmptyState, Input, Skeleton } from "@/components/ui";
import styles from "../page.module.scss";
import pageStyles from "./page.module.scss";
import { AppHeader } from "@/components/features/hubs/AppHeader";

export default function IndiaMartPage() {
  const { businessId, isLoading: businessLoading, hasNoBusinesses } = useActiveBusiness();
  const { show } = useToast();

  const [crmKey, setCrmKey] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const { data: status, refresh: refreshStatus } = useAsync(
    () => (businessId ? indiamartApi.status(businessId) : Promise.resolve(null)),
    [businessId]
  );
  const { data: leads, refresh: refreshLeads } = useAsync(
    () => (businessId ? indiamartApi.listLeads(businessId) : Promise.resolve([])),
    [businessId]
  );

  async function handleConnect() {
    if (!businessId || !crmKey.trim()) return;
    setIsConnecting(true);
    try {
      const result = await indiamartApi.connect(businessId, crmKey.trim());
      if (result.verified) {
        show("IndiaMART connected.", "success");
      } else {
        show("CRM key saved, but the verification pull failed. Check the key and try Pull leads.", "error");
      }
      setCrmKey("");
      refreshLeads();
      refreshStatus();
    } catch (err) {
      const message = err instanceof ApiError ? err.userMessage : "Couldn't connect IndiaMART. Check your CRM key.";
      show(message, "error");
    } finally {
      setIsConnecting(false);
    }
  }

  async function handlePull() {
    if (!businessId) return;
    setIsPulling(true);
    try {
      const result = await indiamartApi.pullLeads(businessId);
      show(`Pulled ${result.pulled} lead${result.pulled === 1 ? "" : "s"} (${result.saved} saved).`, "success");
      refreshLeads();
      refreshStatus();
    } catch (err) {
      const message = err instanceof ApiError ? err.userMessage : "Couldn't pull leads. Please try again.";
      show(message, "error");
    } finally {
      setIsPulling(false);
    }
  }

  async function handleDisconnect() {
    if (!businessId) return;
    try {
      await indiamartApi.disconnect(businessId);
      show("IndiaMART disconnected. Leads already pulled are kept.", "default");
      refreshStatus();
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't disconnect. Please try again.", "error");
    }
  }

  if (businessLoading) return <Skeleton height={300} />;
  if (hasNoBusinesses || !businessId) {
    return <EmptyState title="Create a business first" description="You'll need a business set up before connecting IndiaMART." />;
  }

  return (
    <div>
      <AppHeader color="#2e3192" title="IndiaMART" subtitle={<>Pull buyer leads from your Lead Manager, and share your storefront catalog so your AI can answer product questions on WhatsApp/Instagram.</>} right={<Badge variant={status?.connected ? "success" : "warning"}>{status?.connected ? "Connected" : "Not connected"}</Badge>} />

      <Card padding="md" className={styles.section}>
        <div className={styles.sectionTitle}>Connect Lead Manager</div>
        <div className={styles.sectionHint}>
          Paste your CRM_KEY from IndiaMART Seller Panel → API Integration. We&apos;ll use it to pull buyer inquiries
          into your customer list.
        </div>
        <div className={styles.sheetUrlRow}>
          <Input placeholder={status?.connected ? "Paste a new CRM_KEY to replace the saved one" : "CRM_KEY"} value={crmKey} onChange={(e) => setCrmKey(e.target.value)} type="password" />
          <Button onClick={handleConnect} isLoading={isConnecting} disabled={!crmKey.trim()}>
            {status?.connected ? "Replace key" : "Connect"}
          </Button>
        </div>
        {status?.connected && (
          <div className={styles.sectionHint} style={{ marginTop: "var(--space-3)" }}>
            New leads are fetched automatically about every {status.auto_pull_minutes ?? 15} minutes
            {status.last_pulled_at ? `, last checked ${new Date(status.last_pulled_at).toLocaleString()}` : ""}.
            {status.last_pull_error ? ` The last check failed: ${status.last_pull_error}. It retries with longer pauses until the key works.` : ""}{" "}
            <Button variant="ghost" size="sm" onClick={handleDisconnect}>
              Disconnect
            </Button>
          </div>
        )}
      </Card>

      <Card padding="md" className={styles.section}>
        <div className={pageStyles.leadsHeader}>
          <div>
            <div className={styles.sectionTitle}>Leads</div>
            <div className={styles.sectionHint}>Buyer inquiries pulled from IndiaMART Lead Manager.</div>
          </div>
          <Button variant="secondary" onClick={handlePull} isLoading={isPulling}>
            Pull leads now
          </Button>
        </div>

        {!leads || leads.length === 0 ? (
          <EmptyState title="No leads yet" description="Connect your CRM key and pull leads to see buyer inquiries here." />
        ) : (
          <div className={pageStyles.leadsList}>
            {leads.map((lead) => (
              <LeadRow key={lead.id} lead={lead} />
            ))}
          </div>
        )}
      </Card>

      <CatalogPanel businessId={businessId} />
    </div>
  );
}

function LeadRow({ lead }: { lead: IndiaMartLead }) {
  return (
    <div className={pageStyles.leadRow}>
      <div className={pageStyles.leadInfo}>
        <div className={pageStyles.leadName}>{lead.buyer_name ?? "Unknown buyer"}</div>
        <div className={pageStyles.leadMeta}>
          {[lead.phone, lead.email].filter(Boolean).join(" · ") || "No contact info"}
        </div>
        {lead.product && <div className={pageStyles.leadProduct}>Product: {lead.product}</div>}
        {lead.message && <div className={pageStyles.leadMessage}>{lead.message}</div>}
      </div>
      <div className={pageStyles.leadDate}>{new Date(lead.query_time).toLocaleString()}</div>
    </div>
  );
}

function CatalogPanel({ businessId }: { businessId: string }) {
  const { show } = useToast();
  const [storefrontUrl, setStorefrontUrl] = useState("");
  const [preview, setPreview] = useState<IndiaMartCatalogPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: catalog, refresh: refreshCatalog } = useAsync(
    () => indiamartApi.listCatalog(businessId),
    [businessId]
  );

  async function handlePreview() {
    if (!storefrontUrl.trim()) return;
    setIsPreviewing(true);
    try {
      const result = await indiamartApi.previewCatalog(businessId, storefrontUrl.trim());
      setPreview(result);
    } catch (err) {
      const message = err instanceof ApiError ? err.userMessage : "Couldn't scrape that storefront. Please try again.";
      show(message, "error");
    } finally {
      setIsPreviewing(false);
    }
  }

  function updateRow(index: number, patch: Partial<IndiaMartCandidateProduct>) {
    setPreview((prev) => {
      if (!prev) return prev;
      const rows = prev.candidate_products.map((row, i) => (i === index ? { ...row, ...patch } : row));
      return { ...prev, candidate_products: rows };
    });
  }

  async function handleConfirm() {
    if (!preview) return;
    setIsConfirming(true);
    try {
      const result = await indiamartApi.confirmCatalog(businessId, preview.storefront_url, preview.candidate_products);
      show(`Imported ${result.added + result.updated} product${result.added + result.updated === 1 ? "" : "s"}.`, "success");
      setPreview(null);
      setStorefrontUrl("");
      refreshCatalog();
    } catch (err) {
      const message = err instanceof ApiError ? err.userMessage : "Import failed. Please try again.";
      show(message, "error");
    } finally {
      setIsConfirming(false);
    }
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      const result = await indiamartApi.refreshCatalog(businessId);
      show(
        `Refreshed: +${result.added} added · ${result.updated} updated · ${result.removed} removed.`,
        "success"
      );
      refreshCatalog();
    } catch (err) {
      const message = err instanceof ApiError ? err.userMessage : "Refresh failed. Please try again.";
      show(message, "error");
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <Card padding="md" className={styles.section}>
      <div className={styles.sectionTitle}>Storefront catalog</div>
      <div className={styles.sectionHint}>
        Paste your public IndiaMART storefront URL (e.g. indiamart.com/your-company). We&apos;ll scan it and suggest a
        product list for you to review before importing.
      </div>

      <div className={styles.sheetUrlRow}>
        <Input
          placeholder="https://www.indiamart.com/your-company/"
          value={storefrontUrl}
          onChange={(e) => setStorefrontUrl(e.target.value)}
        />
        <Button onClick={handlePreview} isLoading={isPreviewing} disabled={!storefrontUrl.trim()}>
          Preview
        </Button>
      </div>

      {preview && (
        <div className={styles.sheetPreview}>
          <div className={styles.sheetPreviewMeta}>
            {preview.candidate_products.length} product{preview.candidate_products.length === 1 ? "" : "s"} found -
            review before importing.
          </div>
          <div className={styles.tableScroll}>
            <table className={styles.previewTable}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Price</th>
                  <th>Image URL</th>
                </tr>
              </thead>
              <tbody>
                {preview.candidate_products.map((row, i) => (
                  <tr key={row.row_ref}>
                    <td>
                      <input className={styles.cellInput} value={row.name} onChange={(e) => updateRow(i, { name: e.target.value })} />
                    </td>
                    <td>
                      <input
                        className={styles.cellInput}
                        value={row.description ?? ""}
                        onChange={(e) => updateRow(i, { description: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className={styles.cellInput}
                        value={row.price ?? ""}
                        onChange={(e) => updateRow(i, { price: e.target.value ? Number(e.target.value) : null })}
                      />
                    </td>
                    <td>
                      <input
                        className={styles.cellInput}
                        value={row.image_url ?? ""}
                        onChange={(e) => updateRow(i, { image_url: e.target.value })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.footer}>
            <Button variant="secondary" onClick={() => setPreview(null)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} isLoading={isConfirming}>
              Confirm import
            </Button>
          </div>
        </div>
      )}

      {catalog && catalog.length > 0 && (
        <div className={styles.importHistory}>
          <div className={pageStyles.leadsHeader}>
            <div className={styles.sectionTitle}>Imported products ({catalog.length})</div>
            <Button variant="secondary" size="sm" onClick={handleRefresh} isLoading={isRefreshing}>
              Refresh
            </Button>
          </div>
          <div className={pageStyles.catalogGrid}>
            {catalog.map((product) => (
              <div key={product.id} className={pageStyles.catalogCard}>
                <div className={pageStyles.catalogName}>{product.name}</div>
                {product.price != null && <Badge variant="neutral">{product.currency} {product.price}</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
