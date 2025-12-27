# Eye/Head Tracking Animation Approach

## Problem Statement

We want to use the animation service (curve scheduling) for eye/head tracking instead of direct composite method calls, but the composite methods need to coordinate multiple AUs and bones simultaneously.

## Current Working Approach (Direct Composite)

```typescript
// Direct composite calls (WORKING)
engine.applyEyeComposite(yaw, pitch);     // yaw: -1 to +1, pitch: -1 to +1
engine.applyHeadComposite(yaw, pitch, roll);
```

This works because `applyCompositeMotion` internally:
- Splits continuum values into directional AU pairs (e.g., yaw=-0.5 → AU61=0.5, AU62=0)
- Applies morphs for each direction
- Applies coordinated bone rotations using `applyBoneComposite`
- Updates both morphs AND bones in sync

## Challenge with Animation Scheduling

The animation service schedules individual AU curves:
```typescript
anim.schedule({
  name: 'eyeGaze',
  curves: {
    '61': [{ time: 0, intensity: 0.5 }],  // Individual AU
    '62': [{ time: 0, intensity: 0 }]
  }
});
```

Then the animation service calls:
```typescript
engine.setAU(61, 0.5);  // Individual AU application
engine.setAU(62, 0);
```

### Why This Breaks Composite Movement

When `setAU` is called for composite AUs (61, 62, 63, 64, 31, 32, 33, 54):
1. It applies the morph for that AU
2. It updates the bone rotation state
3. It calls `applyCompositeRotation` for the affected bone

BUT - the bone rotation state expects CONTINUUM values (e.g., -0.5 for left), not individual AU intensities (0.5 for AU61 + 0 for AU62).

The `setAU` logic tries to reconstruct the continuum value from the AU pair:
```typescript
if (axisConfig.negative !== undefined && axisConfig.positive !== undefined) {
  const negValue = this.auValues[axisConfig.negative] ?? 0;
  const posValue = this.auValues[axisConfig.positive] ?? 0;
  axisValue = posValue - negValue;  // Reconstruct continuum
}
```

This works IF both AUs are set, but with animation scheduling:
- Different snippets may set different AUs at different times
- Priority blending may mix values from different snippets
- Result: partial/incorrect movement

## Potential Solutions

### Solution 1: Virtual Continuum AUs

Create virtual AU IDs that represent continuum values:
```typescript
// Virtual AUs (100-series for continuums)
anim.schedule({
  name: 'eyeGaze',
  curves: {
    '100': [{ time: 0, intensity: -0.5 }],  // Eye yaw continuum (-1 to +1)
    '101': [{ time: 0, intensity: 0.3 }]    // Eye pitch continuum (-1 to +1)
  }
});
```

Then in animation service `applyAU`:
```typescript
if (id >= 100 && id < 200) {
  // Virtual continuum AU - call composite method
  switch(id) {
    case 100: // Eye yaw continuum
      engine.updateEyeYaw(v);  // Updates both AU61/62 and bone state
      break;
    case 101: // Eye pitch continuum
      engine.updateEyePitch(v);
      break;
    // ... etc
  }
}
```

### Solution 2: Special Snippet Category

Mark eye/head tracking snippets with a special category that triggers composite handling:
```typescript
anim.schedule({
  name: 'eyeGaze',
  snippetCategory: 'composite_eye',  // Special category
  curves: {
    'yaw': [{ time: 0, intensity: -0.5 }],   // Continuum values
    'pitch': [{ time: 0, intensity: 0.3 }]
  }
});
```

### Solution 3: Keep Direct Composite (Current)

Accept that real-time tracking needs direct composite calls because:
- Sub-frame latency requirements
- Need for coordinated multi-AU updates
- Simplicity and performance

Use animation service ONLY for:
- Pre-authored animation clips
- Lip-sync visemes
- Emotional expressions
- Idle behaviors

Use direct composite calls for:
- Real-time tracking (mouse, webcam)
- Interactive gaze control
- Reactive behaviors

## Implemented Solution: Directional Animation Snippets with Real AU IDs

We've implemented a **directional animation approach** that uses real ARKit AU IDs (61-64, 51-56) to schedule eye/head tracking animations.

### How It Works

1. **Real ARKit AU IDs** (same as continuum sliders):
   ```typescript
   const EYE_HEAD_AUS = {
     // Eye AUs (handle blend shapes + eye bones via applyCompositeMotion)
     EYE_YAW_LEFT: '61',    // Negative yaw
     EYE_YAW_RIGHT: '62',   // Positive yaw
     EYE_PITCH_UP: '63',    // Positive pitch
     EYE_PITCH_DOWN: '64',  // Negative pitch

     // Head AUs (M51-M56 in FACS notation - handle blend shapes + head/neck bones via applyCompositeMotion)
     HEAD_YAW_LEFT: '51',   // Turn left
     HEAD_YAW_RIGHT: '52',  // Turn right
     HEAD_PITCH_UP: '53',   // Look up
     HEAD_PITCH_DOWN: '54', // Look down
   };
   ```

2. **Scheduler creates directional animation curves**:
   ```typescript
   // Mouse at (x=-0.5, y=0.3) → Schedule two animations with intensity scaling

   // Eye look left with 50% intensity
   anim.schedule({
     name: 'eyeHeadTracking/eyeYawLeft',
     curves: {
       '61': [
         { time: 0, intensity: 0 },    // Start at neutral
         { time: 0.2, intensity: 1.0 } // Animate to full over 200ms
       ]
     },
     snippetCategory: 'eyeHeadTracking',
     snippetPriority: 20,
     snippetIntensityScale: 0.5  // 50% intensity from mouse x=-0.5
   });

   // Eye look up with 30% intensity
   anim.schedule({
     name: 'eyeHeadTracking/eyePitchUp',
     curves: {
       '63': [
         { time: 0, intensity: 0 },
         { time: 0.2, intensity: 1.0 }
       ]
     },
     snippetCategory: 'eyeHeadTracking',
     snippetPriority: 20,
     snippetIntensityScale: 0.3  // 30% intensity from mouse y=0.3
   });
   ```

