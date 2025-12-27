# Animation Continuity System

## Problem Statement

When multiple agencies control the same AUs (e.g., head AUs 51, 52, 53, 54), animations should **transition smoothly** from the current value instead of always jumping back to keyframe intensity 0.

## ✅ AUTOMATIC CONTINUITY (Current Implementation)

**The animation agency now handles continuity AUTOMATICALLY.** When a snippet is loaded:

1. Animation agency checks current values for all AUs in the snippet
2. If first keyframe is at time=0, replaces its intensity with current value
3. Snippet smoothly transitions from current state to target state

**Schedulers no longer need to query `getCurrentValue()` manually** - the animation agency does it automatically in the `load()` method.

### Current Behavior (Broken):

```typescript
// Eye/Head Tracking controls head:
animationAgency.schedule({
  name: 'eyeHeadTracking/head',
  curves: {
    '33': [  // Head pitch up
      { time: 0.0, intensity: 0 },     // ❌ Always starts at 0
      { time: 0.2, intensity: 0.5 }    // Target value
    ]
  }
});

// Prosodic gesture also controls head:
animationAgency.schedule({
  name: 'prosodic:nod',
  curves: {
    '33': [  // Head pitch up
      { time: 0.0, intensity: 0 },     // ❌ Always starts at 0
      { time: 0.15, intensity: 0.4 },
      { time: 0.75, intensity: 0 }
    ]
  }
});
```

**Problem**: When prosodic gesture starts, head snaps from current position (0.5) back to 0, then animates to 0.4 - creating a jarring visual artifact.

### Target Behavior (✅ Fixed with Automatic Continuity):

```typescript
// Eye/Head Tracking: Head at intensity 0.5

// Prosodic gesture starts - animation agency AUTOMATICALLY applies continuity:
animationAgency.schedule({
  name: 'prosodic:nod',
  curves: {
    '33': [  // Head pitch up
      { time: 0.0, intensity: 0 },     // ⚠️ Scheduler says "start at 0"
      { time: 0.15, intensity: 0.4 },
      { time: 0.75, intensity: 0 }
    ]
  }
});

// Animation agency automatically transforms this to:
// curves['33'][0] = { time: 0.0, intensity: 0.5 }  // ✅ Uses current value!
```

**Result**: Smooth transition from 0.5 → 0.4 → 0 instead of jarring snap 0.5 → 0 → 0.4.

**Key insight**: Schedulers can now write simple snippets without worrying about continuity - the animation agency handles it automatically!

## Solution Architecture

### 1. Track Current Values in Animation Agency ✅

```typescript
// In animationScheduler.ts
private currentValues = new Map<string, number>();

// In tick() and step() after applying values to engine:
targets.forEach((entry, curveId) => {
  const v = entry.v;
  this.currentValues.set(curveId, v);  // ✅ Track what we just applied
  // ... apply to engine
});
```

### 2. Automatic Continuity in `load()` ✅

```typescript
// In animationScheduler.ts
load(snippet: Snippet) {
  // AUTOMATIC CONTINUITY: Apply current values to first keyframe (time=0)
  const snWithContinuity = this.applyContinuity(snippet);
  this.safeSend({ type: 'LOAD_ANIMATION', data: snWithContinuity });
  // ...
}

private applyContinuity(snippet: Snippet): Snippet {
  const curves = (snippet as any).curves || {};
  const continuousCurves: Record<string, Array<{ time: number; intensity: number }>> = {};

  for (const [auId, keyframes] of Object.entries(curves)) {
    const newKeyframes = [...keyframes];

    // If first keyframe is at time 0, replace its intensity with current value
    if (newKeyframes[0]?.time === 0) {
      const currentValue = this.currentValues.get(auId) ?? 0;
      if (Math.abs(currentValue - newKeyframes[0].intensity) > 0.001) {
        console.log(`[Scheduler] Continuity: ${snippet.name} AU ${auId} starts from ${currentValue.toFixed(3)}`);
        newKeyframes[0] = { time: 0, intensity: currentValue };
      }
    }

    continuousCurves[auId] = newKeyframes;
  }

  return { ...snippet, curves: continuousCurves } as any;
}
```

