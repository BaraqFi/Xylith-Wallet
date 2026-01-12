/**
 * Generic caching utility for localStorage
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes default

/**
 * Get cached data if it exists and is not expired
 */
export function getCachedData<T>(
  key: string,
  ttl: number = DEFAULT_TTL
): T | null {
  if (typeof window === "undefined") return null;

  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const entry: CacheEntry<T> = JSON.parse(cached);
    const age = Date.now() - entry.timestamp;

    if (age > ttl) {
      // Cache expired, remove it
      localStorage.removeItem(key);
      return null;
    }

    return entry.data;
  } catch (error) {
    console.warn(`Error reading cache for key ${key}:`, error);
    return null;
  }
}

/**
 * Set cached data with timestamp
 */
export function setCachedData<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;

  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch (error) {
    console.warn(`Error setting cache for key ${key}:`, error);
    // If storage is full, try to clear old entries
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      clearExpiredCache();
    }
  }
}

/**
 * Clear expired cache entries (simple cleanup)
 */
function clearExpiredCache(): void {
  if (typeof window === "undefined") return;

  try {
    const keys = Object.keys(localStorage);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const key of keys) {
      if (key.startsWith("xylith_cache_")) {
        try {
          const entry = JSON.parse(localStorage.getItem(key) || "{}");
          if (entry.timestamp && now - entry.timestamp > maxAge) {
            localStorage.removeItem(key);
          }
        } catch {
          // Invalid entry, remove it
          localStorage.removeItem(key);
        }
      }
    }
  } catch (error) {
    console.warn("Error clearing expired cache:", error);
  }
}

/**
 * Clear specific cache entry
 */
export function clearCache(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`Error clearing cache for key ${key}:`, error);
  }
}

