"use client";

import type { ReactNode } from "react";
import { EmptyState, Skeleton } from "@/components/ui";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";

/** Waits for the active business, and asks for one to be created first when there is none. */
export function ChannelGate({ channel, children }: { channel: string; children: (businessId: string, agentId: string | undefined) => ReactNode }) {
  const { business, businessId, isLoading, hasNoBusinesses } = useActiveBusiness();
  if (isLoading) return <Skeleton height={420} />;
  if (hasNoBusinesses || !businessId) {
    return <EmptyState title="Create a business first" description={`You'll need a business set up before you can connect ${channel}.`} />;
  }
  return <>{children(businessId, (business?.agent_id as string | undefined) ?? undefined)}</>;
}
