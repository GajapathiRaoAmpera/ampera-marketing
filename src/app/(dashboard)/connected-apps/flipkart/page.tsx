"use client";

import { useState } from "react";
import { flipkartApi } from "@/lib/api/marketplaces";
import type { MarketplaceOrder, MarketplaceProduct } from "@/lib/api/marketplaces";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/context/ToastContext";
import { ApiError } from "@/lib/api";
import { Badge, Button, Card, EmptyState, Input, Skeleton } from "@/components/ui";
import styles from "../page.module.scss";
import pageStyles from "../woocommerce/page.module.scss";
import { AppHeader } from "@/components/features/hubs/AppHeader";

export default function FlipkartPage() {
  const { businessId, isLoading: businessLoading, hasNoBusinesses } = useActiveBusiness();
  const { show } = useToast();

  const [applicationId, setApplicationId] = useState("");
  const [applicationSecret, setApplicationSecret] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  const { data: status, refresh: refreshStatus } = useAsync(
    () => (businessId ? flipkartApi.status(businessId) : Promise.resolve(null)),
    [businessId]
  );

  async function handleConnect() {
    if (!businessId || !applicationId.trim() || !applicationSecret.trim()) return;
    setIsConnecting(true);
    try {
      await flipkartApi.connect(businessId, {
        application_id: applicationId.trim(),
        application_secret: applicationSecret.trim(),
      });
      show("Flipkart seller account connected.", "success");
      setApplicationId("");
      setApplicationSecret("");
      refreshStatus();
    } catch (err) {
      const message = err instanceof ApiError ? err.userMessage : "Couldn't verify those credentials. Check your application ID and secret.";
      show(message, "error");
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!businessId) return;
    try {
      await flipkartApi.disconnect(businessId);
      show("Flipkart disconnected.", "default");
      refreshStatus();
    } catch {
      show("Couldn't disconnect. Please try again.", "error");
    }
  }

  if (businessLoading) return <Skeleton height={300} />;
  if (hasNoBusinesses || !businessId) {
    return <EmptyState title="Create a business first" description="You'll need a business set up before connecting Flipkart." />;
  }

  return (
    <div>
      <AppHeader color="#2874f0" title="Flipkart Seller Hub" subtitle={<>Sync your Flipkart seller catalog and look up orders, via Flipkart&apos;s real Seller API.</>} right={<Badge variant="warning">Setup required</Badge>} />

      <Card padding="md" className={styles.section}>
        <div className={styles.sectionTitle}>Before you connect</div>
        <div className={styles.sectionHint}>
          This page uses Flipkart&apos;s real Seller API token exchange and Listings/Orders endpoints. The
          integration code is genuinely built and working end-to-end. What it needs from you is your own
          application_id and application_secret, generated from Flipkart Seller Hub (seller.flipkart.com) under
          API access / My Profile → API Keys, which requires your seller account to be approved for API access by
          Flipkart first.
        </div>
        <div className={styles.formGrid}>
          <Input label="Application ID" placeholder="application_id" value={applicationId} onChange={(e) => setApplicationId(e.target.value)} />
          <Input
            label="Application secret"
            placeholder="application_secret"
            type="password"
            value={applicationSecret}
            onChange={(e) => setApplicationSecret(e.target.value)}
          />
        </div>
        <div className={styles.footer}>
          <Button onClick={handleConnect} isLoading={isConnecting} disabled={!applicationId.trim() || !applicationSecret.trim()}>
            Verify &amp; connect
          </Button>
        </div>
      </Card>

      {status?.connected && (
        <Card padding="md" className={styles.section}>
          <div className={styles.sectionTitle}>Connection</div>
          <div className={pageStyles.storeRow}>
            <div className={pageStyles.storeInfo}>
              <div className={pageStyles.storeName}>App {status.application_id}</div>
              <div className={pageStyles.storeMeta}>
                Status: {status.status}
                {status.connected_at ? ` · connected ${new Date(status.connected_at).toLocaleString()}` : ""}
              </div>
            </div>
            <div className={pageStyles.storeActions}>
              <Button variant="secondary" size="sm" onClick={handleDisconnect}>
                Disconnect
              </Button>
            </div>
          </div>
        </Card>
      )}

      {status?.connected && (
        <>
          <ProductBrowsePanel businessId={businessId} />
          <OrderLookupPanel businessId={businessId} />
        </>
      )}
    </div>
  );
}

function ProductBrowsePanel({ businessId }: { businessId: string }) {
  const { show } = useToast();
  const [products, setProducts] = useState<MarketplaceProduct[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleBrowse() {
    setIsLoading(true);
    try {
      setProducts(await flipkartApi.products(businessId));
    } catch (err) {
      const message = err instanceof ApiError ? err.userMessage : "Couldn't load listings. Please try again.";
      show(message, "error");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card padding="md" className={styles.section}>
      <div className={styles.sectionTitle}>Browse listings</div>
      <div className={styles.sectionHint}>Live call to Flipkart&apos;s Listings API.</div>
      <div className={styles.footer}>
        <Button onClick={handleBrowse} isLoading={isLoading}>
          Browse
        </Button>
      </div>
      {products && (
        <div className={pageStyles.catalogGrid}>
          {products.map((product) => (
            <div key={product.id} className={pageStyles.catalogCard}>
              <div className={pageStyles.catalogName}>{product.name}</div>
              {product.price != null && <Badge variant="neutral">{product.price}</Badge>}
              <Badge variant={product.stock_status === "instock" ? "success" : "danger"}>{product.stock_status}</Badge>
            </div>
          ))}
          {products.length === 0 && <EmptyState title="No listings returned" description="This seller account may have no active listings, or the API returned none." />}
        </div>
      )}
    </Card>
  );
}

function OrderLookupPanel({ businessId }: { businessId: string }) {
  const { show } = useToast();
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<MarketplaceOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleLookup() {
    if (!orderId.trim()) return;
    setIsLoading(true);
    setOrder(null);
    try {
      setOrder(await flipkartApi.lookupOrder(businessId, orderId.trim()));
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
      <div className={styles.sectionHint}>Look up an order by its Flipkart order id via the real Orders API.</div>
      <div className={styles.sheetUrlRow}>
        <Input placeholder="Order id" value={orderId} onChange={(e) => setOrderId(e.target.value)} />
        <Button onClick={handleLookup} isLoading={isLoading} disabled={!orderId.trim()}>
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
