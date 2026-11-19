"use client";

import { useRef, useState } from "react";
import { customStoreApi } from "@/lib/api/customStore";
import type { CustomStoreFeedPreview, CustomStoreFeedRow } from "@/lib/api/customStore";
import { productFileImportApi } from "@/lib/api/productFileImport";
import type { FileImportPreview } from "@/lib/api/productFileImport";
import type { SheetPreviewRow } from "@/lib/api/productSheets";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/context/ToastContext";
import { ApiError } from "@/lib/api";
import { Button, Card, EmptyState, Input, Skeleton } from "@/components/ui";
import styles from "../page.module.scss";
import { AppHeader } from "@/components/features/hubs/AppHeader";

export default function CustomStorePage() {
  const { businessId, isLoading: businessLoading, hasNoBusinesses } = useActiveBusiness();

  if (businessLoading) return <Skeleton height={300} />;
  if (hasNoBusinesses || !businessId) {
    return <EmptyState title="Create a business first" description="You'll need a business set up before importing products." />;
  }

  return (
    <div>
      <AppHeader color="#0f9d8a" title="Custom Store" subtitle={<>Import products from a bespoke JSON feed URL, or upload a spreadsheet, for stores that aren&apos;t on Shopify, WooCommerce, or IndiaMART.</>} />

      <FeedPanel businessId={businessId} />
      <FileUploadPanel businessId={businessId} />
    </div>
  );
}

