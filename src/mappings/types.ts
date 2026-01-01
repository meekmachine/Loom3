/**
 * LoomLarge - AU Mapping Types
 *
 * Type definitions for configurable Action Unit mappings.
 * Allows the engine to work with different character rigs (CC4, Mixamo, etc.)
 */

import type { BoneBinding, AUInfo, CompositeRotation } from '../core/types';

/**
 * AUMappingConfig - Complete configuration for AU-to-morph/bone mappings
 *
 * This is the main configuration object that defines how Action Units
 * map to morph targets and bone transformations for a specific rig type.
 */
export interface AUMappingConfig {
  /** Human-readable name for this profile (e.g., 'Character Creator 4', 'Betta Fish') */
  name?: string;

  /** Type of animal/creature this profile is for (e.g., 'human', 'fish', 'dog') */
  animalType?: string;

  /** Emoji representing this animal type (e.g., '😊' for human, '🐟' for fish) */
  emoji?: string;

  /** AU ID to morph target names (e.g., AU 12 → ['Mouth_Smile_L', 'Mouth_Smile_R']) */
  auToMorphs: Record<number, string[]>;

  /** AU ID to bone bindings (e.g., AU 51 → [{ node: 'HEAD', channel: 'ry', scale: 1, maxDegrees: 30 }]) */
  auToBones: Record<number, BoneBinding[]>;

  /** Bone key to actual node name in the model (e.g., 'HEAD' → 'CC_Base_Head') */
  boneNodes: Record<string, string>;

  /** Morph category to mesh names (e.g., 'face' → ['CC_Base_Body_1']) */
  morphToMesh: Record<string, string[]>;

  /** Viseme keys in order (typically 15 phoneme positions) */
  visemeKeys: string[];

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
 * Mesh info including category, morph count, and optional material settings
 */
export interface MeshInfo {
  category: MeshCategory;
  morphCount: number;
  material?: MeshMaterialSettings;
}
