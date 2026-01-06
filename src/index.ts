/**
 * Loom3 - 3D Character Animation Engine
 *
 * A lightweight, framework-agnostic library for animating 3D character models
 * using Action Units (AUs), visemes, and bone transformations.
 *
 * @example
 * ```typescript
 * import { Loom3Three, collectMorphMeshes, CC4_PRESET } from 'loom3';
 * import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
 *
 * const loom = new Loom3Three({ auMappings: CC4_PRESET });
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
export { LoomLargeThree as Loom3Three } from './engines/three/LoomLargeThree';
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
} from './interfaces/LoomLarge';

export type {
  LoomLarge as Loom3,
  LoomLargeConfig as Loom3Config,
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
  // Snippet-to-clip types
  CurvePoint,
  CurvesMap,
  ClipOptions,
  ClipHandle,
  Snippet,
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
  MeshInfo,
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
  CC4_BONE_PREFIX,
  CC4_SUFFIX_PATTERN,
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

// Fish preset removed - now lives in livekit-monorepo/frontend/src/presets/bettaFish.ts

// ============================================================================
// PHYSICS
// ============================================================================

export {
  HairPhysics,
  DEFAULT_HAIR_PHYSICS_CONFIG,
} from './physics/HairPhysics';

export type { HairPhysicsState, HairMorphOutput as HairPhysicsMorphOutput } from './physics/HairPhysics';

// ============================================================================
// VALIDATION
// ============================================================================

export {
  validateMappings,
  validateMappingConfig,
  isPresetCompatible,
  suggestBestPreset,
} from './validation/validateMappings';

export type {
  ValidationResult,
  MappingConsistencyResult,
  MappingIssue,
  ValidateMappingOptions,
} from './validation/validateMappings';

export {
  generateMappingCorrections,
} from './validation/generateMappingCorrections';

export type {
  MappingCorrection,
  MappingCorrectionOptions,
  MappingCorrectionResult,
} from './validation/generateMappingCorrections';
