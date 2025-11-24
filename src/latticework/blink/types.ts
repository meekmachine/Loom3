/**
 * Blink Agency Types
 *
 * Type definitions for the blink animation system.
 * Part of the latticework agency architecture.
 */

/**
 * Blink state managed by the machine
 */
export interface BlinkState {
  /** Whether blinking is enabled */
  enabled: boolean;

  /** Frequency of blinks per minute (typical: 15-20) */
  frequency: number;

  /** Duration of a single blink in seconds (typical: 0.1-0.3) */
  duration: number;

  /** Intensity of blink (0-1, affects how closed the eyes get) */
  intensity: number;

  /** Randomness factor (0-1, adds natural variation) */
  randomness: number;

  /** Left eye blink intensity override (0-1, null for normal) */
  leftEyeIntensity: number | null;

  /** Right eye blink intensity override (0-1, null for normal) */
  rightEyeIntensity: number | null;
}

/**
 * Default blink state
 */
export const DEFAULT_BLINK_STATE: BlinkState = {
  enabled: false, // Disabled by default
  frequency: 17, // Blinks per minute
  duration: 0.15, // Seconds
  intensity: 1.0,
  randomness: 0.3,
  leftEyeIntensity: null,
  rightEyeIntensity: null,
};

/**
 * Events for the blink machine
 */
export type BlinkEvent =
  | { type: 'ENABLE' }
  | { type: 'DISABLE' }
  | { type: 'SET_FREQUENCY'; frequency: number }
  | { type: 'SET_DURATION'; duration: number }
  | { type: 'SET_INTENSITY'; intensity: number }
  | { type: 'SET_RANDOMNESS'; randomness: number }
  | { type: 'SET_LEFT_EYE_INTENSITY'; intensity: number | null }
  | { type: 'SET_RIGHT_EYE_INTENSITY'; intensity: number | null }
  | { type: 'TRIGGER_BLINK'; intensity?: number; duration?: number }
  | { type: 'RESET_TO_DEFAULT' };

/**
 * Context for the blink machine
 */
export interface BlinkContext {
  state: BlinkState;
  lastBlinkTime: number | null;
  scheduledBlinkCount: number;
}

/**
 * Blink animation snippet data
 */
export interface BlinkSnippet {
  name: string;
  curves: Record<string, Array<{ time: number; intensity: number }>>;
  maxTime: number;
  scheduledName?: string;
}
