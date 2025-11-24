/**
 * Eye and Head Tracking Scheduler V2
 * Schedules eye/head tracking animations using real ARKit AU IDs
 *
 * Real ARKit AU IDs used (these already handle blend shapes + bones via applyCompositeMotion):
 * - Eyes: AU 61 (yaw), AU 63 (pitch up), AU 64 (pitch down)
 * - Head: AU 31 (yaw left), AU 32 (yaw right), AU 33 (pitch up), AU 54 (pitch down)
 *
 * Strategy: Create directional animation snippets (eyeLookLeft, eyeLookRight, etc.)
 * and schedule them with intensity scaling based on mouse/webcam position.
 */

import type { GazeTarget } from './types';

export interface EyeHeadHostCaps {
  scheduleSnippet: (snippet: any) => string | null;
  removeSnippet: (name: string) => void;
  onSnippetEnd?: (name: string) => void;
}

export interface GazeTransitionConfig {
  duration: number; // ms - how long the transition takes
  easing: 'linear' | 'easeInOut' | 'easeOut';
  eyeIntensity: number; // 0-1 scale factor for eye movement
  headIntensity: number; // 0-1 scale factor for head movement
  eyePriority: number; // Animation priority
  headPriority: number; // Animation priority
}

const DEFAULT_TRANSITION_CONFIG: GazeTransitionConfig = {
  duration: 200, // 200ms for natural eye movement
  easing: 'easeOut',
  eyeIntensity: 1.0,
  headIntensity: 0.5,
  eyePriority: 20,
  headPriority: 15,
};

// Real ARKit AU IDs (these already call applyCompositeMotion internally)
export const EYE_HEAD_AUS = {
  // Eye AUs (handle blend shapes + eye bones)
  EYE_YAW_LEFT: '61',    // Negative yaw
  EYE_YAW_RIGHT: '62',   // Positive yaw
  EYE_PITCH_UP: '63',    // Positive pitch
  EYE_PITCH_DOWN: '64',  // Negative pitch

  // Head AUs (handle blend shapes + head/neck bones)
  HEAD_YAW_LEFT: '31',   // Turn left
  HEAD_YAW_RIGHT: '32',  // Turn right
  HEAD_PITCH_UP: '33',   // Look up
  HEAD_PITCH_DOWN: '54', // Look down
  HEAD_ROLL_LEFT: '55',  // Tilt left
  HEAD_ROLL_RIGHT: '56', // Tilt right
} as const;

export class EyeHeadTrackingScheduler {
  private host: EyeHeadHostCaps;
  private transitionConfig: GazeTransitionConfig;

  // Current gaze state
  private currentGaze: GazeTarget = { x: 0, y: 0, z: 0 };

  // Track current eye/head positions for smooth transitions
  private currentEyeYaw: number = 0;
  private currentEyePitch: number = 0;
  private currentHeadYaw: number = 0;
  private currentHeadPitch: number = 0;

  // Track scheduled snippet names for removal
  private scheduledNames = {
    eyes: 'eyeHeadTracking/eyes',
    head: 'eyeHeadTracking/head',
  };

