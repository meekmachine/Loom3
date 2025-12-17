/**
 * EngineThree - Type definitions for the 3D rendering engine
 *
 * This file contains the interface definitions for the EngineThree class,
 * which handles applying AU values to morph targets and bones.
 *
 * Separated from implementation to prevent circular dependencies with
 * the animation system.
 */

/**
 * Engine - The 3D rendering engine interface (EngineThree)
 *
 * The Animation Agency delegates rendering to the Engine, which handles:
 * - Applying AU values to morph targets and bones
 * - Smooth transitions using requestAnimationFrame
 * - Multi-axis composite motions (e.g., eyes looking up-left)
 * - Mix weight blending between morphs and bones
 *
 * The Animation Agency decides WHAT values to apply and WHEN,
 * while the Engine decides HOW to render them.
 */
export interface Engine {
  /**
   * Apply AU value immediately (no transition)
   * Used for instant updates or when transition timing is handled elsewhere
   */
  applyAU: (id: number | string, value: number) => void;

  /**
   * Apply morph value immediately (no transition)
   * Used for viseme or morph targets
   */
  setMorph: (name: string, value: number) => void;

  /**
   * Set AU value with optional transition
   * Primary method for setting AU values
   *
   * @param id - AU number (e.g., 12 for lip corner puller)
   * @param value - Target value in [0, 1]
   * @param durationMs - Transition duration in milliseconds (default: 120ms)
   */
  setAU?: (id: number | string, value: number, durationMs?: number) => void;

  /**
   * Transition AU value smoothly over duration
   * Uses setAU() each tick - simple but does lookups every frame
   *
   * @param id - AU number (e.g., 12 for lip corner puller)
   * @param value - Target value in [0, 1]
   * @param durationMs - Transition duration in milliseconds (default: 120ms)
   */
  transitionAU?: (id: number | string, value: number, durationMs?: number) => void;

  /**
   * OPTIMIZED: Transition AU value with pre-resolved targets
   * Resolves morph indices and bone references once at creation time,
   * then applies values directly each tick without lookups.
   *
   * Use this for performance-critical transitions (e.g., eye/head tracking)
   *
   * @param id - AU number (e.g., 12 for lip corner puller)
   * @param value - Target value in [0, 1]
   * @param durationMs - Transition duration in milliseconds (default: 200ms)
   */
  transitionAUOptimized?: (id: number | string, value: number, durationMs?: number) => void;

  /**
   * Transition morph value smoothly over duration
   * Used for visemes and custom morph targets
   *
   * @param name - Morph target name (e.g., 'jawOpen', 'aa', 'ee')
   * @param value - Target value in [0, 1]
   * @param durationMs - Transition duration in milliseconds (default: 80ms)
   */
  transitionMorph?: (name: string, value: number, durationMs?: number) => void;

  /**
   * Transition a continuum AU pair (e.g., eyes left/right, head up/down).
   * Takes a single value from -1 to +1 and internally manages both AU values.
   * This ensures smooth interpolation through the full range without separate transitions.
   *
   * @param negAU - AU ID for negative direction (e.g., 61 for eyes left, 31 for head left)
   * @param posAU - AU ID for positive direction (e.g., 62 for eyes right, 32 for head right)
   * @param value - Target value from -1 (full negative) to +1 (full positive)
   * @param durationMs - Transition duration in milliseconds (default: 200ms)
   */
  transitionContinuum?: (negAU: number, posAU: number, value: number, durationMs?: number) => void;

  /**
   * Callback invoked when a non-looping snippet naturally completes
   * NOT called when user manually stops a snippet
   *
   * @param name - Snippet name that completed
   */
  onSnippetEnd?: (name: string) => void;

  /**
   * Pause all transitions (used for debugging/inspection)
   */
  pause?: () => void;

  /**
   * Resume all transitions
   */
  resume?: () => void;

  /**
   * Clear all running transitions
   */
  clearTransitions?: () => void;

  /**
   * Get count of active transitions (for debugging)
   */
  getActiveTransitionCount?: () => number;

  // Composite helper methods for continuum pairs (instant)
  setEyesHorizontal?: (value: number) => void;
  setEyesVertical?: (value: number) => void;
  setHeadHorizontal?: (value: number) => void;
  setHeadVertical?: (value: number) => void;
  setHeadTilt?: (value: number) => void;
  setHeadRoll?: (value: number) => void;
  setJawHorizontal?: (value: number) => void;
  setTongueHorizontal?: (value: number) => void;
  setTongueVertical?: (value: number) => void;

  // Composite transition methods for continuum pairs (animated)
  transitionEyesHorizontal?: (value: number, durationMs?: number) => void;
  transitionEyesVertical?: (value: number, durationMs?: number) => void;
  transitionHeadHorizontal?: (value: number, durationMs?: number) => void;
  transitionHeadVertical?: (value: number, durationMs?: number) => void;
  transitionHeadRoll?: (value: number, durationMs?: number) => void;
  transitionJawHorizontal?: (value: number, durationMs?: number) => void;
  transitionTongueHorizontal?: (value: number, durationMs?: number) => void;
  transitionTongueVertical?: (value: number, durationMs?: number) => void;
}

/**
 * @deprecated Use `Engine` instead
 * Maintained for backwards compatibility only
 */
export type HostCaps = Engine;
