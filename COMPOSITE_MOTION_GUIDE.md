# Composite Motion System - Complete Guide

## What is Composite Motion?

Composite motion combines **bone rotations** (skeletal movement) with **morphs** (blendshape deformations) to create realistic facial animation. It handles multi-axis movements like "eyes looking up and to the left" in a single coordinated operation.

## Why Composite Motion?

### The Problem

Facial movements aren't simple:
- **Eyes looking right**: Eyeballs rotate (bone) + eyelids adjust (morph)
- **Head turning left**: Head bone rotates (bone) + neck skin stretches (morph)
- **Jaw opening**: Jaw bone rotates (bone) + mouth cavity forms (morph)

Applying bones and morphs separately causes:
- ❌ Timing mismatches
- ❌ Axis stomping (yaw overwrites pitch)
- ❌ Incorrect blending between movement types

### The Solution

`applyCompositeMotion()` orchestrates both systems simultaneously:
- ✅ Bones and morphs update together (no timing issues)
- ✅ Multi-axis rotations combine correctly (yaw + pitch + roll)
- ✅ Mix weights control morph overlay intensity

## Architecture Overview

```
User Input (e.g., "eyes right")
        ↓
setEyesHorizontal(0.5)
        ↓
Update state: currentEyeYaw = 0.5
        ↓
applyEyeComposite(yaw=0.5, pitch=currentEyePitch)
        ↓
applyCompositeMotion(baseYawId=61, basePitchId=63, yaw=0.5, pitch=currentEyePitch, downId=64)
        ↓
        ├─→ applyBoneComposite() → Rotate eyeball bones
        └─→ applyMorphs() → Apply eyelid morphs (scaled by mixWeight)
        ↓
3D Model Updated
```

## Core Concepts

### 1. Axes of Movement

Each composite control has up to 3 axes:

| Axis | Description | Example (Eyes) |
|------|-------------|----------------|
| **Yaw** | Horizontal rotation (left ↔ right) | Eyes looking left/right |
| **Pitch** | Vertical rotation (up ↔ down) | Eyes looking up/down |
| **Roll** | Tilt rotation | Head tilting ear to shoulder |

### 2. AU Pairs for Continuum

Each axis is controlled by an AU pair defining the continuum:

| Body Part | Axis | Negative AU | Positive AU | Continuum Range |
|-----------|------|-------------|-------------|-----------------|
| Eyes | Yaw | 61 (left) | 62 (right) | -1.0 to +1.0 |
| Eyes | Pitch | 64 (down) | 63 (up) | -1.0 to +1.0 |
| Head | Yaw | 31 (left) | 32 (right) | -1.0 to +1.0 |
| Head | Pitch | 54 (down) | 33 (up) | -1.0 to +1.0 |
| Head | Roll | 55 (tilt left) | 56 (tilt right) | -1.0 to +1.0 |
| Jaw | Yaw | 30 (left) | 35 (right) | -1.0 to +1.0 |
| Tongue | Yaw | 39 (left) | 40 (right) | -1.0 to +1.0 |
| Tongue | Pitch | 38 (down) | 37 (up) | -1.0 to +1.0 |

### 3. State Tracking

The engine maintains current position for each axis to prevent axis stomping:

```typescript
private currentEyeYaw = 0;      // [-1, 1]
private currentEyePitch = 0;    // [-1, 1]
private currentHeadYaw = 0;     // [-1, 1]
private currentHeadPitch = 0;   // [-1, 1]
private currentHeadRoll = 0;    // [-1, 1]
```

**Why**: When you update pitch, we need to remember the current yaw value to apply both rotations together.

### 4. Bone Rotation State

Separate from AU values, bones track rotation per axis:

```typescript
private boneRotations: Record<BoneNodeKey, { pitch: number; yaw: number; roll: number }> = {
  HEAD: { pitch: 0, yaw: 0, roll: 0 },
  EYE_L: { pitch: 0, yaw: 0, roll: 0 },
  EYE_R: { pitch: 0, yaw: 0, roll: 0 },
  JAW: { pitch: 0, yaw: 0, roll: 0 },
  TONGUE: { pitch: 0, yaw: 0, roll: 0 }
};
```

**Why**: Allows independent control of each axis without overwriting others.

## The Flow in Detail

