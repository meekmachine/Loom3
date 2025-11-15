/**
 * Performance Optimizer for Lip-Sync System
 * Provides caching, timing optimization, and performance monitoring
 */

export interface PerformanceMetrics {
  phonemeExtractionTime: number; // ms
  visemeMappingTime: number; // ms
  arkitConversionTime: number; // ms
  snippetBuildTime: number; // ms
  totalLatency: number; // ms
  cacheHitRate: number; // 0-1
  averageProcessingTime: number; // ms (rolling average)
}

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  hits: number;
}

/**
 * LRU Cache with performance tracking
 */
export class LRUCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private maxSize: number;
  private hits = 0;
  private misses = 0;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      this.hits++;
      entry.hits++;
      entry.timestamp = Date.now();
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, entry);
      return entry.value;
    }
    this.misses++;
    return undefined;
  }

  set(key: K, value: V): void {
    // Remove oldest entry if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getHitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }

  getStats() {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.getHitRate(),
    };
  }
}

/**
 * Performance Optimizer Class
 */
export class PerformanceOptimizer {
  private phonemeCache = new LRUCache<string, string[]>(500);
  private visemeCache = new LRUCache<string, any[]>(500);
  private snippetCache = new LRUCache<string, any>(200);

  private metrics: PerformanceMetrics = {
    phonemeExtractionTime: 0,
    visemeMappingTime: 0,
    arkitConversionTime: 0,
    snippetBuildTime: 0,
    totalLatency: 0,
    cacheHitRate: 0,
    averageProcessingTime: 0,
  };

  private processingTimes: number[] = [];
  private maxHistorySize = 100;

  /**
   * Measure execution time of a function
   */
  public async measure<T>(
    name: keyof PerformanceMetrics,
    fn: () => T | Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    const result = await fn();
    const duration = performance.now() - startTime;

    this.metrics[name] = duration;
    this.updateAverageProcessingTime(duration);

    return result;
  }

  /**
   * Cache phoneme extraction result
   */
  public cachePhonemes(text: string, phonemes: string[]): void {
    const key = this.normalizeText(text);
    this.phonemeCache.set(key, phonemes);
  }

  /**
   * Get cached phonemes
   */
  public getCachedPhonemes(text: string): string[] | undefined {
    const key = this.normalizeText(text);
    return this.phonemeCache.get(key);
  }

  /**
   * Cache viseme mapping result
   */
  public cacheVisemes(phonemes: string, visemes: any[]): void {
    this.visemeCache.set(phonemes, visemes);
  }

  /**
   * Get cached visemes
   */
  public getCachedVisemes(phonemes: string): any[] | undefined {
    return this.visemeCache.get(phonemes);
  }

  /**
   * Cache animation snippet
   */
  public cacheSnippet(key: string, snippet: any): void {
    this.snippetCache.set(key, snippet);
  }

  /**
   * Get cached snippet
   */
  public getCachedSnippet(key: string): any | undefined {
    return this.snippetCache.get(key);
  }

  /**
   * Normalize text for caching (lowercase, trim)
   */
  private normalizeText(text: string): string {
    return text.toLowerCase().trim();
  }

  /**
   * Update average processing time
   */
  private updateAverageProcessingTime(duration: number): void {
    this.processingTimes.push(duration);
    if (this.processingTimes.length > this.maxHistorySize) {
      this.processingTimes.shift();
    }

    const sum = this.processingTimes.reduce((a, b) => a + b, 0);
    this.metrics.averageProcessingTime = sum / this.processingTimes.length;
  }

  /**
   * Get current performance metrics
   */
  public getMetrics(): PerformanceMetrics {
    const phoneStats = this.phonemeCache.getStats();
    const visemeStats = this.visemeCache.getStats();
    const snippetStats = this.snippetCache.getStats();

    const totalHits = phoneStats.hits + visemeStats.hits + snippetStats.hits;
    const totalMisses = phoneStats.misses + visemeStats.misses + snippetStats.misses;
    const overall = totalHits + totalMisses;

    return {
      ...this.metrics,
      cacheHitRate: overall > 0 ? totalHits / overall : 0,
      totalLatency:
        this.metrics.phonemeExtractionTime +
        this.metrics.visemeMappingTime +
        this.metrics.arkitConversionTime +
        this.metrics.snippetBuildTime,
    };
  }

  /**
   * Get cache statistics
   */
  public getCacheStats() {
    return {
      phonemes: this.phonemeCache.getStats(),
      visemes: this.visemeCache.getStats(),
      snippets: this.snippetCache.getStats(),
    };
  }

  /**
   * Clear all caches
   */
  public clearCaches(): void {
    this.phonemeCache.clear();
    this.visemeCache.clear();
    this.snippetCache.clear();
  }

