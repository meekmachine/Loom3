/**
 * Eye and Head Tracking Agency Types
 * Type definitions for coordinated eye and head movements that follow mouth animations
 */

export interface AnimationSnippet {
  name: string;
  curves: Record<string, AnimationCurve[]>;
  snippetCategory: string;
  snippetPriority: number;
  currentTime: number;
  isPlaying: boolean;
  loop: boolean;
  snippetIntensityScale: number;
  maxTime?: number;
  snippetPlaybackRate?: number;
}

export interface AnimationCurve {
  time: number;
  intensity: number;
}

export type TrackingChannel = 'eye' | 'head' | 'both';

export interface GazeTarget {
  x: number; // Normalized screen space -1 to 1 (left to right)
  y: number; // Normalized screen space -1 to 1 (bottom to top)
  z?: number; // Optional depth (near to far)
}

export interface EyeHeadTrackingConfig {
  // Eye tracking settings
  eyeTrackingEnabled?: boolean;
  eyeSaccadeSpeed?: number; // Speed of eye movements (0.1-1.0)
  eyeSmoothPursuit?: boolean; // Smooth following vs saccadic jumps
  eyeBlinkRate?: number; // Blinks per minute
  eyePriority?: number; // Animation priority for eye movements
  eyeIntensity?: number; // Intensity of eye movements (0-1)
  eyeBlendWeight?: number; // Morph ↔ bone blend for eye continuum AUs

  // Head tracking settings
  headTrackingEnabled?: boolean;
  headFollowEyes?: boolean; // Head follows eye gaze direction
  headFollowDelay?: number; // Delay before head follows eyes (ms)
  headSpeed?: number; // Speed of head movements (0.1-1.0)
  headPriority?: number; // Animation priority for head movements
  headIntensity?: number; // Intensity of head movements (0-1)
  headBlendWeight?: number; // Morph ↔ bone blend for head continuum AUs

  // Webcam face tracking
  webcamTrackingEnabled?: boolean; // Enable webcam-based face tracking
  webcamLookAtUser?: boolean; // Make character look at user's face position
  webcamActivationInterval?: number; // How often to activate webcam tracking (ms)
  engine?: any; // EngineThree for applying gaze directly
  animationAgency?: any; // Animation agency for scheduling approach

  // Coordination with mouth
  mouthSyncEnabled?: boolean; // Coordinate with speech/lip-sync
  lookAtSpeaker?: boolean; // Look towards imaginary speaker during listening

  // General settings
  idleVariation?: boolean; // Add natural variation when idle
  idleVariationInterval?: number; // Milliseconds between idle movements

  // Return to neutral settings
  returnToNeutralEnabled?: boolean; // Gracefully return to center when not tracking
  returnToNeutralDelay?: number; // Delay before returning to neutral (ms)
  returnToNeutralDuration?: number; // Duration of return transition (ms)
}

export interface EyeHeadTrackingState {
  eyeStatus: 'idle' | 'tracking' | 'lagging';
  headStatus: 'idle' | 'tracking' | 'lagging';

  // Current gaze target
  currentGaze: GazeTarget;
  targetGaze: GazeTarget;

  // Eye state
  eyeIntensity: number;
  lastBlinkTime: number;

  // Head state
  headIntensity: number;
  headFollowTimer: number | null;

  // Coordination state
  isSpeaking: boolean;
  isListening: boolean;

  // Return to neutral timer
  returnToNeutralTimer: number | null;
  lastGazeUpdateTime: number;
}

export interface EyeHeadTrackingCallbacks {
  onEyeStart?: () => void;
  onEyeStop?: () => void;
  onHeadStart?: () => void;
  onHeadStop?: () => void;
  onGazeChange?: (target: GazeTarget) => void;
  onBlink?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Animation snippet storage key patterns
 */
export const DEFAULT_ANIMATION_KEYS = {
  // Eye movements
  EYE_LOOK_LEFT: 'eyeHeadTracking/eyeLookLeft',
  EYE_LOOK_RIGHT: 'eyeHeadTracking/eyeLookRight',
  EYE_LOOK_UP: 'eyeHeadTracking/eyeLookUp',
  EYE_LOOK_DOWN: 'eyeHeadTracking/eyeLookDown',
  EYE_BLINK: 'eyeHeadTracking/eyeBlink',

  // Head movements
  HEAD_TURN_LEFT: 'eyeHeadTracking/headTurnLeft',
  HEAD_TURN_RIGHT: 'eyeHeadTracking/headTurnRight',
  HEAD_TURN_UP: 'eyeHeadTracking/headTurnUp',
  HEAD_TURN_DOWN: 'eyeHeadTracking/headTurnDown',
  HEAD_TILT_LEFT: 'eyeHeadTracking/headTiltLeft',
  HEAD_TILT_RIGHT: 'eyeHeadTracking/headTiltRight',
};

/**
 * Default configuration values
 */
export const DEFAULT_EYE_HEAD_CONFIG = {
  // Eye settings
  eyeTrackingEnabled: false, // Disabled by default
  eyeSaccadeSpeed: 0.7,
  eyeSmoothPursuit: false,
  eyeBlinkRate: 17, // Average blinks per minute
  eyePriority: 20, // Higher than prosodic/lipsync
  eyeIntensity: 1.2, // 120% intensity for more range
  eyeBlendWeight: 0.5,

  // Head settings
  headTrackingEnabled: false, // Disabled by default
  headFollowEyes: true,
  headFollowDelay: 200,
  headSpeed: 0.4,
  headPriority: 15, // Slightly lower than eyes
  headIntensity: 0.8, // 80% intensity for more natural head movement
  headBlendWeight: 0.7,

  // Webcam tracking
  webcamTrackingEnabled: false,
  webcamLookAtUser: false,
  webcamActivationInterval: 7000, // 7 seconds

  // Coordination
  mouthSyncEnabled: true,
  lookAtSpeaker: false,

  // Idle behavior
  idleVariation: true,
  idleVariationInterval: 2000,

  // Return to neutral
  returnToNeutralEnabled: false, // Disabled by default
  returnToNeutralDelay: 3000, // 3 seconds
  returnToNeutralDuration: 800, // 800ms for graceful return
};

/**
 * Eye AU mappings (from shapeDict.ts)
 */
export const EYE_AUS = {
  // Both eyes
  BOTH_LOOK_LEFT: 61,
  BOTH_LOOK_RIGHT: 62,
  BOTH_LOOK_UP: 63,
  BOTH_LOOK_DOWN: 64,

  // Left eye individual
  LEFT_LOOK_LEFT: 65,
  LEFT_LOOK_RIGHT: 66,
  LEFT_LOOK_UP: 67,
  LEFT_LOOK_DOWN: 68,

  // Right eye individual
  RIGHT_LOOK_LEFT: 69,
  RIGHT_LOOK_RIGHT: 70,
  RIGHT_LOOK_UP: 71,
  RIGHT_LOOK_DOWN: 72,

  // Blink/lids
  BLINK: 43,
  WIDE: 5,
  SQUINT: 7,
} as const;

/**
 * Head AU mappings (from shapeDict.ts)
 */
export const HEAD_AUS = {
  TURN_LEFT: 31,
  TURN_RIGHT: 32,
  TURN_UP: 33,
  TURN_DOWN: 54,
  TILT_LEFT: 55,
  TILT_RIGHT: 56,
} as const;
