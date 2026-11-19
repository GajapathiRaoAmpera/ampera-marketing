"use client";

import { Suspense } from "react";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import { EmptyState, Skeleton } from "@/components/ui";
import { WhatsAppWorkspace } from "@/components/features/whatsapp/workspace/WhatsAppWorkspace";

interface WhatsAppChannelPageClientProps {
  whatsappConfigId: string | undefined;
}

/** Everything WhatsApp, as tabs (?tab=...): campaigns, templates, flows, forms, shop and settings. */
export default function WhatsAppChannelPageClient({ whatsappConfigId }: WhatsAppChannelPageClientProps) {
  const { business, businessId, isLoading, hasNoBusinesses } = useActiveBusiness();

  if (isLoading) return <Skeleton height={420} />;
  if (hasNoBusinesses || !businessId) {
    return <EmptyState title="Create a business first" description="You'll need a business set up before you can connect WhatsApp." />;
  }
  return (
    <Suspense fallback={<Skeleton height={420} />}>
      <WhatsAppWorkspace key={businessId} businessId={businessId} agentId={business?.agent_id ?? undefined} whatsappConfigId={whatsappConfigId} />
    </Suspense>
  );
}
