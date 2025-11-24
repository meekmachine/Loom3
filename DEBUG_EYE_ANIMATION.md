# Debug Eye Animation Issues

## Issues Reported

1. **Eye Yaw** - Only blend shapes animate, bones don't rotate
2. **Eye Pitch** - Eyes only go up, not down

## Debug Steps

### 1. Check if Eye Bones Exist

```javascript
// Check if eye bones were found
console.log('Eye bones:', {
  leftEye: facslib.bones.EYE_L,
  rightEye: facslib.bones.EYE_R
});

// Should show objects with { obj, basePos, baseQuat, baseEuler }
// If undefined, bones weren't found during model loading
```

### 2. Check Mix Weights

```javascript
// Check current mix weights for eye AUs
console.log('Eye mix weights:', {
  AU61: facslib.getAUMixWeight(61),  // Left
  AU62: facslib.getAUMixWeight(62),  // Right
  AU63: facslib.getAUMixWeight(63),  // Up
  AU64: facslib.getAUMixWeight(64)   // Down
});

// Should be 0.5 (50% bone, 50% morph)
// If 0.0, only morphs will work
```

### 3. Manually Set Mix Weight to Full Bone

```javascript
// Try 100% bone control
facslib.setAUMixWeight(61, 1.0);
facslib.setAUMixWeight(62, 1.0);
facslib.setAUMixWeight(63, 1.0);
facslib.setAUMixWeight(64, 1.0);

// Then test animation
anim.loadFromLocal('eyeHeadTrackingAnimationsList/eyeYaw_fullRange');
anim.play();
```

### 4. Test Direct Continuum Methods

```javascript
// Test horizontal (should move eyes left/right)
facslib.setEyesHorizontal(-1.0);  // Full left
await new Promise(r => setTimeout(r, 500));
facslib.setEyesHorizontal(0.0);   // Neutral
await new Promise(r => setTimeout(r, 500));
facslib.setEyesHorizontal(1.0);   // Full right

// Test vertical (should move eyes up/down)
facslib.setEyesVertical(-1.0);  // Full down
await new Promise(r => setTimeout(r, 500));
facslib.setEyesVertical(0.0);   // Neutral
await new Promise(r => setTimeout(r, 500));
facslib.setEyesVertical(1.0);   // Full up
```

### 5. Check Animation Scheduler Logs

The console should show logs like:
```
[Scheduler] Continuum: EYE_L.yaw = -1.00 (AU61=1.00, AU62=0.00) → setEyesHorizontal()
[Scheduler] Continuum: EYE_R.yaw = -1.00 (AU61=1.00, AU62=0.00) → setEyesHorizontal()
```

If you don't see these, the continuum detection isn't working.

### 6. Check Eye Bone Rotation

```javascript
// After moving eyes, check if bones rotated
const leftEye = facslib.bones.EYE_L?.obj;
const rightEye = facslib.bones.EYE_R?.obj;

console.log('Left eye rotation:', leftEye?.rotation);
console.log('Right eye rotation:', rightEye?.rotation);

// x, y, z should change when eyes move
```

## Possible Issues & Fixes

### Issue: Bones Not Found

**Symptoms**: `facslib.bones.EYE_L` is `undefined`

**Fix**: Check model bone names
```javascript
// List all bones in model
facslib.model?.traverse((child) => {
  if (child.type === 'Bone') {
    console.log('Bone:', child.name);
  }
});

// Look for eye bone names
// Common patterns: "Eye_L", "LeftEye", "CC_Base_Eye_L", etc.
```

### Issue: Mix Weight is 0

**Symptoms**: `getAUMixWeight(61)` returns `0.0`

**Fix**: Set mix weight manually
```javascript
// Set to 0.5 (50/50 bone and morph)
facslib.setAUMixWeight(61, 0.5);
facslib.setAUMixWeight(62, 0.5);
facslib.setAUMixWeight(63, 0.5);
facslib.setAUMixWeight(64, 0.5);
```

### Issue: Wrong Axis Configuration

**Symptoms**: Eyes rotate but in wrong direction or axis