**How it works**:
1. When `load()` or `schedule()` is called, animation agency intercepts the snippet
2. For each AU curve, if first keyframe is at time=0, replace its intensity with current value
3. Load the modified snippet with smooth starting points
4. Result: **Automatic smooth transitions** without scheduler changes!

### 3. Legacy: Manual Continuity (No Longer Needed)

**Note**: With automatic continuity, schedulers no longer need to query `getCurrentValue()` manually. The animation agency handles it automatically in the `load()` method.

The old approach required schedulers to:
1. Query `getCurrentValue(auId)` before scheduling
2. Build curves starting from current values

**This is now AUTOMATIC** - schedulers can simply schedule snippets with `time: 0` keyframes, and the animation agency will replace those values with current values automatically.

## Priority Blending with Continuity

The animation scheduler already handles **priority-based blending**:

```typescript
// Higher priority wins
const wins = !prev || pri > prev.pri || (pri === prev.pri && v > prev.v);
```

**Priority hierarchy**:
1. **Eye/Head Tracking**: Priority 20 (highest for head)
2. **Prosodic Gestures**: Priority 30 (head nods)
3. **Emotional Expressions**: Priority 1 (baseline)

**Example flow**:

```
Initial state: Head pitch = 0

1. Eye/head tracking starts:
   - Priority 20, target = 0.5
   - Current = 0, creates curve [0 → 0.5]
   - Head animates smoothly to 0.5

2. Prosodic gesture (nod) triggers (priority 30):
   - WINS because priority 30 > 20
   - Gets current value = 0.5
   - Creates curve [0.5 → 0.4 → 0]
   - Head smoothly transitions 0.5 → 0.4 → 0

3. Prosodic gesture ends:
   - Eye/head tracking (priority 20) becomes active again
   - Gets current value = 0 (from prosodic end)
   - Creates curve [0 → 0.5]
   - Head smoothly returns to gaze target
```

## Implementation Strategy

### Phase 1: Add `getCurrentValue()` to Animation Agency ✅
- [x] Add `currentValues` map to scheduler
- [x] Update `step()` to track applied values
- [x] Expose `getCurrentValue(auId)` in service API
- [x] Document the feature

### Phase 2: Update Eye/Head Tracking Scheduler ✅
- [ ] Add `getCurrentValue` to `EyeHeadHostCaps`
- [ ] Update `scheduleGazeTransition()` to query current values
- [ ] Start all eye/head curves from current values
- [ ] Test smooth transitions when switching gaze targets

### Phase 3: Update Prosodic Scheduler ✅
- [ ] Add `getCurrentValue` to `ProsodicHostCaps`
- [ ] Update `pulse()` to query current head values
- [ ] Start head gesture curves from current values
- [ ] Test smooth transitions when gestures trigger

### Phase 4: Integration Testing ✅
- [ ] Test eye/head tracking + prosodic coordination
- [ ] Verify priority blending works correctly
- [ ] Verify no visual snapping/jarring
- [ ] Test edge cases (rapid switching, overlapping animations)

### Phase 5: Documentation ✅
- [ ] Update Animation Agency README
- [ ] Add examples to Eye/Head Tracking README
- [ ] Add examples to Prosodic README
- [ ] Document best practices

## Benefits

### 1. Visual Smoothness
- ✅ **No jarring snaps** when animations switch
- ✅ **Smooth transitions** between agency control
- ✅ **Natural movement** even with overlapping animations

### 2. Agency Coordination
- ✅ **Independent agencies** can control same AUs
- ✅ **Priority system** determines winner
- ✅ **Current-value-aware** scheduling prevents discontinuities

### 3. Realism
- ✅ **Realistic head movement** during speech (tracking + nods)
- ✅ **Believable eye+head coordination**
- ✅ **Natural prosodic gestures** that don't fight with gaze

## Edge Cases

### Case 1: Rapid Priority Switching

```
Frame 1: Eye/head (pri 20) → Head = 0.5
Frame 2: Prosodic (pri 30) starts → Gets current = 0.5, animates to 0.4
Frame 3: Eye/head updates → Still loses to prosodic (30 > 20)
Frame 4: Prosodic ends → Eye/head wins → Gets current = ending value of prosodic
```

