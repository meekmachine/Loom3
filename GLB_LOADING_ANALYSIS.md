# Character GLB File Loading Analysis

## Overview
The application loads character 3D models in GLB/GLTF format and applies facial animations (morphs) and bone deformations to them. There are two rendering backends: vanilla Three.js and React Three Fiber.

---

## 1. GLB/GLTF Loading Code

### Primary Loaders

#### A. Vanilla Three.js Backend (CharacterGLBScene.tsx)
**File:** `/Users/jonathan/Novembre/LoomLarge/src/scenes/CharacterGLBScene.tsx`

- **Loader Type:** `GLTFLoader` from `three/examples/jsm/loaders/GLTFLoader.js`
- **Draco Compression Support:** Yes, using `DRACOLoader`
- **Draco Decoder URL:** `https://www.gstatic.com/draco/versioned/decoders/1.5.6/`
- **Draco Config:** Using JS decoder (`{ type: 'js' }`)

**Key Code Section (lines 119-125):**
```typescript
const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
dracoLoader.setDecoderConfig({ type: 'js' });
loader.setDRACOLoader(dracoLoader);
```

**Loading Mechanism (lines 211-315):**
```typescript
loader.load(
  src,
  gltf => {
    model = gltf.scene;
    scene.add(model);
    // Model initialization...
  },
  (progressEvent) => {
    // Loading progress tracking
  },
  (err) => {
    // Error handling
  }
);
```

#### B. React Three Fiber Backend (CharacterFiberScene.tsx)
**File:** `/Users/jonathan/Novembre/LoomLarge/src/scenes/CharacterFiberScene.tsx`

- **Loader Type:** `useGLTF` hook from `@react-three/drei`
- **Loading Method (lines 46-51):**
```typescript
const { scene: loadedScene } = useGLTF(src, true, true, (loader) => {
  loader.manager.onProgress = (url, loaded, total) => {
    const progress = (loaded / total) * 100;
    onProgress?.(progress);
  };
});
```

- **Caching:** Built-in automatic caching by useGLTF
- **Cloning (line 58):** Models are cloned to avoid modifying the cached version
  ```typescript
  const model = loadedScene.clone();
  ```

- **Preload Function (lines 252-254):**
```typescript
export function preloadCharacterModel(src: string) {
  useGLTF.preload(src);
}
```

---

## 2. File Paths and URLs

### Available Character Models
**Directory:** `/public/characters/`

**Current models available:**
1. `/characters/jonathan.glb` - Main character model (default)
2. `/characters/jonathan_compressed.glb` - Compressed version
3. `/characters/jonathan_compressed.gltf` - GLTF format
4. `/characters/jonathan_new.glb` - Alternative version
5. `/characters/default.glb` - Default fallback

### Default Paths in Components

**CharacterGLBScene.tsx (line 36):**
```typescript
src = '/characters/jonathan.glb'
```

**CharacterFiberScene.tsx (line 157):**
```typescript
src = '/models/default-character.glb'
```

### Path as Prop
Both scene components accept a `src` prop for specifying custom model paths:
```typescript
type Props = {
  src?: string;  // path to the .glb in /public
};
```

---

## 3. Existing Caching Mechanisms

### A. React Three Fiber (drei) Caching
- **Built-in:** useGLTF automatically caches loaded models in memory
- **Location:** Managed by `@react-three/drei` library
- **Mechanism:** Shared cache prevents reloading the same URL multiple times
- **Clone on Use:** CharacterFiberScene clones the cached model to avoid mutations
  ```typescript
  const model = loadedScene.clone();
  ```

### B. Three.js Loader Manager
**Three.js has a built-in LoadingManager** that can be customized, but the current implementation doesn't show explicit cache configuration in CharacterGLBScene.

