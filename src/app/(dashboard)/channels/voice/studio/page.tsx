"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Skeleton } from "@/components/ui";
import { PhoneIcon } from "@/components/layout/icons";
import { useToast } from "@/context/ToastContext";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import { voiceFlowsApi, type CallFlow } from "@/lib/api/voice-flows";
import styles from "./page.module.scss";

const recipes = [
  { name: "Sales qualification & booking", detail: "Qualify the caller, pitch, handle price objections, then book a meeting." },
  { name: "Inspirational outbound pitch", detail: "An energetic, persuasive opener with built-in objection handling." },
  { name: "Support triage", detail: "Collect the issue, then resolve or transfer to a human." },
];

export default function VoiceStudioPage() {
  const { businessId, isLoading, hasNoBusinesses } = useActiveBusiness();
  const { show } = useToast();
  const [flows, setFlows] = useState<Omit<CallFlow, "graph" | "extraction_schema">[]>([]);
  const [loadingFlows, setLoadingFlows] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    setLoadingFlows(true);
    voiceFlowsApi
      .flows(businessId)
      .then((result) => setFlows(result.flows))
      .catch(() => show("Couldn't load call flows.", "error"))
      .finally(() => setLoadingFlows(false));
  }, [businessId, show]);

  async function deleteFlow(flow: Omit<CallFlow, "graph" | "extraction_schema">) {
    if (!businessId || !confirm(`Delete "${flow.name}"? This cannot be undone.`)) return;
    try {
      await voiceFlowsApi.deleteFlow(businessId, flow.id);
      setFlows((current) => current.filter((item) => item.id !== flow.id));
      show("Call flow deleted.", "success");
    } catch {
      show("Couldn't delete this call flow.", "error");
    }
  }

  if (isLoading) return <Skeleton height={320} />;
  if (hasNoBusinesses || !businessId) {
    return <EmptyState title="Create a business first" description="You'll need a business set up before you can build call flows." />;
  }

  return (
    <div>
      <div className={styles.header}>
        <div className={styles.iconBadge}>
          <PhoneIcon size={24} />
        </div>
        <div>
          <div className={styles.title}>Voice Call Flows</div>
          <div className={styles.subtitle}>
            Design what your AI agent says and does on a phone call: greetings, qualifying questions,
            persuasive pitches, objection handling, and appointment booking.
          </div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.sectionTitle}>Your call flows</div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <Link href="/channels/voice/studio/setup">
            <Button variant="secondary">Tools, catalog & appointments</Button>
          </Link>
          <Link href="/channels/voice/studio/builder">
            <Button>+ New call flow</Button>
          </Link>
        </div>
      </div>

      {loadingFlows ? (
        <Skeleton height={200} />
      ) : flows.length === 0 ? (
        <EmptyState title="No call flows yet" description="Start from a recipe below, or build one from scratch." />
      ) : (
        <div className={styles.flowGrid}>
          {flows.map((flow) => (
            <Link key={flow.id} href={`/channels/voice/studio/builder?flow=${flow.id}`}>
              <Card className={styles.flowCard}>
                <div className={styles.flowCardTop}>
                  <span className={styles.flowName}>{flow.name}</span>
                  <Badge variant={flow.active ? "success" : flow.status === "published" ? "info" : "neutral"}>
                    {flow.active ? "Active" : flow.status === "published" ? "Published" : "Draft"}
                  </Badge>
                </div>
                {flow.description ? <p className={styles.flowDescription}>{flow.description}</p> : null}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(event) => {
                    event.preventDefault();
                    void deleteFlow(flow);
                  }}
                >
                  Delete
                </Button>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className={styles.sectionTitle}>Quick-start recipes</div>
      <div className={styles.recipeGrid}>
        {recipes.map((recipe) => (
          <Link key={recipe.name} href={`/channels/voice/studio/builder?recipe=${encodeURIComponent(recipe.name)}`} className={styles.recipeCard}>
            <strong>{recipe.name}</strong>
            <span>{recipe.detail}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
