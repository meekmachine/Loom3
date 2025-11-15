/**
 * LipSync Scheduler
 * Handles viseme timeline processing, curve building, jaw coordination, and animation scheduling
 * Follows the Animation Agency pattern
 */

import type { LipSyncSnippet } from './lipSyncMachine';
import type { VisemeEvent } from './types';
import { phonemeExtractor } from './PhonemeExtractor';
import { visemeMapper } from './VisemeMapper';
import { getARKitVisemeIndex, getJawAmountForViseme } from './visemeToARKit';
import { emotionalModulator } from './emotionalModulation';
import { coarticulationModel } from './coarticulationModel';

export interface LipSyncHostCaps {
  scheduleSnippet: (snippet: any) => string | null;
  removeSnippet: (name: string) => void;
}

export interface LipSyncSchedulerConfig {
  jawActivation: number;
  lipsyncIntensity: number;
  speechRate: number;
  useEmotionalModulation: boolean;
  useCoarticulation: boolean;
}

export class LipSyncScheduler {
  private machine: any;
  private host: LipSyncHostCaps;
  private config: LipSyncSchedulerConfig;

  constructor(
    machine: any,
    host: LipSyncHostCaps,
    config: LipSyncSchedulerConfig
  ) {
    this.machine = machine;
    this.host = host;
    this.config = config;
  }

