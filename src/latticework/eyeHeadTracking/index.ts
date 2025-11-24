/**
 * Eye and Head Tracking Agency
 * Exports service factory and types for coordinated eye and head movements
 */

export {
  EyeHeadTrackingService,
  createEyeHeadTrackingService,
} from './eyeHeadTrackingService';

export type {
  EyeHeadTrackingConfig,
  EyeHeadTrackingState,
  EyeHeadTrackingCallbacks,
  GazeTarget,
  TrackingChannel,
  AnimationSnippet,
  AnimationCurve,
} from './types';

export {
  DEFAULT_EYE_HEAD_CONFIG,
  DEFAULT_ANIMATION_KEYS,
  EYE_AUS,
  HEAD_AUS,
} from './types';
