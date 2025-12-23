import { createActor, type Actor } from 'xstate';
import { Subject, BehaviorSubject, Observable } from 'rxjs';
import { filter, map, distinctUntilChanged, throttleTime, shareReplay } from 'rxjs/operators';
import { animationMachine } from './animationMachine';
import type { HostCaps, ScheduleOpts, NormalizedSnippet } from './types';
import { AnimationScheduler as Scheduler } from './animationScheduler';
import type {
  AnimationEvent,
  SnippetUIState,
  AnimationStateSnapshot,
  KeyframeCompletedEvent,
  GlobalPlaybackChangedEvent,
} from './animationEvents';

/**
 * Animation Service
 *
 * This service wraps the XState animation machine and scheduler.
 * It exposes the XState actor directly so React components can use
 * `useSelector` from `@xstate/react` for efficient subscriptions.
 *
 * Usage in React:
 * ```tsx
 * import { useSelector } from '@xstate/react';
 * import { useThreeState } from '../context/threeContext';
 *
 * function MyComponent() {
 *   const { anim } = useThreeState();
 *   const animations = useSelector(anim.actor, state => state.context.animations);
 *   // ...
 * }
 * ```
 */
export function createAnimationService(host: HostCaps) {
  // Create and start the XState actor
  const actor = createActor(animationMachine).start();

  // Create the scheduler that drives playback
  const scheduler = new Scheduler(actor, host);

  // Wire up RxJS event emitter with snippet accessor
  animationEventEmitter.setSnippetAccessor(() => {
    const state = actor.getSnapshot();
    return (state?.context?.animations ?? []) as NormalizedSnippet[];
  });

  let disposed = false;

  const api = {
    // --- XState Actor (for useSelector in React components) ---
    /**
     * The XState actor. Use with `useSelector` from `@xstate/react`:
     *
     * ```tsx
     * const animations = useSelector(anim.actor, state => state.context.animations);
     * const currentAUs = useSelector(anim.actor, state => state.context.currentAUs);
     * ```
     */
    actor: actor as Actor<typeof animationMachine>,

    // --- Core API (delegated to Scheduler) ---
    loadFromJSON(data: any) {
      return scheduler.loadFromJSON(data);
    },

    schedule(data: any, opts?: ScheduleOpts) {
      const name = scheduler.schedule(data, opts);
      if (name) animationEventEmitter.emitSnippetAdded(name);
      return name;
    },

    remove(name: string) {
      scheduler.remove(name);
      animationEventEmitter.emitSnippetRemoved(name);
    },

    play() {
      scheduler.play();
      animationEventEmitter.emitGlobalPlaybackChanged('playing');
    },

    pause() {
      scheduler.pause();
      animationEventEmitter.emitGlobalPlaybackChanged('paused');
    },

    stop() {
      scheduler.stop();
      animationEventEmitter.emitGlobalPlaybackChanged('stopped');
    },

    enable(name: string, on = true) {
      return scheduler.enable(name, on);
    },

    seek(name: string, offsetSec: number) {
      return scheduler.seek(name, offsetSec);
    },

    // --- State access ---
    getState() {
      return actor.getSnapshot();
    },

    getScheduleSnapshot() {
      return scheduler.getScheduleSnapshot();
    },

    getCurrentValue(auId: string): number {
      return scheduler.getCurrentValue(auId);
    },

    get playing() {
      return scheduler.isPlaying();
    },

    isPlaying() {
      return scheduler.isPlaying();
    },

    // --- LocalStorage loading ---
    loadFromLocal(key: string, cat = 'default', prio = 0) {
      const str = localStorage.getItem(key);
      if (!str) return null;
      try {
        const obj = JSON.parse(str);
        if (!obj.name) {
          const parts = key.split('/');
          obj.name = parts[parts.length - 1];
        }
        return api.schedule(obj, { priority: prio });
      } catch (e) {
        console.error('[animationService] bad JSON from localStorage', e);
        return null;
      }
    },

    // --- Per-snippet controls ---
    setSnippetPlaybackRate(name: string, rate: number) {
      const sn = getSnippet(name);
      if (!sn) return;

      const newRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
      const oldRate = sn.snippetPlaybackRate ?? 1;

      if (Math.abs(newRate - oldRate) > 0.001) {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const currentLocal = ((now - (sn.startWallTime || now)) / 1000) * oldRate;
        sn.startWallTime = now - (currentLocal / newRate) * 1000;
      }
      sn.snippetPlaybackRate = newRate;
      animationEventEmitter.emitParamsChanged(name, { playbackRate: newRate });
    },

    setSnippetIntensityScale(name: string, scale: number) {
      const sn = getSnippet(name);
      if (sn) {
        const newScale = Math.max(0, Number.isFinite(scale) ? scale : 1);
        sn.snippetIntensityScale = newScale;
        animationEventEmitter.emitParamsChanged(name, { intensityScale: newScale });
      }
    },

    setSnippetPriority(name: string, priority: number) {
      const sn = getSnippet(name);
      if (sn) {
        sn.snippetPriority = Number.isFinite(priority) ? priority : 0;
      }
    },

    setSnippetLoop(name: string, loop: boolean) {
      const sn = getSnippet(name);
      if (sn) {
        sn.loop = !!loop;
        animationEventEmitter.emitParamsChanged(name, { loop: !!loop });
      }
    },

    setSnippetPlaying(name: string, playing: boolean) {
      const sn = getSnippet(name);
      if (!sn) return;
      sn.isPlaying = !!playing;

      if (playing) {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const currentLocal = sn.currentTime || 0;
        const rate = sn.snippetPlaybackRate ?? 1;
        sn.startWallTime = now - (currentLocal / rate) * 1000;
        scheduler.resumeSnippet(name);
      } else {
        scheduler.pauseSnippet(name);
      }
      animationEventEmitter.emitPlayStateChanged(name, !!playing);
    },

    setSnippetTime(name: string, tSec: number) {
      const time = Math.max(0, tSec || 0);
      scheduler.seek(name, time);
      animationEventEmitter.emitSnippetSeeked(name, time);
    },

    setSnippetLoopState(name: string, iteration: number, localTime?: number) {
      actor.send({ type: 'SET_LOOP_STATE', name, iteration, localTime });
    },

    // --- Playback runner controls ---
    pauseSnippet(name: string) {
      return scheduler.pauseSnippet(name);
    },

    resumeSnippet(name: string) {
      return scheduler.resumeSnippet(name);
    },

    stopSnippet(name: string) {
      return scheduler.stopSnippet(name);
    },

    // --- Legacy subscription (for backwards compatibility) ---
    onTransition(cb: (snapshot: any) => void) {
      const sub = actor.subscribe((snapshot) => {
        cb(snapshot);
      });
      return () => sub.unsubscribe();
    },

    // --- Lifecycle ---
    dispose() {
      if (disposed) return;
      disposed = true;
      try { scheduler.dispose(); } catch {}
      try { actor.stop(); } catch {}
    },

    // --- Debug ---
    debug() {
      const state = actor.getSnapshot();
      const anims = state?.context?.animations || [];
      console.log('[AnimationService] Debug Info:');
      console.log('  - playing:', api.playing);
      console.log('  - machine state:', state?.value);
      console.log('  - animations loaded:', anims.length);
      anims.forEach((a: any, i: number) => {
        console.log(`    [${i}] ${a.name}: isPlaying=${a.isPlaying}, duration=${a.duration}, curves=${Object.keys(a.curves || {}).length}`);
      });
    }
  } as const;

  // Helper to get snippet from machine context
  function getSnippet(name: string) {
    const list = actor.getSnapshot()?.context?.animations as any[] || [];
    return list.find(s => s?.name === name);
  }

  // Expose on window for debugging
  (window as any).anim = api;

  return api;
}

