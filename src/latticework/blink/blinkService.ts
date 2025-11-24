/**
 * Blink Service
 * Provides automatic and manual blinking functionality
 * Follows the Animation Agency architecture pattern
 */

import { createActor } from 'xstate';
import { blinkMachine } from './blinkMachine';
import { BlinkScheduler } from './blinkScheduler';
import type { BlinkState, BlinkEvent } from './types';

export interface BlinkServiceAPI {
  enable: () => void;
  disable: () => void;
  triggerBlink: (intensity?: number, duration?: number) => void;
  setFrequency: (frequency: number) => void;
  setDuration: (duration: number) => void;
  setIntensity: (intensity: number) => void;
  setRandomness: (randomness: number) => void;
  setLeftEyeIntensity: (intensity: number | null) => void;
  setRightEyeIntensity: (intensity: number | null) => void;
  reset: () => void;
  getState: () => BlinkState;
  subscribe: (callback: (state: BlinkState) => void) => () => void;
  dispose: () => void;
}

export interface BlinkHostCaps {
  scheduleSnippet: (snippet: any) => string | null;
  removeSnippet: (name: string) => void;
}

/**
 * Create a Blink Service with XState machine and scheduler
 */
export function createBlinkService(
  hostCaps?: BlinkHostCaps
): BlinkServiceAPI {
  // Create XState machine
  const machine = createActor(blinkMachine).start();

  // Host capabilities (animation service integration)
  const host: BlinkHostCaps = hostCaps ?? {
    scheduleSnippet: (snippet: any) => {
      // Fallback: Try to use global animation service
      if (typeof window !== 'undefined') {
        const anim = (window as any).anim;
        if (anim && typeof anim.schedule === 'function') {
          return anim.schedule(snippet);
        }
      }
      console.warn('[BlinkService] No animation service available for scheduling');
      return null;
    },
    removeSnippet: (name: string) => {
      if (typeof window !== 'undefined') {
        const anim = (window as any).anim;
        if (anim && typeof anim.remove === 'function') {
          anim.remove(name);
        }
      }
    },
  };

  // Create scheduler
  const snapshot = machine.getSnapshot();
  const state = snapshot.context.state;

  const scheduler = new BlinkScheduler(
    machine,
    host,
    {
      duration: state.duration,
      intensity: state.intensity,
      leftEyeIntensity: state.leftEyeIntensity,
      rightEyeIntensity: state.rightEyeIntensity,
      randomness: state.randomness,
    }
  );

  // Subscribers for state changes
  const subscribers = new Set<(state: BlinkState) => void>();

  // Subscribe to machine state changes
  machine.subscribe((snapshot) => {
    const newState = snapshot.context.state;

    // Update scheduler config
    scheduler.updateConfig({
      duration: newState.duration,
      intensity: newState.intensity,
      leftEyeIntensity: newState.leftEyeIntensity,
      rightEyeIntensity: newState.rightEyeIntensity,
      randomness: newState.randomness,
    });

    // Update automatic blinking based on enabled state
    if (newState.enabled) {
      scheduler.start(newState.frequency);
    } else {
      scheduler.stop();
    }

    // Notify subscribers
    subscribers.forEach((callback) => callback(newState));
  });

  // Start automatic blinking if enabled by default
  if (state.enabled) {
    scheduler.start(state.frequency);
  }

  // Public API
  return {
    /**
     * Enable automatic blinking
     */
    enable(): void {
      machine.send({ type: 'ENABLE' });
    },

    /**
     * Disable automatic blinking
     */
    disable(): void {
      machine.send({ type: 'DISABLE' });
    },

    /**
     * Trigger a single blink manually
     */
    triggerBlink(intensity?: number, duration?: number): void {
      scheduler.triggerBlink(intensity, duration);
    },

    /**
     * Set blink frequency (blinks per minute)
     */
    setFrequency(frequency: number): void {
      machine.send({ type: 'SET_FREQUENCY', frequency });
    },

    /**
     * Set blink duration (seconds)
     */
    setDuration(duration: number): void {
      machine.send({ type: 'SET_DURATION', duration });
    },

    /**
     * Set blink intensity (0-1)
     */
    setIntensity(intensity: number): void {
      machine.send({ type: 'SET_INTENSITY', intensity });
    },

    /**
     * Set randomness factor (0-1)
     */
    setRandomness(randomness: number): void {
      machine.send({ type: 'SET_RANDOMNESS', randomness });
    },

    /**
     * Set left eye intensity override
     */
    setLeftEyeIntensity(intensity: number | null): void {
      machine.send({ type: 'SET_LEFT_EYE_INTENSITY', intensity });
    },

    /**
     * Set right eye intensity override
     */
    setRightEyeIntensity(intensity: number | null): void {
      machine.send({ type: 'SET_RIGHT_EYE_INTENSITY', intensity });
    },

    /**
     * Reset to default state
     */
    reset(): void {
      machine.send({ type: 'RESET_TO_DEFAULT' });
    },

    /**
     * Get current blink state
     */
    getState(): BlinkState {
      return machine.getSnapshot().context.state;
    },

    /**
     * Subscribe to state changes
     */
    subscribe(callback: (state: BlinkState) => void): () => void {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },

    /**
     * Cleanup and release resources
     */
    dispose(): void {
      scheduler.dispose();
      subscribers.clear();
      try {
        machine.stop();
      } catch {
        // Ignore errors on cleanup
      }
    },
  };
}

// For class-based usage
export class BlinkService {
  private api: BlinkServiceAPI;

  constructor(hostCaps?: BlinkHostCaps) {
    this.api = createBlinkService(hostCaps);
  }

  /**
   * Enable automatic blinking
   */
  public enable(): void {
    this.api.enable();
  }

  /**
   * Disable automatic blinking
   */
  public disable(): void {
    this.api.disable();
  }

  /**
   * Trigger a single blink manually
   */
  public triggerBlink(intensity?: number, duration?: number): void {
    this.api.triggerBlink(intensity, duration);
  }

  /**
   * Set blink frequency (blinks per minute)
   */
  public setFrequency(frequency: number): void {
    this.api.setFrequency(frequency);
  }

  /**
   * Set blink duration (seconds)
   */
  public setDuration(duration: number): void {
    this.api.setDuration(duration);
  }

  /**
   * Set blink intensity (0-1)
   */
  public setIntensity(intensity: number): void {
    this.api.setIntensity(intensity);
  }

  /**
   * Set randomness factor (0-1)
   */
  public setRandomness(randomness: number): void {
    this.api.setRandomness(randomness);
  }

  /**
   * Set left eye intensity override
   */
  public setLeftEyeIntensity(intensity: number | null): void {
    this.api.setLeftEyeIntensity(intensity);
  }

  /**
   * Set right eye intensity override
   */
  public setRightEyeIntensity(intensity: number | null): void {
    this.api.setRightEyeIntensity(intensity);
  }

  /**
   * Reset to default state
   */
  public reset(): void {
    this.api.reset();
  }

  /**
   * Get current blink state
   */
  public getState(): BlinkState {
    return this.api.getState();
  }

  /**
   * Subscribe to state changes
   */
  public subscribe(callback: (state: BlinkState) => void): () => void {
    return this.api.subscribe(callback);
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    this.api.dispose();
  }
}
