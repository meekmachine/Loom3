/**
 * Debug utilities for GLB cache
 * Exposes cache controls to window for easy testing in console
 */

import { getGLBCacheManager } from './GLBCacheManager';

export function setupGLBCacheDebug() {
  if (typeof window === 'undefined') return;

  const cacheManager = getGLBCacheManager();

  // Expose cache utilities to window for debugging
  (window as any).glbCache = {
    /**
     * Get cache information
     * Usage: await window.glbCache.info()
     */
    info: async () => {
      const info = await cacheManager.getInfo();
      console.log('GLB Cache Info:');
      console.log(`  Total files: ${info.count}`);
      console.log(`  Total size: ${(info.totalSize / 1024 / 1024).toFixed(2)} MB`);
      console.log('  Cached URLs:', info.urls);
      info.entries.forEach((entry) => {
        const sizeMB = (entry.size / 1024 / 1024).toFixed(2);
        const date = new Date(entry.timestamp).toLocaleString();
        console.log(`    - ${entry.url} (${sizeMB} MB, cached at ${date})`);
      });
      return info;
    },

    /**
     * Clear a specific cached file
     * Usage: await window.glbCache.clear('/characters/jonathan.glb')
     */
    clear: async (url: string) => {
      const result = await cacheManager.clear(url);
      console.log(`Cleared cache for: ${url}`, result);
      return result;
    },

    /**
     * Clear all cached files
     * Usage: await window.glbCache.clearAll()
     */
    clearAll: async () => {
      const result = await cacheManager.clearAll();
      console.log('Cleared all GLB cache', result);
      return result;
    },

    /**
     * Manually fetch/cache a file
     * Usage: await window.glbCache.fetch('/characters/jonathan.glb')
     */
    fetch: async (url: string) => {
      const result = await cacheManager.fetch(url);
      const sizeMB = result.size ? (result.size / 1024 / 1024).toFixed(2) : 'unknown';
      console.log(`Fetched ${url}:`, {
        fromCache: result.fromCache,
        size: `${sizeMB} MB`,
        timestamp: new Date(result.timestamp).toLocaleString()
      });
      return result;
    }
  };

  console.log('[GLB Cache] Debug utilities loaded. Try:');
  console.log('  await window.glbCache.info()     - Show cache info');
  console.log('  await window.glbCache.clear(url) - Clear specific file');
  console.log('  await window.glbCache.clearAll() - Clear all cache');
  console.log('  await window.glbCache.fetch(url) - Fetch/cache a file');
}
