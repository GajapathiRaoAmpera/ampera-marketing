"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Card, EmptyState, Modal, Skeleton, Table, type TableColumn } from "@/components/ui";
import { whatsappTemplatesApi, ApiError, type WhatsAppTemplate } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/context/ToastContext";
import { TemplatePreview } from "./TemplatePreview";
import styles from "./TemplateList.module.scss";

const PAGE_SIZE = 100;

function statusVariant(status: string): "success" | "warning" | "danger" | "neutral" {
  const s = status.toUpperCase();
  if (s === "APPROVED") return "success";
  if (s === "PENDING") return "warning";
  if (s === "REJECTED" || s === "DISABLED") return "danger";
  return "neutral";
}

export function TemplateList({ businessId, onMutated }: { businessId: string; onMutated?: () => void }) {
  const { show } = useToast();
  const [previewTemplate, setPreviewTemplate] = useState<WhatsAppTemplate | null>(null);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [refreshingName, setRefreshingName] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [page, setPage] = useState(0);

  const { data: templates, isLoading, refresh } = useAsync(
    () => whatsappTemplatesApi.listLocal({ limit: PAGE_SIZE, skip: page * PAGE_SIZE, businessId }),
    [businessId, page],
  );
  // The list endpoint returns at most PAGE_SIZE rows with no total count, so
  // a full page is our only signal that more might exist on the next page.
  const mightHaveMore = (templates?.length ?? 0) === PAGE_SIZE;

  function refreshAll() {
    refresh();
    onMutated?.();
  }

  async function handleSync() {
    setIsSyncing(true);
    try {
      const res = await whatsappTemplatesApi.sync(businessId);
      if (res.success) {
        setTokenExpired(false);
        show(`Synced ${res.synced_count} template(s) from Meta.`, "success");
        refreshAll();
      } else if (res.error_reason === "token_expired") {
        setTokenExpired(true);
      } else {
        show(res.error || "Sync failed.", "error");
      }
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Sync failed.", "error");
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleRefreshOne(name: string) {
    setRefreshingName(name);
    try {
      await whatsappTemplatesApi.refreshStatus(name, "en_US", businessId);
      refreshAll();
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't refresh status.", "error");
    } finally {
      setRefreshingName(null);
    }
  }

  async function handleDelete(name: string) {
    if (!confirm(`Delete template "${name}"? This removes it from Meta and can't be undone. Templates sent in the last 30 days can't be deleted.`)) {
      return;
    }
    setDeletingName(name);
    try {
      const res = await whatsappTemplatesApi.delete(name, businessId);
      if (res.success) {
        show(`Template "${name}" deleted.`, "success");
        refreshAll();
      } else {
        show(res.error || "Couldn't delete: Meta may be blocking it (e.g. sent within the last 30 days).", "error");
      }
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't delete template.", "error");
    } finally {
      setDeletingName(null);
    }
  }

  const columns: TableColumn<WhatsAppTemplate>[] = [
    {
      key: "name",
      header: "Name",
      render: (t) => <span className={styles.nameCell}>{t.name}</span>,
    },
    {
      key: "category",
      header: "Category",
      render: (t) => <Badge variant="neutral">{t.category}</Badge>,
    },
    {
      key: "language",
      header: "Language",
      render: (t) => t.language,
    },
    {
      key: "status",
      header: "Status",
      render: (t) => (
        <div className={styles.statusCell}>
          <Badge variant={statusVariant(t.status)} dot>
            {t.status}
          </Badge>
          {t.status === "REJECTED" && t.rejected_reason && (
            <span className={styles.rejectedReason} title={t.rejected_reason}>
              {t.rejected_reason}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (t) => (
        <div className={styles.actionsCell}>
          <Button variant="ghost" size="sm" onClick={() => setPreviewTemplate(t)}>
            Preview
          </Button>
          <Button variant="ghost" size="sm" isLoading={refreshingName === t.name} onClick={() => handleRefreshOne(t.name)}>
            Refresh
          </Button>
          <Button variant="ghost" size="sm" isLoading={deletingName === t.name} onClick={() => handleDelete(t.name)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className={styles.toolbar}>
        <div className={styles.toolbarHint}>Templates are cached locally. Sync to pull the latest approval status from Meta.</div>
        <Button variant="secondary" onClick={handleSync} isLoading={isSyncing}>
          Sync with Meta
        </Button>
      </div>

      {tokenExpired && (
        <Card className={styles.tokenExpiredCard}>
          <div className={styles.tokenExpiredTitle}>Your WhatsApp connection has expired</div>
          <div className={styles.tokenExpiredBody}>
            Meta requires reconnecting periodically. This isn&apos;t something that fixes itself on retry.
          </div>
          <Link href="/channels/whatsapp">
            <Button variant="secondary">Reconnect WhatsApp</Button>
          </Link>
        </Card>
      )}

      {isLoading ? (
        <Skeleton height={240} />
      ) : !templates || templates.length === 0 ? (
        page > 0 ? (
          <EmptyState title="No more templates" description="You've reached the end of the list." action={<Button variant="secondary" onClick={() => setPage((p) => Math.max(0, p - 1))}>← Back</Button>} />
        ) : (
          <EmptyState
            title="No templates yet"
            description="Create your first WhatsApp template to start sending marketing and utility messages outside the 24-hour session window."
          />
        )
      ) : (
        <>
          <Table columns={columns} rows={templates} rowKey={(t) => `${t.name}:${t.language}`} />
          {(page > 0 || mightHaveMore) && (
            <div className={styles.pagination}>
              <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                ← Newer
              </Button>
              <span className={styles.pageLabel}>Page {page + 1}</span>
              <Button variant="secondary" size="sm" disabled={!mightHaveMore} onClick={() => setPage((p) => p + 1)}>
                Older →
              </Button>
            </div>
          )}
        </>
      )}

      {previewTemplate && (
        <Modal isOpen onClose={() => setPreviewTemplate(null)} title={previewTemplate.name}>
          <TemplatePreview components={previewTemplate.components} />
        </Modal>
      )}
    </div>
  );
}
