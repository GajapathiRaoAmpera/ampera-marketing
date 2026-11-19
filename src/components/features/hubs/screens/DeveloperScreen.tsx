"use client";

import { useState } from "react";
import { EmptyState, Skeleton, Tabs } from "@/components/ui";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import { ApiKeysTab } from "@/app/(dashboard)/automation/webhooks/_tabs/ApiKeysTab";
import { TriggerRulesTab } from "@/app/(dashboard)/automation/webhooks/_tabs/TriggerRulesTab";
import { WebhooksTab } from "@/app/(dashboard)/automation/webhooks/_tabs/WebhooksTab";
import styles from "@/app/(dashboard)/automation/webhooks/page.module.scss";
import { useEmbedded } from "@/components/layout/Embedded";

type TabKey = "webhooks" | "api-keys" | "triggers";

const TAB_OPTIONS = [
  { value: "webhooks" as const, label: "Webhooks" },
  { value: "api-keys" as const, label: "API Keys" },
  { value: "triggers" as const, label: "Cross-App Triggers" },
];

// Looking to connect WhatsApp, Instagram, Shopify, etc.? That now lives on
// its own page (/connected-apps). This page is developer-only tooling:
// raw signed webhooks, public API keys for Zapier/Make/n8n, and cross-app
// automation rules. Keeping those separate from "connect my store" is the
// whole point of the split (see Sidebar.tsx).
export default function DeveloperToolsPage() {
  const embedded = useEmbedded();
  const { businessId, isLoading, hasNoBusinesses } = useActiveBusiness();
  const [tab, setTab] = useState<TabKey>("webhooks");

  if (isLoading) return <Skeleton height={420} />;
  if (hasNoBusinesses || !businessId) {
    return (
      <EmptyState
        title="Create a business first"
        description="Webhooks, API keys, and cross-app triggers belong to one business and never receive another tenant's events."
      />
    );
  }

  return (
    <div className={styles.page}>
      {!embedded && (
        <header>
          <span className={styles.eyebrow}>For developers</span>
          <h1>Developer Tools</h1>
          <p>
            Advanced, technical tools for this business: signed webhooks for your own systems, a
            public API for Zapier/Make/n8n, and automation rules between your connected channels.
            Just want to connect WhatsApp, Instagram, or a store? Head to{" "}
            <a href="/connected-apps">Connected Apps</a> instead.
          </p>
        </header>
      )}

      <Tabs options={TAB_OPTIONS} value={tab} onChange={setTab} variant="underline" />

      <div className={styles.tabPanel}>
        {tab === "webhooks" && <WebhooksTab businessId={businessId} />}
        {tab === "api-keys" && <ApiKeysTab businessId={businessId} />}
        {tab === "triggers" && <TriggerRulesTab businessId={businessId} />}
      </div>
    </div>
  );
}
