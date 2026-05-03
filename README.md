# Loom3

Loom3 is an expressive animation engine for Three.js characters. It creates performant, mixable animation built on `AnimationMixer`, but lets you control that animation through a higher-level semantic layer: [Facial Action Coding System (FACS)](https://en.wikipedia.org/wiki/Facial_Action_Coding_System) Action Units, speech animation, morph targets, bone rotations, presets, and profile mappings instead of one-off rig plumbing.

At runtime, Loom3 can mix baked clips with procedurally generated animation, coordinate morph target influence with bone motion, and map rig-specific names into a stable control surface. That is what makes it useful for real-time, socially expressive characters rather than just isolated face poses or one-off rig mappings.

> **Note:** If you previously used the `loomlarge` npm package, it has been renamed to `@lovelace_lol/loom3`.

![Hero image showing Loom3 controlling a facial expression](./assets/readme/hero-expressions.webp)

---

## What Loom3 Does

Loom3 gives Three.js characters a single expressive control system. It lets you drive facial expressions, visemes, head turns, eye gaze, jaw motion, tongue motion, and animation playback through one runtime instead of a collection of unrelated rig controls.

At the center of Loom3 is a semantic layer built around FACS Action Units and visemes. You tell the character what shape or motion you want, and Loom3 maps that request to the morph targets, bone rotations, bone translations, and mixer playback needed by the rig. A smile can use morphs and bones together. A spoken mouth shape can combine a viseme with jaw motion. A head movement can coordinate multiple rotation axes instead of acting like a single disconnected control.

In practical terms, Loom3 gives you:
- expressive face and speech control through AUs, visemes, continuum pairs, and direct morph access
- coordinated head, eye, jaw, and tongue motion through composite rotations and paired controls
- reusable character mappings through presets, profile overrides, name resolution, and skeletal-only support
- runtime playback tools through transitions, snippets, generated clips, baked clips, crossfades, weights, and `AnimationMixer`
- inspection and validation tools for meshes, morphs, bones, preset fit, correction suggestions, and model analysis
- supporting character tools such as region helpers, geometry helpers, mesh debugging, and hair physics

## Why This Is Valuable

The value is that Loom3 turns a rig into something you can direct more naturally and reuse more confidently.

Instead of manually wiring smile morphs, head rotations, eye-bone controls, jaw pivots, viseme tables, and clip playback as separate systems, you get one expressive layer over the whole character. That makes animation easier to author, easier to retarget, and easier to keep consistent as a project grows.

It also improves the result on screen. Because Loom3 can combine morphs and bones for the same AU or viseme, facial shapes, speech shapes, head motion, and eye direction can read as parts of the same performance instead of separate effects fighting for control.

## How To Read This README

- First working character: start with [Installation & Setup](#1-installation--setup), then [Using Presets](#2-using-presets), [Preset Selection & Validation](#3-preset-selection--validation), [Action Unit Control](#7-action-unit-control), and [Lip Sync and Speech Animation](#12-lip-sync-and-speech-animation).
- Adapting an existing rig: focus on [Using Presets](#2-using-presets), [Preset Selection & Validation](#3-preset-selection--validation), [Getting to Know Your Character](#4-getting-to-know-your-character), and [Extending & Custom Presets](#5-extending--custom-presets).
- Skeletal-only or non-human character: go to [Creating Skeletal Animation Presets](#6-creating-skeletal-animation-presets) and then [Baked Animations and Procedural Clips](#16-baked-animations-and-procedural-clips).
- Tooling, camera, or inspection workflow: read [Preset Selection & Validation](#3-preset-selection--validation), [Getting to Know Your Character](#4-getting-to-know-your-character), and [Regions & Geometry Helpers](#17-regions--geometry-helpers).

## LoomLarge Companion

These links open the LoomLarge companion app on useful tabs while you read the package docs. They are convenience links for exploration, not the source of truth for the npm API.

| Goal | Open in LoomLarge |
|------|-------------------|
| Start with the main runtime surface | [Animation tab](https://loomlarge.web.app/?drawer=open&tab=animation) |
| Inspect preset and profile settings | [Properties tab](https://loomlarge.web.app/?drawer=open&tab=properties) |
| Inspect AU, morph, and bone routing | [Mappings tab](https://loomlarge.web.app/?drawer=open&tab=mappings) |
| Inspect meshes and material state | [Meshes tab](https://loomlarge.web.app/?drawer=open&tab=meshes) |
| Inspect resolved bones | [Bones tab](https://loomlarge.web.app/?drawer=open&tab=bones) |
| Tune expressions and continuum pairs | [Action Units tab](https://loomlarge.web.app/?drawer=open&tab=action-units) |
| Inspect lip-sync views | [Visemes tab](https://loomlarge.web.app/?drawer=open&tab=visemes) and [Speech tab](https://loomlarge.web.app/?drawer=open&tab=speech) |
| Tune hair behavior | [Hair tab](https://loomlarge.web.app/?drawer=open&tab=hair) |

Use these links as companion product views while reading the package docs. They are most useful when you want to compare a concept in the README with the corresponding authoring or inspection surface in LoomLarge.

## Table of Contents

### Foundations

1. [Installation & Setup](#1-installation--setup)
2. [Using Presets](#2-using-presets)
3. [Preset Selection & Validation](#3-preset-selection--validation)
4. [Getting to Know Your Character](#4-getting-to-know-your-character)

### Advanced Authoring

5. [Extending & Custom Presets](#5-extending--custom-presets)
6. [Creating Skeletal Animation Presets](#6-creating-skeletal-animation-presets)

### Runtime Control

7. [Action Unit Control](#7-action-unit-control)
8. [Bone Blending and Mix Weights](#8-bone-blending-and-mix-weights)
9. [Bone Rotations and Transformations](#9-bone-rotations-and-transformations)
10. [Continuum Pairs](#10-continuum-pairs)
11. [Direct Morph Control](#11-direct-morph-control)
12. [Lip Sync and Speech Animation](#12-lip-sync-and-speech-animation)
13. [Animation System](#13-animation-system)
14. [Playback & State Control](#14-playback--state-control)
15. [Hair Physics](#15-hair-physics)
16. [Baked Animations and Procedural Clips](#16-baked-animations-and-procedural-clips)

### Tooling & Reference

17. [Regions & Geometry Helpers](#17-regions--geometry-helpers)
18. [API Reference](#18-api-reference)

Additional:
- [Resources](#resources)
- [License](#license)

---

## 1. Installation & Setup

Open in LoomLarge: [Animation tab](https://loomlarge.web.app/?drawer=open&tab=animation)

![Project structure with Loom3 installed](./assets/readme/project-structure.svg)

### Install the package

```bash
npm install @lovelace_lol/loom3
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
import { Loom3, collectMorphMeshes, CC4_PRESET } from '@lovelace_lol/loom3';

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

If you’re implementing a custom engine contract, target the `LoomLarge` type exported from `@lovelace_lol/loom3`. `Loom3` is the shipped Three.js implementation, and the contract is still Three.js-shaped today (`Mesh[]`, `Object3D`), not a generic renderer abstraction.

### Lifecycle and update ownership

You have two valid integration patterns:
- External render loop: call `loom.update(deltaSeconds)` from your app’s main loop.
- Internal render loop: call `loom.start()` after `onReady()` and let Loom3 drive its own RAF-based updates.

The main lifecycle methods are:
- `onReady({ meshes, model })`: bind the loaded model to the engine
- `update(deltaSeconds)`: advance transitions, mixer playback, and runtime systems once
- `start()` / `stop()`: opt into or out of the internal loop
- `dispose()`: stop playback and release engine state when the character is torn down

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
async function quickSmile() {
  // Smile over 200ms
  await loom.transitionAU(12, 0.8, 200).promise;

  // Then fade back to neutral
  await loom.transitionAU(12, 0, 300).promise;
}
```

### The `collectMorphMeshes` helper

This utility function traverses a Three.js scene and returns all meshes that have `morphTargetInfluences` (i.e., blend shapes). It's the recommended way to gather meshes for Loom3:

```typescript
import { collectMorphMeshes } from '@lovelace_lol/loom3';

const meshes = collectMorphMeshes(gltf.scene);
// Returns: Array of THREE.Mesh objects with morph targets
```

![Loaded character in a Three.js scene powered by Loom3](./assets/readme/loaded-character-scene.webp)

---

## 2. Using Presets

Open in LoomLarge: [Properties tab](https://loomlarge.web.app/?drawer=open&tab=properties) | [Mappings tab](https://loomlarge.web.app/?drawer=open&tab=mappings)

![Diagram showing how Loom3 presets connect AUs to morphs and bones](./assets/readme/preset-au-flow.svg)

Presets define how FACS Action Units and visemes map to your character's morph targets and bones. Loom3 ships with `CC4_PRESET` for Character Creator 4 characters.

Think of a preset as the translation layer between the expression you want and the rig you actually have:
- FACS AUs describe what facial action or movement you want.
- Visemes describe what speech shape you want.
- Morph targets and bone rotations describe how that shape is built on this specific character.

That distinction matters because believable facial animation often needs both systems. A jaw-open shape may need bone rotation for the hinge motion and morph targets for the lips and cheeks. A speech pose may need a viseme morph plus jaw movement. Loom3 lets one semantic control produce that combined result as a single readable shape.

### What's in a preset?

```typescript
import { CC4_PRESET } from '@lovelace_lol/loom3';

// Selected fields from CC4_PRESET:
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
    51: [{ node: 'HEAD', channel: 'ry', scale: 1, maxDegrees: 60 }],
    61: [
      { node: 'EYE_L', channel: 'rz', scale: 1, maxDegrees: 25, side: 'left' },
      { node: 'EYE_R', channel: 'rz', scale: 1, maxDegrees: 25, side: 'right' },
    ],
    // ... 29 AU entries with bone bindings
  },

  boneNodes: {
    // Logical bone name → base node name used with bonePrefix
    'HEAD': 'Head',
    'JAW': 'JawRoot',
    'EYE_L': 'L_Eye',
    'EYE_R': 'R_Eye',
    'TONGUE': 'Tongue01',
  },

  bonePrefix: 'CC_Base_',
  suffixPattern: '_\\d+$|\\.\\d+$',

  visemeKeys: [
    // 15 viseme morph names for lip-sync
    'AE', 'Ah', 'B_M_P', 'Ch_J', 'EE',
    'Er', 'F_V', 'Ih', 'K_G_H_NG', 'Oh',
    'R', 'S_Z', 'T_L_D_N', 'Th', 'W_OO'
  ],

  morphToMesh: {
    // Routes morph categories to specific meshes
    'face': ['CC_Base_Body'],
    'viseme': ['CC_Base_Body', 'CC_Base_Body_1'],
    'tongue': ['CC_Base_Tongue'],
    'eye': ['CC_Base_EyeOcclusion_1', 'CC_Base_EyeOcclusion_2'],
    'hair': ['Side_part_wavy_1', 'Side_part_wavy_2'],
  },

  auMixDefaults: {
    // Default morph contribution scale for mixed AUs
    26: 0.5,  // Jaw drop: half-strength morph shaping layered onto full bone motion
    51: 0.7,  // Head turn: strong morph accompaniment layered onto full bone motion
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

### Name resolution and profile fields

The runtime resolves bone nodes by composing `bonePrefix + boneNodes[key] + boneSuffix`, then falling back to suffix-pattern matching when a model uses numbered exports such as `_01` or `.001`. The same prefix/suffix rules are used by validation and correction helpers, which is why `CC4_PRESET` can keep base bone names like `Head` and `JawRoot` instead of repeating the full node names everywhere.

For region and marker configs, `resolveBoneName()` and `resolveBoneNames()` resolve through `boneNodes` first. When affixes are configured, the composed name is preferred and the bare mapped base name is also kept as a fallback candidate. Names that are not present in `boneNodes` pass through unchanged.

Two caveats are worth calling out:
- `morphPrefix` and `morphSuffix` are part of `Profile`, and runtime morph playback does use them. Once they are configured, runtime lookup does not fall back to the bare morph key.
- `leftMorphSuffixes` and `rightMorphSuffixes` are profile metadata for laterality detection in tooling, not core runtime behavior.

Other `Profile` fields that are easy to miss:
- `morphToMesh` routes categories such as `face`, `viseme`, `eye`, `tongue`, and `hair` to specific mesh names.
- `eyeMeshNodes` provides fallback eye nodes when a rig uses meshes instead of bones for eye control.
- `auMixDefaults` sets the default morph/bone blend weight per AU.
- `compositeRotations` defines the per-node pitch/yaw/roll axis layout used by the composite rotation system.
- `continuumPairs` and `continuumLabels` describe bidirectional AU pairs and their UI labels.
- `annotationRegions` defines the regions used by the marker and camera tooling, including per-region framing via `paddingFactor`.
- `hairPhysics` stores the mixer-driven hair defaults, including direction signs and morph target mappings.

For `annotationRegions`, `paddingFactor` is the camera framing multiplier for that region:
- values below `1` zoom in tighter
- values above `1` pull back to show more surrounding context
- profile overrides can replace it per region by name without copying the whole preset

### Passing a preset to Loom3

```typescript
import { Loom3, CC4_PRESET } from '@lovelace_lol/loom3';

const loom = new Loom3({ profile: CC4_PRESET });
```

You can also resolve presets by name and apply overrides without cloning the full preset:

```typescript
import { Loom3 } from '@lovelace_lol/loom3';

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
import type { Profile } from '@lovelace_lol/loom3';
import { Loom3 } from '@lovelace_lol/loom3';

const DAISY_PROFILE: Profile = {
  morphToMesh: { face: ['Object_9'] },
  annotationRegions: [
    { name: 'face', bones: ['CC_Base_Head'] },
    { name: 'left_eye', paddingFactor: 0.9 },
    { name: 'right_eye', paddingFactor: 0.9 },
  ],
};

const loom = new Loom3({
  presetType: 'cc4',
  profile: DAISY_PROFILE,
});
```

### Annotation configuration

`annotationRegions` is the Loom3 field for camera/marker region defaults and profile overrides.

If your app fetches a full saved `CharacterConfig` from Firestore or another backend, use `extendCharacterConfigWithPreset(...)` to build the runtime shape before handing that config to camera/marker tooling:

```typescript
import { extendCharacterConfigWithPreset } from '@lovelace_lol/loom3';

async function loadRuntimeConfig() {
  const savedConfig = await fetchCharacterConfig();
  return extendCharacterConfigWithPreset(savedConfig);
}
```

For the current runtime-oriented documentation, including:

- `paddingFactor`
- `cameraAngle`
- `cameraOffset`
- `style.lineDirection`
- the difference between `cameraAngle: 0` and omitting `cameraAngle`
- the current LoomLarge runtime note that annotations have not been moved from the demo project into Loom3 yet

see [ANNOTATION_CONFIGURATION.md](./ANNOTATION_CONFIGURATION.md).

![Character properties UI showing a Loom3 preset applied to a live character](./assets/readme/preset-applied-ui.webp)

---

## 3. Preset Selection & Validation

Open in LoomLarge: [Properties tab](https://loomlarge.web.app/?drawer=open&tab=properties) | [Mappings tab](https://loomlarge.web.app/?drawer=open&tab=mappings) | [Bones tab](https://loomlarge.web.app/?drawer=open&tab=bones)

Before you tune AUs or hand-edit a profile, confirm that you picked the right preset and that the model actually matches it. Loom3 exposes a full preset-selection and validation workflow, not just low-level control APIs.

### Resolving presets by type

Use preset helpers when you want a stable entry point by model class instead of importing a preset constant directly:

```typescript
import {
  resolvePreset,
  resolvePresetWithOverrides,
} from '@lovelace_lol/loom3';

const preset = resolvePreset('cc4');

const resolved = resolvePresetWithOverrides('cc4', {
  morphToMesh: { face: ['Object_9'] },
});
```

### Validating the config itself

`validateMappingConfig()` checks the profile for internal consistency before you even compare it to a model:

```typescript
import { validateMappingConfig } from '@lovelace_lol/loom3';

const consistency = validateMappingConfig(resolved);
console.log(consistency.errors, consistency.warnings);
```

### Checking a model against a preset

```typescript
import * as THREE from 'three';
import {
  validateMappings,
  isPresetCompatible,
  generateMappingCorrections,
} from '@lovelace_lol/loom3';

const skinnedMesh = gltf.scene.getObjectByProperty('type', 'SkinnedMesh') as THREE.SkinnedMesh | undefined;
const skeleton = skinnedMesh?.skeleton ?? null;

const validation = validateMappings(meshes, skeleton, resolved, {
  suggestCorrections: true,
});

const compatible = isPresetCompatible(meshes, skeleton, resolved);
const corrections = generateMappingCorrections(meshes, skeleton, resolved, {
  useResolvedNames: true,
});
```

### Suggesting the best preset from a candidate set

```typescript
import {
  CC4_PRESET,
  BETTA_FISH_PRESET,
  suggestBestPreset,
} from '@lovelace_lol/loom3';

const best = suggestBestPreset(meshes, skeleton, [
  CC4_PRESET,
  BETTA_FISH_PRESET,
]);
```

### Running a full model analysis

```typescript
import {
  analyzeModel,
  extractFromGLTF,
  extractModelData,
} from '@lovelace_lol/loom3';

const extracted = extractFromGLTF(gltf);
const runtimeData = extractModelData(gltf.scene, meshes, gltf.animations);

async function analyzeResolvedPreset() {
  const report = await analyzeModel({
    source: { type: 'gltf', gltf },
    preset: resolved,
    suggestCorrections: true,
  });

  console.log(report.summary, report.overallScore);
}
```

Use this section when you need to:
- choose between built-in presets before wiring the character into your app
- lint a preset/profile for broken internal references
- measure how well a preset matches an imported model
- generate correction suggestions before building a custom profile

---

## 4. Getting to Know Your Character

Open in LoomLarge: [Meshes tab](https://loomlarge.web.app/?drawer=open&tab=meshes) | [Bones tab](https://loomlarge.web.app/?drawer=open&tab=bones) | [Mappings tab](https://loomlarge.web.app/?drawer=open&tab=mappings)

![Console-style diagram showing Loom3 mesh and morph target inspection output](./assets/readme/console-mesh-output.svg)

Before customizing presets or extending mappings, it's helpful to understand what's actually in your character model. Loom3 provides several methods to inspect meshes, morph targets, and bones.

### Listing meshes

Get all meshes in your character with their visibility and morph target counts:

```typescript
const meshes = loom.getMeshList();
console.log(meshes);
// [
//   { name: 'CC_Base_Body', visible: true, morphCount: 142 },
//   { name: 'CC_Base_Tongue', visible: true, morphCount: 12 },
//   { name: 'CC_Base_EyeOcclusion_1', visible: true, morphCount: 8 },
//   { name: 'CC_Base_EyeOcclusion_2', visible: true, morphCount: 8 },
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

### Listing morph target indices

Use the index view when you need to work with `setMorphInfluence()` or build tools that operate on morph slots directly:

```typescript
const indices = loom.getMorphTargetIndices();
console.log(indices);
// {
//   'CC_Base_Body': [
//     { index: 0, name: 'A01_Brow_Inner_Up' },
//     { index: 1, name: 'A02_Brow_Down_Left' },
//     ...
//   ],
// }
```

### Validating and analyzing the model you loaded

Use the extraction and validation helpers when inspection needs to turn into preset-fit analysis:

```typescript
import {
  extractFromGLTF,
  extractModelData,
  analyzeModel,
  validateMappings,
  generateMappingCorrections,
  resolvePreset,
} from '@lovelace_lol/loom3';

const preset = resolvePreset('cc4');
const modelData = extractModelData(model, meshes, animations);
const gltfData = extractFromGLTF(gltf); // Same ModelData shape, one-step GLTF wrapper

async function inspectModel() {
  const analysis = await analyzeModel({
    source: { type: 'gltf', gltf },
    preset,
    suggestCorrections: true,
  });

  // Validate against lower-level mesh + skeleton inputs when you already have them
  const validation = validateMappings(meshes, skeleton, preset, { suggestCorrections: true });
  const corrections = generateMappingCorrections(meshes, skeleton, preset, { useResolvedNames: true });

  return { analysis, validation, corrections };
}
```

If you already have a `ModelData` bundle, `analyzeModel()` is the higher-level path; `validateMappings()` and `generateMappingCorrections()` are intentionally lower-level mesh/skeleton helpers.

Use these helpers to:
- Extract raw model facts with `extractModelData(model, meshes?, animations?)` or `extractFromGLTF(gltf)`
- Validate a preset against mesh/skeleton data with `validateMappings(meshes, skeleton, preset, options)`
- Generate best-effort fixes with `generateMappingCorrections(meshes, skeleton, preset, options)`
- Run a single end-to-end pass with `analyzeModel({ source, preset, suggestCorrections })`

`validateMappings()` returns a `ValidationResult` with:
- `valid` and `score`
- `missingMorphs`, `missingBones`, `foundMorphs`, `foundBones`
- `missingMeshes`, `foundMeshes`, `unmappedMorphs`, `unmappedBones`, `unmappedMeshes`
- `warnings`
- optional `suggestedConfig`, `corrections`, and `unresolved` when suggestion mode is enabled

`generateMappingCorrections()` returns:
- `correctedConfig`
- `corrections`
- `unresolved`

`analyzeModel()` returns a `ModelAnalysisReport` containing the extracted model data, optional validation results, animation summary, `overallScore`, and a plain-language `summary`.

### Controlling mesh visibility

Hide or show individual meshes:

```typescript
// Hide hair mesh
loom.setMeshVisible('Side_part_wavy_1', false);

// Show it again
loom.setMeshVisible('Side_part_wavy_1', true);
```

### Highlighting a mesh

Use highlighting when you need to confirm which mesh a profile field or morph category is actually targeting:

```typescript
// Highlight one mesh
loom.highlightMesh('CC_Base_Body');

// Clear all highlights
loom.highlightMesh(null);
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
loom.setMeshMaterialConfig('CC_Base_EyeOcclusion_1', {
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

![Before and after Mesh panel screenshots showing a render-order adjustment](./assets/readme/render-order-before-after.webp)

---

## 5. Extending & Custom Presets

Open in LoomLarge: [Properties tab](https://loomlarge.web.app/?drawer=open&tab=properties) | [Mappings tab](https://loomlarge.web.app/?drawer=open&tab=mappings)

![Diagram showing preset inheritance and profile override merging](./assets/readme/preset-inheritance.svg)

### Extending an existing preset

Use `resolveProfile` to override specific mappings while keeping the rest:

```typescript
import { CC4_PRESET, resolveProfile } from '@lovelace_lol/loom3';

const MY_PRESET = resolveProfile(CC4_PRESET, {

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
import type { Profile } from '@lovelace_lol/loom3';

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

![Comparison showing a custom Loom3 preset override in action](./assets/readme/custom-preset-in-action.webp)

---

## 6. Creating Skeletal Animation Presets

Open in LoomLarge: [Bones tab](https://loomlarge.web.app/?drawer=open&tab=bones) | [Action Units tab](https://loomlarge.web.app/?drawer=open&tab=action-units) | [Animation tab](https://loomlarge.web.app/?drawer=open&tab=animation)

![Betta fish model with bones panel visible](./assets/readme/fish-bones-ui.webp)

Loom3 isn't limited to humanoid characters with morph targets. You can create presets for any 3D model that uses skeletal animation, such as fish, animals, or fantasy creatures. This section explains how to create a preset for a betta fish model that has no morph targets—only bone-driven animation.

### Understanding skeletal-only models

Some models (like fish) rely entirely on bone rotations for animation:
- **No morph targets:** All movement is skeletal
- **Hierarchical bones:** Fins and body parts follow parent rotations
- **Custom "Action Units":** Instead of FACS AUs, you define model-specific actions

### Example: Betta Fish Preset

Loom3 ships a skeletal betta fish preset at the package root:

```typescript
import { BETTA_FISH_PRESET, FISH_AU_MAPPING_CONFIG } from '@lovelace_lol/loom3';

// FISH_AU_MAPPING_CONFIG is currently an alias of BETTA_FISH_PRESET.
const fishPreset = BETTA_FISH_PRESET;
```

### Defining bone bindings for movement

The shipped fish preset uses numeric AU IDs and a prefix/suffix-based bone mapping. Selected fields look like this:

```typescript
import type { BoneBinding } from '@lovelace_lol/loom3';

export const BONE_PREFIX = 'Bone.';
export const BONE_SUFFIX = '_Armature';

export const BONE_NODES = {
  ROOT: 'Armature_rootJoint',
  BODY_ROOT: 'Bone_Armature',
  HEAD: '001',
  BODY_FRONT: '002',
  BODY_MID: '003',
  BODY_BACK: '004',
  TAIL_BASE: '005',
  PECTORAL_L_ROOT: '009',
  PECTORAL_R_ROOT: '010',
  EYE_L: 'EYES_0',
  EYE_R: 'EYES_0',
} as const;

export const BONE_BINDINGS: Record<number, BoneBinding[]> = {
  // AU 2 = Turn Left
  2: [
    { node: 'HEAD', channel: 'ry', scale: 1, maxDegrees: 30 },
    { node: 'BODY_FRONT', channel: 'ry', scale: 1, maxDegrees: 14 },
    { node: 'BODY_MID', channel: 'ry', scale: 1, maxDegrees: 5 },
  ],

  // AU 12 = Tail Sweep Left
  12: [
    { node: 'BODY_BACK', channel: 'rz', scale: 1, maxDegrees: 15 },
    { node: 'TAIL_BASE', channel: 'rz', scale: 1, maxDegrees: 30 },
    { node: 'TAIL_TOP', channel: 'rz', scale: 1, maxDegrees: 20 },
    { node: 'TAIL_MID', channel: 'rz', scale: 1, maxDegrees: 20 },
  ],

  // AU 20 = Pectoral L Up
  20: [
    { node: 'PECTORAL_L_ROOT', channel: 'rz', scale: 1, maxDegrees: 40 },
    { node: 'PECTORAL_L_CHAIN1', channel: 'rz', scale: 1, maxDegrees: 20 },
    { node: 'PECTORAL_L_CHAIN2', channel: 'rz', scale: 1, maxDegrees: 20 },
  ],

  // AU 61 = Eyes Left
  61: [
    { node: 'EYE_L', channel: 'ry', scale: 1, maxDegrees: 25 },
  ],
};
```

### Composite rotations for multi-axis control

Composite rotations in the shipped fish preset also use numeric AU IDs:

```typescript
import type { CompositeRotation } from '@lovelace_lol/loom3';

export const COMPOSITE_ROTATIONS: CompositeRotation[] = [
  {
    node: 'HEAD',
    pitch: {
      aus: [4, 5],
      axis: 'rx',
      negative: 5,
      positive: 4,
    },
    yaw: {
      aus: [51, 52],
      axis: 'ry',
      negative: 51,
      positive: 52,
    },
    roll: null,
  },
  {
    node: 'TAIL_BASE',
    pitch: null,
    yaw: null,
    roll: {
      aus: [12, 13],
      axis: 'rz',
      negative: 13,
      positive: 12,
    },
  },
  {
    node: 'HEAD',
    pitch: {
      aus: [63, 64],
      axis: 'rx',
      negative: 64,
      positive: 63,
    },
    yaw: {
      aus: [61, 62],
      axis: 'ry',
      negative: 61,
      positive: 62,
    },
    roll: null,
  },
];
```

### Action metadata for UI and debugging

```typescript
import type { AUInfo } from '@lovelace_lol/loom3';

export const AU_INFO: Record<string, AUInfo> = {
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
export const CONTINUUM_PAIRS_MAP: Record<number, {
  pairId: number;
  isNegative: boolean;
  axis: 'pitch' | 'yaw' | 'roll';
  node: string;
}> = {
  2: { pairId: 3, isNegative: true, axis: 'yaw', node: 'HEAD' },
  3: { pairId: 2, isNegative: false, axis: 'yaw', node: 'HEAD' },
  12: { pairId: 13, isNegative: true, axis: 'roll', node: 'TAIL_BASE' },
  13: { pairId: 12, isNegative: false, axis: 'roll', node: 'TAIL_BASE' },
  // ... more pairs
};
```

### Creating the final preset config

The shipped fish preset is a full `Profile`, not just a tiny AU-to-bone map:

```typescript
import type { Profile } from '@lovelace_lol/loom3';

export const BETTA_FISH_PROFILE: Profile = {
  auToBones: BONE_BINDINGS,
  boneNodes: BONE_NODES,
  bonePrefix: BONE_PREFIX,
  boneSuffix: BONE_SUFFIX,
  suffixPattern: '_\\d+$|\\.\\d+$',
  auToMorphs: {} as Record<number, { left: string[]; right: string[]; center: string[] }>,  // No morph targets
  morphToMesh: {} as Record<string, string[]>,
  visemeKeys: [] as string[],  // Fish don't speak!
  auInfo: AU_INFO,
  compositeRotations: COMPOSITE_ROTATIONS,
  eyeMeshNodes: { LEFT: 'EYES_0', RIGHT: 'EYES_0' },
  meshes: MESHES,
  annotationRegions: ANNOTATION_REGIONS,
  auMixDefaults: {},
  continuumPairs: CONTINUUM_PAIRS_MAP,
  continuumLabels: CONTINUUM_LABELS,
};
```

In the current package exports:

- `BETTA_FISH_PRESET` is the full preset object
- `FISH_AU_MAPPING_CONFIG` is an alias of that shipped preset

### Designing your own skeletal preset

If you are building a new skeletal-only preset, keep these rules in mind:

- use numeric AU IDs unless you also export named constants from your own package
- prefer semantic bone keys plus `bonePrefix` / `boneSuffix` over hardcoding every fully qualified node name
- define `compositeRotations` and `continuumPairs` if you want slider-friendly bidirectional controls
- include `annotationRegions` and `meshes` if your tooling depends on camera framing or mesh categorization

### Using the fish preset

```typescript
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Loom3, collectMorphMeshes, BETTA_FISH_PRESET } from '@lovelace_lol/loom3';

const fishController = new Loom3({
  profile: BETTA_FISH_PRESET
});

async function loadFish() {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync('/characters/betta/scene.gltf');
  const meshes = collectMorphMeshes(gltf.scene);  // Will be empty for fish
  fishController.onReady({ meshes, model: gltf.scene });

  // Control the fish!
  fishController.setAU(2, 0.5);   // Turn left
  fishController.setAU(12, 0.8);  // Sweep tail
  fishController.setAU(20, 0.6);  // Raise left fin

  // Smooth transitions
  await fishController.transitionAU(3, 1.0, 500).promise;
}
```

### Creating swimming animations

Use continuum controls for natural swimming motion:

```typescript
// Use setContinuum for paired actions
fishController.setContinuum(
  2,
  3,
  0.3  // Slight turn right
);

// Animate swimming with oscillating tail
async function swimCycle() {
  while (true) {
    await fishController.transitionContinuum(
      12,
      13,
      0.8,  // Sweep right
      300
    ).promise;

    await fishController.transitionContinuum(
      12,
      13,
      -0.8, // Sweep left
      300
    ).promise;
  }
}
```

![Animated GIF of a Loom3-driven betta fish swimming](./assets/readme/fish-swimming.gif)

---

## 7. Action Unit Control

Open in LoomLarge: [Action Units tab](https://loomlarge.web.app/?drawer=open&tab=action-units)

![Grid of Loom3 Action Unit examples on a character](./assets/readme/au-values-grid.webp)

Action Units are the core of Loom3’s control model. Instead of driving a character by remembering rig-specific morph names and bone channels, you drive it by semantic facial actions such as smile, blink, brow raise, jaw drop, head turn, or eye direction.

That semantic layer matters because it is stable. A profile maps your rig’s actual morph targets and bones onto these controls, so a CC4 character, a custom face rig, or even a non-human preset can all be directed through the same higher-level interface.

### Why FACS is useful here

FACS gives Loom3 a shared vocabulary for expressive motion:
- it is named and well-defined instead of ad hoc
- it maps well to both artist-authored rigs and AI-assisted tooling
- it lets a profile normalize arbitrary morph target names into reusable semantic controls

That means you can say `setAU(12, 0.8)` and let the preset/profile resolve the actual morph targets and bone bindings behind the scenes.

That mapping layer is also why Loom3 is not tied to one naming convention. A profile can adapt CC4 morph names, ARKit-style [blendShapes](https://developer.apple.com/documentation/arkit/arfaceanchor/blendshapes), or a studio-specific rig vocabulary into the same AU surface.

### Setting an AU immediately

```typescript
// Smile
loom.setAU(12, 0.8);

// Inner brow raise
loom.setAU(1, 0.5);

// Blink
loom.setAU(45, 1.0);

// Jaw drop
loom.setAU(26, 0.5);
```

### Transitioning an AU

```typescript
async function react() {
  await loom.transitionAU(1, 0.5, 120).promise;   // Brow raise
  await loom.transitionAU(12, 0.8, 180).promise;  // Smile
}
```

Every AU transition returns a `TransitionHandle`, so you can pause, resume, cancel, or await it.

### Balance and asymmetry

Many facial actions are bilateral. Loom3 lets you bias them left or right with `balance`:

```typescript
// Balance: -1 = left only, 0 = centered, 1 = right only
loom.setAU(12, 0.8, 0);    // symmetric smile
loom.setAU(12, 0.8, -1);   // left smile
loom.setAU(12, 0.8, 1);    // right smile
loom.setAU(12, 0.8, -0.4); // left-biased smile
```

You can also select a side directly:

```typescript
loom.setAU('12L', 0.8);
loom.setAU('12R', 0.8);
```

### Current value

```typescript
const smileAmount = loom.getAU(12);
console.log(smileAmount);
```

## 8. Bone Blending and Mix Weights

Open in LoomLarge: [Action Units tab](https://loomlarge.web.app/?drawer=open&tab=action-units)

![Comparison of morph-only, mixed, and bone-only AU results](./assets/readme/mix-weight-comparison.webp)

One of Loom3’s most important features is that an expressive control does not have to be "only morph" or "only bone." Many actions look right only when both contribute to the final shape.

For example:
- a jaw drop should usually deform the mouth shape and rotate the jaw bone
- a head motion may need both soft-tissue morph response and skeletal motion
- eye and tongue actions often benefit from the same blend

For mixed AUs, Loom3 exposes a per-AU mix weight, but it is important to describe it accurately:
- the bone side still follows the AU normally
- the mix weight scales how much morph contribution is layered on top
- `0` means bone-only for that mixed AU
- `1` means full authored morph contribution alongside the bone motion
- values in between let you keep the skeletal motion while dialing the soft-tissue shaping up or down

### Why this matters

This is one of the mechanisms that makes the package feel more realistic. A pure blend-shape-only system can look rubbery. A pure bone-only system can look rigid. Mixed AUs let you keep the anatomical motion while dialing in the extra shaping the face needs.

### Example

```typescript
// Jaw drop with the preset default
const defaultWeight = loom.getAUMixWeight(26);

// Bone-only jaw
loom.setAUMixWeight(26, 0);

// Morph-light jaw
loom.setAUMixWeight(26, 0.25);

// Morph-heavy jaw
loom.setAUMixWeight(26, 0.75);
```

Only AUs that have both morph and bone bindings participate in this system. You can check that in tooling or with preset helpers such as `isMixedAU()`.

## 9. Bone Rotations and Transformations

Open in LoomLarge: [Action Units tab](https://loomlarge.web.app/?drawer=open&tab=action-units) | [Bones tab](https://loomlarge.web.app/?drawer=open&tab=bones)

![Diagram showing pitch, yaw, and roll axes on the head](./assets/readme/head-axes-diagram.svg)

Loom3 does not only animate morph targets. It also drives bone rotation and translation, and it does that in a way that can still be mixed with morph motion and mixer playback.

This matters for:
- head direction
- eye direction
- jaw motion
- tongue motion
- rigs where skeletal motion carries a large part of the expressive result

### Composite rotations

Bones like the head and eyes need multiple axes working together:
- pitch
- yaw
- roll

Loom3’s composite rotation system groups those axes so one semantic action can resolve into the right combination of bone channels and limits.

```typescript
// Turn head left
loom.setAU(51, 0.5);

// Tilt head up
loom.setAU(53, 0.3);

// Both motions combine on the same head bone
```

### Eye direction

```typescript
loom.setAU(61, 0.6); // eyes left
loom.setAU(64, 0.4); // eyes down
```

### Why quaternions show up here

Under the hood, Loom3 uses quaternion composition for composite bone rotation and quaternion tracks for generated clips. You do not need to know quaternion math to use the package, but it is worth knowing why they matter: they are the standard way to represent 3D orientation cleanly and interpolate it without the common problems you get from simple Euler-angle composition.

If you want the intuition behind that, the right explainer is 3Blue1Brown’s:
[Quaternions and 3d rotation, explained interactively](https://www.3blue1brown.com/lessons/quaternions-and-3d-rotation)

### Translation channels

Loom3 also supports bone translation bindings (`tx`, `ty`, `tz`) where a preset uses them. That means a generated clip can combine:
- morph influence tracks
- quaternion bone rotation tracks
- bone translation tracks

inside the same mixer-playable animation.

## 10. Continuum Pairs

Open in LoomLarge: [Action Units tab](https://loomlarge.web.app/?drawer=open&tab=action-units)

![Continuum slider UI for paired Loom3 AUs](./assets/readme/continuum-slider-ui.webp)

Continuum pairs are the cleanest way to work with bidirectional controls such as:
- head left / right
- head up / down
- eye left / right
- eye up / down
- jaw shift left / right

You can use the dedicated API:

```typescript
loom.setContinuum(51, 52, -0.5); // head left
loom.setContinuum(51, 52, 0.7);  // head right
```

or the shorthand most people prefer:

```typescript
loom.setAU(51, 0.5);   // left
loom.setAU(51, -0.5);  // right via the paired AU
```

That same shorthand works for transitions:

```typescript
await loom.transitionAU(51, -0.6, 300).promise;
```

## 11. Direct Morph Control

Open in LoomLarge: [Meshes tab](https://loomlarge.web.app/?drawer=open&tab=meshes) | [Mappings tab](https://loomlarge.web.app/?drawer=open&tab=mappings)

![Direct morph control screenshot with a live morph preview](./assets/readme/direct-morph-control.webp)

Sometimes the semantic AU layer is not the right tool. You may already know the exact morph target you want, or you may be building a custom effect that is outside the preset vocabulary.

That is what direct morph control is for.

```typescript
loom.setMorph('Mouth_Smile_L', 0.5);
loom.transitionMorph('Eye_Blink_L', 1.0, 100, ['CC_Base_Body']);
```

You can also target morph influences by index when a workflow already has the numeric slot:

```typescript
loom.setMorphInfluence(12, 0.3);
loom.transitionMorphInfluence(12, 0.8, 200);
```

This is the lower-level path. It is useful, but the main value of Loom3 is still that most of the time you do not need to think at this level.

## 12. Lip Sync and Speech Animation

Open in LoomLarge: [Visemes tab](https://loomlarge.web.app/?drawer=open&tab=visemes) | [Speech tab](https://loomlarge.web.app/?drawer=open&tab=speech)

![Grid of all 15 Loom3 viseme mouth shapes](./assets/readme/viseme-grid.webp)

Most rigs represent speech primarily through morph targets: mouth shapes that are baked into the character as named blend-shape influences. Realistic speech usually needs more than that, though. The jaw has to move as well, and the relative degree of lip and jaw activation changes the character of the speech.

A viseme is the visual mouth-shape side of speech animation: the visible shape family associated with a sound or phoneme sequence. In Loom3 today, visemes are still the low-level runtime API surface, but the user-facing concept is broader than that: speech animation is lip shaping plus jaw motion over time.

That is the same core pattern as the AU system. The thing you care about is the spoken shape the audience sees. Loom3 can build that shape by combining viseme morphs with jaw bone motion, so the result reads as one coherent speech pose instead of a mouth morph pasted onto a static face.

That broad idea is explored in the JALI paper, which frames speech animation around two visually distinct anatomical actions, jaw and lip, and shows how changing their relative activation can approximate different styles of speech:

- [JALI project page](https://www.dgp.toronto.edu/~elf/jali.html)
- [JALI paper PDF](https://www.dgp.toronto.edu/~elf/JALISIG16.pdf)

Loom3 is a good fit for this kind of speech animation because it can:
- drive lip-shape morph targets
- drive jaw bone motion
- turn timed speech curves into mixer-playable animation
- blend speech animation with the rest of the character’s motion

### The current low-level API

Today, the low-level speech API in Loom3 is still viseme-based:

```typescript
loom.setViseme(1, 1.0);
loom.transitionViseme(3, 1.0, 80);
```

That is an implementation detail readers should know, but the higher-level concept is still lip sync and speech animation.

For the shipped CC4 preset, the viseme indices are the zero-based positions in the exported `VISEME_KEYS` array shown below.

### Current shipped CC4 viseme order

For the shipped CC4 preset, the exported `VISEME_KEYS` order is:

```typescript
[
  'AE',
  'Ah',
  'B_M_P',
  'Ch_J',
  'EE',
  'Er',
  'F_V',
  'Ih',
  'K_G_H_NG',
  'Oh',
  'R',
  'S_Z',
  'T_L_D_N',
  'Th',
  'W_OO',
]
```

### Jaw contribution

The jaw path is important enough to state explicitly:
- live `setViseme()` and `transitionViseme()` move the viseme morphs and can also drive jaw bone motion through `jawScale`
- clip generation can also auto-generate jaw rotation from viseme curves

The current shipped implementation is still split:
- clip generation uses `profile.visemeJawAmounts`
- live viseme playback still uses the runtime’s internal jaw table

That mismatch is real, and the broader viseme / lip / jaw overhaul is tracked in issue `#100`.

### Using jawScale

```typescript
// Full jaw contribution
loom.setViseme(1, 1.0, 1.0);

// More lip-heavy, less jaw-heavy speech
loom.setViseme(1, 1.0, 0.4);

// Morph shape only, no jaw contribution
loom.setViseme(1, 1.0, 0);
```

That control is one of the ways you can approximate different styles of speech even before building a fuller speech pipeline.

### Speech clip example

```typescript
const clip = loom.snippetToClip('hello-speech', {
  '1': [
    { time: 0.00, intensity: 0.0 },
    { time: 0.08, intensity: 1.0 },
    { time: 0.16, intensity: 0.0 },
  ],
  '4': [
    { time: 0.16, intensity: 0.0 },
    { time: 0.26, intensity: 0.9 },
    { time: 0.34, intensity: 0.0 },
  ],
}, {
  snippetCategory: 'visemeSnippet',
  jawScale: 0.8,
});

if (clip) {
  loom.playClip(clip, { playbackRate: 1.0, loop: false });
}
```

## 13. Animation System

Open in LoomLarge: [Animation tab](https://loomlarge.web.app/?drawer=open&tab=animation)

![Diagram showing a Loom3 transition timeline with easing and handle methods](./assets/readme/transition-timeline-easing.svg)

This is one of the most important sections of the package.

Loom3 is not just “some transition helpers.” It is an animation system that lets imported clips and procedurally generated clips live in the same `AnimationMixer` world.

That is what makes the library useful for real-time, socially interactive characters:
- body animation can come from imported clips
- facial expression can come from AU transitions
- gaze, speech, or prosody can be generated procedurally
- all of it can still be mixed, layered, crossfaded, weighted, paused, and resumed coherently

### Four terms worth knowing

#### Transition

A direct runtime interpolation such as:
- `transitionAU()`
- `transitionMorph()`
- `transitionViseme()`

This is the simplest path when you want to change a value smoothly right now.

#### Curve

A time-varying control signal for one channel.

In Loom3, a curve might target:
- an AU
- a viseme slot
- a morph target

#### Snippet

A named bundle of curves.

Snippets are compact, editable, and easy to reason about. They are a good authoring shape for things like:
- eye/head motion
- speech animation
- expressive micro-behaviors

#### Clip

A real `AnimationMixer` clip built from tracks.

When Loom3 compiles curves into a clip, that clip can contain:
- morph influence tracks
- quaternion bone rotation tracks
- bone translation tracks

### Why this is exciting

This is the bridge between semantic authoring and real animation infrastructure.

You author something compact and meaningful, and Loom3 expands it into the constituent animation tracks the mixer actually plays. A single AU curve can eventually become rig-specific morph changes, quaternion bone rotation, and translation tracks without forcing you to author each low-level track by hand.

That is the core value:
- easy to compose
- still high performance
- still mixable with imported animation

### Transition playback vs mixer playback

Use transitions when:
- you want a direct runtime response
- you are reacting immediately to state or user input
- you do not need a reusable clip

Use mixer playback when:
- you want a reusable animation asset
- you want stronger layering and mixing behavior
- you want generated motion to live beside baked motion

### Combined example

```typescript
loom.loadAnimationClips(gltf.animations);

// Start a baked body loop
loom.playAnimation('Idle', {
  intensity: 1.0,
  loop: true,
});

// Build a procedural gaze clip
const gazeClip = loom.snippetToClip('gaze-left', {
  '61': [
    { time: 0.0, intensity: 0.0 },
    { time: 0.25, intensity: 0.7 },
  ],
  '62': [
    { time: 0.0, intensity: 0.0 },
    { time: 0.25, intensity: 0.0 },
  ],
}, {
  loop: false,
});

if (gazeClip) {
  loom.playClip(gazeClip, { loop: false, playbackRate: 1.0 });
}

// Layer live facial response on top
loom.transitionAU(12, 0.6, 180);
```

## 14. Playback & State Control

Open in LoomLarge: [Animation tab](https://loomlarge.web.app/?drawer=open&tab=animation)

![Playback controls UI showing Loom3 pause and resume controls](./assets/readme/pause-resume-controls.webp)

Loom3 gives you handle-based control at both layers:
- transition handles for direct runtime interpolation
- animation handles for mixer-backed clips

### Transition handles

```typescript
const handle = loom.transitionAU(12, 1.0, 500);
handle.pause();
handle.resume();
handle.cancel();
await handle.promise;
```

### Engine pause and resume

```typescript
loom.pause();
loom.resume();
console.log(loom.getPaused());
```

### Neutral reset

```typescript
loom.resetToNeutral();
```

That reset:
- clears cached AU values
- cancels active transitions
- zeros morph influences
- returns bones to their base pose

### Cleanup

```typescript
loom.dispose();
```

## 15. Hair Physics

Open in LoomLarge: [Hair tab](https://loomlarge.web.app/?drawer=open&tab=hair)

![Animated GIF showing Loom3 hair physics reacting to head motion](./assets/readme/hair-physics.gif)

Loom3 includes a built-in hair physics system that is also mixer-backed. It does not fight the rest of the animation system; it uses the same clip-oriented infrastructure.

At a high level, hair motion is built from:
- idle/wind loops
- short impulse clips triggered by head motion
- a gravity-style clip scrubbed by head pitch

That means head AUs and head continuum controls can feed secondary motion without requiring a separate bespoke runtime.

### Basic setup

```typescript
const loom = new Loom3({ presetType: 'cc4' });

loader.load('/character.glb', (gltf) => {
  const meshes = collectMorphMeshes(gltf.scene);
  loom.onReady({ meshes, model: gltf.scene });

  const allObjects: Object3D[] = [];
  gltf.scene.traverse((obj) => allObjects.push(obj));
  loom.registerHairObjects(allObjects);

  loom.setHairPhysicsEnabled(true);
});
```

### Runtime tuning

```typescript
loom.setHairPhysicsConfig({
  stiffness: 7.5,
  damping: 0.18,
  inertia: 3.5,
  gravity: 12,
  responseScale: 2.5,
  direction: {
    yawSign: -1,
    pitchSign: -1,
  },
});
```

### Validation

```typescript
const missing = loom.validateHairMorphTargets();
if (missing.length > 0) {
  console.warn(missing);
}
```

If hair moves the wrong way, the first thing to inspect is the direction mapping and the per-rig morph target mapping.

## 16. Baked Animations and Procedural Clips

Open in LoomLarge: [Animation tab](https://loomlarge.web.app/?drawer=open&tab=animation)

This section is the practical API surface for working with `AnimationMixer` in Loom3.

### Loading baked clips from a GLB/GLTF

```typescript
loader.load('/character.glb', (gltf) => {
  scene.add(gltf.scene);

  const meshes = collectMorphMeshes(gltf.scene);
  loom.onReady({ meshes, model: gltf.scene });
  loom.loadAnimationClips(gltf.animations);
});
```

### Listing clips

```typescript
const clips = loom.getAnimationClips();
console.log(clips);
```

### Playing a baked clip

```typescript
const handle = loom.playAnimation('Wave', {
  speed: 1.0,
  intensity: 1.0,
  loop: false,
  loopMode: 'once',
  clampWhenFinished: true,
});

await handle?.finished;
```

### Crossfading

```typescript
loom.playAnimation('Idle');
loom.crossfadeTo('Walk', 0.3);
```

### Building a procedural clip from curves

```typescript
const clip = loom.snippetToClip('gaze', {
  '61': [{ time: 0, intensity: 0 }, { time: 0.4, intensity: 0.6 }],
  '62': [{ time: 0, intensity: 0 }, { time: 0.4, intensity: 0 }],
}, {
  loop: false,
});
```

### Playing that generated clip

```typescript
if (clip) {
  const clipHandle = loom.playClip(clip, {
    loop: false,
    playbackRate: 1.0,
    mixerWeight: 1.0,
  });

  await clipHandle?.finished;
}
```

### Playing a snippet directly

```typescript
loom.playSnippet({
  name: 'look-left',
  curves: {
    '61': [{ time: 0, intensity: 0 }, { time: 0.25, intensity: 0.7 }],
    '62': [{ time: 0, intensity: 0 }, { time: 0.25, intensity: 0 }],
  },
}, { loop: false });
```

### Keeping a managed clip around

```typescript
const clipHandle = loom.buildClip('gaze-loop', {
  '61': [{ time: 0, intensity: 0 }, { time: 0.3, intensity: 0.6 }],
  '62': [{ time: 0, intensity: 0.3 }, { time: 0.3, intensity: 0 }],
}, {
  loop: true,
  loopMode: 'pingpong',
});

loom.updateClipParams('gaze-loop', {
  weight: 0.7,
  rate: 1.2,
  loopMode: 'repeat',
});

clipHandle?.pause();
clipHandle?.resume();
```

### Why this path matters

`snippetToClip()` is where the expressive control layer becomes real mixer playback. That compiled clip can combine:
- morph tracks
- quaternion rotation tracks
- translation tracks

which is exactly why Loom3 can turn high-level semantic motion into something that still mixes properly with the rest of a Three.js animation stack.

---

## 17. Regions & Geometry Helpers

Open in LoomLarge: [Bones tab](https://loomlarge.web.app/?drawer=open&tab=bones) | [Mappings tab](https://loomlarge.web.app/?drawer=open&tab=mappings)

These helpers are for applications that need semantic face regions, marker anchors, or camera targets in addition to direct animation control.

### Finding a face center directly from the model

```typescript
import { findFaceCenter } from '@lovelace_lol/loom3';

const result = findFaceCenter(gltf.scene, {
  headBoneNames: ['CC_Base_Head'],
  faceMeshNames: ['CC_Base_Body'],
});

console.log(result.center, result.method, result.debugInfo);
```

### Resolving region-driven centers

```typescript
import type { CharacterConfig, Region } from '@lovelace_lol/loom3';
import { resolveBoneName, resolveBoneNames, resolveFaceCenter } from '@lovelace_lol/loom3';

const region: Region = {
  name: 'face',
  bones: ['HEAD'],
  meshes: ['CC_Base_Body'],
};

const config = {
  characterId: 'demo',
  characterName: 'Demo',
  modelPath: '/demo.glb',
  regions: [region],
  bonePrefix: 'CC_Base_',
  boneNodes: { HEAD: 'Head' },
} satisfies CharacterConfig;

const headBone = resolveBoneName('HEAD', config);
const resolvedBones = resolveBoneNames(['HEAD'], config);
const faceCenter = resolveFaceCenter(gltf.scene, region, config);
```

### Working with model orientation

```typescript
import {
  getModelForwardDirection,
  detectFacingDirection,
} from '@lovelace_lol/loom3';

const forward = getModelForwardDirection(gltf.scene);
const facing = detectFacingDirection(gltf.scene);
```

Use these helpers when you need to:
- place annotation markers using semantic regions instead of hard-coded coordinates
- resolve prefixed/suffixed bone names from a reusable character config
- derive a face anchor for camera tooling or interaction layers
- reason about model orientation before building your own camera or annotation system

---

## 18. API Reference

Open in LoomLarge: [Animation tab](https://loomlarge.web.app/?drawer=open&tab=animation)

This is a compact reference for the public surface exported by `@lovelace_lol/loom3`.

### Core runtime

- `Loom3` is the main Three.js implementation.
- `collectMorphMeshes()` gathers meshes that already expose morph targets.
- Lifecycle: `onReady()`, `update()`, `start()`, `stop()`, `dispose()`.
- Preset state: `setProfile()`, `getProfile()`.
- Control APIs: `setAU()`, `transitionAU()`, `setContinuum()`, `transitionContinuum()`, `setMorph()`, `transitionMorph()`, `setViseme()`, `transitionViseme()`.
- Transition state: `pause()`, `resume()`, `getPaused()`, `clearTransitions()`, `getActiveTransitionCount()`, `resetToNeutral()`.

### Presets and profiles

- Presets: `CC4_PRESET`, `BETTA_FISH_PRESET`, `resolvePreset()`, `resolvePresetWithOverrides()`.
- Profile composition: `resolveProfile()`.
- CC4 exports: `VISEME_KEYS`, `VISEME_JAW_AMOUNTS`, `CONTINUUM_PAIRS_MAP`, `CONTINUUM_LABELS`, `AU_INFO`, `COMPOSITE_ROTATIONS`, `AU_MIX_DEFAULTS`.
- Compatibility helpers: `isMixedAU()`, `hasLeftRightMorphs()`.

### Validation and inspection

- Extraction: `extractModelData()`, `extractFromGLTF()`.
- Config linting: `validateMappingConfig()`.
- Model fit: `validateMappings()`, `isPresetCompatible()`, `suggestBestPreset()`, `generateMappingCorrections()`.
- Unified report: `analyzeModel()`.

### Runtime tooling

- Mesh inspection: `getMeshList()`, `getMorphTargets()`, `getMorphTargetIndices()`, `getBones()`.
- Mesh debugging: `setMeshVisible()`, `highlightMesh()`, `getMeshMaterialConfig()`, `setMeshMaterialConfig()`.
- Hair runtime: `registerHairObjects()`, `getRegisteredHairObjects()`, `setHairPhysicsEnabled()`, `setHairPhysicsConfig()`, `validateHairMorphTargets()`, `applyHairStateToObject()`.
- Mixer helpers: `loadAnimationClips()`, `getAnimationClips()`, `playAnimation()`, `pauseAnimation()`, `resumeAnimation()`, `stopAnimation()`, `stopAllAnimations()`, `pauseAllAnimations()`, `resumeAllAnimations()`, `setAnimationSpeed()`, `setAnimationIntensity()`, `setAnimationTimeScale()`, `getAnimationState()`, `getPlayingAnimations()`, `crossfadeTo()`, `snippetToClip()`, `playClip()`, `playSnippet()`, `buildClip()`, `updateClipParams()`, `supportsClipCurves()`.

### Types and lower-level exports

- Configuration/types: `Profile`, `MeshInfo`, `BlendingMode`, `TransitionHandle`, `ClipHandle`, `Snippet`, `AnimationState`, `AnimationClipInfo`.
- Standalone implementations: `AnimationThree`, `HairPhysics`, `BLENDING_MODES`.
- Region and geometry helpers: `resolveBoneName()`, `resolveBoneNames()`, `resolveFaceCenter()`, `findFaceCenter()`, `getModelForwardDirection()`, `detectFacingDirection()`.

---

## Resources

![Reference cards for FACS, Paul Ekman Group, Character Creator 4, and Three.js](./assets/readme/resources-cards.svg)

- [FACS on Wikipedia](https://en.wikipedia.org/wiki/Facial_Action_Coding_System)
- [Paul Ekman Group - FACS](https://www.paulekman.com/facial-action-coding-system/)
- [Character Creator 4](https://www.reallusion.com/character-creator/)
- [ARKit `ARFaceAnchor.blendShapes`](https://developer.apple.com/documentation/arkit/arfaceanchor/blendshapes)
- [JALI Project Page](https://www.dgp.toronto.edu/~elf/jali.html)
- [JALI Paper PDF](https://www.dgp.toronto.edu/~elf/JALISIG16.pdf)
- [3Blue1Brown: Quaternions and 3d rotation, explained interactively](https://www.3blue1brown.com/lessons/quaternions-and-3d-rotation)
- [Three.js Documentation](https://threejs.org/docs/)

## License

MIT License. Loom3 is authored by Jonathan Sutton Fields; see [LICENSE](LICENSE) and [AUTHORS.md](AUTHORS.md) for details.
