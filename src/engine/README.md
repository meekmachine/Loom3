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

#### Unified AU Control

All facial animation goes through `setAU()`:

```typescript
setAU(auId: number, value: number)  // value ∈ [0, 1]
```

For bidirectional axes (left/right, up/down), use AU pairs:
- Eyes horizontal: AU 61 (left) / AU 62 (right)
- Eyes vertical: AU 63 (up) / AU 64 (down)
- Head horizontal: AU 31 (left) / AU 32 (right)
- Head vertical: AU 33 (up) / AU 54 (down)
- Head tilt: AU 55 (left) / AU 56 (right)

#### Mix Weight Control

Control the morph/bone blend ratio for mixed AUs:

```typescript
setAUMixWeight(id: number, weight: number)  // weight ∈ [0, 1]
getAUMixWeight(id: number): number
```

Mix weight only affects morph intensity. Bones are always applied at full intensity.

### Core Animation Flow

Everything goes through `setAU()` with deferred bone application:

```
setAU(auId, value)
    │
    ├─► applyBothSides(auId, value)     // Morphs (scaled by mixWeight for MIXED_AUS)
    │
    └─► For composite AUs:
        │
        ├─► Calculate axisValue:
        │   • Continuum: posValue - negValue (e.g., AU62 - AU61 for eyes yaw)
        │   • Multi-AU: Math.max(...auValues) (e.g., max of AU25,26,27 for jaw pitch)
        │
        ├─► updateBoneRotation(nodeKey, axis, axisValue)
        │       └─► rotations[nodeKey][axis] = clamp(axisValue, -1, 1)
        │
        └─► pendingCompositeNodes.add(nodeKey)
                │
                └─► flushPendingComposites() (called in update())
                        │
                        └─► applyCompositeRotation(nodeKey)
                                • Gets rotState from this.rotations[nodeKey]
                                • For each axis (yaw, pitch, roll):
                                    - getBindingForAxis() picks AU based on direction
                                    - Calculates radians from maxDegrees * |value| * scale
                                    - Applies quaternion rotation
```

### Deferred Composite Rotation System

Multi-axis bone movements (e.g., eyes looking up-left) are handled by deferred composition:

**Why Deferred Apply:**
- Eye/head movements need BOTH morphs (for eyelid deformation, brow movement) AND bones (for eyeball/head rotation)
- Sequential bone updates would overwrite each other
- By deferring to `flushPendingComposites()`, all axis values are captured before applying

**Example:** Eyes looking up and to the right
1. Animation service schedules AU 62 (yaw right) and AU 63 (pitch up) with curves
2. `setAU(62, 0.5)` called → Morph applied, `rotations.EYE_L.yaw = 0.5`, node marked pending
3. `setAU(63, 0.8)` called → Morph applied, `rotations.EYE_L.pitch = 0.8`, node marked pending
4. `update()` calls `flushPendingComposites()`
5. `applyCompositeRotation('EYE_L')` composes both axes into single quaternion
6. Final result: Coordinated eyeball rotation + eyelid/brow morphs

### Multi-Axis Preservation

The engine tracks current rotation state in `this.rotations`:

```typescript
rotations: {
  HEAD: { pitch: 0, yaw: 0, roll: 0 },
  EYE_L: { pitch: 0, yaw: 0, roll: 0 },
  EYE_R: { pitch: 0, yaw: 0, roll: 0 },
  JAW: { pitch: 0, yaw: 0, roll: 0 },
  TONGUE: { pitch: 0, yaw: 0, roll: 0 }
}
```

This prevents axis-stomping when setting pitch and yaw separately.

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

1. Add AU pair to `COMPOSITE_ROTATIONS` in shapeDict.ts (defines negative/positive AUs for the axis)
2. Add bone bindings to `BONE_AU_TO_BINDINGS` for each AU
3. Use `engine.setAU(auId, value)` to control it - the system handles the rest

## Debugging Tips

### Enable Console Logging

Uncomment logging in:
- `setAU()` - See AU values being set
- `applyCompositeRotation()` - See quaternion composition
- `setAUMixWeight()` - Track mix weight changes

### Common Issues

**"Eyes/head not moving far enough"**
- Check `maxDegrees` in bone bindings (shapeDict.ts)
- Default: Eyes 25° horizontal, 20° vertical

**"Blend slider not working"**
- Verify ContinuumSlider is using correct base AU ID
- Check that mix weight is being read from the correct AU

**"Multi-axis movement resets one axis"**
- Verify the `rotations` state is being updated via `updateBoneRotation()`
- Check that `pendingCompositeNodes` is being populated

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

- Morph updates are applied immediately via `applyBothSides()`
- Bone transforms are deferred to `flushPendingComposites()` in `update()`
- Mix weight changes only reapply that specific AU's morph
- Single RAF loop shared across all systems (no timer conflicts)
- Transitions use elapsed time accumulation (no wall-clock drift)

## Animation Agency Integration

- The animation agency uses `transitionContinuum(negAU, posAU, value, duration)` for smooth head/eye movements
- Head/Eye tracking snippets are generated with canonical names (`eyeHeadTracking/eyeYaw`, `headYaw`, etc.). When they reach the scheduler, it samples AU pairs (31/32, 33/54, 55/56, 61/62, 63/64) and calls `transitionContinuum`
- Mix weights only apply to morph overlays. UI sliders can call `engine.setAUMixWeight` to bias toward morphs or bones

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
