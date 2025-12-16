# AU Continuum System Refactor

**Date**: December 2024
**Status**: Complete (Stable)

## Overview

This document tracks the refactor of the AU (Action Unit) continuum system in EngineThree. The goal was to unify how composite bone rotations (head, eyes, jaw, tongue) are handled through a single `setAU()` pathway, eliminating redundant methods and ensuring consistent behavior between UI sliders and the animation system.

## Problem Statement

### Original Issues
1. **Redundant Methods**: 12+ methods like `setEyesHorizontal`, `setHeadVertical`, `applyCompositeMotion`, etc. that duplicated logic
2. **Inconsistent State**: Separate tracking variables (`currentEyeYaw`, `currentHeadPitch`, etc.) that could get out of sync
3. **Animation System Mismatch**: Animation scheduler called methods differently than UI sliders, causing direction inversions
4. **Overwriting Rotations**: Sequential calls to set pitch/yaw would overwrite each other instead of composing

## Architecture (Final)

### Unified Data Flow

Everything now goes through `setAU()`:

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

### Key Data Structures

**shapeDict.ts** (DATA ONLY - no runtime logic):
- `BONE_AU_TO_BINDINGS`: Maps AU ID → bone node, channel (rx/ry/rz), scale, maxDegrees
- `COMPOSITE_ROTATIONS`: Defines pitch/yaw/roll axes for each composite bone
- `CONTINUUM_PAIRS_MAP`: Maps AU ID → pair info (pairId, isNegative, axis, node)

**EngineThree.ts**:
- `auValues[auId]`: Raw AU values (0-1 for each AU)
- `rotations[nodeKey].pitch/yaw/roll`: Composite axis values (-1 to +1)
- `pendingCompositeNodes`: Set of nodes needing rotation update
- `AU_TO_COMPOSITE_MAP`: Derived lookup from AU ID → composite node + axis

## Removed Methods

The following redundant methods were deleted (they all bypassed the unified `setAU()` pathway):

| Method | Reason for Removal |
|--------|-------------------|
| `applyCompositeMotion()` | Redundant bone+morph application |
| `applyBoneComposite()` | Only used by applyCompositeMotion |
| `applyHeadComposite()` | Wrapper for applyCompositeMotion |
| `applyEyeComposite()` | Wrapper for applyCompositeMotion |
| `transitionHeadComposite()` | Use transitionContinuum instead |
| `transitionEyeComposite()` | Use transitionContinuum instead |

## Key Changes

### 1. Deferred-Apply Pattern for Bone Rotations

- `setAU()` updates `rotations[nodeKey][axis]` and marks node as pending
- `update()` calls `flushPendingComposites()` once per frame
- `applyCompositeRotation()` composes pitch/yaw/roll into single quaternion

### 2. Direction-Aware Binding Selection

```typescript
const getBindingForAxis = (axisConfig, direction) => {
  if (axisConfig.negative !== undefined && axisConfig.positive !== undefined) {
    const auId = direction < 0 ? axisConfig.negative : axisConfig.positive;
    return BONE_AU_TO_BINDINGS[auId]?.[0];
  }
  // ... fallback for non-continuum axes
};
```

### 3. Mix Weight Per-AU (Not Global)

`setAUMixWeight()` only reapplies that specific AU's morph, not all composites:

```typescript
setAUMixWeight = (id: number, weight: number) => {
  this.mixWeights[id] = clamp01(weight);

  // Reapply just this AU's morph with the new mix weight
  const v = this.auValues[id] ?? 0;
  if (v > 0) this.applyBothSides(id, v);

  // Mark affected bone as pending
  const compositeInfo = AU_TO_COMPOSITE_MAP.get(id);
  if (compositeInfo) {
    for (const nodeKey of compositeInfo.nodes) {
      this.pendingCompositeNodes.add(nodeKey);
    }
  }
};
```

### 4. resetToNeutral() Uses Pending Nodes

```typescript
// Mark all composite bones as pending (they'll reset to base in flushPendingComposites)
(['HEAD', 'EYE_L', 'EYE_R', 'JAW', 'TONGUE'] as const).forEach(node => {
  this.pendingCompositeNodes.add(node);
});
```

## Composite Types

**Continuums** (bidirectional axis with negative/positive AU):
| Node | Axis | Negative AU | Positive AU | Calculation |
|------|------|-------------|-------------|-------------|
| HEAD | pitch | 54 (down) | 33 (up) | `AU33 - AU54` |
| HEAD | yaw | 31 (left) | 32 (right) | `AU32 - AU31` |
| HEAD | roll | 55 (tilt L) | 56 (tilt R) | `AU56 - AU55` |
| EYE | pitch | 64 (down) | 63 (up) | `AU63 - AU64` |
| EYE | yaw | 61 (left) | 62 (right) | `AU62 - AU61` |
| JAW | yaw | 30 (left) | 35 (right) | `AU35 - AU30` |
| TONGUE | pitch | 38 (down) | 37 (up) | `AU37 - AU38` |
| TONGUE | yaw | 39 (left) | 40 (right) | `AU40 - AU39` |

