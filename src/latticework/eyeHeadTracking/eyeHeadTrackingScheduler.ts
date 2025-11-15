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

  // Scheduled snippet names (for cleanup)
  private scheduledNames = {
    eyeYaw: null as string | null,
    eyePitch: null as string | null,
    headYaw: null as string | null,
    headPitch: null as string | null,
    headRoll: null as string | null,
  };

  constructor(machine: any, host: EyeHeadHostCaps, transitionConfig?: Partial<GazeTransitionConfig>) {
    this.machine = machine;
    this.host = host;
    this.transitionConfig = {
      ...DEFAULT_TRANSITION_CONFIG,
      ...transitionConfig,
    };
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
   * Schedule a smooth gaze transition to a new target
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
    const { x: currentX, y: currentY } = this.currentGaze;

    // Calculate deltas
    const deltaX = targetX - currentX;
    const deltaY = targetY - currentY;

    // Skip if no movement needed (threshold: 0.01 = 1% of range)
    if (Math.abs(deltaX) < 0.01 && Math.abs(deltaY) < 0.01) {
      return;
    }

    // Generate easing curve
    const easing = EASING_FUNCTIONS[this.transitionConfig.easing];
    const steps = Math.max(5, Math.floor(duration / 50)); // At least 5 steps, ~50ms per step

    // Schedule eye movements
    if (eyeEnabled) {
      this.scheduleEyeTransition(currentX, currentY, deltaX, deltaY, duration, steps, easing);
    }

    // Schedule head movements (with optional follow delay)
    if (headEnabled && headFollowEyes) {
      this.scheduleHeadTransition(currentX, currentY, deltaX, deltaY, duration, steps, easing);
    }

    // Update current gaze state
    this.currentGaze = { x: targetX, y: targetY, z: target.z || 0 };
  }

  /**
   * Schedule smooth eye movement curves
   */
  private scheduleEyeTransition(
    startX: number,
    startY: number,
    deltaX: number,
    deltaY: number,
    duration: number,
    steps: number,
    easing: (t: number) => number
  ): void {
    const { eyeIntensity, eyePriority } = this.transitionConfig;

    // Remove previous eye snippets
    if (this.scheduledNames.eyeYaw) {
      this.host.removeSnippet(this.scheduledNames.eyeYaw);
    }
    if (this.scheduledNames.eyePitch) {
      this.host.removeSnippet(this.scheduledNames.eyePitch);
    }

    // Generate yaw curve (horizontal eye movement)
    if (Math.abs(deltaX) > 0.01) {
      const yawCurves = this.generateContinuumCurves(
        'AU_61', // Eye yaw continuum (61=left, 62=right)
        startX * eyeIntensity,
        deltaX * eyeIntensity,
        duration,
        steps,
        easing
      );

      const yawSnippet = {
        name: `eyeHeadTracking/eyeYaw_${Date.now()}`,
        curves: yawCurves,
        loop: false,
        snippetCategory: 'eyeHeadTracking',
        snippetPriority: eyePriority,
        duration,
      };

      this.scheduledNames.eyeYaw = this.host.scheduleSnippet(yawSnippet);
    }

    // Generate pitch curve (vertical eye movement)
    if (Math.abs(deltaY) > 0.01) {
      const pitchCurves = this.generateContinuumCurves(
        'AU_63', // Eye pitch continuum (63=up, 64=down)
        startY * eyeIntensity,
        deltaY * eyeIntensity,
        duration,
        steps,
        easing
      );

      const pitchSnippet = {
        name: `eyeHeadTracking/eyePitch_${Date.now()}`,
        curves: pitchCurves,
        loop: false,
        snippetCategory: 'eyeHeadTracking',
        snippetPriority: eyePriority,
        duration,
      };

      this.scheduledNames.eyePitch = this.host.scheduleSnippet(pitchSnippet);
    }
  }

  /**
   * Schedule smooth head movement curves
   */
  private scheduleHeadTransition(
    startX: number,
    startY: number,
    deltaX: number,
    deltaY: number,
    duration: number,
    steps: number,
    easing: (t: number) => number
  ): void {
    const { headIntensity, headPriority } = this.transitionConfig;

    // Remove previous head snippets
    if (this.scheduledNames.headYaw) {
      this.host.removeSnippet(this.scheduledNames.headYaw);
    }
    if (this.scheduledNames.headPitch) {
      this.host.removeSnippet(this.scheduledNames.headPitch);
    }

    // Generate yaw curve (horizontal head turn)
    if (Math.abs(deltaX) > 0.01) {
      const yawCurves = this.generateContinuumCurves(
        'AU_31', // Head yaw continuum (31=left, 32=right)
        startX * headIntensity,
        deltaX * headIntensity,
        duration,
        steps,
        easing
      );

      const yawSnippet = {
        name: `eyeHeadTracking/headYaw_${Date.now()}`,
        curves: yawCurves,
        loop: false,
        snippetCategory: 'eyeHeadTracking',
        snippetPriority: headPriority,
        duration,
      };

      this.scheduledNames.headYaw = this.host.scheduleSnippet(yawSnippet);
    }

    // Generate pitch curve (vertical head tilt)
    if (Math.abs(deltaY) > 0.01) {
      const pitchCurves = this.generateContinuumCurves(
        'AU_33', // Head pitch continuum (33=up, 54=down)
        startY * headIntensity,
        deltaY * headIntensity,
        duration,
        steps,
        easing
      );

      const pitchSnippet = {
        name: `eyeHeadTracking/headPitch_${Date.now()}`,
        curves: pitchCurves,
        loop: false,
        snippetCategory: 'eyeHeadTracking',
        snippetPriority: headPriority,
        duration,
      };

      this.scheduledNames.headPitch = this.host.scheduleSnippet(pitchSnippet);
    }
  }

  /**
   * Generate smooth animation curves for a continuum AU
   * Continuum AUs use a single value from -1 to +1 (e.g., AU_61 for eye yaw)
   */
  private generateContinuumCurves(
    auKey: string,
    startValue: number,
    delta: number,
    duration: number,
    steps: number,
    easing: (t: number) => number
  ): Record<string, Array<[number, number]>> {
    const curve: Array<[number, number]> = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps; // 0 to 1
      const easedT = easing(t);
      const time = t * duration;
      const value = startValue + (delta * easedT);

      // Clamp to -1...+1 range for continuum AUs
      const clampedValue = Math.max(-1, Math.min(1, value));

      curve.push([time, clampedValue]);
    }

    return { [auKey]: curve };
  }

  /**
   * Stop all scheduled eye/head movements
   */
  public stop(): void {
    // Remove all scheduled snippets
    Object.values(this.scheduledNames).forEach(name => {
      if (name) {
        this.host.removeSnippet(name);
      }
    });

    // Reset scheduled names
    this.scheduledNames = {
      eyeYaw: null,
      eyePitch: null,
      headYaw: null,
      headPitch: null,
      headRoll: null,
    };
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