### Example: Eyes Looking Up and to the Right

```typescript
// 1. User drags continuum slider
setEyesHorizontal(0.7);  // Right
setEyesVertical(0.5);    // Up

// 2. Each setter updates state and calls composite
setEyesHorizontal(v) {
  this.currentEyeYaw = 0.7;
  this.applyEyeComposite(this.currentEyeYaw, this.currentEyePitch);
}

setEyesVertical(v) {
  this.currentEyePitch = 0.5;
  this.applyEyeComposite(this.currentEyeYaw, this.currentEyePitch);
}

// 3. Composite method calls core motion handler
applyEyeComposite(yaw, pitch) {
  this.applyCompositeMotion(61, 63, yaw, pitch, 64);
}

// 4. Core motion handler applies BOTH bones and morphs
applyCompositeMotion(baseYawId=61, basePitchId=63, yaw=0.7, pitch=0.5, downId=64) {
  const yawMix = this.getAUMixWeight(61);    // e.g., 0.5
  const pitchMix = this.getAUMixWeight(63);  // e.g., 0.5

  // Bones: ALWAYS full intensity
  this.applyBoneComposite(
    { leftId: 61, rightId: 62, upId: 63, downId: 64 },
    { yaw: -0.7, pitch: 0.5 }  // Note: yaw reversed for bones
  );

  // Morphs: scaled by mix weight
  this.applyMorphs(['Eye_L_Look_R', 'Eye_R_Look_R'], 0.7 * 0.5);  // Right * mixWeight
  this.applyMorphs(['Eye_L_Look_Up', 'Eye_R_Look_Up'], 0.5 * 0.5); // Up * mixWeight
}

// 5. Bone composite combines rotations into single quaternion
applyBoneComposite() {
  // For each eye bone:
  //   - Apply yaw rotation: 0.7 * 25° * -1 = -17.5° on Y axis
  //   - Apply pitch rotation: 0.5 * 20° = 10° on X axis
  //   - Combine into single quaternion
  //   - Set bone rotation
}
```

### Result

- **Eyeballs**: Rotated 17.5° right and 10° up (bone)
- **Eyelids**: Subtle shape change following the gaze (morph at 50% due to mixWeight=0.5)

## Adding New Composite Controls

### Step-by-Step Guide

Let's add a new composite control for a body part (e.g., "Spine Bend"):

#### 1. Define AU Mappings

In [shapeDict.ts](src/engine/arkit/shapeDict.ts):

```typescript
// Add to AU_TO_MORPHS
export const AU_TO_MORPHS: Record<number, string[]> = {
  // ... existing AUs

  // Spine bend (example AU numbers)
  71: ['Spine_Bend_Forward'],
  72: ['Spine_Bend_Back'],
  73: ['Spine_Bend_Left'],
  74: ['Spine_Bend_Right'],
};

// Add to BONE_AU_TO_BINDINGS
export const BONE_AU_TO_BINDINGS: Record<number, BoneBinding[]> = {
  // ... existing AUs

  // Spine yaw (left/right rotation)
  73: [{ node: 'SPINE', channel: 'ry', scale: -1, maxDegrees: 30 }],
  74: [{ node: 'SPINE', channel: 'ry', scale: 1, maxDegrees: 30 }],

  // Spine pitch (forward/back bend)
  71: [{ node: 'SPINE', channel: 'rx', scale: 1, maxDegrees: 45 }],
  72: [{ node: 'SPINE', channel: 'rx', scale: -1, maxDegrees: 45 }],
};

// Add to MIXED_AUS if using both morphs and bones
export const MIXED_AUS = new Set([
  // ... existing
  71, 72, 73, 74  // Spine
]);

// Add default mix weights
export const AU_MIX_DEFAULTS: Record<number, number> = {
  // ... existing
  71: 0.6,  // Spine
  72: 0.6,
  73: 0.6,
  74: 0.6,
};
```

#### 2. Add Bone Candidate

```typescript
// In shapeDict.ts bone candidates section
export const SPINE_BONE_CANDIDATES = [
  'CC_Base_Spine01',
  'Spine1',
  'Spine_01',
  'spine_01',
  'mixamorig:Spine1'
];
```

#### 3. Add to Composite Rotation Config