// Export the type for the animation service
export type AnimationService = ReturnType<typeof createAnimationService>;

// ============================================================================
// RxJS Event Emitter - Singleton for Animation Events
// ============================================================================

/**
 * Converts a NormalizedSnippet to minimal SnippetUIState for React components.
 */
function toUIState(sn: NormalizedSnippet): SnippetUIState {
  return {
    name: sn.name,
    isPlaying: sn.isPlaying,
    loop: sn.loop,
    currentTime: sn.currentTime,
    duration: sn.duration,
    playbackRate: sn.snippetPlaybackRate,
    intensityScale: sn.snippetIntensityScale,
    category: sn.snippetCategory,
  };
}

/**
 * AnimationEventEmitter - Central event stream for animation state changes.
 *
 * Emits discrete events (not continuous tick-based updates) when:
 * - Keyframe transitions complete
 * - Snippet play/pause/stop state changes
 * - Loop iterations complete
 * - Snippets are added/removed
 * - Parameters change (rate, intensity, loop)
 *
 * React components subscribe via custom hooks in useAnimationStream.ts
 */
class AnimationEventEmitter {
  private event$ = new Subject<AnimationEvent>();
  private stateSnapshot$ = new BehaviorSubject<AnimationStateSnapshot>({
    globalState: 'stopped',
    snippets: [],
  });

