# Mix Weight System - Critical Behavior Documentation

## Overview

The mix weight system controls how morphs (blendshapes) blend with bone rotations for composite facial movements like eyes and head.

## ⚠️ CRITICAL: How Mix Weights Work

### The Golden Rule

**Bones ALWAYS apply at full intensity, regardless of mix weight.**
**Mix weight ONLY controls morph intensity.**

```
mixWeight = 0.0  →  Bone at 100% + Morph at 0%   (pure bone movement)
mixWeight = 0.5  →  Bone at 100% + Morph at 50%  (balanced)
mixWeight = 1.0  →  Bone at 100% + Morph at 100% (full overlay)
```

### Why This Matters

The bone provides the primary movement (eyeball rotation, head turn, jaw drop). The morph adds secondary deformation (eyelid follow, brow movement, skin stretching).

- **Low mix weight (0.0)**: Clean bone movement with no morph overlay
- **High mix weight (1.0)**: Bone movement with full morph deformation

## Implementation

### Correct Implementation (applyCompositeMotion)

```typescript
// ✅ CORRECT - Bones are NOT scaled
this.applyBoneComposite(
  { leftId, rightId, upId, downId, tiltLeftId, tiltRightId },
  { yaw: yawBone, pitch, roll: rollVal }  // Full intensity
);

// ✅ CORRECT - Morphs ARE scaled by mix weight
this.applyMorphs(AU_TO_MORPHS[leftId] || [], yaw < 0 ? Math.abs(yaw) * yawMix : 0);
this.applyMorphs(AU_TO_MORPHS[rightId] || [], yaw > 0 ? Math.abs(yaw) * yawMix : 0);
this.applyMorphs(AU_TO_MORPHS[downId] || [], pitch < 0 ? pitchAbs * pitchMix : 0);
this.applyMorphs(AU_TO_MORPHS[upId] || [], pitch > 0 ? pitchAbs * pitchMix : 0);
```

### Incorrect Implementation (DO NOT DO THIS)

```typescript
// ❌ WRONG - Do NOT scale bones by mix weight
this.applyBoneComposite(
  { leftId, rightId, upId, downId, tiltLeftId, tiltRightId },
  {
    yaw: yawBone * yawMix,      // ❌ WRONG
    pitch: pitch * pitchMix,    // ❌ WRONG
    roll: rollVal * rollMix     // ❌ WRONG
  }
);

// ❌ WRONG - Do NOT use (1.0 - mixWeight)
this.applyMorphs(AU_TO_MORPHS[leftId] || [], yaw < 0 ? Math.abs(yaw) * (1.0 - yawMix) : 0);  // ❌ WRONG
```

### Correct Implementation (applyBothSides)

```typescript
// ✅ CORRECT - Scale morphs by mix weight
const mixWeight = MIXED_AUS.has(id) ? this.getAUMixWeight(id) : 1.0;
const morphValue = v * mixWeight;

this.applyMorphs(keys, morphValue);
```

## Testing Mix Weights

### How to Verify Correct Behavior

1. **Test Setup**:
   - Load character model
   - Open Eyes Horizontal continuum slider
   - Move eyes to the right (value ~0.5)

2. **Test Mix Weight = 0.0** (Bone Only):
   - Set blend slider to 0.0
   - **Expected**: Eyeballs rotate right, eyelids stay neutral
   - **Visual**: Clean eyeball rotation, no eyelid deformation

3. **Test Mix Weight = 1.0** (Bone + Full Morph):
   - Set blend slider to 1.0
   - **Expected**: Eyeballs rotate right, eyelids follow the gaze
   - **Visual**: Eyeball rotation + eyelid shape changes

4. **Test Mix Weight = 0.5** (Balanced):
   - Set blend slider to 0.5
   - **Expected**: Eyeballs rotate right, eyelids follow partially
   - **Visual**: Eyeball rotation + subtle eyelid deformation

### What Was Broken (Nov 21, 2024)

**Bug**: Morphs and bones had inverted scaling

```typescript
// What was happening:
mixWeight = 0.0  →  Bone at 0%   + Morph at 100%  (BACKWARDS!)
mixWeight = 1.0  →  Bone at 100% + Morph at 0%    (BACKWARDS!)
```

**Symptom**: "The blendshape to boneshape ratio is doing the opposite"

**Root Cause**:
1. Bones were being scaled: `yaw: yawBone * yawMix`
2. Morphs were inverted: `yaw * (1.0 - yawMix)`

**Fix**: Removed scaling from bones, removed inversion from morphs

## Code Locations

| Location | Purpose |
|----------|---------|
| [EngineThree.ts:642-687](src/engine/EngineThree.ts#L642-L687) | `applyCompositeMotion()` - Primary composite motion handler |
| [EngineThree.ts:946-967](src/engine/EngineThree.ts#L946-L967) | `applyBothSides()` - Morph application with mix weight |
| [EngineThree.ts:177-179](src/engine/EngineThree.ts#L177-L179) | `setAUMixWeight()` - Update mix weight and reapply |
| [EngineThree.ts:183-186](src/engine/EngineThree.ts#L183-L186) | `getAUMixWeight()` - Retrieve mix weight |
| [shapeDict.ts:540-553](src/engine/arkit/shapeDict.ts#L540-L553) | `AU_MIX_DEFAULTS` - Default mix values |

## Mixed AUs

Only these AUs support mix weights (defined in [shapeDict.ts:52](src/engine/arkit/shapeDict.ts#L52)):

```typescript
MIXED_AUS = new Set([
  31, 32,  // Head horizontal (left, right)
  33, 54,  // Head vertical (up, down)
  55, 56,  // Head roll (left, right)
  61, 62,  // Eyes horizontal (left, right)
  63, 64,  // Eyes vertical (up, down)
  26       // Jaw drop
]);
```

## Default Mix Values

From [shapeDict.ts:543-552](src/engine/arkit/shapeDict.ts#L543-L552):

```typescript
AU_MIX_DEFAULTS = {
  31: 0.7,  // Head horizontal
  32: 0.7,
  33: 0.7,  // Head vertical
  54: 0.7,
  61: 0.5,  // Eyes horizontal
  62: 0.5,
  63: 0.5,  // Eyes vertical
  64: 0.5,
  26: 0.8,  // Jaw
};
```

**Rationale**:
- **Eyes (0.5)**: Balanced - eyeballs need visible rotation but also eyelid follow
- **Head (0.7)**: More morph - head rotation benefits from skin/muscle deformation
- **Jaw (0.8)**: Heavy morph - jaw drop looks better with mouth morphs

## UI Integration

### ContinuumSlider Component

The blend slider in [ContinuumSlider.tsx:129-153](src/components/au/ContinuumSlider.tsx#L129-L153):

```typescript
<Text fontSize="xs" color="gray.300">Blend (Morph ↔ Bone)</Text>
<Slider
  min={0}    // Pure bone
  max={1}    // Bone + full morph
  value={getMix()}
  onChange={handleMixChange}
/>
```

**User Experience**:
- Slider at **left (0)**: "Clean bone movement, no morph distortion"
- Slider at **right (1)**: "Full deformation, maximum realism"

## History

- **2024-11-21**: Fixed inverted mix weight bug in `applyCompositeMotion()`
- **2024-11-21**: Documented correct behavior in this file
- **Earlier**: System working correctly, then broken during continuum animation integration

## See Also

- [src/engine/README.md](src/engine/README.md) - Full engine documentation
- [CONTINUUM_FIX.md](CONTINUUM_FIX.md) - Continuum animation integration notes
