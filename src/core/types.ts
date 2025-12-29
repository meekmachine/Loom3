/**
 * LoomLarge - Core Type Definitions
 *
 * Type definitions for the 3D character animation engine.
 * These are framework-agnostic interfaces that work with any 3D engine.
 */

/**
 * TransitionHandle - returned from transition methods
 * Provides promise-based completion notification plus fine-grained control.
 */
export interface TransitionHandle {
  /** Resolves when the transition completes (or is cancelled) */
  promise: Promise<void>;
  /** Pause this transition (holds at current value) */
  pause: () => void;
  /** Resume this transition after pause */
  resume: () => void;
  /** Cancel this transition immediately (resolves promise) */
  cancel: () => void;
}

/** Standard bone keys used in AU bindings */
export type BoneKey = 'EYE_L' | 'EYE_R' | 'JAW' | 'HEAD' | 'NECK' | 'TONGUE' | string;

/**
 * BoneBinding - Defines how an AU maps to bone transformations
 */
export interface BoneBinding {
  node: BoneKey;
  channel: 'rx' | 'ry' | 'rz' | 'tx' | 'ty' | 'tz';
  scale: -1 | 1;
  maxDegrees?: number;  // for rotation channels
  maxUnits?: number;    // for translation channels
}

/**
 * RotationAxis - Defines which AUs control a specific rotation axis
 */
export interface RotationAxis {
  aus: number[];
  axis: 'rx' | 'ry' | 'rz';
  negative?: number;
  positive?: number;
}

/**
 * CompositeRotation - Defines unified rotation axes for bones
 */
export interface CompositeRotation {
  node: string;
  pitch: RotationAxis | null;
  yaw: RotationAxis | null;
  roll: RotationAxis | null;
}

/**
 * AUInfo - Metadata about an Action Unit
 */
export interface AUInfo {
  id: string;
  name: string;
  muscularBasis?: string;
  links?: string[];
  faceArea?: 'Upper' | 'Lower';
  facePart?: string;
}

/** Per-axis rotation state - simple -1 to 1 values like stable version */
export interface CompositeRotationState {
  pitch: number;
  yaw: number;
  roll: number;
}

export type RotationsState = Record<string, CompositeRotationState>;

/**
 * LoomLargeConfig - Configuration options for the LoomLarge engine
 */
export interface LoomLargeConfig {
  /** AU to morph target mappings (defaults to CC4_PRESET) */
  auMappings?: import('../mappings/types').AUMappingConfig;
}
