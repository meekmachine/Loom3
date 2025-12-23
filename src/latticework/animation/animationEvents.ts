/**
 * Animation Event Types for RxJS Observable Streams
 *
 * These events are emitted by the animation system at meaningful moments
 * (keyframe completion, state changes) rather than on every tick.
 */

// ============ Core Event Types ============

interface AnimationEventBase {
  timestamp: number;
}

/** Emitted when a snippet is added to the animation system */
export interface SnippetAddedEvent extends AnimationEventBase {
  type: 'SNIPPET_ADDED';
  snippetName: string;
}

/** Emitted when a snippet is removed from the animation system */
export interface SnippetRemovedEvent extends AnimationEventBase {
  type: 'SNIPPET_REMOVED';
  snippetName: string;
}

/** Emitted when a snippet's playback state changes (play/pause) */
export interface SnippetPlayStateChangedEvent extends AnimationEventBase {
  type: 'SNIPPET_PLAY_STATE_CHANGED';
  snippetName: string;
  isPlaying: boolean;
}

/** Emitted when a snippet completes a loop iteration */
export interface SnippetLoopedEvent extends AnimationEventBase {
  type: 'SNIPPET_LOOPED';
  snippetName: string;
  iteration: number;
  localTime: number;
}

/** Emitted when a non-looping snippet completes playback */
export interface SnippetCompletedEvent extends AnimationEventBase {
  type: 'SNIPPET_COMPLETED';
  snippetName: string;
}

/**
 * Emitted when a keyframe transition completes within a snippet.
 * This is the primary event for UI updates during playback.
 */
export interface KeyframeCompletedEvent extends AnimationEventBase {
  type: 'KEYFRAME_COMPLETED';
  snippetName: string;
  keyframeIndex: number;
  totalKeyframes: number;
  currentTime: number;
  duration: number;
}

/** Emitted when a snippet's parameters change (rate, intensity, loop) */
export interface SnippetParamsChangedEvent extends AnimationEventBase {
  type: 'SNIPPET_PARAMS_CHANGED';
  snippetName: string;
  params: {
    playbackRate?: number;
    intensityScale?: number;
    loop?: boolean;
  };
}

/** Emitted when the global playback state changes (play all / pause all / stop all) */
export interface GlobalPlaybackChangedEvent extends AnimationEventBase {
  type: 'GLOBAL_PLAYBACK_CHANGED';
  state: 'playing' | 'paused' | 'stopped';
}

/** Emitted when a snippet is seeked to a new time position */
export interface SnippetSeekedEvent extends AnimationEventBase {
  type: 'SNIPPET_SEEKED';
  snippetName: string;
  time: number;
}

/** Union type of all animation events */
export type AnimationEvent =
  | SnippetAddedEvent
  | SnippetRemovedEvent
  | SnippetPlayStateChangedEvent
  | SnippetLoopedEvent
  | SnippetCompletedEvent
  | KeyframeCompletedEvent
  | SnippetParamsChangedEvent
  | GlobalPlaybackChangedEvent
  | SnippetSeekedEvent;

// ============ State Snapshot Types ============

/**
 * Minimal snippet state for UI components.
 * Contains only the fields needed for display.
 */
export interface SnippetUIState {
  name: string;
  isPlaying: boolean;
  loop: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  intensityScale: number;
  category: string;
}

/**
 * Full snapshot of animation state.
 * Emitted as initial state and for batch updates.
 */
export interface AnimationStateSnapshot {
  globalState: 'playing' | 'paused' | 'stopped';
  snippets: SnippetUIState[];
}
