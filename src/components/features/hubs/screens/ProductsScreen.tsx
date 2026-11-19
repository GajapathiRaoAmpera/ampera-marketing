"use client";

import { useMemo, useRef, useState } from "react";
import { productsApi, productSheetsApi, productFileImportApi, websiteScrapeApi } from "@/lib/api";
import type { Product, ProductFormInput } from "@/lib/api/products";
import type { SheetImportRun, SheetPreview, SheetPreviewRow } from "@/lib/api/productSheets";
import type { FileImportPreview } from "@/lib/api/productFileImport";
import type { ScrapePreview } from "@/lib/api/websiteScrape";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import { useAsync } from "@/lib/hooks/useAsync";
import { useBusiness } from "@/context/BusinessContext";
import { useToast } from "@/context/ToastContext";
import { ApiError } from "@/lib/api";
import { Badge, Button, Card, EmptyState, Icon, IconTile, InfoTip, Input, Modal, Skeleton, Switch, Textarea } from "@/components/ui";
import { BoxIcon } from "@/components/layout/icons";
import styles from "@/app/(dashboard)/products/page.module.scss";
import { useEmbedded } from "@/components/layout/Embedded";

type ProductFilter = "all" | "visible" | "hidden" | "out" | "no_price" | "no_photo";
type ImportTab = "sheet" | "file" | "website";

const FILTERS: Array<{ value: ProductFilter; label: string; match: (product: Product) => boolean }> = [
  { value: "all", label: "All", match: () => true },
  { value: "visible", label: "Shown to AI", match: (p) => p.active !== false },
  { value: "hidden", label: "Hidden", match: (p) => p.active === false },
  { value: "out", label: "Out of stock", match: (p) => p.stock_qty === 0 },
  { value: "no_price", label: "No price", match: (p) => p.price == null },
  { value: "no_photo", label: "No photo", match: (p) => !p.image_url },
];

const SOURCE_LABEL: Record<string, string> = {
  manual: "Added by you",
  sheet: "Google Sheet",
  file: "File import",
  woocommerce: "WooCommerce",
  indiamart: "IndiaMART",
  custom_store: "Your store",
};

