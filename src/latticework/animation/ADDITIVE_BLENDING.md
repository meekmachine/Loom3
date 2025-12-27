# Additive Blending for Cumulative AU Animations

## Problem Statement

When multiple agencies control the same AUs, we want them to **combine cumulatively** instead of competing via priority.

### Example: Head Tracking + Prosodic Nod

- **Eye/Head Tracking**: Controls head yaw (looking left/right) - AU 51, 52
- **Prosodic Expression**: Controls head pitch (nodding up/down) - AU 53, 54

**Desired behavior**: Head should look right AND nod simultaneously
- Yaw = 0.3 (from tracking)
- Pitch = 0.4 (from prosodic)
- **Combined** = looking right WHILE nodding

With **priority-only blending**, one would win and the other would be suppressed. With **additive blending**, both contribute!

## Solution: Snippet Blend Modes

### New Snippet Property: `snippetBlendMode`

```typescript
export type Snippet = {
  // ... existing properties

  /**
   * Blend mode for combining multiple snippets on same AU:
   * - 'replace' (default): Higher priority wins, replaces lower priority values
   * - 'additive': Values are summed together (clamped to [0,1])
   */
  snippetBlendMode?: 'replace' | 'additive';
};
```

### Blending Logic

1. **Replace Mode** (default): Higher priority wins
   - Eye/head tracking (priority 20) vs. Emotional expression (priority 10)
   - Eye/head wins, emotional is suppressed

2. **Additive Mode**: All snippets contribute, values are summed
   - Eye/head tracking (yaw): 0.3
   - Prosodic nod (pitch): 0.4
   - **Both apply simultaneously** (different AUs, no conflict)
   - If same AU: values sum, clamped to [0, 1]

### Implementation in Animation Scheduler

```typescript
// In buildTargetMap():

// Track additive contributions separately
const additiveContributions = new Map<string, Array<{ snippet: string; v: number; pri: number }>>();

for (const sn of snippets) {
  const blendMode = (sn as any).snippetBlendMode ?? 'replace';

  // ADDITIVE: collect all contributions
  if (blendMode === 'additive') {
    additiveContributions.get(curveId)!.push({ snippet: sn.name, v, pri });
    continue;
  }

  // REPLACE: winner-takes-all
  const wins = !prev || pri > prev.pri || (pri === prev.pri && v > prev.v);
  if (wins) {
    targets.set(curveId, { v, pri, durMs, category });
  }
}

// Combine additive snippets with replace winners
for (const [curveId, contributions] of additiveContributions.entries()) {
  const additiveSum = contributions.reduce((sum, c) => sum + c.v, 0);
  const replaceTarget = targets.get(curveId);

  if (replaceTarget) {
    // Combine replace + additive
    const combined = clamp01(replaceTarget.v + additiveSum);
    targets.set(curveId, { ...replaceTarget, v: combined });
  } else {
    // Additive only (no replace-mode winner)
    const combined = clamp01(additiveSum);
    targets.set(curveId, { v: combined, pri: maxAdditivePri, durMs: 120 });
  }
}
```

## Usage Examples

### Example 1: Prosodic Gestures (Additive)

```typescript
// In prosodicScheduler.ts
const animSnippet = {
  name: 'prosodic:nod',
  curves: {
    '33': [  // Head pitch up
      { time: 0.0, intensity: 0 },
      { time: 0.15, intensity: 0.4 },
      { time: 0.75, intensity: 0 }
    ]
  },
  snippetPriority: 30,
  snippetBlendMode: 'additive',  // ✅ Additive mode
};

this.host.scheduleSnippet(animSnippet);
```

**Result**: Head nod COMBINES with any existing head yaw from eye/head tracking

### Example 2: Eye/Head Tracking (Replace)

```typescript
// In eyeHeadTrackingScheduler.ts
animationAgency.schedule({
  name: 'eyeHeadTracking/head',
  curves: {
    '31': [{ time: 0, intensity: 0 }, { time: 0.2, intensity: 0.3 }],  // Yaw left
    '32': [{ time: 0, intensity: 0.5 }, { time: 0.2, intensity: 0 }],  // Yaw right (wins)
  },
  snippetPriority: 20,
  snippetBlendMode: 'replace',  // Default mode
});
```

**Result**: Eye/head tracking sets base gaze direction via replace mode

### Example 3: Combined Head Movement

