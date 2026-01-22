/**
 * Animation Interface
 *
 * Groups AU/morph/viseme methods, transitions, and mixer playback.
 */

import type {
  TransitionHandle,
  AnimationPlayOptions,
  AnimationClipInfo,
  AnimationState,
  AnimationActionHandle,
  ClipOptions,
  ClipHandle,
  CompositeRotation,
  CurvePoint,
} from '../core/types';

/** Loop mode for mixer clips */
export type MixerLoopMode = 'once' | 'repeat' | 'pingpong';

export interface Animation {
  // ============================================================================
  // AU
  // ============================================================================

  /**
   * Set AU value immediately (no transition)
   * @param id - AU number (e.g., 12 for smile) or string ('12L' for left side)
   * @param v - Value 0-1
   * @param balance - Optional L/R balance: -1 = left only, 0 = both, +1 = right only
   */
  setAU(id: number | string, v: number, balance?: number): void;

  /**
   * Transition AU value smoothly over time
   * @param id - AU number or string
   * @param to - Target value 0-1
   * @param durationMs - Transition duration in milliseconds
   * @param balance - Optional L/R balance
   */
  transitionAU(id: number | string, to: number, durationMs?: number, balance?: number): TransitionHandle;

  /**
   * Get current AU value (from cached auValues)
   */
  getAU(id: number): number;

  // ============================================================================
  // CONTINUUM (paired AUs like eyes left/right, head up/down)
  // ============================================================================

  /**
   * Set a continuum AU pair immediately (no animation).
   * @param negAU - AU ID for negative direction (e.g., 61 for eyes left)
   * @param posAU - AU ID for positive direction (e.g., 62 for eyes right)
   * @param continuumValue - Value from -1 (full negative) to +1 (full positive)
   * @param balance - Optional L/R balance for bilateral morphs
   */
  setContinuum(negAU: number, posAU: number, continuumValue: number, balance?: number): void;

  /**
   * Smoothly transition a continuum AU pair (e.g., eyes left/right, head up/down).
   * @param negAU - AU ID for negative direction
   * @param posAU - AU ID for positive direction
   * @param continuumValue - Target value from -1 (full negative) to +1 (full positive)
   * @param durationMs - Transition duration in milliseconds
   * @param balance - Optional L/R balance for bilateral morphs
   */
  transitionContinuum(negAU: number, posAU: number, continuumValue: number, durationMs?: number, balance?: number): TransitionHandle;

  // ============================================================================
  // MORPH
  // ============================================================================

  /**
   * Set morph target value immediately (by key)
   * @param key - Morph target name (morphTargetDictionary key)
   * @param v - Value 0-1
   * @param meshNames - Optional specific meshes to target
   */
  setMorph(key: string, v: number, meshNames?: string[]): void;

  /**
   * Set morph influence value immediately (by index)
   * @param index - Morph target index (morphTargetInfluences slot)
   * @param v - Value 0-1
   * @param meshNames - Optional specific meshes to target
   */
  setMorphInfluence(index: number, v: number, meshNames?: string[]): void;

  /**
   * Transition morph target value smoothly (by key)
   * @param key - Morph target name (morphTargetDictionary key)
   * @param to - Target value 0-1
   * @param durationMs - Transition duration in milliseconds
   * @param meshNames - Optional specific meshes to target
   */
  transitionMorph(key: string, to: number, durationMs?: number, meshNames?: string[]): TransitionHandle;

  /**
   * Transition morph influence value smoothly (by index)
   * @param index - Morph target index (morphTargetInfluences slot)
   * @param to - Target value 0-1
   * @param durationMs - Transition duration in milliseconds
   * @param meshNames - Optional specific meshes to target
   */
  transitionMorphInfluence(index: number, to: number, durationMs?: number, meshNames?: string[]): TransitionHandle;

  // ============================================================================
  // VISEME
  // ============================================================================

  /**
   * Set viseme value immediately (for lip-sync)
   * @param visemeIndex - Viseme index 0-14
   * @param value - Value 0-1
   * @param jawScale - Jaw movement multiplier (default 1.0)
   */
  setViseme(visemeIndex: number, value: number, jawScale?: number): void;

  /**
   * Transition viseme value smoothly
   */
  transitionViseme(visemeIndex: number, to: number, durationMs?: number, jawScale?: number): TransitionHandle;

  // ============================================================================
  // MIX WEIGHT
  // ============================================================================

  /**
   * Set mix weight for an AU (blend between morph and bone contribution)
   */
  setAUMixWeight(id: number, weight: number): void;

  /**
   * Get current mix weight for an AU
   */
  getAUMixWeight(id: number): number;

  /**
   * Check if an AU has bilateral bone bindings (L and R nodes)
   * Used to determine if a balance slider should be shown for bone-only bilateral AUs
   */
  hasLeftRightBones(auId: number): boolean;

  // ============================================================================
  // PLAYBACK
  // ============================================================================

  /**
   * Pause all transitions
   */
  pause(): void;

