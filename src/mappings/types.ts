/**
 * Loom3 - Profile Types
 *
 * Type definitions for character profiles.
 * Profiles define how Action Units map to morphs/bones for a specific rig.
 */

import type { BoneBinding, AUInfo, CompositeRotation } from '../core/types';

/**
 * Profile - Complete configuration for AU-to-morph/bone mappings
 *
 * This is the main configuration object that defines how Action Units
 * map to morph targets and bone transformations for a specific rig type.
 */
export interface Profile {
  /** Human-readable name for this profile (e.g., 'Character Creator 4', 'Betta Fish') */
  name?: string;

  /** Type of animal/creature this profile is for (e.g., 'human', 'fish', 'dog') */
  animalType?: string;

  /** Emoji representing this animal type (e.g., '😊' for human, '🐟' for fish) */
  emoji?: string;

  /** AU ID to morph target names split by side */
  auToMorphs: Record<number, MorphTargetsBySide>;

  /** AU ID to bone bindings (e.g., AU 51 → [{ node: 'HEAD', channel: 'ry', scale: 1, maxDegrees: 30 }]) */
  auToBones: Record<number, BoneBinding[]>;

  /** Bone key to actual node name in the model (e.g., 'HEAD' → 'Head' or 'CC_Base_Head') */
  boneNodes: Record<string, string>;

  /**
   * Optional: Prefix to prepend to bone names when resolving nodes.
   * If set, boneNodes should contain base names without prefix (e.g., 'Head' instead of 'CC_Base_Head').
   * The engine will try: prefix + baseName + suffix, then fuzzy match with suffixPattern.
   */
  bonePrefix?: string;

  /**
   * Optional: Suffix to append to bone names when resolving nodes.
   * Combined with bonePrefix: prefix + baseName + suffix (e.g., 'Bone.' + '001' + '_Armature' = 'Bone.001_Armature')
   */
  boneSuffix?: string;

  /**
   * Optional: Prefix to prepend to morph target names when resolving.
   * Similar to bonePrefix but for morph targets.
   */
  morphPrefix?: string;

  /**
   * Optional: Suffix to append to morph target names when resolving.
   * Similar to boneSuffix but for morph targets.
   */
  morphSuffix?: string;

  /**
   * Optional: Regex pattern string for fuzzy matching bone/morph names with suffixes.
   * Common patterns: "_\\d+$" for numbered suffixes (_01, _038), "\\.\\d+$" for Blender (.001)
   * When set, the engine will try exact match first, then fuzzy match using this pattern.
   */
  suffixPattern?: string;

  /**
   * Optional: Suffixes that indicate left-side morph targets.
   * Used for auto-detecting laterality in the mapping editor.
   * Default: ['_L', ' L']
   */
  leftMorphSuffixes?: string[];

  /**
   * Optional: Suffixes that indicate right-side morph targets.
   * Used for auto-detecting laterality in the mapping editor.
   * Default: ['_R', ' R']
   */
  rightMorphSuffixes?: string[];

  /** Morph category to mesh names (e.g., 'face' → ['CC_Base_Body_1']) */
  morphToMesh: Record<string, string[]>;

  /** Viseme targets in order (typically 15 phoneme positions) */
  visemeKeys: MorphTargetRef[];

  /** Optional: Jaw opening amounts per viseme index (0-1). Used for auto-generating jaw rotation in clips. */
  visemeJawAmounts?: number[];

  /** Optional: Default mix weights for bone/morph blending (0 = morph only, 1 = bone only) */
  auMixDefaults?: Record<number, number>;

  /** Optional: AU metadata (names, muscle basis, etc.) */
  auInfo?: Record<string, AUInfo>;

  /** Optional: Eye mesh node fallbacks (some rigs use mesh nodes instead of bone nodes) */
  eyeMeshNodes?: {
    LEFT: string;
    RIGHT: string;
  };

  /** Optional: Composite rotation definitions for bones (defaults to CC4 composites) */
  compositeRotations?: CompositeRotation[];

  /** Optional: Mesh info for material settings (depthWrite, blending, renderOrder, etc.) */
  meshes?: Record<string, MeshInfo>;

  /**
   * Optional: Continuum pair mappings for bidirectional AU axes.
   * Maps AU ID to its partner info (pairId, isNegative, axis, node).
   * Enables negative value shorthand: setAU(51, -0.5) activates AU 52 at 0.5
   */
  continuumPairs?: Record<number, {
    pairId: number;
    isNegative: boolean;
    axis: 'pitch' | 'yaw' | 'roll';
    node: string;
  }>;

  /**
   * Optional: Human-readable labels for continuum pairs.
   * Key format: "negativeAU-positiveAU" (e.g., "51-52")
   * Value: Display label (e.g., "Head Turn — Left ↔ Right")
   */
  continuumLabels?: Record<string, string>;

  /**
   * Optional: Annotation regions for camera/marker overlays.
   */
  annotationRegions?: AnnotationRegion[];