  /**
   * Process a word and schedule its animation
   */
  public processWord(word: string, wordIndex: number): void {
    // Extract viseme timeline
    const visemeTimeline = this.extractVisemeTimeline(word);

    // Build animation curves with jaw coordination
    const curves = this.buildCurves(visemeTimeline);

    // Calculate max time
    const maxTime = this.calculateMaxTime(visemeTimeline);

    // Create snippet
    const snippetName = `lipsync_${word.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
    const snippet = {
      name: snippetName,
      curves,
      maxTime,
      loop: false,
      snippetCategory: 'combined', // Combined visemes + AU (jaw)
      snippetPriority: 50, // High priority (overrides emotions)
      snippetPlaybackRate: this.config.speechRate,
      snippetIntensityScale: 1.0,
    };

    // Schedule to animation service
    const scheduledName = this.host.scheduleSnippet(snippet);

    if (scheduledName) {
      // Notify machine
      this.machine.send({
        type: 'SNIPPET_SCHEDULED',
        snippetName,
        scheduledName,
      });

      // Auto-remove after completion
      setTimeout(() => {
        this.host.removeSnippet(scheduledName);
        this.machine.send({
          type: 'SNIPPET_COMPLETED',
          snippetName,
        });
      }, maxTime * 1000 + 100); // Add 100ms buffer
    }
  }

  /**
   * Extract viseme timeline from word
   */
  private extractVisemeTimeline(word: string): VisemeEvent[] {
    const phonemes = phonemeExtractor.extractPhonemes(word);
    const visemeEvents: VisemeEvent[] = [];
    let offsetMs = 0;

    for (const phoneme of phonemes) {
      const mapping = visemeMapper.getVisemeAndDuration(phoneme);
      let durationMs = mapping.duration;

      // Apply emotional modulation if enabled
      if (this.config.useEmotionalModulation) {
        durationMs = emotionalModulator.modulateDuration(durationMs);
      }

      // Adjust for speech rate
      durationMs = visemeMapper.adjustDuration(durationMs, this.config.speechRate);

      visemeEvents.push({
        visemeId: mapping.viseme,
        offsetMs,
        durationMs,
      });

      offsetMs += durationMs;
    }

    return visemeEvents;
  }

  /**
   * Build animation curves with easing, coarticulation, and jaw coordination
   */
  private buildCurves(
    visemeTimeline: VisemeEvent[]
  ): Record<string, Array<{ time: number; intensity: number }>> {
    const combinedCurves: Record<string, Array<{ time: number; intensity: number }>> = {};

    // Apply coarticulation if enabled
    if (this.config.useCoarticulation && visemeTimeline.length > 1) {
      const coarticulatedCurves = coarticulationModel.applyCoarticulation(
        visemeTimeline,
        this.config.lipsyncIntensity * 90
      );

      // Convert viseme IDs to ARKit indices and add to combined curves
      Object.entries(coarticulatedCurves).forEach(([visemeId, keyframes]) => {
        const arkitIndex = getARKitVisemeIndex(parseInt(visemeId));
        combinedCurves[arkitIndex.toString()] = keyframes;
      });
    } else {
      // Build curves manually without coarticulation
      visemeTimeline.forEach((visemeEvent, idx) => {
        const arkitIndex = getARKitVisemeIndex(visemeEvent.visemeId);
        const visemeId = arkitIndex.toString();
        const timeInSec = visemeEvent.offsetMs / 1000;
        const durationInSec = visemeEvent.durationMs / 1000;

        // Natural easing with anticipation
        const anticipation = durationInSec * 0.1;
        const attack = durationInSec * 0.25;
        const sustain = durationInSec * 0.45;

        // Initialize curve array
        if (!combinedCurves[visemeId]) {
          combinedCurves[visemeId] = [];
        }

        // Check if previous viseme was same
        const lastKeyframe = combinedCurves[visemeId][combinedCurves[visemeId].length - 1];
        const startIntensity =
          lastKeyframe && lastKeyframe.time > timeInSec - 0.02 ? lastKeyframe.intensity : 0;

        // Apply emotional modulation if enabled
        let baseIntensity = 95 * this.config.lipsyncIntensity;
        if (this.config.useEmotionalModulation) {
          baseIntensity = emotionalModulator.modulateIntensity(baseIntensity);
        }

        // Viseme animation with smooth, natural motion
        combinedCurves[visemeId].push(
          { time: timeInSec, intensity: startIntensity },
          { time: timeInSec + anticipation, intensity: 30 * this.config.lipsyncIntensity },
          { time: timeInSec + attack, intensity: baseIntensity },
          { time: timeInSec + sustain, intensity: baseIntensity * 0.95 },
          { time: timeInSec + durationInSec, intensity: 0 }
        );
      });
    }

    // Add jaw coordination (AU 26)
    this.addJawCurves(combinedCurves, visemeTimeline);

    return combinedCurves;
  }

  /**
   * Add jaw (AU 26) curves coordinated with visemes
   */
  private addJawCurves(
    curves: Record<string, Array<{ time: number; intensity: number }>>,
    visemeTimeline: VisemeEvent[]
  ): void {
    const jawCurve: Array<{ time: number; intensity: number }> = [];

    visemeTimeline.forEach((visemeEvent) => {
      const timeInSec = visemeEvent.offsetMs / 1000;
      const durationInSec = visemeEvent.durationMs / 1000;

      // Get jaw amount for this viseme
      let jawAmount = getJawAmountForViseme(visemeEvent.visemeId);

      // Apply emotional modulation if enabled
      if (this.config.useEmotionalModulation) {
        jawAmount = emotionalModulator.modulateJaw(jawAmount * 100) / 100;
      }

      if (jawAmount > 0.05) {
        // Only animate jaw if significant movement
        const jawAnticipation = durationInSec * 0.15;
        const jawAttack = durationInSec * 0.3;
        const jawSustain = durationInSec * 0.4;

        const lastJawKeyframe = jawCurve[jawCurve.length - 1];
        const startJawIntensity =
          lastJawKeyframe && lastJawKeyframe.time > timeInSec - 0.02
            ? lastJawKeyframe.intensity
            : 0;

        const jawIntensity = jawAmount * 100 * this.config.jawActivation;

        jawCurve.push(
          { time: timeInSec, intensity: startJawIntensity },
          { time: timeInSec + jawAnticipation, intensity: jawIntensity * 0.2 },
          { time: timeInSec + jawAttack, intensity: jawIntensity * 0.9 },
          { time: timeInSec + jawSustain, intensity: jawIntensity },
          { time: timeInSec + durationInSec, intensity: 0 }
        );
      }
    });

    if (jawCurve.length > 0) {
      curves['26'] = jawCurve;
    }
  }

  /**
   * Calculate maximum time from viseme timeline
   */
  private calculateMaxTime(visemeTimeline: VisemeEvent[]): number {
    if (visemeTimeline.length === 0) return 0;

    const lastViseme = visemeTimeline[visemeTimeline.length - 1];
    const lastEndTime = (lastViseme.offsetMs + lastViseme.durationMs) / 1000;

    // Add small neutral hold
    return lastEndTime + 0.05;
  }

  /**
   * Schedule neutral return snippet
   */
  public scheduleNeutralReturn(): void {
    const neutralSnippet = {
      name: `neutral_${Date.now()}`,
      curves: this.buildNeutralCurves(),
      maxTime: 0.3,
      loop: false,
      snippetCategory: 'combined',
      snippetPriority: 60,
      snippetPlaybackRate: 1.0,
      snippetIntensityScale: 1.0,
    };

    const scheduledName = this.host.scheduleSnippet(neutralSnippet);

    if (scheduledName) {
      // Auto-remove after completion
      setTimeout(() => {
        this.host.removeSnippet(scheduledName);
      }, 350);
    }
  }

  /**
   * Build neutral curves (all visemes and jaw to 0)
   */
  private buildNeutralCurves(): Record<string, Array<{ time: number; intensity: number }>> {
    const neutralCurves: Record<string, Array<{ time: number; intensity: number }>> = {};

    // Add neutral curves for all 15 ARKit viseme indices (0-14)
    for (let i = 0; i < 15; i++) {
      neutralCurves[i.toString()] = [
        { time: 0.0, intensity: 0 },
        { time: 0.3, intensity: 0 },
      ];
    }

    // Add jaw closure (AU 26)
    neutralCurves['26'] = [
      { time: 0.0, intensity: 0 },
      { time: 0.3, intensity: 0 },
    ];

    return neutralCurves;
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<LipSyncSchedulerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    // Remove any scheduled snippets
    const snapshot = this.machine.getSnapshot();
    const context = snapshot?.context;

    if (context?.snippets) {
      context.snippets.forEach((snippet: any) => {
        if (snippet.scheduledName) {
          this.host.removeSnippet(snippet.scheduledName);
        }
      });
    }
  }
}
