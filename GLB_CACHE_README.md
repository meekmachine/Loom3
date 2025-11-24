# GLB Cache System

A Web Worker-based caching system for character GLB files using IndexedDB. This eliminates the need to re-download large GLB files on subsequent page loads.

## Architecture

### Components

1. **`glb-cache-worker.js`** (Project Root)
   - Web Worker that handles all cache operations
   - Uses IndexedDB for persistent storage
   - Lives in project root for easy loading without bundler configuration

2. **`src/utils/GLBCacheManager.ts`**
   - Client-side interface to communicate with the worker
   - Provides async API for cache operations
   - Singleton pattern for app-wide access

3. **`src/utils/glbCacheDebug.ts`**
   - Debug utilities exposed to `window.glbCache`
   - Allows testing cache in browser console

4. **`src/scenes/CharacterGLBScene.tsx`**
   - Integrated cache into GLB loading flow
   - Falls back to direct loading if cache fails
   - Logs cache hit/miss status

## How It Works

1. **First Load**:
   ```
   Request GLB → Worker fetches from network → Store in IndexedDB → Return ArrayBuffer → Load into Three.js
   ```

2. **Subsequent Loads**:
   ```
   Request GLB → Worker retrieves from IndexedDB → Return ArrayBuffer → Load into Three.js
   ```

3. **Cache Status**:
   - Console logs show whether file was loaded from cache or downloaded
   - Example: `[GLB Cache] /characters/jonathan.glb - FROM CACHE (103MB)`

## Usage

### Automatic Caching

The cache is automatically used when loading character models in `CharacterGLBScene`. No code changes needed!

### Manual Cache Control (Browser Console)

```javascript
// Get cache information
await window.glbCache.info()
// Output:
// GLB Cache Info:
//   Total files: 1
//   Total size: 103.45 MB
//   Cached URLs: ['/characters/jonathan.glb']

// Clear specific file from cache
await window.glbCache.clear('/characters/jonathan.glb')

// Clear all cached files
await window.glbCache.clearAll()

// Manually fetch/cache a file
await window.glbCache.fetch('/characters/jonathan_new.glb')
```

### Programmatic Usage

```typescript
import { getGLBCacheManager } from './utils/GLBCacheManager';

const cacheManager = getGLBCacheManager();

// Fetch from cache or network
const result = await cacheManager.fetch('/characters/jonathan.glb');
console.log(result.fromCache); // true if from cache, false if downloaded

// Get cache info
const info = await cacheManager.getInfo();
console.log(info.totalSize); // Total bytes cached

// Clear cache
await cacheManager.clear('/characters/jonathan.glb');
await cacheManager.clearAll();
```

## Benefits

- **Faster Load Times**: GLB files load instantly from IndexedDB after first download
- **Bandwidth Savings**: No repeated downloads of large files (100MB+)
- **Offline Support**: Cached files available without network
- **No Build Config**: Worker lives in project root, no webpack/vite config needed
- **Fallback Support**: Automatically falls back to direct loading if cache fails

## Storage

- **Location**: Browser IndexedDB (`glb-cache` database)
- **Persistence**: Survives page refreshes and browser restarts
- **Size Limits**: Subject to browser storage quotas (typically several GB)

## Testing

1. **First Load** - Open browser DevTools Network tab:
   ```
   - Character GLB will be downloaded (~100MB)
   - Console: "[GLB Cache] /characters/jonathan.glb - DOWNLOADED (103MB)"
   ```

2. **Second Load** - Refresh the page:
   ```
   - No network request for GLB
   - Console: "[GLB Cache] /characters/jonathan.glb - FROM CACHE (103MB)"
   - Load time: < 100ms (vs several seconds)
   ```

3. **Verify Cache** - In browser console:
   ```javascript
   await window.glbCache.info()
   ```

## Browser Support

Works in all modern browsers with:
- Web Workers support
- IndexedDB support
- Blob/ArrayBuffer support

Supported: Chrome, Firefox, Safari, Edge (all recent versions)

## Troubleshooting

### Cache Not Working?

1. Check browser console for errors
2. Verify IndexedDB is enabled (some private/incognito modes disable it)
3. Check storage quota: `await navigator.storage.estimate()`
4. Clear cache and try again: `await window.glbCache.clearAll()`

### Fallback Behavior

If the cache fails for any reason, the system automatically falls back to direct GLB loading from the network. Check console for error messages.
