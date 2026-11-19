"use client";

import Link from "next/link";
import { copyText } from "@/lib/utils/browser";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Input, Modal, Tabs, Textarea } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import { whatsappStudioApi, type StudioCatalogConnection, type StudioOrder, type StudioProduct } from "@/lib/api/whatsapp-studio";
import { ApiError } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils/date";
import styles from "./page.module.scss";

type Tab = "orders" | "products";

const money = (minor: number) => `₹${(minor / 100).toLocaleString("en-IN", { minimumFractionDigits: minor % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

function errorText(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.userMessage : fallback;
}

/** A SKU from the name when the owner doesn't have one: "Red Kurta (M)" → "RED-KURTA-M-4821". */
function skuFrom(name: string) {
  const base = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "ITEM";
  return `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/** Where an order is, in words a shop owner uses. */
function orderStage(order: StudioOrder): { label: string; tone: "success" | "warning" | "info" | "neutral"; next: string } {
  if (order.status === "cancelled" || order.status.includes("failed") || order.status === "expired") return { label: "Cancelled", tone: "neutral", next: "" };
  if (order.status === "payment_claimed") return { label: "Customer says paid", tone: "warning", next: "Check your bank or UPI app for the amount, then mark it paid." };
  if (order.status === "payment_pending") return { label: "Waiting for payment", tone: "info", next: "The customer has a pay link. Unpaid orders release their stock after 24 hours." };
  if (order.fulfillment_status === "fulfilled") return { label: "Delivered", tone: "success", next: "" };
  if (order.fulfillment_status === "shipped") return { label: "Shipped", tone: "info", next: "Mark it delivered once it arrives." };
  if (order.fulfillment_status === "processing") return { label: "Packing", tone: "info", next: "Mark it shipped when it leaves." };
  return { label: "Paid", tone: "success", next: "Start packing." };
}