**Multi-AU additive** (single direction, multiple AUs contribute):
| Node | Axis | AUs | Calculation |
|------|------|-----|-------------|
| JAW | pitch | 25, 26, 27 | `Math.max(AU25, AU26, AU27)` |

## Files Modified

| File | Changes |
|------|---------|
| `src/engine/EngineThree.ts` | Removed redundant methods, unified through setAU(), added setContinuum() and transitionContinuum() |
| `src/engine/arkit/shapeDict.ts` | Added `CONTINUUM_PAIRS_MAP`, fixed bone binding scale values for AU31/32/61/62 |
| `src/latticework/animation/animationScheduler.ts` | Uses `transitionContinuum` for animations |
| `src/latticework/eyeHeadTracking/eyeHeadTrackingService.ts` | Updated to use `transitionContinuum` instead of removed methods |
| `src/context/threeContext.tsx` | Added `transitionContinuum` to host object |
| `src/components/au/ContinuumSlider.tsx` | Now calls `engine.setContinuum()` directly, blend slider affects BOTH AUs |
| `src/components/au/AUSection.tsx` | Removed EngineFour references, simplified onChange handler |
| `src/components/au/AUSlider.tsx` | Removed EngineFour references |

## Recent Fixes (December 2024)

### 1. Bone rotation direction corrections
- **AU31/32 (Head Turn)**: Swapped scale values so head turns match morph direction
- **AU61/62 (Eyes Horizontal)**: Swapped scale values so eyes look in correct direction

### 2. ContinuumSlider improvements
- Now calls `engine.setContinuum(negId, posId, val)` directly (like AUSlider calls setAU)
- Blend slider now sets mix weight for BOTH AUs in the pair, not just one

### 3. Eye/Head Tracking Service
- Updated to use `transitionContinuum(negAU, posAU, value, duration)` instead of removed methods
- `transitionEyeComposite()` and `transitionHeadComposite()` were removed from EngineThree
- Direct Engine mode now works correctly with the new API

## Bone Binding Reference (shapeDict.ts)

### Head
| AU | Name | Channel | Scale | MaxDegrees |
|----|------|---------|-------|------------|
| 31 | Head Turn Left | ry | 1 | 30 |
| 32 | Head Turn Right | ry | -1 | 30 |
| 33 | Head Up | rx | -1 | 20 |
| 54 | Head Down | rx | 1 | 20 |
| 55 | Head Tilt Left | rz | -1 | 15 |
| 56 | Head Tilt Right | rz | 1 | 15 |

### Eyes (Both)
| AU | Name | Channel | Scale | MaxDegrees |
|----|------|---------|-------|------------|
| 61 | Eyes Left | rz | 1 | 25 |
| 62 | Eyes Right | rz | -1 | 25 |
| 63 | Eyes Up | rx | -1 | 20 |
| 64 | Eyes Down | rx | 1 | 20 |

## Testing Checklist

- [x] UI Sliders (AUQuickPanel): Eyes horizontal/vertical move correct direction
- [x] UI Sliders (AUQuickPanel): Head horizontal/vertical/tilt move correct direction
- [x] Eye/Head Tracking (Direct Engine mode): Eyes and head move correct direction
- [x] Eye/Head Tracking (Animation Agency mode): Uses transitionContinuum correctly
- [x] Morphs and bones move in same direction (not inverted)
- [x] Both directions of continuum work (left AND right, up AND down)
- [x] Mix weight changes affect BOTH AUs in a continuum pair
- [ ] Animation System: Lip-sync/prosodic snippets work with new system
- [ ] Transitions are smooth (no jumps when starting/stopping animations)

## Known Issues

1. **Single-eye AUs (65-72)**: Not yet tested with new system
2. **Jaw/Tongue continuums**: Not yet tested with animation system

---

## Complete Code Path Analysis

### Path 1: Regular AU Slider (AUSlider.tsx)

```
User drags AUSlider for AU12 (smile) to 0.5
    │
    └─► AUSlider.handleIntensityChange(0.5)
            │
            └─► engine.setAU(12, 0.5)
                    │
                    ├─► auValues[12] = 0.5
                    │
                    ├─► compositeInfo = AU_TO_COMPOSITE_MAP.get(12) → undefined (AU12 is not composite)
                    │
                    └─► else branch:
                        ├─► applyBothSides(12, 0.5)
                        │       └─► applyMorphs(['Mouth_Smile_L', 'Mouth_Smile_R'], 0.5)
                        │
                        └─► hasBoneBinding(12) → false, so no bone applied
```

**SIMPLE AND CORRECT** - `setAU()` directly applies morphs.

---

### Path 2: Continuum Slider (ContinuumSlider.tsx via AUSection.tsx)