  /**
   * Optional: Hair physics defaults for this preset/profile.
   */
  hairPhysics?: HairPhysicsProfileConfig;
}

/**
 * Hair physics morph mapping axis types.
 */
export type HairMorphAxis = 'yaw' | 'pitch' | 'roll';

/**
 * Single morph target mapping with axis metadata.
 */
export interface HairMorphTargetMapping {
  key: string;
  axis: HairMorphAxis;
}

/**
 * Morph target mapping with axis metadata and intensity value.
 */
export interface HairMorphTargetValueMapping {
  value: number;
  axis: HairMorphAxis;
}

/**
 * Hair physics defaults stored in presets/profiles.
 */
export interface HairPhysicsProfileConfig {
  stiffness?: number;
  damping?: number;
  inertia?: number;
  gravity?: number;
  responseScale?: number;
  idleSwayAmount?: number;
  idleSwaySpeed?: number;
  windStrength?: number;
  windDirectionX?: number;
  windDirectionZ?: number;
  windTurbulence?: number;
  windFrequency?: number;
  idleClipDuration?: number;
  impulseClipDuration?: number;
  direction?: {
    yawSign?: 1 | -1;
    pitchSign?: 1 | -1;
  };
  morphTargets?: {
    swayLeft?: HairMorphTargetMapping;
    swayRight?: HairMorphTargetMapping;
    swayFront?: HairMorphTargetMapping;
    fluffRight?: HairMorphTargetMapping;
    fluffBottom?: HairMorphTargetMapping;
    headUp?: Record<string, HairMorphTargetValueMapping>;
    headDown?: Record<string, HairMorphTargetValueMapping>;
  };
}


/**
 * Annotation region definition for camera markers.
 */
export interface AnnotationRegion {
  name: string;
  bones?: string[];
  meshes?: string[];
  objects?: string[];
  paddingFactor?: number;
  cameraAngle?: number;
  cameraOffset?: {
    x?: number;
    y?: number;
    z?: number;
  };
  parent?: string;
  children?: string[];
  expandAnimation?: 'outward' | 'staggered';
  showChildConnections?: boolean;
  style?: {
    markerColor?: number;
    markerRadius?: number;
    lineColor?: number;
    labelColor?: string;
    labelBackground?: string;
    labelFontSize?: number;
    opacity?: number;
    lineDirection?: 'radial' | 'camera' | 'up' | 'down' | 'left' | 'right' | 'forward' | 'backward' | { x: number; y: number; z: number };
    line?: {
      style?: 'solid' | 'dashed' | 'dotted';
      curve?: 'straight' | 'bezier' | 'arc';
      arrowHead?: boolean;
      thickness?: number;
      length?: number;
    };
  };
  groupId?: string;
  isFallback?: boolean;
}

/**
 * Morph target key (name in morphTargetDictionary).
 */
export type MorphTargetKey = string;

/**
 * Morph target index (morphTargetInfluences slot).
 */
export type MorphTargetIndex = number;

/**
 * Morph target reference (key or index).
 */
export type MorphTargetRef = MorphTargetKey | MorphTargetIndex;

export interface MorphTargetsBySide {
  left: MorphTargetRef[];
  right: MorphTargetRef[];
  center: MorphTargetRef[];
}

/**
 * Helper type for mesh categories in morphToMesh
 */
export type MorphCategory = 'face' | 'viseme' | 'eye' | 'tearLine' | 'tongue' | 'hair';

/**
 * Mesh category types for character mesh classification
 */
export type MeshCategory = 'body' | 'eye' | 'eyeOcclusion' | 'tearLine' | 'teeth' | 'tongue' | 'hair' | 'eyebrow' | 'cornea' | 'eyelash';

/**
 * Blending mode names (matches Three.js constants)
 */
export type BlendingMode = 'Normal' | 'Additive' | 'Subtractive' | 'Multiply' | 'None';

/**
 * Blending mode options for Three.js materials
 * Maps mode name to Three.js blending constant value
 */
export const BLENDING_MODES: Record<BlendingMode, number> = {
  'Normal': 1,      // THREE.NormalBlending
  'Additive': 2,    // THREE.AdditiveBlending
  'Subtractive': 3, // THREE.SubtractiveBlending
  'Multiply': 4,    // THREE.MultiplyBlending
  'None': 0,        // THREE.NoBlending
};

/**
 * Material settings for mesh rendering
 */
export interface MeshMaterialSettings {
  renderOrder?: number;
  transparent?: boolean;
  opacity?: number;
  depthWrite?: boolean;
  depthTest?: boolean;
  blending?: BlendingMode;
}

/**
 * Mesh info including category, morph count, and optional material settings.
 * Used in presets, profiles, and runtime.
 */
export interface MeshInfo {
  name?: string;
  visible?: boolean;
  category: MeshCategory;
  morphCount: number;
  material?: MeshMaterialSettings;
}
