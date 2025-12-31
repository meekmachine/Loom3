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

// ============================================================================
// BAKED ANIMATION TYPES (Three.js AnimationMixer support)
// ============================================================================

/**
 * Options for playing a baked animation clip.
 */
export interface AnimationPlayOptions {
  /** Playback speed multiplier (default: 1.0) */
  speed?: number;
  /** Animation intensity/weight (0-1, default: 1.0) */
  intensity?: number;
  /** Whether the animation should loop (default: true) */
  loop?: boolean;
  /** Loop mode: 'repeat' (restart from beginning), 'pingpong' (reverse direction), 'once' (no loop) */
  loopMode?: 'repeat' | 'pingpong' | 'once';
  /** Crossfade duration in seconds when transitioning from another animation (default: 0.3) */
  crossfadeDuration?: number;
  /** Clamp animation at end when not looping (default: true) */
  clampWhenFinished?: boolean;
  /** Start time offset in seconds (default: 0) */
  startTime?: number;
}

/**
 * Information about a loaded animation clip.
 */
export interface AnimationClipInfo {
  /** Name of the animation clip */
  name: string;
  /** Duration of the animation in seconds */
  duration: number;
  /** Number of tracks (bones/morphs being animated) */
  trackCount: number;
}

/**
 * State of a currently playing animation.
 */
export interface AnimationState {
  /** Name of the animation */
  name: string;
  /** Whether the animation is currently playing */
  isPlaying: boolean;
  /** Whether the animation is paused */
  isPaused: boolean;
  /** Current playback time in seconds */
  time: number;
  /** Duration of the animation in seconds */
  duration: number;
  /** Current playback speed */
  speed: number;
  /** Current weight/intensity (0-1) */
  weight: number;
  /** Whether the animation is looping */
  isLooping: boolean;
}

/**
 * Handle returned when playing an animation, providing control methods.
 */
export interface AnimationActionHandle {
  /** Stop the animation */
  stop: () => void;
  /** Pause the animation */
  pause: () => void;
  /** Resume a paused animation */
  resume: () => void;
  /** Set playback speed */
  setSpeed: (speed: number) => void;
  /** Set animation weight/intensity (0-1) */
  setWeight: (weight: number) => void;
  /** Seek to a specific time in seconds */
  seekTo: (time: number) => void;
  /** Get current animation state */
  getState: () => AnimationState;
  /** Crossfade to another animation */
  crossfadeTo: (clipName: string, duration?: number) => AnimationActionHandle | null;
  /** Promise that resolves when animation completes (only for non-looping) */
  finished: Promise<void>;
}
