/**
 * Advanced Coarticulation Model
 * Implements sophisticated phoneme blending with dominance functions
 * Models how adjacent phonemes influence each other in natural speech
 */

import type { VisemeID } from './types';

export interface CoarticulationParams {
  dominanceCurve: 'linear' | 'sigmoid' | 'cosine';
  anticipatoryWindow: number; // ms - how early next phoneme starts influencing
  carryoverWindow: number; // ms - how long previous phoneme continues influencing
  blendStrength: number; // 0-1, overall coarticulation strength
  contextSensitive: boolean; // Adjust based on phoneme types
}

export interface VisemeTransition {
  fromViseme: VisemeID;
  toViseme: VisemeID;
  dominanceFunction: (t: number) => number; // t: 0-1, returns blend factor
  anticipatoryMs: number;
  carryoverMs: number;
}

export interface BlendedViseme {
  visemeId: VisemeID;
  intensity: number; // 0-1
  time: number; // seconds
}

/**
 * Coarticulation Model Class
 * Handles phoneme blending using linguistic coarticulation principles
 */
export class CoarticulationModel {
  private params: CoarticulationParams = {
    dominanceCurve: 'cosine',
    anticipatoryWindow: 25, // 25ms anticipatory (reduced from 40)
    carryoverWindow: 20, // 20ms carryover (reduced from 30)
    blendStrength: 0.4, // Reduced from 0.7 for less overlap
    contextSensitive: true,
  };

  /**
   * Update coarticulation parameters
   */
  public setParams(params: Partial<CoarticulationParams>): void {
    this.params = { ...this.params, ...params };
  }

  /**
   * Get current parameters
   */
  public getParams(): CoarticulationParams {
    return { ...this.params };
  }

  /**
   * Apply coarticulation to a sequence of visemes
   * Returns interpolated keyframes with smooth blending
   */
  public applyCoarticulation(
    visemes: Array<{ visemeId: VisemeID; offsetMs: number; durationMs: number }>,
    baseIntensity: number = 90
  ): Record<VisemeID, Array<{ time: number; intensity: number }>> {
    const curves: Record<VisemeID, Array<{ time: number; intensity: number }>> = {};

    if (visemes.length === 0) return curves;

    // Process each viseme with its neighbors
    visemes.forEach((current, idx) => {
      const previous = idx > 0 ? visemes[idx - 1] : null;
      const next = idx < visemes.length - 1 ? visemes[idx + 1] : null;

      // Calculate transition parameters
      const { anticipatoryMs, carryoverMs } = this.getTransitionParams(
        previous?.visemeId,
        current.visemeId,
        next?.visemeId
      );

      // Generate keyframes for this viseme
      const keyframes = this.generateKeyframes(
        current,
        previous,
        next,
        anticipatoryMs,
        carryoverMs,
        baseIntensity
      );

      // Add keyframes to appropriate curves
      keyframes.forEach(kf => {
        if (!curves[kf.visemeId]) {
          curves[kf.visemeId] = [];
        }
        curves[kf.visemeId].push({ time: kf.time, intensity: kf.intensity });
      });
    });

    // Sort all curves by time and remove duplicates
    Object.keys(curves).forEach(visemeId => {
      curves[visemeId as unknown as VisemeID] = this.sortAndDeduplicate(
        curves[visemeId as unknown as VisemeID]
      );
    });

    return curves;
  }

  /**
   * Get transition parameters based on phoneme context
   */
  private getTransitionParams(
    previousViseme: VisemeID | null | undefined,
    currentViseme: VisemeID,
    nextViseme: VisemeID | null | undefined
  ): { anticipatoryMs: number; carryoverMs: number } {
    if (!this.params.contextSensitive) {
      return {
        anticipatoryMs: this.params.anticipatoryWindow,
        carryoverMs: this.params.carryoverWindow,
      };
    }

    // Context-sensitive adjustments
    let anticipatoryMs = this.params.anticipatoryWindow;
    let carryoverMs = this.params.carryoverWindow;

    // Vowel-to-vowel transitions: more blending
    if (this.isVowel(currentViseme) && nextViseme !== undefined && this.isVowel(nextViseme)) {
      anticipatoryMs *= 1.5;
    }

    // Consonant-to-consonant: sharper transitions
    if (!this.isVowel(currentViseme) && nextViseme !== undefined && !this.isVowel(nextViseme)) {
      anticipatoryMs *= 0.7;
      carryoverMs *= 0.7;
    }

    // Stops (P, B, T, D, K, G): minimal coarticulation
    if (this.isStop(currentViseme)) {
      anticipatoryMs *= 0.5;
      carryoverMs *= 0.5;
    }

    // Nasals (M, N): more carryover
    if (this.isNasal(currentViseme)) {
      carryoverMs *= 1.3;
    }

    // Fricatives (F, V, S, Z, SH): more anticipatory
    if (this.isFricative(currentViseme)) {
      anticipatoryMs *= 1.2;
    }

    return { anticipatoryMs, carryoverMs };
  }

