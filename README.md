# Loom3

The missing character controller for Three.js, allowing you to bring humanoid and animal characters to life. Loom3 is based on the Facial Action Coding System (FACS) as the basis of its mappings, providing a morph and bone mapping library for controlling high-definition 3D characters in Three.js.

Loom3 provides mappings that connect [Facial Action Coding System (FACS)](https://en.wikipedia.org/wiki/Facial_Action_Coding_System) Action Units to the morph targets and bone transforms found in Character Creator 4 (CC4) characters. Instead of manually figuring out which blend shapes correspond to which facial movements, you can simply say `setAU(12, 0.8)` and the library handles the rest.

> **Screenshot placeholder:** Add a hero image showing a character with facial expressions controlled by Loom3

---

## Table of Contents

1. [Installation & Setup](#1-installation--setup)
2. [Using Presets](#2-using-presets)
3. [Getting to Know Your Character](#3-getting-to-know-your-character)
4. [Extending & Custom Presets](#4-extending--custom-presets)
5. [Creating Skeletal Animation Presets](#5-creating-skeletal-animation-presets)
6. [Action Unit Control](#6-action-unit-control)
7. [Mix Weight System](#7-mix-weight-system)
8. [Composite Rotation System](#8-composite-rotation-system)
9. [Continuum Pairs](#9-continuum-pairs)
10. [Direct Morph Control](#10-direct-morph-control)
11. [Viseme System](#11-viseme-system)
12. [Transition System](#12-transition-system)
13. [Playback & State Control](#13-playback--state-control)
14. [Hair Physics](#14-hair-physics)
15. [Baked Animations](#15-baked-animations)

---

## 1. Installation & Setup

> **Screenshot placeholder:** Add a screenshot of a project structure with Loom3 installed

### Install the package

```bash
npm install loom3
```

### Peer dependency

Loom3 requires Three.js as a peer dependency:

```bash
npm install three
```

### Basic setup

```typescript
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Loom3, collectMorphMeshes, CC4_PRESET } from 'loom3';

// 1. Create the Loom3 controller with a preset
const loom = new Loom3({ profile: CC4_PRESET });

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

  // 5. Initialize Loom3 with the meshes and model
  loom.onReady({ meshes, model: gltf.scene });
});

// 6. In your animation loop, call loom.update(deltaSeconds)
// This drives all transitions and animations
```

If you’re implementing a custom renderer, target the `LoomLarge` interface exported from `loom3`.

### Quick start examples

Once your character is loaded, you can control facial expressions immediately:

```typescript
// Make the character smile
loom.setAU(12, 0.8);

// Raise eyebrows
loom.setAU(1, 0.6);
loom.setAU(2, 0.6);

// Blink
loom.setAU(45, 1.0);

// Open jaw
loom.setAU(26, 0.5);

// Turn head left
loom.setAU(51, 0.4);

// Look up
loom.setAU(63, 0.6);
```

Animate smoothly with transitions:

```typescript
// Smile over 200ms
await loom.transitionAU(12, 0.8, 200).promise;

// Then fade back to neutral
await loom.transitionAU(12, 0, 300).promise;
```

### The `collectMorphMeshes` helper

This utility function traverses a Three.js scene and returns all meshes that have `morphTargetInfluences` (i.e., blend shapes). It's the recommended way to gather meshes for Loom3:

```typescript
import { collectMorphMeshes } from 'loom3';

const meshes = collectMorphMeshes(gltf.scene);
// Returns: Array of THREE.Mesh objects with morph targets
```

> **Screenshot placeholder:** Add a screenshot of a loaded character in the Three.js scene

---

## 2. Using Presets

> **Screenshot placeholder:** Add a diagram showing how presets connect AUs to morphs and bones

Presets define how FACS Action Units map to your character's morph targets and bones. Loom3 ships with `CC4_PRESET` for Character Creator 4 characters.

### What's in a preset?

```typescript
import { CC4_PRESET } from 'loom3';

// CC4_PRESET contains:
{
  auToMorphs: {
    // AU number → morph target names split by side
    1: { left: ['Brow_Raise_Inner_L'], right: ['Brow_Raise_Inner_R'], center: [] },
    12: { left: ['Mouth_Smile_L'], right: ['Mouth_Smile_R'], center: [] },
    45: { left: ['Eye_Blink_L'], right: ['Eye_Blink_R'], center: [] },
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

### Passing a preset to Loom3

```typescript
import { Loom3, CC4_PRESET } from 'loom3';

const loom = new Loom3({ profile: CC4_PRESET });
```

You can also resolve presets by name and apply overrides without cloning the full preset:

```typescript
import { Loom3 } from 'loom3';

const loom = new Loom3({
  presetType: 'cc4',
  profile: {
    auToMorphs: {
      12: { left: ['MySmile_Left'], right: ['MySmile_Right'], center: [] },
    },
  },
});
```

### Profiles (preset overrides)

A **profile** is a partial override object that extends a base preset. Use it to customize a single character without copying the full preset:

```typescript
import type { Profile } from 'loom3';
import { Loom3 } from 'loom3';

const DAISY_PROFILE: Profile = {
  morphToMesh: { face: ['Object_9'] },
  annotationRegions: [
    { name: 'face', bones: ['CC_Base_Head'] },
  ],
};

const loom = new Loom3({
  presetType: 'cc4',
  profile: DAISY_PROFILE,
});
```

> **Screenshot placeholder:** Add a screenshot showing the preset being applied to a character

---

## 3. Getting to Know Your Character

> **Screenshot placeholder:** Add a screenshot of the console output showing mesh and morph target information

Before customizing presets or extending mappings, it's helpful to understand what's actually in your character model. Loom3 provides several methods to inspect meshes, morph targets, and bones.

### Listing meshes

Get all meshes in your character with their visibility and morph target counts:

```typescript
const meshes = loom.getMeshList();
console.log(meshes);
// [
//   { name: 'CC_Base_Body', visible: true, morphCount: 142 },
//   { name: 'CC_Base_Tongue', visible: true, morphCount: 12 },
//   { name: 'CC_Base_EyeOcclusion_L', visible: true, morphCount: 8 },
//   { name: 'CC_Base_EyeOcclusion_R', visible: true, morphCount: 8 },
//   { name: 'Male_Bushy_1', visible: true, morphCount: 142 },
//   ...
// ]
```

### Listing morph targets

Get all morph target names grouped by mesh:

```typescript
const morphs = loom.getMorphTargets();
console.log(morphs);
// {
//   'CC_Base_Body': [
//     'A01_Brow_Inner_Up', 'A02_Brow_Down_Left', 'A02_Brow_Down_Right',
//     'A04_Brow_Outer_Up_Left', 'A04_Brow_Outer_Up_Right',
//     'Mouth_Smile_L', 'Mouth_Smile_R', 'Eye_Blink_L', 'Eye_Blink_R',
//     ...
//   ],
//   'CC_Base_Tongue': [
//     'V_Tongue_Out', 'V_Tongue_Up', 'V_Tongue_Down', ...
//   ],
//   ...
// }
```

This is invaluable when creating custom presets—you need to know the exact morph target names your character uses.

### Listing bones

Get all resolved bones with their current positions and rotations (in degrees):

```typescript
const bones = loom.getBones();
console.log(bones);
// {
//   'HEAD': { position: [0, 156.2, 0], rotation: [0, 0, 0] },
//   'JAW': { position: [0, 154.1, 2.3], rotation: [0, 0, 0] },
//   'EYE_L': { position: [-3.2, 160.5, 8.1], rotation: [0, 0, 0] },
//   'EYE_R': { position: [3.2, 160.5, 8.1], rotation: [0, 0, 0] },
//   'TONGUE': { position: [0, 152.3, 1.8], rotation: [0, 0, 0] },
// }
```

### Validation & analysis

Loom3 includes validation and analysis helpers so you can verify presets against a model and generate corrections:

```typescript
import {
  extractModelData,
  analyzeModel,
  validateMappings,
  generateMappingCorrections,
  resolvePreset,
} from 'loom3';

const preset = resolvePreset('cc4');
const modelData = extractModelData({ model, meshes, animations });
const analysis = analyzeModel(modelData, { preset });
const validation = validateMappings(modelData, preset);
const corrections = generateMappingCorrections(modelData, preset);
```

Use these helpers to:
- Find missing morphs/bones and mesh mismatches
- Score preset compatibility
- Suggest corrections before you ship a profile

### Controlling mesh visibility

Hide or show individual meshes:

```typescript
// Hide hair mesh
loom.setMeshVisible('Side_part_wavy_1', false);

// Show it again
loom.setMeshVisible('Side_part_wavy_1', true);
```

### Adjusting material properties

Fine-tune render order, transparency, and blending for each mesh:

```typescript
// Get current material config
const config = loom.getMeshMaterialConfig('CC_Base_Body');
console.log(config);
// {
//   renderOrder: 0,
//   transparent: false,
//   opacity: 1,
//   depthWrite: true,
//   depthTest: true,
//   blending: 'Normal'
// }

// Set custom material config
loom.setMeshMaterialConfig('CC_Base_EyeOcclusion_L', {
  renderOrder: 10,
  transparent: true,
  opacity: 0.8,
  blending: 'Normal'  // 'Normal', 'Additive', 'Subtractive', 'Multiply', 'None'
});
```

This is especially useful for:
- Fixing render order issues (eyebrows behind hair, etc.)
- Making meshes semi-transparent for debugging
- Adjusting blending modes for special effects

> **Screenshot placeholder:** Add before/after screenshots showing render order adjustments

---

## 4. Extending & Custom Presets

> **Screenshot placeholder:** Add a diagram showing preset inheritance/extension

### Extending an existing preset

Use `mergePreset` to override specific mappings while keeping the rest:

```typescript
import { CC4_PRESET, mergePreset } from 'loom3';

const MY_PRESET = mergePreset(CC4_PRESET, {

  // Override AU12 (smile) with custom morph names
  auToMorphs: {
    12: { left: ['MySmile_Left'], right: ['MySmile_Right'], center: [] },
  },

  // Add a new bone binding
  auToBones: {
    99: [{ node: 'CUSTOM_BONE', channel: 'ry', scale: 1, maxDegrees: 45 }],
  },

  // Update bone node paths
  boneNodes: {
    'CUSTOM_BONE': 'MyRig_CustomBone',
  },
});

const loom = new Loom3({ profile: MY_PRESET });
```

### Creating a preset from scratch

```typescript
import { Profile } from 'loom3';

const CUSTOM_PRESET: Profile = {
  auToMorphs: {
    1: { left: ['brow_inner_up_L'], right: ['brow_inner_up_R'], center: [] },
    2: { left: ['brow_outer_up_L'], right: ['brow_outer_up_R'], center: [] },
    12: { left: ['mouth_smile_L'], right: ['mouth_smile_R'], center: [] },
    45: { left: ['eye_blink_L'], right: ['eye_blink_R'], center: [] },
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
loom.setProfile(ANOTHER_PRESET);

// Get current mappings
const current = loom.getProfile();
```

> **Screenshot placeholder:** Add a screenshot showing custom preset in action

---

## 5. Creating Skeletal Animation Presets

> **Screenshot placeholder:** Add a screenshot showing the fish model with labeled bones

Loom3 isn't limited to humanoid characters with morph targets. You can create presets for any 3D model that uses skeletal animation, such as fish, animals, or fantasy creatures. This section explains how to create a preset for a betta fish model that has no morph targets—only bone-driven animation.

### Understanding skeletal-only models

Some models (like fish) rely entirely on bone rotations for animation:
- **No morph targets:** All movement is skeletal
- **Hierarchical bones:** Fins and body parts follow parent rotations
- **Custom "Action Units":** Instead of FACS AUs, you define model-specific actions

### Example: Betta Fish Preset

Here's a complete example of a preset for a betta fish:

```typescript
import type { BoneBinding, AUInfo, CompositeRotation } from 'loom3';

// Define semantic bone mappings
export const FISH_BONE_NODES = {
  ROOT: 'Armature_rootJoint',
  BODY_ROOT: 'Bone_Armature',
  HEAD: 'Bone001_Armature',
  BODY_FRONT: 'Bone002_Armature',
  BODY_MID: 'Bone003_Armature',
  BODY_BACK: 'Bone004_Armature',
  TAIL_BASE: 'Bone005_Armature',

  // Pectoral fins (side fins)
  PECTORAL_L: 'Bone046_Armature',
  PECTORAL_R: 'Bone047_Armature',

  // Dorsal fin (top fin)
  DORSAL_ROOT: 'Bone006_Armature',

  // Eyes (single mesh for both)
  EYE_L: 'EYES_0',
  EYE_R: 'EYES_0',
} as const;

// Define custom fish actions (analogous to FACS AUs)
export enum FishAction {
  // Body orientation
  TURN_LEFT = 2,
  TURN_RIGHT = 3,
  PITCH_UP = 4,
  PITCH_DOWN = 5,
  ROLL_LEFT = 6,
  ROLL_RIGHT = 7,

  // Tail movements
  TAIL_SWEEP_LEFT = 12,
  TAIL_SWEEP_RIGHT = 13,
  TAIL_FIN_SPREAD = 14,
  TAIL_FIN_CLOSE = 15,

  // Pectoral fins
  PECTORAL_L_UP = 20,
  PECTORAL_L_DOWN = 21,
  PECTORAL_R_UP = 22,
  PECTORAL_R_DOWN = 23,

  // Eye rotation
  EYE_LEFT = 61,
  EYE_RIGHT = 62,
  EYE_UP = 63,
  EYE_DOWN = 64,
}
```

### Defining bone bindings for movement

Map each action to bone rotations:

```typescript
export const FISH_BONE_BINDINGS: Record<number, BoneBinding[]> = {
  // Turn the fish left - affects head, front body, and mid body
  [FishAction.TURN_LEFT]: [
    { node: 'HEAD', channel: 'ry', scale: 1, maxDegrees: 30 },
    { node: 'BODY_FRONT', channel: 'ry', scale: 1, maxDegrees: 14 },
    { node: 'BODY_MID', channel: 'ry', scale: 1, maxDegrees: 5 },
  ],

  // Tail sweep left - cascading motion through tail bones
  [FishAction.TAIL_SWEEP_LEFT]: [
    { node: 'BODY_BACK', channel: 'rz', scale: 1, maxDegrees: 15 },
    { node: 'TAIL_BASE', channel: 'rz', scale: 1, maxDegrees: 30 },
    { node: 'TAIL_TOP', channel: 'rz', scale: 1, maxDegrees: 20 },
    { node: 'TAIL_MID', channel: 'rz', scale: 1, maxDegrees: 20 },
  ],

  // Pectoral fin movements
  [FishAction.PECTORAL_L_UP]: [
    { node: 'PECTORAL_L', channel: 'rz', scale: 1, maxDegrees: 40 },
    { node: 'PECTORAL_L_MID', channel: 'rz', scale: 1, maxDegrees: 20 },
  ],

  // Eye rotation
  [FishAction.EYE_LEFT]: [
    { node: 'EYE_L', channel: 'ry', scale: 1, maxDegrees: 25 },
  ],
};
```

### Composite rotations for multi-axis control

Define how multiple AUs combine for smooth rotation:

```typescript
export const FISH_COMPOSITE_ROTATIONS: CompositeRotation[] = [
  {
    node: 'HEAD',
    pitch: {
      aus: [FishAction.PITCH_UP, FishAction.PITCH_DOWN],
      axis: 'rx',
      negative: FishAction.PITCH_DOWN,
      positive: FishAction.PITCH_UP
    },
    yaw: {
      aus: [FishAction.TURN_LEFT, FishAction.TURN_RIGHT],
      axis: 'ry',
      negative: FishAction.TURN_LEFT,
      positive: FishAction.TURN_RIGHT
    },
    roll: null,
  },
  {
    node: 'TAIL_BASE',
    pitch: null,
    yaw: null,
    roll: {
      aus: [FishAction.TAIL_SWEEP_LEFT, FishAction.TAIL_SWEEP_RIGHT],
      axis: 'rz',
      negative: FishAction.TAIL_SWEEP_RIGHT,
      positive: FishAction.TAIL_SWEEP_LEFT
    },
  },
  {
    node: 'EYE_L',
    pitch: {
      aus: [FishAction.EYE_UP, FishAction.EYE_DOWN],
      axis: 'rx',
      negative: FishAction.EYE_DOWN,
      positive: FishAction.EYE_UP
    },
    yaw: {
      aus: [FishAction.EYE_LEFT, FishAction.EYE_RIGHT],
      axis: 'ry',
      negative: FishAction.EYE_RIGHT,
      positive: FishAction.EYE_LEFT
    },
    roll: null,
  },
];
```

### Action metadata for UI and debugging

```typescript
export const FISH_AU_INFO: Record<string, AUInfo> = {
  '2': { id: '2', name: 'Turn Left', facePart: 'Body Orientation' },
  '3': { id: '3', name: 'Turn Right', facePart: 'Body Orientation' },
  '4': { id: '4', name: 'Pitch Up', facePart: 'Body Orientation' },
  '5': { id: '5', name: 'Pitch Down', facePart: 'Body Orientation' },
  '12': { id: '12', name: 'Tail Sweep Left', facePart: 'Tail' },
  '13': { id: '13', name: 'Tail Sweep Right', facePart: 'Tail' },
  '20': { id: '20', name: 'Pectoral L Up', facePart: 'Pectoral Fins' },
  '61': { id: '61', name: 'Eyes Left', facePart: 'Eyes' },
  // ... more actions
};
```

### Continuum pairs for bidirectional sliders

```typescript
export const FISH_CONTINUUM_PAIRS_MAP: Record<number, {
  pairId: number;
  isNegative: boolean;
  axis: 'pitch' | 'yaw' | 'roll';
  node: string;
}> = {
  [FishAction.TURN_LEFT]: {
    pairId: FishAction.TURN_RIGHT,
    isNegative: true,
    axis: 'yaw',
    node: 'HEAD'
  },
  [FishAction.TURN_RIGHT]: {
    pairId: FishAction.TURN_LEFT,
    isNegative: false,
    axis: 'yaw',
    node: 'HEAD'
  },
  [FishAction.TAIL_SWEEP_LEFT]: {
    pairId: FishAction.TAIL_SWEEP_RIGHT,
    isNegative: true,
    axis: 'roll',
    node: 'TAIL_BASE'
  },
  // ... more pairs
};
```

### Creating the final preset config

```typescript
export const FISH_AU_MAPPING_CONFIG = {
  auToBones: FISH_BONE_BINDINGS,
  boneNodes: FISH_BONE_NODES,
  auToMorphs: {} as Record<number, { left: string[]; right: string[]; center: string[] }>,  // No morph targets
  morphToMesh: {} as Record<string, string[]>,
  visemeKeys: [] as string[],  // Fish don't speak!
  auInfo: FISH_AU_INFO,
  compositeRotations: FISH_COMPOSITE_ROTATIONS,
  eyeMeshNodes: { LEFT: 'EYES_0', RIGHT: 'EYES_0' },
};
```

### Using the fish preset

```typescript
import { Loom3 } from 'loom3';
import { FISH_AU_MAPPING_CONFIG, FishAction } from './presets/bettaFish';

const fishController = new Loom3({
  profile: FISH_AU_MAPPING_CONFIG
});

// Load the fish model
loader.load('/characters/betta/scene.gltf', (gltf) => {
  const meshes = collectMorphMeshes(gltf.scene);  // Will be empty for fish
  fishController.onReady({ meshes, model: gltf.scene });

  // Control the fish!
  fishController.setAU(FishAction.TURN_LEFT, 0.5);      // Turn left
  fishController.setAU(FishAction.TAIL_SWEEP_LEFT, 0.8); // Sweep tail
  fishController.setAU(FishAction.PECTORAL_L_UP, 0.6);   // Raise left fin

  // Smooth transitions
  await fishController.transitionAU(FishAction.TURN_RIGHT, 1.0, 500).promise;
});
```

### Creating swimming animations

Use continuum controls for natural swimming motion:

```typescript
// Use setContinuum for paired actions
fishController.setContinuum(
  FishAction.TURN_LEFT,
  FishAction.TURN_RIGHT,
  0.3  // Slight turn right
);

// Animate swimming with oscillating tail
async function swimCycle() {
  while (true) {
    await fishController.transitionContinuum(
      FishAction.TAIL_SWEEP_LEFT,
      FishAction.TAIL_SWEEP_RIGHT,
      0.8,  // Sweep right
      300
    ).promise;

    await fishController.transitionContinuum(
      FishAction.TAIL_SWEEP_LEFT,
      FishAction.TAIL_SWEEP_RIGHT,
      -0.8, // Sweep left
      300
    ).promise;
  }
}
```

> **Screenshot placeholder:** Add a GIF showing the fish swimming animation

---

## 6. Action Unit Control

> **Screenshot placeholder:** Add a screenshot showing a character with different AU values

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

## 7. Mix Weight System

> **Screenshot placeholder:** Add a comparison showing morph-only vs bone-only vs mixed weights

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
import { isMixedAU } from 'loom3';

if (isMixedAU(26)) {
  console.log('AU26 supports morph/bone mixing');
}
```

---

## 8. Composite Rotation System

> **Screenshot placeholder:** Add a diagram showing the pitch/yaw/roll axes on a head

Bones like the head and eyes need multi-axis rotation (pitch, yaw, roll). The composite rotation system handles this automatically.

### How it works

When you set an AU that affects a bone rotation, Loom3:
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

## 9. Continuum Pairs

> **Screenshot placeholder:** Add a screenshot showing a continuum slider UI

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

### Negative value shorthand (recommended)

The simplest way to work with continuum pairs is using **negative values**. When you pass a negative value to `setAU()` or `transitionAU()`, the engine automatically activates the paired AU instead:

```typescript
// Head looking left at 50% (AU51 is "head left")
loom.setAU(51, 0.5);

// Head looking right at 50% - just use a negative value!
loom.setAU(51, -0.5);  // Automatically activates AU52 at 0.5

// This is equivalent to manually setting the pair:
loom.setAU(51, 0);
loom.setAU(52, 0.5);
```

This works for transitions too:

```typescript
// Animate head from left to right over 500ms
await loom.transitionAU(51, 0.5, 250).promise;   // Turn left
await loom.transitionAU(51, -0.5, 500).promise;  // Turn right (activates AU52)
```

### The setContinuum method

For explicit continuum control, use `setContinuum()` with a single value from -1 to +1:

```typescript
// setContinuum(negativeAU, positiveAU, value)
// value: -1 = full negative, 0 = neutral, +1 = full positive

// Head centered
loom.setContinuum(51, 52, 0);

// Head 50% left
loom.setContinuum(51, 52, -0.5);

// Head 70% right
loom.setContinuum(51, 52, 0.7);
```

With smooth animation:

```typescript
// Animate head from current position to 80% right over 300ms
await loom.transitionContinuum(51, 52, 0.8, 300).promise;

// Animate eyes to look left over 200ms
await loom.transitionContinuum(61, 62, -0.6, 200).promise;
```

### Manual pair management

You can also manually manage pairs by setting each AU individually:

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
import { CONTINUUM_PAIRS_MAP } from 'loom3';

const pair = CONTINUUM_PAIRS_MAP[51];
// { pairId: 52, isNegative: true, axis: 'yaw', node: 'HEAD' }
```

---

## 10. Direct Morph Control

> **Screenshot placeholder:** Add a screenshot of a morph target being controlled directly

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

Loom3 caches morph target lookups for performance. The first time you access a morph, it searches all meshes and caches the index. Subsequent accesses are O(1).

---

## 11. Viseme System

> **Screenshot placeholder:** Add a grid showing all 15 viseme mouth shapes

Visemes are mouth shapes used for lip-sync. Loom3 includes 15 visemes with automatic jaw coupling.

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

Viseme transitions default to 80ms and use the standard `easeInOutQuad` easing when no duration is provided.

```typescript
// Animate to a viseme using the default 80ms duration
const handle = loom.transitionViseme(3, 1.0);

// Disable jaw coupling (duration can be omitted to use the 80ms default)
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

## 12. Transition System

> **Screenshot placeholder:** Add a diagram showing transition timeline with easing

All animated changes in Loom3 go through the transition system, which provides smooth interpolation with easing.

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

## 13. Playback & State Control

> **Screenshot placeholder:** Add a screenshot showing pause/resume controls in a UI

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

## 14. Hair Physics

> **Screenshot placeholder:** Add a GIF showing hair physics responding to head movement

Loom3 includes an experimental hair physics system that simulates hair movement based on head motion.

### Basic setup

```typescript
import { HairPhysics } from 'loom3';

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

## 15. Baked Animations

Loom3 can play baked skeletal animations from your GLB/GLTF files using Three.js AnimationMixer. This allows you to combine pre-made animations (idle, walk, gestures) with real-time facial control.

### Loading animations

After loading your model, pass the animations array to Loom3:

```typescript
const loader = new GLTFLoader();
loader.load('/character.glb', (gltf) => {
  scene.add(gltf.scene);

  const meshes = collectMorphMeshes(gltf.scene);
  loom.onReady({ meshes, model: gltf.scene });

  // Load baked animations from the GLB file
  loom.loadAnimationClips(gltf.animations);

  // Start the internal update loop
  loom.start();
});
```

### Listing available animations

```typescript
const clips = loom.getAnimationClips();
console.log(clips);
// [
//   { name: 'Idle', duration: 4.0, trackCount: 52 },
//   { name: 'Walk', duration: 1.2, trackCount: 52 },
//   { name: 'Wave', duration: 2.5, trackCount: 24 },
// ]
```

### Playing animations

```typescript
// Play an animation with default settings (looping)
loom.playAnimation('Idle');

// Play with options
const handle = loom.playAnimation('Wave', {
  speed: 1.0,           // Playback speed (1.0 = normal)
  intensity: 1.0,       // Weight/intensity (0-1)
  loop: false,          // Don't loop
  loopMode: 'once',     // 'repeat', 'pingpong', or 'once'
  clampWhenFinished: true,  // Hold last frame when done
  startTime: 0,         // Start from beginning
});

// Wait for non-looping animation to finish
await handle.finished;
```

### Mixer clip playback for curves

Loom3 can convert AU/morph curves into AnimationMixer clips for smooth, mixer-only playback. This is the preferred path for high-frequency animation agencies (eye/head tracking, visemes, prosody) because it avoids per-keyframe transitions.

Key APIs:
- `snippetToClip(name, curves, options)` builds an AnimationClip from curves.
- `playClip(clip, options)` returns a ClipHandle you can pause/resume/stop.
- `clipHandle.stop()` now resolves cleanly (no rejected promise).

```typescript
const clip = loom.snippetToClip('gaze', {
  '61': [{ time: 0, intensity: 0 }, { time: 0.4, intensity: 0.6 }],
  '62': [{ time: 0, intensity: 0 }, { time: 0.4, intensity: 0 }],
}, { loop: false });

if (clip) {
  const handle = loom.playClip(clip, { loop: false, speed: 1 });
  await handle.finished;
}
```

### Controlling playback

The handle returned from `playAnimation()` provides full control:

```typescript
const handle = loom.playAnimation('Idle');

// Pause and resume
handle.pause();
handle.resume();

// Adjust speed in real-time
handle.setSpeed(0.5);  // Half speed
handle.setSpeed(2.0);  // Double speed

// Adjust intensity/weight
handle.setWeight(0.5);  // 50% influence

// Seek to specific time
handle.seekTo(1.5);  // Jump to 1.5 seconds

// Get current state
const state = handle.getState();
console.log(state);
// {
//   name: 'Idle',
//   isPlaying: true,
//   isPaused: false,
//   time: 1.5,
//   duration: 4.0,
//   speed: 1.0,
//   weight: 1.0,
//   isLooping: true
// }

// Stop the animation
handle.stop();
```

### Crossfading between animations

Smoothly transition from one animation to another:

```typescript
// Start with idle
loom.playAnimation('Idle');

// Later, crossfade to walk over 0.3 seconds
loom.crossfadeTo('Walk', 0.3);

// Or use the handle
const idleHandle = loom.playAnimation('Idle');
idleHandle.crossfadeTo('Walk', 0.5);
```

### Global animation control

Control all animations at once:

```typescript
// Stop all animations
loom.stopAllAnimations();

// Pause all animations
loom.pauseAllAnimations();

// Resume all paused animations
loom.resumeAllAnimations();

// Set global time scale (affects all animations)
loom.setAnimationTimeScale(0.5);  // Everything at half speed

// Get all currently playing animations
const playing = loom.getPlayingAnimations();
```

### Direct control by name

You can also control animations directly without using handles:

```typescript
loom.playAnimation('Idle');

// Later...
loom.setAnimationSpeed('Idle', 1.5);
loom.setAnimationIntensity('Idle', 0.8);
loom.pauseAnimation('Idle');
loom.resumeAnimation('Idle');
loom.stopAnimation('Idle');

// Get state of specific animation
const state = loom.getAnimationState('Idle');
```

### Combining with facial animation

Baked animations and facial AU control work together seamlessly. The AnimationMixer updates automatically when you call `loom.update()` or use `loom.start()`:

```typescript
loom.loadAnimationClips(gltf.animations);
loom.start();  // Starts internal RAF loop

// Play a body animation
loom.playAnimation('Idle');

// Control facial expressions on top
loom.setAU(12, 0.8);  // Smile
loom.transitionAU(45, 1.0, 100);  // Blink

// Both update together - no separate render loop needed
```

### Animation types

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `speed` | number | 1.0 | Playback speed multiplier |
| `intensity` | number | 1.0 | Animation weight (0-1) |
| `loop` | boolean | true | Whether to loop |
| `loopMode` | string | 'repeat' | 'repeat', 'pingpong', or 'once' |
| `crossfadeDuration` | number | 0 | Fade in duration (seconds) |
| `clampWhenFinished` | boolean | true | Hold last frame when done |
| `startTime` | number | 0 | Initial playback position |

---

## Resources

> **Screenshot placeholder:** Add logos or screenshots from the resources below

- [FACS on Wikipedia](https://en.wikipedia.org/wiki/Facial_Action_Coding_System)
- [Paul Ekman Group - FACS](https://www.paulekman.com/facial-action-coding-system/)
- [Character Creator 4](https://www.reallusion.com/character-creator/)
- [Three.js Documentation](https://threejs.org/docs/)

## License

MIT License - see LICENSE file for details.
