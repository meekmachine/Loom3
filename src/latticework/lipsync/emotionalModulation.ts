/**
 * Emotional Modulation for Lip-Sync
 * Adjusts lip-sync intensity, timing, and jaw movement based on emotional state
 * Creates more expressive and emotionally appropriate speech animations
 */

export type EmotionType =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'disgusted'
  | 'fearful'
  | 'contempt';

export interface EmotionModulators {
  intensityScale: number; // Overall lip movement intensity (0.5-2.0)
  jawScale: number; // Jaw opening scale (0.5-2.0)
  durationScale: number; // Phoneme duration scale (0.5-1.5)
  coarticulationAmount: number; // Blending between phonemes (0-1)
  precisionFactor: number; // Articulation precision (0.5-1.5)
  energyLevel: number; // Overall energy/activation (0-1)
}

export interface EmotionalContext {
  primaryEmotion: EmotionType;
  intensity: number; // 0-1, how strongly the emotion is expressed
  arousal: number; // 0-1, emotional activation level
  valence: number; // -1 to 1, negative to positive
}

/**
 * Emotional Modulation Service
 * Provides emotion-aware parameter adjustments for lip-sync
 */
export class EmotionalModulator {
  private currentEmotion: EmotionalContext = {
    primaryEmotion: 'neutral',
    intensity: 0.5,
    arousal: 0.5,
    valence: 0,
  };

  /**
   * Get modulation parameters for current emotional state
   */
  public getModulators(): EmotionModulators {
    return this.calculateModulators(this.currentEmotion);
  }

  /**
   * Update emotional state
   */
  public setEmotion(emotion: EmotionType, intensity: number = 0.7): void {
    const arousal = this.getArousalForEmotion(emotion);
    const valence = this.getValenceForEmotion(emotion);

    this.currentEmotion = {
      primaryEmotion: emotion,
      intensity: Math.max(0, Math.min(1, intensity)),
      arousal,
      valence,
    };
  }

  /**
   * Update emotional context with full parameters
   */
  public setEmotionalContext(context: Partial<EmotionalContext>): void {
    this.currentEmotion = {
      ...this.currentEmotion,
      ...context,
    };
  }

  /**
   * Get current emotional context
   */
  public getEmotionalContext(): EmotionalContext {
    return { ...this.currentEmotion };
  }

  /**
   * Calculate modulation parameters based on emotional state
   */
  private calculateModulators(context: EmotionalContext): EmotionModulators {
    const { primaryEmotion, intensity, arousal, valence } = context;

    // Base modulators (neutral)
    let intensityScale = 1.0;
    let jawScale = 1.0;
    let durationScale = 1.0;
    let coarticulationAmount = 0.15; // Default 15% overlap
    let precisionFactor = 1.0;
    let energyLevel = 0.5;

    // Emotion-specific adjustments
    switch (primaryEmotion) {
      case 'happy':
        intensityScale = 1.2 + intensity * 0.3; // 1.2-1.5 (wider movements)
        jawScale = 1.3 + intensity * 0.4; // 1.3-1.7 (more jaw opening)
        durationScale = 0.9 - intensity * 0.2; // 0.7-0.9 (faster speech)
        coarticulationAmount = 0.2 + intensity * 0.1; // More blending
        precisionFactor = 0.9; // Slightly less precise (relaxed)
        energyLevel = 0.7 + intensity * 0.3; // High energy
        break;

      case 'sad':
        intensityScale = 0.7 - intensity * 0.2; // 0.5-0.7 (smaller movements)
        jawScale = 0.6 - intensity * 0.1; // 0.5-0.6 (less jaw opening)
        durationScale = 1.1 + intensity * 0.4; // 1.1-1.5 (slower speech)
        coarticulationAmount = 0.25 + intensity * 0.15; // More sluggish blending
        precisionFactor = 0.8 - intensity * 0.2; // Less precise (fatigue)
        energyLevel = 0.3 - intensity * 0.2; // Low energy
        break;

      case 'angry':
        intensityScale = 1.4 + intensity * 0.4; // 1.4-1.8 (strong movements)
        jawScale = 1.2 + intensity * 0.5; // 1.2-1.7 (forceful jaw)
        durationScale = 0.8 - intensity * 0.2; // 0.6-0.8 (faster, clipped)
        coarticulationAmount = 0.1; // Sharp, distinct phonemes
        precisionFactor = 1.2 + intensity * 0.3; // Very precise (tension)
        energyLevel = 0.8 + intensity * 0.2; // High energy
        break;

      case 'surprised':
        intensityScale = 1.5 + intensity * 0.5; // 1.5-2.0 (exaggerated)
        jawScale = 1.6 + intensity * 0.4; // 1.6-2.0 (mouth open)
        durationScale = 0.85; // Slightly faster
        coarticulationAmount = 0.08; // Quick, distinct changes
        precisionFactor = 1.1; // Clear articulation
        energyLevel = 0.9; // Very high energy
        break;

      case 'disgusted':
        intensityScale = 0.8 + intensity * 0.2; // 0.8-1.0 (controlled)
        jawScale = 0.7 - intensity * 0.2; // 0.5-0.7 (tight jaw)
        durationScale = 1.0 + intensity * 0.2; // 1.0-1.2 (measured)
        coarticulationAmount = 0.12; // Controlled transitions
        precisionFactor = 1.1 + intensity * 0.2; // Precise (controlled)
        energyLevel = 0.5; // Medium energy
        break;

      case 'fearful':
        intensityScale = 0.9 + intensity * 0.3; // 0.9-1.2 (tense)
        jawScale = 0.8 + intensity * 0.3; // 0.8-1.1 (variable)
        durationScale = 0.9 - intensity * 0.2; // 0.7-0.9 (rushed)
        coarticulationAmount = 0.18 + intensity * 0.12; // Trembling effect
        precisionFactor = 0.85 - intensity * 0.15; // Less precise (tremor)
        energyLevel = 0.7 + intensity * 0.2; // High energy, jittery
        break;

      case 'contempt':
        intensityScale = 0.85; // Subtle
        jawScale = 0.75; // Minimal jaw
        durationScale = 1.1; // Slower, dismissive
        coarticulationAmount = 0.1; // Sharp
        precisionFactor = 1.15; // Controlled, deliberate
        energyLevel = 0.4; // Low energy, dismissive
        break;

      case 'neutral':
      default:
        // Use defaults
        energyLevel = 0.5;
        break;
    }

    // Apply arousal modulation (affects speed and intensity)
    durationScale *= 1.0 + (0.5 - arousal) * 0.3; // High arousal → faster
    intensityScale *= 0.9 + arousal * 0.2; // High arousal → more intense

    // Apply valence modulation (affects jaw and coarticulation)
    if (valence > 0) {
      // Positive valence → more open, fluid
      jawScale *= 1.0 + valence * 0.2;
      coarticulationAmount *= 1.0 + valence * 0.3;
    } else {
      // Negative valence → tighter, more controlled
      jawScale *= 1.0 + valence * 0.15; // valence is negative, reduces jaw
      coarticulationAmount *= 1.0 + valence * 0.2;
    }

    return {
      intensityScale: this.clamp(intensityScale, 0.5, 2.0),
      jawScale: this.clamp(jawScale, 0.5, 2.0),
      durationScale: this.clamp(durationScale, 0.5, 1.5),
      coarticulationAmount: this.clamp(coarticulationAmount, 0, 1),
      precisionFactor: this.clamp(precisionFactor, 0.5, 1.5),
      energyLevel: this.clamp(energyLevel, 0, 1),
    };
  }

