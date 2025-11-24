/**
 * Blink Scheduler
 * Handles blink animation timing, curve building, and animation scheduling
 * Follows the Animation Agency pattern
 */

import type { BlinkSnippet } from './types';

export interface BlinkHostCaps {
  scheduleSnippet: (snippet: any) => string | null;
  removeSnippet: (name: string) => void;
}

export interface BlinkSchedulerConfig {
  /** Blink duration in seconds */
  duration: number;

  /** Blink intensity (0-1) */
  intensity: number;

  /** Left eye intensity override (null = use default) */
  leftEyeIntensity: number | null;

  /** Right eye intensity override (null = use default) */
  rightEyeIntensity: number | null;

  /** Randomness factor (0-1) */
  randomness: number;
}

export class BlinkScheduler {
  private machine: any;
  private host: BlinkHostCaps;
  private config: BlinkSchedulerConfig;
  private autoBlinkInterval: ReturnType<typeof setTimeout> | null = null;
  private isSchedulingBlink = false;

  constructor(
    machine: any,
    host: BlinkHostCaps,
    config: BlinkSchedulerConfig
  ) {
    this.machine = machine;
    this.host = host;
    this.config = config;
  }

  /**
   * Start automatic blinking
   */
  public start(frequencyBPM: number): void {
    this.stop();

    if (frequencyBPM <= 0) return;

    // Convert frequency (blinks per minute) to interval (milliseconds)
    const baseInterval = (60 / frequencyBPM) * 1000;

    const scheduleNextBlink = () => {
      // Add randomness to the interval
      const randomFactor = 1 + (Math.random() - 0.5) * this.config.randomness;
      const interval = baseInterval * randomFactor;

      this.autoBlinkInterval = setTimeout(() => {
        this.triggerBlink();
        scheduleNextBlink();
      }, interval);
    };

    scheduleNextBlink();
  }

  /**
   * Stop automatic blinking
   */
  public stop(): void {
    if (this.autoBlinkInterval) {
      clearTimeout(this.autoBlinkInterval);
      this.autoBlinkInterval = null;
    }
  }

  /**
   * Trigger a single blink
   */
  public triggerBlink(overrideIntensity?: number, overrideDuration?: number): void {
    // Prevent multiple blinks from being scheduled simultaneously
    if (this.isSchedulingBlink) return;

    this.isSchedulingBlink = true;

    try {
      const intensity = overrideIntensity ?? this.config.intensity;
      const duration = overrideDuration ?? this.config.duration;

      // Build blink animation curves
      const curves = this.buildBlinkCurves(intensity, duration);

      // Create snippet
      const snippetName = `blink_${Date.now()}`;
      const snippet = {
        name: snippetName,
        curves,
        maxTime: duration,
        loop: false,
        snippetCategory: 'blink',
        snippetPriority: 100, // Very high priority (overrides most other animations)
        snippetPlaybackRate: 1.0,
        snippetIntensityScale: 1.0,
      };

      // Schedule to animation service
      const scheduledName = this.host.scheduleSnippet(snippet);

      if (scheduledName) {
        // Notify machine
        this.machine.send({
          type: 'TRIGGER_BLINK',
        });

        // Auto-remove after completion
        setTimeout(() => {
          this.host.removeSnippet(scheduledName);
        }, duration * 1000 + 50); // Add 50ms buffer
      }
    } finally {
      this.isSchedulingBlink = false;
    }
  }

  /**
   * Build blink animation curves
   * AU 43: Eyes Closed (controls both eyes together)
   *
   * For asymmetric blinks, we'd need separate left/right eye AUs,
   * but AU 43 is the standard for synchronized blinking.
   */
  private buildBlinkCurves(
    intensity: number,
    duration: number
  ): Record<string, Array<{ time: number; intensity: number }>> {
    const curves: Record<string, Array<{ time: number; intensity: number }>> = {};

    // Apply randomness to intensity
    const randomFactor = 1 + (Math.random() - 0.5) * this.config.randomness * 0.3;
    const finalIntensity = Math.min(100, intensity * 100 * randomFactor);

    // Natural blink timing (fast close, slightly slower open)
    const closeTime = duration * 0.35; // 35% of duration to close
    const holdTime = duration * 0.1;   // 10% hold at peak
    const openTime = duration * 0.55;  // 55% to open

    // Build natural blink curve with slight asymmetry for realism
    const curve: Array<{ time: number; intensity: number }> = [
      { time: 0.0, intensity: 0 },
      // Quick close
      { time: closeTime * 0.3, intensity: finalIntensity * 0.4 },
      { time: closeTime, intensity: finalIntensity },
      // Brief hold
      { time: closeTime + holdTime, intensity: finalIntensity * 0.98 },
      // Gradual open with slight slowdown at end
      { time: closeTime + holdTime + openTime * 0.5, intensity: finalIntensity * 0.5 },
      { time: closeTime + holdTime + openTime * 0.85, intensity: finalIntensity * 0.15 },
      { time: duration, intensity: 0 },
    ];

    // AU 43: Eyes Closed (both eyes)
    curves['43'] = curve;

    // Note: If we need asymmetric blinks in the future, we could use:
    // - leftEyeIntensity and rightEyeIntensity overrides
    // - Separate curves for left/right eyes if individual eye AUs exist
    // For now, AU 43 handles synchronized blinking

    return curves;
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<BlinkSchedulerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    this.stop();
  }
}