  /**
   * Resume all transitions
   */
  resume(): void;

  /**
   * Check if engine is paused
   */
  getPaused(): boolean;

  /**
   * Clear all active transitions
   */
  clearTransitions(): void;

  /**
   * Get count of active transitions
   */
  getActiveTransitionCount(): number;

  /**
   * Reset all facial animation to neutral state
   */
  resetToNeutral(): void;

  // ============================================================================
  // BAKED ANIMATION CONTROL (Three.js AnimationMixer)
  // ============================================================================

  /**
   * Load animation clips from a GLTF/GLB file.
   * Call this after onReady() with the animations array from the GLTF loader.
   * @param clips - Array of AnimationClip objects from GLTF loader
   */
  loadAnimationClips(clips: unknown[]): void;

  /**
   * Get list of all loaded animation clips.
   */
  getAnimationClips(): AnimationClipInfo[];

  /**
   * Play a baked animation by name.
   * @param clipName - Name of the animation clip to play
   * @param options - Playback options (speed, intensity, loop, etc.)
   * @returns Handle for controlling the animation, or null if clip not found
   */
  playAnimation(clipName: string, options?: AnimationPlayOptions): AnimationActionHandle | null;

  /**
   * Stop a specific animation by name.
   * @param clipName - Name of the animation to stop
   */
  stopAnimation(clipName: string): void;

  /**
   * Stop all currently playing animations.
   */
  stopAllAnimations(): void;

  /**
   * Pause a specific animation by name.
   * @param clipName - Name of the animation to pause
   */
  pauseAnimation(clipName: string): void;

  /**
   * Resume a paused animation by name.
   * @param clipName - Name of the animation to resume
   */
  resumeAnimation(clipName: string): void;

  /**
   * Pause all currently playing animations.
   */
  pauseAllAnimations(): void;

  /**
   * Resume all paused animations.
   */
  resumeAllAnimations(): void;

  /**
   * Set the playback speed for a specific animation.
   * @param clipName - Name of the animation
   * @param speed - Playback speed multiplier (1.0 = normal, 0.5 = half, 2.0 = double)
   */
  setAnimationSpeed(clipName: string, speed: number): void;

  /**
   * Set the intensity/weight for a specific animation.
   * @param clipName - Name of the animation
   * @param intensity - Weight value from 0 (no effect) to 1 (full effect)
   */
  setAnimationIntensity(clipName: string, intensity: number): void;

  /**
   * Set the global time scale for all animations.
   * @param timeScale - Global time scale multiplier
   */
  setAnimationTimeScale(timeScale: number): void;

  /**
   * Get the current state of a specific animation.
   * @param clipName - Name of the animation
   * @returns Animation state or null if not found/playing
   */
  getAnimationState(clipName: string): AnimationState | null;

  /**
   * Get states of all currently playing animations.
   */
  getPlayingAnimations(): AnimationState[];

  /**
   * Crossfade from current animation(s) to a new animation.
   * @param clipName - Name of the target animation
   * @param duration - Crossfade duration in seconds
   * @param options - Additional playback options for the target animation
   */
  crossfadeTo(clipName: string, duration?: number, options?: AnimationPlayOptions): AnimationActionHandle | null;

  // ============================================================================
  // DYNAMIC CLIP BUILDING (for animation scheduler integration)
  // ============================================================================

  /**
   * Get the composite rotations configuration for the current preset.
   * Used by animation schedulers for coordinated head/eye movements.
   */
  getCompositeRotations(): CompositeRotation[];

  /**
   * Build and play an AnimationClip from curve data.
   * Used by animation schedulers to convert keyframe data to mixer clips.
   * @param clipName - Unique name for the clip
   * @param curves - Map of curve IDs to keyframe arrays
   * @param options - Playback options
   * @returns Handle for controlling the clip, or null if not supported
   */
  buildClip(
    clipName: string,
    curves: Record<string, Array<CurvePoint>>,
    options?: ClipOptions
  ): ClipHandle | null;

  /**
   * Update parameters on an active clip.
   * @param name - Name of the clip to update
   * @param params - Parameters to update
   * @returns true if clip was found and updated
   */
  updateClipParams(
    name: string,
    params: {
      weight?: number;
      rate?: number;
      loop?: boolean;
      loopMode?: MixerLoopMode;
      repeatCount?: number;
      reverse?: boolean;
      actionId?: string;
    }
  ): boolean;

  /**
   * Clean up resources for a snippet/clip.
   * @param name - Name of the snippet to clean up
   */
  cleanupSnippet(name: string): void;

  /**
   * Check if the given curves can be played through buildClip.
   * Returns false if curves contain bone-only AUs that can't be baked.
   */
  supportsClipCurves(
    curves: Record<string, Array<CurvePoint>>
  ): boolean;

  /**
   * Callback when a snippet finishes playback.
   * Used by animation schedulers for sequencing.
   */
  onSnippetEnd?(name: string): void;
}
