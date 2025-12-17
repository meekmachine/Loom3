# Transition & Animation System Refactor

> **See also:** [ENGINE_THREE_API.md](./ENGINE_THREE_API.md) for complete API documentation.

## Overview

This document catalogs the current animation and transition systems in EngineThree and related services to identify consolidation opportunities.

## Cleanup Completed

- **Removed legacy "driver" functions:** `getAUDriverKey()` and `getMorphDriverKey()` have been removed. Transition keys are now inlined directly as `au_${id}` and `morph_${key}`.
- **No dummy Object3D models exist** - The transition system uses a clean Map-based lerp implementation.

---

## NEW: Optimized Transition System

### Problem with Original `transitionAU`

The original `transitionAU` method calls `setAU()` every tick, which does expensive lookups:

```
Each tick: setAU() → lookup AU_TO_MORPHS → iterate meshes → find morph index → apply
```

### Solution: `transitionAUOptimized`

The optimized version pre-resolves all targets at transition creation time:

```typescript
// At creation time, resolve everything ONCE:
transitionAUOptimized(31, 0.5, 300)  // Head turn left

resolveAUTargets(31) → {
  morphTargets: [
    { mesh: 'CC_Base_Body_1', morphIdx: 42, key: 'Head_Turn_L' },
    // ... all body meshes with direct index references
  ],
  boneTargets: [
    { bone: this.bones.HEAD, axis: 'ry', scale: 1, maxDegrees: 30 }
  ],
  mixWeight: 0.7  // from AU_MIX_DEFAULTS
}

// Each tick just applies raw values directly:
for (const { mesh, index } of resolved.morphTargets) {
  mesh.morphTargetInfluences[index] = morphValue;  // Direct array access!
}
```

### New Types

```typescript
type MorphTarget = {
  mesh: THREE.Mesh;
  index: number;
  key: string;
};

type BoneTarget = {
  bone: NodeBase;
  node: string;
  channel: 'rx' | 'ry' | 'rz' | 'tx' | 'ty' | 'tz';
  scale: number;
  maxDegrees?: number;
  maxUnits?: number;
};

type ResolvedAUTargets = {
  auId: number;
  morphTargets: MorphTarget[];
  boneTargets: BoneTarget[];
  mixWeight: number;
  compositeInfo: { nodes: string[]; axis: 'pitch' | 'yaw' | 'roll' } | null;
};
```

### New Methods

| Method | Purpose |
|--------|---------|
| `buildMorphIndexCache()` | Called in `onReady()`, builds morph key → mesh/index lookup |
| `resolveAUTargets(auId)` | Pre-resolves morphs, bones, and mix weight for an AU |
| `transitionAUOptimized(id, to, durationMs)` | Optimized AU transition with pre-resolved targets |
| `applyBoneTargetDirect(target, value)` | Direct bone rotation for non-composite bones |

### Test Methods

```typescript
engine.benchmarkTransitions(100)  // Compare performance
engine.testOptimizedSmile()       // Visual test
engine.testOptimizedHeadTurn()    // Visual test
```

### When to Use

- Use `transitionAUOptimized` for performance-critical paths (eye/head tracking)
- Use `transitionAU` for simple one-off transitions where overhead doesn't matter

---

## Current Animation/Transition Components in EngineThree

### 1. Unified Transition System (Lines 100-369)

**Location:** `EngineThree.ts:100-369`

The primary transition system using a `Map<string, Transition>` for lerp-based animations.

```typescript
type Transition = {
  key: string;
  from: number;
  to: number;
  duration: number;      // seconds
  elapsed: number;       // seconds
  apply: (value: number) => void;
  easing: (t: number) => number;
  resolve?: () => void;
};
```

**Key Methods:**
- `transitionAU(id, to, durationMs)` - Line 160
- `transitionMorph(key, to, durationMs)` - Line 175
- `transitionContinuum(negAU, posAU, value, durationMs)` - Line 228
- `addTransition(key, from, to, durationSec, apply, easing)` - Line 311 (private)
- `tickTransitions(dt)` - Line 283 (private, called from update())
- `clearTransitions()` - Line 346
- `pause()` / `resume()` / `getPaused()` - Lines 352-364

**Transition Keys:** Simple string identifiers like `au_${id}` and `morph_${key}` used to track active transitions in the Map.

**Note:** Legacy "driver" helper functions (`getAUDriverKey`, `getMorphDriverKey`) have been removed - keys are now inlined directly.

---

### 2. Baked Animation Mixer (Lines 120-583)

**Location:** `EngineThree.ts:120-583`

Pre-authored GLB animations (e.g., idle breathing) using Three.js AnimationMixer.

**Private State:**
```typescript
private bakedMixer: THREE.AnimationMixer | null = null;
private bakedActions = new Map<string, THREE.AnimationAction>();
private bakedClips: THREE.AnimationClip[] = [];
private bakedPaused = true;
private bakedCurrent: string | null = null;
```

