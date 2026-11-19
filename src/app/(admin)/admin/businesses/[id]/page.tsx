"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { adminApi, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/context/ToastContext";
import { Button, EmptyState, Modal, Skeleton, Textarea } from "@/components/ui";
import { PageHeader, Panel, Pill, formatDate } from "@/components/features/admin/AdminUi";
import styles from "./page.module.scss";

export default function AdminBusinessPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { show } = useToast();
  const business = useAsync(() => adminApi.getBusiness(params.id), [params.id]);
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const data = business.data;

  async function suspend() {
    if (!reason.trim()) {
      show("A reason is required.", "error");
      return;
    }
    setBusy(true);
    try {
      await adminApi.suspendBusiness(params.id, reason.trim());
      show("Business suspended.", "success");
      setIsOpen(false);
      setReason("");
      business.refresh();
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't suspend this business.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (business.isLoading) return <Skeleton height={320} />;
  if (!data) {
    return (
      <EmptyState
        title="Business not found"
        action={<Button onClick={() => router.push("/admin/users")}>Back to accounts</Button>}
      />
    );
  }

  const running = data.agent_status === "running";

  return (
    <>
      <PageHeader
        onBack={() => router.back()}
        title={data.name}
        description="A business and its AI agent."
        actions={
          <Button variant="outline-danger" disabled={!running} onClick={() => setIsOpen(true)}>
            Suspend business
          </Button>
        }
      />

      <Panel title="Details">
        <dl className={styles.grid}>
          <div>
            <dt>Owner</dt>
            <dd>
              {data.user_id ? (
                <Link href={`/admin/users/${data.user_id}`} className={styles.link}>
                  {data.owner_name || data.owner_email}
                </Link>
              ) : (
                "-"
              )}
              {data.owner_name && <div className={styles.sub}>{data.owner_email}</div>}
            </dd>
          </div>
          <div>
            <dt>Owner account</dt>
            <dd>{data.owner_disabled ? <Pill tone="pending">Paused</Pill> : <Pill tone="active">Active</Pill>}</dd>
          </div>
          <div>
            <dt>AI agent</dt>
            <dd>{data.agent_status ? <Pill tone={running ? "active" : "pending"}>{data.agent_status}</Pill> : "-"}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{formatDate(data.created_at)}</dd>
          </div>
          <div>
            <dt>Agent ID</dt>
            <dd className={styles.mono}>{data.agent_id ?? "-"}</dd>
          </div>
        </dl>
      </Panel>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Suspend this business?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={suspend} isLoading={busy}>
              Suspend
            </Button>
          </>
        }
      >
        <p className={styles.copy}>
          This pauses the AI agent for <strong>{data.name}</strong> platform-wide, whatever the owner has set. It is
          logged, and only the owner can turn the agent back on.
        </p>
        <Textarea
          label="Reason (required)"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. Terms of service violation reported by a customer"
          rows={3}
        />
      </Modal>
    </>
  );
}
