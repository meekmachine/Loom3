# EngineThree - Facial Animation Engine

This directory contains the core facial animation engine that drives morphs (blendshapes) and bones for realistic character animation.

## 📚 Essential Reading

Before working with the engine, read these comprehensive guides:

1. **[COMPOSITE_MOTION_GUIDE.md](../../COMPOSITE_MOTION_GUIDE.md)** - Complete guide to the composite motion system (pitch/yaw/roll controls for eyes, head, jaw, tongue, and future body parts)
2. **[MIX_WEIGHT_SYSTEM.md](../../MIX_WEIGHT_SYSTEM.md)** - Critical documentation on how mix weights work (morph/bone blending)

**⚠️ CRITICAL**: Always read MIX_WEIGHT_SYSTEM.md before modifying mix weight code. The behavior is non-obvious and easy to break.

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

**Important**: For mixed AUs, the mix weight scales the **morph intensity** while bones are applied at full intensity. For example:
- AU 26 (jaw) with mix weight 0.8:
  - Morph (`Jaw_Open`) applied at 80% intensity
  - Bone (`JAW` rotation) applied at 100% intensity
  - This allows bone rotation to be visible while still having some morph deformation

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

The `applyCompositeMotion()` method handles multi-axis movement (e.g., eyes looking up-left) by coordinating **both blend shapes (morphs) AND bone rotations** in a single operation.

**Why This Matters:**
- Eye/head movements need BOTH morphs (for eyelid deformation, brow movement) AND bones (for eyeball/head rotation)
- Calling them separately would cause timing issues and incorrect blending
- `applyCompositeMotion()` ensures they're applied together with proper intensity scaling

**Base AU IDs (used for mix weight lookup):**
- Eyes: `baseYawId=61` (horizontal), `basePitchId=63` (vertical up), `64` (vertical down)
- Head: `baseYawId=31` (horizontal left), `32` (horizontal right), `basePitchId=33` (vertical up), `54` (vertical down)

**Example:** Eyes looking up and to the right
1. Animation service schedules AU 62 (yaw right) and AU 63 (pitch up) with curves
2. `setAU(62, 0.5)` called → Updates tracked state, calls `applyCompositeMotion()`
3. `setAU(63, 0.8)` called → Updates tracked state, calls `applyCompositeMotion()` again
4. `applyCompositeMotion(61, 63, 0.5, 0.8, 64)` executes:
   - **Bones:** Both eyes rotate `ry=0.5 * 25° = 12.5°` and `rx=0.8 * 20° = 16°` simultaneously
   - **Morphs:** `Eye_L_Look_R`, `Eye_R_Look_R`, `Eye_L_Look_Up`, `Eye_R_Look_Up` applied
   - **Mix Weight:** Morphs scaled by mix weight (0-1), bones always at full intensity
5. Final result: Coordinated eyeball rotation + eyelid/brow morphs

**Critical:** Both morphs and bones are applied in the SAME call to `applyCompositeMotion()`. This is how the continuum sliders work, and why animation scheduling must use the same real AU IDs (61-64, 31-33, 54-56).

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

## Animation Agency Integration

- The animation agency (animation scheduler) never calls `setAU` directly for head/eye continuums; it routes through the continuum helpers (`setEyesHorizontal`, `transitionHeadVertical`, etc.). These helpers maintain composite yaw/pitch/roll state and keep bones + morphs synchronized.
- Head/Eye tracking snippets are generated with canonical names (`eyeHeadTracking/eyeYaw`, `headYaw`, etc.). When they reach the scheduler, it samples AU pairs (31/32, 33/54, 55/56, 61/62, 63/64) and calls the corresponding transition helper with the sampled tween duration.
- Mix weights continue to apply only to morph overlays. Agencies can expose UI sliders (e.g., `setHeadBlendWeight`) that forward to `engine.setAUMixWeight` for the relevant AU IDs so you can bias toward morphs or bones without touching scheduler code.

## File Structure

```
engine/
├── EngineThree.ts              # Main engine implementation
├── arkit/
│   ├── shapeDict.ts            # AU → Morph/Bone mappings
│   └── README.md               # This file
└── README.md                   # Engine overview (this file)
```

---

## Troubleshooting: Jaw Bone Animation

### Current Issue (2025-11-13)

