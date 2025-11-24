# Continuum Animation Integration

## Summary

We've successfully integrated EngineThree's continuum capabilities with the animation agency scheduler. Animation snippets can now specify AU pairs (like eyes left/right or head up/down), and the scheduler will automatically detect them and call the appropriate continuum methods.

## What Changed

### Animation Scheduler (`src/latticework/animation/animationScheduler.ts`)

**Added continuum-aware processing:**

1. **`applyContinuumTargets()` method** - Detects AU pairs from `COMPOSITE_ROTATIONS` in shapeDict and processes them as continuums
2. **`getContinuumMethodName()` method** - Maps node+axis combinations to EngineThree continuum helper methods
3. **Updated `tick()` method** - Now calls `applyContinuumTargets()` instead of directly applying AUs

### How It Works

```typescript
// Animation snippet defines both AUs in a continuum pair
{
  "curves": {
    "61": [{ "time": 0, "intensity": 100 }, { "time": 1.0, "intensity": 0 }],  // Eyes left
    "62": [{ "time": 0, "intensity": 0 }, { "time": 1.0, "intensity": 100 }]   // Eyes right
  }
}

// Scheduler detects the pair (AU 61 + AU 62 = eye yaw continuum)
// Calculates continuum value: posValue - negValue = 0.0 - 1.0 = -1.0 (full left)
// Calls: engine.setEyesHorizontal(-1.0)

// EngineThree then:
// 1. Applies both morphs (Eye_L_Look_L, Eye_R_Look_L)
// 2. Rotates eye bones correctly (avoiding axis stomping)
// 3. Applies proper mix of bone + morph based on mixWeight
```

### Supported Continuums

The scheduler now automatically handles these continuum pairs from `COMPOSITE_ROTATIONS`:

**Eyes (Both EYE_L and EYE_R):**
- AU 61 (left) ↔ AU 62 (right) → `engine.setEyesHorizontal()`
- AU 64 (down) ↔ AU 63 (up) → `engine.setEyesVertical()`

**Head:**
- AU 31 (left) ↔ AU 32 (right) → `engine.setHeadHorizontal()`
- AU 54 (down) ↔ AU 33 (up) → `engine.setHeadVertical()`
- AU 55 (tilt left) ↔ AU 56 (tilt right) → `engine.setHeadRoll()`

**Jaw:**
- AU 30 (left) ↔ AU 35 (right) → `engine.setJawHorizontal()`

**Tongue:**
- AU 39 (left) ↔ AU 40 (right) → `engine.setTongueHorizontal()`
- AU 38 (down) ↔ AU 37 (up) → `engine.setTongueVertical()`

## Benefits

### ✅ No Redundant Mappings
- Uses existing `COMPOSITE_ROTATIONS` from shapeDict
- Single source of truth for continuum definitions
- No duplication of AU mappings

### ✅ Simple Snippet Format
- Animation snippets just specify AUs (e.g., "61" and "62")
- No need to know about continuum methods or special syntax
- Works with existing snippet library

### ✅ Correct Bone + Morph Mixing
- EngineThree continuum methods handle the complexity
- Proper composite rotations (no axis stomping)
- Respects mixWeight for bone vs morph balance

### ✅ Smooth Transitions
- Automatic continuity from animation agency
- First keyframe (time=0) uses current AU values
- Seamless transitions between snippets

## Example Usage

### Loading Eye/Head Tracking Snippets

```typescript
// Animation agency automatically loaded these on startup
const eyeYawSnippet = anim.loadFromLocal('eyeHeadTrackingAnimationsList/eyeYaw');
const headPitchSnippet = anim.loadFromLocal('eyeHeadTrackingAnimationsList/headPitch');

// Play them - scheduler will detect continuum pairs and call engine methods
anim.play();

// Behind the scenes:
// - Scheduler samples AU 61 and AU 62 values
// - Detects they form a yaw continuum for eyes
// - Calls engine.setEyesHorizontal(posValue - negValue)
// - EngineThree applies proper bone rotation + morphs
```

### Creating New Continuum Snippets

```json
{
  "name": "eyes_look_up_right",
  "curves": {
    "62": [
      { "time": 0, "intensity": 0 },
      { "time": 0.5, "intensity": 80 }
    ],
    "63": [
      { "time": 0, "intensity": 0 },
      { "time": 0.5, "intensity": 60 }
    ]
  },
  "snippetCategory": "eyeHeadTracking",
  "snippetPriority": 20,
  "loop": false
}
```

This will:
1. Move eyes right (AU 62 = 0.8)
2. Move eyes up (AU 63 = 0.6)
3. Scheduler detects both as continuum pairs
4. Calls `setEyesHorizontal(0.8)` and `setEyesVertical(0.6)`
5. Result: Eyes look diagonally up-right with proper composite motion

## Testing

### Manual Test in Console

```javascript
// Test eye yaw continuum
anim.schedule({
  name: 'test_eye_yaw',
  curves: {
    '61': [{ time: 0, intensity: 0 }, { time: 1, intensity: 1 }],
    '62': [{ time: 0, intensity: 0 }, { time: 1, intensity: 0 }]
  },
  snippetCategory: 'test',
  snippetPriority: 100
});

// Should call engine.setEyesHorizontal(-1.0) for full left
// Check console for: [Scheduler] Continuum: EYE_L.yaw = -1.00
```

### Verify with Existing Snippets

The following snippets should now work correctly with continuum methods:

- `eyeYaw.json` - Eyes sweep left → center → right
- `eyePitch.json` - Eyes sweep down → center → up
- `headYaw.json` - Head sweeps left → center → right
- `headPitch.json` - Head sweeps down → center → up
- `headRoll.json` - Head tilts left → center → right

## Architecture

```
Animation Snippet (JSON)
    ↓
animationScheduler.buildTargetMap()
    ↓ (samples keyframes, gets AU values)
animationScheduler.applyContinuumTargets()
    ↓ (detects continuum pairs using COMPOSITE_ROTATIONS)
engine.setEyesHorizontal() / setHeadVertical() / etc.
    ↓ (continuum methods from EngineThree)
engine.applyEyeComposite() / applyHeadComposite()
    ↓ (proper bone rotation + morph application)
Character moves smoothly with correct composite motion! ✨
```

## Next Steps

### Eye/Head Tracking Integration

The `EyeHeadTrackingService` can now work in two modes:

1. **Direct Mode** (current): Calls `engine.transitionEyeComposite()` directly
2. **Snippet Mode** (new): Uses scheduler to schedule eye/head tracking snippets

For snippet mode integration, update `eyeHeadTrackingService.ts`:

```typescript
// Instead of:
this.config.engine.transitionEyeComposite(eyeYaw, eyePitch, duration);

// Use:
this.config.animationAgency.schedule({
  name: 'eyeHeadTracking/eyeYaw',
  curves: {
    '61': [{ time: 0, intensity: currentLeft }, { time: duration/1000, intensity: target < 0 ? -target : 0 }],
    '62': [{ time: 0, intensity: currentRight }, { time: duration/1000, intensity: target > 0 ? target : 0 }]
  },
  snippetCategory: 'eyeHeadTracking',
  snippetPriority: 20
});
```

This will make eye/head tracking participate in the full animation priority system!

## Summary

✅ **Animation scheduler is now continuum-aware**
✅ **Uses COMPOSITE_ROTATIONS from shapeDict (single source of truth)**
✅ **Existing eye/head tracking snippets will work correctly**
✅ **No redundant AU mappings**
✅ **Proper composite bone rotations**
✅ **Ready for EyeHeadTrackingService integration**