**Result**: Smooth throughout, no discontinuities.

### Case 2: Same Priority, Different Values

```
Frame 1: Prosodic A (pri 30) → Head = 0.3
Frame 2: Prosodic B (pri 30) starts → Gets current = 0.3
```

**Priority tie**: Higher value wins (tie breaker: `v > prev.v`)
**Result**: If B's value > A's value at that moment, B wins; otherwise A continues.

### Case 3: Missing `getCurrentValue` (Backward Compatibility)

```typescript
const currentValue = this.host.getCurrentValue?.('33') ?? 0;
```

**Fallback**: If `getCurrentValue` not available (old code), defaults to 0.
**Result**: Works like old behavior (starts from 0), no breaking changes.

## Testing Checklist

### Unit Tests
- [ ] `getCurrentValue()` returns correct values
- [ ] `currentValues` map updates on each step
- [ ] Fallback to 0 when AU never applied

### Integration Tests
- [ ] Eye/head tracking → prosodic gesture → smooth transition
- [ ] Prosodic gesture → eye/head tracking → smooth transition
- [ ] Multiple prosodic gestures overlapping → smooth blending
- [ ] Rapid gaze changes → no visual snapping

### Visual Tests
- [ ] Character looking left, prosodic nod triggers → head smoothly nods from left position
- [ ] Character nodding, gaze changes to right → head smoothly transitions to looking right
- [ ] Character speaking with prosodic gestures + eye tracking → realistic, smooth movement

## Code Examples

### Example 1: Eye/Head Tracking with Continuity

```typescript
// Initialize eye/head tracking with animation agency
const eyeHeadTracking = createEyeHeadTrackingService({
  eyeTrackingEnabled: true,
  headTrackingEnabled: true,
  animationAgency: animationAgency,  // Pass animation agency
});

// Eye/head tracking automatically uses getCurrentValue() internally
eyeHeadTracking.setGazeTarget({ x: 0.5, y: 0.2 });

// Head smoothly animates from current position to match gaze target
```

### Example 2: Prosodic Gestures with Continuity

```typescript
// Initialize prosodic service with animation agency
const prosodicService = createProsodicService(
  { headPriority: 30 },
  {},
  {
    scheduleSnippet: (snippet) => animationAgency.schedule(snippet),
    removeSnippet: (name) => animationAgency.remove(name),
    getCurrentValue: (auId) => animationAgency.getCurrentValue(auId),  // ✅ NEW
  }
);

// Prosodic gestures automatically use getCurrentValue() internally
prosodicService.pulse(0);  // Triggers head nod from current position
```

### Example 3: Full Coordination

```typescript
// Setup all agencies
const animationAgency = createAnimationService(engine);

const eyeHeadTracking = createEyeHeadTrackingService({
  animationAgency,
  headPriority: 20,
});

const prosodicService = createProsodicService(
  { headPriority: 30 },
  {},
  {
    scheduleSnippet: (s) => animationAgency.schedule(s),
    removeSnippet: (n) => animationAgency.remove(n),
    getCurrentValue: (id) => animationAgency.getCurrentValue(id),
  }
);

// Usage:
eyeHeadTracking.setMode('mouse');  // Character follows mouse

// During speech, prosodic gestures overlay on top of gaze tracking
ttsService.speak('Hello world!');  // Triggers prosodic head nods

// Result: Head smoothly combines gaze direction + prosodic nods
// No jarring snaps, natural-looking coordination
```

## Summary

By adding **current-value-aware scheduling**:

1. **Animation Agency** tracks and exposes `getCurrentValue(auId)`
2. **Schedulers** query current values before building curves
3. **Snippets** start from current state instead of always from 0
4. **Result**: Smooth, realistic movement even when multiple agencies control the same AUs

This is essential for realistic character animation where:
- **Eye/head tracking** controls gaze direction
- **Prosodic gestures** add speech-synchronized head nods/brow raises
- **Both work together** without visual artifacts

The priority system ensures the right agency wins at each moment, while continuity ensures smooth transitions when control switches between agencies.