### C. Browser Cache
- GLB files can be cached by HTTP headers (public/characters/*.glb)
- Draco decoder library is loaded from CDN and cached by browser

### D. No Custom Caching Layer Detected
The codebase does not implement a custom IndexedDB, LocalStorage, or ServiceWorker-based caching for GLB files.

---

## 4. Model Initialization in the Engine

### A. Scene Setup Flow

**CharacterGLBScene.tsx (lines 47-315):**

1. **Create Three.js Scene, Camera, Renderer (lines 54-126)**
   - Scene with dark background (0x0b0b0c)
   - Perspective camera at position [0, 1.6, 3]
   - WebGL renderer with antialias and alpha

2. **Setup Lighting (lines 102-110)**
   - HemisphereLight: 0.4 intensity
   - DirectionalLight: 0.3 intensity
   - Soft, ambient lighting for better visualization

3. **Create Orbit Controls (lines 112-116)**
   - Damping enabled for smooth interaction
   - Rotation speed: 0.5

4. **Load GLB (lines 119-315)**
   - Configure GLTFLoader with Draco support
   - Show "Loading X%" text while loading
   - On success: process model, detect hair, scale to fit

### B. Model Processing After Loading (lines 213-297)

**1. Hair Detection and Service Initialization (lines 220-237)**
```typescript
const hairObjects: THREE.Object3D[] = [];
model.traverse((obj) => {
  const classification = classifyHairObject(obj.name);
  if (classification) {
    hairObjects.push(obj);
  }
});

if (hairObjects.length > 0) {
  hairService = new HairService(engine);
  hairService.registerObjects(hairObjects);
}
```

**2. Center and Scale Model (lines 239-253)**
```typescript
const box = new THREE.Box3().setFromObject(model);
const size = new THREE.Vector3();
box.getSize(size);
const center = new THREE.Vector3();
box.getCenter(center);

model.position.x += -center.x;
model.position.y += -center.y;
model.position.z += -center.z;

const maxDim = Math.max(size.x, size.y, size.z) || 1;
const desiredMax = 1.6; // ~avatar height in scene units
const scale = desiredMax / maxDim;
model.scale.setScalar(scale);
```

**3. Camera Framing (lines 259-276)**
- Default: Position camera to show ~60% of model height
- Head-focused framing at 35% from model origin
- Optional camera override via `cameraOverride` prop

**4. Collect Morph Target Meshes (lines 278-287)**
```typescript
const meshes: THREE.Mesh[] = [];
model.traverse((obj) => {
  if ((obj as THREE.Mesh).isMesh) {
    const m = obj as THREE.Mesh;
    if (Array.isArray(m.morphTargetInfluences) && 
        m.morphTargetInfluences.length > 0) {
      meshes.push(m);
    }
  }
});
```

### C. Engine Integration

**CharacterGLBScene onReady Callback (line 297):**
```typescript
onReady?.({ scene, model, meshes, hairService: hairService || undefined });
```

**App.tsx handleReady (lines 62-83):**
```typescript
const handleReady = useCallback(
  ({ meshes, model, hairService }: { meshes: any[]; model?: any; hairService?: HairService }) => {
    engine.onReady({ meshes, model });  // Pass to EngineThree
    
    if (hairService) {
      setHairService(hairService);
      (window as any).hairService = hairService;  // Debug handle
    }
    
    const summary = auditMorphCoverage(model);
    setAuditSummary(summary);
    anim?.play?.();
    setIsLoading(false);
  },
  [engine, anim]
);
```

### D. EngineThree.onReady() (EngineThree.ts lines 189-196)

```typescript
onReady = ({ meshes, model }: { meshes: THREE.Mesh[]; model?: THREE.Object3D }) => {
  this.meshes = meshes;
  if (model) {
    this.model = model;
    this.bones = this.resolveBones(model);
    this.logResolvedOnce(this.bones);
  }
};
```

**What happens:**
1. Store meshes array for morph target manipulation
2. Store model reference
3. Resolve bone references (JAW, HEAD, EYES, TONGUE, NECK)
4. Log resolved bones once for debugging

---

## 5. Loading Progress Tracking

### CharacterGLBScene.tsx
**Progress Event Handler (lines 299-311):**
```typescript
(progressEvent) => {
  if (progressEvent.lengthComputable) {
    const percentComplete = (progressEvent.loaded / progressEvent.total) * 100;
    const roundedProgress = Math.round(percentComplete);
    updateLoadingText(roundedProgress);
    onProgress?.(roundedProgress);
  }
}
```

**Visual Feedback:**
- 3D "Loading X%" text with wobble animation
- Mouse influence on text rotation
- Subtle pulse effect while loading

### CharacterFiberScene.tsx
**Progress Tracking (lines 46-51):**
```typescript
const { scene: loadedScene } = useGLTF(src, true, true, (loader) => {
  loader.manager.onProgress = (url, loaded, total) => {
    const progress = (loaded / total) * 100;
    onProgress?.(progress);
  };
});
```

**Visual Feedback:**
- Progress percentage displayed in top-left corner
- Hidden when progress reaches 100%

---

## 6. Context and State Management

### ThreeProvider (threeContext.tsx)
- Creates singleton `EngineThree` instance
- Initializes animation service
- Manages central RAF loop with clock
- Calls `engine.update(dt)` each frame for transitions

**Key Code (lines 28-30):**
```typescript
if (!engineRef.current) engineRef.current = new EngineThree();
if (!clockRef.current) clockRef.current = new THREE.Clock();
```

### FiberProvider (fiberContext.tsx)
- Creates singleton `EngineFour` instance (alternative engine)
- Initializes animation service
- No central RAF loop (uses React Three Fiber's useFrame)

---

## 7. Hair System Integration

**Hair Detection Flow:**
1. After GLB loads, traverse all objects
2. Use `classifyHairObject(obj.name)` to identify hair/eyebrow meshes
3. Create `HairService` instance if hair objects found
4. Register hair objects with service
5. Pass `hairService` to `onReady` callback
6. Store in App state and make globally available

**File:** `/Users/jonathan/Novembre/LoomLarge/src/latticework/hair/hairService.ts`

---

## Summary Table

| Aspect | Vanilla Three.js | React Three Fiber |
|--------|------------------|-------------------|
| **Loader** | GLTFLoader | useGLTF (drei) |
| **Draco Support** | Yes (explicit) | Yes (built-in) |
| **Default Path** | /characters/jonathan.glb | /models/default-character.glb |
| **Caching** | Browser HTTP cache | Built-in drei cache + clone |
| **Progress Tracking** | ProgressEvent + 3D text | LoadingManager + overlay text |
| **Engine Integration** | EngineThree | EngineThree or EngineFour |
| **Animation Loop** | Central RAF in ThreeProvider | React Three Fiber useFrame |
| **Hair Support** | Yes | Not shown in FiberScene |

---

## Important Notes

1. **No Custom Caching:** The application relies on browser HTTP caching and drei's built-in cache
2. **Draco Compression:** Uses public CDN for decoder (gstatic.com)
3. **Model Cloning:** React Three Fiber explicitly clones to prevent shared state issues
4. **Morph Target Detection:** Only meshes with morphTargetInfluences are used by animation engine
5. **Bone Resolution:** Happens in EngineThree after model load (searches for bone candidates)
6. **Hair is Optional:** Only initialized if detected in model by name classification

