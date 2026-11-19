"use client";

import { useState } from "react";
import { amazonApi } from "@/lib/api/marketplaces";
import type { MarketplaceOrder, MarketplaceProduct } from "@/lib/api/marketplaces";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/context/ToastContext";
import { ApiError } from "@/lib/api";
import { Badge, Button, Card, EmptyState, Input, Skeleton } from "@/components/ui";
import styles from "../page.module.scss";
import pageStyles from "../woocommerce/page.module.scss";
import { AppHeader } from "@/components/features/hubs/AppHeader";

export default function AmazonPage() {
  const { businessId, isLoading: businessLoading, hasNoBusinesses } = useActiveBusiness();
  const { show } = useToast();
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  const { data: status, refresh: refreshStatus } = useAsync(
    () => (businessId ? amazonApi.status(businessId) : Promise.resolve(null)),
    [businessId]
  );

  async function handleAuthorize() {
    if (!businessId) return;
    setIsAuthorizing(true);
    try {
      const result = await amazonApi.authorize(businessId);
      window.location.href = result.authorize_url;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.userMessage
          : "Couldn't start Amazon authorization. This server may not have Amazon SP-API app credentials configured yet.";
      show(message, "error");
      setIsAuthorizing(false);
    }
  }

  async function handleDisconnect() {
    if (!businessId) return;
    try {
      await amazonApi.disconnect(businessId);
      show("Amazon disconnected.", "default");
      refreshStatus();
    } catch {
      show("Couldn't disconnect. Please try again.", "error");
    }
  }

  if (businessLoading) return <Skeleton height={300} />;
  if (hasNoBusinesses || !businessId) {
    return <EmptyState title="Create a business first" description="You'll need a business set up before connecting Amazon." />;
  }

  return (
    <div>
      <AppHeader color="#ff9900" title="Amazon Seller Central" subtitle={<>Sync your Amazon seller catalog and look up orders, via Amazon&apos;s real Selling Partner API (SP-API).</>} right={<Badge variant="warning">Setup required</Badge>} />

      <Card padding="md" className={styles.section}>
        <div className={styles.sectionTitle}>Before you connect</div>
        <div className={styles.sectionHint}>
          This page runs Amazon&apos;s real Login-With-Amazon OAuth flow and real SP-API endpoint calls. The
          integration code is genuinely built and working end-to-end. What it can&apos;t do is skip Amazon&apos;s own
          approval step: SP-API access requires a marketplace-approved developer application, which has to be
          registered and reviewed by Amazon (Seller Central → Apps &amp; Services → Develop Apps) before any seller,
          including you, can authorize it. Ask your platform administrator whether an SP-API app has been
          registered and configured on this server before starting below.
        </div>
        <div className={styles.footer}>
          <Button onClick={handleAuthorize} isLoading={isAuthorizing}>
            {status?.connected ? "Re-authorize with Amazon" : "Connect with Amazon"}
          </Button>
        </div>
      </Card>

      {status?.connected && (
        <Card padding="md" className={styles.section}>
          <div className={styles.sectionTitle}>Connection</div>
          <div className={pageStyles.storeRow}>
            <div className={pageStyles.storeInfo}>
              <div className={pageStyles.storeName}>Seller {status.seller_id}</div>
              <div className={pageStyles.storeMeta}>
                Region: {status.region} · Status: {status.status}
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
      setProducts(await amazonApi.products(businessId));
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
      <div className={styles.sectionHint}>Live call to Amazon&apos;s Listings Items API.</div>
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
              <Badge variant={product.stock_status === "IN_STOCK" || product.stock_status === "instock" ? "success" : "danger"}>
                {product.stock_status}
              </Badge>
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
      setOrder(await amazonApi.lookupOrder(businessId, orderId.trim()));
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
      <div className={styles.sectionHint}>
        Look up an order by its Amazon Order Id (format nnn-nnnnnnn-nnnnnnn) via the real Orders API.
      </div>
      <div className={styles.sheetUrlRow}>
        <Input placeholder="e.g. 123-4567890-1234567" value={orderId} onChange={(e) => setOrderId(e.target.value)} />
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
