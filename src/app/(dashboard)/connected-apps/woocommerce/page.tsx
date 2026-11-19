"use client";

import { useState } from "react";
import { woocommerceApi } from "@/lib/api/woocommerce";
import type { WooCommerceOrder, WooCommerceProduct, WooCommerceStore } from "@/lib/api/woocommerce";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/context/ToastContext";
import { ApiError } from "@/lib/api";
import { Badge, Button, Card, EmptyState, Input, Skeleton } from "@/components/ui";
import styles from "../page.module.scss";
import pageStyles from "./page.module.scss";
import { AppHeader } from "@/components/features/hubs/AppHeader";

export default function WooCommercePage() {
  const { businessId, isLoading: businessLoading, hasNoBusinesses } = useActiveBusiness();
  const { show } = useToast();

  const [storeUrl, setStoreUrl] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [syncingUrl, setSyncingUrl] = useState<string | null>(null);

  const { data: stores, refresh: refreshStores } = useAsync(
    () => (businessId ? woocommerceApi.listStores(businessId) : Promise.resolve([])),
    [businessId]
  );

  async function handleConnect() {
    if (!businessId || !storeUrl.trim() || !consumerKey.trim() || !consumerSecret.trim()) return;
    setIsConnecting(true);
    try {
      await woocommerceApi.connect(businessId, {
        store_url: storeUrl.trim(),
        consumer_key: consumerKey.trim(),
        consumer_secret: consumerSecret.trim(),
        webhook_secret: webhookSecret.trim() || undefined,
      });
      show("WooCommerce store connected. Products are syncing.", "success");
      setStoreUrl("");
      setConsumerKey("");
      setConsumerSecret("");
      setWebhookSecret("");
      refreshStores();
    } catch (err) {
      const message = err instanceof ApiError ? err.userMessage : "Couldn't connect that store. Check the URL and keys.";
      show(message, "error");
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleDisconnect(url: string) {
    if (!businessId) return;
    try {
      await woocommerceApi.disconnect(businessId, url);
      show("Store disconnected.", "default");
      refreshStores();
    } catch {
      show("Couldn't disconnect that store. Please try again.", "error");
    }
  }

  async function handleSync(url: string) {
    if (!businessId) return;
    setSyncingUrl(url);
    try {
      await woocommerceApi.sync(businessId, url);
      show("Sync started. This may take a minute for large catalogs.", "success");
    } catch {
      show("Couldn't start sync. Please try again.", "error");
    } finally {
      setSyncingUrl(null);
    }
  }

  if (businessLoading) return <Skeleton height={300} />;
  if (hasNoBusinesses || !businessId) {
    return <EmptyState title="Create a business first" description="You'll need a business set up before connecting WooCommerce." />;
  }

  return (
    <div>
      <AppHeader color="#7f54b3" title="WooCommerce" subtitle={<>Connect your WooCommerce store so your AI can answer product and order questions with real, live data.</>} />

      <Card padding="md" className={styles.section}>
        <div className={styles.sectionTitle}>Connect a store</div>
        <div className={styles.sectionHint}>
          Generate REST API keys in WooCommerce Admin → Settings → Advanced → REST API → Add key (Read/Write
          permissions).
        </div>
        <div className={styles.formGrid}>
          <Input label="Store URL" placeholder="https://mystore.com" value={storeUrl} onChange={(e) => setStoreUrl(e.target.value)} />
          <Input label="Consumer key" placeholder="ck_..." value={consumerKey} onChange={(e) => setConsumerKey(e.target.value)} />
          <Input
            label="Consumer secret"
            placeholder="cs_..."
            type="password"
            value={consumerSecret}
            onChange={(e) => setConsumerSecret(e.target.value)}
          />
          <Input
            label="Webhook secret (optional)"
            placeholder="Only needed if you configure webhooks in WooCommerce"
            type="password"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
          />
        </div>
        <div className={styles.footer}>
          <Button
            onClick={handleConnect}
            isLoading={isConnecting}
            disabled={!storeUrl.trim() || !consumerKey.trim() || !consumerSecret.trim()}
          >
            Connect store
          </Button>
        </div>
      </Card>

      <Card padding="md" className={styles.section}>
        <div className={styles.sectionTitle}>Connected stores</div>
        {!stores || stores.length === 0 ? (
          <EmptyState title="No stores connected yet" description="Connect a store above to get started." />
        ) : (
          <div className={pageStyles.storeList}>
            {stores.map((store) => (
              <StoreRow
                key={store.store_url}
                store={store}
                onDisconnect={() => handleDisconnect(store.store_url)}
                onSync={() => handleSync(store.store_url)}
                isSyncing={syncingUrl === store.store_url}
              />
            ))}
          </div>
        )}
      </Card>

      {stores && stores.length > 0 && (
        <>
          <ProductBrowsePanel businessId={businessId} defaultStoreUrl={stores[0].store_url} />
          <OrderLookupPanel businessId={businessId} defaultStoreUrl={stores[0].store_url} />
        </>
      )}
    </div>
  );
}

function StoreRow({
  store,
  onDisconnect,
  onSync,
  isSyncing,
}: {
  store: WooCommerceStore;
  onDisconnect: () => void;
  onSync: () => void;
  isSyncing: boolean;
}) {
  return (
    <div className={pageStyles.storeRow}>
      <div className={pageStyles.storeInfo}>
        <div className={pageStyles.storeName}>{store.store_name ?? store.store_url}</div>
        <div className={pageStyles.storeMeta}>
          {store.products_synced} product{store.products_synced === 1 ? "" : "s"} synced
          {store.last_synced_at ? ` · last synced ${new Date(store.last_synced_at).toLocaleString()}` : ""}
        </div>
      </div>
      <div className={pageStyles.storeActions}>
        <Button variant="secondary" size="sm" onClick={onSync} isLoading={isSyncing}>
          Sync
        </Button>
        <Button variant="secondary" size="sm" onClick={onDisconnect}>
          Disconnect
        </Button>
      </div>
    </div>
  );
}

function ProductBrowsePanel({ businessId, defaultStoreUrl }: { businessId: string; defaultStoreUrl: string }) {
  const { show } = useToast();
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<WooCommerceProduct[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleBrowse() {
    setIsLoading(true);
    try {
      const result = await woocommerceApi.browseProducts(businessId, defaultStoreUrl, query.trim() || undefined);
      setProducts(result);
    } catch {
      show("Couldn't load products. Please try again.", "error");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card padding="md" className={styles.section}>
      <div className={styles.sectionTitle}>Browse products</div>
      <div className={styles.sheetUrlRow}>
        <Input placeholder="Search products (optional)" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Button onClick={handleBrowse} isLoading={isLoading}>
          Browse
        </Button>
      </div>
      {products && (
        <div className={pageStyles.catalogGrid}>
          {products.map((product) => (
            <div key={product.id} className={pageStyles.catalogCard}>
              <div className={pageStyles.catalogName}>{product.name}</div>
              {product.price && <Badge variant="neutral">{product.price}</Badge>}
              <Badge variant={product.stock_status === "instock" ? "success" : "danger"}>{product.stock_status}</Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function OrderLookupPanel({ businessId, defaultStoreUrl }: { businessId: string; defaultStoreUrl: string }) {
  const { show } = useToast();
  const [orderNumber, setOrderNumber] = useState("");
  const [order, setOrder] = useState<WooCommerceOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleLookup() {
    if (!orderNumber.trim()) return;
    setIsLoading(true);
    setOrder(null);
    try {
      const result = await woocommerceApi.lookupOrder(businessId, defaultStoreUrl, orderNumber.trim());
      setOrder(result);
    } catch (err) {
      const message = err instanceof ApiError ? err.userMessage : "Order not found.";
      show(message, "error");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card padding="md" className={styles.section}>
      <div className={styles.sectionTitle}>Test order lookup</div>
      <div className={styles.sectionHint}>Look up an order by number to confirm the connection is working.</div>
      <div className={styles.sheetUrlRow}>
        <Input placeholder="Order number, e.g. 1234" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
        <Button onClick={handleLookup} isLoading={isLoading} disabled={!orderNumber.trim()}>
          Look up
        </Button>
      </div>
      {order && (
        <div className={pageStyles.orderResult}>
          <div><strong>{order.order_number}</strong> - {order.fulfillment_status}</div>
          <div>{order.total_price} {order.currency}</div>
          {order.items.length > 0 && <div>{order.items.map((i) => i.title).join(", ")}</div>}
        </div>
      )}
    </Card>
  );
}
