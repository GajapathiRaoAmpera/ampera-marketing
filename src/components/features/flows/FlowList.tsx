"use client";

import { useState } from "react";
import { Badge, Button, EmptyState, Modal, Skeleton, Switch, Table, type TableColumn } from "@/components/ui";
import { templateFlowsApi, ApiError, type TemplateFlow } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/context/ToastContext";
import { FlowPreview } from "./FlowPreview";
import styles from "./FlowList.module.scss";

function triggerLabel(triggerType: TemplateFlow["trigger_type"]): string {
  if (triggerType === "first_message") return "Greeting";
  if (triggerType === "keyword") return "Keyword";
  return "Manual";
}

export function FlowList() {
  const { show } = useToast();
  const [previewFlow, setPreviewFlow] = useState<TemplateFlow | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: flows, isLoading, refresh } = useAsync(() => templateFlowsApi.list(), []);

  async function handleToggleActive(flow: TemplateFlow) {
    setTogglingId(flow.id);
    try {
      if (flow.active) {
        await templateFlowsApi.deactivate(flow.id);
        show(`"${flow.name}" deactivated.`, "success");
      } else {
        await templateFlowsApi.activate(flow.id);
        show(`"${flow.name}" activated.`, "success");
      }
      refresh();
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't update flow.", "error");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(flow: TemplateFlow) {
    if (!confirm(`Delete flow "${flow.name}"? This can't be undone.`)) return;
    setDeletingId(flow.id);
    try {
      await templateFlowsApi.delete(flow.id);
      show(`Flow "${flow.name}" deleted.`, "success");
      refresh();
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't delete flow.", "error");
    } finally {
      setDeletingId(null);
    }
  }

  const columns: TableColumn<TemplateFlow>[] = [
    {
      key: "name",
      header: "Name",
      render: (f) => <span className={styles.nameCell}>{f.name}</span>,
    },
    {
      key: "channel",
      header: "Channel",
      render: (f) => <Badge variant="neutral">{f.channel}</Badge>,
    },
    {
      key: "trigger",
      header: "Trigger",
      render: (f) => <Badge variant={f.trigger_type === "first_message" ? "brand" : "neutral"}>{triggerLabel(f.trigger_type)}</Badge>,
    },
    {
      key: "steps",
      header: "Steps",
      render: (f) => f.steps.length,
    },
    {
      key: "active",
      header: "Active",
      render: (f) => (
        <Switch checked={f.active} disabled={togglingId === f.id} onChange={() => handleToggleActive(f)} />
      ),
    },
    {
      key: "actions",
      header: "",
      render: (f) => (
        <div className={styles.actionsCell}>
          <Button variant="ghost" size="sm" onClick={() => setPreviewFlow(f)}>
            Preview
          </Button>
          <Button variant="ghost" size="sm" isLoading={deletingId === f.id} onClick={() => handleDelete(f)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      {isLoading ? (
        <Skeleton height={240} />
      ) : !flows || flows.length === 0 ? (
        <EmptyState
          title="No flows yet"
          description="Create a greeting or branching flow to reply automatically without the AI chatbot."
        />
      ) : (
        <Table columns={columns} rows={flows} rowKey={(f) => f.id} />
      )}

      {previewFlow && (
        <Modal isOpen onClose={() => setPreviewFlow(null)} title={previewFlow.name}>
          <FlowPreview step={previewFlow.steps.find((s) => s.step_id === previewFlow.entry_step_id) ?? previewFlow.steps[0] ?? null} />
        </Modal>
      )}
    </div>
  );
}
