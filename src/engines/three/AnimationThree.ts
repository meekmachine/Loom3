/**
 * AnimationThree - Lerp-based animation system
 *
 * Default implementation of the Animation interface.
 * Uses simple lerp interpolation with easing functions.
 */

import type { TransitionHandle } from '../../core/types';
import type { Animation } from '../../interfaces/Animation';

type Transition = {
  key: string;
  from: number;
  to: number;
  duration: number;      // seconds
  elapsed: number;       // seconds
  apply: (value: number) => void;
  easing: (t: number) => number;
  resolve?: () => void;  // Called when transition completes
  paused: boolean;       // Individual pause state
};

const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

// Smoother cubic easing - better for viseme transitions
const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// Export easing functions for external use
export { easeInOutQuad, easeInOutCubic };

export class AnimationThree implements Animation {
  private transitions = new Map<string, Transition>();

  /**
   * Tick all active transitions by dt seconds.
   * Applies eased interpolation and removes completed transitions.
   * Respects individual transition pause state.
   */
  tick(dtSeconds: number): void {
    if (dtSeconds <= 0) return;

    const completed: string[] = [];

    this.transitions.forEach((t, key) => {
      // Skip paused transitions
      if (t.paused) return;

      t.elapsed += dtSeconds;
      const progress = Math.min(t.elapsed / t.duration, 1.0);
      const easedProgress = t.easing(progress);

      // Interpolate and apply
      const value = t.from + (t.to - t.from) * easedProgress;
      t.apply(value);

      // Check completion
      if (progress >= 1.0) {
        completed.push(key);
        t.resolve?.();
      }
    });

    // Remove completed transitions
    completed.forEach(key => this.transitions.delete(key));
  }

  /**
   * Add or replace a transition for the given key.
   * If a transition with the same key exists, it is cancelled and replaced.
   * @returns TransitionHandle with { promise, pause, resume, cancel }
   */
  addTransition(
    key: string,
    from: number,
    to: number,
    durationMs: number,
    apply: (value: number) => void,
    easing: (t: number) => number = easeInOutQuad
  ): TransitionHandle {
    // Convert to seconds once here - all callers pass milliseconds
    const durationSec = durationMs / 1000;

    // Cancel existing transition for this key
    const existing = this.transitions.get(key);
    if (existing?.resolve) {
      existing.resolve(); // Resolve immediately (cancelled)
    }

    // Instant transition if duration is 0 or values are equal
    if (durationSec <= 0 || Math.abs(to - from) < 1e-6) {
      apply(to);
      return {
        promise: Promise.resolve(),
        pause: () => {},
        resume: () => {},
        cancel: () => {},
      };
    }

    const promise = new Promise<void>((resolve) => {
      const transitionObj: Transition = {
        key,
        from,
        to,
        duration: durationSec,
        elapsed: 0,
        apply,
        easing,
        resolve,
        paused: false,
      };
      this.transitions.set(key, transitionObj);
    });

    return {
      promise,
      pause: () => {
        const t = this.transitions.get(key);
        if (t) t.paused = true;
      },
      resume: () => {
        const t = this.transitions.get(key);
        if (t) t.paused = false;
      },
      cancel: () => {
        const t = this.transitions.get(key);
        if (t) {
          t.resolve?.();
          this.transitions.delete(key);
        }
      },
    };
  }

  /** Clear all running transitions. */
  clearTransitions(): void {
    this.transitions.forEach(t => t.resolve?.());
    this.transitions.clear();
  }

  /** Get count of active transitions. */
  getActiveTransitionCount(): number {
    return this.transitions.size;
  }
}
