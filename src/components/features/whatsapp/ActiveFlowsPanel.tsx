"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Card, EmptyState, Skeleton, Table, type TableColumn } from "@/components/ui";
import { whatsappStudioApi, type StudioFlow } from "@/lib/api/whatsapp-studio";
import { ApiError } from "@/lib/api/client";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/context/ToastContext";
import styles from "./ActiveFlowsPanel.module.scss";

type FlowSummary = Omit<StudioFlow, "graph">;

function triggerLabel(flow: FlowSummary): string {
  if (flow.trigger_type === "first_message") return "First message";
  if (flow.trigger_type === "keyword") {
    const keywords = flow.trigger_config.keywords;
    return Array.isArray(keywords) && keywords.length ? `Keyword: ${keywords.join(", ")}` : "Keyword";
  }
  return "AI intent";
}

export function ActiveFlowsPanel({ businessId }: { businessId: string }) {
  const { show } = useToast();
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const { data, isLoading, refresh } = useAsync(() => whatsappStudioApi.flows(businessId), [businessId]);
  const flows = data?.flows ?? [];
  const published = flows.filter((flow) => flow.published_version);

  async function deactivate(flow: FlowSummary) {
    const activeSessions = flow.active_sessions ?? 0;
    const warning = activeSessions > 0
      ? ` ${activeSessions} contact(s) are currently mid-conversation with it. Deactivating will end their flow session and return them to normal AI chat.`
      : "";
    if (!confirm(`Deactivate "${flow.name}"? New messages will stop entering this flow.${warning}`)) return;
    setDeactivatingId(flow.id);
    try {
      const result = await whatsappStudioApi.unpublishFlow(businessId, flow.id);
      show(
        result.cleared_sessions
          ? `Deactivated. ${result.cleared_sessions} contact(s) returned to normal AI chat.`
          : "Flow deactivated.",
        "success",
      );
      refresh();
    } catch (error) {
      show(error instanceof ApiError ? error.userMessage : "Could not deactivate this flow.", "error");
    } finally {
      setDeactivatingId(null);
    }
  }

  const columns: TableColumn<FlowSummary>[] = [
    { key: "name", header: "Flow", render: (flow) => <div className={styles.flowName}>{flow.name}</div> },
    { key: "trigger", header: "Starts when", render: (flow) => triggerLabel(flow) },
    { key: "version", header: "Live version", render: (flow) => <Badge variant="success">v{flow.published_version}</Badge> },
    {
      key: "active_sessions",
      header: "In progress",
      render: (flow) => (flow.active_sessions ? <Badge variant="warning">{flow.active_sessions} active</Badge> : <span className={styles.muted}>None</span>),
    },
    {
      key: "actions",
      header: "",
      render: (flow) => (
        <Button
          variant="danger"
          size="sm"
          onClick={() => void deactivate(flow)}
          isLoading={deactivatingId === flow.id}
          disabled={deactivatingId !== null && deactivatingId !== flow.id}
        >
          Deactivate
        </Button>
      ),
    },
  ];

  return (
    <Card>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Active flows</h3>
          <p className={styles.subtitle}>Automations currently live on this WhatsApp number. Deactivate one to stop it from handling new (or stuck) conversations.</p>
        </div>
        <Link href="/channels/whatsapp-studio/builder" className={styles.manageLink}>Manage flows</Link>
      </div>
      {isLoading ? (
        <Skeleton height={140} />
      ) : published.length === 0 ? (
        <EmptyState
          title="No flows are live"
          description="Publish a flow in WhatsApp Studio to route customer conversations automatically."
        />
      ) : (
        <Table columns={columns} rows={published} rowKey={(flow) => flow.id} />
      )}
    </Card>
  );
}
