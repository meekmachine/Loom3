# Eye & Head Tracking Animation Snippets

Comprehensive collection of continuum-based animation snippets for natural eye and head movements.

## 🎯 Quick Reference

### Eyes - Single Direction
- **`eyeScanLeft.json`** - Quick glance left (80% intensity, 0.3s)
- **`eyeScanRight.json`** - Quick glance right (80% intensity, 0.3s)
- **`eyeScanUp.json`** - Look up (70% intensity, 0.3s)
- **`eyeScanDown.json`** - Look down (60% intensity, 0.3s)

### Eyes - Sweep Motions
- **`eyeYaw.json`** - Full horizontal sweep: left → neutral → right (1s)
- **`eyePitch.json`** - Full vertical sweep: down → neutral → up (1s)
- **`eyesSweepHorizontal.json`** - Extended horizontal: left → right → neutral → left (2s)
- **`eyesSweepVertical.json`** - Extended vertical: down → up → neutral → down (2s)

### Eyes - Diagonal
- **`lookUpRight.json`** - Diagonal up-right (70% horiz, 50% vert, 0.4s)
- **`lookDownLeft.json`** - Diagonal down-left (70% horiz, 60% vert, 0.4s)

### Head - Single Direction
- **`headTurnLeft.json`** - Turn head left (60% intensity, 0.5s)
- **`headTurnRight.json`** - Turn head right (60% intensity, 0.5s)
- **`headLookUp.json`** - Tilt head up (40% intensity, 0.5s)
- **`headLookDown.json`** - Tilt head down (50% intensity, 0.5s)
- **`headRoll.json`** - Tilt head left ↔ right (roll axis test, 0.4s)

- **`headYaw.json`** - Full horizontal sweep: left → neutral → right (1s)
- **`headPitch.json`** - Full vertical sweep: down → neutral → up (1s)
- **`headRollCircular.json`** - Circular head roll (yaw + pitch + roll, 1.2s)
- **`headSweepHorizontal.json`** - Extended sweep: left → right → neutral → left (3s)
- **`headNod.json`** - Double nod gesture (2 nods, 0.8s total)
- **`headShake.json`** - Head shake "no" gesture (0.75s)

### Utility
- **`returnToNeutral.json`** - Smoothly return all eyes/head to neutral (0.6-0.8s)

## 🚀 Usage Examples

### Basic Playback
```javascript
// Load and play a snippet
anim.loadFromLocal('eyeHeadTrackingAnimationsList/eyeScanLeft');
anim.play();
```

### Chaining Animations
```javascript
// Look around naturally
anim.loadFromLocal('eyeHeadTrackingAnimationsList/eyeScanLeft');
setTimeout(() => {
  anim.loadFromLocal('eyeHeadTrackingAnimationsList/eyeScanRight');
}, 500);
setTimeout(() => {
  anim.loadFromLocal('eyeHeadTrackingAnimationsList/returnToNeutral');
}, 1000);
```

### Combining Eyes + Head
```javascript
// Head follows eyes (with delay)
anim.loadFromLocal('eyeHeadTrackingAnimationsList/eyeScanRight');
setTimeout(() => {
  anim.loadFromLocal('eyeHeadTrackingAnimationsList/headTurnRight');
}, 200); // Head follows 200ms after eyes start
```

### Custom Intensity
```javascript
// Load snippet
const snippet = anim.loadFromLocal('eyeHeadTrackingAnimationsList/headNod');

// Reduce intensity to 50%
anim.setSnippetIntensityScale('headNod', 0.5);
anim.play();
```

## 📊 Snippet Structure

All snippets use the continuum AU system:

### Eye Continuums
- **Horizontal (Yaw)**: AU 61 (left) ↔ AU 62 (right)
- **Vertical (Pitch)**: AU 64 (down) ↔ AU 63 (up)

### Head Continuums
- **Horizontal (Yaw)**: AU 31 (left) ↔ AU 32 (right)
- **Vertical (Pitch)**: AU 54 (down) ↔ AU 33 (up)
- **Roll (Tilt)**: AU 55 (left) ↔ AU 56 (right)

Example snippet structure:
```json
{
  "name": "eyeScanLeft",
  "curves": {
    "61": [
      { "time": 0, "intensity": 0, "inherit": true },
      { "time": 0.3, "intensity": 80 }
    ],
    "62": [
      { "time": 0, "intensity": 0 },
      { "time": 0.3, "intensity": 0 }
    ]
  },
  "snippetCategory": "eyeHeadTracking",
  "snippetPriority": 20,
  "loop": false
}
```

### Seamless looping