```typescript
// In shapeDict.ts COMPOSITE_ROTATIONS array
export const COMPOSITE_ROTATIONS = [
  // ... existing configs

  {
    node: 'SPINE',
    yaw: {
      aus: [73, 74],      // left, right
      axis: 'ry' as const,
      negative: 73,       // left
      positive: 74        // right
    },
    pitch: {
      aus: [71, 72],      // forward, back
      axis: 'rx' as const,
      negative: 71,       // forward
      positive: 72        // back
    }
  }
];
```

#### 4. Add State Tracking in EngineThree

In [EngineThree.ts](src/engine/EngineThree.ts):

```typescript
// Add state variables
private currentSpineYaw = 0;
private currentSpinePitch = 0;

// Add to bone rotations
private boneRotations = {
  // ... existing
  SPINE: { pitch: 0, yaw: 0, roll: 0 }
};
```

#### 5. Add Setter Methods

```typescript
/** Spine — horizontal continuum: left(73) ⟷ right(74) */
setSpineHorizontal = (v: number) => {
  const x = Math.max(-1, Math.min(1, v ?? 0));
  this.currentSpineYaw = x;
  this.applySpineComposite(this.currentSpineYaw, this.currentSpinePitch);
};

/** Spine — vertical continuum: forward(71) ⟷ back(72) */
setSpineVertical = (v: number) => {
  const y = Math.max(-1, Math.min(1, v ?? 0));
  this.currentSpinePitch = y;
  this.applySpineComposite(this.currentSpineYaw, this.currentSpinePitch);
};
```

#### 6. Add Composite Method

```typescript
public applySpineComposite(yaw: number, pitch: number) {
  this.applyCompositeMotion(73, 71, yaw, pitch, 72);
}
```

#### 7. Add to Bone Resolution

```typescript
// In resolveBones method
resolveBones(model: THREE.Object3D): ResolvedBones {
  // ... existing

  const spine = findBone(SPINE_BONE_CANDIDATES);

  return {
    // ... existing
    SPINE: spine
  };
}

// Update ResolvedBones type
type ResolvedBones = {
  // ... existing
  SPINE: NodeBase | null;
};
```

#### 8. Update reapplyComposites

```typescript
private reapplyComposites() {
  // ... existing
  this.applySpineComposite(this.currentSpineYaw, this.currentSpinePitch);
}
```

#### 9. Add Transition Methods (Optional)

```typescript
transitionSpineHorizontal = (targetValue: number, durationMs: number = 200) => {
  const target = Math.max(-1, Math.min(1, targetValue ?? 0));
  const from = this.currentSpineYaw;
  this.transitions = this.transitions.filter(t => t.id !== 'spineYaw');
  this.transitions.push({
    kind: 'au',
    id: 'spineYaw',
    from,
    to: target,
    dur: durationMs,
    elapsed: 0,
    ease: this.easeInOutQuad,
    callback: (v: number) => this.setSpineHorizontal(v)
  } as any);
};

transitionSpineVertical = (targetValue: number, durationMs: number = 200) => {
  const target = Math.max(-1, Math.min(1, targetValue ?? 0));
  const from = this.currentSpinePitch;
  this.transitions = this.transitions.filter(t => t.id !== 'spinePitch');
  this.transitions.push({
    kind: 'au',
    id: 'spinePitch',
    from,
    to: target,
    dur: durationMs,
    elapsed: 0,
    ease: this.easeInOutQuad,
    callback: (v: number) => this.setSpineVertical(v)
  } as any);
};
```

#### 10. Expose in Engine Types

In [EngineThree.types.ts](src/engine/EngineThree.types.ts):

```typescript
export interface IEngineThree {
  // ... existing

  // Spine composite methods
  setSpineHorizontal?: (value: number) => void;
  setSpineVertical?: (value: number) => void;
  transitionSpineHorizontal?: (value: number, durationMs?: number) => void;
  transitionSpineVertical?: (value: number, durationMs?: number) => void;
}
```

#### 11. Add to Context Hosts

In [threeContext.tsx](src/context/threeContext.tsx):