  /**
   * Get arousal level for emotion type
   */
  private getArousalForEmotion(emotion: EmotionType): number {
    const arousalMap: Record<EmotionType, number> = {
      neutral: 0.5,
      happy: 0.7,
      sad: 0.3,
      angry: 0.9,
      surprised: 0.95,
      disgusted: 0.6,
      fearful: 0.85,
      contempt: 0.4,
    };
    return arousalMap[emotion] ?? 0.5;
  }

  /**
   * Get valence for emotion type
   */
  private getValenceForEmotion(emotion: EmotionType): number {
    const valenceMap: Record<EmotionType, number> = {
      neutral: 0,
      happy: 0.8,
      sad: -0.7,
      angry: -0.6,
      surprised: 0.2,
      disgusted: -0.8,
      fearful: -0.7,
      contempt: -0.5,
    };
    return valenceMap[emotion] ?? 0;
  }

  /**
   * Apply emotional modulation to viseme intensity
   */
  public modulateIntensity(baseIntensity: number): number {
    const modulators = this.getModulators();
    return this.clamp(baseIntensity * modulators.intensityScale, 0, 100);
  }

  /**
   * Apply emotional modulation to jaw opening
   */
  public modulateJaw(baseJawAmount: number): number {
    const modulators = this.getModulators();
    return this.clamp(baseJawAmount * modulators.jawScale, 0, 100);
  }

  /**
   * Apply emotional modulation to phoneme duration
   */
  public modulateDuration(baseDuration: number): number {
    const modulators = this.getModulators();
    return Math.max(20, baseDuration * modulators.durationScale); // Minimum 20ms
  }

  /**
   * Get coarticulation blend amount
   */
  public getCoarticulationAmount(): number {
    return this.getModulators().coarticulationAmount;
  }

  /**
   * Get articulation precision factor
   */
  public getPrecisionFactor(): number {
    return this.getModulators().precisionFactor;
  }

  /**
   * Get current energy level
   */
  public getEnergyLevel(): number {
    return this.getModulators().energyLevel;
  }

  /**
   * Clamp value to range
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Reset to neutral state
   */
  public reset(): void {
    this.setEmotion('neutral', 0.5);
  }

  /**
   * Blend between two emotions (for transitions)
   */
  public blendEmotions(
    emotion1: EmotionType,
    emotion2: EmotionType,
    blendFactor: number // 0 = emotion1, 1 = emotion2
  ): void {
    const mods1 = this.calculateModulators({
      primaryEmotion: emotion1,
      intensity: 0.7,
      arousal: this.getArousalForEmotion(emotion1),
      valence: this.getValenceForEmotion(emotion1),
    });

    const mods2 = this.calculateModulators({
      primaryEmotion: emotion2,
      intensity: 0.7,
      arousal: this.getArousalForEmotion(emotion2),
      valence: this.getValenceForEmotion(emotion2),
    });

    // Create blended context
    const t = this.clamp(blendFactor, 0, 1);
    const arousal = mods1.energyLevel * (1 - t) + mods2.energyLevel * t;
    const valence = this.getValenceForEmotion(emotion1) * (1 - t) + this.getValenceForEmotion(emotion2) * t;

    this.currentEmotion = {
      primaryEmotion: t < 0.5 ? emotion1 : emotion2,
      intensity: 0.7,
      arousal,
      valence,
    };
  }
}

// Export singleton
export const emotionalModulator = new EmotionalModulator();
