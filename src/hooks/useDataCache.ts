import { useState, useEffect, useCallback, useRef } from 'react';
import { cacheStore } from '../lib/cacheStore';

export interface UseDataCacheOptions<T> {
  ttlMs?: number;
  initialData?: T;
  revalidateOnMount?: boolean;
  enabled?: boolean;
}

export function useDataCache<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  options: UseDataCacheOptions<T> = {}
) {
  const {
    ttlMs = 5 * 60 * 1000,
    initialData,
    revalidateOnMount = true,
    enabled = true
  } = options;

  const [cachedSnapshot] = useState(() => cacheStore.get<T>(cacheKey));
  const [data, setData] = useState<T | null>(() => cachedSnapshot.data ?? initialData ?? null);
  const [isLoading, setIsLoading] = useState<boolean>(() => !cachedSnapshot.exists && enabled);
  const [isRevalidating, setIsRevalidating] = useState<boolean>(() => cachedSnapshot.exists && cachedSnapshot.isStale);
  const [error, setError] = useState<Error | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Background revalidation
  const revalidate = useCallback(async (showLoading = false) => {
    if (!enabled) return;
    if (showLoading) setIsLoading(true);
    setIsRevalidating(true);
    setError(null);

    try {
      const freshData = await fetcherRef.current();
      cacheStore.set(cacheKey, freshData, ttlMs);
      setData(freshData);
    } catch (err: any) {
      console.warn(`[useDataCache Revalidation Error] ${cacheKey}:`, err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
      setIsRevalidating(false);
    }
  }, [cacheKey, ttlMs, enabled]);

  // Subscribe to external/optimistic cache changes
  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = cacheStore.subscribe<T>(cacheKey, (newData) => {
      if (newData !== null) {
        setData(newData);
        setIsLoading(false);
      }
    });
    return unsubscribe;
  }, [cacheKey, enabled]);

  // Initial mount trigger
  useEffect(() => {
    if (!enabled) return;
    const current = cacheStore.get<T>(cacheKey);
    if (!current.exists) {
      revalidate(true);
    } else if (revalidateOnMount && current.isStale) {
      revalidate(false);
    }
  }, [cacheKey, revalidate, revalidateOnMount, enabled]);

  // Optimistic mutation helper
  const optimisticMutate = useCallback(
    async <R>(
      optimisticValue: T,
      remoteAction: () => Promise<R>,
      errorMessage = 'Error al sincronizar los cambios. Se ha restaurado la vista.'
    ): Promise<R | null> => {
      return cacheStore.optimisticMutate<T, R>({
        key: cacheKey,
        optimisticData: optimisticValue,
        mutationFn: remoteAction,
        onError: (_err) => {
          // Toast or message
          if (typeof window !== 'undefined') {
            const toastEvent = new CustomEvent('app_toast', {
              detail: { message: errorMessage, type: 'error' }
            });
            window.dispatchEvent(toastEvent);
          }
        }
      });
    },
    [cacheKey]
  );

  return {
    data,
    isLoading,
    isRevalidating,
    error,
    refresh: () => revalidate(false),
    mutate: optimisticMutate
  };
}
