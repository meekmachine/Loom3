# Loom3

`@lovelace_lol/loom3` is a Three.js-first character animation engine for:

- facial Action Units (AUs)
- visemes and lip-sync
- morph-target playback
- bone-driven motion
- baked clip generation and playback
- rig validation and preset-fit analysis

The previous long-form README has been preserved as [README.legacy-chaos.md](./README.legacy-chaos.md) while this version is rebuilt from the shipped exports and current behavior.

## Install

```bash
npm install @lovelace_lol/loom3 three
```

`three` is a peer dependency.

## What The Package Exports

The published package exposes the root entry only. Use package-root imports such as:

```typescript
import {
  Loom3,
  collectMorphMeshes,
  CC4_PRESET,
  BETTA_FISH_PRESET,
  FISH_AU_MAPPING_CONFIG,
  resolvePreset,
  validateMappings,
  generateMappingCorrections,
  extractModelData,
  analyzeModel,
} from '@lovelace_lol/loom3';
```

Deep imports are not part of the published package surface.

## Quick Start

```typescript
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Loom3, collectMorphMeshes } from '@lovelace_lol/loom3';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 2.5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const clock = new THREE.Clock();
const loom = new Loom3({ presetType: 'cc4' });

async function main() {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync('/character.glb');

  scene.add(gltf.scene);

  const meshes = collectMorphMeshes(gltf.scene);
  loom.onReady({ model: gltf.scene, meshes });
  loom.loadAnimationClips(gltf.animations);

  loom.setAU(12, 0.8);            // smile
  loom.transitionAU(1, 0.5, 150);
  loom.setViseme(1, 1.0);         // CC4 index 1 = Ah

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  loom.update(dt);
  renderer.render(scene, camera);
}

void main();
```

If you prefer an internal RAF loop, call `loom.start()` after `onReady()` instead of driving `loom.update(dt)` yourself.

## Main Concepts

### `Loom3`

`Loom3` is the shipped Three.js implementation. It owns the runtime state for morphs, bones, visemes, transitions, and clip playback.

Core lifecycle methods:

- `onReady({ meshes, model })`
- `update(deltaSeconds)`
- `start()`
- `stop()`
- `dispose()`

Useful inspection methods:

- `getMeshList()`
- `getMorphTargets()`
- `getBones()`
- `getProfile()`

### `collectMorphMeshes(root)`

`collectMorphMeshes(root)` traverses a Three.js `Object3D` and returns meshes that expose morph targets. It is the recommended way to gather the `meshes` array for `onReady()`.

## Animation API

### Action Units

```typescript
loom.setAU(12, 0.8);
loom.transitionAU(45, 1.0, 80);
```

- `setAU(id, value, balance?)`
- `transitionAU(id, value, durationMs?, balance?)`

`id` can be a numeric AU or a supported string selector. `balance` is the bilateral left/right weighting control.

### Continuum Pairs

For paired controls such as left/right eyes or head direction:

```typescript
loom.setContinuum(61, 62, -0.6);

async function moveHead() {
  await loom.transitionContinuum(51, 52, 0.8, 250).promise;
}
```

- `setContinuum(negativeAU, positiveAU, value, balance?)`
- `transitionContinuum(negativeAU, positiveAU, value, durationMs?, balance?)`

`value` runs from `-1` to `1`.

### Morph Targets

```typescript
loom.setMorph('Mouth_Smile_L', 1.0);
loom.transitionMorph('Eye_Blink_L', 1.0, 80, ['CC_Base_Body']);
loom.setMorphInfluence(12, 0.5, ['CC_Base_Body']);
```

Available methods:

- `setMorph(key, value, meshNames?)`
- `transitionMorph(key, value, durationMs?, meshNames?)`
- `setMorphInfluence(index, value, meshNames?)`
- `transitionMorphInfluence(index, value, durationMs?, meshNames?)`

If your profile configures `morphPrefix` and `morphSuffix`, runtime lookup uses the affixed morph name and suffix-pattern variants. It does not fall back to the bare key once affixes are configured.

### Visemes

Viseme indices are profile-defined. For the shipped CC4 preset, the exported `VISEME_KEYS` order is:

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

Example:

```typescript
loom.setViseme(1, 1.0);            // Ah
loom.transitionViseme(3, 1.0, 80); // Ch_J
```

Related exports:

- `VISEME_KEYS`
- `VISEME_JAW_AMOUNTS`

Current behavior note:

- clip generation uses `profile.visemeJawAmounts`
- live `setViseme()` / `transitionViseme()` jaw coupling is not yet fully profile-driven

That mismatch is implementation reality today; do not assume custom `visemeJawAmounts` automatically affect every viseme path equally.

## Presets

### CC4

`CC4_PRESET` is the default humanoid preset.

```typescript
import { Loom3, CC4_PRESET } from '@lovelace_lol/loom3';

const loom = new Loom3({ profile: CC4_PRESET });
```

Useful CC4 exports include:

