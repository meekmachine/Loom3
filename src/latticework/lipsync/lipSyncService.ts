/**
 * LipSync Service (Refactored with XState)
 * Provides lip-sync animation for speech synthesis
 * Follows the Animation Agency architecture pattern
 */

import { createActor } from 'xstate';
import { lipSyncMachine } from './lipSyncMachine';
import { LipSyncScheduler } from './lipSyncScheduler';
import type { LipSyncConfig, LipSyncCallbacks, VisemeEvent } from './types';
import { phonemeExtractor } from './PhonemeExtractor';
import { visemeMapper } from './VisemeMapper';

export interface LipSyncServiceAPI {
  startSpeech: () => void;
  processWord: (word: string, wordIndex: number) => void;
  endSpeech: () => void;
  stop: () => void;
  updateConfig: (config: Partial<LipSyncConfig>) => void;
  getState: () => {
    status: 'idle' | 'speaking' | 'ending';
    wordCount: number;
    isSpeaking: boolean;
  };
  dispose: () => void;
}

export interface LipSyncHostCaps {
  scheduleSnippet: (snippet: any) => string | null;
  removeSnippet: (name: string) => void;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<LipSyncConfig> = {
  jawActivation: 1.0,
  lipsyncIntensity: 1.0,
  speechRate: 1.0,
  useEmotionalModulation: false,
  useCoarticulation: true,
  onsetIntensity: 90,
  holdMs: 140,
  engine: 'webSpeech',
};

/**
 * Create a LipSync Service with XState machine and scheduler
 */
export function createLipSyncService(
  config: LipSyncConfig = {},
  callbacks: LipSyncCallbacks = {},
  hostCaps?: LipSyncHostCaps
): LipSyncServiceAPI {
  const fullConfig: Required<LipSyncConfig> = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  // Create XState machine
  const machine = createActor(lipSyncMachine, {
    input: {
      config: {
        jawActivation: fullConfig.jawActivation,
        lipsyncIntensity: fullConfig.lipsyncIntensity,
        speechRate: fullConfig.speechRate,
        useEmotionalModulation: fullConfig.useEmotionalModulation,
        useCoarticulation: fullConfig.useCoarticulation,
      },
    },
  }).start();

  // Host capabilities (animation service integration)
  const host: LipSyncHostCaps = hostCaps ?? {
    scheduleSnippet: (snippet: any) => {
      // Fallback: Try to use global animation service
      if (typeof window !== 'undefined') {
        const anim = (window as any).anim;
        if (anim && typeof anim.schedule === 'function') {
          return anim.schedule(snippet);
        }
      }
      console.warn('[LipSyncService] No animation service available for scheduling');
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
  const scheduler = new LipSyncScheduler(
    machine,
    host,
    {
      jawActivation: fullConfig.jawActivation,
      lipsyncIntensity: fullConfig.lipsyncIntensity,
      speechRate: fullConfig.speechRate,
      useEmotionalModulation: fullConfig.useEmotionalModulation,
      useCoarticulation: fullConfig.useCoarticulation,
    }
  );

  // Subscribe to machine state changes for callbacks
  machine.subscribe((snapshot) => {
    const state = snapshot.value;
    const context = snapshot.context;

    // Handle callbacks based on state transitions
    if (state === 'speaking' && context.isSpeaking) {
      callbacks.onSpeechStart?.();
    }

    if (state === 'idle' && !context.isSpeaking) {
      callbacks.onSpeechEnd?.();
    }
  });

  // Public API
  return {
    /**
     * Start speech - transition to speaking state
     */
    startSpeech(): void {
      machine.send({ type: 'START_SPEECH' });
    },

    /**
     * Process a word - extract visemes and schedule animation
     */
    processWord(word: string, wordIndex: number): void {
      machine.send({ type: 'PROCESS_WORD', word, wordIndex });
      scheduler.processWord(word, wordIndex);
    },

    /**
     * End speech - gracefully return to neutral
     */
    endSpeech(): void {
      machine.send({ type: 'END_SPEECH' });
      scheduler.scheduleNeutralReturn();
    },

    /**
     * Stop immediately (clear all animations)
     */
    stop(): void {
      machine.send({ type: 'STOP_IMMEDIATE' });
      scheduler.dispose();
      callbacks.onSpeechEnd?.();
    },

    /**
     * Update configuration dynamically
     */
    updateConfig(newConfig: Partial<LipSyncConfig>): void {
      Object.assign(fullConfig, newConfig);

      // Update machine context
      machine.send({
        type: 'UPDATE_CONFIG',
        config: {
          jawActivation: fullConfig.jawActivation,
          lipsyncIntensity: fullConfig.lipsyncIntensity,
          speechRate: fullConfig.speechRate,
          useEmotionalModulation: fullConfig.useEmotionalModulation,
          useCoarticulation: fullConfig.useCoarticulation,
        } as Partial<import('./lipSyncScheduler').LipSyncSchedulerConfig>,
      });

      // Update scheduler config
      const schedulerConfig: Partial<import('./lipSyncScheduler').LipSyncSchedulerConfig> = {
        jawActivation: fullConfig.jawActivation,
        lipsyncIntensity: fullConfig.lipsyncIntensity,
        speechRate: fullConfig.speechRate,
        useEmotionalModulation: fullConfig.useEmotionalModulation,
        useCoarticulation: fullConfig.useCoarticulation,
      };
      scheduler.updateConfig(schedulerConfig);
    },

    /**
     * Get current state
     */
    getState(): { status: 'idle' | 'speaking' | 'ending'; wordCount: number; isSpeaking: boolean } {
      const snapshot = machine.getSnapshot();
      const context = snapshot?.context;
      const state = snapshot?.value as string;

      return {
        status: state === 'speaking'
          ? 'speaking'
          : state === 'ending'
          ? 'ending'
          : 'idle',
        wordCount: context?.wordCount ?? 0,
        isSpeaking: context?.isSpeaking ?? false,
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
export class LipSyncService {
  private api: LipSyncServiceAPI;

  constructor(config: LipSyncConfig = {}, callbacks: LipSyncCallbacks = {}) {
    this.api = createLipSyncService(config, callbacks);
  }

  /**
   * Start speech
   */
  public startSpeech(): void {
    this.api.startSpeech();
  }

  /**
   * Process word with viseme animation
   */
  public processWord(word: string, wordIndex: number): void {
    this.api.processWord(word, wordIndex);
  }

  /**
   * End speech gracefully
   */
  public endSpeech(): void {
    this.api.endSpeech();
  }

  /**
   * Stop immediately
   */
  public stop(): void {
    this.api.stop();
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<LipSyncConfig>): void {
    this.api.updateConfig(config);
  }

  /**
   * Get current state
   */
  public getState(): { status: 'idle' | 'speaking' | 'ending'; wordCount: number; isSpeaking: boolean } {
    return this.api.getState();
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    this.api.dispose();
  }

  /**
   * @deprecated Use processWord() instead - this method is for backward compatibility only
   * Extract viseme timeline from text (old API for compatibility)
   */
  public extractVisemeTimeline(text: string): VisemeEvent[] {
    console.warn('[LipSync] extractVisemeTimeline is deprecated. Use processWord() instead.');

    const phonemes = phonemeExtractor.extractPhonemes(text);
    const visemeEvents: VisemeEvent[] = [];
    let offsetMs = 0;

    for (const phoneme of phonemes) {
      const mapping = visemeMapper.getVisemeAndDuration(phoneme);
      const durationMs = mapping.duration;

      visemeEvents.push({
        visemeId: mapping.viseme,
        offsetMs,
        durationMs,
      });

      offsetMs += durationMs;
    }

    return visemeEvents;
  }
}
