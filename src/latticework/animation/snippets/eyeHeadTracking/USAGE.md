# Eye and Head Tracking Animation Snippets

## Overview

These animation snippets demonstrate the composite motion system for eyes and head movements. They work with the continuum slider system and respect mix weight settings.

## How Mix Weights Affect Animations

All animations in this folder use the **composite motion system**, which means:
- **Bones (skeletal rotations)**: ALWAYS animate at full intensity
- **Morphs (blendshapes)**: Animate at intensity controlled by the mix weight slider

### Testing Different Mix Weight Settings

#### Bone Only (Mix Weight = 0.0)
1. Open the AU panel
2. Find "Eyes Vertical" continuum slider
3. Click the blend slider and drag it all the way to the left (0.0)
4. Play any eye animation

**Result**: Clean eyeball rotation with no eyelid morphs

#### Balanced (Mix Weight = 0.5)
1. Set blend slider to middle (0.5)
2. Play any eye animation

**Result**: Full eyeball rotation + 50% eyelid morph deformation

#### Full Overlay (Mix Weight = 1.0)
1. Set blend slider all the way to the right (1.0)
2. Play any eye animation

**Result**: Full eyeball rotation + 100% eyelid morph deformation

## Available Animations

### eyeRoll.json
**Description**: Simple exasperated eye roll - eyes look up, hold, then return to neutral.

**Motion**:
- Eyes move up to maximum
- Hold for a moment
- Return to neutral

**Duration**: 1.0 seconds

**Use case**: Quick "are you serious?" expression

**AU Curves**:
- AU 63 (eyes up): 0 → 1.0 → 1.0 → 0
- AU 64 (eyes down): stays at 0

### eyeRollCircular.json
**Description**: True circular eye roll - eyes trace a complete circular path.

**Motion Path**:
1. **0.0s - 0.125s**: Up
2. **0.125s - 0.25s**: Up-Right
3. **0.25s - 0.375s**: Right
4. **0.375s - 0.5s**: Down-Right
5. **0.5s - 0.625s**: Down
6. **0.625s - 0.75s**: Down-Left
7. **0.75s - 0.875s**: Left
8. **0.875s - 1.0s**: Back to neutral

**Duration**: 1.0 seconds

**Use case**: Full dramatic eye roll motion

**AU Curves**:
- AU 61 (eyes left): peaks at time 0.75
- AU 62 (eyes right): peaks at time 0.25
- AU 63 (eyes up): peaks at time 0.125 and 0.875
- AU 64 (eyes down): peaks at time 0.5

### headRoll.json
**Description**: Head tilt/roll from left to right and back.

**Motion**:
- Head tilts left (ear toward left shoulder)
- Returns to center
- Head tilts right (ear toward right shoulder)
- Returns to center

**Duration**: 1.0 seconds

**Use case**: "I don't know" or confused gesture

**AU Curves**:
- AU 55 (head tilt left): peaks at 0.3
- AU 56 (head tilt right): peaks at 0.8

### headRollCircular.json
**Description**: Compound head roll path combining yaw, pitch, and roll (used for more dramatic gestures).

**Motion**:
- Head sweeps through up/right/down/left positions while tilting, completing a smooth circle.

**Duration**: 1.2 seconds

**Use case**: Dramatic head roll or “loopy” emphasis gesture.

**AU Curves**:
- AU 51/52 (head yaw) drive the horizontal portion of the roll
- AU 53/54 (head pitch) coordinate the vertical arc
- AU 55/56 (head tilt) provide the roll component (marked with `"inherit": true` for seamless looping)

## Understanding the Continuum System

### How Animations Trigger Composite Motion

The animation scheduler detects AU pairs and automatically calls the composite motion methods:

#### Eyes Horizontal (AU 61 ↔ AU 62)
```json
{
  "61": [{ "time": 0, "intensity": 0 }, { "time": 1, "intensity": 0.5 }],
  "62": [{ "time": 0, "intensity": 0.5 }, { "time": 1, "intensity": 0 }]
}
```
→ Scheduler detects continuum pair
→ Calculates value: `posValue - negValue = 0 - 0.5 = -0.5` (left)
→ Calls `host.setEyesHorizontal(-0.5)`
→ Applies bones at 100% + morphs at mixWeight%

#### Eyes Vertical (AU 63 ↔ AU 64)
```json
{
  "63": [{ "time": 0, "intensity": 0 }, { "time": 1, "intensity": 1.0 }],
  "64": [{ "time": 0, "intensity": 0 }, { "time": 1, "intensity": 0 }]
}
```
→ Scheduler detects continuum pair
→ Calculates value: `posValue - negValue = 1.0 - 0 = 1.0` (up)
→ Calls `host.setEyesVertical(1.0)`
→ Applies bones at 100% + morphs at mixWeight%

### Multi-Axis Coordination

