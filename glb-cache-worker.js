// GLB Cache Worker - Handles caching of character GLB files using IndexedDB
// Lives in project root, loaded directly from index.html or main app

const DB_NAME = 'glb-cache';
const DB_VERSION = 1;
const STORE_NAME = 'models';

let db = null;

// Initialize IndexedDB
async function initDB() {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = database.createObjectStore(STORE_NAME, { keyPath: 'url' });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

// Fetch and cache a GLB file
async function fetchAndCache(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const timestamp = Date.now();

    // Store in IndexedDB
    await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    await new Promise((resolve, reject) => {
      const request = store.put({
        url,
        data: arrayBuffer,
        timestamp,
        size: arrayBuffer.byteLength
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    return {
      data: arrayBuffer,
      cached: true,
      fromCache: false,
      timestamp
    };
  } catch (error) {
    throw new Error(`Failed to fetch ${url}: ${error.message}`);
  }
}

// Get cached GLB file
async function getCached(url) {
  try {
    await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(url);
      request.onsuccess = () => {
        if (request.result) {
          resolve({
            data: request.result.data,
            cached: true,
            fromCache: true,
            timestamp: request.result.timestamp,
            size: request.result.size
          });
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    return null;
  }
}

// Clear specific cache entry
async function clearCache(url) {
  try {
    await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.delete(url);
      request.onsuccess = () => resolve({ success: true });
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    throw new Error(`Failed to clear cache: ${error.message}`);
  }
}

// Clear all cache
async function clearAllCache() {
  try {
    await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve({ success: true, cleared: true });
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    throw new Error(`Failed to clear all cache: ${error.message}`);
  }
}

// Get cache info
async function getCacheInfo() {
  try {
    await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.getAllKeys();
      request.onsuccess = () => {
        const keys = request.result;
        const getAllRequest = store.getAll();
        getAllRequest.onsuccess = () => {
          const entries = getAllRequest.result;
          const totalSize = entries.reduce((sum, entry) => sum + (entry.size || 0), 0);
          resolve({
            count: keys.length,
            urls: keys,
            totalSize,
            entries: entries.map(e => ({
              url: e.url,
              timestamp: e.timestamp,
              size: e.size
            }))
          });
        };
        getAllRequest.onerror = () => reject(getAllRequest.error);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    return { count: 0, urls: [], totalSize: 0, entries: [] };
  }
}

// Handle messages from main thread
self.addEventListener('message', async (event) => {
  const { type, url, id } = event.data;

  try {
    switch (type) {
      case 'FETCH': {
        // Try to get from cache first
        let result = await getCached(url);

        if (result) {
          // Found in cache
          self.postMessage({
            type: 'SUCCESS',
            id,
            result
          });
        } else {
          // Not in cache, fetch and cache it
          result = await fetchAndCache(url);
          self.postMessage({
            type: 'SUCCESS',
            id,
            result
          });
        }
        break;
      }

      case 'CLEAR': {
        const result = await clearCache(url);
        self.postMessage({
          type: 'SUCCESS',
          id,
          result
        });
        break;
      }

      case 'CLEAR_ALL': {
        const result = await clearAllCache();
        self.postMessage({
          type: 'SUCCESS',
          id,
          result
        });
        break;
      }

      case 'INFO': {
        const result = await getCacheInfo();
        self.postMessage({
          type: 'SUCCESS',
          id,
          result
        });
        break;
      }

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      id,
      error: error.message
    });
  }
});

// Signal that worker is ready
self.postMessage({ type: 'READY' });
