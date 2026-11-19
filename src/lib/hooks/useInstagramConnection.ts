import { instagramApi } from "@/lib/api";
import { useAsync } from "./useAsync";

/**
 * Single shared source of truth for the Instagram connection status.
 * Used by both the "not connected" and "connected" views on the Instagram
 * channel page so they never disagree, and so a disconnect/connect in one
 * tab is reflected after a refresh instead of leaving stale state behind.
 */
export function useInstagramConnection(businessId?: string) {
  const { data: status, isLoading, error, refresh } = useAsync(
    () => instagramApi.status(businessId),
    [businessId]
  );

  return { status, isLoading, error, refresh };
}
