"use client";

import { useState } from "react";
import { meeshoApi } from "@/lib/api/marketplaces";
import type { MarketplaceProduct } from "@/lib/api/marketplaces";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/context/ToastContext";
import { ApiError } from "@/lib/api";
import { Badge, Button, Card, EmptyState, Input, Skeleton } from "@/components/ui";
import styles from "../page.module.scss";
import pageStyles from "../woocommerce/page.module.scss";
import { AppHeader } from "@/components/features/hubs/AppHeader";

export default function MeeshoPage() {
  const { businessId, isLoading: businessLoading, hasNoBusinesses } = useActiveBusiness();
  const { show } = useToast();

  const [supplierId, setSupplierId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  const { data: status, refresh: refreshStatus } = useAsync(
    () => (businessId ? meeshoApi.status(businessId) : Promise.resolve(null)),
    [businessId]
  );

  async function handleConnect() {
    if (!businessId || !supplierId.trim() || !apiKey.trim()) return;
    setIsConnecting(true);
    try {
      await meeshoApi.connect(businessId, { supplier_id: supplierId.trim(), api_key: apiKey.trim() });
      show("Meesho supplier account connected.", "success");
      setSupplierId("");
      setApiKey("");
      refreshStatus();
    } catch (err) {
      const message = err instanceof ApiError ? err.userMessage : "Couldn't verify those credentials. Check your supplier ID and API key.";
      show(message, "error");
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!businessId) return;
    try {
      await meeshoApi.disconnect(businessId);
      show("Meesho disconnected.", "default");
      refreshStatus();
    } catch {
      show("Couldn't disconnect. Please try again.", "error");
    }
  }

  if (businessLoading) return <Skeleton height={300} />;
  if (hasNoBusinesses || !businessId) {
    return <EmptyState title="Create a business first" description="You'll need a business set up before connecting Meesho." />;
  }

  return (
    <div>
      <AppHeader color="#f43397" title="Meesho Supplier Panel" subtitle={<>Sync your Meesho supplier catalog, via Meesho&apos;s Supplier API.</>} right={<Badge variant="warning">Setup required</Badge>} />

      <Card padding="md" className={styles.section}>
        <div className={styles.sectionTitle}>Before you connect</div>
        <div className={styles.sectionHint}>
          This page uses Meesho&apos;s Supplier API token exchange and catalog endpoint, built from Meesho&apos;s
          available supplier documentation (which is thinner than Amazon/Flipkart&apos;s public docs). What it
          needs from you is your own supplier_id and api_key, generated from Meesho Supplier Panel → Settings → API
          Access, which requires your supplier account to already be approved for API access.
        </div>
        <div className={styles.sectionHint}>
          <strong>Order lookup is not available for Meesho.</strong> No publicly documented Meesho endpoint for
          looking up a single order exists. Only catalog sync is supported here.
        </div>
        <div className={styles.formGrid}>
          <Input label="Supplier ID" placeholder="supplier_id" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} />
          <Input label="API key" placeholder="api_key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        </div>
        <div className={styles.footer}>
          <Button onClick={handleConnect} isLoading={isConnecting} disabled={!supplierId.trim() || !apiKey.trim()}>
            Verify &amp; connect
          </Button>
        </div>
      </Card>

      {status?.connected && (
        <Card padding="md" className={styles.section}>
          <div className={styles.sectionTitle}>Connection</div>
          <div className={pageStyles.storeRow}>
            <div className={pageStyles.storeInfo}>
              <div className={pageStyles.storeName}>Supplier {status.supplier_id}</div>
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
      setProducts(await meeshoApi.products(businessId));
    } catch (err) {
      const message = err instanceof ApiError ? err.userMessage : "Couldn't load catalog. Please try again.";
      show(message, "error");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card padding="md" className={styles.section}>
      <div className={styles.sectionTitle}>Browse catalog</div>
      <div className={styles.sectionHint}>Live call to Meesho&apos;s Supplier Catalog API.</div>
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
          {products.length === 0 && <EmptyState title="No products returned" description="This supplier account may have no active catalog items, or the API returned none." />}
        </div>
      )}
    </Card>
  );
}
