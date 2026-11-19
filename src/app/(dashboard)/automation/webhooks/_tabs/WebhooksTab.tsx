"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { copyText } from "@/lib/utils/browser";
import { Badge, Button, Card, EmptyState, Input, Skeleton } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { outboundWebhooksApi, WEBHOOK_EVENTS, type OutboundWebhook, type WebhookLog } from "@/lib/api/outbound-webhooks";
import styles from "../page.module.scss";

/** Unchanged from the original single-purpose /automation/webhooks page.
 * only moved into its own component so the page can host it as one tab
 * alongside API Keys / Cross-App Triggers / Connected Apps. */
export function WebhooksTab({ businessId }: { businessId: string }) {
  const { show } = useToast();
  const [items, setItems] = useState<OutboundWebhook[]>([]);
  const [health, setHealth] = useState<Record<string, { attempts: number; successes: number; failures: number }>>({});
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["message.received"]);
  const [secret, setSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [webhooks, summary] = await Promise.all([outboundWebhooksApi.list(businessId), outboundWebhooksApi.health(businessId)]);
      setItems(webhooks); setHealth(summary.webhooks);
    } catch { show("Couldn't load webhook endpoints.", "error"); }
    finally { setLoading(false); }
  }, [businessId, show]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!events.length) return show("Select at least one event.", "error");
    setBusy(true);
    try {
      const result = await outboundWebhooksApi.create(businessId, { label, url, events });
      setSecret(result.signing_secret); setLabel(""); setUrl("");
      show("Webhook created. Save the signing secret now.", "success"); await load();
    } catch { show("Use a valid public HTTPS endpoint.", "error"); }
    finally { setBusy(false); }
  }

  async function run(work: () => Promise<unknown>, success: string) {
    setBusy(true);
    try { await work(); show(success, "success"); await load(); }
    catch { show("The action failed. Check the endpoint and retry.", "error"); }
    finally { setBusy(false); }
  }

  async function openLogs(id: string) {
    setSelected(id);
    try { setLogs(await outboundWebhooksApi.logs(businessId, id)); }
    catch { show("Couldn't load delivery attempts.", "error"); }
  }

  async function testEndpoint(id: string) {
    setBusy(true);
    try {
      const result = await outboundWebhooksApi.test(businessId, id);
      show(result.success ? `Test delivered (${result.status_code}).` : `Test failed: ${result.error ?? result.status_code ?? "no response"}`, result.success ? "success" : "error");
      await load();
    } catch { show("The test request failed.", "error"); }
    finally { setBusy(false); }
  }

  if (loading) return <Skeleton height={420} />;

  return <>
    <div className={styles.guide}><strong>Verify every request</strong><code>HMAC_SHA256(signing_secret, raw_request_body)</code><span>Compare with <b>X-VaultX-Signature</b>, reject stale <b>X-VaultX-Timestamp</b> values, and deduplicate <b>X-VaultX-Event-Id</b>.</span></div>

    {secret && <Card className={styles.secret}><div><strong>Copy this signing secret now</strong><p>It is encrypted at rest and will not be shown again.</p></div><code>{secret}</code><Button variant="secondary" onClick={() => void copyText(secret)}>Copy secret</Button></Card>}

    <div className={styles.columns}>
      <Card><h2>Add endpoint</h2><form className={styles.form} onSubmit={create}>
        <Input label="Label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="CRM production" required />
        <Input label="Public HTTPS URL" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/vaultx/events" required />
        <fieldset><legend>Events</legend>{WEBHOOK_EVENTS.map((name) => <label key={name}><input type="checkbox" checked={events.includes(name)} onChange={() => setEvents((current) => current.includes(name) ? current.filter((value) => value !== name) : [...current, name])} /> {name}</label>)}</fieldset>
        <Button type="submit" isLoading={busy}>Create secure endpoint</Button>
      </form></Card>

      <section className={styles.list}><h2>Endpoints</h2>{items.length === 0 ? <EmptyState title="No endpoints yet" description="Create one to receive signed product events." /> : items.map((item) => {
        const stats = health[item.id] ?? { attempts: 0, successes: 0, failures: 0 };
        const ratio = stats.attempts ? Math.round(stats.successes / stats.attempts * 100) : 100;
        return <Card key={item.id} className={styles.endpoint}>
          <div className={styles.endpointTop}><div><h3>{item.label}</h3><span>{item.url}</span></div><Badge variant={item.active ? "success" : "neutral"}>{item.active ? "Active" : "Paused"}</Badge></div>
          <div className={styles.metrics}><span>{ratio}% success</span><span>{stats.failures} failed</span><span>{stats.attempts} attempts</span></div>
          <div className={styles.actions}><Button size="sm" variant="secondary" onClick={() => void testEndpoint(item.id)} disabled={busy}>Test</Button><Button size="sm" variant="secondary" onClick={() => void openLogs(item.id)}>Logs</Button><Button size="sm" variant="secondary" onClick={() => void run(() => outboundWebhooksApi.update(businessId, item.id, { active: !item.active }), item.active ? "Endpoint paused." : "Endpoint resumed.")}>{item.active ? "Pause" : "Resume"}</Button><Button size="sm" variant="danger" onClick={() => { if (confirm(`Delete ${item.label}?`)) void run(() => outboundWebhooksApi.delete(businessId, item.id), "Endpoint deleted."); }}>Delete</Button></div>
        </Card>;
      })}</section>
    </div>

    {selected && <section className={styles.logs}><div className={styles.logHeading}><h2>Delivery attempts</h2><Button size="sm" variant="secondary" onClick={() => setSelected(null)}>Close</Button></div>{logs.length === 0 ? <p>No delivery attempts yet.</p> : logs.map((log) => <Card key={log.id} className={styles.log}><div><Badge variant={log.success ? "success" : "warning"}>{log.success ? "Delivered" : "Failed"}</Badge><strong>{log.event ?? "event"}</strong><span>{log.status_code ?? log.error ?? "No response"} · {log.duration_ms ?? 0} ms</span></div>{!log.success && <Button size="sm" variant="secondary" onClick={() => void run(() => outboundWebhooksApi.retry(businessId, selected, log.id), "Retry delivered.")}>Retry</Button>}</Card>)}</section>}
  </>;
}
