"use client";

import { useRef, useState } from "react";
import { Badge, Button, EmptyState, Input, Skeleton, Table, type TableColumn } from "@/components/ui";
import { contactListsApi, ApiError, type ContactList } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/utils/date";
import styles from "./ContactListManager.module.scss";

export function ContactListManager({ onListsChanged }: { onListsChanged?: () => void }) {
  const { show } = useToast();
  const { user } = useAuth();
  const { data: lists, isLoading, refresh } = useAsync(() => contactListsApi.listAll(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadName, setUploadName] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    if (!uploadName) setUploadName(file.name.replace(/\.csv$/i, ""));
  }

  async function handleUpload() {
    if (!pendingFile || !uploadName.trim()) {
      show("Give this list a name and choose a CSV file first.", "error");
      return;
    }
    setIsUploading(true);
    try {
      const res = await contactListsApi.uploadCsv(uploadName.trim(), pendingFile);
      const columnsNote = res.contact_list.variable_columns.length
        ? ` Detected variable columns: ${res.contact_list.variable_columns.join(", ")}.`
        : "";
      if (res.skipped_rows) {
        show(`Uploaded "${uploadName}": ${res.contact_list.member_count} numbers added, ${res.skipped_rows} row(s) skipped (couldn't parse as a phone number).${columnsNote}`, "default");
      } else {
        show(`Uploaded "${uploadName}" with ${res.contact_list.member_count} numbers.${columnsNote}`, "success");
      }
      setPendingFile(null);
      setUploadName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      refresh();
      onListsChanged?.();
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Upload failed. Please check the file and try again.", "error");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete contact list "${name}"? This can't be undone.`)) return;
    setDeletingId(id);
    try {
      await contactListsApi.delete(id);
      show(`Deleted "${name}".`, "success");
      refresh();
      onListsChanged?.();
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't delete this list.", "error");
    } finally {
      setDeletingId(null);
    }
  }

  const columns: TableColumn<ContactList>[] = [
    { key: "name", header: "Name", render: (l) => <span className={styles.nameCell}>{l.name}</span> },
    { key: "count", header: "Numbers", render: (l) => <Badge variant="neutral">{l.member_count}</Badge> },
    {
      key: "variables",
      header: "Variable columns",
      render: (l) => (l.variable_columns.length > 0 ? l.variable_columns.join(", ") : <span className={styles.noneText}>-</span>),
    },
    { key: "created", header: "Created", render: (l) => formatDate(l.created_at, user?.timezone) },
    {
      key: "actions",
      header: "",
      render: (l) => (
        <Button variant="ghost" size="sm" isLoading={deletingId === l.id} onClick={() => handleDelete(l.id, l.name)}>
          Delete
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div className={styles.uploadRow}>
        <div className={styles.nameInput}>
          <Input
            value={uploadName}
            onChange={(e) => setUploadName(e.target.value)}
            placeholder="List name, e.g. Diwali Sale 2026"
          />
        </div>
        <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFilePicked} className={styles.fileInput} />
        <Button onClick={handleUpload} isLoading={isUploading} disabled={!pendingFile}>
          Upload CSV
        </Button>
      </div>
      <p className={styles.helperText}>
        One phone number per row (an optional second column can hold a display name). A header row is fine:
        anything that doesn&apos;t look like a phone number is skipped automatically.
      </p>

      {isLoading ? (
        <Skeleton height={160} />
      ) : !lists || lists.length === 0 ? (
        <EmptyState title="No contact lists yet" description="Upload a CSV of phone numbers to create your first campaign audience." />
      ) : (
        <Table columns={columns} rows={lists} rowKey={(l) => l.id} />
      )}
    </div>
  );
}
