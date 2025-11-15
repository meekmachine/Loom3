/**
 * Prosodic Expression Scheduler
 * Manages playback, fading, and timing for prosodic gestures
 * Follows the same pattern as AnimationScheduler
 */

import type { ProsodicSnippet } from './prosodicMachine';

export interface ProsodicHostCaps {
  scheduleSnippet: (snippet: any) => string | null;
  removeSnippet: (name: string) => void;
  onSnippetEnd?: (name: string) => void;
}

export class ProsodicScheduler {
  private machine: any;
  private host: ProsodicHostCaps;
  private rafId: number | null = null;
  private playing = false;

  // Fade management
  private fadeTimers = new Map<string, number[]>();
  private fadeSteps = 4;
  private fadeStepInterval = 120; // ms

  // Scheduled snippet names (for cleanup)
  private scheduledNames = {
    brow: null as string | null,
    head: null as string | null,
  };

  constructor(machine: any, host: ProsodicHostCaps, fadeSteps = 4, fadeStepInterval = 120) {
    this.machine = machine;
    this.host = host;
    this.fadeSteps = fadeSteps;
    this.fadeStepInterval = fadeStepInterval;
  }

  /**
   * Start the scheduler (called when speaking starts)
   */
  public start(): void {
    if (this.playing) return;
    this.playing = true;

    // Schedule brow and head snippets
    const snapshot = this.machine.getSnapshot();
    const context = snapshot?.context;

    if (context?.browSnippet && context.browSnippet.isPlaying) {
      this.scheduleSnippet(context.browSnippet);
    }

    if (context?.headSnippet && context.headSnippet.isPlaying) {
      this.scheduleSnippet(context.headSnippet);
    }

    // Start monitoring loop
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(this.tick);
    }
  }

  /**
   * Stop the scheduler (immediate stop)
   */
  public stop(): void {
    this.playing = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    // Remove all scheduled snippets
    if (this.scheduledNames.brow) {
      this.host.removeSnippet(this.scheduledNames.brow);
      this.scheduledNames.brow = null;
    }

    if (this.scheduledNames.head) {
      this.host.removeSnippet(this.scheduledNames.head);
      this.scheduledNames.head = null;
    }

    // Clear all fade timers
    this.clearAllFadeTimers();
  }

  /**
   * Schedule a snippet to the host (animation service)
   */
  private scheduleSnippet(snippet: ProsodicSnippet): void {
    // Convert to animation service format
    const animSnippet = {
      name: snippet.name,
      curves: snippet.curves,
      loop: snippet.loop,
      snippetCategory: 'prosodic',
      snippetPriority: snippet.priority,
      snippetPlaybackRate: snippet.playbackRate,
      snippetIntensityScale: snippet.intensityScale,
    };

    const scheduledName = this.host.scheduleSnippet(animSnippet);

    if (scheduledName) {
      if (snippet.category === 'brow') {
        this.scheduledNames.brow = scheduledName;
      } else if (snippet.category === 'head') {
        this.scheduledNames.head = scheduledName;
      }
    }
  }

  /**
   * Handle pulse event (restart snippet)
   */
  public handlePulse(wordIndex: number): void {
    const snapshot = this.machine.getSnapshot();
    const context = snapshot?.context;

    // Pulse brow on every word
    if (context?.browSnippet && context.browSnippet.isPlaying && this.scheduledNames.brow) {
      // Remove and reschedule to restart
      this.host.removeSnippet(this.scheduledNames.brow);
      this.scheduleSnippet(context.browSnippet);
    }

    // Pulse head every second word
    if (wordIndex % 2 === 1 && context?.headSnippet && context.headSnippet.isPlaying && this.scheduledNames.head) {
      this.host.removeSnippet(this.scheduledNames.head);
      this.scheduleSnippet(context.headSnippet);
    }
  }

  /**
   * Start fade-out sequence
   */
  public startFadeOut(): void {
    const snapshot = this.machine.getSnapshot();
    const context = snapshot?.context;

    if (context?.fadeInProgress.brow && context.browSnippet) {
      this.fadeChannel('brow', context.browSnippet);
    }

    // Delay head fade slightly for natural effect
    setTimeout(() => {
      const snapshot2 = this.machine.getSnapshot();
      const context2 = snapshot2?.context;
      if (context2?.fadeInProgress.head && context2.headSnippet) {
        this.fadeChannel('head', context2.headSnippet);
      }
    }, 100);
  }

  /**
   * Fade a single channel (brow or head)
   */
  private fadeChannel(channel: 'brow' | 'head', snippet: ProsodicSnippet): void {
    const snippetName = this.scheduledNames[channel];
    if (!snippetName) return;

    // Clear existing fade timers for this channel
    this.clearFadeTimers(channel);

    const timers: number[] = [];

    // Create fade steps (gradual intensity reduction)
    for (let i = 0; i < this.fadeSteps; i++) {
      const intensity = 1.0 - (i + 1) / this.fadeSteps;
      const delay = i * this.fadeStepInterval;
      const isLast = i === this.fadeSteps - 1;

      const timer = window.setTimeout(() => {
        // Update intensity via machine event
        if (channel === 'brow') {
          this.machine.send({ type: 'SET_BROW_INTENSITY', intensity });
        } else {
          this.machine.send({ type: 'SET_HEAD_INTENSITY', intensity });
        }

        // Remove snippet and notify machine on last step
        if (isLast) {
          if (snippetName) {
            this.host.removeSnippet(snippetName);
          }

          if (channel === 'brow') {
            this.scheduledNames.brow = null;
            this.machine.send({ type: 'FADE_BROW_COMPLETE' });
          } else {
            this.scheduledNames.head = null;
            this.machine.send({ type: 'FADE_HEAD_COMPLETE' });
          }
        }
      }, delay);

      timers.push(timer);
    }

    this.fadeTimers.set(channel, timers);
  }

  /**
   * Clear fade timers for a specific channel
   */
  private clearFadeTimers(channel: string): void {
    const timers = this.fadeTimers.get(channel);
    if (timers) {
      timers.forEach(timer => clearTimeout(timer));
      this.fadeTimers.delete(channel);
    }
  }

  /**
   * Clear all fade timers
   */
  private clearAllFadeTimers(): void {
    this.fadeTimers.forEach(timers => {
      timers.forEach(timer => clearTimeout(timer));
    });
    this.fadeTimers.clear();
  }

  /**
   * Tick loop (monitors state changes)
   */
  private tick = (): void => {
    if (!this.playing) {
      this.rafId = null;
      return;
    }

    const snapshot = this.machine.getSnapshot();
    const state = snapshot?.value;

    // Check if we need to start fading
    if (state === 'fading') {
      const context = snapshot?.context;
      // Start fade if not already in progress
      if (context?.fadeInProgress.brow || context?.fadeInProgress.head) {
        this.startFadeOut();
      }
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

  /**
   * Update fade configuration
   */
  public setFadeConfig(steps: number, intervalMs: number): void {
    this.fadeSteps = steps;
    this.fadeStepInterval = intervalMs;
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    this.stop();
    this.clearAllFadeTimers();
  }
}
