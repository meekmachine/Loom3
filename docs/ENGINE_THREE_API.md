# EngineThree API Reference

Complete API documentation for the EngineThree class - the central animation engine for Three.js-based character rendering.

**Source:** [src/engine/EngineThree.ts](../src/engine/EngineThree.ts)

---

## Table of Contents

1. [Initialization & Lifecycle](#1-initialization--lifecycle)
2. [Transition System](#2-transition-system)
3. [AU (Action Unit) Control](#3-au-action-unit-control)
4. [Morph Target Control](#4-morph-target-control)
5. [Composite Bone Rotation System](#5-composite-bone-rotation-system)
6. [Mesh Visibility Control](#6-mesh-visibility-control)
7. [Baked Animation Mixer](#7-baked-animation-mixer-glb-clips)
8. [Morph Animation Mixer](#8-morph-animation-mixer-programmatic-clips)
9. [Test Animations](#9-test-animations)
10. [Hair & Eyebrow Control](#10-hair--eyebrow-control)
11. [Mouse Tracking](#11-mouse-tracking-deprecated)
12. [Skybox Control](#12-skybox-control)
13. [Camera/Gaze Utilities](#13-cameragaze-utilities)
14. [Exported Constants & Functions](#14-exported-constants--functions)
15. [Private State Reference](#15-private-state-reference)

---

## 1. Initialization & Lifecycle

### `onReady(options)`

Initialize the engine with model data. Call this after loading a GLB model.

```typescript
onReady({
  meshes: THREE.Mesh[],
  model?: THREE.Object3D,
  animations?: THREE.AnimationClip[],
  scene?: THREE.Scene,
  skyboxTexture?: THREE.Texture
}): void
```

**Parameters:**
- `meshes` - Array of meshes with morph targets
- `model` - Root model object (for bone resolution)
- `animations` - Pre-authored GLB animation clips
- `scene` - Scene reference for skybox control
- `skyboxTexture` - Skybox texture reference

**Example:**
```typescript
engine.onReady({
  meshes: gltf.scene.children.filter(c => c.isMesh),
  model: gltf.scene,
  animations: gltf.animations,
  scene,
  skyboxTexture
});
```

---

### `resetToNeutral()`

Reset all facial animation to neutral state. Clears AU values, bone rotations, transitions, and zeroes all morphs.

```typescript
resetToNeutral(): void
```

---

### `update(deltaSeconds)`

Main update loop. Call this every frame from your RAF loop.

```typescript
update(deltaSeconds: number): void
```

**What it updates (in order):**
1. Baked clip animations (AnimationMixer)
2. Morph target animations (AnimationMixer)
3. Transition tweens (lerp-based)
4. Pending composite bone rotations
5. Mouse tracking interpolation (if enabled)

---

## 2. Transition System

The transition system provides smooth lerp-based animations for AUs and morphs.

### `transitionAU(id, to, durationMs?)`

Smoothly tween an AU to a target value.

```typescript
transitionAU(id: number | string, to: number, durationMs?: number): Promise<void>
```

**Parameters:**
- `id` - AU identifier (number or string like "12L")
- `to` - Target value (0-1)
- `durationMs` - Duration in milliseconds (default: 200)

**Example:**
```typescript
// Smile transition over 500ms
await engine.transitionAU(12, 0.8, 500);
```

---

### `transitionMorph(key, to, durationMs?)`

Smoothly tween a morph target to a target value.

```typescript
transitionMorph(key: string, to: number, durationMs?: number): Promise<void>
```

**Parameters:**
- `key` - Morph target name (e.g., "Mouth_Smile_L")
- `to` - Target value (0-1)
- `durationMs` - Duration in milliseconds (default: 120)

---

### `transitionContinuum(negAU, posAU, value, durationMs?)`

Smoothly transition a continuum AU pair (e.g., eyes left/right).

```typescript
transitionContinuum(
  negAU: number,
  posAU: number,
  continuumValue: number,
  durationMs?: number
): Promise<void>
```

**Sign Convention:**
- Negative value (-1 to 0): activates `negAU`
- Positive value (0 to +1): activates `posAU`

**Common Pairs:**
| negAU | posAU | Movement |
|-------|-------|----------|
| 31 | 32 | Head left/right |
| 33 | 54 | Head up/down |
| 61 | 62 | Eyes left/right |
| 63 | 64 | Eyes up/down |

**Example:**
```typescript
// Look right over 300ms
await engine.transitionContinuum(61, 62, 0.5, 300);
```

---

### `setContinuum(negAU, posAU, value)`

Set a continuum AU pair immediately (no animation).

```typescript
setContinuum(negAU: number, posAU: number, continuumValue: number): void
```

---

### `clearTransitions()`

Cancel all running transitions. Useful when playback rate changes.

```typescript
clearTransitions(): void
```

---

### `pause()` / `resume()` / `getPaused()`

Pause/resume all transitions.

```typescript
pause(): void
resume(): void
getPaused(): boolean
```

---

### `getActiveTransitionCount()`

Get count of active transitions (for debugging).

```typescript
getActiveTransitionCount(): number
```

---

## 3. AU (Action Unit) Control

### `setAU(id, value)`

Set an AU value. Handles both morphs and composite bone rotations.

```typescript
setAU(id: number | string, value: number): void
```

**ID Formats:**
- Number: `12` (applies to both sides)
- String with side: `"12L"` or `"12R"` (left/right only)

**How it works:**
1. Checks if AU is part of composite rotation system
2. If composite: updates rotation state, marks bone as pending
3. Applies morphs (scaled by mix weight for mixed AUs)
4. Non-composite AUs also apply bone rotations directly

---

### `setAUMixWeight(id, weight)`

Set the bone/morph blend weight for mixed AUs.

```typescript
setAUMixWeight(id: number, weight: number): void
```

**Mix Weight Behavior:**
- `0.0` = Bone only (no morph contribution)
- `1.0` = Full morph + bone (default for most AUs)

---

### `getAUMixWeight(id)`

Get current mix weight for an AU.

```typescript
getAUMixWeight(id: number): number
```

---

### `hasBoneBinding(id)`

Check if an AU has bone bindings.

```typescript
hasBoneBinding(id: number): boolean
```

---

## 4. Morph Target Control

### `setMorph(key, value)`

Set a morph target value on all meshes.

```typescript
setMorph(key: string, value: number): void
```

**Example:**
```typescript
engine.setMorph('Mouth_Smile_L', 0.8);
```

---

### `setMorphOnMeshes(meshNames, key, value)`

Set a morph on specific meshes only (more efficient for targeted updates).

```typescript
setMorphOnMeshes(meshNames: string[], key: string, value: number): void
```

---

### `applyMorphs(keys, value)`

Apply a value to multiple morph keys at once.

```typescript
applyMorphs(keys: string[], value: number): void
```

---

## 5. Composite Bone Rotation System

The composite rotation system allows independent control of pitch/yaw/roll for bones without axis values overwriting each other.

**Tracked Bones:** JAW, HEAD, EYE_L, EYE_R, TONGUE, NECK

**How it works:**
1. `setAU()` detects composite AUs via `AU_TO_COMPOSITE_MAP`
2. Updates `this.rotations[nodeKey][axis]` state
3. Adds node to `pendingCompositeNodes` set
4. `update()` calls `flushPendingComposites()` to apply all pending rotations once per frame

This prevents rotation overwriting when multiple AUs affect the same bone on different axes.

---

## 6. Mesh Visibility Control

### `getMeshList()`

Get all mesh info for UI display.

```typescript
getMeshList(): Array<{
  name: string;
  visible: boolean;
  category: string;
  morphCount: number;
}>
```

---

### `setMeshVisible(meshName, visible)`

Set mesh visibility by name.

```typescript
setMeshVisible(meshName: string, visible: boolean): void
```

---

### `setCategoryVisible(category, visible)`

Set visibility for all meshes in a category.

```typescript
setCategoryVisible(category: string, visible: boolean): void
```

**Categories:** `body`, `hair`, `eyebrow`, `eye`, `teeth`, etc.

---

## 7. Baked Animation Mixer (GLB Clips)

Pre-authored animations from GLB files (e.g., idle breathing).

### `getBakedClipNames()`

Get list of available baked clip names.

```typescript
getBakedClipNames(): string[]
```

---

### `getCurrentBakedClip()`

Get currently selected clip name.

```typescript
getCurrentBakedClip(): string | null
```

---

### `setBakedClip(name)`

Switch to a different baked clip.

```typescript
setBakedClip(name: string): void
```

---

### `setBakedPlayback(play)`

Start/stop baked animation playback.

```typescript
setBakedPlayback(play: boolean): void
```

---

### `resetBakedClip()`

Reset current clip to beginning.

```typescript
resetBakedClip(): void
```

---

### `getBakedPlaybackState()`

Check if baked animations are playing.

```typescript
getBakedPlaybackState(): boolean
```

---

## 8. Morph Animation Mixer (Programmatic Clips)

Create and play keyframe-based morph animations programmatically.

### `initMorphMixer()`

Initialize the morph animation mixer. Call after `onReady()`.

```typescript
initMorphMixer(): boolean
```

---

### `createMorphClip(name, morphKey, keyframes, meshName?)`

Create a single-morph animation clip.

```typescript
createMorphClip(
  name: string,
  morphKey: string,
  keyframes: Array<{ time: number; value: number }>,
  meshName?: string
): THREE.AnimationClip | null
```

---

### `createMultiMorphClip(name, morphAnimations)`

Create a multi-morph animation clip.

```typescript
createMultiMorphClip(
  name: string,
  morphAnimations: Array<{
    morphKey: string;
    keyframes: Array<{ time: number; value: number }>;
  }>
): THREE.AnimationClip | null
```

**Example:**
```typescript
const clip = engine.createMultiMorphClip('smile', [
  {
    morphKey: 'Mouth_Smile_L',
    keyframes: [
      { time: 0, value: 0 },
      { time: 0.5, value: 1 },
      { time: 1, value: 0 }
    ]
  },
  {
    morphKey: 'Mouth_Smile_R',
    keyframes: [
      { time: 0, value: 0 },
      { time: 0.5, value: 1 },
      { time: 1, value: 0 }
    ]
  }
]);
```

---

### `playMorphClip(clip, options?)`

Play a morph animation clip.

```typescript
playMorphClip(
  clip: THREE.AnimationClip,
  options?: {
    loop?: boolean;
    clampWhenFinished?: boolean;
    timeScale?: number;
    fadeIn?: number;
  }
): THREE.AnimationAction | null
```

---

### `stopMorphClip(clipName, fadeOut?)`

Stop a playing morph animation.

```typescript
stopMorphClip(clipName: string, fadeOut?: number): void
```

---

### `stopAllMorphClips()`

Stop all morph animations.

```typescript
stopAllMorphClips(): void
```

---

## 9. Test Animations

Demo functions for testing the animation system.

| Method | Description |
|--------|-------------|
| `testSmileAnimation()` | Looping smile animation |
| `testBlinkAnimation()` | Looping blink animation |
| `testHeadAnimation()` | Head turn left/right |
| `testBodySmile()` | Smile on body meshes only |

---

## 10. Hair & Eyebrow Control

### Color & Outline

```typescript
setHairColor(
  mesh: THREE.Mesh,
  baseColor: string,
  emissive: string,
  emissiveIntensity: number,
  isEyebrow?: boolean
): void

setHairOutline(
  mesh: THREE.Mesh,
  show: boolean,
  color: string,
  opacity: number
): THREE.LineSegments | undefined
```

---

### Registration & State

```typescript
registerHairObjects(objects: THREE.Object3D[]): Array<{
  name: string;
  isEyebrow: boolean;
  isMesh: boolean;
}>

applyHairStateToObject(
  objectName: string,
  state: {
    color: { baseColor: string; emissive: string; emissiveIntensity: number };
    outline: { show: boolean; color: string; opacity: number };
    visible?: boolean;
    scale?: number;
    position?: [number, number, number];
    isEyebrow?: boolean;
  }
): THREE.LineSegments | undefined
```

---

### Geometry & Morphs

```typescript
getHairGeometry(objectName: string): {
  geometry: THREE.BufferGeometry | null;
  originalPositions: Float32Array | null;
  vertexCount: number;
} | null

getHairMorphTargets(objectName: string): string[]

getHeadRotation(): { yaw: number; pitch: number; roll: number }
```

---

### Vertex Effects

```typescript
applyHairVertexDisplacement(
  objectName: string,
  displacementFn: (vertex: THREE.Vector3, index: number) => THREE.Vector3,
  blend?: number
): boolean

applyHairWaveEffect(objectName: string, options?: {
  amplitude?: number;
  frequency?: number;
  wavelength?: number;
  direction?: THREE.Vector3;
  time?: number;
  blend?: number;
}): boolean

applyHairGravityEffect(objectName: string, options?: {
  strength?: number;
  direction?: THREE.Vector3;
  falloff?: number;
  pivot?: THREE.Vector3;
  blend?: number;
}): boolean

applyHairCurlEffect(objectName: string, options?: {
  intensity?: number;
  radius?: number;
  axis?: THREE.Vector3;
  center?: THREE.Vector3;
  blend?: number;
}): boolean

resetHairGeometry(objectName: string): boolean

applyHairVertexShader(objectName: string, shaderCode: string): boolean
```

---

## 10.5 Render Order System

Hair and eyebrow meshes require specific render order to layer correctly over the face and eyes.

### Render Order Hierarchy

| Mesh Type | renderOrder | Description |
|-----------|-------------|-------------|
| Eyes/Cornea | 0 (default) | Render first |
| Face/Body | 0 (default) | Render with eyes |
| Eyebrows | 0 | Render after face |
| Hair | 1 | Render last (on top) |

### How It Works

Render order is set automatically during `registerHairObjects()`:

```typescript
// In registerHairObjects()
mesh.renderOrder = isEyebrow ? 0 : 1;
```

And maintained when hair color is updated via `setHairColor()`.

### Known Issue: Eyes Showing Through Hair

If eyes (white sclera) appear to render on top of hair, this is a render order or depth buffer issue. The fix involves ensuring:

1. Eye meshes (`CC_Base_Eye`, `CC_Base_Eye_1`) have `renderOrder = 0`
2. Cornea meshes (`CC_Base_Cornea`, `CC_Base_Cornea_1`) have proper transparency settings
3. Hair meshes have `renderOrder = 1` (set during registration)

**Eye Mesh Names:**
- `CC_Base_Eye` - Left eyeball
- `CC_Base_Eye_1` - Right eyeball
- `CC_Base_Cornea` - Left cornea (transparent)
- `CC_Base_Cornea_1` - Right cornea (transparent)

**Debug:** Check render order in browser console:
```javascript
model.traverse(obj => {
  if (obj.isMesh) console.log(obj.name, 'renderOrder:', obj.renderOrder);
});
```

---

## 11. Mouse Tracking (Deprecated)

> **Note:** Consider using `EyeHeadTrackingService` instead, which provides more sophisticated smoothing and priority handling.

```typescript
enableMouseTracking(): void
disableMouseTracking(): void
updateMouseTracking(): void  // Instant (not recommended)
```

Mouse tracking is automatically updated in `update()` when enabled via `updateMouseTrackingSmooth()`.

---

## 12. Skybox Control

### `setSkyboxRotation(degrees)`

Rotate skybox (0-360 degrees).

```typescript
setSkyboxRotation(degrees: number): void
```

---

### `setSkyboxBlur(blur)`

Set skybox blur (0-1).

```typescript
setSkyboxBlur(blur: number): void
```

---

### `setSkyboxIntensity(intensity)`

Set skybox intensity (0-2).

```typescript
setSkyboxIntensity(intensity: number): void
```

---

### `isSkyboxReady()`

Check if skybox is initialized.

```typescript
isSkyboxReady(): boolean
```

---

## 13. Camera/Gaze Utilities

### `getCameraOffset(cameraPosition?, characterPosition?)`

Calculate offset for perspective-correct eye contact.

```typescript
getCameraOffset(
  cameraPosition?: THREE.Vector3,
  characterPosition?: THREE.Vector3
): { x: number; y: number }
```

Returns normalized offset where x/y are in range -1 to +1.

---

## 14. Exported Constants & Functions

### Constants

| Constant | Type | Purpose |
|----------|------|---------|
| `BONE_DRIVEN_AUS` | `Set<number>` | AU IDs with bone bindings |
| `EYE_AXIS` | `{ yaw, pitch }` | Eye rotation axis config for CC rigs |
| `MIXED_AUS` | `Set<number>` | AUs with both morphs and bones |
| `AU_TO_COMPOSITE_MAP` | `Map<number, {...}>` | AU ID → composite rotation info |
| `CONTINUUM_PAIRS` | `Array<{...}>` | Derived continuum pairs for UI |

### Functions

```typescript
hasLeftRightMorphs(auId: number): boolean
```

Check if an AU has separate left/right morphs (e.g., `Mouth_Smile_L` / `Mouth_Smile_R`).

---

## 15. Private State Reference

| Property | Type | Purpose |
|----------|------|---------|
| `auValues` | `Record<number, number>` | Current AU values |
| `transitions` | `Map<string, Transition>` | Active lerp transitions |
| `rotations` | `Record<string, {pitch, yaw, roll}>` | Composite bone rotation state |
| `pendingCompositeNodes` | `Set<string>` | Bones needing rotation update |
| `meshes` | `THREE.Mesh[]` | Registered morph meshes |
| `model` | `THREE.Object3D \| null` | Root model object |
| `bones` | `ResolvedBones` | Resolved bone references |
| `mixWeights` | `Record<number, number>` | AU mix weight overrides |
| `bakedMixer` | `THREE.AnimationMixer \| null` | GLB animation mixer |
| `morphMixer` | `THREE.AnimationMixer \| null` | Programmatic animation mixer |
| `scene` | `THREE.Scene \| null` | Scene reference |
| `skyboxTexture` | `THREE.Texture \| null` | Skybox texture reference |

---

## Integration Points

### ThreeContext

The engine is driven by [threeContext.tsx](../src/context/threeContext.tsx):

```typescript
const tick = () => {
  const dt = clock.getDelta();
  anim.step(dt);           // Animation scheduler
  engine.update(dt);       // EngineThree
  requestAnimationFrame(tick);
};
```

### AnimationScheduler

The [AnimationScheduler](../src/latticework/animation/animationScheduler.ts) uses engine methods via host bindings:

```typescript
const host = {
  transitionAU: (id, v, dur) => engine.transitionAU(id, v, dur),
  transitionMorph: (key, v, dur) => engine.transitionMorph(key, v, dur),
  transitionContinuum: (neg, pos, v, dur) => engine.transitionContinuum(neg, pos, v, dur),
  // ...
};
```

### EyeHeadTrackingService

The [EyeHeadTrackingService](../src/latticework/eyeHeadTracking/eyeHeadTrackingService.ts) can call engine methods directly:

```typescript
engine.transitionContinuum(61, 62, eyeYaw, eyeDuration);
engine.transitionContinuum(31, 32, headYaw, headDuration);
```
