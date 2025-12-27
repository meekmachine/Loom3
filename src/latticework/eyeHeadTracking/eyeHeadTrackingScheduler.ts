/**
 * Eye and Head Tracking Scheduler V2
 * Schedules eye/head tracking animations using animation agency
 * Follows the same pattern as BlinkScheduler
 *
 * Uses continuum animation snippets for each axis:
 * - Eyes Yaw (horizontal): AU 61 (left) ↔ AU 62 (right)
 * - Eyes Pitch (vertical): AU 64 (down) ↔ AU 63 (up)
 * - Head Yaw (horizontal): AU 51 (left) ↔ AU 52 (right)
 * - Head Pitch (vertical): AU 54 (down) ↔ AU 53 (up)
 * - Head Roll (tilt): AU 55 (left) ↔ AU 56 (right)
 */

import type { GazeTarget } from './types';

export interface EyeHeadHostCaps {
  scheduleSnippet: (snippet: any) => string | null;
  removeSnippet: (name: string) => void;
  onSnippetEnd?: (name: string) => void;
}

export interface GazeTransitionConfig {
  duration: number; // ms - how long the transition takes
  eyeIntensity: number; // 0-1 scale factor for eye movement
  headIntensity: number; // 0-1 scale factor for head movement
  eyePriority: number; // Animation priority
  headPriority: number; // Animation priority
}

const DEFAULT_TRANSITION_CONFIG: GazeTransitionConfig = {
  duration: 200, // 200ms for natural eye movement
  eyeIntensity: 1.0,
  headIntensity: 0.5,
  eyePriority: 20,
  headPriority: 15,
};

// ARKit AU IDs for eye and head movements
export const EYE_HEAD_AUS = {
  // Eye AUs
  EYE_YAW_LEFT: '61',    // Look left
  EYE_YAW_RIGHT: '62',   // Look right
  EYE_PITCH_UP: '63',    // Look up
  EYE_PITCH_DOWN: '64',  // Look down

  // Head AUs (M51-M56 in FACS notation)
  HEAD_YAW_LEFT: '51',   // Turn left
  HEAD_YAW_RIGHT: '52',  // Turn right
  HEAD_PITCH_UP: '53',   // Look up
  HEAD_PITCH_DOWN: '54', // Look down
  HEAD_ROLL_LEFT: '55',  // Tilt left
  HEAD_ROLL_RIGHT: '56', // Tilt right
} as const;

/**
 * Easing function for smooth, natural transitions
 * Uses ease-in-out cubic for human-like deceleration
 */
