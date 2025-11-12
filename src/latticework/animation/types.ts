// Unified types for the Animation Agency (Machine + Service + Scheduler)

// ---------- Core curve types ----------
export type CurvePoint = { time: number; intensity: number };
export type CurvesMap = Record<string, CurvePoint[]>;

// ---------- Snippet (authoring form) ----------
export type AUKeyframe = { t: number; id: number; v: number };
export type VisemeKeyframe = { t: number; key: string; v: number };

/**
 * Authoring-time snippet: either AU or Viseme keyframes arrays.
 * Duration is calculated programmatically from the keyframes.
 * This is what editors/loaders typically produce/consume.
 */
export type Snippet = {
  name?: string;
  loop?: boolean;

  // Category & blending
  snippetCategory?: 'auSnippet' | 'visemeSnippet' | 'default';
  snippetPriority?: number;        // higher wins ties
  snippetPlaybackRate?: number;    // default 1
  snippetIntensityScale?: number;  // default 1

  // Keyframes (one or both may appear)
  au?: AUKeyframe[];
  viseme?: VisemeKeyframe[];

  // Optional normalized map (some sources already have it)
  curves?: CurvesMap;
};

// A normalized snippet that the machine/scheduler keep in context
export type NormalizedSnippet = {
  name: string;
  curves: CurvesMap;
  isPlaying: boolean;
  loop: boolean;

  snippetPlaybackRate: number;
  snippetIntensityScale: number;
  snippetCategory: 'auSnippet' | 'visemeSnippet' | 'default';
  snippetPriority: number;

  // Playback bookkeeping (UI/engine parity)
  currentTime: number;
  startWallTime: number;
  duration: number;  // Calculated from keyframes (max time across all curves)
  cursor: Record<string, number>;
};

// ---------- Animation machine context ----------
export interface AnimContext {
  animations: NormalizedSnippet[];

  // live blend-shape values for UI & inspection
  currentAUs: Record<string | number, number>;
  currentVisemes: Record<string, number>;

  // scheduler → UI easing markers
  scheduledTransitions?: string[];

  // manual slider overrides
  manualOverrides: Record<string | number, number>;
}

// ---------- Events (Bethos-style parity) ----------
export interface LoadAnimationEvent {
  type: 'LOAD_ANIMATION';
  data?: Partial<NormalizedSnippet> & Partial<Snippet> & {
    curves?: Record<string, Array<
      | { time: number; intensity: number }
      | { t?: number; v?: number; time?: number; intensity?: number }
    >>;
  };
}
export interface RemoveAnimationEvent { type: 'REMOVE_ANIMATION'; name: string; }
export interface PlayAllEvent    { type: 'PLAY_ALL' }
export interface PauseAllEvent   { type: 'PAUSE_ALL' }
export interface StopAllEvent    { type: 'STOP_ALL' }

export interface CurveChangedEvent {
  type: 'CURVE_CHANGED';
  nameOrId: string;              // snippet name or identifier
  auId: string | number;         // curve id
  curve: CurvePoint[];           // replacement curve
}

export interface KeyframeHitEvent {
  type: 'KEYFRAME_HIT';
  data: Array<{
    tAbs: number;
    snippet: NormalizedSnippet;
    curveId: string;
    kfIdx: number;
  }>;
}

export interface UIProgressEvent { type: 'UI_PROGRESS' }

export interface ManualSetEvent {
  type: 'MANUAL_SET';
  id: string | number;
  value: number;
  isViseme?: boolean;
}
export interface ManualClearEvent { type: 'MANUAL_CLEAR'; id: string | number; }

export type AnimEvent =
  | LoadAnimationEvent
  | RemoveAnimationEvent
  | PlayAllEvent
  | PauseAllEvent
  | StopAllEvent
  | CurveChangedEvent
  | KeyframeHitEvent
  | UIProgressEvent
  | ManualSetEvent
  | ManualClearEvent;

// ---------- Engine interface (3D rendering layer) ----------

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
   * Transition AU value smoothly over duration
   * Preferred method - creates smooth interpolation using RAF
   *
   * @param id - AU number (e.g., 12 for lip corner puller)
   * @param value - Target value in [0, 1]
   * @param durationMs - Transition duration in milliseconds (default: 120ms)
   */
  transitionAU?: (id: number | string, value: number, durationMs?: number) => void;

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
   * Callback invoked when a non-looping snippet naturally completes
   * NOT called when user manually stops a snippet
   *
   * @param name - Snippet name that completed
   */
  onSnippetEnd?: (name: string) => void;
}

/**
 * @deprecated Use `Engine` instead
 * Maintained for backwards compatibility only
 */
export type HostCaps = Engine;

// ---------- Scheduler plumbing ----------
export type RuntimeSched = { name: string; startsAt: number; offset: number; enabled: boolean };
export type ScheduleOpts = { startInSec?: number; startAtSec?: number; offsetSec?: number; priority?: number };

// ---------- Narrow utilities ----------
export const isNumericId = (s: string) => /^\d+$/.test(s);
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));