  /**
   * Generate keyframes for a viseme with coarticulation
   */
  private generateKeyframes(
    current: { visemeId: VisemeID; offsetMs: number; durationMs: number },
    previous: { visemeId: VisemeID; offsetMs: number; durationMs: number } | null,
    next: { visemeId: VisemeID; offsetMs: number; durationMs: number } | null,
    anticipatoryMs: number,
    carryoverMs: number,
    baseIntensity: number
  ): BlendedViseme[] {
    const keyframes: BlendedViseme[] = [];
    const startTime = current.offsetMs / 1000;
    const endTime = (current.offsetMs + current.durationMs) / 1000;
    const duration = current.durationMs / 1000;

    // === Current viseme main curve ===
    const attackTime = duration * 0.2; // 20% attack
    const sustainTime = duration * 0.6; // 60% sustain
    const releaseTime = duration * 0.2; // 20% release

    // Onset (with anticipatory coarticulation from previous)
    let onsetIntensity = 0;
    if (previous) {
      // Blend from previous viseme
      const carryoverFactor = this.getDominanceFactor(0, 'carryover');
      onsetIntensity = baseIntensity * carryoverFactor * this.params.blendStrength;
    }

    keyframes.push({
      visemeId: current.visemeId,
      time: startTime,
      intensity: onsetIntensity,
    });

    // Attack peak
    keyframes.push({
      visemeId: current.visemeId,
      time: startTime + attackTime,
      intensity: baseIntensity,
    });

    // Sustain
    keyframes.push({
      visemeId: current.visemeId,
      time: startTime + attackTime + sustainTime,
      intensity: baseIntensity * 0.95, // Slight decay
    });

    // Release (with anticipatory coarticulation to next)
    let releaseIntensity = 0;
    if (next) {
      // Blend toward next viseme
      const anticipatoryFactor = this.getDominanceFactor(1, 'anticipatory');
      releaseIntensity = baseIntensity * anticipatoryFactor * this.params.blendStrength;
    }

    keyframes.push({
      visemeId: current.visemeId,
      time: endTime,
      intensity: releaseIntensity,
    });

    // === Add anticipatory influence on next viseme ===
    if (next && anticipatoryMs > 0) {
      const anticipatoryStart = endTime - anticipatoryMs / 1000;
      if (anticipatoryStart > startTime) {
        // Start of anticipatory influence
        keyframes.push({
          visemeId: next.visemeId,
          time: anticipatoryStart,
          intensity: 0,
        });

        // Peak of anticipatory influence (at boundary)
        const anticipatoryIntensity = baseIntensity * 0.3 * this.params.blendStrength;
        keyframes.push({
          visemeId: next.visemeId,
          time: endTime,
          intensity: anticipatoryIntensity,
        });
      }
    }

    // === Add carryover influence from previous viseme ===
    if (previous && carryoverMs > 0) {
      const carryoverEnd = startTime + carryoverMs / 1000;
      if (carryoverEnd < endTime) {
        const previousEndTime = (previous.offsetMs + previous.durationMs) / 1000;

        // Peak of carryover (at boundary)
        const carryoverIntensity = baseIntensity * 0.25 * this.params.blendStrength;
        keyframes.push({
          visemeId: previous.visemeId,
          time: startTime,
          intensity: carryoverIntensity,
        });

        // Decay of carryover
        keyframes.push({
          visemeId: previous.visemeId,
          time: carryoverEnd,
          intensity: 0,
        });
      }
    }

    return keyframes;
  }

