/**
 * Zero-dependency in-memory Stale-While-Revalidate (SWR) cache + in-flight request deduplicator.
 * Eliminates tab-switching lag and loading spinners across HESTA frontend.
 */

interface CacheEntry<T> {
  data: T;
  updatedAt: number;
}

const cacheStore = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

/**
 * Returns the cached value synchronously (even if slightly stale),
 * allowing UI components to render immediately in 0ms without a loading spinner.
 */
export function peekCache<T>(key: string): T | undefined {
  const entry = cacheStore.get(key);
  return entry ? (entry.data as T) : undefined;
}

/**
 * Returns true if entry exists and Date.now() - entry.updatedAt < ttlMs.
 */
export function isCacheFresh(key: string, ttlMs: number): boolean {
  const entry = cacheStore.get(key);
  if (!entry) return false;
  return Date.now() - entry.updatedAt < ttlMs;
}

/**
 * Sets or updates a cache value directly with updatedAt = Date.now().
 */
export function setCacheValue<T>(key: string, data: T): void {
  cacheStore.set(key, {
    data,
    updatedAt: Date.now(),
  });
}

/**
 * Deletes any cache key starting with prefixOrKey from both cache and in-flight map.
 */
export function invalidateCache(prefixOrKey: string): void {
  for (const key of Array.from(cacheStore.keys())) {
    if (key.startsWith(prefixOrKey)) {
      cacheStore.delete(key);
    }
  }
  for (const key of Array.from(inFlightRequests.keys())) {
    if (key.startsWith(prefixOrKey)) {
      inFlightRequests.delete(key);
    }
  }
}

/**
 * Cached fetch with SWR and deduplication:
 * - If !options?.forceRefresh && isCacheFresh(key, ttlMs), return Promise.resolve(entry.data).
 * - If there is already an in-flight Promise for key, return that same Promise (deduplication).
 * - Otherwise call fetcher(), store result in cache with updatedAt: Date.now(), clear in-flight entry, and return result.
 */
export function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: { ttlMs?: number; forceRefresh?: boolean }
): Promise<T> {
  const ttlMs = options?.ttlMs ?? 30_000;
  const forceRefresh = options?.forceRefresh ?? false;

  if (!forceRefresh && isCacheFresh(key, ttlMs)) {
    const entry = cacheStore.get(key);
    if (entry) {
      return Promise.resolve(entry.data as T);
    }
  }

  // Deduplicate in-flight requests
  const existingPromise = inFlightRequests.get(key);
  if (existingPromise) {
    return existingPromise as Promise<T>;
  }

  const promise = fetcher()
    .then((result) => {
      setCacheValue(key, result);
      inFlightRequests.delete(key);
      return result;
    })
    .catch((err) => {
      inFlightRequests.delete(key);
      throw err;
    });

  inFlightRequests.set(key, promise);
  return promise;
}

/**
 * Clears the entire cache (useful for testing or logout).
 */
export function clearAllCache(): void {
  cacheStore.clear();
  inFlightRequests.clear();
}
