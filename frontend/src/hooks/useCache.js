import { useCallback, useRef } from 'react'

// In-memory cache store with TTL support
const cacheStore = new Map()

/**
 * Custom hook for caching API responses with TTL
 * @param {string} cacheKey - Unique cache key (e.g., 'sprint-SVI-4')
 * @param {Function} fetchFn - Async function that fetches the data
 * @param {number} ttlMs - Time-to-live in milliseconds (default: 5 minutes = 300000ms)
 * @returns {object} { data, loading, error, refetch, clearCache }
 */
export function useCache(cacheKey, fetchFn, ttlMs = 300000) {
  const cacheStateRef = useRef({
    data: null,
    timestamp: null,
    loading: false,
    error: null,
  })

  // Check if cache is still valid
  const isCacheValid = useCallback(() => {
    if (!cacheStore.has(cacheKey)) return false
    const cached = cacheStore.get(cacheKey)
    const age = Date.now() - cached.timestamp
    return age < ttlMs
  }, [cacheKey, ttlMs])

  // Get cached data if available and valid
  const getCachedData = useCallback(() => {
    if (isCacheValid()) {
      const cached = cacheStore.get(cacheKey)
      return cached.data
    }
    return null
  }, [cacheKey, isCacheValid])

  // Fetch data and update cache
  const fetchData = useCallback(async () => {
    cacheStateRef.current.loading = true
    cacheStateRef.current.error = null

    try {
      const result = await fetchFn()
      const cached = {
        data: result,
        timestamp: Date.now(),
      }
      cacheStore.set(cacheKey, cached)
      cacheStateRef.current.data = result
      return result
    } catch (err) {
      cacheStateRef.current.error = err
      throw err
    } finally {
      cacheStateRef.current.loading = false
    }
  }, [cacheKey, fetchFn])

  // Public refetch function - ignores cache and always fetches fresh
  const refetch = useCallback(async () => {
    clearCache()
    return fetchData()
  }, [fetchData])

  // Clear cache for this key
  const clearCache = useCallback(() => {
    cacheStore.delete(cacheKey)
  }, [cacheKey])

  // Get or fetch data
  const getOrFetch = useCallback(async () => {
    const cached = getCachedData()
    if (cached) {
      cacheStateRef.current.data = cached
      cacheStateRef.current.loading = false
      return cached
    }
    return fetchData()
  }, [getCachedData, fetchData])

  return {
    data: cacheStateRef.current.data,
    loading: cacheStateRef.current.loading,
    error: cacheStateRef.current.error,
    getOrFetch,
    refetch,
    clearCache,
    isCached: isCacheValid(),
  }
}

/**
 * Utility function to clear all caches
 */
export function clearAllCaches() {
  cacheStore.clear()
}

/**
 * Utility function to get cache size (for debugging)
 */
export function getCacheSize() {
  return cacheStore.size
}