- Set `"loop": true` on snippets you want to repeat.
- Mark the first keyframe of each AU curve with `"inherit": true`. The animation agency will re-seed that keyframe with the current AU value whenever the snippet (re)starts or loops, preventing snaps back to neutral mid-loop.

The animation scheduler automatically:
1. Detects the continuum pair (AU 61 + 62)
2. Calculates continuum value: `posValue - negValue = 0 - 0.8 = -0.8`
3. Calls: `engine.setEyesHorizontal(-0.8)`
4. EngineThree applies proper bone + morph mixing

## 🎨 Animation Design Notes

### Intensity Ranges
- **Eyes**: 60-100% - Eyes have good range
- **Head Yaw**: 60-80% - Natural head turning
- **Head Pitch**: 40-50% - Conservative vertical movement
- **Head Roll**: 35% - Subtle tilting for natural look

### Timing
- **Quick glances**: 0.3s - Fast eye movements
- **Normal movements**: 0.4-0.5s - Standard actions
- **Sweeps**: 1-3s - Smooth continuous motion
- **Gestures**: 0.75-0.8s - Nod/shake timing

### Priority Levels
- **Eyes (20)**: Higher priority - eyes lead
- **Head (15)**: Lower priority - head follows
- **Return to Neutral (25)**: Highest - always wins

## 🔧 Advanced Usage

### Dynamic Snippet Creation
```javascript
// Create custom eye movement
anim.schedule({
  name: 'custom_eye_diagonal',
  curves: {
    '62': [{ time: 0, intensity: 0 }, { time: 0.5, intensity: 0.9 }], // Right
    '63': [{ time: 0, intensity: 0 }, { time: 0.5, intensity: 0.6 }]  // Up
  },
  snippetCategory: 'eyeHeadTracking',
  snippetPriority: 20,
  loop: false
});
```

### Additive Blending
```javascript
// Combine head nod with slight turn
const nod = anim.loadFromLocal('eyeHeadTrackingAnimationsList/headNod');
const turnRight = anim.loadFromLocal('eyeHeadTrackingAnimationsList/headTurnRight');

// Set turn to additive mode
anim.setSnippetBlendMode('headTurnRight', 'additive');
anim.setSnippetIntensityScale('headTurnRight', 0.3);
```

## 🐛 Debugging

Enable continuum debug logs (already enabled):
```javascript
// Watch console for:
// [Scheduler] Continuum: EYE_L.yaw = -0.80 (AU61=0.80, AU62=0.00) → setEyesHorizontal()
```

Check current snippet state:
```javascript
const state = anim.getState();
console.log('Active snippets:', state.context.animations.map(s => s.name));
```

## 📝 Creating New Snippets

1. **Choose AUs**: Pick the continuum pair for your movement
2. **Set timing**: Use appropriate duration for the action
3. **Balance intensity**: Consider natural ranges
4. **Name clearly**: Descriptive names help organization
5. **Set priority**: Eyes (20), Head (15), or higher for overrides

Template:
```json
{
  "name": "your_snippet_name",
  "curves": {
    "AU_NEGATIVE": [
      { "time": 0, "intensity": START },
      { "time": DURATION, "intensity": END }
    ],
    "AU_POSITIVE": [
      { "time": 0, "intensity": START },
      { "time": DURATION, "intensity": END }
    ]
  },
  "snippetCategory": "eyeHeadTracking",
  "snippetPriority": 20,
  "loop": false
}
```

## ✅ Testing Checklist

After creating a new snippet:
- [ ] Load snippet: `anim.loadFromLocal('eyeHeadTrackingAnimationsList/yourSnippet')`
- [ ] Check console logs show correct continuum values
- [ ] Verify smooth motion (no jumps or stutters)
- [ ] Test with different intensity scales
- [ ] Confirm proper return to neutral
- [ ] Try combining with other snippets

## 🎯 Animation Categories

| Category | Purpose | Examples |
|----------|---------|----------|
| **Scanning** | Quick directional glances | eyeScanLeft, eyeScanRight |
| **Sweeping** | Smooth continuous motion | eyesSweepHorizontal, headSweepHorizontal |
| **Gestures** | Communicative movements | headNod, headShake |
| **Positioning** | Move to specific angle | headTurnLeft, lookUpRight |
| **Reset** | Return to neutral | returnToNeutral |

## 🔗 Integration with EyeHeadTrackingService

These snippets work seamlessly with the Eye/Head Tracking Service:
- Mouse tracking mode uses dynamic snippets
- Webcam tracking mode uses dynamic snippets
- Manual control can load these snippets directly
- All modes benefit from continuum-aware scheduling

See [`src/latticework/eyeHeadTracking/`](../../eyeHeadTracking/) for service integration.
