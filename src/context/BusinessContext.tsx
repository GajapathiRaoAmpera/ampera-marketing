"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { businessesApi } from "@/lib/api";
import { setActiveBusinessHeader } from "@/lib/api/active-business";
import { roleAtLeast } from "@/lib/permissions";
import type { Business, BusinessRole } from "@/types/api";

const ACTIVE_BUSINESS_KEY = "leadconvo:active-business-id";

interface BusinessContextValue {
  businesses: Business[];
  activeBusiness: Business | null;
  /** The user's role in the active business: "owner" if they own it, else the role they were given. */
  role: BusinessRole | null;
  /** True if the user's role in the active business is at least `min`. */
  can: (min: BusinessRole) => boolean;
  setActiveBusinessId: (id: string) => void;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const BusinessContext = createContext<BusinessContextValue | null>(null);

export function BusinessProvider({ children }: { children: ReactNode }) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBusinessId, setActiveBusinessIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // False until the first load settles: pages must not fire their first
  // requests before the active business is known, or those requests go out
  // without X-Business-Id and a team member would see their own empty data.
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await businessesApi.list();
      setBusinesses(list);
      const stored = typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_BUSINESS_KEY) : null;
      const stillValid = stored && list.some((b) => b.id === stored);
      const nextId = stillValid ? stored : list[0]?.id ?? null;
      setActiveBusinessHeader(nextId);
      setActiveBusinessIdState(nextId);
    } catch {
      setError("Couldn't load your businesses. Please refresh the page.");
    } finally {
      setIsLoading(false);
      setReady(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setActiveBusinessId = useCallback((id: string) => {
    setActiveBusinessHeader(id);
    setActiveBusinessIdState(id);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ACTIVE_BUSINESS_KEY, id);
    }
  }, []);

  const activeBusiness = useMemo(
    () => businesses.find((b) => b.id === activeBusinessId) ?? null,
    [businesses, activeBusinessId]
  );

  const role: BusinessRole | null = activeBusiness
    ? activeBusiness.is_owner === false
      ? activeBusiness.team_role ?? "viewer"
      : "owner"
    : null;

  const value = useMemo(
    () => ({
      businesses,
      activeBusiness,
      role,
      can: (min: BusinessRole) => roleAtLeast(role, min),
      setActiveBusinessId,
      isLoading,
      error,
      refresh: load,
    }),
    [businesses, activeBusiness, role, setActiveBusinessId, isLoading, error, load]
  );

  return (
    <BusinessContext.Provider value={value}>
      {ready ? (
        children
      ) : (
        <div role="status" aria-live="polite" style={{ display: "grid", placeItems: "center", minHeight: "60vh", color: "var(--color-text-secondary)" }}>
          Loading your workspace…
        </div>
      )}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error("useBusiness must be used within BusinessProvider");
  return ctx;
}
