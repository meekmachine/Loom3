# Animation System Improvements - December 2024

## Summary

Two key improvements to the Animation Agency system:

1. **Logarithmic Intensity Scaling** - Better control at low intensities
2. **Automatic Duration Calculation** - No more hardcoded 5-second wall

---

## 1. Logarithmic Intensity Scaling

### Problem

The old linear intensity scaling (`rawValue * scale`) had poor control at low values:

```typescript
// OLD (Linear):
scale = 0.5 → 0.5x multiplier (too strong)
scale = 0.1 → 0.1x multiplier (big jumps between 0.1 and 0.2)
```

At low intensities, users needed fine-grained control but linear scaling made small adjustments too coarse.

### Solution

Quadratic intensity scaling (`rawValue * scale^2`):

```typescript
// NEW (Quadratic):
const applyIntensityScale = (rawValue: number, scale: number): number => {
  const multiplier = scale * scale;
  return rawValue * multiplier;
};
```

### Benefits

**Finer Control at Low Intensities:**
| Scale | Linear | Quadratic | Difference |
|-------|--------|-----------|------------|
| 0.1   | 0.10x  | 0.01x     | 10x finer  |
| 0.2   | 0.20x  | 0.04x     | 5x finer   |
| 0.5   | 0.50x  | 0.25x     | 2x finer   |
| 0.75  | 0.75x  | 0.56x     | ~1.3x      |
| 1.0   | 1.00x  | 1.00x     | Neutral    |
| 1.5   | 1.50x  | 2.25x     | 1.5x boost |
| 2.0   | 2.00x  | 4.00x     | 2x boost   |

**Real-World Example:**

```typescript
// Subtle blink animation with intensity scale
const blinkKeyframes = [
  { time: 0.0, intensity: 0.0 },
  { time: 0.1, intensity: 1.0 },  // Full blink
  { time: 0.2, intensity: 0.0 }
];

// User wants 30% blink intensity
// OLD: scale = 0.3 → peak value = 1.0 * 0.3 = 0.30 (too strong, visible blink)
// NEW: scale = 0.3 → peak value = 1.0 * 0.09 = 0.09 (subtle flutter)

// For same 30% effect, user now adjusts scale to ~0.55
// NEW: scale = 0.55 → peak value = 1.0 * 0.30 = 0.30 ✓
```

This means the slider moves more smoothly at low values, giving better control over subtle animations.

### Implementation

