/**
 * Eye and Head Tracking Scheduler
 * Manages smooth gaze transitions by scheduling animation curves through the animation service
 * Follows the Society of Mind pattern - schedules instead of direct AU manipulation
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

/**
 * Easing functions for smooth transitions
 */
const EASING_FUNCTIONS = {
  linear: (t: number) => t,
  easeOut: (t: number) => 1 - Math.pow(1 - t, 3), // Cubic ease-out
  easeInOut: (t: number) => t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2,
};

export class EyeHeadTrackingScheduler {
  private machine: any;
  private host: EyeHeadHostCaps;
  private transitionConfig: GazeTransitionConfig;

  // Current gaze state
  private currentGaze: GazeTarget = { x: 0, y: 0, z: 0 };

  // Track scheduled snippet names for removal
  private scheduledNames = {
    eyeYaw: 'eyeHeadTracking/eyeYaw',
    eyePitch: 'eyeHeadTracking/eyePitch',
    headYaw: 'eyeHeadTracking/headYaw',
    headPitch: 'eyeHeadTracking/headPitch',
  };

  constructor(machine: any, host: EyeHeadHostCaps, transitionConfig?: Partial<GazeTransitionConfig>) {
    this.machine = machine;
    this.host = host;
    this.transitionConfig = {
      ...DEFAULT_TRANSITION_CONFIG,
      ...transitionConfig,
    };

    console.log('[Scheduler] ✓ Eye/head tracking scheduler initialized');
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
   * Update gaze target by removing old snippets and scheduling new ones
   * Uses remove/reschedule pattern (like Prosodic agency) to work with animation service's value semantics
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

    // Schedule eye snippets using remove/reschedule pattern
    if (eyeEnabled) {
      // Eye yaw: AU 61 (left) / AU 62 (right)
      // Negative X = look left (AU 61), Positive X = look right (AU 62)
      const eyeYawValue = targetX * eyeIntensity;
      const eyeYawCurves: Record<string, Array<{time: number; intensity: number}>> = {};

      if (eyeYawValue < 0) {
        // Looking left: set AU 61, clear AU 62
        eyeYawCurves['61'] = [{ time: 0, intensity: Math.abs(eyeYawValue) }];
        eyeYawCurves['62'] = [{ time: 0, intensity: 0 }];
      } else {
        // Looking right: clear AU 61, set AU 62
        eyeYawCurves['61'] = [{ time: 0, intensity: 0 }];
        eyeYawCurves['62'] = [{ time: 0, intensity: eyeYawValue }];
      }

      this.host.removeSnippet(this.scheduledNames.eyeYaw);
      this.host.scheduleSnippet({
        name: this.scheduledNames.eyeYaw,
        curves: eyeYawCurves,
        loop: false,
        snippetCategory: 'eyeHeadTracking',
        snippetPriority: eyePriority,
        snippetIntensityScale: 1.0,
      });

      // Eye pitch: AU 64 (down) / AU 63 (up)
      // Negative Y = look down (AU 64), Positive Y = look up (AU 63)
      const eyePitchValue = targetY * eyeIntensity;
      const eyePitchCurves: Record<string, Array<{time: number; intensity: number}>> = {};

      if (eyePitchValue < 0) {
        // Looking down: set AU 64, clear AU 63
        eyePitchCurves['64'] = [{ time: 0, intensity: Math.abs(eyePitchValue) }];
        eyePitchCurves['63'] = [{ time: 0, intensity: 0 }];
      } else {
        // Looking up: clear AU 64, set AU 63
        eyePitchCurves['64'] = [{ time: 0, intensity: 0 }];
        eyePitchCurves['63'] = [{ time: 0, intensity: eyePitchValue }];
      }

      this.host.removeSnippet(this.scheduledNames.eyePitch);
      this.host.scheduleSnippet({
        name: this.scheduledNames.eyePitch,
        curves: eyePitchCurves,
        loop: false,
        snippetCategory: 'eyeHeadTracking',
        snippetPriority: eyePriority,
        snippetIntensityScale: 1.0,
      });

      console.log(`[Scheduler] ✓ Scheduled eye gaze: yaw=${eyeYawValue.toFixed(2)}, pitch=${eyePitchValue.toFixed(2)}`);
    }

    // Schedule head snippets using remove/reschedule pattern
    if (headEnabled && headFollowEyes) {
      // Head yaw: AU 31 (left) / AU 32 (right)
      // Negative X = turn left (AU 31), Positive X = turn right (AU 32)
      const headYawValue = targetX * headIntensity;
      const headYawCurves: Record<string, Array<{time: number; intensity: number}>> = {};

      if (headYawValue < 0) {
        // Turning left: set AU 31, clear AU 32
        headYawCurves['31'] = [{ time: 0, intensity: Math.abs(headYawValue) }];
        headYawCurves['32'] = [{ time: 0, intensity: 0 }];
      } else {
        // Turning right: clear AU 31, set AU 32
        headYawCurves['31'] = [{ time: 0, intensity: 0 }];
        headYawCurves['32'] = [{ time: 0, intensity: headYawValue }];
      }

      this.host.removeSnippet(this.scheduledNames.headYaw);
      this.host.scheduleSnippet({
        name: this.scheduledNames.headYaw,
        curves: headYawCurves,
        loop: false,
        snippetCategory: 'eyeHeadTracking',
        snippetPriority: headPriority,
        snippetIntensityScale: 1.0,
      });

      // Head pitch: AU 54 (down) / AU 33 (up)
      // Negative Y = tilt down (AU 54), Positive Y = tilt up (AU 33)
      const headPitchValue = targetY * headIntensity;
      const headPitchCurves: Record<string, Array<{time: number; intensity: number}>> = {};

      if (headPitchValue < 0) {
        // Tilting down: set AU 54, clear AU 33
        headPitchCurves['54'] = [{ time: 0, intensity: Math.abs(headPitchValue) }];
        headPitchCurves['33'] = [{ time: 0, intensity: 0 }];
      } else {
        // Tilting up: clear AU 54, set AU 33
        headPitchCurves['54'] = [{ time: 0, intensity: 0 }];
        headPitchCurves['33'] = [{ time: 0, intensity: headPitchValue }];
      }

      this.host.removeSnippet(this.scheduledNames.headPitch);
      this.host.scheduleSnippet({
        name: this.scheduledNames.headPitch,
        curves: headPitchCurves,
        loop: false,
        snippetCategory: 'eyeHeadTracking',
        snippetPriority: headPriority,
        snippetIntensityScale: 1.0,
      });

      console.log(`[Scheduler] ✓ Scheduled head gaze: yaw=${headYawValue.toFixed(2)}, pitch=${headPitchValue.toFixed(2)}`);
    }

    // Update current gaze state
    this.currentGaze = { x: targetX, y: targetY, z: target.z || 0 };
  }


  /**
   * Stop and remove all tracking snippets
   */
  public stop(): void {
    // Remove all tracking snippets
    this.host.removeSnippet(this.scheduledNames.eyeYaw);
    this.host.removeSnippet(this.scheduledNames.eyePitch);
    this.host.removeSnippet(this.scheduledNames.headYaw);
    this.host.removeSnippet(this.scheduledNames.headPitch);

    console.log('[Scheduler] Removed all gaze tracking snippets');
  }

  /**
   * Reset gaze to center (neutral position)
   */
  public resetToNeutral(duration: number = 300): void {
    this.scheduleGazeTransition({ x: 0, y: 0, z: 0 }, { duration });
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