**Key Methods:**
- `getBakedClipNames()` - Line 533
- `getCurrentBakedClip()` - Line 535
- `setBakedClip(name)` - Line 537
- `setBakedPlayback(play)` - Line 556
- `resetBakedClip()` - Line 575
- `getBakedPlaybackState()` - Line 583

**Updated in:** `update(dt)` via `this.bakedMixer.update(dtSeconds)` - Line 252

---

### 3. Morph Animation Mixer (Lines 1571-1750)

**Location:** `EngineThree.ts:1571-1750`

Programmatic morph target animations using Three.js AnimationMixer.

**Private State:**
```typescript
private morphMixer: THREE.AnimationMixer | null = null;
private morphActions = new Map<string, THREE.AnimationAction>();
```

**Key Methods:**
- `initMorphMixer()` - Line 1583
- `createMorphClip(name, morphKey, keyframes, meshName?)` - Line 1601
- `createMultiMorphClip(name, morphAnimations)` - Line 1648
- `playMorphClip(clip, options)` - Line 1689
- `stopMorphClip(clipName, fadeOut)` - Line 1725
- `stopAllMorphClips()` - Line 1739
- `updateMorphMixer(deltaSeconds)` - Line 1748 (standalone, but also called in update())

**Updated in:** `update(dt)` via `this.morphMixer.update(dtSeconds)` - Line 255

**Test Functions:**
- `testSmileAnimation()` - Line 1760
- `testBlinkAnimation()` - Line 1793
- `testHeadAnimation()` - Line 1824
- `testBodySmile()` - Line 1866

---

### 4. Composite Bone Rotation System (Lines 134-940)

**Location:** `EngineThree.ts:134-940`

Handles composite rotations for bones like JAW, HEAD, EYE_L, EYE_R, TONGUE.

**Private State:**
```typescript
private rotations: Record<string, { pitch: number; yaw: number; roll: number }> = {
  JAW: { pitch: 0, yaw: 0, roll: 0 },
  HEAD: { pitch: 0, yaw: 0, roll: 0 },
  EYE_L: { pitch: 0, yaw: 0, roll: 0 },
  EYE_R: { pitch: 0, yaw: 0, roll: 0 },
  TONGUE: { pitch: 0, yaw: 0, roll: 0 }
};
private pendingCompositeNodes = new Set<string>();
```

**Key Methods:**
- `updateBoneRotation(nodeKey, axis, value)` - Line 829 (private)
- `applyCompositeRotation(nodeKey)` - Line 841 (private)
- `flushPendingComposites()` - Line 270 (private, called from update())

**Flow:**
1. `setAU()` detects composite AUs via `AU_TO_COMPOSITE_MAP`
2. Updates `this.rotations[nodeKey][axis]`
3. Adds node to `pendingCompositeNodes`
4. `update()` calls `flushPendingComposites()` to apply all pending rotations

---

### 5. Mouse Tracking System (Lines 1927-2097)

**Location:** `EngineThree.ts:1927-2097`

Character follows mouse cursor with head, neck, and eyes.

**Private State:**
```typescript
private mouseTrackingEnabled = false;
private mousePosition = { x: 0.5, y: 0.5 };
private mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
private targetRotations = { head: {x,y}, neck: {x,y}, eyes: {x,y} };
private currentRotations = { head: {x,y}, neck: {x,y}, eyes: {x,y} };
```

**Key Methods:**
- `enableMouseTracking()` - Line 1941
- `disableMouseTracking()` - Line 1958
- `updateMouseTracking()` - Line 1991 (instant application)
- `updateMouseTrackingSmooth(lerpFactor)` - Line 2048 (smooth lerp)

**Updated in:** `update(dt)` calls `updateMouseTrackingSmooth(0.08)` when enabled - Line 264

---

### 6. Central Update Loop (Lines 247-267)

**Location:** `EngineThree.ts:247-267`

```typescript
update(deltaSeconds: number) {
  const dtSeconds = Math.max(0, deltaSeconds || 0);
  if (dtSeconds <= 0 || this.isPaused) return;

  // 1. Baked clip animations
  if (this.bakedMixer && !this.bakedPaused) this.bakedMixer.update(dtSeconds);

  // 2. Morph target animations
  if (this.morphMixer) this.morphMixer.update(dtSeconds);

  // 3. Unified transitions (AU, morph, composite movements)
  this.tickTransitions(dtSeconds);

  // 4. Flush pending composite rotations
  this.flushPendingComposites();

  // 5. Mouse tracking interpolation
  if (this.rigReady && this.mouseTrackingEnabled) {
    this.updateMouseTrackingSmooth(0.08);
  }
}
```

---

## RAF Loops in the Codebase

### Primary RAF Loop: ThreeContext (threeContext.tsx:78-94)

```typescript
const tick = () => {
  const dt = clockRef.current!.getDelta();
  // 1. Animation agency step
  animRef.current?.step?.(dt);
  // 2. Frame listeners
  listenersRef.current.forEach((fn) => fn(dt));
  // 3. EngineThree update
  engineRef.current!.update(dt);
  rafIdRef.current = requestAnimationFrame(tick);
};
```