```
Timeline:

Frame 1:
  - Eye/head tracking (replace, priority 20): Yaw = 0.3 (looking right)
  - Prosodic nod (additive, priority 30): Pitch = 0
  - **Final**: Head yaw = 0.3, pitch = 0 (looking right, neutral pitch)

Frame 10:
  - Eye/head tracking (replace, priority 20): Yaw = 0.3 (looking right)
  - Prosodic nod (additive, priority 30): Pitch = 0.4 (nodding)
  - **Final**: Head yaw = 0.3, pitch = 0.4 (looking right WHILE nodding) ✅

Frame 20:
  - Eye/head tracking (replace, priority 20): Yaw = -0.2 (looking left)
  - Prosodic nod (additive, priority 30): Pitch = 0.2 (nodding down)
  - **Final**: Head yaw = -0.2, pitch = 0.2 (looking left WHILE nodding down) ✅
```

## Console Output

When additive blending is active, you'll see:

```
[Scheduler] Additive blend: AU 33 = 0.000 (replace) + 0.400 (additive) = 0.400
[Scheduler] Additive blend: AU 54 = 0.000 (replace) + 0.200 (additive) = 0.200
```

When multiple additive snippets contribute:

```
[Scheduler] Additive blend: AU 33 = 0.100 (replace) + 0.500 (additive) = 0.600
```

## Best Practices

### When to Use Additive Mode

✅ **Use `additive` for**:
- Prosodic gestures (head nods, brow raises during speech)
- Breathing animations (subtle chest movement)
- Idle variations (small random movements)
- Emotional overlays that should combine with base pose

❌ **Don't use `additive` for**:
- Base poses (neutral, emotions) - use `replace`
- Gaze direction (eye/head tracking) - use `replace`
- Lip-sync (visemes) - use `replace`

### Preventing Excessive Values

Additive blending sums values and clamps to [0, 1]:

```typescript
// Example: Too many additive snippets
Snippet A (additive): AU 33 = 0.5
Snippet B (additive): AU 33 = 0.4
Snippet C (additive): AU 33 = 0.3
// Sum = 1.2, clamped to 1.0
```

**Recommendation**: Keep individual additive intensities moderate (< 0.5) to allow room for combination.

### Combining Replace + Additive

Replace mode sets the "base" value, additive mode adds on top:

```typescript
// Base gaze direction (replace)
eyeHeadTracking.setGazeTarget({ x: 0.3, y: 0 });  // Yaw = 0.3

// Add prosodic nod (additive)
prosodicService.pulse(0);  // Pitch += 0.4

// Final: Yaw = 0.3 (from replace), Pitch = 0.4 (from additive)
```

## Integration with Automatic Continuity

Additive blending works seamlessly with automatic continuity:

```
Frame 1: Eye/head tracking sets head yaw = 0.3
Frame 5: Prosodic nod starts (additive, pitch = 0.4)
  - Animation agency applies continuity to prosodic snippet
  - Prosodic pitch curve starts from CURRENT value (0.0)
  - Smoothly animates 0.0 → 0.4
Frame 10: Combined yaw = 0.3, pitch = 0.4 (smooth transition!)
```

## Testing Checklist

### Unit Tests
- [ ] Additive snippets sum correctly
- [ ] Replace + additive combine correctly
- [ ] Values are clamped to [0, 1]
- [ ] Multiple additive snippets on same AU sum properly

### Integration Tests
- [ ] Eye/head tracking (replace) + prosodic nod (additive) = combined movement
- [ ] Prosodic brow raise (additive) + base emotion (replace) = natural expression
- [ ] Multiple additive snippets combine without fighting

### Visual Tests
- [ ] Character looking left + nodding = looking left WHILE nodding
- [ ] Character looking right + brow raise = looking right WHILE raising brow
- [ ] Character tracking mouse + prosodic gestures = natural combined movement

## Summary

**Additive blending** allows multiple agencies to control the same AUs simultaneously by **summing their contributions** instead of competing via priority.

**Key benefits**:
- ✅ Natural combined movements (tracking + nod, gaze + brow raise)
- ✅ Agencies can specialize without conflicts
- ✅ Works seamlessly with automatic continuity and priority blending
- ✅ Simple to use: just set `snippetBlendMode: 'additive'`

**Default behavior unchanged**: Snippets use `replace` mode by default, maintaining backward compatibility.
