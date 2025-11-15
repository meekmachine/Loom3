/**
 * Prosodic Expression Service (Refactored with XState)
 * Manages prosodic gestures during speech (brow raises, head nods)
 * Follows the Animation Agency architecture pattern
 */

import { createActor } from 'xstate';
import { prosodicMachine } from './prosodicMachine';
import { ProsodicScheduler } from './prosodicScheduler';
import type { ProsodicConfig, ProsodicCallbacks, ProsodicState } from './types';
import { DEFAULT_PROSODIC_CONFIG } from './types';

export interface ProsodicServiceAPI {
  startTalking: () => void;
  stopTalking: () => void;
  pulse: (wordIndex: number) => void;
  stop: () => void;
  updateConfig: (config: Partial<ProsodicConfig>) => void;
  getState: () => ProsodicState;
  dispose: () => void;
}

/**
 * Create a Prosodic Expression Service with XState machine and scheduler
 */
export function createProsodicService(
  config: ProsodicConfig = {},
  callbacks: ProsodicCallbacks = {},
  hostCaps?: {
    scheduleSnippet: (snippet: any) => string | null;
    removeSnippet: (name: string) => void;
  }
): ProsodicServiceAPI {
  const fullConfig: Required<ProsodicConfig> = {
    ...DEFAULT_PROSODIC_CONFIG,
    ...config,
  };

  // Create XState machine
  const machine = createActor(prosodicMachine).start();

  // Host capabilities (animation service integration)
  const host = hostCaps ?? {
    scheduleSnippet: (snippet: any) => {
      // Fallback: Try to use global animation service
      if (typeof window !== 'undefined') {
        const anim = (window as any).anim;
        if (anim && typeof anim.schedule === 'function') {
          return anim.schedule(snippet);
        }
      }
      console.warn('[ProsodicService] No animation service available for scheduling');
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
  const scheduler = new ProsodicScheduler(
    machine,
    host,
    fullConfig.fadeSteps,
    fullConfig.fadeStepInterval
  );

  // Load snippets from localStorage
  const loadSnippetFromStorage = (key: string): any | null => {
    if (typeof window === 'undefined' || !window.localStorage) return null;

    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (err) {
      console.warn(`[ProsodicService] Failed to load snippet: ${key}`, err);
    }

    return null;
  };

  // Initialize: Load brow and head snippets
  const browData = loadSnippetFromStorage(fullConfig.browLoopKey);
  const headData = loadSnippetFromStorage(fullConfig.headLoopKey);

  if (browData) {
    machine.send({
      type: 'LOAD_BROW',
      data: { ...browData, priority: fullConfig.browPriority },
    });
  } else {
    console.warn(`[ProsodicService] Brow snippet not found: ${fullConfig.browLoopKey}`);
  }

  if (headData) {
    machine.send({
      type: 'LOAD_HEAD',
      data: { ...headData, priority: fullConfig.headPriority },
    });
  } else {
    console.warn(`[ProsodicService] Head snippet not found: ${fullConfig.headLoopKey}`);
  }

  // Subscribe to machine state changes for callbacks
  machine.subscribe((snapshot) => {
    const state = snapshot.value;
    const context = snapshot.context;

    // Handle callbacks
    if (state === 'speaking') {
      // Check if just transitioned to speaking
      if (context.browSnippet?.isPlaying) {
        callbacks.onBrowStart?.();
      }
      if (context.headSnippet?.isPlaying) {
        callbacks.onHeadStart?.();
      }
    }

    if (state === 'idle') {
      // Check if just transitioned to idle (fade complete)
      if (!context.browSnippet?.isPlaying) {
        callbacks.onBrowStop?.();
      }
      if (!context.headSnippet?.isPlaying) {
        callbacks.onHeadStop?.();
      }
    }
  });

  // Public API
  return {
    /**
     * Start talking - activate brow and head loops
     */
    startTalking(): void {
      machine.send({ type: 'START_SPEAKING' });
      scheduler.start();
    },

    /**
     * Stop talking - gracefully fade out animations
     */
    stopTalking(): void {
      machine.send({ type: 'STOP_SPEAKING' });
      // Scheduler will handle fade-out based on machine state
    },

    /**
     * Trigger a prosodic pulse on word boundary
     */
    pulse(wordIndex: number): void {
      machine.send({ type: 'PULSE', wordIndex });
      scheduler.handlePulse(wordIndex);
      callbacks.onPulse?.('both', wordIndex);
    },

    /**
     * Stop immediately (no fade)
     */
    stop(): void {
      machine.send({ type: 'STOP_IMMEDIATE' });
      scheduler.stop();
      callbacks.onBrowStop?.();
      callbacks.onHeadStop?.();
    },

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<ProsodicConfig>): void {
      Object.assign(fullConfig, newConfig);

      // Update scheduler fade settings if changed
      if (newConfig.fadeSteps !== undefined || newConfig.fadeStepInterval !== undefined) {
        scheduler.setFadeConfig(
          fullConfig.fadeSteps,
          fullConfig.fadeStepInterval
        );
      }

      // Reload snippets if keys changed
      if (newConfig.browLoopKey) {
        const browData = loadSnippetFromStorage(newConfig.browLoopKey);
        if (browData) {
          machine.send({
            type: 'LOAD_BROW',
            data: { ...browData, priority: fullConfig.browPriority },
          });
        }
      }

      if (newConfig.headLoopKey) {
        const headData = loadSnippetFromStorage(newConfig.headLoopKey);
        if (headData) {
          machine.send({
            type: 'LOAD_HEAD',
            data: { ...headData, priority: fullConfig.headPriority },
          });
        }
      }
    },

    /**
     * Get current state
     */
    getState(): ProsodicState {
      const snapshot = machine.getSnapshot();
      const context = snapshot?.context;
      const state = snapshot?.value as string;

      return {
        browStatus: state === 'speaking'
          ? 'active'
          : state === 'fading' && context?.fadeInProgress.brow
          ? 'stopping'
          : 'idle',
        headStatus: state === 'speaking'
          ? 'active'
          : state === 'fading' && context?.fadeInProgress.head
          ? 'stopping'
          : 'idle',
        browIntensity: context?.browSnippet?.intensityScale ?? 0,
        headIntensity: context?.headSnippet?.intensityScale ?? 0,
        isLooping: state === 'speaking',
      };
    },

    /**
     * Cleanup and release resources
     */
    dispose(): void {
      scheduler.dispose();
      try {
        machine.stop();
      } catch {
        // Ignore errors on cleanup
      }
    },
  };
}

// For backward compatibility - export class-based service
export class ProsodicService {
  private api: ProsodicServiceAPI;

  constructor(config: ProsodicConfig = {}, callbacks: ProsodicCallbacks = {}) {
    this.api = createProsodicService(config, callbacks);
  }

  public startTalking(): void {
    this.api.startTalking();
  }

  public stopTalking(): void {
    this.api.stopTalking();
  }

  public pulse(wordIndex: number): void {
    this.api.pulse(wordIndex);
  }

  public stop(): void {
    this.api.stop();
  }

  public updateConfig(config: Partial<ProsodicConfig>): void {
    this.api.updateConfig(config);
  }

  public getState(): ProsodicState {
    return this.api.getState();
  }

  public dispose(): void {
    this.api.dispose();
  }
}
