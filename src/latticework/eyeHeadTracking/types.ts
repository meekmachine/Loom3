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

  // Head tracking settings
  headTrackingEnabled?: boolean;
  headFollowEyes?: boolean; // Head follows eye gaze direction
  headFollowDelay?: number; // Delay before head follows eyes (ms)
  headSpeed?: number; // Speed of head movements (0.1-1.0)
  headPriority?: number; // Animation priority for head movements
  headIntensity?: number; // Intensity of head movements (0-1)

  // Webcam face tracking
  webcamTrackingEnabled?: boolean; // Enable webcam-based face tracking
  webcamLookAtUser?: boolean; // Make character look at user's face position
  webcamActivationInterval?: number; // How often to activate webcam tracking (ms)
  engine?: any; // EngineThree for applying gaze directly

  // Coordination with mouth
  mouthSyncEnabled?: boolean; // Coordinate with speech/lip-sync
  lookAtSpeaker?: boolean; // Look towards imaginary speaker during listening

  // General settings
  idleVariation?: boolean; // Add natural variation when idle
  idleVariationInterval?: number; // Milliseconds between idle movements
}

export interface EyeHeadTrackingState {
  eyeStatus: 'idle' | 'tracking' | 'saccade' | 'smooth_pursuit';
  headStatus: 'idle' | 'tracking' | 'following';

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
  eyeTrackingEnabled: true,
  eyeSaccadeSpeed: 0.7,
  eyeSmoothPursuit: false,
  eyeBlinkRate: 17, // Average blinks per minute
  eyePriority: 20, // Higher than prosodic/lipsync
  eyeIntensity: 1.0, // Full intensity by default

  // Head settings
  headTrackingEnabled: true,
  headFollowEyes: true,
  headFollowDelay: 200,
  headSpeed: 0.4,
  headPriority: 15, // Slightly lower than eyes
  headIntensity: 0.5, // Half intensity by default

  // Webcam tracking
  webcamTrackingEnabled: false,
  webcamLookAtUser: false,
  webcamActivationInterval: 7000, // 7 seconds
  animationManager: undefined,

  // Coordination
  mouthSyncEnabled: true,
  lookAtSpeaker: false,

  // Idle behavior
  idleVariation: true,
  idleVariationInterval: 2000,
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