```typescript
const host = {
  // ... existing

  // Spine composite methods
  setSpineHorizontal: (v: number) => engineRef.current!.setSpineHorizontal?.(v),
  setSpineVertical: (v: number) => engineRef.current!.setSpineVertical?.(v),
  transitionSpineHorizontal: (v: number, dur?: number) => engineRef.current!.transitionSpineHorizontal?.(v, dur),
  transitionSpineVertical: (v: number, dur?: number) => engineRef.current!.transitionSpineVertical?.(v, dur),
};
```

#### 12. Add UI Component (Optional)

Create a continuum slider in the UI that calls the new methods.

## Common Patterns

### Pattern 1: Simple 2-Axis Control (Yaw + Pitch)

**Use case**: Eyes, head (without roll)

```typescript
setEyesHorizontal(v) {
  this.currentEyeYaw = v;
  this.applyEyeComposite(this.currentEyeYaw, this.currentEyePitch);
}

setEyesVertical(v) {
  this.currentEyePitch = v;
  this.applyEyeComposite(this.currentEyeYaw, this.currentEyePitch);
}

applyEyeComposite(yaw, pitch) {
  this.applyCompositeMotion(61, 63, yaw, pitch, 64);
}
```

### Pattern 2: 3-Axis Control (Yaw + Pitch + Roll)

**Use case**: Head (with tilt)

```typescript
setHeadHorizontal(v) {
  this.currentHeadYaw = v;
  this.applyHeadComposite(this.currentHeadYaw, this.currentHeadPitch, this.currentHeadRoll);
}

setHeadVertical(v) {
  this.currentHeadPitch = v;
  this.applyHeadComposite(this.currentHeadYaw, this.currentHeadPitch, this.currentHeadRoll);
}

setHeadRoll(v) {
  this.currentHeadRoll = v;
  this.applyHeadComposite(this.currentHeadYaw, this.currentHeadPitch, this.currentHeadRoll);
}

applyHeadComposite(yaw, pitch, roll) {
  this.applyCompositeMotion(31, 33, yaw, pitch, 54, undefined, { left: 55, right: 56 }, roll);
}
```

### Pattern 3: Single Axis Control

**Use case**: Jaw drop (vertical only)

```typescript
setJawVertical(v) {
  // For jaw, we only have vertical (open/close)
  // AUs 25, 26, 27 all map to jaw drop with different intensities
  // We use AU 26 as the base
  if (v >= 0) {
    this.setAU(26, v);
  } else {
    this.setAU(26, 0);
  }
}
```

## Key Takeaways for Developers

### DO:
- ✅ Always apply bones at full intensity
- ✅ Scale morphs by mix weight
- ✅ Use state variables (currentEyeYaw, etc.) to preserve multi-axis positions
- ✅ Call `applyCompositeMotion()` for coordinated bone + morph updates
- ✅ Add to `MIXED_AUS` set if AU controls both bones and morphs
- ✅ Define default mix weights in `AU_MIX_DEFAULTS`
- ✅ Update `reapplyComposites()` when adding new composite controls

### DON'T:
- ❌ Scale bones by mix weight
- ❌ Use `(1.0 - mixWeight)` for morphs
- ❌ Apply bones and morphs in separate calls (causes timing issues)
- ❌ Use `auValues` directly in `reapplyComposites()` (use state variables)
- ❌ Forget to update bone rotation state before calling `applyCompositeRotation()`

## Debugging Checklist

When composite motion isn't working:

1. **Check bone resolution**: Console log should show bone found (e.g., "EYE_L bone resolved: CC_Base_L_Eye")
2. **Check AU mappings**: Verify AU_TO_MORPHS and BONE_AU_TO_BINDINGS entries exist
3. **Check mix weight**: Use `engine.getAUMixWeight(auId)` to verify value
4. **Check state variables**: Add logging to setter methods to see if state updates
5. **Check composite call**: Verify `applyCompositeMotion()` is being called with correct AU IDs
6. **Check axis order**: For bones, rotations apply in order: yaw (Y), pitch (X), roll (Z)
7. **Check scale/polarity**: Bones may need negative scale to match morph direction

## See Also

- [MIX_WEIGHT_SYSTEM.md](MIX_WEIGHT_SYSTEM.md) - Mix weight behavior details
- [src/engine/README.md](src/engine/README.md) - Full engine documentation
- [src/engine/arkit/shapeDict.ts](src/engine/arkit/shapeDict.ts) - AU mappings and configurations
