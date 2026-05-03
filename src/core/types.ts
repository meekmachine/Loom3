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

/** A single AU id or a grouped list of AU ids that share one semantic direction. */
export type AUSelector = number | number[];

/**
 * RotationAxis - Defines which AUs control a specific rotation axis
 */
export interface RotationAxis {
  aus: number[];
  axis: 'rx' | 'ry' | 'rz';
  negative?: AUSelector;
  positive?: AUSelector;
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
// RUNTIME MORPH TARGET AUTHORING
// ============================================================================

export type MorphTargetAttributeData = Float32Array | number[];

export interface MorphTargetDelta {
  /** Mesh name from the loaded Three.js scene. */
  meshName: string;
  /** Morph target name to add to morphTargetDictionary. */
  name: string;
  /** POSITION deltas, usually XYZ values relative to the base mesh. */
  position: MorphTargetAttributeData;
  /** Optional NORMAL deltas. */
  normal?: MorphTargetAttributeData;
  /** Optional TANGENT deltas. */
  tangent?: MorphTargetAttributeData;
  /** Whether deltas are relative to base attributes. Defaults to true. */
  relative?: boolean;
}

export interface AddMorphTargetOptions {
  /** Replace an existing morph target with the same name. */
  replace?: boolean;
  /** Initialize the new or replaced influence value to zero. Defaults to true. */
  resetInfluence?: boolean;
  /**
   * Replace and dispose the BufferGeometry instead of mutating it in place.
   * Defaults to true because Three.js does not support mutating morph attributes
   * after a geometry has rendered.
   */
  forceGeometryReplacement?: boolean;
}

// ============================================================================
// BAKED ANIMATION TYPES (Three.js AnimationMixer support)
// ============================================================================

/** Source category for mixer-driven animations. */
export type AnimationSource = 'baked' | 'clip' | 'snippet';

/** Shared blend-mode surface for downstream animation UIs. */
export type AnimationBlendMode = 'replace' | 'additive';

/** Runtime channel classes derived from one authored baked source clip. */
export type BakedClipChannel = 'face' | 'body' | 'scene';

/** Metadata describing one derived baked runtime channel. */
export interface BakedClipChannelInfo {
  /** Logical channel key surfaced to downstream UIs. */
  channel: BakedClipChannel;
  /** Number of tracks routed into this channel. */
  trackCount: number;
  /** Whether Loom3 can play this channel directly. */
  playable: boolean;
  /** Effective/default blend mode for this channel when playable. */
  blendMode?: AnimationBlendMode;
}

/** Shared easing labels for downstream animation UIs. */
export type AnimationEasing = 'linear' | 'easeInOut' | 'easeInOutCubic' | 'easeIn' | 'easeOut';

/**
 * Options for playing a baked animation clip.
 */
export interface AnimationPlayOptions {
  /** Playback speed multiplier (default: 1.0). Alias: playbackRate. */
  speed?: number;
  /** Alias for speed so baked clips and snippet clips can share one UI contract. */
  playbackRate?: number;
  /** Animation intensity/weight (default: 1.0). Alias: weight. */
  intensity?: number;
  /** Alias for intensity so baked clips and snippet clips can share one UI contract. */
  weight?: number;
  /** Whether the animation should loop (default: true) */
  loop?: boolean;
  /** Loop mode: 'repeat' (restart from beginning), 'pingpong' (reverse direction), 'once' (no loop) */
  loopMode?: 'repeat' | 'pingpong' | 'once';
  /** Number of repetitions when looping (default: Infinity for repeat/pingpong) */
  repeatCount?: number;
  /** Play clip backwards when true (implemented via negative time scale) */
  reverse?: boolean;
  /** Shared balance metadata for downstream UIs (-1 to 1, default: 0) */
  balance?: number;
  /** Shared blend metadata for downstream UIs (default: replace) */
  blendMode?: AnimationBlendMode;
  /** Shared easing metadata for downstream UIs (default: linear) */
  easing?: AnimationEasing;
  /** Crossfade duration in seconds when transitioning from another animation (default: 0.3) */
  crossfadeDuration?: number;
  /** Clamp animation at end when not looping (default: true) */
  clampWhenFinished?: boolean;
  /** Start time offset in seconds (default: 0) */
  startTime?: number;
  /** Optional source override for downstream consumers */
  source?: AnimationSource;
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
  /** Source of the clip for downstream UI grouping */
  source?: AnimationSource;
  /** Derived channel metadata for partitioned baked clips. */
  channels?: BakedClipChannelInfo[];
}

/**
 * State of a currently playing animation.
 */
export interface AnimationState {
  /** Name of the animation */
  name: string;
  /** Optional action id for the current mixer action */
  actionId?: string;
  /** Source of the animation for downstream UIs */
  source?: AnimationSource;
  /** Whether the animation is currently playing */
  isPlaying: boolean;
  /** Whether the animation is paused */
  isPaused: boolean;
  /** Current playback time in seconds */
  time: number;
  /** Duration of the animation in seconds */
  duration: number;
  /** Current playback speed magnitude. */
  speed: number;
  /** Alias for speed to match snippet-style UIs. */
  playbackRate: number;
  /** Whether the animation is playing in reverse */
  reverse: boolean;
  /** Current weight/intensity */
  weight: number;
  /** Shared balance metadata for downstream UIs */
  balance: number;
  /** Requested source-level blend mode before per-channel routing. */
  requestedBlendMode: AnimationBlendMode;
  /** Shared blend metadata for downstream UIs */
  blendMode: AnimationBlendMode;
  /** Derived channel metadata for partitioned baked clips. */
  channels?: BakedClipChannelInfo[];
  /** Shared easing metadata for downstream UIs */
  easing: AnimationEasing;
  /** Whether the animation is looping */
  loop: boolean;
  /** Loop mode */
  loopMode: 'repeat' | 'pingpong' | 'once';
  /** Number of repetitions when looping (if configured) */
  repeatCount?: number;
  /** Whether the animation is looping */
  isLooping: boolean;
}

/**
 * Handle returned when playing an animation, providing control methods.
 */
export interface AnimationActionHandle {
  /** Optional unique id for the underlying mixer action */
  actionId?: string;
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

export type ClipEvent =
  | {
      type: 'keyframe';
      clipName: string;
      keyframeIndex: number;
      totalKeyframes: number;
      currentTime: number;
      duration: number;
      iteration: number;
    }
  | {
      type: 'loop';
      clipName: string;
      iteration: number;
      currentTime: number;
      duration: number;
    }
  | {
      type: 'seek';
      clipName: string;
      currentTime: number;
      duration: number;
      iteration: number;
    }
  | {
      type: 'completed';
      clipName: string;
      currentTime: number;
      duration: number;
      iteration: number;
    };

export type ClipEventListener = (event: ClipEvent) => void;

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
  /** Alias for playbackRate so clip-backed animations can share one UI contract with baked clips. */
  speed?: number;
  /** Play clip backwards when true (implemented via negative time scale) */
  reverse?: boolean;
  /** Start time offset in seconds (default: clip start, or clip end for reverse once playback) */
  startTime?: number;
  /** Mixer weight/intensity (default: 1.0) */
  mixerWeight?: number;
  /** Alias for mixerWeight/intensity so clip-backed animations can share one UI contract. */
  weight?: number;
  /** Alias for weight/intensity so clip-backed animations can share one UI contract. */
  intensity?: number;
  /** Left/right balance for bilateral AUs (-1 to 1, default: 0) */
  balance?: number;
  /** Shared blend metadata for downstream UIs (default: replace) */
  blendMode?: AnimationBlendMode;
  /** Shared easing metadata for downstream UIs (default: linear) */
  easing?: AnimationEasing;
  /** Legacy additive toggle alias for downstream compatibility */
  mixerAdditive?: boolean;
  /**
   * Per-curve left/right balance overrides keyed by curve id (typically AU ids as strings).
   * Example: { "43": 1, "12": 0.7 }.
   * Falls back to `balance` when a curve id is not present.
   */
  balanceMap?: Record<string, number>;
  /** Jaw scale for viseme playback (default: 1.0) */
  jawScale?: number;
  /** Intensity scale multiplier (default: 1.0) */
  intensityScale?: number;
  /** Optional morph target mesh names to constrain track creation */
  meshNames?: string[];
  /** Snippet category - when 'visemeSnippet', numeric curve IDs (0-14) are viseme indices; otherwise they're AU IDs */
  snippetCategory?: 'auSnippet' | 'visemeSnippet';
  /**
   * When true, automatically generate jaw bone rotation from viseme curves.
   * Uses VISEME_JAW_AMOUNTS to determine jaw opening per viseme index.
   * Only applies when snippetCategory is 'visemeSnippet'.
   * Default: true (for backwards compatibility with transitionViseme behavior)
   */
  autoVisemeJaw?: boolean;
  /** Optional source override for downstream consumers */
  source?: AnimationSource;
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
  /** Subscribe to clip lifecycle events emitted by the runtime update loop */
  subscribe?: (listener: ClipEventListener) => () => void;
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