  private _getSnippets: (() => NormalizedSnippet[]) | null = null;

  /** Observable stream of discrete animation events */
  get events(): Observable<AnimationEvent> {
    return this.event$.asObservable();
  }

  /** Observable stream of animation state snapshots */
  get state(): Observable<AnimationStateSnapshot> {
    return this.stateSnapshot$.asObservable();
  }

  /** Get current state synchronously (for initial hook values) */
  getCurrentState(): AnimationStateSnapshot {
    return this.stateSnapshot$.getValue();
  }

  private now(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  /**
   * Set the function to retrieve snippets from XState actor.
   * Called during service creation.
   */
  setSnippetAccessor(getSnippets: () => NormalizedSnippet[]) {
    this._getSnippets = getSnippets;
    this.updateSnapshot();
  }

  /** Update snapshot from XState actor state */
  updateSnapshot() {
    if (!this._getSnippets) return;
    const snippets = this._getSnippets();
    const current = this.stateSnapshot$.getValue();
    this.stateSnapshot$.next({
      globalState: current.globalState,
      snippets: snippets.map(toUIState),
    });
  }

  /** Update just the currentTime for a snippet (efficient for keyframe updates) */
  private updateSnippetTime(snippetName: string, time: number) {
    const current = this.stateSnapshot$.getValue();
    const snippets = current.snippets.map(s =>
      s.name === snippetName ? { ...s, currentTime: time } : s
    );
    this.stateSnapshot$.next({ ...current, snippets });
  }

  // ============ Event Emitters ============

  emitSnippetAdded(snippetName: string) {
    this.event$.next({
      type: 'SNIPPET_ADDED',
      snippetName,
      timestamp: this.now(),
    });
    this.updateSnapshot();
  }

  emitSnippetRemoved(snippetName: string) {
    this.event$.next({
      type: 'SNIPPET_REMOVED',
      snippetName,
      timestamp: this.now(),
    });
    this.updateSnapshot();
  }

  emitPlayStateChanged(snippetName: string, isPlaying: boolean) {
    this.event$.next({
      type: 'SNIPPET_PLAY_STATE_CHANGED',
      snippetName,
      isPlaying,
      timestamp: this.now(),
    });
    this.updateSnapshot();
  }

  emitSnippetLooped(data: { snippetName: string; iteration: number; localTime: number }) {
    this.event$.next({
      type: 'SNIPPET_LOOPED',
      ...data,
      timestamp: this.now(),
    });
  }

  emitSnippetCompleted(snippetName: string) {
    this.event$.next({
      type: 'SNIPPET_COMPLETED',
      snippetName,
      timestamp: this.now(),
    });
    this.updateSnapshot();
  }

  emitKeyframeCompleted(data: {
    snippetName: string;
    keyframeIndex: number;
    totalKeyframes: number;
    currentTime: number;
    duration: number;
  }) {
    this.event$.next({
      type: 'KEYFRAME_COMPLETED',
      ...data,
      timestamp: this.now(),
    });
    // Update just the time (efficient - no full snapshot rebuild)
    this.updateSnippetTime(data.snippetName, data.currentTime);
  }

  emitGlobalPlaybackChanged(state: 'playing' | 'paused' | 'stopped') {
    this.event$.next({
      type: 'GLOBAL_PLAYBACK_CHANGED',
      state,
      timestamp: this.now(),
    });
    const current = this.stateSnapshot$.getValue();
    this.stateSnapshot$.next({ ...current, globalState: state });
  }

  emitSnippetSeeked(snippetName: string, time: number) {
    this.event$.next({
      type: 'SNIPPET_SEEKED',
      snippetName,
      time,
      timestamp: this.now(),
    });
    this.updateSnippetTime(snippetName, time);
  }

  emitParamsChanged(snippetName: string, params: {
    playbackRate?: number;
    intensityScale?: number;
    loop?: boolean;
  }) {
    this.event$.next({
      type: 'SNIPPET_PARAMS_CHANGED',
      snippetName,
      params,
      timestamp: this.now(),
    });
    this.updateSnapshot();
  }
}

// Singleton instance - shared by scheduler and service
export const animationEventEmitter = new AnimationEventEmitter();

// ============================================================================
// Derived Observables - Factory functions for component subscriptions
// ============================================================================

/**
 * Observable of snippet list changes (add/remove only).
 * More efficient than full state when only list structure matters.
 */
export const snippetList$: Observable<string[]> = animationEventEmitter.events.pipe(
  filter(e => e.type === 'SNIPPET_ADDED' || e.type === 'SNIPPET_REMOVED'),
  map(() => animationEventEmitter.getCurrentState().snippets.map(s => s.name)),
  distinctUntilChanged((a, b) => a.length === b.length && a.every((v, i) => v === b[i])),
  shareReplay(1)
);

/**
 * Factory for per-snippet state observables.
 * Each snippet gets its own filtered stream.
 *
 * @param snippetName - Name of the snippet to subscribe to
 */
export function snippetState$(snippetName: string): Observable<SnippetUIState | null> {
  return animationEventEmitter.state.pipe(
    map(snapshot => snapshot.snippets.find(s => s.name === snippetName) ?? null),
    distinctUntilChanged((a, b) => {
      if (!a || !b) return a === b;
      return (
        a.isPlaying === b.isPlaying &&
        a.loop === b.loop &&
        Math.abs(a.currentTime - b.currentTime) < 0.05 && // Threshold for time updates
        a.playbackRate === b.playbackRate &&
        a.intensityScale === b.intensityScale
      );
    }),
    shareReplay(1)
  );
}

/**
 * Throttled currentTime updates for a specific snippet.
 * Prevents UI jitter by limiting update frequency.
 *
 * @param snippetName - Name of the snippet
 * @param throttleMs - Minimum interval between updates (default: 100ms)
 */
export function snippetTime$(snippetName: string, throttleMs = 100): Observable<number> {
  return animationEventEmitter.events.pipe(
    filter((e): e is KeyframeCompletedEvent =>
      e.type === 'KEYFRAME_COMPLETED' && e.snippetName === snippetName
    ),
    map(e => e.currentTime),
    throttleTime(throttleMs, undefined, { leading: true, trailing: true }),
    distinctUntilChanged((a, b) => Math.abs(a - b) < 0.05),
    shareReplay(1)
  );
}

/**
 * Global playback state observable.
 */
export const globalPlaybackState$: Observable<'playing' | 'paused' | 'stopped'> =
  animationEventEmitter.events.pipe(
    filter((e): e is GlobalPlaybackChangedEvent => e.type === 'GLOBAL_PLAYBACK_CHANGED'),
    map(e => e.state),
    distinctUntilChanged(),
    shareReplay(1)
  );
