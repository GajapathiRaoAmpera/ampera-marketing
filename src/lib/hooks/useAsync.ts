import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";

interface UseAsyncState<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
}

/**
 * Runs `fn` whenever any value in `deps` changes, guarding against setting
 * state after the effect's dependencies have already moved on (stale
 * response arriving after a newer request started).
 *
 * `isLoading` is only ever true before the FIRST successful response for the
 * current deps (i.e. "we have nothing to show yet, render a skeleton").
 * Every subsequent call - a background poll, a manual refresh() - flips
 * `isRefreshing` instead, leaving the last-known `data` on screen. Without
 * this split, a component naively rendering `isLoading ? <Skeleton /> :
 * <Data />` wipes real content back to a skeleton on every poll tick, which
 * reads as the UI "going blank" even though nothing actually failed.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[]
): UseAsyncState<T> & { refresh: () => void } {
  const [state, setState] = useState<UseAsyncState<T>>({
    data: null,
    error: null,
    isLoading: true,
    isRefreshing: false,
  });
  const requestId = useRef(0);
  const hasDataRef = useRef(false);

  const run = useCallback(() => {
    const id = ++requestId.current;
    setState((prev) => ({
      ...prev,
      isLoading: !hasDataRef.current,
      isRefreshing: hasDataRef.current,
      error: null,
    }));
    fn()
      .then((data) => {
        if (id !== requestId.current) return;
        hasDataRef.current = true;
        setState({ data, error: null, isLoading: false, isRefreshing: false });
      })
      .catch((err) => {
        if (id !== requestId.current) return;
        const message = err instanceof ApiError ? err.userMessage : "Something went wrong. Please try again.";
        // A failed background refresh keeps whatever data is already on
        // screen (stale-but-visible beats blank), only a failed FIRST load
        // has no data to fall back to.
        setState((prev) => ({ data: prev.data, error: message, isLoading: false, isRefreshing: false }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    hasDataRef.current = false;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, refresh: run };
}
