"use client";

import { useState } from "react";
import { myntraApi } from "@/lib/api/marketplaces";
import type { MarketplaceProduct } from "@/lib/api/marketplaces";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/context/ToastContext";
import { ApiError } from "@/lib/api";
import { Badge, Button, Card, EmptyState, Input, Skeleton } from "@/components/ui";
import styles from "../page.module.scss";
import pageStyles from "../woocommerce/page.module.scss";
import { AppHeader } from "@/components/features/hubs/AppHeader";

export default function MyntraPage() {
  const { businessId, isLoading: businessLoading, hasNoBusinesses } = useActiveBusiness();
  const { show } = useToast();

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  const { data: status, refresh: refreshStatus } = useAsync(
    () => (businessId ? myntraApi.status(businessId) : Promise.resolve(null)),
    [businessId]
  );

  async function handleConnect() {
    if (!businessId || !clientId.trim() || !clientSecret.trim()) return;
    setIsConnecting(true);
    try {
      await myntraApi.connect(businessId, { client_id: clientId.trim(), client_secret: clientSecret.trim() });
      show("Myntra Partner Portal account connected.", "success");
      setClientId("");
      setClientSecret("");
      refreshStatus();
    } catch (err) {
      const message = err instanceof ApiError ? err.userMessage : "Couldn't verify those credentials. Check your client ID and secret.";
      show(message, "error");
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!businessId) return;
    try {
      await myntraApi.disconnect(businessId);
      show("Myntra disconnected.", "default");
      refreshStatus();
    } catch {
      show("Couldn't disconnect. Please try again.", "error");
    }
  }

  if (businessLoading) return <Skeleton height={300} />;
  if (hasNoBusinesses || !businessId) {
    return <EmptyState title="Create a business first" description="You'll need a business set up before connecting Myntra." />;
  }

  return (
    <div>
      <AppHeader color="#ff3f6c" title="Myntra Partner Portal" subtitle={<>Sync your Myntra style catalog, via Myntra&apos;s Partner Portal API.</>} right={<Badge variant="warning">Setup required</Badge>} />

      <Card padding="md" className={styles.section}>
        <div className={styles.sectionTitle}>Before you connect</div>
        <div className={styles.sectionHint}>
          This page uses Myntra&apos;s Partner Portal token exchange and styles endpoint, built from Myntra&apos;s
          publicly available seller-integration documentation, which (like Meesho&apos;s) is thinner than Amazon or
          Flipkart&apos;s public docs. What it needs from you is your own client_id and client_secret, generated from
          Myntra Partner Portal (portal.myntra.com) under your registered application&apos;s API credentials, which
          requires your seller account to already be approved as a Myntra partner.
        </div>
        <div className={styles.sectionHint}>
          <strong>Order lookup is not available for Myntra.</strong> No publicly documented Myntra endpoint for
          looking up a single order exists. Only catalog sync is supported here.
        </div>
        <div className={styles.formGrid}>
          <Input label="Client ID" placeholder="client_id" value={clientId} onChange={(e) => setClientId(e.target.value)} />
          <Input label="Client secret" placeholder="client_secret" type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
        </div>
        <div className={styles.footer}>
          <Button onClick={handleConnect} isLoading={isConnecting} disabled={!clientId.trim() || !clientSecret.trim()}>
            Verify &amp; connect
          </Button>
        </div>
      </Card>

      {status?.connected && (
        <Card padding="md" className={styles.section}>
          <div className={styles.sectionTitle}>Connection</div>
          <div className={pageStyles.storeRow}>
            <div className={pageStyles.storeInfo}>
              <div className={pageStyles.storeName}>Client {status.client_id}</div>
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

      {status?.connected && <ProductBrowsePanel businessId={businessId} />}
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
      setProducts(await myntraApi.products(businessId));
    } catch (err) {
      const message = err instanceof ApiError ? err.userMessage : "Couldn't load catalog. Please try again.";
      show(message, "error");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card padding="md" className={styles.section}>
      <div className={styles.sectionTitle}>Browse style catalog</div>
      <div className={styles.sectionHint}>Live call to Myntra Partner Portal&apos;s styles endpoint.</div>
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
          {products.length === 0 && <EmptyState title="No styles returned" description="This seller account may have no active styles, or the API returned none." />}
        </div>
      )}
    </Card>
  );
}