  /**
   * Get dominance factor for blending (0-1)
   * t: normalized time in transition (0-1)
   * direction: 'anticipatory' or 'carryover'
   */
  private getDominanceFactor(t: number, direction: 'anticipatory' | 'carryover'): number {
    // Clamp t to 0-1
    t = Math.max(0, Math.min(1, t));

    // Reverse for carryover (decaying influence)
    if (direction === 'carryover') {
      t = 1 - t;
    }

    switch (this.params.dominanceCurve) {
      case 'linear':
        return t;

      case 'sigmoid':
        // S-curve: slow start, fast middle, slow end
        return 1 / (1 + Math.exp(-10 * (t - 0.5)));

      case 'cosine':
      default:
        // Smooth cosine curve
        return (1 - Math.cos(t * Math.PI)) / 2;
    }
  }

  /**
   * Check if viseme is a vowel (visemes 1-11)
   */
  private isVowel(visemeId: VisemeID): boolean {
    return visemeId >= 1 && visemeId <= 11;
  }

  /**
   * Check if viseme is a stop consonant (P, B, T, D, K, G)
   */
  private isStop(visemeId: VisemeID): boolean {
    return visemeId === 19 || visemeId === 20 || visemeId === 21; // T/D/N, K/G/NG, P/B/M
  }

  /**
   * Check if viseme is a nasal (M, N)
   */
  private isNasal(visemeId: VisemeID): boolean {
    return visemeId === 19 || visemeId === 21; // T/D/N includes N, P/B/M includes M
  }

  /**
   * Check if viseme is a fricative (F, V, S, Z, SH, etc.)
   */
  private isFricative(visemeId: VisemeID): boolean {
    return visemeId === 15 || visemeId === 16 || visemeId === 18; // S/Z, SH/CH/JH, F/V
  }

  /**
   * Sort keyframes by time and remove duplicates
   */
  private sortAndDeduplicate(
    keyframes: Array<{ time: number; intensity: number }>
  ): Array<{ time: number; intensity: number }> {
    // Sort by time
    keyframes.sort((a, b) => a.time - b.time);

    // Remove duplicates (same time), keeping the later one
    const deduped: Array<{ time: number; intensity: number }> = [];
    let lastTime = -1;

    for (let i = keyframes.length - 1; i >= 0; i--) {
      if (keyframes[i].time !== lastTime) {
        deduped.unshift(keyframes[i]);
        lastTime = keyframes[i].time;
      }
    }

    return deduped;
  }

  /**
   * Calculate blending weight between two visemes at a specific time
   * Returns [weight1, weight2] where weight1 + weight2 = 1
   */
  public calculateBlendWeights(
    viseme1: { visemeId: VisemeID; offsetMs: number; durationMs: number },
    viseme2: { visemeId: VisemeID; offsetMs: number; durationMs: number },
    timeMs: number
  ): [number, number] {
    const end1 = viseme1.offsetMs + viseme1.durationMs;
    const start2 = viseme2.offsetMs;

    // No overlap - return full weight to appropriate viseme
    if (timeMs < viseme1.offsetMs) return [0, 0];
    if (timeMs > viseme2.offsetMs + viseme2.durationMs) return [0, 0];
    if (timeMs < start2 && timeMs < end1) return [1, 0];
    if (timeMs > end1) return [0, 1];

    // In overlap region
    const overlapStart = Math.max(viseme1.offsetMs, start2 - this.params.anticipatoryWindow);
    const overlapEnd = Math.min(end1 + this.params.carryoverWindow, start2);

    if (timeMs >= overlapStart && timeMs <= overlapEnd) {
      const t = (timeMs - overlapStart) / (overlapEnd - overlapStart);
      const dominance = this.getDominanceFactor(t, 'anticipatory');
      return [1 - dominance, dominance];
    }

    // Outside overlap
    return timeMs < start2 ? [1, 0] : [0, 1];
  }

  /**
   * Apply simplified coarticulation (for backward compatibility)
   */
  public applySimpleBlend(
    currentIntensity: number,
    nextIntensity: number,
    blendFactor: number = 0.15
  ): number {
    return currentIntensity * (1 - blendFactor) + nextIntensity * blendFactor;
  }
}

// Export singleton
export const coarticulationModel = new CoarticulationModel();
