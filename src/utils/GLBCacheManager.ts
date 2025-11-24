/**
 * GLBCacheManager - Client-side interface for the GLB cache web worker
 * Provides a simple API to fetch and cache GLB files using IndexedDB
 */

export type CacheResult = {
  data: ArrayBuffer;
  cached: boolean;
  fromCache: boolean;
  timestamp: number;
  size?: number;
};

export type CacheInfo = {
  count: number;
  urls: string[];
  totalSize: number;
  entries: Array<{
    url: string;
    timestamp: number;
    size: number;
  }>;
};

type MessageCallback = {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
};

export class GLBCacheManager {
  private worker: Worker | null = null;
  private pendingMessages = new Map<string, MessageCallback>();
  private messageIdCounter = 0;
  private ready = false;
  private readyPromise: Promise<void>;

  constructor() {
    this.readyPromise = this.initWorker();
  }

  private async initWorker(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Worker lives in project root, accessible from index.html
        this.worker = new Worker('/glb-cache-worker.js');

        this.worker.addEventListener('message', (event) => {
          const { type, id, result, error } = event.data;

          if (type === 'READY') {
            this.ready = true;
            resolve();
            return;
          }

          const callback = this.pendingMessages.get(id);
          if (!callback) return;

          this.pendingMessages.delete(id);

          if (type === 'SUCCESS') {
            callback.resolve(result);
          } else if (type === 'ERROR') {
            callback.reject(new Error(error));
          }
        });

        this.worker.addEventListener('error', (error) => {
          console.error('[GLBCacheManager] Worker error:', error);
          reject(error);
        });

        // Timeout if worker doesn't respond
        setTimeout(() => {
          if (!this.ready) {
            reject(new Error('GLB cache worker failed to initialize'));
          }
        }, 5000);
      } catch (error) {
        reject(error);
      }
    });
  }

  private async sendMessage(type: string, url?: string): Promise<any> {
    await this.readyPromise;

    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    const id = `msg_${this.messageIdCounter++}`;

    return new Promise((resolve, reject) => {
      this.pendingMessages.set(id, { resolve, reject });

      this.worker!.postMessage({
        type,
        url,
        id
      });

      // Timeout for individual messages (30 seconds for large files)
      setTimeout(() => {
        if (this.pendingMessages.has(id)) {
          this.pendingMessages.delete(id);
          reject(new Error(`Request timeout for ${type}`));
        }
      }, 30000);
    });
  }

  /**
   * Fetch a GLB file (from cache if available, otherwise downloads and caches)
   */
  async fetch(url: string): Promise<CacheResult> {
    return this.sendMessage('FETCH', url);
  }

  /**
   * Clear a specific cached GLB file
   */
  async clear(url: string): Promise<{ success: boolean }> {
    return this.sendMessage('CLEAR', url);
  }

  /**
   * Clear all cached GLB files
   */
  async clearAll(): Promise<{ success: boolean; cleared: boolean }> {
    return this.sendMessage('CLEAR_ALL');
  }

  /**
   * Get information about cached files
   */
  async getInfo(): Promise<CacheInfo> {
    return this.sendMessage('INFO');
  }

  /**
   * Dispose of the worker
   */
  dispose() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingMessages.clear();
  }
}

// Singleton instance for the app
let cacheManagerInstance: GLBCacheManager | null = null;

/**
 * Get the singleton GLB cache manager instance
 */
export function getGLBCacheManager(): GLBCacheManager {
  if (!cacheManagerInstance) {
    cacheManagerInstance = new GLBCacheManager();
  }
  return cacheManagerInstance;
}

/**
 * Dispose of the singleton instance (useful for cleanup)
 */
export function disposeGLBCacheManager() {
  if (cacheManagerInstance) {
    cacheManagerInstance.dispose();
    cacheManagerInstance = null;
  }
}
