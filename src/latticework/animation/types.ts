// Unified types for the Animation Agency (Machine + Service + Scheduler)

import type { Engine, HostCaps } from '../../engine/EngineThree.types';

// Re-export Engine types for convenience
export type { Engine, HostCaps };

// ---------- Core curve types ----------
export type CurvePoint = {
  time: number;
  intensity: number;
  /** When true, the animation agency re-seeds this keyframe with the current AU value each time the snippet (re)starts. */
  inherit?: boolean;
};
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

  /**
   * Blend mode for combining multiple snippets on same AU:
   * - 'replace' (default): Higher priority wins, replaces lower priority values
   * - 'additive': Values are summed together (clamped to [0,1])
   *
   * Example: Head tracking (yaw=0.3) + Prosodic nod (pitch=0.4) with additive mode
   * allows both to contribute simultaneously for natural combined movement.
   */
  snippetBlendMode?: 'replace' | 'additive';

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
  loopIteration: number;
  lastLoopTime: number;

  snippetPlaybackRate: number;
  snippetIntensityScale: number;
  snippetCategory: 'auSnippet' | 'visemeSnippet' | 'default';
  snippetPriority: number;
  snippetBlendMode: 'replace' | 'additive';  // Blend mode for AU combination

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
      | { time: number; intensity: number; inherit?: boolean }
      | { t?: number; v?: number; time?: number; intensity?: number; inherit?: boolean }
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

export interface SnippetLoopEvent {
  type: 'SNIPPET_LOOPED';
  name: string;
  iteration: number;
  localTime: number;
}

export interface SetLoopStateEvent {
  type: 'SET_LOOP_STATE';
  name: string;
  iteration: number;
  localTime?: number;
}

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
  | ManualClearEvent
  | SnippetLoopEvent
  | SetLoopStateEvent;

// ---------- Scheduler plumbing ----------
export type RuntimeSched = { name: string; startsAt: number; offset: number; enabled: boolean };
export type ScheduleOpts = { startInSec?: number; startAtSec?: number; offsetSec?: number; priority?: number };

// ---------- Narrow utilities ----------
export const isNumericId = (s: string) => /^\d+$/.test(s);
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