export default function CommercePage() {
  const { businessId } = useActiveBusiness();
  const { show } = useToast();
  const [tab, setTab] = useState<Tab | null>(null);
  const [products, setProducts] = useState<StudioProduct[] | null>(null);
  const [orders, setOrders] = useState<StudioOrder[]>([]);
  const [catalog, setCatalog] = useState<StudioCatalogConnection | null>(null);
  const [editing, setEditing] = useState<StudioProduct | "new" | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!businessId) return;
    try {
      const [productRows, orderRows, connection] = await Promise.all([
        whatsappStudioApi.products(businessId),
        whatsappStudioApi.orders(businessId),
        whatsappStudioApi.catalogConnection(businessId),
      ]);
      setProducts(productRows);
      setOrders(orderRows);
      setCatalog(connection);
      setTab((current) => current ?? (orderRows.length ? "orders" : "products"));
    } catch {
      setProducts([]);
      setTab((current) => current ?? "products");
      show("Couldn't load your shop.", "error");
    }
  }, [businessId, show]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function importProducts() {
    if (!businessId) return;
    setBusy(true);
    try {
      const result = await whatsappStudioApi.importFromProducts(businessId);
      const parts = [`${result.imported} added`, `${result.updated} updated`];
      if (result.skipped) parts.push(`${result.skipped} skipped (no price)`);
      show(`Products copied: ${parts.join(", ")}.`, result.imported + result.updated ? "success" : "warning");
      await load();
    } catch (error) {
      show(errorText(error, "Couldn't copy your products."), "error");
    } finally {
      setBusy(false);
    }
  }

  const waiting = orders.filter((order) => ["payment_claimed"].includes(order.status) || (order.status === "paid" && order.fulfillment_status !== "fulfilled")).length;
  const activeProducts = (products ?? []).filter((product) => product.active).length;

  return (
    <div className={styles.page}>
      <header>
        <div>
          <Link href="/channels/whatsapp">← WhatsApp</Link>
          <h1>Shop</h1>
          <p>Products customers can order on WhatsApp. They pay with any UPI app; you confirm and ship.</p>
        </div>
      </header>

      {tab && (
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "orders", label: `Orders${waiting ? ` (${waiting} need you)` : ""}` },
            { value: "products", label: `Products${products ? ` (${activeProducts})` : ""}` },
          ]}
        />
      )}

      {tab === "orders" && <OrdersView businessId={businessId} orders={orders} onChanged={load} />}

      {tab === "products" && (
        <div className={styles.grid}>
          <Card>
            <div className={styles.cardTitle}>
              <div>
                <h2>Products</h2>
                <p>What customers see when they tap “Browse &amp; order” in your menu. Only active, in-stock products are shown.</p>
              </div>
              <div className={styles.actions}>
                <Button variant="secondary" onClick={() => void importProducts()} isLoading={busy}>
                  Copy from my Products
                </Button>
                <Button onClick={() => setEditing("new")}>Add product</Button>
              </div>
            </div>
            {products === null ? null : products.length === 0 ? (
              <EmptyState
                title="No products yet"
                description="Copy the products you already added for the AI (Products page) in one click, or add one here."
              />
            ) : (
              <ul className={styles.productList}>
                {products.map((product) => {
                  const available = product.inventory - product.reserved_inventory;
                  return (
                    <li key={product.id}>
                      {product.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.image_url} alt="" className={styles.thumb} />
                      ) : (
                        <span className={styles.thumb} aria-hidden>📦</span>
                      )}
                      <div className={styles.productText}>
                        <strong>{product.name}</strong>
                        <span>
                          {money(product.price_minor)} · {available > 0 ? `${available} in stock` : "Sold out"}
                          {product.reserved_inventory ? ` · ${product.reserved_inventory} held for unpaid orders` : ""}
                        </span>
                      </div>
                      {!product.active ? <Badge variant="warning">{product.needs_review ? "Check & turn on" : "Hidden"}</Badge> : available <= 0 ? <Badge variant="neutral">Sold out</Badge> : <Badge variant="success">On sale</Badge>}
                      <Button size="sm" variant="secondary" onClick={() => setEditing(product)}>
                        Edit
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <div className={styles.side}>
            <OrderBuilder businessId={businessId} products={(products ?? []).filter((product) => product.active)} onCreated={load} />
            <CatalogCard businessId={businessId} connection={catalog} onChanged={load} />
          </div>
        </div>
      )}

      {editing && businessId && (
        <ProductModal
          businessId={businessId}
          product={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function OrdersView({ businessId, orders, onChanged }: { businessId: string | null; orders: StudioOrder[]; onChanged: () => Promise<void> }) {
  const { show } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function act(order: StudioOrder, action: "paid" | "processing" | "shipped" | "fulfilled" | "cancel") {
    if (!businessId) return;
    if (action === "paid" && !confirm(`Mark order ${order.id.slice(-8).toUpperCase()} as paid? Only do this after you see ${money(order.amount_minor)} in your bank or UPI app.`)) return;
    if (action === "cancel" && !confirm("Cancel this order? Its stock goes back on sale.")) return;
    const tracking = action === "shipped" ? window.prompt("Tracking number or courier link (optional). The customer gets it on WhatsApp.", order.tracking_reference ?? "") ?? undefined : undefined;
    setBusyId(order.id);
    try {
      if (action === "paid") await whatsappStudioApi.markPaid(businessId, order.id, order.upi_reference ?? undefined);
      else if (action === "cancel") await whatsappStudioApi.cancelOrder(businessId, order.id);
      else await whatsappStudioApi.updateFulfillment(businessId, order.id, action, tracking);
      show(action === "paid" ? "Marked as paid. The customer gets a receipt on WhatsApp." : action === "cancel" ? "Order cancelled." : "Order updated.", "success");
      await onChanged();
    } catch (error) {
      show(errorText(error, "Couldn't update this order."), "error");
    } finally {
      setBusyId(null);
    }
  }

  if (!orders.length) {
    return (
      <Card>
        <EmptyState
          title="No orders yet"
          description="Orders arrive when customers tap “Browse & order” in your clickable menu, order from your WhatsApp catalog, or pay a link you created under Products."
        />
      </Card>
    );
  }

  return (
    <Card>
      <ul className={styles.orderList}>
        {orders.map((order) => {
          const stage = orderStage(order);
          const busy = busyId === order.id;
          const paid = order.status === "paid";
          return (
            <li key={order.id}>
              <div className={styles.orderMain}>
                <div className={styles.orderHead}>
                  <strong>Order {order.id.slice(-8).toUpperCase()}</strong>
                  <Badge variant={stage.tone}>{stage.label}</Badge>
                  <strong className={styles.amount}>{money(order.amount_minor)}</strong>
                </div>
                <span>{order.items.map((item) => `${item.quantity}× ${item.name}`).join(", ")}</span>
                <span>
                  {order.customer_phone || "No number"} · {formatRelativeTime(order.created_at)}
                  {order.upi_reference ? ` · UPI ref ${order.upi_reference}` : ""}
                  {order.tracking_reference ? ` · Tracking ${order.tracking_reference}` : ""}
                </span>
                {stage.next && <span className={styles.next}>{stage.next}</span>}
              </div>
              <div className={styles.orderActions}>
                {order.payment_method === "upi" && (order.status === "payment_pending" || order.status === "payment_claimed") && (
                  <Button size="sm" disabled={busy} onClick={() => void act(order, "paid")}>Mark as paid</Button>
                )}
                {paid && !order.fulfillment_status && <Button size="sm" disabled={busy} onClick={() => void act(order, "processing")}>Start packing</Button>}
                {paid && order.fulfillment_status === "processing" && <Button size="sm" disabled={busy} onClick={() => void act(order, "shipped")}>Mark shipped</Button>}
                {paid && order.fulfillment_status === "shipped" && <Button size="sm" disabled={busy} onClick={() => void act(order, "fulfilled")}>Mark delivered</Button>}
                {order.inventory_status === "reserved" && (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => void act(order, "cancel")}>Cancel</Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function ProductModal({ businessId, product, onClose, onSaved }: { businessId: string; product: StudioProduct | null; onClose: () => void; onSaved: () => void }) {
  const { show } = useToast();
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product?.price ?? "");
  const [inventory, setInventory] = useState(String(product?.inventory ?? 10));
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [active, setActive] = useState(product ? product.active || Boolean(product.needs_review) : true);
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const input = { sku: sku.trim() || skuFrom(name), name: name.trim(), description: description.trim() || undefined, price, currency: "INR", inventory: Number(inventory), image_url: imageUrl.trim() || undefined, active };
      if (product) await whatsappStudioApi.updateProduct(businessId, product.id, input);
      else await whatsappStudioApi.createProduct(businessId, input);
      show(product ? "Product saved." : "Product added.", "success");
      onSaved();
    } catch (error) {
      show(errorText(error, "Couldn't save. Check the price and stock."), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={() => !busy && onClose()}
      title={product ? "Edit product" : "Add product"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="shop-product" isLoading={busy}>{product ? "Save" : "Add product"}</Button>
        </>
      }
    >
      <form id="shop-product" className={styles.form} onSubmit={save}>
        <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={160} placeholder="Red cotton kurta" />
        <div className={styles.split}>
          <Input label="Price (₹)" type="number" min="0.01" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} required />
          <Input label="In stock" type="number" min="0" value={inventory} onChange={(event) => setInventory(event.target.value)} required helperText="Goes down as orders are paid." />
        </div>
        <Textarea label="Description (optional)" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={2000} helperText="Shown under the photo in WhatsApp. Size, material, what's included." />
        <Input label="Photo link (optional)" type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://…/kurta.jpg" helperText="A public https link. Products copied from your Products page bring their photo with them." />
        <Input label="Product code (optional)" value={sku} onChange={(event) => setSku(event.target.value.replace(/[^A-Za-z0-9._-]/g, "-"))} placeholder="Made from the name if empty" />
        <label className={styles.check}>
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
          <span>On sale (customers can see and order it)</span>
        </label>
      </form>
    </Modal>
  );
}

/** For orders taken on a call or in chat: pick items, get a pay link to send. */
function OrderBuilder({ businessId, products, onCreated }: { businessId: string | null; products: StudioProduct[]; onCreated: () => Promise<void> }) {
  const { show } = useToast();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const total = products.reduce((sum, product) => sum + product.price_minor * (cart[product.id] ?? 0), 0);

  async function create() {
    if (!businessId) return;
    const items = Object.entries(cart).filter(([, quantity]) => quantity > 0).map(([product_id, quantity]) => ({ product_id, quantity }));
    setBusy(true);
    try {
      const result = await whatsappStudioApi.createOrder(businessId, { customer_phone: phone.trim() || undefined, items });
      setLink(result.checkout.url);
      setCart({});
      show("Order created. Send the customer the pay link below.", "success");
      await onCreated();
    } catch (error) {
      show(errorText(error, "Couldn't create the order. Check stock, and your UPI ID in Settings."), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2>Create an order for a customer</h2>
      <p>For orders taken on a call or in chat. You get a pay link to send them. (Customers can also order on their own from your menu.)</p>
      {products.length === 0 ? (
        <p className={styles.muted}>Add a product first.</p>
      ) : (
        <>
          <ul className={styles.cart}>
            {products.map((product) => {
              const available = product.inventory - product.reserved_inventory;
              return (
                <li key={product.id}>
                  <span>
                    <strong>{product.name}</strong>
                    <small>{money(product.price_minor)}</small>
                  </span>
                  <Input
                    aria-label={`How many ${product.name}`}
                    type="number"
                    min="0"
                    max={Math.max(0, available)}
                    value={String(cart[product.id] ?? 0)}
                    disabled={available <= 0}
                    onChange={(event) => setCart((current) => ({ ...current, [product.id]: Math.max(0, Number(event.target.value)) }))}
                  />
                </li>
              );
            })}
          </ul>
          <Input label="Customer's WhatsApp number" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+919876543210" />
          <Button onClick={() => void create()} isLoading={busy} disabled={total <= 0}>
            {total > 0 ? `Create order · ${money(total)}` : "Pick at least one product"}
          </Button>
        </>
      )}
      {link && (
        <div className={styles.shareLink}>
          <strong>Pay link</strong>
          <Input readOnly value={link} aria-label="Pay link" />
          <Button variant="secondary" onClick={() => copyText(link).then(() => show("Link copied.", "success"))}>
            Copy link
          </Button>
        </div>
      )}
    </Card>
  );
}

function CatalogCard({ businessId, connection, onChanged }: { businessId: string | null; connection: StudioCatalogConnection | null; onChanged: () => Promise<void> }) {
  const { show } = useToast();
  const [open, setOpen] = useState(Boolean(connection));
  const [catalogId, setCatalogId] = useState(connection?.catalog_id ?? "");
  const [busy, setBusy] = useState(false);

  async function run(action: "link" | "sync") {
    if (!businessId) return;
    setBusy(true);
    try {
      if (action === "link") {
        await whatsappStudioApi.connectCatalog(businessId, catalogId.trim());
        show("Meta catalog linked.", "success");
      } else {
        const result = await whatsappStudioApi.syncCatalog(businessId);
        show(`Imported ${result.synced} item(s). Check their price and stock, then turn them on.`, "success");
      }
      await onChanged();
    } catch {
      show(action === "link" ? "Couldn't verify that catalog. Check its ID and that your WhatsApp account can use it." : "Couldn't sync from Meta.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <button type="button" className={styles.disclosure} onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>
          <strong>Advanced: Meta catalog</strong>
          <small>{connection ? `Linked: ${connection.catalog_name || connection.catalog_id}` : "Only if you already manage products in Meta Commerce Manager."}</small>
        </span>
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className={styles.form}>
          <p className={styles.muted}>
            Linking lets customers order from the catalog button in WhatsApp too. Imported items start hidden until you check their price and stock.
          </p>
          <Input label="Meta catalog ID" value={catalogId} onChange={(event) => setCatalogId(event.target.value.replace(/\D/g, ""))} placeholder="367025965434465" />
          <div className={styles.split}>
            <Button variant="secondary" onClick={() => void run("link")} isLoading={busy} disabled={!catalogId.trim()}>Verify &amp; link</Button>
            {connection && <Button variant="secondary" onClick={() => void run("sync")} isLoading={busy}>Sync items</Button>}
          </div>
          {connection?.last_synced_at && <small className={styles.muted}>Last synced {formatRelativeTime(connection.last_synced_at)}</small>}
        </div>
      )}
    </Card>
  );
}