**Fix**: Check EYE_AXIS configuration
```javascript
// Current config uses rz for yaw, rx for pitch
// If your model uses different axes, modify shapeDict.ts:

export const EYE_AXIS = {
  yaw: 'ry',   // Try 'ry' instead of 'rz'
  pitch: 'rx'  // Or try 'rz' if rx doesn't work
};
```

### Issue: Down Direction Not Working

**Symptoms**: Eyes go up (AU 63) but not down (AU 64)

**Possible Causes**:
1. Down AU (64) morph doesn't exist in model
2. Bone rotation for down direction is inverted
3. Mix weight is different for AU 64

**Debug**:
```javascript
// Check if down morph exists
const morphDict = facslib.meshes[0]?.morphTargetDictionary;
console.log('Down morphs:', {
  'Eye_L_Look_Down': morphDict?.['Eye_L_Look_Down'],
  'Eye_R_Look_Down': morphDict?.['Eye_R_Look_Down'],
  'eyeLookDownLeft': morphDict?.['eyeLookDownLeft'],
  'eyeLookDownRight': morphDict?.['eyeLookDownRight']
});

// Test down movement directly
facslib.setAU(64, 1.0);  // Should make eyes look down
```

### Issue: Pitch Inverted

**Symptoms**: Up and down are swapped

**Fix**: The pitch direction in applyCompositeMotion might be inverted
```javascript
// In the snippet, positive pitch should be up
// If it's backwards, the issue is in applyCompositeMotion

// Test:
facslib.setEyesVertical(1.0);   // Should look UP
facslib.setEyesVertical(-1.0);  // Should look DOWN
```

## Quick Fix Script

Run this to diagnose and fix common issues:

```javascript
async function diagnoseEyes() {
  console.log('=== Eye Animation Diagnostic ===');

  // 1. Check bones
  console.log('\n1. Eye Bones:', {
    left: !!facslib.bones.EYE_L,
    right: !!facslib.bones.EYE_R
  });

  // 2. Check mix weights
  console.log('\n2. Mix Weights:', {
    AU61: facslib.getAUMixWeight(61),
    AU62: facslib.getAUMixWeight(62),
    AU63: facslib.getAUMixWeight(63),
    AU64: facslib.getAUMixWeight(64)
  });

  // 3. Check morphs
  const dict = facslib.meshes[0]?.morphTargetDictionary;
  console.log('\n3. Eye Morphs Exist:', {
    lookLeft: !!dict?.['Eye_L_Look_L'] || !!dict?.['eyeLookLeftLeft'],
    lookRight: !!dict?.['Eye_L_Look_R'] || !!dict?.['eyeLookRightLeft'],
    lookUp: !!dict?.['Eye_L_Look_Up'] || !!dict?.['eyeLookUpLeft'],
    lookDown: !!dict?.['Eye_L_Look_Down'] || !!dict?.['eyeLookDownLeft']
  });

  // 4. Test horizontal movement
  console.log('\n4. Testing horizontal...');
  facslib.setEyesHorizontal(-1.0);
  await new Promise(r => setTimeout(r, 1000));
  facslib.setEyesHorizontal(1.0);
  await new Promise(r => setTimeout(r, 1000));
  facslib.setEyesHorizontal(0.0);

  // 5. Test vertical movement
  console.log('\n5. Testing vertical...');
  facslib.setEyesVertical(-1.0);
  await new Promise(r => setTimeout(r, 1000));
  facslib.setEyesVertical(1.0);
  await new Promise(r => setTimeout(r, 1000));
  facslib.setEyesVertical(0.0);

  console.log('\n=== Diagnostic Complete ===');
  console.log('Did eyes move? Check above for issues.');
}

diagnoseEyes();
```

## Expected Behavior

✅ **Eye Yaw** (horizontal):
- AU 61 at 100% = Eyes look fully left
- AU 62 at 100% = Eyes look fully right
- Both bones AND morphs should move

✅ **Eye Pitch** (vertical):
- AU 64 at 100% = Eyes look fully down
- AU 63 at 100% = Eyes look fully up
- Both bones AND morphs should move

If only morphs move, bones aren't being rotated (check mix weight or bone existence).
If only one direction works, check morph names or axis configuration.