function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class EyeHeadTrackingScheduler {
  private host: EyeHeadHostCaps;
  private transitionConfig: GazeTransitionConfig;

  constructor(host: EyeHeadHostCaps, transitionConfig?: Partial<GazeTransitionConfig>) {
    this.host = host;
    this.transitionConfig = {
      ...DEFAULT_TRANSITION_CONFIG,
      ...transitionConfig,
    };

    // Scheduler initialized
  }

  /**
   * Update transition configuration
   */
  public updateConfig(config: Partial<GazeTransitionConfig>): void {
    this.transitionConfig = {
      ...this.transitionConfig,
      ...config,
    };
  }

  /**
   * Schedule gaze transition - continuum-based version
   * Uses separate continuum snippets for each axis (yaw/pitch/roll)
   * This matches how continuum sliders work - one snippet per axis
   */
  public scheduleGazeTransition(
    target: GazeTarget,
    options?: {
      eyeEnabled?: boolean;
      headEnabled?: boolean;
      headFollowEyes?: boolean;
      headRoll?: number; // Optional head tilt/roll (-1 to 1, left to right)
      duration?: number;
      eyeDuration?: number;
      headDuration?: number;
    }
  ): void {
    const {
      eyeEnabled = true,
      headEnabled = true,
      headFollowEyes = true,
      headRoll = 0,
      duration = this.transitionConfig.duration,
      eyeDuration = duration,
      headDuration = duration,
    } = options || {};

    const { x: targetX, y: targetY, z: targetZ = 0 } = target;
    const { eyeIntensity, headIntensity, eyePriority, headPriority } = this.transitionConfig;
    const eyeDurationSec = Math.max(0.001, eyeDuration) / 1000;
    const headDurationSec = Math.max(0.001, headDuration) / 1000;

    // Schedule eye movements using continuum snippets
    if (eyeEnabled) {
      this.scheduleEyeContinuum(targetX, targetY, eyeIntensity, eyeDurationSec, eyePriority);
    }

    // Schedule head movements using continuum snippets (yaw, pitch, and roll)
    if (headEnabled && headFollowEyes) {
      this.scheduleHeadContinuum(targetX, targetY, headRoll, headIntensity, headDurationSec, headPriority);
    }
  }

  /**
   * Schedule eye continuum snippets for yaw and pitch axes
   */
  private scheduleEyeContinuum(
    x: number,
    y: number,
    intensity: number,
    duration: number,
    priority: number
  ): void {
    // Yaw (horizontal): -1 (left/AU 61) to +1 (right/AU 62)
    const yaw = x * intensity * 100; // Convert to 0-100 range
    this.host.removeSnippet('eyeHeadTracking/eyeYaw');

    const yawCurves = this.buildContinuumCurves(
      EYE_HEAD_AUS.EYE_YAW_LEFT,
      EYE_HEAD_AUS.EYE_YAW_RIGHT,
      yaw,
      duration
    );

    this.host.scheduleSnippet({
      name: 'eyeHeadTracking/eyeYaw',
      curves: yawCurves,
      maxTime: duration,
      loop: false,
      snippetCategory: 'eyeHeadTracking',
      snippetPriority: priority,
      snippetPlaybackRate: 1.0,
      snippetIntensityScale: 1.0,
    });

    // Pitch (vertical): -1 (down/AU 64) to +1 (up/AU 63)
    const pitch = y * intensity * 100;
    this.host.removeSnippet('eyeHeadTracking/eyePitch');

    const pitchCurves = this.buildContinuumCurves(
      EYE_HEAD_AUS.EYE_PITCH_DOWN,
      EYE_HEAD_AUS.EYE_PITCH_UP,
      pitch,
      duration
    );

    this.host.scheduleSnippet({
      name: 'eyeHeadTracking/eyePitch',
      curves: pitchCurves,
      maxTime: duration,
      loop: false,
      snippetCategory: 'eyeHeadTracking',
      snippetPriority: priority,
      snippetPlaybackRate: 1.0,
      snippetIntensityScale: 1.0,
    });
  }

  /**
   * Schedule head continuum snippets for yaw, pitch, and roll axes
   */
  private scheduleHeadContinuum(
    x: number,
    y: number,
    roll: number,
    intensity: number,
    duration: number,
    priority: number
  ): void {
    // Yaw (horizontal): -1 (left/AU 31) to +1 (right/AU 32)
    const yaw = x * intensity * 100;
    this.host.removeSnippet('eyeHeadTracking/headYaw');

    const yawCurves = this.buildContinuumCurves(
      EYE_HEAD_AUS.HEAD_YAW_LEFT,
      EYE_HEAD_AUS.HEAD_YAW_RIGHT,
      yaw,
      duration
    );

    this.host.scheduleSnippet({
      name: 'eyeHeadTracking/headYaw',
      curves: yawCurves,
      maxTime: duration,
      loop: false,
      snippetCategory: 'eyeHeadTracking',
      snippetPriority: priority,
      snippetPlaybackRate: 1.0,
      snippetIntensityScale: 1.0,
    });

    // Pitch (vertical): -1 (down/AU 54) to +1 (up/AU 33)
    const pitch = y * intensity * 100;
    this.host.removeSnippet('eyeHeadTracking/headPitch');

    const pitchCurves = this.buildContinuumCurves(
      EYE_HEAD_AUS.HEAD_PITCH_DOWN,
      EYE_HEAD_AUS.HEAD_PITCH_UP,
      pitch,
      duration
    );

    this.host.scheduleSnippet({
      name: 'eyeHeadTracking/headPitch',
      curves: pitchCurves,
      maxTime: duration,
      loop: false,
      snippetCategory: 'eyeHeadTracking',
      snippetPriority: priority,
      snippetPlaybackRate: 1.0,
      snippetIntensityScale: 1.0,
    });

    // Roll (tilt): -1 (left/AU 55) to +1 (right/AU 56)
    const rollValue = roll * intensity * 100;
    this.host.removeSnippet('eyeHeadTracking/headRoll');

    const rollCurves = this.buildContinuumCurves(
      EYE_HEAD_AUS.HEAD_ROLL_LEFT,
      EYE_HEAD_AUS.HEAD_ROLL_RIGHT,
      rollValue,
      duration
    );

    this.host.scheduleSnippet({
      name: 'eyeHeadTracking/headRoll',
      curves: rollCurves,
      maxTime: duration,
      loop: false,
      snippetCategory: 'eyeHeadTracking',
      snippetPriority: priority,
      snippetPlaybackRate: 1.0,
      snippetIntensityScale: 1.0,
    });
  }

  /**
   * Build continuum curves for a bidirectional axis
   * Value: negative values use negativeAU, positive values use positiveAU
   * This matches the continuum slider behavior
   */
  private buildContinuumCurves(
    negativeAU: string,
    positiveAU: string,
    value: number,
    duration: number
  ): Record<string, Array<{ time: number; intensity: number; inherit?: boolean }>> {
    const curves: Record<string, Array<{ time: number; intensity: number; inherit?: boolean }>> = {};
    const inheritStart = () => ({ time: 0, intensity: 0, inherit: true }); // Seed from current AU to avoid snaps

    // ALWAYS schedule BOTH directions for proper transitions
    if (value < 0) {
      // Negative direction (left/down)
      curves[negativeAU] = [
        inheritStart(),
        { time: duration, intensity: Math.abs(value) }
      ];
      curves[positiveAU] = [
        inheritStart(),
        { time: duration, intensity: 0 }
      ];
    } else {
      // Positive direction (right/up)
      curves[negativeAU] = [
        inheritStart(),
        { time: duration, intensity: 0 }
      ];
      curves[positiveAU] = [
        inheritStart(),
        { time: duration, intensity: value }
      ];
    }

    return curves;
  }


  /**
   * Stop and remove all tracking snippets
   */
  public stop(): void {
    // Remove eye tracking snippets
    this.host.removeSnippet('eyeHeadTracking/eyeYaw');
    this.host.removeSnippet('eyeHeadTracking/eyePitch');

    // Remove head tracking snippets
    this.host.removeSnippet('eyeHeadTracking/headYaw');
    this.host.removeSnippet('eyeHeadTracking/headPitch');
    this.host.removeSnippet('eyeHeadTracking/headRoll');

    // Stopped - removed all gaze tracking snippets
  }

  /**
   * Reset gaze to center (neutral position)
   */
  public resetToNeutral(duration: number = 300): void {
    this.scheduleGazeTransition({ x: 0, y: 0, z: 0 }, { duration });
  }

  /**
   * Cleanup and release resources
   */
  public dispose(): void {
    this.stop();
  }
}
