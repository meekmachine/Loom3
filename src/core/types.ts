/**
 * Loom3 - Core Type Definitions
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
  /** Optional side hint for balance-aware AUs. */
  side?: 'left' | 'right';
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
 * Loom3Config - Configuration options for the Loom3 engine
 */
export interface Loom3Config {
  /** AU to morph target mappings (defaults to CC4_PRESET) */
  profile?: import('../mappings/types').Profile;
  /** Preset type to resolve if profile is not provided. */
  presetType?: import('../presets').PresetType | string;
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
  /** Number of repetitions when looping (default: Infinity for repeat/pingpong) */
  repeatCount?: number;
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

// ============================================================================
// SNIPPET-TO-CLIP TYPES (Dynamic clip construction from AU curves)
// ============================================================================

/**
 * A single keyframe point in an animation curve.
 */
export interface CurvePoint {
  /** Time in seconds */
  time: number;
  /** Intensity value (0-1) */
  intensity: number;
  /** When true, inherit current AU value at playback start */
  inherit?: boolean;
}

/**
 * Map of curve IDs (AU numbers or morph names) to keyframe arrays.
 */
export type CurvesMap = Record<string, CurvePoint[]>;

/**
 * Options for building and playing a clip from curves.
 */
export interface ClipOptions {
  /** Whether the clip should loop (default: false) */
  loop?: boolean;
  /** Loop mode: repeat (default), pingpong (forward/back), or once */
  loopMode?: 'repeat' | 'pingpong' | 'once';
  /** Number of repetitions when looping (default: Infinity for repeat/pingpong) */
  repeatCount?: number;
  /** Playback rate multiplier (default: 1.0) */
  playbackRate?: number;
  /** Play clip backwards when true (implemented via negative time scale) */
  reverse?: boolean;
  /** Mixer weight/intensity (default: 1.0) */
  mixerWeight?: number;
  /** Left/right balance for bilateral AUs (-1 to 1, default: 0) */
  balance?: number;
  /** Jaw scale for viseme playback (default: 1.0) */
  jawScale?: number;
  /** Intensity scale multiplier (default: 1.0) */
  intensityScale?: number;
  /** Snippet category - when 'visemeSnippet', numeric curve IDs (0-14) are viseme indices; otherwise they're AU IDs */
  snippetCategory?: 'auSnippet' | 'visemeSnippet';
  /**
   * When true, automatically generate jaw bone rotation from viseme curves.
   * Uses VISEME_JAW_AMOUNTS to determine jaw opening per viseme index.
   * Only applies when snippetCategory is 'visemeSnippet'.
   * Default: true (for backwards compatibility with transitionViseme behavior)
   */
  autoVisemeJaw?: boolean;
}

/**
 * Handle returned when playing a dynamically-built clip.
 */
export interface ClipHandle {
  /** Name of the clip */
  clipName: string;
  /** Optional unique id for the underlying mixer action */
  actionId?: string;
  /** Start or restart playback */
  play: () => void;
  /** Stop playback and reset */
  stop: () => void;
  /** Pause playback at current position */
  pause: () => void;
  /** Resume paused playback */
  resume: () => void;
  /** Optional weight setter for live mixer updates */
  setWeight?: (w: number) => void;
  /** Optional playback-rate setter for live mixer updates */
  setPlaybackRate?: (r: number) => void;
  /** Optional loop setter for live mixer updates */
  setLoop?: (mode: 'once' | 'repeat' | 'pingpong', repeatCount?: number) => void;
  /** Optional time setter for scrubbing */
  setTime?: (time: number) => void;
  /** Get current playback time in seconds */
  getTime: () => number;
  /** Get total clip duration in seconds */
  getDuration: () => number;
  /** Promise that resolves when clip finishes (non-looping only) */
  finished: Promise<void>;
}

/**
 * Snippet definition for animation playback.
 * Can be loaded from JSON and converted to a mixer clip.
 */
export interface Snippet {
  /** Unique name for this snippet */
  name: string;
  /** Optional description */
  description?: string;
  /** Map of AU/morph IDs to keyframe curves */
  curves: CurvesMap;
  /** Category for grouping (e.g., 'eyeHeadTracking', 'visemeSnippet') */
  snippetCategory?: string;
  /** Priority for scheduling conflicts */
  snippetPriority?: number;
  /** Whether to loop playback */
  loop?: boolean;
}