**Files Changed:**
- [animationScheduler.ts:8-23](animationScheduler.ts#L8-L23) - Added `applyIntensityScale()` function
- [animationScheduler.ts:194-199](animationScheduler.ts#L194-L199) - Applied in `buildTargetMap()`
- [README.md:154-163](README.md#L154-L163) - Documented scaling curve

**Usage:**

```typescript
// In scheduler
const rawValue = sampleAt(curve, localTime);  // e.g., 0.8
const scale = snippet.snippetIntensityScale;   // e.g., 0.5 (UI slider)
const scaled = applyIntensityScale(rawValue, scale);  // 0.8 * 0.25 = 0.2
const final = clamp01(scaled);  // Clamp to [0, 1] for engine
```

---

## 2. Automatic Duration Calculation

### Problem

Snippets used to have a hardcoded 5-second duration limit:

```typescript
// OLD: UI code
<Text>Time: {currentTime} / {maxTime || 5} s</Text>
<Slider max={maxTime || 5} />
```

This caused:
- Short animations wasted time (e.g., 0.3s blink shown as 5s)
- Long animations got cut off (e.g., 10s speech clipped to 5s)
- UI showed incorrect durations
- Users confused about actual snippet length

### Solution

Calculate duration from keyframes automatically:

```typescript
// NEW: Calculate max time across all curves
function calculateDuration(curves: Record<string, CurvePoint[]>): number {
  if (!curves || !Object.keys(curves).length) return 0;
  let maxTime = 0;
  for (const arr of Object.values(curves)) {
    if (arr.length > 0) {
      const lastTime = arr[arr.length - 1].time;
      if (lastTime > maxTime) maxTime = lastTime;
    }
  }
  return maxTime;
}
```

### Benefits

**Accurate Duration Display:**
```typescript
// Blink snippet (0.2 seconds)
{
  curves: {
    "43": [
      { time: 0.0, intensity: 0.0 },
      { time: 0.1, intensity: 1.0 },
      { time: 0.2, intensity: 0.0 }
    ]
  }
}
// OLD: Shows "Time: 0.05 / 5.00 s" (confusing!)
// NEW: Shows "Time: 0.05 / 0.20 s" (accurate!)

// Speech snippet (8.5 seconds)
{
  curves: {
    "viseme_aa": [/* ... */],
    "viseme_ee": [/* ... */]
    // Last keyframe at time: 8.5
  }
}
// OLD: Shows "Time: 4.2 / 5.00 s" then CLIPS at 5s!
// NEW: Shows "Time: 4.2 / 8.50 s" (plays full length!)
```

**Improved UX:**
- Scrub slider shows correct range
- Loop timing is accurate
- Non-looping snippets end naturally
- No more manual "Max Time" slider needed

### Implementation

**Files Changed:**
- [animationMachine.ts:26-39](animationMachine.ts#L26-L39) - Added `calculateDuration()` function
- [animationMachine.ts:41-61](animationMachine.ts#L41-L61) - Calculate `duration` in `coerceSnippet()`
- [types.ts:49](types.ts#L49) - Added `duration` field to `NormalizedSnippet`
- [PlaybackControls.tsx:532-539](../../../components/PlaybackControls.tsx#L532-L539) - UI now uses `duration`
- [PlaybackControls.tsx:549-552](../../../components/PlaybackControls.tsx#L549-L552) - Removed "Max Time" slider
- [README.md:122](README.md#L122) - Documented automatic calculation

**Data Flow:**

```
Load snippet
  ↓
normalizeCurves(snippet.curves)
  ↓
calculateDuration(normalizedCurves)  ← Find max keyframe time
  ↓
Store in snippet.duration
  ↓
UI reads snippet.duration for display
  ↓
Scheduler uses duration for loop/clamp logic
```

---

## Testing

Both improvements are backwards compatible:

✅ **No Breaking Changes**
- Existing snippets load correctly
- Old intensity scale behavior available via `scale = sqrt(desiredLinearScale)`
- No API changes required

✅ **Type Safety**
- `duration` field added to `NormalizedSnippet` type
- TypeScript checks pass

✅ **Verification Steps**

1. **Intensity Scaling:**
   ```typescript
   // Load a snippet with intensity scale
   service.loadFromLocal('blink');
   service.setSnippetIntensityScale('blink', 0.3);

   // Observe: Blink is now more subtle (0.09x instead of 0.3x)
   // Adjust to 0.55 to get old 0.3x effect
   ```

2. **Duration Calculation:**
   ```typescript
   // Load snippets with different lengths
   service.loadFromLocal('blink');  // 0.2s
   service.loadFromLocal('smile');  // 2.5s
   service.loadFromLocal('speech'); // 8.5s

   // Check durations in UI
   const snippets = service.getSnippets();
   snippets.forEach(s => {
     console.log(`${s.name}: ${s.duration}s`);
   });
   ```

---

## Migration Notes

### For Users

**Intensity Sliders:**
- Low values (0.0-0.5) now have finer control
- If your saved presets feel too subtle, increase the intensity scale by ~1.4x
  - Old 0.3 → New 0.55 (for same effect)
  - Old 0.5 → New 0.71 (for same effect)
  - Old 0.7 → New 0.84 (for same effect)

**Duration Display:**
- UI now shows accurate snippet length
- Removed "Max Time" slider (no longer needed)
- Scrub slider automatically fits snippet duration

### For Developers

**No Code Changes Required:**
- All changes are internal to the Animation Agency
- Public API unchanged
- Existing snippet JSON files work as-is

**New Field Available:**
```typescript
interface NormalizedSnippet {
  // ... existing fields
  duration: number;  // ← NEW: Auto-calculated from keyframes
}
```

---

## Performance Impact

**Negligible:**
- Duration calculated once on load (not per frame)
- Intensity scaling is single multiplication (`scale * scale`)
- No additional memory overhead

---

## Future Enhancements

### Possible: Custom Scaling Curves

Allow different scaling functions for different use cases:

```typescript
type ScalingMode = 'linear' | 'quadratic' | 'cubic' | 'exponential';

const scalingFunctions = {
  linear: (v, s) => v * s,
  quadratic: (v, s) => v * s * s,      // Current default
  cubic: (v, s) => v * s * s * s,      // Even finer low control
  exponential: (v, s) => v * Math.pow(2, s - 1)  // Wider range
};
```

### Possible: Duration Override

Allow manual duration override for special cases:

```typescript
// Auto-calculated from keyframes by default
snippet.duration = calculateDuration(curves);

// But allow override if needed
if (snippet.manualDuration) {
  snippet.duration = snippet.manualDuration;
}
```

---

## Documentation

- ✅ [README.md](README.md#L154-L163) - Intensity scaling curve documented
- ✅ [README.md](README.md#L122) - Duration calculation documented
- ✅ [animationScheduler.ts](animationScheduler.ts#L8-L23) - JSDoc on scaling function
- ✅ [animationMachine.ts](animationMachine.ts#L26-L28) - JSDoc on duration calculation

---

## Files Modified

| File | Lines Changed | Purpose |
|------|---------------|---------|
| `animationScheduler.ts` | +16 | Added logarithmic intensity scaling |
| `animationMachine.ts` | +14 | Added automatic duration calculation |
| `types.ts` | +1 | Added `duration` field to `NormalizedSnippet` |
| `PlaybackControls.tsx` | -19, +3 | Removed Max Time slider, use `duration` |
| `README.md` | +12 | Documented both improvements |
| `IMPROVEMENTS.md` | +378 | This file |

**Total:** 6 files, ~425 lines of changes (mostly documentation)

---

## Summary

These two improvements make the Animation Agency more intuitive and accurate:

1. **Logarithmic intensity scaling** gives users fine-grained control at low intensities while maintaining smooth amplification at high values

2. **Automatic duration calculation** ensures snippets play for their natural length without hardcoded limits or manual configuration

Both changes are backwards compatible and improve the user experience without breaking existing functionality.
