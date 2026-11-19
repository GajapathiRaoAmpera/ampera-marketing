"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { copyText } from "@/lib/utils/browser";
import { Badge, Button, Card, EmptyState, Input, Skeleton } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { apiKeysApi, type ApiKey, type CreatedApiKey } from "@/lib/api/integrations";
import styles from "../page.module.scss";

function formatDate(iso?: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString();
}

export function ApiKeysTab({ businessId }: { businessId: string }) {
  const { show } = useToast();
  const [items, setItems] = useState<ApiKey[]>([]);
  const [label, setLabel] = useState("");
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await apiKeysApi.list(businessId));
    } catch {
      show("Couldn't load API keys.", "error");
    } finally {
      setLoading(false);
    }
  }, [businessId, show]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!label.trim()) return show("Give this key a label so you can tell it apart later.", "error");
    setBusy(true);
    try {
      const result = await apiKeysApi.create(businessId, label.trim());
      setCreated(result.api_key);
      setLabel("");
      show("API key created. Copy it now, it won't be shown again.", "success");
      await load();
    } catch {
      show("Couldn't create the API key.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(item: ApiKey) {
    if (!confirm(`Revoke "${item.label}"? Anything using this key will stop working immediately.`)) return;
    setBusy(true);
    try {
      await apiKeysApi.revoke(businessId, item.id);
      show("Key revoked.", "success");
      await load();
    } catch {
      show("Couldn't revoke the key.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Skeleton height={320} />;

  return (
    <>
      <div className={styles.guide}>
        <strong>Use with the Public Integrations API</strong>
        <code>Authorization: Bearer vx_live_...</code>
        <span>
          Point Zapier, Make, n8n, or a custom script at{" "}
          <code>/api/v1/public/...</code> with this key to read leads/conversations, send WhatsApp
          messages, look up orders, or trigger a broadcast, the reverse of the webhooks tab, where
          this platform calls out to you.
        </span>
      </div>

      {created && (
        <Card className={styles.secret}>
          <div>
            <strong>Copy this API key now</strong>
            <p>Only its hash is stored, this is the only time the full key is shown.</p>
          </div>
          <code>{created.api_key}</code>
          <Button variant="secondary" onClick={() => void copyText(created.api_key)}>
            Copy key
          </Button>
        </Card>
      )}

      <div className={styles.columns}>
        <Card>
          <h2>Create a key</h2>
          <form className={styles.form} onSubmit={create}>
            <Input
              label="Label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Zapier integration"
              required
            />
            <Button type="submit" isLoading={busy}>
              Generate key
            </Button>
          </form>
        </Card>

        <section className={styles.list}>
          <h2>Keys</h2>
          {items.length === 0 ? (
            <EmptyState title="No API keys yet" description="Create one to connect an external automation tool." />
          ) : (
            items.map((item) => (
              <Card key={item.id} className={styles.endpoint}>
                <div className={styles.endpointTop}>
                  <div>
                    <h3>{item.label}</h3>
                    <span>
                      {item.key_prefix}… · created {formatDate(item.created_at)}
                    </span>
                  </div>
                  <Badge variant={item.active ? "success" : "neutral"}>{item.active ? "Active" : "Revoked"}</Badge>
                </div>
                <div className={styles.metrics}>
                  <span>Last used: {formatDate(item.last_used_at)}</span>
                </div>
                {item.active && (
                  <div className={styles.actions}>
                    <Button size="sm" variant="danger" onClick={() => void revoke(item)} disabled={busy}>
                      Revoke
                    </Button>
                  </div>
                )}
              </Card>
            ))
          )}
        </section>
      </div>
    </>
  );
}
