# EngineThree - Facial Animation Engine

This directory contains the core facial animation engine that drives morphs (blendshapes) and bones for realistic character animation.

## Architecture Overview

### Core Components

1. **EngineThree.ts** - Main engine class that orchestrates all facial animation
2. **arkit/shapeDict.ts** - Data mapping between Action Units (AUs) and 3D model targets

## Data Mapping (shapeDict.ts)

### AU to Morph Mapping

The `AU_TO_MORPHS` dictionary maps FACS (Facial Action Coding System) Action Unit IDs to ARKit/Character Creator blendshape names:

```typescript
AU_TO_MORPHS = {
  61: ['Eye_L_Look_L', 'Eye_R_Look_L'],  // Eyes look left
  62: ['Eye_L_Look_R', 'Eye_R_Look_R'],  // Eyes look right
  63: ['Eye_L_Look_Up', 'Eye_R_Look_Up'], // Eyes look up
  64: ['Eye_L_Look_Down', 'Eye_R_Look_Down'], // Eyes look down
  // ... etc
}
```

### Bone Bindings

The `BONE_AU_TO_BINDINGS` dictionary maps AU IDs to bone transformations:

```typescript
BONE_AU_TO_BINDINGS = {
  61: [
    { node: 'EYE_L', channel: 'ry', scale: -1, maxDegrees: 25 },
    { node: 'EYE_R', channel: 'ry', scale: -1, maxDegrees: 25 }
  ],
  // ... etc
}
```

**Channels:**
- `rx` - Rotation around X axis (pitch/vertical)
- `ry` - Rotation around Y axis (yaw/horizontal)
- `rz` - Rotation around Z axis (roll/tilt)
- `tx`, `ty`, `tz` - Translation along X, Y, Z axes

### Mixed AUs

Some AUs control both morphs AND bones simultaneously:

```typescript
MIXED_AUS = new Set([31, 32, 33, 54, 55, 56, 61, 62, 63, 64, 26]);
```

These AUs support **blend weights** (mix ratio) to control the balance between morph and bone animation:
- `0.0` = Pure bone movement (no morph overlay)
- `1.0` = Full bone + full morph overlay (default)

## Engine Implementation (EngineThree.ts)

### Key Methods

#### High-Level Continuum Controls

These are the primary methods used by UI components:

```typescript
setEyesHorizontal(v: number)   // v ∈ [-1, 1]: left ↔ right
setEyesVertical(v: number)     // v ∈ [-1, 1]: down ↔ up
setHeadHorizontal(v: number)   // v ∈ [-1, 1]: left ↔ right
setHeadVertical(v: number)     // v ∈ [-1, 1]: down ↔ up
setHeadTilt(v: number)         // v ∈ [-1, 1]: left ↔ right
```

#### Mix Weight Control

Control the morph/bone blend ratio for mixed AUs:

```typescript
setAUMixWeight(id: number, weight: number)  // weight ∈ [0, 1]
getAUMixWeight(id: number): number
```

### Core Animation Flow

```
UI Input
  ↓
setEyesHorizontal(v) / setHeadVertical(v) / etc
  ↓
Update tracked state (currentEyeYaw, currentHeadPitch, etc)
  ↓
applyEyeComposite() / applyHeadComposite()
  ↓
applyCompositeMotion(baseYawId, basePitchId, yaw, pitch, ...)
  ↓
┌─────────────────┬─────────────────┐
│  applyBoneComposite()  │  applyMorphs()  │
│  - Combines multi-axis │  - Scaled by    │
│    bone rotations      │    mix weight   │
│  - Always full intensity│  - Mix 0 → 1   │
└─────────────────┴─────────────────┘
  ↓
3D Model Updated
```

### Composite Motion System

The `applyCompositeMotion()` method handles multi-axis movement (e.g., eyes looking up-left):

**Base AU IDs (used for mix weight lookup):**
- Eyes: `baseYawId=61` (horizontal), `basePitchId=63` (vertical)
- Head: `baseYawId=31` (horizontal), `basePitchId=33` (vertical)

**Example:** Eyes looking up and to the right
1. `setEyesHorizontal(0.5)` → `currentEyeYaw = 0.5`
2. `setEyesVertical(0.8)` → `currentEyePitch = 0.8`
3. `applyEyeComposite(0.5, 0.8)` called
4. `applyCompositeMotion(61, 63, 0.5, 0.8, 64)` called
5. **Bones:** Both eyes rotate by `ry=0.5 * 25° = 12.5°` and `rx=0.8 * 20° = 16°`
6. **Morphs:** Applied based on mix weights from AU 61 (yaw) and AU 63 (pitch)

### Multi-Axis Preservation

The engine tracks current position state to prevent axis-stomping:

```typescript
private currentEyeYaw = 0;      // [-1, 1]
private currentEyePitch = 0;    // [-1, 1]
private currentHeadYaw = 0;     // [-1, 1]
private currentHeadPitch = 0;   // [-1, 1]
private currentHeadRoll = 0;    // [-1, 1]
```

When `reapplyComposites()` is called (e.g., after changing a mix weight), these state variables ensure the current position is preserved.

### Bone Composite System

The `applyBoneComposite()` method combines multiple bone rotations in a single pass to avoid overwriting:

**Problem it solves:** Sequential bone updates would overwrite each other
- ❌ `setRotationX(pitch)` then `setRotationY(yaw)` → only yaw applied
- ✓ `setRotation(pitch, yaw, roll)` → all axes applied simultaneously

The method accumulates rotation deltas per bone node, then applies them all at once.

### Eye Axis Overrides

For Character Creator rigs, eye bone channels are dynamically remapped:

```typescript
if (auId >= 61 && auId <= 62) {
  channel = EYE_AXIS.yaw;   // Horizontal uses ry or rz (rig-dependent)
} else if (auId >= 63 && auId <= 64) {
  channel = EYE_AXIS.pitch; // Vertical uses rx
}
```

This handles variations between different 3D model rigs.

## Common Patterns

### Adding a New AU

1. Add morph mapping to `AU_TO_MORPHS` in shapeDict.ts
2. (Optional) Add bone binding to `BONE_AU_TO_BINDINGS` if it controls bones
3. (Optional) Add to `MIXED_AUS` set if it controls both morphs and bones
4. Use `engine.setAU(id, value)` to control it

### Adding a New Continuum Control

1. Add state tracking variable (e.g., `private currentJawYaw = 0`)
2. Create setter method (e.g., `setJawHorizontal(v)`)
3. Create composite method (e.g., `applyJawComposite(yaw, pitch)`)
4. Call `applyCompositeMotion()` with appropriate base AU IDs
5. Update `reapplyComposites()` to include the new composite

## Debugging Tips

### Enable Console Logging

Uncomment logging in:
- `applyBoneComposite()` - See which AUs are being applied
- `applyCompositeMotion()` - See mix weight values
- `setAUMixWeight()` - Track mix weight changes

### Common Issues

**"Eyes/head not moving far enough"**
- Check `maxDegrees` in bone bindings (shapeDict.ts)
- Default: Eyes 25° horizontal, 20° vertical

**"Blend slider not working"**
- Verify ContinuumSlider is using correct base AU ID
- Check that mix weight is being read from the correct AU (baseYawId/basePitchId)

**"Position resets when adjusting blend slider"**
- Check that `reapplyComposites()` uses state variables, not `auValues`

**"Multi-axis movement resets one axis"**
- Verify that state variables are being updated (e.g., `currentEyeYaw`)
- Check that composite methods preserve other axes

## Transition System

EngineThree includes a built-in transition system for smooth AU/morph tweening:

```typescript
// Immediate update (no smoothing)
engine.setAU(12, 0.8);

// Smooth transition over 200ms (default)
engine.transitionAU(12, 0.8);

// Custom duration
engine.transitionAU(12, 0.8, 500);
```

### Transition Architecture

**External RAF Loop** (Recommended):
- ThreeProvider runs a single RAF loop ([threeContext.tsx:68-84](../context/threeContext.tsx#L68-L84))
- Drives both animation agency and engine transitions
- Uses `THREE.Clock` for consistent deltaTime
- Calls `engine.update(deltaSeconds)` each frame

**Transition Lifecycle:**
1. `transitionAU(id, targetValue, duration)` called
2. Current value captured as `from`, target as `to`
3. Transition added to queue with `elapsed: 0`
4. Each frame: `elapsed += deltaTime`
5. Progress calculated: `p = elapsed / duration` (clamped 0-1)
6. Eased value applied: `value = from + (to - from) * easeInOutQuad(p)`
7. When `p >= 1`, transition removed from queue

**Conflict Prevention:**
- New transitions cancel existing ones for the same AU/morph
- Prevents competing animations

**Pause/Resume:**
```typescript
engine.pause();   // Freeze all transitions
engine.resume();  // Continue from current position
engine.getPaused(); // Check state
```

## Performance Notes

- Morph updates are batched per render frame
- Bone transforms are applied once per composite operation
- Mix weight changes trigger immediate reapply via `reapplyComposites()`
- Single RAF loop shared across all systems (no timer conflicts)
- Transitions use elapsed time accumulation (no wall-clock drift)

## File Structure

```
engine/
├── EngineThree.ts              # Main engine implementation
├── arkit/
│   ├── shapeDict.ts            # AU → Morph/Bone mappings
│   └── README.md               # This file
└── README.md                   # Engine overview (this file)
```