export default function ProductsPage() {
  const embedded = useEmbedded();
  const { businessId, isLoading: businessLoading, hasNoBusinesses } = useActiveBusiness();
  const { can } = useBusiness();
  const canEdit = can("manager");
  const { show } = useToast();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ProductFilter>("all");
  const [importTab, setImportTab] = useState<ImportTab>("sheet");
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const { data: products, isLoading, refresh } = useAsync(
    () => (businessId ? productsApi.list(businessId) : Promise.resolve([])),
    [businessId]
  );

  const { data: imports, refresh: refreshImports } = useAsync(
    () => (businessId ? productSheetsApi.listImports(businessId) : Promise.resolve([])),
    [businessId]
  );

  // The switch flips at once; the saved value catches up from the server.
  const list = useMemo(
    () => (products ?? []).map((p) => (p.id in overrides ? { ...p, active: overrides[p.id] } : p)),
    [products, overrides]
  );

  const counts = useMemo(() => {
    const visible = list.filter((p) => p.active !== false);
    return {
      total: list.length,
      visible: visible.length,
      noPrice: visible.filter((p) => p.price == null).length,
      noPhoto: visible.filter((p) => !p.image_url).length,
      out: visible.filter((p) => p.stock_qty === 0).length,
    };
  }, [list]);

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const match = FILTERS.find((item) => item.value === filter)?.match ?? (() => true);
    return list.filter(
      (p) =>
        match(p) &&
        (!needle ||
          p.name.toLowerCase().includes(needle) ||
          (p.description ?? "").toLowerCase().includes(needle) ||
          p.keywords.some((k) => k.toLowerCase().includes(needle)))
    );
  }, [list, search, filter]);

  function openCreateForm() {
    setEditingProduct(null);
    setIsFormOpen(true);
  }

  async function toggleVisible(product: Product, visible: boolean) {
    if (!businessId) return;
    setOverrides((all) => ({ ...all, [product.id]: visible }));
    try {
      await productsApi.update(businessId, product.id, { active: visible });
      show(visible ? `“${product.name}” is shown to your AI again.` : `“${product.name}” is hidden. The AI won't recommend it.`, "default");
    } catch {
      setOverrides((all) => ({ ...all, [product.id]: !visible }));
      show("Couldn't update that product. Please try again.", "error");
    }
  }

  async function handleDelete(product: Product) {
    if (!businessId) return;
    setBusyId(product.id);
    try {
      await productsApi.remove(businessId, product.id);
      show("Product deleted.", "default");
      setDeleting(null);
      refresh();
    } catch {
      show("Couldn't delete that product. Please try again.", "error");
    } finally {
      setBusyId(null);
    }
  }

  function handleSaved() {
    setIsFormOpen(false);
    setEditingProduct(null);
    refresh();
  }

  if (businessLoading) return <Skeleton height={300} />;
  if (hasNoBusinesses || !businessId) {
    return <EmptyState title="Create a business first" description="You'll need a business set up before adding products." />;
  }

  return (
    <div className={styles.page}>
      {embedded ? (
        canEdit && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-4)" }}>
            <Button onClick={openCreateForm} leftIcon={<Icon name="plus" size={16} />}>
              Add product
            </Button>
          </div>
        )
      ) : (
        <header className={styles.header}>
          <IconTile name="box" tone="teal" size="lg" />
          <div className={styles.headerText}>
            <h1>
              Products
              <InfoTip help="Your AI agent reads these on every channel: it answers price and availability questions, lists what you sell, and sends the product photo when asked. Hidden products are never recommended." />
            </h1>
            <p>Everything you sell, so your AI can answer questions and send photos, never a raw link.</p>
          </div>
          {canEdit && (
            <Button onClick={openCreateForm} leftIcon={<Icon name="plus" size={16} />}>
              Add product
            </Button>
          )}
        </header>
      )}

      {counts.total > 0 && (
        <section className={styles.aiStatus}>
          <div className={styles.aiStatusMain}>
            <IconTile name="bot" tone="violet" />
            <div>
              <strong>
                Your AI knows {counts.visible} {counts.visible === 1 ? "product" : "products"}
              </strong>
              <span>
                {counts.total - counts.visible > 0 ? `${counts.total - counts.visible} hidden · ` : ""}
                Ask “what do you sell?” on any channel and it lists them with prices.
              </span>
            </div>
          </div>
          <div className={styles.aiChecks}>
            {counts.noPrice > 0 && (
              <button type="button" className={styles.check} onClick={() => setFilter("no_price")}>
                <Icon name="alert" size={14} /> {counts.noPrice} without a price
              </button>
            )}
            {counts.noPhoto > 0 && (
              <button type="button" className={styles.check} onClick={() => setFilter("no_photo")}>
                <Icon name="posts" size={14} /> {counts.noPhoto} without a photo
              </button>
            )}
            {counts.out > 0 && (
              <button type="button" className={styles.check} onClick={() => setFilter("out")}>
                <Icon name="box" size={14} /> {counts.out} out of stock
              </button>
            )}
            {counts.noPrice === 0 && counts.noPhoto === 0 && (
              <span className={styles.checkOk}>
                <Icon name="check" size={14} /> Every product has a price and a photo
              </span>
            )}
          </div>
        </section>
      )}

      <section className={styles.catalog}>
        {isLoading ? (
          <Skeleton height={240} />
        ) : list.length === 0 ? (
          <div className={styles.empty}>
            <IconTile name="box" tone="teal" size="lg" />
            <h3>No products yet</h3>
            <p>Add your first product, or import your whole catalog from a Google Sheet, an Excel/CSV file or your website below.</p>
            {canEdit && (
              <Button onClick={openCreateForm} leftIcon={<Icon name="plus" size={16} />}>
                Add a product
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className={styles.toolbar}>
              <label className={styles.search}>
                <Icon name="search" size={16} />
                <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" aria-label="Search products" />
              </label>
              <div className={styles.filters} role="group" aria-label="Filter">
                {FILTERS.map((item) => (
                  <button key={item.value} type="button" aria-pressed={filter === item.value} className={filter === item.value ? styles.filterOn : styles.filter} onClick={() => setFilter(item.value)}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {shown.length === 0 ? (
              <p className={styles.muted}>No products match. Try another search or filter.</p>
            ) : (
              <div className={styles.grid}>
                {shown.map((product) => {
                  const visible = product.active !== false;
                  return (
                    <article key={product.id} className={`${styles.productCard} ${visible ? "" : styles.productHidden}`}>
                      <div className={styles.productImage}>
                        {product.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={product.image_url} alt={product.name} loading="lazy" />
                        ) : (
                          <span className={styles.noImage}>
                            <BoxIcon size={28} />
                            No photo
                          </span>
                        )}
                        {product.stock_qty === 0 && <span className={styles.stockTag}>Out of stock</span>}
                      </div>
                      <div className={styles.productInfo}>
                        <h3 className={styles.productName} title={product.name}>
                          {product.name}
                        </h3>
                        <div className={styles.productPrice}>
                          {product.price != null ? `${product.currency} ${product.price.toLocaleString()}` : <span className={styles.noPrice}>No price</span>}
                        </div>
                        {product.description && <p className={styles.productDesc}>{product.description}</p>}
                        <div className={styles.productMeta}>
                          <Badge variant="neutral">{SOURCE_LABEL[product.source] ?? product.source}</Badge>
                          {product.stock_qty != null && product.stock_qty > 0 && <Badge variant="success">{product.stock_qty} in stock</Badge>}
                        </div>
                      </div>
                      <div className={styles.productFoot}>
                        <label className={styles.visibleSwitch} title="Whether your AI can recommend this product">
                          <Switch checked={visible} disabled={!canEdit} onChange={(value) => void toggleVisible(product, value)} aria-label="Show to AI" />
                          <span>{visible ? "Shown to AI" : "Hidden"}</span>
                        </label>
                        {canEdit && (
                          <span className={styles.productActions}>
                            <button
                              type="button"
                              className={styles.iconAction}
                              onClick={() => {
                                setEditingProduct(product);
                                setIsFormOpen(true);
                              }}
                              aria-label={`Edit ${product.name}`}
                              title="Edit"
                            >
                              <Icon name="pen" size={16} />
                            </button>
                            <button type="button" className={`${styles.iconAction} ${styles.iconDanger}`} onClick={() => setDeleting(product)} aria-label={`Delete ${product.name}`} title="Delete">
                              <Icon name="trash" size={16} />
                            </button>
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>

      {canEdit && (
        <section className={styles.importArea}>
          <div className={styles.importHead}>
            <div>
              <h2>Add many at once</h2>
              <p>Bring in your whole catalog. Imports keep prices, stock and photos up to date.</p>
            </div>
            <div className={styles.importTabs} role="tablist">
              {(
                [
                  ["sheet", "Google Sheet", "posts"],
                  ["file", "Excel / CSV", "book"],
                  ["website", "From your website", "globe"],
                ] as Array<[ImportTab, string, "posts" | "book" | "globe"]>
              ).map(([value, label, icon]) => (
                <button key={value} type="button" role="tab" aria-selected={importTab === value} className={importTab === value ? styles.importTabOn : styles.importTab} onClick={() => setImportTab(value)}>
                  <Icon name={icon} size={15} /> {label}
                </button>
              ))}
            </div>
          </div>
          <div hidden={importTab !== "sheet"}>
            <SheetImportPanel
              businessId={businessId}
              imports={imports ?? []}
              onImported={() => {
                refresh();
                refreshImports();
              }}
            />
          </div>
          <div hidden={importTab !== "file"}>
            <FileImportPanel
              businessId={businessId}
              onImported={() => {
                refresh();
                refreshImports();
              }}
            />
          </div>
          <div hidden={importTab !== "website"}>
            <WebsiteScrapePanel businessId={businessId} onConfirmed={() => refresh()} />
          </div>
        </section>
      )}

      {isFormOpen && (
        <ProductFormModal businessId={businessId} product={editingProduct} onClose={() => setIsFormOpen(false)} onSaved={handleSaved} />
      )}

      <Modal
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete this product?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Keep it
            </Button>
            <Button variant="danger" isLoading={busyId === deleting?.id} onClick={() => deleting && void handleDelete(deleting)}>
              Delete
            </Button>
          </>
        }
      >
        <p className={styles.muted}>
          “{deleting?.name}” will be removed and your AI will stop mentioning it. To keep it but stop recommending it, hide it instead.
        </p>
      </Modal>
    </div>
  );
}

function ProductFormModal({
  businessId,
  product,
  onClose,
  onSaved,
}: {
  businessId: string;
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { show } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [keywords, setKeywords] = useState((product?.keywords ?? []).join(", "));
  const [price, setPrice] = useState(product?.price != null ? String(product.price) : "");
  const [currency, setCurrency] = useState(product?.currency ?? "INR");
  const [stockQty, setStockQty] = useState(product?.stock_qty != null ? String(product.stock_qty) : "");
  const [imageMode, setImageMode] = useState<"upload" | "link">("upload");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageLink, setImageLink] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      show("Product name is required.", "error");
      return;
    }
    setIsSaving(true);
    try {
      const input: Partial<ProductFormInput> = {
        name: name.trim(),
        description: description.trim() || undefined,
        keywords: keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        price: price ? Number(price) : undefined,
        currency,
        stockQty: stockQty ? Number(stockQty) : undefined,
        imageFile: imageMode === "upload" ? imageFile : undefined,
        imageLink: imageMode === "link" ? imageLink.trim() || undefined : undefined,
      };

      if (product) {
        await productsApi.update(businessId, product.id, input);
      } else {
        await productsApi.create(businessId, input as ProductFormInput);
      }
      show(product ? "Product updated." : "Product added.", "success");
      onSaved();
    } catch (err) {
      const message = err instanceof ApiError ? err.userMessage : "Couldn't save that product. Please try again.";
      show(message, "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={product ? "Edit product" : "Add product"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} isLoading={isSaving}>
            Save
          </Button>
        </>
      }
    >
      <div className={styles.formGrid}>
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
        <Input
          label="Keywords (comma-separated)"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="e.g. red, cotton, summer collection"
        />
        <div className={styles.priceRow}>
          <Input label="Price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
          <Input label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
        </div>
        <Input
          label="Stock quantity (optional)"
          type="number"
          value={stockQty}
          onChange={(e) => setStockQty(e.target.value)}
          placeholder="Leave blank if not tracked"
        />

        <div className={styles.imageModeToggle}>
          <Button
            variant={imageMode === "upload" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setImageMode("upload")}
          >
            Upload image
          </Button>
          <Button
            variant={imageMode === "link" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setImageMode("link")}
          >
            Paste a link
          </Button>
        </div>

        {imageMode === "upload" ? (
          <div className={styles.imageUploadRow}>
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              {imageFile ? imageFile.name : product?.image_url ? "Replace image" : "Choose image"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            />
          </div>
        ) : (
          <Input
            label="Image link"
            placeholder="Google Drive share link or direct image URL"
            value={imageLink}
            onChange={(e) => setImageLink(e.target.value)}
          />
        )}
      </div>
    </Modal>
  );
}

function SheetImportPanel({
  businessId,
  imports,
  onImported,
}: {
  businessId: string;
  imports: SheetImportRun[];
  onImported: () => void;
}) {
  const { show } = useToast();
  const [sheetUrl, setSheetUrl] = useState("");
  const [preview, setPreview] = useState<SheetPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [resyncingId, setResyncingId] = useState<string | null>(null);

  async function handlePreview() {
    if (!sheetUrl.trim()) return;
    setIsPreviewing(true);
    try {
      const result = await productSheetsApi.preview(businessId, sheetUrl.trim());
      setPreview(result);
    } catch (err) {
      const message = err instanceof ApiError ? err.userMessage : "Couldn't read that sheet. Check it's shared publicly.";
      show(message, "error");
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
      await productSheetsApi.confirm(businessId, {
        sheet_url: sheetUrl.trim(),
        mapping: preview.mapping,
        rows: preview.rows,
      });
      show("Products imported.", "success");
      setPreview(null);
      setSheetUrl("");
      onImported();
    } catch (err) {
      const message = err instanceof ApiError ? err.userMessage : "Import failed. Please try again.";
      show(message, "error");
    } finally {
      setIsConfirming(false);
    }
  }

  async function handleResync(sheetId: string) {
    setResyncingId(sheetId);
    try {
      await productSheetsApi.resync(businessId, sheetId);
      show("Sheet re-synced.", "success");
      onImported();
    } catch (err) {
      const message = err instanceof ApiError ? err.userMessage : "Re-sync failed. Please try again.";
      show(message, "error");
    } finally {
      setResyncingId(null);
    }
  }

  return (
    <Card padding="md" className={styles.section}>
      <div className={styles.sectionTitle}>Import from Google Sheet</div>
      <div className={styles.sectionHint}>
        Paste a sheet link shared as &ldquo;Anyone with the link can view&rdquo;. Any column headers work, we&apos;ll
        map them automatically.
      </div>

      <div className={styles.sheetUrlRow}>
        <Input
          placeholder="https://docs.google.com/spreadsheets/d/..."
          value={sheetUrl}
          onChange={(e) => setSheetUrl(e.target.value)}
        />
        <Button onClick={handlePreview} isLoading={isPreviewing} disabled={!sheetUrl.trim()}>
          Preview
        </Button>
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
                      <input
                        className={styles.cellInput}
                        value={row.mapped.name}
                        onChange={(e) => updateRow(i, { name: e.target.value })}
                      />
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
            <Button variant="secondary" onClick={() => setPreview(null)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} isLoading={isConfirming}>
              Confirm import
            </Button>
          </div>
        </div>
      )}

      {imports.length > 0 && (
        <div className={styles.importHistory}>
          <div className={styles.sectionTitle}>Import history</div>
          {imports.map((run) => (
            <div key={run.id} className={styles.importRow}>
              <div className={styles.importInfo}>
                <div className={styles.importDate}>{new Date(run.created_at).toLocaleString()}</div>
                <div className={styles.importCounts}>
                  +{run.added} added · {run.updated} updated · {run.removed} removed
                  {run.failed > 0 ? ` · ${run.failed} failed` : ""}
                </div>
              </div>
              <Badge variant={run.status === "success" ? "success" : run.status === "partial" ? "warning" : "danger"}>
                {run.status}
              </Badge>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleResync(run.sheet_id)}
                isLoading={resyncingId === run.sheet_id}
              >
                Re-sync
              </Button>
            </div>
          ))}
          <div className={styles.sectionHint}>
            Re-syncing pulls the sheet&apos;s current data. It always overwrites any manual edits you made to
            sheet-imported products.
          </div>
        </div>
      )}
    </Card>
  );
}

function FileImportPanel({ businessId, onImported }: { businessId: string; onImported: () => void }) {
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
      onImported();
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
                      <input
                        className={styles.cellInput}
                        value={row.mapped.name}
                        onChange={(e) => updateRow(i, { name: e.target.value })}
                      />
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

function WebsiteScrapePanel({ businessId, onConfirmed }: { businessId: string; onConfirmed: () => void }) {
  const { show } = useToast();
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<ScrapePreview | null>(null);
  const [isScraping, setIsScraping] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());

  async function handleScrape() {
    if (!url.trim()) return;
    setIsScraping(true);
    try {
      const result = await websiteScrapeApi.preview(businessId, url.trim());
      setPreview(result);
      setSelectedProducts(new Set(result.candidate_products.map((_, i) => i)));
    } catch (err) {
      const message = err instanceof ApiError ? err.userMessage : "Couldn't scrape that website. Please try again.";
      show(message, "error");
    } finally {
      setIsScraping(false);
    }
  }

  function updateField(key: keyof ScrapePreview["extracted"], value: string) {
    setPreview((prev) => (prev ? { ...prev, extracted: { ...prev.extracted, [key]: value } } : prev));
  }

  function toggleProduct(index: number) {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleConfirm() {
    if (!preview) return;
    setIsConfirming(true);
    try {
      await websiteScrapeApi.confirm(businessId, {
        fields: preview.extracted,
        products_to_add: preview.candidate_products.filter((_, i) => selectedProducts.has(i)),
        source_content: preview.source_content,
        source_pages: preview.pages,
      });
      show("Business details updated.", "success");
      setPreview(null);
      setUrl("");
      onConfirmed();
    } catch (err) {
      const message = err instanceof ApiError ? err.userMessage : "Couldn't save. Please try again.";
      show(message, "error");
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <Card padding="md" className={styles.section}>
      <div className={styles.sectionTitle}>Import from your website</div>
      <div className={styles.sectionHint}>
        Paste your business website URL. We&apos;ll scan the page and suggest business details and products for you
        to review before anything is saved.
      </div>

      <div className={styles.sheetUrlRow}>
        <Input placeholder="https://yourbusiness.com" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Button onClick={handleScrape} isLoading={isScraping} disabled={!url.trim()}>
          Scan site
        </Button>
      </div>

      {preview && (
        <div className={styles.sheetPreview}>
          <div className={styles.sheetPreviewMeta}>
            {preview.pages.length} page{preview.pages.length === 1 ? "" : "s"} scanned · {preview.source_character_count.toLocaleString()} characters retained for AI knowledge
          </div>
          <div className={styles.formGrid}>
            <Input
              label="Business name"
              value={preview.extracted.name ?? ""}
              onChange={(e) => updateField("name", e.target.value)}
            />
            <Textarea
              label="Description"
              value={preview.extracted.description ?? ""}
              onChange={(e) => updateField("description", e.target.value)}
              rows={2}
              maxLength={1500}
              showCharCount
            />
            <Input
              label="Location"
              value={preview.extracted.location ?? ""}
              onChange={(e) => updateField("location", e.target.value)}
            />
            <Input
              label="Working hours"
              value={preview.extracted.working_hours ?? ""}
              onChange={(e) => updateField("working_hours", e.target.value)}
            />
            <Textarea
              label="Products & services"
              value={preview.extracted.products_services ?? ""}
              onChange={(e) => updateField("products_services", e.target.value)}
              rows={2}
              maxLength={4000}
              showCharCount
            />
            <Textarea label="Pricing" value={preview.extracted.pricing ?? ""} onChange={(e) => updateField("pricing", e.target.value)} rows={2} maxLength={2500} showCharCount />
            <Textarea label="Policies" value={preview.extracted.policies ?? ""} onChange={(e) => updateField("policies", e.target.value)} rows={3} maxLength={4000} showCharCount />
            <Textarea label="Additional information" value={preview.extracted.additional_info ?? ""} onChange={(e) => updateField("additional_info", e.target.value)} rows={3} maxLength={4000} showCharCount />
            <Textarea
              label="Full scraped content (used by the AI)"
              value={preview.source_content}
              onChange={(e) => setPreview((current) => current ? { ...current, source_content: e.target.value, source_character_count: e.target.value.length } : current)}
              rows={12}
              maxLength={500000}
              showCharCount
              helperText="The summary limits above do not remove information from this editable source."
            />
          </div>

          {preview.candidate_products.length > 0 && (
            <div className={styles.candidateProducts}>
              <div className={styles.sectionTitle}>Products found on the page</div>
              {preview.candidate_products.map((p, i) => (
                <label key={i} className={styles.candidateRow}>
                  <input type="checkbox" checked={selectedProducts.has(i)} onChange={() => toggleProduct(i)} />
                  <span>
                    {p.name}
                    {p.price != null ? ` - ${p.price}` : ""}
                  </span>
                </label>
              ))}
            </div>
          )}

          <div className={styles.footer}>
            <Button variant="secondary" onClick={() => setPreview(null)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} isLoading={isConfirming}>
              Confirm & save
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