3. **Animation service calls setAU() with real AU IDs**:
   ```typescript
   // Animation service interpolates curves and calls:
   engine.setAU(61, 0.5);  // Eye yaw left at 50% (from snippetIntensityScale)
   engine.setAU(63, 0.3);  // Eye pitch up at 30%

   // setAU() internally calls applyCompositeMotion() which:
   // 1. Applies morphs (Eye_L_Look_L, Eye_R_Look_L, Eye_L_Look_Up, Eye_R_Look_Up)
   // 2. Applies bone rotations (EYE_L and EYE_R bones rotate by ry and rx)
   // 3. Both happen in the SAME operation, coordinated by applyCompositeMotion()
   ```

### Benefits

✅ **Uses animation service** - Full priority blending, curves, timing
✅ **Uses existing AU infrastructure** - Same AUs as continuum sliders (61-64, 31-33, 54-56)
✅ **Preserves composite behavior** - `setAU()` → `applyCompositeMotion()` → morphs + bones together
✅ **No virtual AU complexity** - Direct use of real ARKit AUs
✅ **Intensity scaling** - `snippetIntensityScale` controls strength of each direction
✅ **Animation blending** - Animation service blends multiple directions (e.g., left + up)

### How Blend Shapes + Bones Work Together

The key is that **real ARKit AUs (61-64, 31-33, 54-56) are MIXED_AUS** - they control BOTH morphs and bones:

```typescript
// When animation service calls setAU(61, 0.5):
1. setAU() updates tracked state (currentEyeYaw)
2. Calls applyCompositeMotion(61, 63, yaw, pitch, 64)
3. applyCompositeMotion() does TWO things:
   a. applyBoneComposite() - Rotates EYE_L and EYE_R bones (always full intensity)
   b. applyMorphs() - Applies Eye_L_Look_L and Eye_R_Look_L morphs (scaled by mix weight)
4. Final result: Eyeball rotation + eyelid deformation, perfectly synchronized
```

This is EXACTLY how the continuum sliders work - by using the same real AU IDs, we get the same coordinated morph+bone behavior.

### Comparison with Direct Composite

| Aspect | Direct Composite | Directional Animation Snippets |
|--------|------------------|-------------------------------|
| **Simplicity** | ✅ Very simple | ⚠️ More setup (animation curves) |
| **Performance** | ✅ Direct calls | ✅ Same AU pipeline, minimal overhead |
| **Animation Integration** | ❌ Bypasses animation service | ✅ Full animation service integration |
| **Priority Blending** | ❌ Not supported | ✅ Supported (blend with lip-sync, expressions) |
| **Timing/Curves** | ❌ Manual implementation | ✅ Built-in easing and curves |
| **Composite Coordination** | ✅ Direct composite calls | ✅ Same composite calls via setAU() |

### Implementation

See [eyeHeadTrackingScheduler_v2.ts](eyeHeadTrackingScheduler_v2.ts) for the scheduler implementation that creates directional animation snippets with real AU IDs.

## Input Coordinate Handling

The eye/head tracking system receives input from two sources: mouse tracking and webcam tracking. Each requires different coordinate processing.

### Mouse Tracking Coordinates

Mouse tracking uses **mirror behavior** - when the mouse moves left, the character looks right (at the user):

```typescript
// Mouse coordinates (mirrored for natural interaction)
const x = -((e.clientX / window.innerWidth) * 2 - 1);   // Negate X for mirror
const y = -((e.clientY / window.innerHeight) * 2 - 1);  // Negate Y for coordinate flip
```

**Why negate both**:
- **X negation**: Creates mirror behavior - mouse left → character looks right (at the user)
- **Y negation**: Converts from screen coordinates (Y=0 at top) to standard coordinates (negative Y is down)

### Webcam Tracking Coordinates

Webcam tracking processes face landmarks from BlazeFace and converts them to gaze coordinates:

```typescript
// Webcam coordinates (camera already mirrors image)
const gazeX = (avgX * 2 - 1);   // NO negation - webcam already mirrors horizontally
const gazeY = -(avgY * 2 - 1);  // Negate to flip Y axis
```

**Why different from mouse**:
- **X NOT negated**: The webcam video feed is **already horizontally mirrored** by the camera hardware (like looking in a mirror). Negating X would cause double inversion.
- **Y still negated**: Webcam Y coordinates are top-down (0 at top), so we still need to negate for coordinate system conversion.

### Critical Difference

The key insight is that **webcam feeds are pre-mirrored by camera hardware**:

| Input Source | X Negation | Y Negation | Reason |
|-------------|-----------|-----------|---------|
| **Mouse** | ✅ Yes | ✅ Yes | Manual mirror behavior + coordinate flip |
| **Webcam** | ❌ No | ✅ Yes | Camera already mirrors + coordinate flip |

**Testing note**: When testing webcam tracking, if the character's gaze moves in the opposite direction from your movements, check that X is NOT being negated. The webcam image itself should appear mirrored (like a mirror), but the gaze tracking should feel natural (you move left → character looks at you on the left).
