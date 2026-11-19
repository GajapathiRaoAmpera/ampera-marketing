"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { entitlementsApi, type Entitlements } from "@/lib/api";
import { useBusiness } from "@/context/BusinessContext";

interface EntitlementsContextValue {
  entitlements: Entitlements | null;
  isLoading: boolean;
  refresh: () => void;
  /** Whether a feature is on for this business's plan. Unknown features count as on. */
  isEnabled: (featureKey: string) => boolean;
}

const EntitlementsContext = createContext<EntitlementsContextValue | null>(null);

/**
 * What the business's plan lets it do and how much it has used. Refreshed when
 * the active business changes and whenever the tab comes back into view, so an
 * admin approving the account shows up without a reload.
 */
export function EntitlementsProvider({ children }: { children: ReactNode }) {
  const { activeBusiness } = useBusiness();
  const businessId = activeBusiness?.id ?? null;
  const [loaded, setLoaded] = useState<Entitlements | null>(null);
  const [fetching, setFetching] = useState(true);
  const [tick, setTick] = useState(0);
  // With no business there is nothing to fetch or show.
  const entitlements = businessId ? loaded : null;
  const isLoading = businessId ? fetching : false;

  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    entitlementsApi
      .get(businessId)
      .then((result) => {
        if (!cancelled) setLoaded(result);
      })
      // If this cannot be read, show everything unlocked: the server still
      // enforces every limit, so a failure here must not lock people out.
      .catch(() => {
        if (!cancelled) setLoaded(null);
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId, tick]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") setTick((value) => value + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  const value = useMemo<EntitlementsContextValue>(
    () => ({
      entitlements,
      isLoading,
      refresh,
      isEnabled: (featureKey) => entitlements?.features.find((item) => item.key === featureKey)?.enabled ?? true,
    }),
    [entitlements, isLoading, refresh]
  );

  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
}

export function useEntitlements(): EntitlementsContextValue {
  const ctx = useContext(EntitlementsContext);
  if (!ctx) throw new Error("useEntitlements must be used within EntitlementsProvider");
  return ctx;
}
