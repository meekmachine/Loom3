/**
 * LoomLarge - 3D Character Animation Engine
 *
 * A lightweight, framework-agnostic library for animating 3D character models
 * using Action Units (AUs), visemes, and bone transformations.
 *
 * @example
 * ```typescript
 * import { LoomLargeThree, collectMorphMeshes, CC4_PRESET } from 'loomlarge';
 * import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
 *
 * const loom = new LoomLargeThree({ auMappings: CC4_PRESET });
 *
 * const loader = new GLTFLoader();
 * loader.load('/character.glb', (gltf) => {
 *   const meshes = collectMorphMeshes(gltf.scene);
 *   loom.onReady({ meshes, model: gltf.scene });
 *
 *   // Control the face
 *   loom.setAU(12, 0.8);              // Smile
 *   loom.transitionAU(12, 0.8, 200);  // Animate over 200ms
 *   loom.setViseme(3, 0.7);           // Lip-sync
 * });
 *
 * // In animation loop
 * loom.update(deltaTime);
 * ```
 */

// ============================================================================
// IMPLEMENTATIONS (Three.js)
// ============================================================================

export { LoomLargeThree, collectMorphMeshes } from './engines/three/LoomLargeThree';
export { AnimationThree } from './engines/three/AnimationThree';

// Default export for convenience
export { LoomLargeThree as default } from './engines/three/LoomLargeThree';

// ============================================================================
// INTERFACES (for implementing custom engines)
// ============================================================================

export type {
  LoomLarge,
  LoomMesh,
  LoomVector3,
  LoomEuler,
  LoomQuaternion,
  LoomObject3D,
  ReadyPayload,
  LoomLargeConfig,
  MeshInfo,
} from './interfaces/LoomLarge';

export type { Animation } from './interfaces/Animation';

export type {
  HairPhysics as HairPhysicsInterface,
  HairPhysicsConfig,
  HairStrand,
  HairState,
  HeadState,
  HairMorphOutput,
} from './interfaces/HairPhysics';

// ============================================================================
// CORE TYPES
// ============================================================================

export type {
  TransitionHandle,
  BoneKey,
  BoneBinding,
  AUInfo,
  RotationAxis,
  CompositeRotation,
  CompositeRotationState,
  RotationsState,
  // Baked animation types
  AnimationPlayOptions,
  AnimationClipInfo,
  AnimationState,
  AnimationActionHandle,
} from './core/types';

// ============================================================================
// MAPPINGS
// ============================================================================

export type {
  AUMappingConfig,
  MorphCategory,
  MeshCategory,
  BlendingMode,
  MeshMaterialSettings,
  MeshInfo as MeshMaterialInfo,
} from './mappings/types';

export { BLENDING_MODES } from './mappings/types';

// ============================================================================
// PRESETS
// ============================================================================

export { CC4_PRESET } from './presets/cc4';

// Individual CC4 preset components (for apps that need direct access)
export {
  AU_TO_MORPHS,
  BONE_AU_TO_BINDINGS,
  AU_MIX_DEFAULTS,
  CC4_BONE_NODES,
  CC4_EYE_MESH_NODES,
  CC4_MESHES,
  VISEME_KEYS,
  MORPH_TO_MESH,
  AU_INFO,
  COMPOSITE_ROTATIONS,
  CONTINUUM_PAIRS_MAP,
  CONTINUUM_LABELS,
  isMixedAU,
  hasLeftRightMorphs,
} from './presets/cc4';

// Fish preset (Betta Fish model)
export { BETTA_FISH_PRESET, FISH_AU_MAPPING_CONFIG } from './presets/bettaFish';
export {
  FISH_BONES,
  FISH_BONE_NODES,
  FISH_BONE_BINDINGS,
  FISH_AU_INFO,
  FISH_CONTINUUM_PAIRS_MAP,
  FISH_CONTINUUM_LABELS,
  FISH_COMPOSITE_ROTATIONS,
  FISH_EYE_MESH_NODES,
  FISH_MESHES,
  FishAction,
  fishHasLeftRightBones,
} from './presets/bettaFish';

// ============================================================================
// PHYSICS
// ============================================================================

export {
  HairPhysics,
  DEFAULT_HAIR_PHYSICS_CONFIG,
} from './physics/HairPhysics';

export type { HairPhysicsState, HairMorphOutput as HairPhysicsMorphOutput } from './physics/HairPhysics';