function FeedPanel({ businessId }: { businessId: string }) {
  const { show } = useToast();
  const [feedUrl, setFeedUrl] = useState("");
  const [preview, setPreview] = useState<CustomStoreFeedPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: products, refresh: refreshProducts } = useAsync(
    () => customStoreApi.listProducts(businessId),
    [businessId]
  );

  async function handlePreview() {
    if (!feedUrl.trim()) return;
    setIsPreviewing(true);
    try {
      const result = await customStoreApi.preview(businessId, feedUrl.trim());
      setPreview(result);
    } catch (err) {
      const message = err instanceof ApiError ? err.userMessage : "Couldn't read that feed. Check the URL returns JSON.";
      show(message, "error");
    } finally {
      setIsPreviewing(false);
    }
  }

  function updateRow(index: number, patch: Partial<CustomStoreFeedRow["mapped"]>) {
    setPreview((prev) => {
      if (!prev) return prev;
      const rows = prev.rows.map((row, i) => (i === index ? { ...row, mapped: { ...row.mapped, ...patch } } : row));
      return { ...prev, rows };
    });
  }

  async function handleConfirm() {
    if (!preview) return;
    setIsConfirming(true);
    try {
      const result = await customStoreApi.confirm(businessId, preview.feed_url, preview.rows.map((r) => r.mapped));
      show(`Imported ${result.added + result.updated} product${result.added + result.updated === 1 ? "" : "s"}.`, "success");
      setPreview(null);
      setFeedUrl("");
      refreshProducts();
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
      const result = await customStoreApi.refresh(businessId);
      show(`Refreshed: +${result.added} added · ${result.updated} updated · ${result.removed} removed.`, "success");
      refreshProducts();
    } catch (err) {
      const message = err instanceof ApiError ? err.userMessage : "Refresh failed. Please try again.";
      show(message, "error");
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <Card padding="md" className={styles.section}>
      <div className={styles.sectionTitle}>Import from a JSON feed URL</div>
      <div className={styles.sectionHint}>
        Paste a URL that returns a JSON array (or an object with an items/products/data array) of your products.
        Any key names work, we&apos;ll map them automatically.
      </div>

      <div className={styles.sheetUrlRow}>
        <Input placeholder="https://yourstore.com/api/products.json" value={feedUrl} onChange={(e) => setFeedUrl(e.target.value)} />
        <Button onClick={handlePreview} isLoading={isPreviewing} disabled={!feedUrl.trim()}>
          Preview
        </Button>
      </div>

      {preview && (
        <div className={styles.sheetPreview}>
          <div className={styles.sheetPreviewMeta}>
            {preview.row_count} product{preview.row_count === 1 ? "" : "s"} found - review the mapped values below
            before importing.
          </div>
          <div className={styles.tableScroll}>
            <table className={styles.previewTable}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Price</th>
                  <th>Image URL</th>
                  <th>Stock</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={row.row_index}>
                    <td>
                      <input className={styles.cellInput} value={row.mapped.name} onChange={(e) => updateRow(i, { name: e.target.value })} />
                    </td>
                    <td>
                      <input
                        className={styles.cellInput}
                        value={row.mapped.description ?? ""}
                        onChange={(e) => updateRow(i, { description: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className={styles.cellInput}
                        value={row.mapped.price ?? ""}
                        onChange={(e) => updateRow(i, { price: e.target.value ? Number(e.target.value) : null })}
                      />
                    </td>
                    <td>
                      <input
                        className={styles.cellInput}
                        value={row.mapped.image_url ?? ""}
                        onChange={(e) => updateRow(i, { image_url: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className={styles.cellInput}
                        value={row.mapped.stock_qty ?? ""}
                        onChange={(e) => updateRow(i, { stock_qty: e.target.value ? Number(e.target.value) : null })}
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

      {products && products.length > 0 && (
        <div className={styles.importHistory}>
          <div className={styles.sectionTitle}>Imported products ({products.length})</div>
          <Button variant="secondary" size="sm" onClick={handleRefresh} isLoading={isRefreshing}>
            Refresh from feed
          </Button>
        </div>
      )}
    </Card>
  );
}

// Re-surfaces the existing generic product-file-import feature (CSV/XLSX)
// under Connected Apps, NOT a reimplementation, per the build instructions.
// Mirrors products/page.tsx's FileImportPanel exactly.
function FileUploadPanel({ businessId, onImported }: { businessId: string; onImported?: () => void }) {
  const { show } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<FileImportPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  async function handleFileChosen(file: File | null) {
    setSelectedFile(file);
    if (!file) return;
    setIsPreviewing(true);
    try {
      const result = await productFileImportApi.preview(businessId, file);
      setPreview(result);
    } catch (err) {
      const message = err instanceof ApiError ? err.userMessage : "Couldn't read that file. Please check it and try again.";
      show(message, "error");
      setSelectedFile(null);
    } finally {
      setIsPreviewing(false);
    }
  }

  function updateRow(index: number, patch: Partial<SheetPreviewRow["mapped"]>) {
    setPreview((prev) => {
      if (!prev) return prev;
      const rows = prev.rows.map((row, i) => (i === index ? { ...row, mapped: { ...row.mapped, ...patch } } : row));
      return { ...prev, rows };
    });
  }

  async function handleConfirm() {
    if (!preview) return;
    setIsConfirming(true);
    try {
      await productFileImportApi.confirm(businessId, preview.filename, preview.rows);
      show("Products imported.", "success");
      setPreview(null);
      setSelectedFile(null);
      onImported?.();
    } catch (err) {
      const message = err instanceof ApiError ? err.userMessage : "Import failed. Please try again.";
      show(message, "error");
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <Card padding="md" className={styles.section}>
      <div className={styles.sectionTitle}>Import from a spreadsheet file</div>
      <div className={styles.sectionHint}>
        Upload a .csv or .xlsx file with your products. Any column headers work, we&apos;ll map them automatically.
      </div>

      <div className={styles.sheetUrlRow}>
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()} isLoading={isPreviewing}>
          {selectedFile ? selectedFile.name : "Choose file"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          hidden
          onChange={(e) => handleFileChosen(e.target.files?.[0] ?? null)}
        />
      </div>

      {preview && (
        <div className={styles.sheetPreview}>
          <div className={styles.sheetPreviewMeta}>
            {preview.row_count} row{preview.row_count === 1 ? "" : "s"} found - review the mapped values below before
            importing.
          </div>
          <div className={styles.tableScroll}>
            <table className={styles.previewTable}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Keywords</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Image link</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={row.row_index}>
                    <td>
                      <input className={styles.cellInput} value={row.mapped.name} onChange={(e) => updateRow(i, { name: e.target.value })} />
                    </td>
                    <td>
                      <input
                        className={styles.cellInput}
                        value={row.mapped.description ?? ""}
                        onChange={(e) => updateRow(i, { description: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className={styles.cellInput}
                        value={row.mapped.keywords.join(", ")}
                        onChange={(e) =>
                          updateRow(i, { keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean) })
                        }
                      />
                    </td>
                    <td>
                      <input
                        className={styles.cellInput}
                        value={row.mapped.price ?? ""}
                        onChange={(e) => updateRow(i, { price: e.target.value ? Number(e.target.value) : null })}
                      />
                    </td>
                    <td>
                      <input
                        className={styles.cellInput}
                        value={row.mapped.stock_qty ?? ""}
                        onChange={(e) => updateRow(i, { stock_qty: e.target.value ? Number(e.target.value) : null })}
                      />
                    </td>
                    <td>
                      <input
                        className={styles.cellInput}
                        value={row.mapped.image_link ?? ""}
                        onChange={(e) => updateRow(i, { image_link: e.target.value })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.footer}>
            <Button
              variant="secondary"
              onClick={() => {
                setPreview(null);
                setSelectedFile(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirm} isLoading={isConfirming}>
              Confirm import
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
