# LoomLarge

A FACS-based morph and bone mapping library for controlling high-definition 3D characters in Three.js.

## What is this?

LoomLarge provides pre-built mappings that connect **Facial Action Coding System (FACS)** Action Units to the morph targets and bone transforms found in Character Creator 4 (CC4) characters. Instead of manually figuring out which blend shapes correspond to which facial movements, you can simply say "set AU12 to 0.8" and the library handles the rest.

## Why FACS?

The [Facial Action Coding System](https://en.wikipedia.org/wiki/Facial_Action_Coding_System) is a taxonomy developed by Paul Ekman and Wallace Friesen in 1978 to categorize human facial movements by their appearance. Each **Action Unit (AU)** corresponds to a specific muscular action:

- **AU1** - Inner Brow Raiser (frontalis, pars medialis)
- **AU2** - Outer Brow Raiser (frontalis, pars lateralis)
- **AU4** - Brow Lowerer (corrugator supercilii, depressor supercilii)
- **AU6** - Cheek Raiser (orbicularis oculi, pars orbitalis)
- **AU12** - Lip Corner Puller (zygomaticus major) - the "smile" muscle
- **AU45** - Blink (orbicularis oculi, pars palpebralis)

...and many more. See the [full AU list on Wikipedia](https://en.wikipedia.org/wiki/Facial_Action_Coding_System#Action_units).

FACS is used extensively in:
- Psychology research and emotion recognition
- Animation (Pixar, Disney, game studios)
- Computer vision and ML facial analysis
- Medical and clinical facial assessment

By using FACS as the control interface, your animation code becomes:
1. **Readable** - `setAU(12, 0.8)` is clearer than `setMorph('Mouth_Smile_L', 0.8)`
2. **Portable** - Same AU numbers work across different character rigs (with appropriate presets)
3. **Research-compatible** - Integrates with academic FACS tools and datasets

## Why combine morphs and bones?

High-definition characters like those from Character Creator use both:
- **Morph targets (blend shapes)** - Vertex-level deformations for soft tissue (lips, cheeks, brows)
- **Bone transforms** - Skeletal rotations for rigid structures (jaw, head, eyes, tongue)

Some facial actions require both. For example, jaw opening (AU26/27) needs:
- Jaw bone rotation (to move the mandible)
- Lip morphs (to shape the mouth opening)

LoomLarge handles this automatically with configurable **mix weights** - you can blend between pure morph, pure bone, or any combination.

## Installation

```bash
npm install loomlarge
```

## Basic Usage

```typescript
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LoomLargeThree, collectMorphMeshes, CC4_PRESET } from 'loomlarge';

// Create the controller with CC4 mappings
const loom = new LoomLargeThree({ auMappings: CC4_PRESET });

// Load your character
const loader = new GLTFLoader();
loader.load('/character.glb', (gltf) => {
  scene.add(gltf.scene);

  // Collect meshes that have morph targets
  const meshes = collectMorphMeshes(gltf.scene);

  // Initialize LoomLarge with the meshes
  loom.onReady({ meshes, model: gltf.scene });
});

// In your animation loop
function animate() {
  requestAnimationFrame(animate);
  loom.update(deltaTime);
  renderer.render(scene, camera);
}

// Control the face
loom.setAU(12, 0.8);              // Smile (immediate)
loom.transitionAU(12, 0.8, 200);  // Smile over 200ms
loom.setViseme(3, 0.7);           // Lip-sync viseme
loom.resetToNeutral();            // Return to rest pose
```

## API

### LoomLargeThree

```typescript
const loom = new LoomLargeThree({ auMappings: CC4_PRESET });

// Setup
loom.onReady({ meshes, model });  // Initialize with loaded character
loom.dispose();                    // Cleanup

// Action Units (FACS)
loom.setAU(12, 0.8);                      // Set AU immediately
loom.transitionAU(12, 0.8, 200);          // Animate AU over duration (ms)
loom.getAU(12);                           // Get current AU value

// Direct morph control
loom.setMorph('Mouth_Smile_L', 0.5);
loom.transitionMorph('Mouth_Smile_L', 0.5, 200);

// Visemes (lip-sync)
loom.setViseme(3, 1.0);                   // Set viseme by index
loom.transitionViseme(3, 1.0, 80);        // Animate viseme

// Playback control
loom.pause();
loom.resume();
loom.resetToNeutral();

// Animation loop
loom.update(deltaTime);                   // Call each frame
```

### Presets

```typescript
import { CC4_PRESET } from 'loomlarge';

// CC4_PRESET includes:
// - auToMorphs: AU number → morph target names
// - auToBones: AU number → bone rotation/translation bindings
// - boneNodes: Bone name → node path in skeleton
// - visemeKeys: Viseme index → morph target name
// - And more...
```

### Custom Presets

You can create your own preset or extend an existing one:

```typescript
import { CC4_PRESET } from 'loomlarge';

// Extend CC4 with custom morph names
const MY_PRESET = {
  ...CC4_PRESET,
  auToMorphs: {
    ...CC4_PRESET.auToMorphs,
    12: ['MyCustomSmile_L', 'MyCustomSmile_R'],  // Override AU12
  },
};

const loom = new LoomLargeThree({ auMappings: MY_PRESET });
```

### Hair Physics (Experimental)

```typescript
import { HairPhysics } from 'loomlarge';

const hair = new HairPhysics();

// In animation loop
const headState = {
  yaw: 0, pitch: 0, roll: 0,
  yawVelocity: 0.5, pitchVelocity: 0
};
const hairMorphs = hair.update(deltaTime, headState);
// Returns: { L_Hair_Left: 0.1, L_Hair_Right: 0, ... }
```

## Supported Action Units

The CC4 preset includes mappings for 87+ Action Units:

| AU | Name | Type |
|----|------|------|
| 1 | Inner Brow Raiser | Morph |
| 2 | Outer Brow Raiser | Morph |
| 4 | Brow Lowerer | Morph |
| 5 | Upper Lid Raiser | Morph |
| 6 | Cheek Raiser | Morph |
| 7 | Lid Tightener | Morph |
| 9 | Nose Wrinkler | Morph |
| 10 | Upper Lip Raiser | Morph |
| 12 | Lip Corner Puller | Morph |
| 14 | Dimpler | Morph |
| 15 | Lip Corner Depressor | Morph |
| 17 | Chin Raiser | Morph |
| 20 | Lip Stretcher | Morph |
| 23 | Lip Tightener | Morph |
| 24 | Lip Pressor | Morph |
| 25 | Lips Part | Morph |
| 26 | Jaw Drop | Morph + Bone |
| 27 | Mouth Stretch | Morph + Bone |
| 45 | Blink | Morph |
| 51-56 | Head Position | Bone |
| 61-66 | Eye Position | Bone |
| ... | ... | ... |

## Resources

- [FACS on Wikipedia](https://en.wikipedia.org/wiki/Facial_Action_Coding_System)
- [Paul Ekman Group - FACS](https://www.paulekman.com/facial-action-coding-system/)
- [FACS Manual (Ekman & Friesen)](https://www.paulekman.com/product/facs-manual/)
- [Character Creator 4](https://www.reallusion.com/character-creator/)

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- Paul Ekman and Wallace Friesen for developing FACS
- Reallusion for Character Creator
- Three.js community