```
User drags Head Horizontal slider to -0.5 (left)
    │
    └─► AUSection onChange handler (lines 455-468):
            │
            ├─► val < 0, so:
            │   ├─► engine.setAU(31, 0.5)   // negativeAU = head left
            │   └─► engine.setAU(32, 0)     // positiveAU = head right
            │
            └─► For setAU(31, 0.5):
                    │
                    ├─► auValues[31] = 0.5
                    │
                    ├─► compositeInfo = AU_TO_COMPOSITE_MAP.get(31)
                    │   → { nodes: ['HEAD'], axis: 'yaw' }
                    │
                    └─► if (compositeInfo) branch:
                        │
                        ├─► applyBothSides(31, 0.5)
                        │       │
                        │       ├─► keys = AU_TO_MORPHS[31] = ['Head_Turn_L']
                        │       ├─► mixWeight = 0.7 (default for AU31)
                        │       ├─► morphValue = 0.5 * 0.7 = 0.35
                        │       └─► applyMorphs(['Head_Turn_L'], 0.35) ✓
                        │
                        └─► for nodeKey 'HEAD':
                            ├─► axisConfig = COMPOSITE_ROTATIONS.HEAD.yaw
                            │   → { aus: [31,32], negative: 31, positive: 32 }
                            │
                            ├─► axisValue = posValue - negValue
                            │            = auValues[32] - auValues[31]
                            │            = 0 - 0.5 = -0.5
                            │
                            ├─► updateBoneRotation('HEAD', 'yaw', -0.5)
                            │
                            └─► pendingCompositeNodes.add('HEAD')
```

Then in `update()` → `flushPendingComposites()` → `applyCompositeRotation('HEAD')`:
```
applyCompositeRotation('HEAD'):
    │
    ├─► rotState = this.rotations['HEAD'] = { yaw: -0.5, pitch: 0, roll: 0 }
    │
    ├─► config = COMPOSITE_ROTATIONS.find(c => c.node === 'HEAD')
    │
    └─► For yaw axis (rotState.yaw = -0.5):
        │
        ├─► getBindingForAxis(config.yaw, -0.5)
        │   │
        │   └─► direction < 0, so pick axisConfig.negative = AU31
        │       → BONE_AU_TO_BINDINGS[31] = { scale: -1, maxDegrees: 30 }
        │
        └─► radians = deg2rad(30) * |−0.5| * (−1) = -0.26 rad
            │
            └─► HEAD bone rotates -0.26 rad around Y axis
```

**PROBLEM**: The slider calls `setAU(31, 0.5)` and `setAU(32, 0)` separately, which:
1. Applies morphs correctly for each AU
2. But bone rotation calculation uses `posValue - negValue` which gives -0.5
3. Then bone binding uses `scale: -1` giving another negation

The system is overly complex with multiple sign flips that are hard to reason about.

---

### Path 3: Animation Scheduler (transitionContinuum)

```
AnimationScheduler.applyContinuumTargets() detects AU31/32 pair:
    │
    ├─► continuumValue = posValue - negValue (e.g., 0 - 0.5 = -0.5)
    │
    └─► host.transitionContinuum(31, 32, -0.5, durationMs)
            │
            └─► EngineThree.transitionContinuum():
                    │
                    ├─► currentContinuum = currentNeg - currentPos
                    │                    = auValues[31] - auValues[32]
                    │                    (NOTE: opposite order from scheduler!)
                    │
                    └─► addTransition callback(value):
                        │
                        ├─► neg = value > 0 ? value : 0
                        ├─► pos = value < 0 ? -value : 0
                        │
                        └─► setAU(negAU, neg)
                            setAU(posAU, pos)
```

**PROBLEM**: AnimationScheduler calculates `posValue - negValue` but EngineThree.transitionContinuum calculates `negValue - posValue` - **opposite sign conventions!**

---

### Path 4: Unused applyDirectionalMorphs Method

There's an unused method `applyDirectionalMorphs` that has WRONG logic:
```typescript
if (id === 31 || id === 32) {
  // dir > 0 uses AU31 (Head_Turn_L), dir <= 0 uses AU32 (Head_Turn_R)
  this.applyMorphs(dir > 0 ? AU_TO_MORPHS[31] : AU_TO_MORPHS[32], absVal);
}
```
This is backwards - positive direction should use the positive AU's morph.

---

## Root Problems

1. **Inconsistent sign conventions**:
   - AUSection: `posValue - negValue`
   - transitionContinuum: `negValue - posValue`

2. **Over-complicated bone rotation**:
   - `applyCompositeRotation` picks binding based on direction sign
   - Then applies binding's scale which may flip sign again
   - Hard to reason about final rotation direction

3. **Unused/dead code**: `applyDirectionalMorphs` exists but isn't called

4. **setAU called twice for continuums**: AUSection calls `setAU(negAU, val)` then `setAU(posAU, 0)` instead of a single call

---

## Simplification Plan

The continuum sliders and animation system should just call `setAU()` at the end of the day. The complexity comes from trying to be clever with continuum values.

**Proposed fix**:
1. ContinuumSlider onChange should calculate which AU to activate and call `setAU()` once
2. Remove the sign-flipping in `applyCompositeRotation` - just use the binding directly
3. Make `transitionContinuum` use same sign convention as everywhere else
4. Delete unused `applyDirectionalMorphs`
