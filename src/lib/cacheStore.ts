/**
 * Stale-While-Revalidate In-Memory & Session Storage Cache Layer
 * Eliminates full-screen blocking spinners by serving instant cached snapshots
 * while refreshing in the background. Supports optimistic mutations with rollback.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // in milliseconds
}

class ReactiveCacheStore {
  private memoryCache = new Map<string, CacheEntry<unknown>>();
  private listeners = new Map<string, Set<(data: unknown) => void>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default TTL

  constructor() {
    // Try to restore cache items from sessionStorage if available
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const raw = sessionStorage.getItem('__techneo_app_cache__');
        if (raw) {
          const parsed = JSON.parse(raw);
          const now = Date.now();
          for (const [key, entry] of Object.entries(parsed as Record<string, CacheEntry<unknown>>)) {
            if (now - entry.timestamp < entry.ttl * 2) {
              this.memoryCache.set(key, entry);
            }
          }
        }
      } catch {
        // Safe fallback if sessionStorage is unavailable or full
      }
    }
  }

  private persist() {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
      const serializable: Record<string, CacheEntry<unknown>> = {};
      let count = 0;
      for (const [key, entry] of this.memoryCache.entries()) {
        if (count > 50) break; // Limit entries in sessionStorage
        serializable[key] = entry;
        count++;
      }
      sessionStorage.setItem('__techneo_app_cache__', JSON.stringify(serializable));
    } catch {
      // Storage quota exceeded or disabled
    }
  }

  get<T>(key: string): { data: T | null; isStale: boolean; exists: boolean } {
    const entry = this.memoryCache.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      return { data: null, isStale: true, exists: false };
    }
    const isStale = Date.now() - entry.timestamp > entry.ttl;
    return { data: entry.data, isStale, exists: true };
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlMs ?? this.defaultTTL
    };
    this.memoryCache.set(key, entry);
    this.persist();

    // Notify all active listeners for this key
    const subscribers = this.listeners.get(key);
    if (subscribers) {
      subscribers.forEach(cb => cb(data));
    }
  }

  invalidate(keyOrPrefix: string): void {
    for (const key of this.memoryCache.keys()) {
      if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
        this.memoryCache.delete(key);
        const subscribers = this.listeners.get(key);
        if (subscribers) {
          subscribers.forEach(cb => cb(null));
        }
      }
    }
    this.persist();
  }

  subscribe<T>(key: string, callback: (data: T | null) => void): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    const set = this.listeners.get(key)!;
    const typedCb = callback as (data: unknown) => void;
    set.add(typedCb);

    return () => {
      set.delete(typedCb);
      if (set.size === 0) {
        this.listeners.delete(key);
      }
    };
  }

  /**
   * Optimistic mutation runner:
   * 1. Updates cache immediately with optimistic snapshot
   * 2. Runs async mutation function in background
   * 3. Confirms or rolls back gracefully with notification
   */
  async optimisticMutate<T, R>({
    key,
    optimisticData,
    mutationFn,
    onSuccess,
    onError
  }: {
    key: string;
    optimisticData: T;
    mutationFn: () => Promise<R>;
    onSuccess?: (result: R) => void;
    onError?: (error: unknown, rollbackData: T | null) => void;
  }): Promise<R | null> {
    const previous = this.get<T>(key).data;
    // Apply optimistic update immediately
    this.set(key, optimisticData);

    try {
      const result = await mutationFn();
      if (onSuccess) onSuccess(result);
      return result;
    } catch (err) {
      // Rollback to previous state
      if (previous !== null) {
        this.set(key, previous);
      } else {
        this.invalidate(key);
      }
      if (onError) {
        onError(err, previous);
      } else {
        console.error(`[Optimistic Mutation Failed] Key: ${key}`, err);
      }
      return null;
    }
  }
}

export const cacheStore = new ReactiveCacheStore();