- `CC4_PRESET`
- `AU_TO_MORPHS`
- `BONE_AU_TO_BINDINGS`
- `CC4_BONE_NODES`
- `CC4_BONE_PREFIX`
- `CC4_SUFFIX_PATTERN`
- `VISEME_KEYS`
- `VISEME_JAW_AMOUNTS`
- `AU_INFO`
- `COMPOSITE_ROTATIONS`
- `CONTINUUM_PAIRS_MAP`
- `CONTINUUM_LABELS`

### Betta Fish / Skeletal

The fish preset is skeletal-first and uses numeric AU IDs. The package-root exports are:

- `BETTA_FISH_PRESET`
- `FISH_AU_MAPPING_CONFIG`

Example:

```typescript
import { Loom3, BETTA_FISH_PRESET } from '@lovelace_lol/loom3';

const fish = new Loom3({ profile: BETTA_FISH_PRESET });

fish.setAU(2, 0.5);   // turn left
fish.setAU(12, 0.8);  // tail sweep left
fish.setAU(20, 0.6);  // pectoral fin motion
```

There is no package-root `FishAction` enum today. If you want named constants, add and export them explicitly rather than relying on deep imports or README-only pseudo-code.

### Resolving Presets By Name

```typescript
const humanoid = resolvePreset('cc4');
const fish = resolvePreset('fish');
const skeletal = resolvePreset('skeletal');
```

Supported preset strings:

- `'cc4'`
- `'fish'`
- `'skeletal'`
- `'custom'`

## Profile Overrides

Use `profile` overrides when your rig mostly matches a shipped preset:

```typescript
import { Loom3, CC4_PRESET, applyProfileToPreset } from '@lovelace_lol/loom3';

const profile = applyProfileToPreset(CC4_PRESET, {
  morphPrefix: 'CC_',
  morphSuffix: '_geo',
  morphToMesh: {
    face: ['FaceMesh'],
    viseme: ['FaceMesh'],
  },
});

const loom = new Loom3({ profile });
```

You can also swap profiles at runtime with `loom.setProfile(profile)`.

## Validation And Analysis

Loom3 ships inspection and fit-analysis helpers for imported models.

```typescript
import * as THREE from 'three';
import {
  analyzeModel,
  collectMorphMeshes,
  extractModelData,
  resolvePreset,
} from '@lovelace_lol/loom3';

async function inspect(gltf: { scene: THREE.Object3D; animations: THREE.AnimationClip[] }) {
  const preset = resolvePreset('cc4');
  const meshes = collectMorphMeshes(gltf.scene);
  const modelData = extractModelData(gltf.scene, meshes, gltf.animations);

  const report = await analyzeModel({
    source: { type: 'gltf', gltf },
    preset,
    suggestCorrections: true,
  });

  return { modelData, report };
}
```

Lower-level validation helpers:

- `validateMappings(meshes, skeleton, profile, options?)`
- `generateMappingCorrections(meshes, skeleton, profile, options?)`
- `suggestBestPreset(...)`
- `isPresetCompatible(...)`

These APIs are useful when a rig almost matches CC4 or fish but needs prefix/suffix, bone, or morph corrections.

## Character Config And Region Helpers

For region, marker, and camera tooling:

```typescript
import {
  extendCharacterConfigWithPreset,
  resolveBoneName,
  resolveBoneNames,
  resolveFaceCenter,
} from '@lovelace_lol/loom3';
```

Key behavior:

- region helpers resolve semantic names through `boneNodes`
- when `bonePrefix` / `boneSuffix` are configured, composed names are preferred
- `resolveBoneNames()` also includes the bare mapped base name as fallback
- names that are not present in `boneNodes` pass through unchanged

Do not assume a special `_` / `.` escape hatch in `resolveBoneName()`; that is not how the current implementation works.

## Baked Clips

Loom3 can convert AU and viseme curves into Three.js mixer clips:

```typescript
const clip = loom.snippetToClip('gaze', {
  '61': [{ time: 0, intensity: 0 }, { time: 0.4, intensity: 0.6 }],
  '62': [{ time: 0, intensity: 0 }, { time: 0.4, intensity: 0 }],
}, { loop: false });

async function playGaze() {
  if (!clip) return;
  const handle = loom.playClip(clip, { loop: false, speed: 1 });
  if (handle) {
    await handle.finished;
  }
}
```

Related methods:

- `loadAnimationClips(clips)`
- `getAnimationClips()`
- `playAnimation(name, options?)`
- `stopAnimation(name)`
- `snippetToClip(name, curves, options?)`
- `playClip(clip, options?)`

## Custom Engines

If you need the engine contract type, use `LoomLarge` from the package root.

That contract is still Three.js-shaped today:

- `ReadyPayload` is `{ meshes: Mesh[]; model: Object3D }`
- helpers and analysis APIs also operate on Three.js and GLTF objects

`Loom3` is the concrete runtime class. `LoomLarge` is not a renderer-neutral abstraction.

## Companion App

LoomLarge is the companion app / playground for inspecting presets, mappings, visemes, and runtime state:

- [LoomLarge](https://loomlarge.web.app/)

The app is useful for exploration, but this README is intentionally centered on the published npm surface.