Jaw bone rotation (AU 25, 26, 27) is not visibly rotating despite having correct bone bindings configured.

### Model Details (Character Creator Format)

**Confirmed GLB Structure:**
- **Jaw bone:** `CC_Base_JawRoot` (skeleton index 40)
- **Parent bone:** `CC_Base_Head` (skeleton index 38)
- **Jaw morphs:** `Jaw_Open` (index 77), `Jaw_Forward`, `Jaw_L`, `Jaw_R`

### Current Configuration

**Bone Candidates ([shapeDict.ts:257](arkit/shapeDict.ts#L257)):**
```typescript
JAW_BONE_CANDIDATES = [
  'CC_Base_JawRoot',  // ✅ Updated to prioritize CC rig format
  'JawRoot', 'Jaw', 'CC_Base_Jaw', 'Mandible', 'LowerJaw', 'CC_Base_UpperJaw'
];
```

**Bone Bindings ([shapeDict.ts:225-233](arkit/shapeDict.ts#L225-L233)):**
```typescript
25: [ { node: 'JAW', channel: 'ry', scale: 1, maxDegrees: 8 } ],   // Lips Part
26: [ { node: 'JAW', channel: 'ry', scale: 1, maxDegrees: 20 } ],  // Jaw Drop
27: [ { node: 'JAW', channel: 'ry', scale: 1, maxDegrees: 25 } ],  // Mouth Stretch
```

**Morph Mappings ([shapeDict.ts:35-37](arkit/shapeDict.ts#L35-L37)):**
```typescript
25: ['Jaw_Open','Mouth_Close'],
26: ['Jaw_Open'],
27: ['Jaw_Open'],
```

### Debug Console Logs

When moving AU 26 slider with blend weight at 0.0 (pure bone), you should see:

```
[EngineThree] JAW bone resolved: CC_Base_JawRoot <THREE.Bone>
[EngineThree] setAU(26, 0.50) - calling applyBones
[EngineThree] applyBothSides AU26 value=0.50, keys: ['Jaw_Open']
[EngineThree] mixWeight=0.00, morphValue=0.00
[EngineThree] applyBones AU26 value=0.50 {
  bindings: ['JAW:ry:20deg'],
  jawResolved: true,
  jawBoneName: 'CC_Base_JawRoot'
}
```

### Testing Checklist

- [x] Updated JAW_BONE_CANDIDATES to include `CC_Base_JawRoot` first
- [ ] Refresh browser to reload model with updated candidates
- [ ] Verify console shows `JAW bone resolved: CC_Base_JawRoot`
- [ ] Move AU 26 slider with blend at 0.0 (pure bone)
- [ ] Check for `jawResolved: true` in console
- [ ] Observe if jaw bone rotates

### If Jaw Still Not Rotating

Try different rotation axes or directions:

**Option 1: X-axis rotation (pitch)**
```typescript
26: [ { node: 'JAW', channel: 'rx', scale: 1, maxDegrees: 20 } ],
```

**Option 2: Z-axis rotation (roll)**
```typescript
26: [ { node: 'JAW', channel: 'rz', scale: 1, maxDegrees: 20 } ],
```

**Option 3: Negative rotation direction**
```typescript
26: [ { node: 'JAW', channel: 'ry', scale: -1, maxDegrees: 20 } ],
```

### Code References

| File | Line | Purpose |
|------|------|---------|
| [EngineThree.ts:846-855](EngineThree.ts#L846-L855) | Jaw bone resolution logic |
| [EngineThree.ts:711-756](EngineThree.ts#L711-L756) | `applyBones()` - Applies bone rotations |
| [EngineThree.ts:758-795](EngineThree.ts#L758-L795) | `applySingleBinding()` - Quaternion rotation math |
| [EngineThree.ts:379-387](EngineThree.ts#L379-L387) | `setAU()` - Debug logging for jaw AUs |
| [CharacterGLBScene.tsx:189-261](../scenes/CharacterGLBScene.tsx#L189-L261) | GLB model inspection logs |

### Previous Attempts

- ❌ Tried `channel: 'rx'` with `scale: -1` - No rotation
- ❌ Tried `channel: 'rx'` with `scale: 1` - No rotation
- ⏳ Now testing `channel: 'ry'` with `scale: 1` after bone candidate fix

**Status:** Awaiting user testing after `CC_Base_JawRoot` prioritization update.
