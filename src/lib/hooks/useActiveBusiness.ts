import { useBusiness } from "@/context/BusinessContext";

/** Thin convenience wrapper, most feature screens only need the id + loading state. */
export function useActiveBusiness() {
  const { activeBusiness, isLoading, businesses } = useBusiness();
  return {
    business: activeBusiness,
    businessId: activeBusiness?.id ?? null,
    isLoading,
    hasNoBusinesses: !isLoading && businesses.length === 0,
  };
}
