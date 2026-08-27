export type PreparedVisualResourceCacheLimits = {
  maxEntries: number;
  maxEstimatedBytes: number;
};

export type PreparedVisualResourceCacheDiagnostics = {
  entries: number;
  estimatedBytes: number;
  peakBytes: number;
  evictions: number;
  pinnedEntries: number;
};

type CacheEntry<T> = {
  value: T;
  estimatedBytes: number;
  pinCount: number;
};

const cacheRegistry = new Set<PreparedVisualResourceCache<unknown>>();

/**
 * Bounded LRU for decoded/rasterized visual resources.
 *
 * A pinned entry may temporarily take the cache above its configured limits;
 * eviction resumes as soon as the last lifecycle pin is released. This keeps
 * active, armed-successor and lookahead resources valid without allowing the
 * completed-trial history to grow without bound.
 */
export class PreparedVisualResourceCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  private estimatedBytes = 0;
  private peakBytes = 0;
  private evictions = 0;

  constructor(
    private limits: PreparedVisualResourceCacheLimits,
    private readonly dispose?: (value: T, key: string) => void,
  ) {
    this.validateLimits(limits);
    cacheRegistry.add(this as PreparedVisualResourceCache<unknown>);
  }

  configure(limits: PreparedVisualResourceCacheLimits) {
    this.validateLimits(limits);
    this.limits = limits;
    this.evictToLimits();
  }

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.touch(key, entry);
    return entry.value;
  }

  peek(key: string): T | undefined {
    return this.entries.get(key)?.value;
  }

  set(key: string, value: T, estimatedBytes: number): T {
    const normalizedBytes = this.normalizeBytes(estimatedBytes);
    const existing = this.entries.get(key);
    const pinCount = existing?.pinCount ?? 0;
    if (existing) {
      this.entries.delete(key);
      this.estimatedBytes -= existing.estimatedBytes;
      if (existing.value !== value) this.dispose?.(existing.value, key);
    }
    this.entries.set(key, { value, estimatedBytes: normalizedBytes, pinCount });
    this.estimatedBytes += normalizedBytes;
    this.peakBytes = Math.max(this.peakBytes, this.estimatedBytes);
    // Keep the just-published value reachable until its lifecycle can acquire
    // a pin in the same turn/microtask. If every older entry is pinned, the
    // cache may exceed its limit by this one candidate temporarily.
    this.evictToLimits(key);
    return value;
  }

  pin(key: string): (() => void) | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    entry.pinCount += 1;
    this.touch(key, entry);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const current = this.entries.get(key);
      if (!current) return;
      current.pinCount = Math.max(0, current.pinCount - 1);
      this.evictToLimits();
    };
  }

  delete(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry || entry.pinCount > 0) return false;
    this.remove(key, entry, false);
    return true;
  }

  clearUnpinned() {
    for (const [key, entry] of this.entries) {
      if (entry.pinCount === 0) this.remove(key, entry, false);
    }
  }

  getDiagnostics(): PreparedVisualResourceCacheDiagnostics {
    let pinnedEntries = 0;
    for (const entry of this.entries.values()) {
      if (entry.pinCount > 0) pinnedEntries += 1;
    }
    return {
      entries: this.entries.size,
      estimatedBytes: this.estimatedBytes,
      peakBytes: this.peakBytes,
      evictions: this.evictions,
      pinnedEntries,
    };
  }

  private evictToLimits(protectedKey?: string) {
    while (
      this.entries.size > this.limits.maxEntries ||
      this.estimatedBytes > this.limits.maxEstimatedBytes
    ) {
      let candidate: [string, CacheEntry<T>] | null = null;
      for (const pair of this.entries) {
        if (pair[0] !== protectedKey && pair[1].pinCount === 0) {
          candidate = pair;
          break;
        }
      }
      if (!candidate) return;
      this.remove(candidate[0], candidate[1], true);
    }
  }

  private remove(key: string, entry: CacheEntry<T>, eviction: boolean) {
    if (!this.entries.delete(key)) return;
    this.estimatedBytes = Math.max(
      0,
      this.estimatedBytes - entry.estimatedBytes,
    );
    if (eviction) this.evictions += 1;
    this.dispose?.(entry.value, key);
  }

  private touch(key: string, entry: CacheEntry<T>) {
    this.entries.delete(key);
    this.entries.set(key, entry);
  }

  private normalizeBytes(value: number) {
    return Number.isFinite(value) && value > 0 ? Math.ceil(value) : 0;
  }

  private validateLimits(limits: PreparedVisualResourceCacheLimits) {
    if (
      !Number.isFinite(limits.maxEntries) ||
      limits.maxEntries < 1 ||
      !Number.isFinite(limits.maxEstimatedBytes) ||
      limits.maxEstimatedBytes < 1
    ) {
      throw new Error("invalid_prepared_visual_resource_cache_limits");
    }
  }
}

export function getPreparedVisualResourceCacheTelemetry() {
  let entries = 0;
  let estimatedBytes = 0;
  let peakBytes = 0;
  let evictions = 0;
  let pinnedEntries = 0;
  for (const cache of cacheRegistry) {
    const diagnostics = cache.getDiagnostics();
    entries += diagnostics.entries;
    estimatedBytes += diagnostics.estimatedBytes;
    peakBytes += diagnostics.peakBytes;
    evictions += diagnostics.evictions;
    pinnedEntries += diagnostics.pinnedEntries;
  }
  return {
    visual_resource_cache_entries: entries,
    visual_resource_cache_estimated_bytes: estimatedBytes,
    visual_resource_cache_peak_bytes: peakBytes,
    visual_resource_cache_evictions: evictions,
    visual_resource_cache_pinned_entries: pinnedEntries,
  };
}
