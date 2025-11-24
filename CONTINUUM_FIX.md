# Continuum Animation Fix

## Problem
Eye yaw/pitch and head animations weren't working with the continuum system because:

1. The `host` object passed to `AnimationScheduler` was missing the continuum helper methods
2. Both `EYE_L` and `EYE_R` nodes were calling `setEyesHorizontal()` twice (redundant)

## Solution

### 1. Added Continuum Methods to Host Object

**Files Changed:**
- [`src/context/threeContext.tsx`](src/context/threeContext.tsx#L57-L65)
- [`src/context/fiberContext.tsx`](src/context/fiberContext.tsx#L49-L57)

Added these methods to the `host` object:
```typescript
setEyesHorizontal: (v: number) => engineRef.current!.setEyesHorizontal?.(v),
setEyesVertical: (v: number) => engineRef.current!.setEyesVertical?.(v),
setHeadHorizontal: (v: number) => engineRef.current!.setHeadHorizontal?.(v),
setHeadVertical: (v: number) => engineRef.current!.setHeadVertical?.(v),
setHeadRoll: (v: number) => engineRef.current!.setHeadRoll?.(v),
setJawHorizontal: (v: number) => engineRef.current!.setJawHorizontal?.(v),
setTongueHorizontal: (v: number) => engineRef.current!.setTongueHorizontal?.(v),
setTongueVertical: (v: number) => engineRef.current!.setTongueVertical?.(v),
```

### 2. Fixed Duplicate Continuum Calls

**File Changed:** [`src/latticework/animation/animationScheduler.ts`](src/latticework/animation/animationScheduler.ts#L301)

Added `processedContinuums` Set to track which continuum methods have been called:

```typescript
const processedContinuums = new Set<string>();

// Create unique key for each continuum (method name + AU pair)
const continuumKey = `${methodName}:${negAU}-${posAU}`;

// Only call if not already processed
if (!processedContinuums.has(continuumKey) && this.host[methodName]) {
  this.host[methodName](continuumValue);
  processedContinuums.add(continuumKey);
}
```

This prevents calling `setEyesHorizontal()` twice when both `EYE_L` and `EYE_R` nodes are processed.

## How It Works Now

```
Animation Snippet (eyeYaw.json)
   ├─ AU 61: [100 → 0 → 0]  (left)
   └─ AU 62: [0 → 0 → 100]  (right)
         ↓
Scheduler samples values
   ├─ t=0.0: AU61=1.0, AU62=0.0
   ├─ t=0.5: AU61=0.0, AU62=0.0
   └─ t=1.0: AU61=0.0, AU62=1.0
         ↓
applyContinuumTargets() detects pair
   ├─ Processes EYE_L node (AU 61+62)
   │   └─ Calls setEyesHorizontal(-1.0 → 0.0 → +1.0)
   │   └─ Marks continuum as processed
   ├─ Processes EYE_R node (AU 61+62)
   │   └─ Skips (already processed)
   └─ Marks AU 61 and AU 62 as processed
         ↓
EngineThree applies composite motion
   ├─ Morphs: Eye_L_Look_L, Eye_R_Look_L (or right)
   ├─ Bones: Eye_L, Eye_R rotation
   └─ Mix: Based on mixWeight
         ↓
✨ Eyes move smoothly across full continuum!
```

## Testing

Run in browser console:

```javascript
// Test eye yaw (should sweep left → center → right)
anim.loadFromLocal('eyeHeadTrackingAnimationsList/eyeYaw');
anim.play();
```

**Expected Console Output:**
```
[Scheduler] Continuum: EYE_L.yaw = -1.00 (AU61=1.00, AU62=0.00) → setEyesHorizontal()
... (values transition) ...
[Scheduler] Continuum: EYE_L.yaw = 0.00 (AU61=0.00, AU62=0.00) → setEyesHorizontal()
... (values transition) ...
[Scheduler] Continuum: EYE_L.yaw = 1.00 (AU61=0.00, AU62=1.00) → setEyesHorizontal()
```

Note: Only `EYE_L` logs appear (not `EYE_R`) because duplicate calls are now prevented!

## Files Changed

1. ✅ [`src/latticework/animation/animationScheduler.ts`](src/latticework/animation/animationScheduler.ts) - Added continuum detection and deduplication
2. ✅ [`src/context/threeContext.tsx`](src/context/threeContext.tsx) - Added continuum methods to host
3. ✅ [`src/context/fiberContext.tsx`](src/context/fiberContext.tsx) - Added continuum methods to host

## Summary

The animation system now:
- ✅ Detects continuum AU pairs from `COMPOSITE_ROTATIONS`
- ✅ Calls appropriate engine continuum methods
- ✅ Prevents duplicate method calls
- ✅ Logs debug info to console
- ✅ Works with existing eye/head tracking snippets

Eye and head animations should now work correctly with full continuum range! 🎉
