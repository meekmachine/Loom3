/**
 * React Hooks for RxJS Animation Stream
 *
 * These hooks replace `useSelector` from `@xstate/react` with RxJS-based
 * subscriptions that only update when meaningful events occur.
 *
 * Benefits:
 * - No tick-based updates
 * - Throttled time updates to prevent UI jitter
 * - Per-snippet subscriptions for granular control
 * - `distinctUntilChanged` prevents redundant re-renders
 */

import { useState, useEffect, useRef } from 'react';
import { filter } from 'rxjs/operators';
import {
  animationEventEmitter,
  snippetState$,
  snippetTime$,
  snippetList$,
  globalPlaybackState$,
} from '../latticework/animation/animationService';
import type {
  AnimationEvent,
  SnippetUIState,
  AnimationStateSnapshot,
} from '../latticework/animation/animationEvents';

// ============ Hook: Full animation state ============

/**
 * Subscribe to the full animation state snapshot.
 * Use for components that need the complete snippet list.
 *
 * Replaces: useSelector(anim?.actor, state => state?.context?.animations)
 */
export function useAnimationState(): AnimationStateSnapshot {
  const [state, setState] = useState<AnimationStateSnapshot>(() =>
    animationEventEmitter.getCurrentState()
  );

  useEffect(() => {
    const sub = animationEventEmitter.state.subscribe(setState);
    return () => sub.unsubscribe();
  }, []);

  return state;
}

// ============ Hook: Snippet list only ============

/**
 * Subscribe to snippet list changes only (add/remove).
 * More efficient than full state when only list structure matters.
 *
 * Returns array of snippet names.
 */
export function useSnippetList(): string[] {
  const [names, setNames] = useState<string[]>(() =>
    animationEventEmitter.getCurrentState().snippets.map(s => s.name)
  );

  useEffect(() => {
    const sub = snippetList$.subscribe(setNames);
    return () => sub.unsubscribe();
  }, []);

  return names;
}

// ============ Hook: Single snippet state ============

/**
 * Subscribe to a single snippet's UI state.
 * Optimal for SnippetCard components.
 *
 * @param snippetName - Name of the snippet to subscribe to
 * @returns SnippetUIState or null if snippet doesn't exist
 */
export function useSnippetState(snippetName: string): SnippetUIState | null {
  const [state, setState] = useState<SnippetUIState | null>(() => {
    const snapshot = animationEventEmitter.getCurrentState();
    return snapshot.snippets.find(s => s.name === snippetName) ?? null;
  });

  useEffect(() => {
    const sub = snippetState$(snippetName).subscribe(setState);
    return () => sub.unsubscribe();
  }, [snippetName]);

  return state;
}

// ============ Hook: Throttled time updates ============

/**
 * Subscribe to a snippet's currentTime with throttling.
 * Prevents UI jitter during playback by limiting update frequency.
 *
 * @param snippetName - Name of the snippet
 * @param throttleMs - Minimum interval between updates (default: 100ms)
 * @returns Current time in seconds
 */
export function useSnippetTime(snippetName: string, throttleMs = 100): number {
  const [time, setTime] = useState<number>(() => {
    const snapshot = animationEventEmitter.getCurrentState();
    return snapshot.snippets.find(s => s.name === snippetName)?.currentTime ?? 0;
  });

  useEffect(() => {
    const sub = snippetTime$(snippetName, throttleMs).subscribe(setTime);
    return () => sub.unsubscribe();
  }, [snippetName, throttleMs]);

  return time;
}

// ============ Hook: Global playback state ============

/**
 * Subscribe to global playback state changes.
 */
export function useGlobalPlaybackState(): 'playing' | 'paused' | 'stopped' {
  const [state, setState] = useState<'playing' | 'paused' | 'stopped'>(() =>
    animationEventEmitter.getCurrentState().globalState
  );

  useEffect(() => {
    const sub = globalPlaybackState$.subscribe(setState);
    return () => sub.unsubscribe();
  }, []);

  return state;
}

// ============ Hook: Animation events ============

/**
 * Subscribe to specific animation events.
 * Useful for responding to discrete events like loop completion.
 *
 * @param eventTypes - Array of event types to subscribe to
 * @param callback - Callback invoked when matching event occurs
 */
export function useAnimationEvent(
  eventTypes: AnimationEvent['type'][],
  callback: (event: AnimationEvent) => void
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const typesKey = eventTypes.join(',');

  useEffect(() => {
    const sub = animationEventEmitter.events
      .pipe(filter(e => eventTypes.includes(e.type)))
      .subscribe(e => callbackRef.current(e));

    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typesKey]);
}

// ============ Hook: Snippet list with full state ============

/**
 * Subscribe to the full snippet array (with UI state for each).
 * Used by PlaybackControls for the grouped snippet list.
 *
 * More efficient than useAnimationState when you only need snippets.
 */
export function useSnippets(): SnippetUIState[] {
  const [snippets, setSnippets] = useState<SnippetUIState[]>(() =>
    animationEventEmitter.getCurrentState().snippets
  );

  useEffect(() => {
    const sub = animationEventEmitter.state.subscribe(snapshot => {
      setSnippets(snapshot.snippets);
    });

    return () => sub.unsubscribe();
  }, []);

  return snippets;
}
