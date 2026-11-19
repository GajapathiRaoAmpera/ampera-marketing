"use client";

import { useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ragApi } from "@/lib/api";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/context/ToastContext";
import { Badge, Button, Card, EmptyState, Input, Skeleton } from "@/components/ui";
import { BookIcon } from "@/components/layout/icons";
import type { DocumentStatus } from "@/types/api";
import styles from "@/app/(dashboard)/knowledge-base/page.module.scss";
import { useEmbedded } from "@/components/layout/Embedded";

const STATUS_VARIANT: Record<DocumentStatus, "warning" | "success" | "danger"> = {
  processing: "warning",
  ready: "success",
  failed: "danger",
};

export default function KnowledgeBasePage() {
  const embedded = useEmbedded();
  const { businessId, isLoading: businessLoading, hasNoBusinesses } = useActiveBusiness();
  const { show } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [url, setUrl] = useState("");
  const [urlDescription, setUrlDescription] = useState("");
  const [isIngestingUrl, setIsIngestingUrl] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: documents, isLoading, refresh } = useAsync(
    () => (businessId ? ragApi.list(businessId) : Promise.resolve([])),
    [businessId]
  );

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !businessId) return;
    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        await ragApi.upload(businessId, file);
      }
      show("Document uploaded and processed.", "success");
      refresh();
    } catch {
      show("Couldn't upload that file. Please try again.", "error");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleIngestUrl() {
    if (!businessId || !url) return;
    setIsIngestingUrl(true);
    try {
      await ragApi.ingestUrl(businessId, url, urlDescription || undefined);
      show("URL ingested.", "success");
      setUrl("");
      setUrlDescription("");
      refresh();
    } catch {
      show("Couldn't ingest that URL. Please check it and try again.", "error");
    } finally {
      setIsIngestingUrl(false);
    }
  }

  async function handleDelete(docId: string) {
    setDeletingId(docId);
    try {
      await ragApi.remove(docId);
      show("Document removed.", "default");
      refresh();
    } catch {
      show("Couldn't delete that document. Please try again.", "error");
    } finally {
      setDeletingId(null);
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragActive(false);
    handleFiles(e.dataTransfer.files);
  }

  if (businessLoading) return <Skeleton height={300} />;
  if (hasNoBusinesses || !businessId) {
    return <EmptyState title="Create a business first" description="You'll need a business set up before adding knowledge." />;
  }

  return (
    <div>
      {!embedded && (
        <div className={styles.header}>
          <div>
            <div className={styles.title}>Knowledge Base</div>
            <div className={styles.subtitle}>Upload docs or link pages so your AI agent can answer accurately.</div>
          </div>
        </div>
      )}

      <div className={styles.uploadGrid}>
        <Card padding="none">
          <div
            className={clsx(styles.dropzone, isDragActive && styles.dropzoneActive)}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragActive(true);
            }}
            onDragLeave={() => setIsDragActive(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
          >
            <span className={styles.dropzoneIcon}>
              <BookIcon size={28} />
            </span>
            <span className={styles.dropzoneText}>
              {isUploading ? "Uploading…" : "Drag & drop a file, or click to browse"}
            </span>
            <span className={styles.dropzoneHint}>PDF, DOCX, TXT supported</span>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              onChange={(e) => handleFiles(e.target.files)}
              disabled={isUploading}
            />
          </div>
        </Card>

        <Card>
          <div className={styles.urlForm}>
            <Input
              label="Ingest a URL"
              placeholder="https://yoursite.com/faq"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <Input
              label="Description (optional)"
              placeholder="What's on this page?"
              value={urlDescription}
              onChange={(e) => setUrlDescription(e.target.value)}
            />
            <Button onClick={handleIngestUrl} isLoading={isIngestingUrl} disabled={!url}>
              Ingest URL
            </Button>
          </div>
        </Card>
      </div>

      <Card padding="md">
        {isLoading ? (
          <Skeleton height={200} />
        ) : !documents || documents.length === 0 ? (
          <EmptyState
            icon={<BookIcon size={24} />}
            title="No documents yet"
            description="Upload a file or ingest a URL above to give your agent knowledge to draw from."
          />
        ) : (
          documents.map((doc) => (
            <div key={doc.id} className={styles.docRow}>
              <span className={styles.docIcon}>
                <BookIcon size={18} />
              </span>
              <div className={styles.docInfo}>
                <div className={styles.docName}>{doc.filename ?? doc.url ?? doc.id}</div>
                <div className={styles.docMeta}>{doc.description ?? doc.source_type}</div>
              </div>
              <div className={styles.docActions}>
                <Badge variant={STATUS_VARIANT[doc.status]}>{doc.status}</Badge>
                {doc.website_profile && <Link className={styles.editLink} href="/business-profile">Edit content</Link>}
                <button
                  type="button"
                  className={styles.deleteButton}
                  onClick={() => handleDelete(doc.id)}
                  disabled={deletingId === doc.id}
                  aria-label="Delete document"
                >
                  <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M4 6h12M8 6V4h4v2M6 6l1 11h6l1-11"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