  constructor(host: EyeHeadHostCaps, transitionConfig?: Partial<GazeTransitionConfig>) {
    this.host = host;
    this.transitionConfig = {
      ...DEFAULT_TRANSITION_CONFIG,
      ...transitionConfig,
    };

    console.log('[Scheduler V2] ✓ Eye/head tracking scheduler initialized with virtual continuum AUs');
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
   * Schedule gaze transition using real AU IDs with smooth curves
   * Creates animations from current position to target position
   */
  public scheduleGazeTransition(
    target: GazeTarget,
    options?: {
      eyeEnabled?: boolean;
      headEnabled?: boolean;
      headFollowEyes?: boolean;
      duration?: number;
    }
  ): void {
    const {
      eyeEnabled = true,
      headEnabled = true,
      headFollowEyes = true,
      duration = this.transitionConfig.duration,
    } = options || {};

    const { x: targetX, y: targetY } = target;
    const { eyeIntensity, headIntensity, eyePriority, headPriority } = this.transitionConfig;

    // Calculate target positions with intensity scaling
    const targetEyeYaw = targetX * eyeIntensity;
    const targetEyePitch = targetY * eyeIntensity;
    const targetHeadYaw = targetX * headIntensity;
    const targetHeadPitch = targetY * headIntensity;

    // Calculate duration based on distance (optional: make speed adaptive)
    const eyeDistance = Math.sqrt(
      Math.pow(targetEyeYaw - this.currentEyeYaw, 2) +
      Math.pow(targetEyePitch - this.currentEyePitch, 2)
    );
    const headDistance = Math.sqrt(
      Math.pow(targetHeadYaw - this.currentHeadYaw, 2) +
      Math.pow(targetHeadPitch - this.currentHeadPitch, 2)
    );

    // Adaptive duration: faster for small movements, slower for large ones
    const adaptiveDuration = duration * Math.min(1.0, Math.max(0.3, eyeDistance / 2));
    const durationSec = adaptiveDuration / 1000;

    // Schedule eye movements using COMBINED snippet with multiple AUs
    if (eyeEnabled) {
      this.host.removeSnippet('eyeHeadTracking/eyes');

      const eyeCurves: Record<string, Array<{time: number; intensity: number}>> = {};

      // Yaw (horizontal): ALWAYS schedule BOTH left AND right AUs
      // This ensures smooth transitions when switching directions (left→right, right→left)
      eyeCurves[EYE_HEAD_AUS.EYE_YAW_LEFT] = [
        { time: 0, intensity: this.currentEyeYaw < 0 ? Math.abs(this.currentEyeYaw) : 0 },
        { time: durationSec, intensity: targetEyeYaw < 0 ? Math.abs(targetEyeYaw) : 0 }
      ];
      eyeCurves[EYE_HEAD_AUS.EYE_YAW_RIGHT] = [
        { time: 0, intensity: this.currentEyeYaw > 0 ? this.currentEyeYaw : 0 },
        { time: durationSec, intensity: targetEyeYaw > 0 ? targetEyeYaw : 0 }
      ];

      // Pitch (vertical): ALWAYS schedule BOTH up AND down AUs
      eyeCurves[EYE_HEAD_AUS.EYE_PITCH_UP] = [
        { time: 0, intensity: this.currentEyePitch > 0 ? this.currentEyePitch : 0 },
        { time: durationSec, intensity: targetEyePitch > 0 ? targetEyePitch : 0 }
      ];
      eyeCurves[EYE_HEAD_AUS.EYE_PITCH_DOWN] = [
        { time: 0, intensity: this.currentEyePitch < 0 ? Math.abs(this.currentEyePitch) : 0 },
        { time: durationSec, intensity: targetEyePitch < 0 ? Math.abs(targetEyePitch) : 0 }
      ];

      // Only schedule if we have curves to apply
      if (Object.keys(eyeCurves).length > 0) {
        this.host.scheduleSnippet({
          name: 'eyeHeadTracking/eyes',
          curves: eyeCurves,
          loop: false,
          snippetCategory: 'eyeHeadTracking',
          snippetPriority: eyePriority,
          snippetIntensityScale: 1.0, // Already scaled in curve values
        });

        console.log(`[Scheduler V2] ✓ Eye gaze: (${this.currentEyeYaw.toFixed(2)}, ${this.currentEyePitch.toFixed(2)}) → (${targetEyeYaw.toFixed(2)}, ${targetEyePitch.toFixed(2)}) over ${adaptiveDuration.toFixed(0)}ms`);
      }

      // Update tracked position
      this.currentEyeYaw = targetEyeYaw;
      this.currentEyePitch = targetEyePitch;
    }

    // Schedule head movements using COMBINED snippet
    if (headEnabled && headFollowEyes) {
      this.host.removeSnippet('eyeHeadTracking/head');

      const headCurves: Record<string, Array<{time: number; intensity: number}>> = {};

      // CRITICAL: Query ACTUAL current values from animation agency
      // This ensures smooth continuity even when prosodic or other agencies have controlled these AUs
      const actualHeadYawLeft = this.host.getCurrentValue?.(EYE_HEAD_AUS.HEAD_YAW_LEFT) ?? 0;
      const actualHeadYawRight = this.host.getCurrentValue?.(EYE_HEAD_AUS.HEAD_YAW_RIGHT) ?? 0;
      const actualHeadPitchUp = this.host.getCurrentValue?.(EYE_HEAD_AUS.HEAD_PITCH_UP) ?? 0;
      const actualHeadPitchDown = this.host.getCurrentValue?.(EYE_HEAD_AUS.HEAD_PITCH_DOWN) ?? 0;

      // Reconstruct continuum values from current directional AUs
      const actualHeadYaw = actualHeadYawRight - actualHeadYawLeft;  // Positive = right, negative = left
      const actualHeadPitch = actualHeadPitchUp - actualHeadPitchDown; // Positive = up, negative = down

      console.log(`[Scheduler V2] Head AU current values: yawL=${actualHeadYawLeft.toFixed(3)}, yawR=${actualHeadYawRight.toFixed(3)}, pitchUp=${actualHeadPitchUp.toFixed(3)}, pitchDown=${actualHeadPitchDown.toFixed(3)} → continuum yaw=${actualHeadYaw.toFixed(3)}, pitch=${actualHeadPitch.toFixed(3)}`);

      // Yaw (horizontal): ALWAYS schedule BOTH left AND right AUs
      // Start from ACTUAL current values, not internal tracking
      headCurves[EYE_HEAD_AUS.HEAD_YAW_LEFT] = [
        { time: 0, intensity: actualHeadYawLeft },  // ✅ Start from actual current value
        { time: durationSec, intensity: targetHeadYaw < 0 ? Math.abs(targetHeadYaw) : 0 }
      ];
      headCurves[EYE_HEAD_AUS.HEAD_YAW_RIGHT] = [
        { time: 0, intensity: actualHeadYawRight }, // ✅ Start from actual current value
        { time: durationSec, intensity: targetHeadYaw > 0 ? targetHeadYaw : 0 }
      ];

      // Pitch (vertical): ALWAYS schedule BOTH up AND down AUs
      // Start from ACTUAL current values, not internal tracking
      headCurves[EYE_HEAD_AUS.HEAD_PITCH_UP] = [
        { time: 0, intensity: actualHeadPitchUp },   // ✅ Start from actual current value
        { time: durationSec, intensity: targetHeadPitch > 0 ? targetHeadPitch : 0 }
      ];
      headCurves[EYE_HEAD_AUS.HEAD_PITCH_DOWN] = [
        { time: 0, intensity: actualHeadPitchDown }, // ✅ Start from actual current value
        { time: durationSec, intensity: targetHeadPitch < 0 ? Math.abs(targetHeadPitch) : 0 }
      ];

      // Only schedule if we have curves
      if (Object.keys(headCurves).length > 0) {
        this.host.scheduleSnippet({
          name: 'eyeHeadTracking/head',
          curves: headCurves,
          loop: false,
          snippetCategory: 'eyeHeadTracking',
          snippetPriority: headPriority,
          snippetIntensityScale: 1.0, // Already scaled in curve values
        });

        console.log(`[Scheduler V2] ✓ Head gaze: ACTUAL (${actualHeadYaw.toFixed(2)}, ${actualHeadPitch.toFixed(2)}) → TARGET (${targetHeadYaw.toFixed(2)}, ${targetHeadPitch.toFixed(2)}) over ${adaptiveDuration.toFixed(0)}ms`);
      }

      // Update tracked position
      this.currentHeadYaw = targetHeadYaw;
      this.currentHeadPitch = targetHeadPitch;
    }

    // Update current gaze state
    this.currentGaze = { x: targetX, y: targetY, z: target.z || 0 };
  }

  /**
   * Stop and remove all tracking snippets
   */
  public stop(): void {
    // Remove combined snippets
    this.host.removeSnippet('eyeHeadTracking/eyes');
    this.host.removeSnippet('eyeHeadTracking/head');

    // Reset tracked positions
    this.currentEyeYaw = 0;
    this.currentEyePitch = 0;
    this.currentHeadYaw = 0;
    this.currentHeadPitch = 0;

    console.log('[Scheduler V2] Removed all gaze tracking snippets');
  }

  /**
   * Reset gaze to center (neutral position)
   */
  public resetToNeutral(duration: number = 300): void {
    this.scheduleGazeTransition({ x: 0, y: 0, z: 0 }, { duration });
  }

  /**
   * Set playback speed multiplier (affects duration calculation)
   */
  public setSpeed(speed: number): void {
    this.transitionConfig.duration = 200 / speed; // Base 200ms divided by speed
  }

  /**
   * Pause tracking (stop all snippets without resetting position)
   */
  public pause(): void {
    this.host.removeSnippet('eyeHeadTracking/eyes');
    this.host.removeSnippet('eyeHeadTracking/head');
  }

  /**
   * Resume tracking from current position
   */
  public resume(): void {
    // Just a marker - tracking will resume on next scheduleGazeTransition call
    console.log('[Scheduler V2] Tracking resumed');
  }

  /**
   * Get current gaze position
   */
  public getCurrentGaze(): GazeTarget {
    return { ...this.currentGaze };
  }

  /**
   * Cleanup and release resources
   */
  public dispose(): void {
    this.stop();
  }
}
