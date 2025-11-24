# Testing Eye/Head Continuum Animation

## Expected Behavior

The `eyeYaw.json` and `eyePitch.json` snippets should cover the FULL continuum range:

### eyeYaw.json (Eyes Horizontal)
```
Time 0.0s: AU61=100%, AU62=0%   → continuum = -1.0  (FULL LEFT)
Time 0.5s: AU61=0%,   AU62=0%   → continuum =  0.0  (NEUTRAL)
Time 1.0s: AU61=0%,   AU62=100% → continuum = +1.0  (FULL RIGHT)
```

### eyePitch.json (Eyes Vertical)
```
Time 0.0s: AU64=100%, AU63=0%   → continuum = -1.0  (FULL DOWN)
Time 0.5s: AU64=0%,   AU63=0%   → continuum =  0.0  (NEUTRAL)
Time 1.0s: AU64=0%,   AU63=100% → continuum = +1.0  (FULL UP)
```

## How to Test

### 1. Open Browser Console

Press F12 or right-click → Inspect → Console

### 2. Load and Play Eye Yaw Snippet

```javascript
// Load the snippet
const eyeYaw = anim.loadFromLocal('eyeHeadTrackingAnimationsList/eyeYaw');
console.log('Loaded:', eyeYaw);

// Start playback (if not already playing)
anim.play();
```

**Watch the console output:**
You should see logs like:
```
[Scheduler] Continuum: EYE_L.yaw = -1.00 (AU61=1.00, AU62=0.00) → setEyesHorizontal()
[Scheduler] Continuum: EYE_R.yaw = -1.00 (AU61=1.00, AU62=0.00) → setEyesHorizontal()
```

As the animation plays, the continuum value should change:
- Start: `-1.00` (full left)
- Middle: `0.00` (neutral)
- End: `+1.00` (full right)

### 3. Test Eye Pitch Snippet

```javascript
// Remove previous snippet first
anim.remove('eyeYaw');

// Load eye pitch
const eyePitch = anim.loadFromLocal('eyeHeadTrackingAnimationsList/eyePitch');
```

Should see eyes move from down → neutral → up.

### 4. Test with Manual Snippet

If the snippets aren't working, try creating one manually:

```javascript
// Full left to full right
anim.schedule({
  name: 'test_eye_yaw',
  curves: {
    '61': [
      { time: 0, intensity: 1 },    // Full left
      { time: 1, intensity: 0 }     // Off
    ],
    '62': [
      { time: 0, intensity: 0 },    // Off
      { time: 1, intensity: 1 }     // Full right
    ]
  },
  snippetCategory: 'test',
  snippetPriority: 100,
  loop: false
});
```

## Troubleshooting

### Issue: Eyes only move halfway

**Possible causes:**

1. **Animation continuity is limiting range**
   - The animation agency's `applyContinuity()` sets the first keyframe to current values
   - If eyes are already at 0.5, they might only move from 0.5 to 1.0
   - **Solution**: Reset eyes to neutral first

```javascript
// Reset to neutral
engine.setEyesHorizontal(0);
engine.setEyesVertical(0);

// Then load snippet
anim.loadFromLocal('eyeHeadTrackingAnimationsList/eyeYaw');
```

2. **Mix weight is reducing bone motion**
   - Check if mix weight is limiting bone rotation
   - **Solution**: Check mix weight

```javascript
// Check current mix weight for eye AUs
console.log('AU61 mix:', engine.getAUMixWeight(61));
console.log('AU62 mix:', engine.getAUMixWeight(62));

// Should be 1.0 for full bone control
// If lower, increase it
engine.setAUMixWeight(61, 1.0);
engine.setAUMixWeight(62, 1.0);
```

3. **Snippet intensity scale is reduced**
   - Check if the snippet has intensity scaling applied
   - **Solution**: Check and reset intensity

```javascript
// Check snippet state
const state = anim.getState();
const snippet = state.context.animations.find(s => s.name === 'eyeYaw');
console.log('Snippet intensity scale:', snippet?.snippetIntensityScale);

// Reset to full intensity if needed
anim.setSnippetIntensityScale('eyeYaw', 1.0);
```

4. **Playback rate is affecting timing**
   - Slower playback might make it seem like partial range
   - **Solution**: Check playback rate

```javascript
const snippet = state.context.animations.find(s => s.name === 'eyeYaw');
console.log('Playback rate:', snippet?.snippetPlaybackRate);

// Reset to normal speed
anim.setSnippetPlaybackRate('eyeYaw', 1.0);
```

### Issue: No console logs appearing

If you don't see the `[Scheduler] Continuum:` logs:

1. Check that the snippet is actually loaded:
```javascript
const state = anim.getState();
console.log('Loaded animations:', state.context.animations.map(s => s.name));
```

2. Check that animation is playing:
```javascript
console.log('Is playing:', anim.playing);
```

3. Check that the snippet is enabled:
```javascript
const snippet = state.context.animations.find(s => s.name === 'eyeYaw');
console.log('Is playing:', snippet?.isPlaying);
```

## Verification Script

Run this complete test:

```javascript
// Reset everything
anim.stop();
engine.setEyesHorizontal(0);
engine.setEyesVertical(0);

// Clear all snippets
const state = anim.getState();
state.context.animations.forEach(s => anim.remove(s.name));

// Load fresh snippet
anim.loadFromLocal('eyeHeadTrackingAnimationsList/eyeYaw');

// Start playback
anim.play();

// Watch console for continuum logs showing full -1.0 to +1.0 range
```

## Expected Console Output

```
[Scheduler] load() initialized eyeYaw startWallTime: 1234567890
[Scheduler] Continuum: EYE_L.yaw = -1.00 (AU61=1.00, AU62=0.00) → setEyesHorizontal()
[Scheduler] Continuum: EYE_R.yaw = -1.00 (AU61=1.00, AU62=0.00) → setEyesHorizontal()
... (values change over time)
[Scheduler] Continuum: EYE_L.yaw = 0.00 (AU61=0.00, AU62=0.00) → setEyesHorizontal()
[Scheduler] Continuum: EYE_R.yaw = 0.00 (AU61=0.00, AU62=0.00) → setEyesHorizontal()
... (values change over time)
[Scheduler] Continuum: EYE_L.yaw = 1.00 (AU61=0.00, AU62=1.00) → setEyesHorizontal()
[Scheduler] Continuum: EYE_R.yaw = 1.00 (AU61=0.00, AU62=1.00) → setEyesHorizontal()
```

If you see this full range of values, the continuum system is working correctly! ✅
