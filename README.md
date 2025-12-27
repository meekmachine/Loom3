# LoomLarge

A FACS-based morph and bone mapping library for controlling high-definition 3D characters in Three.js.

LoomLarge provides pre-built mappings that connect [Facial Action Coding System (FACS)](https://en.wikipedia.org/wiki/Facial_Action_Coding_System) Action Units to the morph targets and bone transforms found in Character Creator 4 (CC4) characters. Instead of manually figuring out which blend shapes correspond to which facial movements, you can simply say `setAU(12, 0.8)` and the library handles the rest.

---

## Table of Contents

1. [Installation & Setup](#1-installation--setup)
2. [Using Presets](#2-using-presets)
3. [Extending & Custom Presets](#3-extending--custom-presets)
4. [Action Unit Control](#4-action-unit-control)
5. [Mix Weight System](#5-mix-weight-system)
6. [Composite Rotation System](#6-composite-rotation-system)
7. [Continuum Pairs](#7-continuum-pairs)
8. [Direct Morph Control](#8-direct-morph-control)
9. [Viseme System](#9-viseme-system)
10. [Transition System](#10-transition-system)
11. [Playback & State Control](#11-playback--state-control)
12. [Hair Physics](#12-hair-physics)

---

## 1. Installation & Setup

### Install the package

```bash
npm install loomlarge
```

### Peer dependency

LoomLarge requires Three.js as a peer dependency:

```bash
npm install three
```

### Basic setup

```typescript
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LoomLargeThree, collectMorphMeshes, CC4_PRESET } from 'loomlarge';

// 1. Create the LoomLarge controller with a preset
const loom = new LoomLargeThree({ auMappings: CC4_PRESET });

// 2. Set up your Three.js scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 3. Load your character model
const loader = new GLTFLoader();
loader.load('/character.glb', (gltf) => {
  scene.add(gltf.scene);

  // 4. Collect all meshes that have morph targets
  const meshes = collectMorphMeshes(gltf.scene);

  // 5. Initialize LoomLarge with the meshes and model
  loom.onReady({ meshes, model: gltf.scene });

  console.log(`Loaded ${meshes.length} meshes with morph targets`);
});

// 6. Animation loop - call loom.update() every frame
let lastTime = performance.now();
function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const deltaSeconds = (now - lastTime) / 1000;
  lastTime = now;

  // Update LoomLarge transitions
  loom.update(deltaSeconds);

  renderer.render(scene, camera);
}
animate();
```

### The `collectMorphMeshes` helper

This utility function traverses a Three.js scene and returns all meshes that have `morphTargetInfluences` (i.e., blend shapes). It's the recommended way to gather meshes for LoomLarge:

```typescript
import { collectMorphMeshes } from 'loomlarge';

const meshes = collectMorphMeshes(gltf.scene);
// Returns: Array of THREE.Mesh objects with morph targets
```

---

## 2. Using Presets

Presets define how FACS Action Units map to your character's morph targets and bones. LoomLarge ships with `CC4_PRESET` for Character Creator 4 characters.

### What's in a preset?

```typescript
import { CC4_PRESET } from 'loomlarge';

// CC4_PRESET contains:
{
  auToMorphs: {
    // AU number → array of morph target names
    1: ['Brow_Raise_Inner_L', 'Brow_Raise_Inner_R'],
    12: ['Mouth_Smile_L', 'Mouth_Smile_R'],
    45: ['Eye_Blink_L', 'Eye_Blink_R'],
    // ... 87 AUs total
  },

  auToBones: {
    // AU number → array of bone bindings
    51: [{ node: 'HEAD', channel: 'ry', scale: -1, maxDegrees: 30 }],
    61: [{ node: 'EYE_L', channel: 'rz', scale: 1, maxDegrees: 25 }],
    // ... 32 bone bindings
  },

  boneNodes: {
    // Logical bone name → actual node name in skeleton
    'HEAD': 'CC_Base_Head',
    'JAW': 'CC_Base_JawRoot',
    'EYE_L': 'CC_Base_L_Eye',
    'EYE_R': 'CC_Base_R_Eye',
    'TONGUE': 'CC_Base_Tongue01',
  },

  visemeKeys: [
    // 15 viseme morph names for lip-sync
    'V_EE', 'V_Er', 'V_IH', 'V_Ah', 'V_Oh',
    'V_W_OO', 'V_S_Z', 'V_Ch_J', 'V_F_V', 'V_TH',
    'V_T_L_D_N', 'V_B_M_P', 'V_K_G_H_NG', 'V_AE', 'V_R'
  ],

  morphToMesh: {
    // Routes morph categories to specific meshes
    'face': ['CC_Base_Body'],
    'tongue': ['CC_Base_Tongue'],
    'eye': ['CC_Base_EyeOcclusion_L', 'CC_Base_EyeOcclusion_R'],
  },

  auMixDefaults: {
    // Default morph/bone blend weights (0 = morph, 1 = bone)
    26: 0.5,  // Jaw drop: 50% morph, 50% bone
    51: 0.7,  // Head turn: 70% bone
  },

  auInfo: {
    // Metadata about each AU
    '12': {
      name: 'Lip Corner Puller',
      muscularBasis: 'zygomaticus major',
      faceArea: 'Lower',
      facePart: 'Mouth',
    },
    // ...
  }
}
```

### Passing a preset to LoomLarge

```typescript
import { LoomLargeThree, CC4_PRESET } from 'loomlarge';

const loom = new LoomLargeThree({ auMappings: CC4_PRESET });
```

---

## 3. Extending & Custom Presets

### Extending an existing preset

Use spread syntax to override specific mappings while keeping the rest:

```typescript
import { CC4_PRESET } from 'loomlarge';

const MY_PRESET = {
  ...CC4_PRESET,

  // Override AU12 (smile) with custom morph names
  auToMorphs: {
    ...CC4_PRESET.auToMorphs,
    12: ['MySmile_Left', 'MySmile_Right'],
  },

  // Add a new bone binding
  auToBones: {
    ...CC4_PRESET.auToBones,
    99: [{ node: 'CUSTOM_BONE', channel: 'ry', scale: 1, maxDegrees: 45 }],
  },

  // Update bone node paths
  boneNodes: {
    ...CC4_PRESET.boneNodes,
    'CUSTOM_BONE': 'MyRig_CustomBone',
  },
};

const loom = new LoomLargeThree({ auMappings: MY_PRESET });
```

### Creating a preset from scratch

```typescript
import { AUMappingConfig } from 'loomlarge';

const CUSTOM_PRESET: AUMappingConfig = {
  auToMorphs: {
    1: ['brow_inner_up_L', 'brow_inner_up_R'],
    2: ['brow_outer_up_L', 'brow_outer_up_R'],
    12: ['mouth_smile_L', 'mouth_smile_R'],
    45: ['eye_blink_L', 'eye_blink_R'],
  },

  auToBones: {
    51: [{ node: 'HEAD', channel: 'ry', scale: -1, maxDegrees: 30 }],
    52: [{ node: 'HEAD', channel: 'ry', scale: 1, maxDegrees: 30 }],
  },

  boneNodes: {
    'HEAD': 'head_bone',
    'JAW': 'jaw_bone',
  },

  visemeKeys: ['aa', 'ee', 'ih', 'oh', 'oo'],

  morphToMesh: {
    'face': ['body_mesh'],
  },
};
```

### Changing presets at runtime

```typescript
// Switch to a different preset
loom.setAUMappings(ANOTHER_PRESET);

// Get current mappings
const current = loom.getAUMappings();
```

---

## 4. Action Unit Control

Action Units are the core of FACS. Each AU represents a specific muscular movement of the face.

### Setting an AU immediately

```typescript
// Set AU12 (smile) to 80% intensity
loom.setAU(12, 0.8);

// Set AU45 (blink) to full intensity
loom.setAU(45, 1.0);

// Set to 0 to deactivate
loom.setAU(12, 0);
```

### Transitioning an AU over time

```typescript
// Animate AU12 to 0.8 over 200ms
const handle = loom.transitionAU(12, 0.8, 200);

// Wait for completion
await handle.promise;

// Or chain transitions
loom.transitionAU(12, 1.0, 200).promise.then(() => {
  loom.transitionAU(12, 0, 300);  // Fade out
});
```

### Getting the current AU value

```typescript
const smileAmount = loom.getAU(12);
console.log(`Current smile: ${smileAmount}`);
```

### Asymmetric control with balance

Many AUs have left and right variants (e.g., `Mouth_Smile_L` and `Mouth_Smile_R`). The `balance` parameter lets you control them independently:

```typescript
// Balance range: -1 (left only) to +1 (right only), 0 = both equal

// Smile on both sides equally
loom.setAU(12, 0.8, 0);

// Smile only on left side
loom.setAU(12, 0.8, -1);

// Smile only on right side
loom.setAU(12, 0.8, 1);

// 70% left, 30% right
loom.setAU(12, 0.8, -0.4);
```

### String-based side selection

You can also specify the side directly in the AU ID:

```typescript
// These are equivalent:
loom.setAU('12L', 0.8);    // Left side only
loom.setAU(12, 0.8, -1);   // Left side only

loom.setAU('12R', 0.8);    // Right side only
loom.setAU(12, 0.8, 1);    // Right side only
```

---

## 5. Mix Weight System

Some AUs can be driven by both morph targets (blend shapes) AND bone rotations. The mix weight controls the blend between them.

### Why mix weights?

Take jaw opening (AU26) as an example:
- **Morph-only (weight 0)**: Vertices deform to show open mouth, but jaw bone doesn't move
- **Bone-only (weight 1)**: Jaw bone rotates down, but no soft tissue deformation
- **Mixed (weight 0.5)**: Both contribute equally for realistic results

### Setting mix weights

```typescript
// Get the default mix weight for AU26
const weight = loom.getAUMixWeight(26);  // e.g., 0.5

// Set to pure morph
loom.setAUMixWeight(26, 0);

// Set to pure bone
loom.setAUMixWeight(26, 1);

// Set to 70% bone, 30% morph
loom.setAUMixWeight(26, 0.7);
```

### Which AUs support mixing?

Only AUs that have both `auToMorphs` AND `auToBones` entries support mixing. Common examples:
- AU26 (Jaw Drop)
- AU27 (Mouth Stretch)
- AU51-56 (Head movements)
- AU61-64 (Eye movements)

```typescript
import { isMixedAU } from 'loomlarge';

if (isMixedAU(26)) {
  console.log('AU26 supports morph/bone mixing');
}
```

---

## 6. Composite Rotation System

Bones like the head and eyes need multi-axis rotation (pitch, yaw, roll). The composite rotation system handles this automatically.

### How it works

When you set an AU that affects a bone rotation, LoomLarge:
1. Queues the rotation update in `pendingCompositeNodes`
2. At the end of `update()`, calls `flushPendingComposites()`
3. Applies all three axes (pitch, yaw, roll) together to prevent gimbal issues

### Supported bones and their axes

| Bone | Pitch (X) | Yaw (Y) | Roll (Z) |
|------|-----------|---------|----------|
| HEAD | AU53 (up) / AU54 (down) | AU51 (left) / AU52 (right) | AU55 (tilt left) / AU56 (tilt right) |
| EYE_L | AU63 (up) / AU64 (down) | AU61 (left) / AU62 (right) | - |
| EYE_R | AU63 (up) / AU64 (down) | AU61 (left) / AU62 (right) | - |
| JAW | AU25-27 (open) | AU30 (left) / AU35 (right) | - |
| TONGUE | AU37 (up) / AU38 (down) | AU39 (left) / AU40 (right) | AU41 / AU42 (tilt) |

### Example: Moving the head

```typescript
// Turn head left 50%
loom.setAU(51, 0.5);

// Turn head right 50%
loom.setAU(52, 0.5);

// Tilt head up 30%
loom.setAU(53, 0.3);

// Combine: turn left AND tilt up
loom.setAU(51, 0.5);
loom.setAU(53, 0.3);
// Both are applied together in a single composite rotation
```

### Example: Eye gaze

```typescript
// Look left
loom.setAU(61, 0.7);

// Look right
loom.setAU(62, 0.7);

// Look up
loom.setAU(63, 0.5);

// Look down-right (combined)
loom.setAU(62, 0.6);
loom.setAU(64, 0.4);
```

---

## 7. Continuum Pairs

Continuum pairs are bidirectional AU pairs that represent opposite directions on the same axis. They're linked so that activating one should deactivate the other.

### Pair mappings

| Pair | Description |
|------|-------------|
| AU51 ↔ AU52 | Head turn left / right |
| AU53 ↔ AU54 | Head up / down |
| AU55 ↔ AU56 | Head tilt left / right |
| AU61 ↔ AU62 | Eyes look left / right |
| AU63 ↔ AU64 | Eyes look up / down |
| AU30 ↔ AU35 | Jaw shift left / right |
| AU37 ↔ AU38 | Tongue up / down |
| AU39 ↔ AU40 | Tongue left / right |
| AU73 ↔ AU74 | Tongue narrow / wide |
| AU76 ↔ AU77 | Tongue tip up / down |

### Working with pairs

When using continuum pairs, set one AU from the pair and leave the other at 0:

```typescript
// Head looking left at 50%
loom.setAU(51, 0.5);
loom.setAU(52, 0);  // Right should be 0

// Head looking right at 70%
loom.setAU(51, 0);  // Left should be 0
loom.setAU(52, 0.7);
```

### The CONTINUUM_PAIRS_MAP

You can access pair information programmatically:

```typescript
import { CONTINUUM_PAIRS_MAP } from 'loomlarge';

const pair = CONTINUUM_PAIRS_MAP[51];
// { pairId: 52, isNegative: true, axis: 'yaw', node: 'HEAD' }
```

---

## 8. Direct Morph Control

Sometimes you need to control morph targets directly by name, bypassing the AU system.

### Setting a morph immediately

```typescript
// Set a specific morph to 50%
loom.setMorph('Mouth_Smile_L', 0.5);

// Set on specific meshes only
loom.setMorph('Mouth_Smile_L', 0.5, ['CC_Base_Body']);
```

### Transitioning a morph

```typescript
// Animate morph over 200ms
const handle = loom.transitionMorph('Mouth_Smile_L', 0.8, 200);

// With mesh targeting
loom.transitionMorph('Eye_Blink_L', 1.0, 100, ['CC_Base_Body']);

// Wait for completion
await handle.promise;
```

### Reading current morph value

```typescript
const value = loom.getMorphValue('Mouth_Smile_L');
```

### Morph caching

LoomLarge caches morph target lookups for performance. The first time you access a morph, it searches all meshes and caches the index. Subsequent accesses are O(1).

---

## 9. Viseme System

Visemes are mouth shapes used for lip-sync. LoomLarge includes 15 visemes with automatic jaw coupling.

### The 15 visemes

| Index | Key | Phoneme Example |
|-------|-----|-----------------|
| 0 | EE | "b**ee**" |
| 1 | Er | "h**er**" |
| 2 | IH | "s**i**t" |
| 3 | Ah | "f**a**ther" |
| 4 | Oh | "g**o**" |
| 5 | W_OO | "t**oo**" |
| 6 | S_Z | "**s**un, **z**oo" |
| 7 | Ch_J | "**ch**ip, **j**ump" |
| 8 | F_V | "**f**un, **v**an" |
| 9 | TH | "**th**ink" |
| 10 | T_L_D_N | "**t**op, **l**ip, **d**og, **n**o" |
| 11 | B_M_P | "**b**at, **m**an, **p**op" |
| 12 | K_G_H_NG | "**k**ite, **g**o, **h**at, si**ng**" |
| 13 | AE | "c**a**t" |
| 14 | R | "**r**ed" |

### Setting a viseme

```typescript
// Set viseme 3 (Ah) to full intensity
loom.setViseme(3, 1.0);

// With jaw scale (0-1, default 1)
loom.setViseme(3, 1.0, 0.5);  // Half jaw opening
```

### Transitioning visemes

```typescript
// Animate to viseme over 80ms (typical for speech)
const handle = loom.transitionViseme(3, 1.0, 80);

// Disable jaw coupling
loom.transitionViseme(3, 1.0, 80, 0);
```

### Automatic jaw coupling

Each viseme has a predefined jaw opening amount. When you set a viseme, the jaw automatically opens proportionally:

| Viseme | Jaw Amount |
|--------|------------|
| EE | 0.15 |
| Ah | 0.70 |
| Oh | 0.50 |
| B_M_P | 0.20 |

The `jawScale` parameter multiplies this amount:
- `jawScale = 1.0`: Normal jaw opening
- `jawScale = 0.5`: Half jaw opening
- `jawScale = 0`: No jaw movement (viseme only)

### Lip-sync example

```typescript
async function speak(phonemes: number[]) {
  for (const viseme of phonemes) {
    // Clear previous viseme
    for (let i = 0; i < 15; i++) loom.setViseme(i, 0);

    // Transition to new viseme
    await loom.transitionViseme(viseme, 1.0, 80).promise;

    // Hold briefly
    await new Promise(r => setTimeout(r, 100));
  }

  // Return to neutral
  for (let i = 0; i < 15; i++) loom.setViseme(i, 0);
}

// "Hello" approximation
speak([5, 0, 10, 4]);
```

---

## 10. Transition System

All animated changes in LoomLarge go through the transition system, which provides smooth interpolation with easing.

### TransitionHandle

Every transition method returns a `TransitionHandle`:

```typescript
interface TransitionHandle {
  promise: Promise<void>;  // Resolves when transition completes
  pause(): void;           // Pause this transition
  resume(): void;          // Resume this transition
  cancel(): void;          // Cancel immediately
}
```

### Using handles

```typescript
// Start a transition
const handle = loom.transitionAU(12, 1.0, 500);

// Pause it
handle.pause();

// Resume later
handle.resume();

// Or cancel entirely
handle.cancel();

// Wait for completion
await handle.promise;
```

### Combining multiple transitions

When you call `transitionAU`, it may create multiple internal transitions (one per morph target). The returned handle controls all of them:

```typescript
// AU12 might affect Mouth_Smile_L and Mouth_Smile_R
const handle = loom.transitionAU(12, 1.0, 200);

// Pausing the handle pauses both morph transitions
handle.pause();
```

### Easing

The default easing is `easeInOutQuad`. Custom easing can be provided when using the Animation system directly:

```typescript
// The AnimationThree class supports custom easing
animation.addTransition(
  'custom',
  0,
  1,
  200,
  (v) => console.log(v),
  (t) => t * t  // Custom ease-in quadratic
);
```

### Active transition count

```typescript
const count = loom.getActiveTransitionCount();
console.log(`${count} transitions in progress`);
```

### Clearing all transitions

```typescript
// Cancel everything immediately
loom.clearTransitions();
```

---

## 11. Playback & State Control

### Pausing and resuming

```typescript
// Pause all animation updates
loom.pause();

// Check pause state
if (loom.getPaused()) {
  console.log('Animation is paused');
}

// Resume
loom.resume();
```

When paused, `loom.update()` stops processing transitions, but you can still call `setAU()` for immediate changes.

### Resetting to neutral

```typescript
// Reset everything to rest state
loom.resetToNeutral();
```

This:
- Clears all AU values to 0
- Cancels all active transitions
- Resets all morph targets to 0
- Returns all bones to their original position/rotation

### Mesh visibility

```typescript
// Get list of all meshes
const meshes = loom.getMeshList();
// Returns: [{ name: 'CC_Base_Body', visible: true, morphCount: 80 }, ...]

// Hide a mesh
loom.setMeshVisible('CC_Base_Hair', false);

// Show it again
loom.setMeshVisible('CC_Base_Hair', true);
```

### Cleanup

```typescript
// When done, dispose of resources
loom.dispose();
```

---

## 12. Hair Physics

LoomLarge includes an experimental hair physics system that simulates hair movement based on head motion.

### Basic setup

```typescript
import { HairPhysics } from 'loomlarge';

const hair = new HairPhysics();
```

### Updating in animation loop

```typescript
function animate() {
  // Get current head state (from your tracking system or AU values)
  const headState = {
    yaw: 0,           // Head rotation in radians
    pitch: 0,
    roll: 0,
    yawVelocity: 0.5, // Angular velocity
    pitchVelocity: 0,
  };

  // Update hair physics
  const hairMorphs = hair.update(deltaTime, headState);

  // Apply hair morphs
  for (const [morphName, value] of Object.entries(hairMorphs)) {
    loom.setMorph(morphName, value);
  }
}
```

### Output morphs

The physics system outputs 6 morph values:

| Morph | Description |
|-------|-------------|
| L_Hair_Left | Left side, swing left |
| L_Hair_Right | Left side, swing right |
| L_Hair_Front | Left side, swing forward |
| R_Hair_Left | Right side, swing left |
| R_Hair_Right | Right side, swing right |
| R_Hair_Front | Right side, swing forward |

### Physics forces

The simulation models 5 forces:

1. **Spring restoration** - Pulls hair back to rest position
2. **Damping** - Air resistance prevents infinite oscillation
3. **Gravity** - Hair swings based on head tilt
4. **Inertia** - Hair lags behind head movement
5. **Wind** - Optional oscillating wind force

### Configuration

```typescript
const hair = new HairPhysics({
  mass: 1.0,
  stiffness: 50,
  damping: 5,
  gravity: 9.8,
  headInfluence: 0.8,  // How much head movement affects hair
  wind: {
    strength: 0,
    direction: { x: 1, y: 0, z: 0 },
    turbulence: 0.2,
    frequency: 1.0,
  },
});
```

---

## Resources

- [FACS on Wikipedia](https://en.wikipedia.org/wiki/Facial_Action_Coding_System)
- [Paul Ekman Group - FACS](https://www.paulekman.com/facial-action-coding-system/)
- [Character Creator 4](https://www.reallusion.com/character-creator/)
- [Three.js Documentation](https://threejs.org/docs/)

## License

MIT License - see LICENSE file for details.
