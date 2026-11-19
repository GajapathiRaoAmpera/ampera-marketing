"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Input, Modal, Select, Skeleton, Switch, Table, Tabs } from "@/components/ui";
import { PhoneIcon } from "@/components/layout/icons";
import { useToast } from "@/context/ToastContext";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import {
  voiceToolsApi, type BusinessTool, type BuiltinToolKey,
  catalogApi, type CatalogItem,
  appointmentsApi, type Appointment, type AppointmentStatus,
} from "@/lib/api";
import styles from "./page.module.scss";
import { parseServerDate } from "@/lib/utils/date";

type Tab = "tools" | "catalog" | "appointments";

const BUILTIN_TOOLS: { key: BuiltinToolKey; name: string; description: string }[] = [
  { key: "rag_lookup", name: "Knowledge base lookup", description: "Answers grounded in this business's uploaded documents." },
  { key: "get_price", name: "Price lookup", description: "Looks up a product/service price from the catalog below." },
  { key: "check_stock", name: "Stock check", description: "Checks whether a product is currently in stock." },
  { key: "book_appointment", name: "Book appointment", description: "Books a caller's requested time, checking for conflicts." },
];

export default function VoiceStudioSetupPage() {
  const { businessId, isLoading, hasNoBusinesses } = useActiveBusiness();
  const { show } = useToast();
  const [tab, setTab] = useState<Tab>("tools");

  const [tools, setTools] = useState<BusinessTool[]>([]);
  const [loadingTools, setLoadingTools] = useState(true);
  const [webhookModalOpen, setWebhookModalOpen] = useState(false);
  const [webhookForm, setWebhookForm] = useState({ tool_key: "", display_name: "", description: "", webhook_url: "", webhook_secret: "" });

  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogForm, setCatalogForm] = useState({ sku: "", name: "", price: "", currency: "USD", stock_qty: "" });

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadTools = useCallback(() => {
    if (!businessId) return;
    setLoadingTools(true);
    voiceToolsApi.list(businessId).then(setTools).catch(() => show("Couldn't load tools.", "error")).finally(() => setLoadingTools(false));
  }, [businessId, show]);

  const loadCatalog = useCallback(() => {
    if (!businessId) return;
    setLoadingCatalog(true);
    catalogApi.list(businessId).then(setCatalogItems).catch(() => show("Couldn't load catalog.", "error")).finally(() => setLoadingCatalog(false));
  }, [businessId, show]);

  const loadAppointments = useCallback(() => {
    if (!businessId) return;
    setLoadingAppointments(true);
    appointmentsApi.list(businessId).then(setAppointments).catch(() => show("Couldn't load appointments.", "error")).finally(() => setLoadingAppointments(false));
  }, [businessId, show]);

  useEffect(() => { loadTools(); }, [loadTools]);
  useEffect(() => { loadCatalog(); }, [loadCatalog]);
  useEffect(() => { loadAppointments(); }, [loadAppointments]);

  function toolFor(key: string) {
    return tools.find((t) => t.tool_key === key);
  }

  async function toggleBuiltinTool(key: BuiltinToolKey, name: string, enabled: boolean) {
    if (!businessId) return;
    setBusy(true);
    try {
      await voiceToolsApi.upsert(businessId, { tool_key: key, enabled, display_name: name });
      show(enabled ? `${name} enabled.` : `${name} disabled.`, "success");
      loadTools();
    } catch {
      show("Couldn't update this tool.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveWebhookTool(event: FormEvent) {
    event.preventDefault();
    if (!businessId) return;
    setBusy(true);
    try {
      await voiceToolsApi.upsert(businessId, {
        tool_key: webhookForm.tool_key,
        enabled: true,
        display_name: webhookForm.display_name,
        description: webhookForm.description,
        implementation: { kind: "custom_webhook", webhook_url: webhookForm.webhook_url, webhook_secret: webhookForm.webhook_secret || undefined },
      });
      show("Custom tool saved.", "success");
      setWebhookModalOpen(false);
      setWebhookForm({ tool_key: "", display_name: "", description: "", webhook_url: "", webhook_secret: "" });
      loadTools();
    } catch {
      show("Couldn't save this tool. Check the webhook URL is a public HTTPS endpoint.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeCustomTool(toolKey: string) {
    if (!businessId || !confirm("Remove this custom tool?")) return;
    try {
      await voiceToolsApi.remove(businessId, toolKey);
      show("Tool removed.", "success");
      loadTools();
    } catch {
      show("Couldn't remove this tool.", "error");
    }
  }

  async function createCatalogItem(event: FormEvent) {
    event.preventDefault();
    if (!businessId) return;
    setBusy(true);
    try {
      await catalogApi.create(businessId, {
        sku: catalogForm.sku,
        name: catalogForm.name,
        price: Number(catalogForm.price) || 0,
        currency: catalogForm.currency,
        stock_qty: catalogForm.stock_qty ? Number(catalogForm.stock_qty) : undefined,
        active: true,
      });
      setCatalogForm({ sku: "", name: "", price: "", currency: "USD", stock_qty: "" });
      show("Item added.", "success");
      loadCatalog();
    } catch {
      show("Couldn't add this item. The SKU may already exist.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeCatalogItem(itemId: string) {
    if (!businessId || !confirm("Delete this catalog item?")) return;
    try {
      await catalogApi.remove(businessId, itemId);
      show("Item deleted.", "success");
      loadCatalog();
    } catch {
      show("Couldn't delete this item.", "error");
    }
  }

  async function updateAppointmentStatus(appointmentId: string, status: AppointmentStatus) {
    if (!businessId) return;
    try {
      await appointmentsApi.updateStatus(businessId, appointmentId, status);
      show("Appointment updated.", "success");
      loadAppointments();
    } catch {
      show("Couldn't update this appointment.", "error");
    }
  }

  if (isLoading) return <Skeleton height={320} />;
  if (hasNoBusinesses || !businessId) {
    return <EmptyState title="Create a business first" description="You'll need a business set up before you can configure voice tools." />;
  }

  return (
    <div>
      <div className={styles.header}>
        <div className={styles.iconBadge}>
          <PhoneIcon size={24} />
        </div>
        <div>
          <div className={styles.title}>Voice Studio Setup</div>
          <div className={styles.subtitle}>
            Enable the actions your AI agent can take on a call, manage your catalog, and review bookings.
          </div>
        </div>
      </div>

      <div className={styles.tabRow}>
        <Tabs value={tab} onChange={setTab} options={[
          { value: "tools", label: "Tools" },
          { value: "catalog", label: "Catalog" },
          { value: "appointments", label: "Appointments" },
        ]} />
      </div>

      {tab === "tools" && (
        <Card>
          {loadingTools ? (
            <Skeleton height={200} />
          ) : (
            <>
              {BUILTIN_TOOLS.map((builtin) => {
                const existing = toolFor(builtin.key);
                return (
                  <div key={builtin.key} className={styles.toolCard}>
                    <div className={styles.toolInfo}>
                      <span className={styles.toolName}>{builtin.name}</span>
                      <span className={styles.toolDescription}>{builtin.description}</span>
                    </div>
                    <Switch
                      checked={Boolean(existing?.enabled)}
                      onChange={(checked) => void toggleBuiltinTool(builtin.key, builtin.name, checked)}
                      disabled={busy}
                    />
                  </div>
                );
              })}

              <div className={styles.toolbar} style={{ marginTop: "var(--space-5)" }}>
                <div className={styles.toolName}>Custom actions (webhooks)</div>
                <Button size="sm" variant="secondary" onClick={() => setWebhookModalOpen(true)}>
                  + Add custom tool
                </Button>
              </div>
              {tools.filter((t) => t.implementation?.kind === "custom_webhook").map((tool) => (
                <div key={tool.tool_key} className={styles.toolCard}>
                  <div className={styles.toolInfo}>
                    <span className={styles.toolName}>{tool.display_name}</span>
                    <span className={styles.toolDescription}>{tool.description || tool.implementation?.webhook_url}</span>
                  </div>
                  <div className={styles.rowActions}>
                    <Switch
                      checked={tool.enabled}
                      onChange={(checked) => void toggleBuiltinTool(tool.tool_key as BuiltinToolKey, tool.display_name, checked)}
                      disabled={busy}
                    />
                    <Button size="sm" variant="ghost" onClick={() => void removeCustomTool(tool.tool_key)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </>
          )}
        </Card>
      )}

      {tab === "catalog" && (
        <>
          <Card style={{ marginBottom: "var(--space-5)" }}>
            <form className={styles.formGrid} onSubmit={createCatalogItem}>
              <Input label="SKU" value={catalogForm.sku} onChange={(e) => setCatalogForm((f) => ({ ...f, sku: e.target.value }))} required />
              <Input label="Name" value={catalogForm.name} onChange={(e) => setCatalogForm((f) => ({ ...f, name: e.target.value }))} required />
              <Input label="Price" type="number" min="0" step="0.01" value={catalogForm.price} onChange={(e) => setCatalogForm((f) => ({ ...f, price: e.target.value }))} required />
              <Input label="Stock qty (optional)" type="number" min="0" value={catalogForm.stock_qty} onChange={(e) => setCatalogForm((f) => ({ ...f, stock_qty: e.target.value }))} />
              <Button type="submit" isLoading={busy}>Add item</Button>
            </form>
          </Card>
          <Card>
            {loadingCatalog ? (
              <Skeleton height={200} />
            ) : catalogItems.length === 0 ? (
              <EmptyState title="No catalog items yet" description="Add products above so get_price/check_stock can answer callers accurately." />
            ) : (
              <Table<CatalogItem>
                rows={catalogItems}
                rowKey={(item) => item.id}
                columns={[
                  { key: "sku", header: "SKU", render: (i) => i.sku },
                  { key: "name", header: "Name", render: (i) => i.name },
                  { key: "price", header: "Price", render: (i) => `${i.currency} ${i.price.toFixed(2)}` },
                  { key: "stock", header: "Stock", render: (i) => (i.stock_qty ?? "-") },
                  {
                    key: "actions", header: "", render: (i) => (
                      <Button size="sm" variant="ghost" onClick={() => void removeCatalogItem(i.id)}>Delete</Button>
                    )
                  },
                ]}
              />
            )}
          </Card>
        </>
      )}

      {tab === "appointments" && (
        <Card>
          {loadingAppointments ? (
            <Skeleton height={200} />
          ) : appointments.length === 0 ? (
            <EmptyState title="No appointments yet" description="Bookings made during calls will show up here." />
          ) : (
            <Table<Appointment>
              rows={appointments}
              rowKey={(a) => a.id}
              columns={[
                { key: "when", header: "When", render: (a) => parseServerDate(a.requested_at).toLocaleString() },
                { key: "customer", header: "Customer", render: (a) => a.customer_name || "-" },
                { key: "status", header: "Status", render: (a) => <Badge variant={a.status === "confirmed" ? "success" : a.status === "cancelled" ? "neutral" : "warning"}>{a.status}</Badge> },
                { key: "notes", header: "Notes", render: (a) => a.notes || "-" },
                {
                  key: "actions", header: "", render: (a) => (
                    <Select aria-label="Update status" value={a.status} onChange={(e) => void updateAppointmentStatus(a.id, e.target.value as AppointmentStatus)}>
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="cancelled">Cancelled</option>
                    </Select>
                  )
                },
              ]}
            />
          )}
        </Card>
      )}

      <Modal isOpen={webhookModalOpen} onClose={() => setWebhookModalOpen(false)} title="Add a custom tool">
        <form className={styles.formGrid} style={{ gridTemplateColumns: "1fr" }} onSubmit={saveWebhookTool}>
          <Input label="Tool key" helperText="e.g. check_order_status, used internally." value={webhookForm.tool_key} onChange={(e) => setWebhookForm((f) => ({ ...f, tool_key: e.target.value }))} required />
          <Input label="Display name" value={webhookForm.display_name} onChange={(e) => setWebhookForm((f) => ({ ...f, display_name: e.target.value }))} required />
          <Input label="Description" helperText="Tells the AI when to use this tool." value={webhookForm.description} onChange={(e) => setWebhookForm((f) => ({ ...f, description: e.target.value }))} required />
          <Input label="Webhook URL" placeholder="https://your-server.com/hook" value={webhookForm.webhook_url} onChange={(e) => setWebhookForm((f) => ({ ...f, webhook_url: e.target.value }))} required />
          <Input label="Secret (optional)" type="password" value={webhookForm.webhook_secret} onChange={(e) => setWebhookForm((f) => ({ ...f, webhook_secret: e.target.value }))} />
          <Button type="submit" isLoading={busy}>Save tool</Button>
        </form>
      </Modal>
    </div>
  );
}