**This is the single source of truth for timing.** All other systems receive `dt` from this loop.

### Legacy/Unused RAF Reference (animationService.ts:61-127)

The `_UnusedMinimalScheduler` class contains a self-contained RAF loop but is marked as "not used". It's kept for reference only.

---

## Animation Agency Architecture

### AnimationScheduler (animationScheduler.ts)

**Purpose:** Schedules and samples animation snippets (keyframe curves) over time.

**Key Characteristics:**
- Does NOT own its own RAF loop
- Driven externally via `step(dtSec)` called from ThreeContext
- Maintains playback time (`playTimeSec`)
- Builds target maps from active snippets
- Handles continuum pairs via `applyContinuumTargets()`

**Host Capabilities Interface:**
```typescript
type HostCaps = {
  applyAU?: (id: number, v: number) => void;
  setMorph?: (key: string, v: number) => void;
  transitionAU?: (id: number, v: number, dur?: number) => void;
  transitionMorph?: (key: string, v: number, dur?: number) => void;
  transitionContinuum?: (negAU: number, posAU: number, v: number, dur?: number) => void;
  onSnippetEnd?: (name: string) => void;
};
```

### AnimationMachine (animationMachine.ts)

**Purpose:** XState machine managing snippet lifecycle (loading, playing, pausing, stopping).

**States:** `stopped` → `playing` ↔ `paused`

---

## EyeHeadTrackingService (eyeHeadTrackingService.ts)

**Purpose:** Coordinates eye and head movements following gaze targets.

**Animation Integration:**
- Can use Animation Agency (`useAnimationAgency: true`) via its own `EyeHeadTrackingScheduler`
- Or direct engine calls (`transitionContinuum`)

**No RAF Loop:** Receives updates from setGazeTarget() calls triggered by mouse/webcam events.

---

## "Driver" / "Dummy" Analysis

### What Exists:

Transition keys are simple string identifiers (`au_${id}`, `morph_${key}`) used in the transition Map. These are **NOT dummy Object3D models**.

### What Was Removed:

Based on the ARCHITECTURE_REFACTOR.md mention:
> "EngineThree uses a hacky dummy Object3D/mixer system for some transitions"

This appears to have been **already removed**. The current transition system is a clean Map-based lerp implementation without any dummy objects.

---

## Identified Issues / Opportunities

### 1. Multiple Mixer Instances
- `bakedMixer` for GLB animations
- `morphMixer` for programmatic morph clips

**Consideration:** These serve different purposes (pre-authored vs dynamic). Could potentially consolidate but may not be worth the complexity.

### 2. Mouse Tracking Duplication
- EngineThree has its own mouse tracking system (Lines 1927-2097)
- EyeHeadTrackingService also handles mouse/webcam tracking

**Recommendation:** Deprecate EngineThree's mouse tracking in favor of EyeHeadTrackingService which has more sophisticated smoothing and priority handling.

### 3. Transition vs AnimationMixer

The system currently has two ways to animate morphs:
1. **Transitions** (`transitionMorph`) - Simple lerp, good for single values
2. **MorphMixer** (`playMorphClip`) - Keyframe-based, good for complex sequences

**Status:** This is reasonable separation of concerns.

### 4. Composite Rotation Deferred Application

The `pendingCompositeNodes` pattern (set in setAU, flushed in update) prevents rotation overwriting but adds complexity.

**Status:** Working as designed. Needed for multi-AU composite bones.

---

## Summary Table

| System | Location | Purpose | Has Own RAF? | Updated Via |
|--------|----------|---------|--------------|-------------|
| Unified Transitions | EngineThree:100-369 | AU/morph lerps | No | update() → tickTransitions() |
| Baked Mixer | EngineThree:120-583 | GLB animations | No | update() → mixer.update() |
| Morph Mixer | EngineThree:1571-1750 | Dynamic morph clips | No | update() → mixer.update() |
| Composite Rotations | EngineThree:134-940 | Bone rotation composition | No | update() → flushPendingComposites() |
| Mouse Tracking | EngineThree:1927-2097 | Follow cursor | No | update() → updateMouseTrackingSmooth() |
| Animation Scheduler | animationScheduler.ts | Snippet playback | No | ThreeContext → step(dt) |
| EyeHead Tracking | eyeHeadTrackingService.ts | Gaze control | No | Event-driven |
| **ThreeContext** | threeContext.tsx | **Central RAF** | **YES** | requestAnimationFrame |

---

## Recommendations

1. **Keep Central RAF in ThreeContext** - Already the single source of truth

2. **Consider Deprecating EngineThree Mouse Tracking** - EyeHeadTrackingService is more capable

3. **No Dummy Objects Found** - The "hacky dummy Object3D/mixer" mentioned in ARCHITECTURE_REFACTOR.md appears to have been removed

4. **Mixer Consolidation Not Recommended** - bakedMixer and morphMixer serve distinct purposes

5. **Current Architecture is Clean** - The transition system is well-organized with clear separation of concerns