  /**
   * Check if performance is within acceptable thresholds
   */
  public isPerformanceGood(): boolean {
    const metrics = this.getMetrics();
    return (
      metrics.totalLatency < 100 && // Less than 100ms total
      metrics.averageProcessingTime < 50 && // Average < 50ms
      metrics.cacheHitRate > 0.3 // At least 30% cache hits
    );
  }

  /**
   * Get performance report as string
   */
  public getPerformanceReport(): string {
    const metrics = this.getMetrics();
    const cacheStats = this.getCacheStats();
    const lines: string[] = [];

    lines.push('=== LIP-SYNC PERFORMANCE REPORT ===\n');
    lines.push('Timing Breakdown:');
    lines.push(`  Phoneme Extraction: ${metrics.phonemeExtractionTime.toFixed(2)}ms`);
    lines.push(`  Viseme Mapping: ${metrics.visemeMappingTime.toFixed(2)}ms`);
    lines.push(`  ARKit Conversion: ${metrics.arkitConversionTime.toFixed(2)}ms`);
    lines.push(`  Snippet Build: ${metrics.snippetBuildTime.toFixed(2)}ms`);
    lines.push(`  Total Latency: ${metrics.totalLatency.toFixed(2)}ms`);
    lines.push(`  Average Processing: ${metrics.averageProcessingTime.toFixed(2)}ms\n`);

    lines.push('Cache Performance:');
    lines.push(`  Overall Hit Rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%`);
    lines.push(`  Phoneme Cache: ${cacheStats.phonemes.size} entries, ${(cacheStats.phonemes.hitRate * 100).toFixed(1)}% hits`);
    lines.push(`  Viseme Cache: ${cacheStats.visemes.size} entries, ${(cacheStats.visemes.hitRate * 100).toFixed(1)}% hits`);
    lines.push(`  Snippet Cache: ${cacheStats.snippets.size} entries, ${(cacheStats.snippets.hitRate * 100).toFixed(1)}% hits\n`);

    lines.push('Status:');
    lines.push(`  Performance: ${this.isPerformanceGood() ? '✓ GOOD' : '✗ NEEDS IMPROVEMENT'}`);

    return lines.join('\n');
  }

  /**
   * Batch process multiple texts for better performance
   */
  public async batchProcess<T>(
    items: string[],
    processor: (item: string) => Promise<T>
  ): Promise<T[]> {
    const startTime = performance.now();
    const results = await Promise.all(items.map(item => processor(item)));
    const duration = performance.now() - startTime;

    console.log(`[PerformanceOptimizer] Batch processed ${items.length} items in ${duration.toFixed(2)}ms`);
    console.log(`[PerformanceOptimizer] Average: ${(duration / items.length).toFixed(2)}ms per item`);

    return results;
  }

  /**
   * Prefetch common phrases to warm up cache
   */
  public prefetchCommonPhrases(phrases: string[], processor: (phrase: string) => void): void {
    console.log(`[PerformanceOptimizer] Prefetching ${phrases.length} common phrases...`);
    const startTime = performance.now();

    phrases.forEach(phrase => {
      try {
        processor(phrase);
      } catch (e) {
        console.warn(`[PerformanceOptimizer] Failed to prefetch "${phrase}":`, e);
      }
    });

    const duration = performance.now() - startTime;
    console.log(`[PerformanceOptimizer] Prefetch completed in ${duration.toFixed(2)}ms`);
  }

  /**
   * Monitor and log performance continuously
   */
  public startMonitoring(intervalMs: number = 5000): () => void {
    const interval = setInterval(() => {
      const metrics = this.getMetrics();
      if (metrics.totalLatency > 0) {
        console.log('[PerformanceOptimizer]', {
          latency: `${metrics.totalLatency.toFixed(1)}ms`,
          avgProcessing: `${metrics.averageProcessingTime.toFixed(1)}ms`,
          cacheHitRate: `${(metrics.cacheHitRate * 100).toFixed(1)}%`,
          status: this.isPerformanceGood() ? '✓' : '✗',
        });
      }
    }, intervalMs);

    // Return stop function
    return () => clearInterval(interval);
  }
}

/**
 * Timing decorator for methods
 */
export function timed(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const startTime = performance.now();
    const result = await originalMethod.apply(this, args);
    const duration = performance.now() - startTime;

    console.log(`[Timing] ${propertyKey}() took ${duration.toFixed(2)}ms`);

    return result;
  };

  return descriptor;
}

// Export singleton
export const performanceOptimizer = new PerformanceOptimizer();

// Make available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).lipSyncPerf = performanceOptimizer;
}