The composite motion system preserves all axes. For example, if you have:
- Horizontal animation setting yaw = 0.5
- Vertical animation setting pitch = 0.8

The scheduler will:
1. Call `setEyesHorizontal(0.5)` → Updates `currentEyeYaw = 0.5`, calls `applyEyeComposite(0.5, currentEyePitch)`
2. Call `setEyesVertical(0.8)` → Updates `currentEyePitch = 0.8`, calls `applyEyeComposite(currentEyeYaw, 0.8)`

Result: Eyes end up looking up-right with both axes applied.

## Creating New Animations

### Pattern: Simple Directional Movement

For a single-axis movement (e.g., eyes left):

```json
{
  "name": "eyesLeft",
  "curves": {
    "61": [
      { "time": 0.0, "intensity": 0.0 },
      { "time": 0.5, "intensity": 1.0 },
      { "time": 1.0, "intensity": 0.0 }
    ],
    "62": [
      { "time": 0.0, "intensity": 0.0 },
      { "time": 0.5, "intensity": 0.0 },
      { "time": 1.0, "intensity": 0.0 }
    ]
  },
  "snippetCategory": "eyeHeadTracking",
  "snippetPriority": 20,
  "loop": false
}
```

**Key points**:
- Include BOTH AUs in the continuum pair (61 and 62)
- Set the opposite direction to 0 (62 stays at 0 for left movement)
- The scheduler will detect the pair and call composite motion

### Pattern: Diagonal Movement

For diagonal movement (e.g., eyes up-left):

```json
{
  "name": "eyesUpLeft",
  "curves": {
    "61": [
      { "time": 0.0, "intensity": 0.0 },
      { "time": 0.5, "intensity": 0.7 },
      { "time": 1.0, "intensity": 0.0 }
    ],
    "62": [
      { "time": 0.0, "intensity": 0.0 },
      { "time": 0.5, "intensity": 0.0 },
      { "time": 1.0, "intensity": 0.0 }
    ],
    "63": [
      { "time": 0.0, "intensity": 0.0 },
      { "time": 0.5, "intensity": 0.9 },
      { "time": 1.0, "intensity": 0.0 }
    ],
    "64": [
      { "time": 0.0, "intensity": 0.0 },
      { "time": 0.5, "intensity": 0.0 },
      { "time": 1.0, "intensity": 0.0 }
    ]
  },
  "snippetCategory": "eyeHeadTracking",
  "snippetPriority": 20,
  "loop": false
}
```

### Pattern: Circular Motion

For smooth circular paths, use sine/cosine-like curves:

1. **Up (0°)**: AU 63 = 1.0, AU 64 = 0, AU 61/62 = 0
2. **Up-Right (45°)**: AU 63 = 0.7, AU 62 = 0.7
3. **Right (90°)**: AU 62 = 1.0, AU 63/64 = 0, AU 61 = 0
4. **Down-Right (135°)**: AU 64 = 0.7, AU 62 = 0.7
5. **Down (180°)**: AU 64 = 1.0, AU 63 = 0, AU 61/62 = 0
6. **Down-Left (225°)**: AU 64 = 0.7, AU 61 = 0.7
7. **Left (270°)**: AU 61 = 1.0, AU 63/64 = 0, AU 62 = 0
8. **Up-Left (315°)**: AU 63 = 0.7, AU 61 = 0.7

## Debugging

### Animation Not Playing
- Check console for scheduler logs
- Verify AU numbers match continuum pairs (see table below)
- Ensure both AUs in pair are included in curves (even if one is 0)

### Bones Not Moving
- Check that bones are resolved in console: "EYE_L bone resolved: CC_Base_L_Eye"
- Verify BONE_AU_TO_BINDINGS has entries for your AUs
- Check maxDegrees values (may be too small to see)

### Morphs Not Showing
- Check mix weight slider value (0 = no morphs)
- Verify AU_TO_MORPHS has entries for your AUs
- Check morph names match your 3D model

## AU Reference Table

| Body Part | Axis | Negative AU | Positive AU | Method Called |
|-----------|------|-------------|-------------|---------------|
| Eyes | Horizontal | 61 (left) | 62 (right) | `setEyesHorizontal()` |
| Eyes | Vertical | 64 (down) | 63 (up) | `setEyesVertical()` |
| Head | Horizontal | 51 (left) | 52 (right) | `setHeadHorizontal()` |
| Head | Vertical | 54 (down) | 53 (up) | `setHeadVertical()` |
| Head | Roll | 55 (tilt left) | 56 (tilt right) | `setHeadRoll()` |

## See Also

- [COMPOSITE_MOTION_GUIDE.md](../../../../../COMPOSITE_MOTION_GUIDE.md) - Full guide to composite motion system
- [MIX_WEIGHT_SYSTEM.md](../../../../../MIX_WEIGHT_SYSTEM.md) - How mix weights work
- [animationScheduler.ts](../../animationScheduler.ts) - Scheduler implementation
