"use client";

import { Suspense } from "react";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import { EmptyState, Skeleton } from "@/components/ui";
import { InstagramWorkspace } from "@/components/features/instagram/workspace/InstagramWorkspace";

/**
 * Everything Instagram lives here: connect, automations, posts, activity,
 * publishing, insights and settings, as tabs (?tab=...).
 */
export default function InstagramChannelPage() {
  const { business, businessId, isLoading, hasNoBusinesses } = useActiveBusiness();

  if (isLoading) return <Skeleton height={420} />;
  if (hasNoBusinesses || !businessId) {
    return <EmptyState title="Create a business first" description="You'll need a business set up before you can connect Instagram." />;
  }
  return (
    <Suspense fallback={<Skeleton height={420} />}>
      <InstagramWorkspace key={businessId} businessId={businessId} agentId={business?.agent_id ?? undefined} />
    </Suspense>
  );
}
