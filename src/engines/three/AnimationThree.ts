/**
 * AnimationThree - Lerp-based animation driver
 *
 * Internal driver for time-based interpolation with easing functions.
 */

import {
  AnimationMixer,
  AnimationAction,
  AnimationClip,
  NumberKeyframeTrack,
  QuaternionKeyframeTrack,
  AdditiveAnimationBlendMode,
  LoopRepeat,
  LoopPingPong,
  LoopOnce,
  NormalAnimationBlendMode,
  Quaternion,
  Vector3,
} from 'three';
import type { Mesh, Object3D } from 'three';
import type {
  TransitionHandle,
  AnimationPlayOptions,
  AnimationClipInfo,
  AnimationState,
  AnimationActionHandle,
  CurvesMap,
  ClipOptions,
  ClipEventListener,
  ClipHandle,
  Snippet,
  BoneKey,
  CompositeRotation,
  RotationAxis,
  AnimationSource,
  AnimationBlendMode,
  BakedClipChannel,
  BakedClipChannelInfo,
  AnimationEasing,
} from '../../core/types';
import { getCompositeAxisBinding, getCompositeAxisValue } from '../../core/compositeAxis';
import type { Profile } from '../../mappings/types';
import { getMeshNamesForAUProfile, getMeshNamesForVisemeProfile } from '../../mappings/visemeSystem';
import type { ResolvedBones } from './types';
import { getSideScale, resolveCurveBalance } from './balanceUtils';
import {
  partitionBakedClip,
  resolveBakedAggregateBlendMode,
  resolveBakedChannelBlendMode,
  type PartitionedBakedClip,
} from './bakedClipPartitioning';

type Transition = {
  key: string;
  from: number;
  to: number;
  duration: number;      // seconds
  elapsed: number;       // seconds
  apply: (value: number) => void;
  easing: (t: number) => number;
  resolve?: () => void;  // Called when transition completes
  paused: boolean;       // Individual pause state
};

const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

// Smoother cubic easing - better for viseme transitions
const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// Export easing functions for external use
export { easeInOutQuad, easeInOutCubic };

export class AnimationThree {
  private transitions = new Map<string, Transition>();

  /**
   * Tick all active transitions by dt seconds.
   * Applies eased interpolation and removes completed transitions.
   * Respects individual transition pause state.
   */
  tick(dtSeconds: number): void {
    if (dtSeconds <= 0) return;

    const completed: string[] = [];

    this.transitions.forEach((t, key) => {
      // Skip paused transitions
      if (t.paused) return;

      t.elapsed += dtSeconds;
      const progress = Math.min(t.elapsed / t.duration, 1.0);
      const easedProgress = t.easing(progress);

      // Interpolate and apply
      const value = t.from + (t.to - t.from) * easedProgress;
      t.apply(value);

      // Check completion
      if (progress >= 1.0) {
        completed.push(key);
        t.resolve?.();
      }
    });

    // Remove completed transitions
    completed.forEach(key => this.transitions.delete(key));
  }

  /**
   * Add or replace a transition for the given key.
   * If a transition with the same key exists, it is cancelled and replaced.
   * @returns TransitionHandle with { promise, pause, resume, cancel }
   */
  addTransition(
    key: string,
    from: number,
    to: number,
    durationMs: number,
    apply: (value: number) => void,
    easing: (t: number) => number = easeInOutQuad
  ): TransitionHandle {
    // Convert to seconds once here - all callers pass milliseconds
    const durationSec = durationMs / 1000;

    // Cancel existing transition for this key
    const existing = this.transitions.get(key);
    if (existing?.resolve) {
      existing.resolve(); // Resolve immediately (cancelled)
    }

    // Instant transition if duration is 0 or values are equal
    if (durationSec <= 0 || Math.abs(to - from) < 1e-6) {
      apply(to);
      return {
        promise: Promise.resolve(),
        pause: () => {},
        resume: () => {},
        cancel: () => {},
      };
    }

    const promise = new Promise<void>((resolve) => {
      const transitionObj: Transition = {
        key,
        from,
        to,
        duration: durationSec,
        elapsed: 0,
        apply,
        easing,
        resolve,
        paused: false,
      };
      this.transitions.set(key, transitionObj);
    });

    return {
      promise,
      pause: () => {
        const t = this.transitions.get(key);
        if (t) t.paused = true;
      },
      resume: () => {
        const t = this.transitions.get(key);
        if (t) t.paused = false;
      },
      cancel: () => {
        const t = this.transitions.get(key);
        if (t) {
          t.resolve?.();
          this.transitions.delete(key);
        }
      },
    };
  }

  /** Clear all running transitions. */
  clearTransitions(): void {
    this.transitions.forEach(t => t.resolve?.());
    this.transitions.clear();
  }

  /** Get count of active transitions. */
  getActiveTransitionCount(): number {
    return this.transitions.size;
  }
}

export interface BakedAnimationHost {
  getModel: () => Object3D | null;
  getMeshes: () => Mesh[];
  getMeshByName: (name: string) => Mesh | undefined;
  getMeshNamesForAU?: (auId: number) => string[];
  getMeshNamesForViseme?: () => string[];
  getBones: () => ResolvedBones;
  getConfig: () => Profile;
  getCompositeRotations: () => CompositeRotation[];
  computeSideValues: (base: number, balance?: number) => { left: number; right: number };
  getAUMixWeight: (auId: number) => number;
  isMixedAU: (auId: number) => boolean;
}

// Lightweight unique id for mixer actions/handles
const makeActionId = () => `act_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
const X_AXIS = new Vector3(1, 0, 0);
const Y_AXIS = new Vector3(0, 1, 0);
const Z_AXIS = new Vector3(0, 0, 1);
const CLIP_EVENT_METADATA_KEY = '__loom3ClipEvents';
const CLIP_EVENT_EPSILON = 1e-4;

type ClipEventMetadata = {
  keyframeTimes: number[];
};

type ClipMonitor = {
  action: AnimationAction;
  actionId: string;
  clip: AnimationClip;
  clipName: string;
  duration: number;
  keyframeTimes: number[];
  listeners: Set<ClipEventListener>;
  initialDirection: 1 | -1;
  direction: 1 | -1;
  iteration: number;
  lastTime: number;
  lastKeyframeIndex: number;
  loopMode: 'once' | 'repeat' | 'pingpong';
  finishedPending: boolean;
  cleanedUp: boolean;
  resolveFinished: () => void;
};

type NormalizedPlaybackState = {
  source: AnimationSource;
  loop: boolean;
  loopMode: 'repeat' | 'pingpong' | 'once';
  repeatCount?: number;
  reverse: boolean;
  playbackRate: number;
  weight: number;
  balance: number;
  requestedBlendMode: AnimationBlendMode;
  blendMode: AnimationBlendMode;
  easing: AnimationEasing;
};

type BakedActionGroup = {
  actionId: string;
  channelActions: Map<BakedClipChannel, AnimationAction>;
  pendingFinishedChannels: Set<BakedClipChannel>;
  finishedPromise: Promise<void>;
  resolveFinished: () => void;
};

export class BakedAnimationController {
  private host: BakedAnimationHost;
  private animationMixer: AnimationMixer | null = null;
  private mixerFinishedListenerAttached = false;
  private animationClips: AnimationClip[] = [];
  private bakedSourceClips = new Map<string, PartitionedBakedClip>();
  private bakedRuntimeActions = new Map<string, AnimationAction>();
  private bakedActionGroups = new Map<string, BakedActionGroup>();
  private bakedRuntimeClipToSource = new Map<string, { sourceClipName: string; channel: BakedClipChannel }>();
  private animationActions = new Map<string, AnimationAction>();
  private animationFinishedCallbacks = new Map<string, () => void>();
  private clipActions = new Map<string, AnimationAction>();
  private clipHandles = new Map<string, ClipHandle>();
  private clipSources = new Map<string, AnimationSource>();
  private playbackState = new Map<string, NormalizedPlaybackState>();
  private actionIds = new WeakMap<AnimationAction, string>();
  private actionIdToClip = new Map<string, string>();
  private clipMonitors = new Map<string, ClipMonitor>();

  constructor(host: BakedAnimationHost) {
    this.host = host;
  }

  private getActionId(action?: AnimationAction | null): string | undefined {
    if (!action) return undefined;
    return this.actionIds.get(action) ?? action.__actionId;
  }

  private setActionId(action: AnimationAction, clipName: string): string {
    const actionId = makeActionId();
    this.actionIds.set(action, actionId);
    this.actionIdToClip.set(actionId, clipName);
    action.__actionId = actionId;
    return actionId;
  }

  private setClipEventMetadata(clip: AnimationClip, metadata: ClipEventMetadata) {
    const userData = ((clip as any).userData ??= {});
    userData[CLIP_EVENT_METADATA_KEY] = metadata;
  }

  private getClipEventMetadata(clip: AnimationClip): ClipEventMetadata {
    const userData = (clip as any).userData;
    const keyframeTimes = Array.isArray(userData?.[CLIP_EVENT_METADATA_KEY]?.keyframeTimes)
      ? userData[CLIP_EVENT_METADATA_KEY].keyframeTimes.filter((time: unknown): time is number => Number.isFinite(time as number))
      : [];
    return { keyframeTimes };
  }

  private getKeyframeIndex(times: number[], currentTime: number) {
    if (!times.length) return -1;
    const target = Math.max(0, currentTime) + 1e-3;
    let lo = 0;
    let hi = times.length - 1;
    let idx = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      if (times[mid] <= target) {
        idx = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return idx;
  }

  private emitClipEvent(monitor: ClipMonitor, event: Parameters<ClipEventListener>[0]) {
    for (const listener of Array.from(monitor.listeners)) {
      try {
        listener(event);
      } catch (error) {
        console.error('[Loom3] clip event listener failed', error);
      }
    }
  }

  private emitKeyframesForRange(
    monitor: ClipMonitor,
    startTime: number,
    endTime: number,
    direction: 1 | -1,
    includeStart: boolean
  ) {
    if (!monitor.keyframeTimes.length) return;

    const times = direction === 1 ? monitor.keyframeTimes : [...monitor.keyframeTimes].reverse();
    for (const time of times) {
      const matchesForward = direction === 1
        && (includeStart ? time >= startTime - CLIP_EVENT_EPSILON : time > startTime + CLIP_EVENT_EPSILON)
        && time <= endTime + CLIP_EVENT_EPSILON;
      const matchesReverse = direction === -1
        && (includeStart ? time <= startTime + CLIP_EVENT_EPSILON : time < startTime - CLIP_EVENT_EPSILON)
        && time >= endTime - CLIP_EVENT_EPSILON;
      if (!matchesForward && !matchesReverse) continue;

      const keyframeIndex = monitor.keyframeTimes.indexOf(time);
      monitor.lastKeyframeIndex = keyframeIndex;
      this.emitClipEvent(monitor, {
        type: 'keyframe',
        clipName: monitor.clipName,
        keyframeIndex,
        totalKeyframes: monitor.keyframeTimes.length,
        currentTime: time,
        duration: monitor.duration,
        iteration: monitor.iteration,
      });
    }
  }

  private resetClipMonitor(monitor: ClipMonitor, currentTime: number) {
    monitor.iteration = 0;
    monitor.direction = monitor.initialDirection;
    monitor.lastTime = currentTime;
    monitor.lastKeyframeIndex = this.getKeyframeIndex(monitor.keyframeTimes, currentTime);
    monitor.finishedPending = false;
  }

  private syncClipMonitorTime(monitor: ClipMonitor, currentTime: number, emitSeek = false) {
    const clamped = Math.max(0, Math.min(monitor.duration, currentTime));
    monitor.lastTime = clamped;
    monitor.lastKeyframeIndex = this.getKeyframeIndex(monitor.keyframeTimes, clamped);
    if (emitSeek) {
      this.emitClipEvent(monitor, {
        type: 'seek',
        clipName: monitor.clipName,
        currentTime: clamped,
        duration: monitor.duration,
        iteration: monitor.iteration,
      });
    }
  }

  private cleanupClipMonitor(actionId: string) {
    const monitor = this.clipMonitors.get(actionId);
    if (!monitor || monitor.cleanedUp) return;
    monitor.cleanedUp = true;
    try { monitor.action.paused = true; } catch {}
    monitor.resolveFinished();
    monitor.listeners.clear();
    this.clipMonitors.delete(actionId);
    this.actionIdToClip.delete(actionId);
  }

  private advanceClipMonitor(monitor: ClipMonitor, previousTime: number) {
    if (monitor.cleanedUp || (monitor.action.paused && !monitor.finishedPending)) return;

    const currentTime = Math.max(0, Math.min(monitor.duration, monitor.action.time));
    const delta = currentTime - previousTime;

    if (monitor.loopMode === 'pingpong') {
      const movingForward = monitor.direction === 1;
      const bouncedAtEnd = movingForward && delta < -CLIP_EVENT_EPSILON;
      const bouncedAtStart = !movingForward && delta > CLIP_EVENT_EPSILON;

      if (bouncedAtEnd) {
        this.emitKeyframesForRange(monitor, previousTime, monitor.duration, 1, false);
        monitor.direction = -1;
        this.emitKeyframesForRange(monitor, monitor.duration, currentTime, -1, false);
      } else if (bouncedAtStart) {
        this.emitKeyframesForRange(monitor, previousTime, 0, -1, false);
        monitor.direction = 1;
        monitor.iteration += 1;
        this.emitClipEvent(monitor, {
          type: 'loop',
          clipName: monitor.clipName,
          iteration: monitor.iteration,
          currentTime: 0,
          duration: monitor.duration,
        });
        this.emitKeyframesForRange(monitor, 0, currentTime, 1, false);
      } else if (delta > CLIP_EVENT_EPSILON) {
        this.emitKeyframesForRange(monitor, previousTime, currentTime, 1, false);
        monitor.direction = 1;
      } else if (delta < -CLIP_EVENT_EPSILON) {
        this.emitKeyframesForRange(monitor, previousTime, currentTime, -1, false);
        monitor.direction = -1;
      }
    } else if (monitor.direction === 1) {
      const wrapped = currentTime + CLIP_EVENT_EPSILON < previousTime;
      if (wrapped) {
        this.emitKeyframesForRange(monitor, previousTime, monitor.duration, 1, false);
        monitor.iteration += 1;
        this.emitClipEvent(monitor, {
          type: 'loop',
          clipName: monitor.clipName,
          iteration: monitor.iteration,
          currentTime: 0,
          duration: monitor.duration,
        });
        this.emitKeyframesForRange(monitor, 0, currentTime, 1, true);
      } else if (delta > CLIP_EVENT_EPSILON) {
        this.emitKeyframesForRange(monitor, previousTime, currentTime, 1, false);
      }
    } else {
      const wrapped = currentTime > previousTime + CLIP_EVENT_EPSILON;
      if (wrapped) {
        this.emitKeyframesForRange(monitor, previousTime, 0, -1, false);
        monitor.iteration += 1;
        this.emitClipEvent(monitor, {
          type: 'loop',
          clipName: monitor.clipName,
          iteration: monitor.iteration,
          currentTime: monitor.duration,
          duration: monitor.duration,
        });
        this.emitKeyframesForRange(monitor, monitor.duration, currentTime, -1, true);
      } else if (delta < -CLIP_EVENT_EPSILON) {
        this.emitKeyframesForRange(monitor, previousTime, currentTime, -1, false);
      }
    }

    this.syncClipMonitorTime(monitor, currentTime);
  }

  private normalizePlaybackOptions(
    options: AnimationPlayOptions | ClipOptions | undefined,
    defaults: { loop: boolean; source: AnimationSource }
  ): NormalizedPlaybackState {
    const clipOptions = options as ClipOptions | undefined;
    const rawRate = options?.playbackRate ?? options?.speed ?? 1.0;
    const playbackRate = Number.isFinite(rawRate) ? Math.max(0, Math.abs(rawRate)) : 1.0;
    const rawWeight = options?.weight ?? options?.intensity ?? clipOptions?.mixerWeight ?? 1.0;
    const weight = Number.isFinite(rawWeight) ? Math.max(0, rawWeight) : 1.0;
    const loopMode = options?.loopMode
      ?? (typeof options?.loop === 'boolean'
        ? (options.loop ? 'repeat' : 'once')
        : (defaults.loop ? 'repeat' : 'once'));
    const requestedBlendMode = options?.blendMode ?? (clipOptions?.mixerAdditive ? 'additive' : 'replace');
    return {
      source: options?.source ?? defaults.source,
      loop: loopMode !== 'once',
      loopMode,
      repeatCount: options?.repeatCount,
      reverse: !!options?.reverse,
      playbackRate,
      weight,
      balance: Number.isFinite(options?.balance) ? options?.balance ?? 0 : 0,
      requestedBlendMode,
      blendMode: requestedBlendMode,
      easing: options?.easing ?? 'linear',
    };
  }

  private applyPlaybackState(action: AnimationAction, state: NormalizedPlaybackState): void {
    const signedRate = state.reverse ? -state.playbackRate : state.playbackRate;
    action.setEffectiveTimeScale(signedRate);
    action.setEffectiveWeight(state.weight);
    action.blendMode = state.blendMode === 'additive'
      ? AdditiveAnimationBlendMode
      : NormalAnimationBlendMode;

    const reps = state.repeatCount ?? Infinity;
    if (state.loopMode === 'pingpong') {
      action.setLoop(LoopPingPong, reps);
    } else if (state.loopMode === 'once') {
      action.setLoop(LoopOnce, 1);
    } else {
      action.setLoop(LoopRepeat, reps);
    }
    action.clampWhenFinished = state.loopMode === 'once';
  }

  private setPlaybackState(clipName: string, state: NormalizedPlaybackState): void {
    this.playbackState.set(clipName, state);
    this.clipSources.set(clipName, state.source);
  }

  private getPlaybackStateSnapshot(
    clipName: string,
    defaults: { loop: boolean; source: AnimationSource }
  ): NormalizedPlaybackState {
    const existing = this.playbackState.get(clipName);
    if (existing) {
      return { ...existing };
    }
    return this.normalizePlaybackOptions(undefined, defaults);
  }

  private mergePlaybackOptions(
    current: NormalizedPlaybackState,
    options: AnimationPlayOptions | ClipOptions | undefined
  ): NormalizedPlaybackState {
    if (!options) {
      return current;
    }
    const next = { ...current };
    const clipOptions = options as ClipOptions | undefined;
    const loopMode = options.loopMode
      ?? (typeof options.loop === 'boolean' ? (options.loop ? 'repeat' : 'once') : undefined);

    if (options.source) next.source = options.source;
    if (loopMode) {
      next.loopMode = loopMode;
      next.loop = loopMode !== 'once';
    }
    if (options.repeatCount !== undefined) {
      next.repeatCount = Number.isFinite(options.repeatCount)
        ? Math.max(0, options.repeatCount ?? 0)
        : undefined;
    }
    if (typeof options.reverse === 'boolean') {
      next.reverse = options.reverse;
    }

    const rate = options.playbackRate ?? options.speed;
    if (rate !== undefined) {
      next.playbackRate = Number.isFinite(rate) ? Math.max(0, Math.abs(rate)) : current.playbackRate;
    }

    const weight = options.weight ?? options.intensity ?? clipOptions?.mixerWeight;
    if (weight !== undefined) {
      next.weight = Number.isFinite(weight) ? Math.max(0, weight) : current.weight;
    }

    if (typeof options.balance === 'number' && Number.isFinite(options.balance)) {
      next.balance = Math.max(-1, Math.min(1, options.balance));
    }

    if (options.blendMode) {
      next.requestedBlendMode = options.blendMode;
    } else if (typeof clipOptions?.mixerAdditive === 'boolean') {
      next.requestedBlendMode = clipOptions.mixerAdditive ? 'additive' : 'replace';
    }
    next.blendMode = next.requestedBlendMode;

    if (options.easing) {
      next.easing = options.easing;
    }

    return next;
  }

  private isBakedSourceClip(clipName: string): boolean {
    return this.bakedSourceClips.has(clipName);
  }

  private getBakedSourceClip(clipName: string): PartitionedBakedClip | undefined {
    return this.bakedSourceClips.get(clipName);
  }

  private getBakedChannelInfo(
    clipName: string,
    playbackState?: NormalizedPlaybackState
  ): BakedClipChannelInfo[] | undefined {
    const bakedClip = this.getBakedSourceClip(clipName);
    if (!bakedClip) {
      return undefined;
    }

    const requestedBlendMode = playbackState?.requestedBlendMode ?? 'replace';
    return bakedClip.channels.map((channel) => ({
      ...channel,
      blendMode: resolveBakedChannelBlendMode(channel.channel, requestedBlendMode),
    }));
  }

  private getBakedAggregateBlendMode(
    clipName: string,
    playbackState?: NormalizedPlaybackState
  ): AnimationBlendMode {
    const channels = this.getBakedChannelInfo(clipName, playbackState);
    if (!channels) {
      return playbackState?.requestedBlendMode ?? playbackState?.blendMode ?? 'replace';
    }
    return resolveBakedAggregateBlendMode(
      channels,
      playbackState?.requestedBlendMode ?? 'replace'
    );
  }

  private applyPlaybackStateToBakedAction(
    action: AnimationAction,
    state: NormalizedPlaybackState,
    channel: BakedClipChannel
  ): void {
    this.applyPlaybackState(action, {
      ...state,
      blendMode: resolveBakedChannelBlendMode(channel, state.requestedBlendMode) ?? 'replace',
    });
  }

  private resolveStartTime(
    duration: number,
    state: NormalizedPlaybackState,
    explicitStartTime?: number
  ): number {
    if (typeof explicitStartTime === 'number' && Number.isFinite(explicitStartTime)) {
      return Math.max(0, Math.min(duration, explicitStartTime));
    }
    if (state.reverse && state.loopMode === 'once') {
      return duration;
    }
    return 0;
  }

  private getOrCreateBakedRuntimeAction(
    sourceClipName: string,
    channel: BakedClipChannel
  ): AnimationAction | null {
    const bakedClip = this.getBakedSourceClip(sourceClipName);
    const runtimeClip = bakedClip?.runtimeClips.find((entry) => entry.channel === channel)?.clip;
    if (!runtimeClip) {
      return null;
    }

    const existing = this.bakedRuntimeActions.get(runtimeClip.name);
    if (existing) {
      return existing;
    }

    this.ensureMixer();
    if (!this.animationMixer) {
      return null;
    }

    const action = this.animationMixer.clipAction(runtimeClip);
    this.bakedRuntimeActions.set(runtimeClip.name, action);
    return action;
  }

  private getRepresentativeBakedAction(clipName: string): AnimationAction | null {
    const group = this.bakedActionGroups.get(clipName);
    if (!group) {
      return null;
    }
    return group.channelActions.values().next().value ?? null;
  }

  private createBakedActionGroup(
    clipName: string,
    playbackState: NormalizedPlaybackState
  ): BakedActionGroup | null {
    const bakedClip = this.getBakedSourceClip(clipName);
    if (!bakedClip) {
      return null;
    }

    const channelActions = new Map<BakedClipChannel, AnimationAction>();
    for (const runtimeClip of bakedClip.runtimeClips) {
      const action = this.getOrCreateBakedRuntimeAction(clipName, runtimeClip.channel);
      if (action) {
        channelActions.set(runtimeClip.channel, action);
      }
    }

    if (channelActions.size === 0) {
      return null;
    }

    let resolveFinished = () => {};
    const finishedPromise = new Promise<void>((resolve) => {
      resolveFinished = resolve;
    });

    return {
      actionId: makeActionId(),
      channelActions,
      pendingFinishedChannels: playbackState.loopMode === 'once'
        ? new Set(channelActions.keys())
        : new Set<BakedClipChannel>(),
      finishedPromise,
      resolveFinished,
    };
  }

  private getMeshNamesForAU(auId: number, config: Profile, explicitMeshNames?: string[]): string[] {
    if (explicitMeshNames && explicitMeshNames.length > 0) {
      return explicitMeshNames;
    }

    if (typeof this.host.getMeshNamesForAU === 'function') {
      return this.host.getMeshNamesForAU(auId) || [];
    }

    return getMeshNamesForAUProfile(config, auId);
  }

  private getMeshNamesForViseme(config: Profile, explicitMeshNames?: string[]): string[] {
    if (explicitMeshNames && explicitMeshNames.length > 0) {
      return explicitMeshNames;
    }

    if (typeof this.host.getMeshNamesForViseme === 'function') {
      return this.host.getMeshNamesForViseme() || [];
    }

    return getMeshNamesForVisemeProfile(config);
  }

  update(dtSeconds: number): void {
    if (this.animationMixer) {
      const snapshots = Array.from(this.clipMonitors.values()).map((monitor) => ({
        actionId: monitor.actionId,
        previousTime: monitor.action.time,
      }));
      this.animationMixer.update(dtSeconds);
      for (const { actionId, previousTime } of snapshots) {
        const monitor = this.clipMonitors.get(actionId);
        if (!monitor) continue;
        this.advanceClipMonitor(monitor, previousTime);
        if (monitor.finishedPending) {
          const finalTime = Math.max(0, Math.min(monitor.duration, monitor.action.time));
          this.syncClipMonitorTime(monitor, finalTime);
          this.emitClipEvent(monitor, {
            type: 'completed',
            clipName: monitor.clipName,
            currentTime: finalTime,
            duration: monitor.duration,
            iteration: monitor.iteration,
          });
          this.cleanupClipMonitor(actionId);
        }
      }
    }
  }

  dispose(): void {
    this.stopAllAnimations();
    if (this.animationMixer) {
      this.animationMixer.stopAllAction();
      this.animationMixer = null;
    }
    this.animationClips = [];
    this.bakedSourceClips.clear();
    this.bakedRuntimeActions.clear();
    this.bakedActionGroups.clear();
    this.bakedRuntimeClipToSource.clear();
    this.animationActions.clear();
    this.animationFinishedCallbacks.clear();
    this.clipActions.clear();
    this.clipHandles.clear();
    this.clipSources.clear();
    this.playbackState.clear();
    this.clipMonitors.clear();
  }

  loadAnimationClips(clips: unknown[]): void {
    const model = this.host.getModel();
    if (!model) {
      console.warn('Loom3: Cannot load animation clips before calling onReady()');
      return;
    }

    for (const clipName of this.bakedSourceClips.keys()) {
      this.stopAnimation(clipName);
    }
    if (this.animationMixer) {
      for (const bakedClip of this.bakedSourceClips.values()) {
        for (const runtimeClip of bakedClip.runtimeClips) {
          try {
            this.animationMixer.uncacheAction(runtimeClip.clip);
          } catch {}
          try {
            this.animationMixer.uncacheClip(runtimeClip.clip);
          } catch {}
        }
      }
    }

    for (const clipName of this.bakedSourceClips.keys()) {
      this.playbackState.delete(clipName);
      this.clipSources.delete(clipName);
    }

    this.bakedSourceClips.clear();
    this.bakedRuntimeActions.clear();
    this.bakedActionGroups.clear();
    this.bakedRuntimeClipToSource.clear();

    this.ensureMixer();
    const partitionedClips = (clips as AnimationClip[]).map((clip) => (
      partitionBakedClip(clip, model, this.host.getBones())
    ));

    this.animationClips = partitionedClips.map((clip) => clip.sourceClip);
    for (const bakedClip of partitionedClips) {
      this.bakedSourceClips.set(bakedClip.sourceClip.name, bakedClip);
      this.clipSources.set(bakedClip.sourceClip.name, 'baked');
      for (const runtimeClip of bakedClip.runtimeClips) {
        this.bakedRuntimeClipToSource.set(runtimeClip.clip.name, {
          sourceClipName: bakedClip.sourceClip.name,
          channel: runtimeClip.channel,
        });
      }
    }
  }

  getAnimationClips(): AnimationClipInfo[] {
    return this.animationClips.map(clip => ({
      name: clip.name,
      duration: clip.duration,
      trackCount: clip.tracks.length,
      source: this.clipSources.get(clip.name) ?? 'baked',
      channels: this.getBakedSourceClip(clip.name)?.channels,
    }));
  }

  removeAnimationClip(clipName: string): boolean {
    const bakedClip = this.getBakedSourceClip(clipName);
    if (!bakedClip) {
      return false;
    }

    this.stopAnimation(clipName);

    if (this.animationMixer) {
      for (const runtimeClip of bakedClip.runtimeClips) {
        const action = this.bakedRuntimeActions.get(runtimeClip.clip.name);
        try {
          this.animationMixer.uncacheAction(runtimeClip.clip);
        } catch {}
        try {
          this.animationMixer.uncacheClip(runtimeClip.clip);
        } catch {}
        this.bakedRuntimeActions.delete(runtimeClip.clip.name);
        this.bakedRuntimeClipToSource.delete(runtimeClip.clip.name);
        const actionId = this.getActionId(action);
        if (actionId && action) {
          this.actionIdToClip.delete(actionId);
          this.actionIds.delete(action);
        }
      }
    }

    this.animationClips = this.animationClips.filter((entry) => entry.name !== clipName);
    this.bakedSourceClips.delete(clipName);
    this.bakedActionGroups.delete(clipName);
    this.playbackState.delete(clipName);
    this.clipSources.delete(clipName);

    return true;
  }

  playAnimation(clipName: string, options: AnimationPlayOptions = {}): AnimationActionHandle | null {
    const bakedClip = this.getBakedSourceClip(clipName);
    if (!bakedClip) {
      console.warn(`Loom3: Animation clip "${clipName}" not found`);
      return null;
    }

    const playbackState = this.mergePlaybackOptions(
      this.getPlaybackStateSnapshot(clipName, { loop: true, source: 'baked' }),
      options
    );
    playbackState.blendMode = this.getBakedAggregateBlendMode(clipName, playbackState);
    const actionGroup = this.createBakedActionGroup(clipName, playbackState);
    if (!actionGroup) {
      console.warn(`Loom3: Animation clip "${clipName}" has no character-runtime channels to play`);
      return null;
    }

    const crossfadeDuration = options.crossfadeDuration ?? 0;
    const clampWhenFinished = options.clampWhenFinished ?? playbackState.loopMode === 'once';
    const startTime = this.resolveStartTime(bakedClip.sourceClip.duration, playbackState, options.startTime);

    for (const [channel, action] of actionGroup.channelActions) {
      this.applyPlaybackStateToBakedAction(action, playbackState, channel);
      action.clampWhenFinished = clampWhenFinished;

      if (crossfadeDuration > 0) {
        action.reset();
        action.fadeIn(crossfadeDuration);
      } else {
        action.reset();
      }
      action.time = startTime;
      action.play();
    }

    this.bakedActionGroups.set(clipName, actionGroup);
    this.setPlaybackState(clipName, playbackState);
    return this.createBakedAnimationHandle(clipName, actionGroup);
  }

  stopAnimation(clipName: string): void {
    const bakedGroup = this.bakedActionGroups.get(clipName);
    if (bakedGroup) {
      for (const action of bakedGroup.channelActions.values()) {
        action.stop();
        try { action.paused = false; } catch {}
      }
      this.bakedActionGroups.delete(clipName);
      return;
    }

    const action = this.animationActions.get(clipName);
    if (action) {
      const actionId = this.getActionId(action);
      const isBaked = (this.clipSources.get(clipName) ?? 'baked') === 'baked';
      action.stop();
      if (!isBaked && this.animationMixer) {
        try {
          const clip = action.getClip();
          if (clip) {
            this.animationMixer.uncacheAction(clip);
            this.animationMixer.uncacheClip(clip);
          }
        } catch {}
      }
      if (!isBaked) {
        this.animationActions.delete(clipName);
        this.playbackState.delete(clipName);
      } else {
        try { action.paused = false; } catch {}
      }
      this.animationFinishedCallbacks.delete(clipName);
      if (actionId) this.cleanupClipMonitor(actionId);
    }
    const clipAction = this.clipActions.get(clipName);
    if (clipAction && clipAction !== action) {
      const actionId = this.getActionId(clipAction);
      try {
        clipAction.stop();
        if (this.animationMixer) {
          const clip = clipAction.getClip();
          if (clip) {
            this.animationMixer.uncacheAction(clip);
            this.animationMixer.uncacheClip(clip);
          }
        }
      } catch {}
      this.clipActions.delete(clipName);
      if (actionId) this.cleanupClipMonitor(actionId);
    }
    if (this.clipActions.get(clipName) === action) {
      this.clipActions.delete(clipName);
    }
    this.clipHandles.delete(clipName);
  }

  stopAllAnimations(): void {
    for (const clipName of new Set([
      ...this.bakedActionGroups.keys(),
      ...this.animationActions.keys(),
      ...this.clipActions.keys(),
    ])) {
      this.stopAnimation(clipName);
    }
  }

  pauseAnimation(clipName: string): void {
    const bakedGroup = this.bakedActionGroups.get(clipName);
    if (bakedGroup) {
      for (const action of bakedGroup.channelActions.values()) {
        action.paused = true;
      }
      return;
    }

    const action = this.animationActions.get(clipName);
    if (action) {
      action.paused = true;
    }
  }

  resumeAnimation(clipName: string): void {
    const bakedGroup = this.bakedActionGroups.get(clipName);
    if (bakedGroup) {
      for (const action of bakedGroup.channelActions.values()) {
        action.paused = false;
      }
      return;
    }

    const action = this.animationActions.get(clipName);
    if (action) {
      action.paused = false;
    }
  }

  pauseAllAnimations(): void {
    for (const group of this.bakedActionGroups.values()) {
      for (const action of group.channelActions.values()) {
        if (action.isRunning()) {
          action.paused = true;
        }
      }
    }
    for (const action of this.animationActions.values()) {
      if (action.isRunning()) {
        action.paused = true;
      }
    }
  }

  resumeAllAnimations(): void {
    for (const group of this.bakedActionGroups.values()) {
      for (const action of group.channelActions.values()) {
        if (action.paused) {
          action.paused = false;
        }
      }
    }
    for (const action of this.animationActions.values()) {
      if (action.paused) {
        action.paused = false;
      }
    }
  }

  setAnimationSpeed(clipName: string, speed: number): void {
    if (this.isBakedSourceClip(clipName)) {
      const next = this.getPlaybackStateSnapshot(clipName, {
        loop: true,
        source: this.clipSources.get(clipName) ?? 'baked',
      });
      next.playbackRate = Number.isFinite(speed) ? Math.max(0, Math.abs(speed)) : 1.0;
      const bakedGroup = this.bakedActionGroups.get(clipName);
      if (bakedGroup) {
        for (const [channel, action] of bakedGroup.channelActions) {
          this.applyPlaybackStateToBakedAction(action, next, channel);
        }
      }
      this.setPlaybackState(clipName, next);
      return;
    }

    const action = this.animationActions.get(clipName);
    if (action) {
      const next = this.getPlaybackStateSnapshot(clipName, {
        loop: true,
        source: this.clipSources.get(clipName) ?? 'clip',
      });
      next.playbackRate = Number.isFinite(speed) ? Math.max(0, Math.abs(speed)) : 1.0;
      this.applyPlaybackState(action, next);
      this.setPlaybackState(clipName, next);
    }
  }

  setAnimationIntensity(clipName: string, intensity: number): void {
    if (this.isBakedSourceClip(clipName)) {
      const next = this.getPlaybackStateSnapshot(clipName, {
        loop: true,
        source: this.clipSources.get(clipName) ?? 'baked',
      });
      next.weight = Number.isFinite(intensity) ? Math.max(0, intensity) : 1.0;
      const bakedGroup = this.bakedActionGroups.get(clipName);
      if (bakedGroup) {
        for (const [channel, action] of bakedGroup.channelActions) {
          this.applyPlaybackStateToBakedAction(action, next, channel);
        }
      }
      this.setPlaybackState(clipName, next);
      return;
    }

    const action = this.animationActions.get(clipName);
    if (action) {
      const next = this.getPlaybackStateSnapshot(clipName, {
        loop: true,
        source: this.clipSources.get(clipName) ?? 'clip',
      });
      next.weight = Number.isFinite(intensity) ? Math.max(0, intensity) : 1.0;
      action.setEffectiveWeight(next.weight);
      this.setPlaybackState(clipName, next);
    }
  }

  setAnimationLoopMode(clipName: string, loopMode: 'repeat' | 'once' | 'pingpong'): void {
    const next = this.getPlaybackStateSnapshot(clipName, {
      loop: true,
      source: this.clipSources.get(clipName) ?? (this.isBakedSourceClip(clipName) ? 'baked' : 'clip'),
    });
    next.loopMode = loopMode;
    next.loop = loopMode !== 'once';

    if (this.isBakedSourceClip(clipName)) {
      const bakedGroup = this.bakedActionGroups.get(clipName);
      if (bakedGroup) {
        for (const [channel, action] of bakedGroup.channelActions) {
          this.applyPlaybackStateToBakedAction(action, next, channel);
        }
      }
      this.setPlaybackState(clipName, next);
      return;
    }

    const action = this.animationActions.get(clipName);
    if (!action) return;
    this.applyPlaybackState(action, next);
    this.setPlaybackState(clipName, next);
  }

  setAnimationRepeatCount(clipName: string, repeatCount?: number): void {
    const next = this.getPlaybackStateSnapshot(clipName, {
      loop: true,
      source: this.clipSources.get(clipName) ?? (this.isBakedSourceClip(clipName) ? 'baked' : 'clip'),
    });
    next.repeatCount = typeof repeatCount === 'number' && Number.isFinite(repeatCount)
      ? Math.max(0, repeatCount)
      : undefined;

    if (this.isBakedSourceClip(clipName)) {
      const bakedGroup = this.bakedActionGroups.get(clipName);
      if (bakedGroup) {
        for (const [channel, action] of bakedGroup.channelActions) {
          this.applyPlaybackStateToBakedAction(action, next, channel);
        }
      }
      this.setPlaybackState(clipName, next);
      return;
    }

    const action = this.animationActions.get(clipName);
    if (!action) return;
    this.applyPlaybackState(action, next);
    this.setPlaybackState(clipName, next);
  }

  setAnimationReverse(clipName: string, reverse: boolean): void {
    const next = this.getPlaybackStateSnapshot(clipName, {
      loop: true,
      source: this.clipSources.get(clipName) ?? (this.isBakedSourceClip(clipName) ? 'baked' : 'clip'),
    });
    next.reverse = !!reverse;

    if (this.isBakedSourceClip(clipName)) {
      const bakedGroup = this.bakedActionGroups.get(clipName);
      if (bakedGroup) {
        for (const [channel, action] of bakedGroup.channelActions) {
          this.applyPlaybackStateToBakedAction(action, next, channel);
        }
      }
      this.setPlaybackState(clipName, next);
      return;
    }

    const action = this.animationActions.get(clipName);
    if (!action) return;
    this.applyPlaybackState(action, next);
    this.setPlaybackState(clipName, next);
  }

  setAnimationBlendMode(clipName: string, blendMode: AnimationBlendMode): void {
    const next = this.getPlaybackStateSnapshot(clipName, {
      loop: true,
      source: this.clipSources.get(clipName) ?? (this.isBakedSourceClip(clipName) ? 'baked' : 'clip'),
    });
    next.requestedBlendMode = blendMode;

    if (this.isBakedSourceClip(clipName)) {
      next.blendMode = this.getBakedAggregateBlendMode(clipName, next);
      const bakedGroup = this.bakedActionGroups.get(clipName);
      if (bakedGroup) {
        for (const [channel, action] of bakedGroup.channelActions) {
          this.applyPlaybackStateToBakedAction(action, next, channel);
        }
      }
      this.setPlaybackState(clipName, next);
      return;
    }

    next.blendMode = blendMode;
    const action = this.animationActions.get(clipName);
    if (!action) return;
    this.applyPlaybackState(action, next);
    this.setPlaybackState(clipName, next);
  }

  seekAnimation(clipName: string, time: number): void {
    const bakedGroup = this.bakedActionGroups.get(clipName);
    if (bakedGroup) {
      const duration = this.getBakedSourceClip(clipName)?.sourceClip.duration ?? 0;
      const clamped = Math.max(0, Math.min(duration, Number.isFinite(time) ? time : 0));
      for (const action of bakedGroup.channelActions.values()) {
        action.time = clamped;
      }
      try {
        this.animationMixer?.update(0);
      } catch {}
      return;
    }

    const action = this.animationActions.get(clipName);
    if (!action) return;
    const duration = action.getClip().duration;
    action.time = Math.max(0, Math.min(duration, Number.isFinite(time) ? time : 0));
    try {
      this.animationMixer?.update(0);
    } catch {}
  }

  setAnimationTimeScale(timeScale: number): void {
    if (this.animationMixer) {
      this.animationMixer.timeScale = timeScale;
    }
  }

  getAnimationState(clipName: string): AnimationState | null {
    const bakedClip = this.getBakedSourceClip(clipName);
    if (bakedClip) {
      const state = this.playbackState.get(clipName);
      const action = this.getRepresentativeBakedAction(clipName);
      if (!state && !action) {
        return null;
      }
      const loopMode = state?.loopMode
        ?? (action?.loop === LoopPingPong ? 'pingpong' : action?.loop === LoopOnce ? 'once' : 'repeat');
      const playbackRate = state?.playbackRate ?? Math.abs(action?.getEffectiveTimeScale?.() ?? 1);
      const reverse = state?.reverse ?? ((action?.getEffectiveTimeScale?.() ?? 1) < 0);
      const pausedValues = this.bakedActionGroups.get(clipName)
        ? Array.from(this.bakedActionGroups.get(clipName)!.channelActions.values()).map((entry) => entry.paused)
        : [];

      return {
        name: bakedClip.sourceClip.name,
        actionId: this.bakedActionGroups.get(clipName)?.actionId,
        source: state?.source ?? this.clipSources.get(clipName) ?? 'baked',
        isPlaying: this.bakedActionGroups.get(clipName)
          ? Array.from(this.bakedActionGroups.get(clipName)!.channelActions.values()).some((entry) => entry.isRunning() && !entry.paused)
          : false,
        isPaused: pausedValues.length > 0 ? pausedValues.every(Boolean) : false,
        time: action?.time ?? 0,
        duration: bakedClip.sourceClip.duration,
        speed: playbackRate,
        playbackRate,
        reverse,
        weight: state?.weight ?? action?.getEffectiveWeight?.() ?? 1,
        balance: state?.balance ?? 0,
        requestedBlendMode: state?.requestedBlendMode ?? 'replace',
        blendMode: this.getBakedAggregateBlendMode(clipName, state),
        channels: this.getBakedChannelInfo(clipName, state),
        easing: state?.easing ?? 'linear',
        loop: loopMode !== 'once',
        loopMode,
        repeatCount: state?.repeatCount,
        isLooping: loopMode !== 'once',
      };
    }

    const action = this.animationActions.get(clipName);
    if (!action) return null;

    const clip = action.getClip();
    const state = this.playbackState.get(clipName);
    const loopMode = state?.loopMode
      ?? (action.loop === LoopPingPong ? 'pingpong' : action.loop === LoopOnce ? 'once' : 'repeat');
    const playbackRate = state?.playbackRate ?? Math.abs(action.getEffectiveTimeScale());
    const reverse = state?.reverse ?? action.getEffectiveTimeScale() < 0;
    return {
      name: clip.name,
      actionId: this.getActionId(action),
      source: state?.source ?? this.clipSources.get(clip.name) ?? 'baked',
      isPlaying: action.isRunning() && !action.paused,
      isPaused: action.paused,
      time: action.time,
      duration: clip.duration,
      speed: playbackRate,
      playbackRate,
      reverse,
      weight: state?.weight ?? action.getEffectiveWeight(),
      balance: state?.balance ?? 0,
      requestedBlendMode: state?.requestedBlendMode ?? state?.blendMode ?? 'replace',
      blendMode: state?.blendMode ?? 'replace',
      channels: state?.source === 'baked' ? this.getBakedChannelInfo(clipName, state) : undefined,
      easing: state?.easing ?? 'linear',
      loop: loopMode !== 'once',
      loopMode,
      repeatCount: state?.repeatCount,
      isLooping: loopMode !== 'once',
    };
  }

  getPlayingAnimations(): AnimationState[] {
    const playing: AnimationState[] = [];
    for (const name of this.bakedActionGroups.keys()) {
      const state = this.getAnimationState(name);
      if (state?.isPlaying) {
        playing.push(state);
      }
    }
    for (const [name, action] of this.animationActions) {
      if (action.isRunning()) {
        const state = this.getAnimationState(name);
        if (state) playing.push(state);
      }
    }
    return playing;
  }

  crossfadeTo(clipName: string, duration = 0.3, options: AnimationPlayOptions = {}): AnimationActionHandle | null {
    for (const group of this.bakedActionGroups.values()) {
      for (const action of group.channelActions.values()) {
        if (action.isRunning()) {
          action.fadeOut(duration);
        }
      }
    }
    for (const action of this.animationActions.values()) {
      if (action.isRunning()) {
        action.fadeOut(duration);
      }
    }

    return this.playAnimation(clipName, {
      ...options,
      crossfadeDuration: duration,
    });
  }

  snippetToClip(
    clipName: string,
    curves: CurvesMap,
    options?: ClipOptions
  ): AnimationClip | null {
    const config = this.host.getConfig();
    if (!this.host.getModel()) {
      console.warn(`[Loom3] snippetToClip: No model loaded for "${clipName}"`);
      return null;
    }
    if (Object.keys(curves).length === 0) {
      console.warn(`[Loom3] snippetToClip: Empty curves for "${clipName}"`);
      return null;
    }

    const tracks: Array<NumberKeyframeTrack | QuaternionKeyframeTrack> = [];
    const intensityScale = options?.intensityScale ?? 1.0;
    const globalBalance = options?.balance ?? 0;
    const balanceMap = options?.balanceMap;
    const meshNames = options?.meshNames;
    let maxTime = 0;

    const isNumericAU = (id: string) => /^\d+$/.test(id);
    const isVisemeIndex = (id: string) => {
      if (options?.snippetCategory !== 'visemeSnippet') return false;
      const num = Number(id);
      return !Number.isNaN(num) && num >= 0 && num < config.visemeKeys.length;
    };

    const sampleAt = (arr: Array<{ time: number; intensity: number }>, t: number) => {
      if (!arr.length) return 0;
      if (t <= arr[0].time) return arr[0].intensity;
      if (t >= arr[arr.length - 1].time) return arr[arr.length - 1].intensity;
      for (let i = 0; i < arr.length - 1; i++) {
        const a = arr[i];
        const b = arr[i + 1];
        if (t >= a.time && t <= b.time) {
          const dt = Math.max(1e-6, b.time - a.time);
          const p = (t - a.time) / dt;
          return a.intensity + (b.intensity - a.intensity) * p;
        }
      }
      return 0;
    };

    const clampIntensity = (v: number) => Math.max(0, Math.min(2, v));
    const sampleCurve = (curveId: string, t: number) => {
      const arr = curves[curveId];
      if (!arr) return 0;
      return clampIntensity(sampleAt(arr, t) * intensityScale);
    };

    const keyframeTimes = (() => {
      const times = new Set<number>();
      Object.values(curves).forEach((arr) => {
        arr.forEach((kf) => times.add(kf.time));
      });
      return Array.from(times).sort((a, b) => a - b);
    })();

    for (const [curveId, keyframes] of Object.entries(curves)) {
      if (!keyframes || keyframes.length === 0) continue;

      const curveMaxTime = keyframes[keyframes.length - 1].time;
      if (curveMaxTime > maxTime) maxTime = curveMaxTime;

      if (isNumericAU(curveId)) {
        const auId = Number(curveId);

        if (isVisemeIndex(curveId)) {
          const visemeMeshNames = this.getMeshNamesForViseme(config, meshNames);
          const visemeKey = config.visemeKeys[auId];
          if (typeof visemeKey === 'number') {
            this.addMorphIndexTracks(tracks, visemeKey, keyframes, intensityScale, visemeMeshNames);
          } else if (visemeKey) {
            this.addMorphTracks(tracks, visemeKey, keyframes, intensityScale, visemeMeshNames);
          }
        } else {
          const auMeshNames = this.getMeshNamesForAU(auId, config, meshNames);
          const morphsBySide = config.auToMorphs[auId];
          const mixWeight = this.host.isMixedAU(auId) ? this.host.getAUMixWeight(auId) : 1.0;

          const leftKeys = morphsBySide?.left ?? [];
          const rightKeys = morphsBySide?.right ?? [];
          const centerKeys = morphsBySide?.center ?? [];

          const curveBalance = resolveCurveBalance(curveId, globalBalance, balanceMap);

          for (const morphKey of leftKeys) {
            let effectiveScale = intensityScale * mixWeight;
            if (curveBalance > 0) effectiveScale *= (1 - curveBalance);
            if (typeof morphKey === 'number') {
              this.addMorphIndexTracks(tracks, morphKey, keyframes, effectiveScale, auMeshNames);
            } else {
              this.addMorphTracks(tracks, morphKey, keyframes, effectiveScale, auMeshNames);
            }
          }
          for (const morphKey of rightKeys) {
            let effectiveScale = intensityScale * mixWeight;
            if (curveBalance < 0) effectiveScale *= (1 + curveBalance);
            if (typeof morphKey === 'number') {
              this.addMorphIndexTracks(tracks, morphKey, keyframes, effectiveScale, auMeshNames);
            } else {
              this.addMorphTracks(tracks, morphKey, keyframes, effectiveScale, auMeshNames);
            }
          }
          for (const morphKey of centerKeys) {
            const effectiveScale = intensityScale * mixWeight;
            if (typeof morphKey === 'number') {
              this.addMorphIndexTracks(tracks, morphKey, keyframes, effectiveScale, auMeshNames);
            } else {
              this.addMorphTracks(tracks, morphKey, keyframes, effectiveScale, auMeshNames);
            }
          }
        }
      } else {
        this.addMorphTracks(tracks, curveId, keyframes, intensityScale, meshNames);
      }
    }

    // Auto-generate jaw bone rotation from viseme curves when enabled
    // This replicates transitionViseme behavior for clip-based playback
    const autoVisemeJaw = options?.autoVisemeJaw !== false; // Default true
    const jawScale = options?.jawScale ?? 1.0;
    const visemeJawAmounts = config.visemeJawAmounts;

    if (
      autoVisemeJaw &&
      jawScale > 0 &&
      visemeJawAmounts &&
      options?.snippetCategory === 'visemeSnippet' &&
      keyframeTimes.length > 0
    ) {
      const bones = this.host.getBones();
      const jawEntry = bones['JAW'];

      if (jawEntry) {
        // Sample all viseme curves at each keyframe time and compute weighted jaw amount
        const jawValues: number[] = [];

        for (const t of keyframeTimes) {
          let jawAmount = 0;

          // Sum contributions from all active visemes at time t
          for (let visemeIdx = 0; visemeIdx < config.visemeKeys.length; visemeIdx++) {
            const visemeCurve = curves[String(visemeIdx)];
            if (!visemeCurve) continue;

            const visemeValue = clampIntensity(sampleAt(visemeCurve, t) * intensityScale);
            if (visemeValue > 0 && visemeIdx < visemeJawAmounts.length) {
              // Take max jaw amount across all active visemes (like transitionViseme)
              const visemeJaw = visemeJawAmounts[visemeIdx] * visemeValue * jawScale;
              if (visemeJaw > jawAmount) {
                jawAmount = visemeJaw;
              }
            }
          }

          // Convert jaw amount to quaternion rotation
          // JAW pitch uses rz axis with maxDegrees from AU 26 binding
          const jawBinding = config.auToBones[26]?.[0];
          const maxDegrees = jawBinding?.maxDegrees ?? 30;
          const radians = (maxDegrees * Math.PI / 180) * jawAmount;
          const jawQ = new Quaternion().copy(jawEntry.baseQuat);
          jawQ.multiply(new Quaternion().setFromAxisAngle(Z_AXIS, radians));

          jawValues.push(jawQ.x, jawQ.y, jawQ.z, jawQ.w);
        }

        const trackName = `${jawEntry.obj.uuid}.quaternion`;
        tracks.push(new QuaternionKeyframeTrack(trackName, keyframeTimes, jawValues));
      }
    }

    if (keyframeTimes.length > 0) {
      const bones = this.host.getBones();
      const compositeRotations = this.host.getCompositeRotations();
      const hasCurveAU = new Set<number>(
        Object.keys(curves)
          .filter(isNumericAU)
          .map((id) => Number(id))
      );

      const getAxisBinding = (
        nodeKey: BoneKey,
        axisConfig: RotationAxis | null | undefined,
        axisValue: number,
        t: number
      ) => {
        return getCompositeAxisBinding(
          nodeKey,
          axisConfig,
          axisValue,
          (auId: number) => getAxisSampleForNode(auId, nodeKey, t),
          config.auToBones
        );
      };

      const getAxisSampleForNode = (
        auId: number,
        nodeKey: BoneKey,
        t: number
      ) => {
        const rawValue = sampleCurve(String(auId), t);
        if (rawValue <= 1e-6) return 0;

        const binding = config.auToBones[auId]?.find((b) => b.node === nodeKey) ?? null;
        if (!binding?.side) return rawValue;

        const curveBalance = resolveCurveBalance(String(auId), globalBalance, balanceMap);
        return rawValue * getSideScale(curveBalance, binding.side);
      };

      const getAxisValue = (
        nodeKey: BoneKey,
        axisConfig: RotationAxis | null | undefined,
        t: number
      ) =>
        getCompositeAxisValue(axisConfig, (auId: number) => getAxisSampleForNode(auId, nodeKey, t));

      // Track if autoVisemeJaw already added a JAW track
      const autoVisemeJawHandledJaw =
        autoVisemeJaw &&
        jawScale > 0 &&
        visemeJawAmounts &&
        options?.snippetCategory === 'visemeSnippet';

      for (const composite of compositeRotations) {
        const nodeKey = composite.node as BoneKey;

        // Skip JAW composite if autoVisemeJaw already handled it
        if (nodeKey === 'JAW' && autoVisemeJawHandledJaw) {
          continue;
        }

        const entry = bones[nodeKey];
        if (!entry) {
          console.log(`[snippetToClip] Skipping composite for "${nodeKey}" - bone not resolved`);
          continue;
        }

        const hasRelevantAU = [composite.pitch, composite.yaw, composite.roll]
          .filter(Boolean)
          .some((axisConfig) => axisConfig!.aus.some((auId) => hasCurveAU.has(auId)));

        if (!hasRelevantAU) {
          continue;
        }

        const values: number[] = [];

        for (const t of keyframeTimes) {
          const compositeQ = new Quaternion().copy(entry.baseQuat);

          const applyAxis = (
            axisConfig: RotationAxis | null | undefined
          ) => {
            if (!axisConfig) return;
            let axisValue = getAxisValue(nodeKey, axisConfig, t);
            if (Math.abs(axisValue) <= 1e-6) return;

            const binding = getAxisBinding(nodeKey, axisConfig, axisValue, t);
            if (!binding?.maxDegrees || !binding.channel) return;

            const radians = (binding.maxDegrees * Math.PI / 180) * Math.abs(axisValue) * binding.scale;
            const axis = binding.channel === 'rx' ? X_AXIS : binding.channel === 'ry' ? Y_AXIS : Z_AXIS;
            const deltaQ = new Quaternion().setFromAxisAngle(axis, radians);
            compositeQ.multiply(deltaQ);
          };

          applyAxis(composite.yaw);
          applyAxis(composite.pitch);
          applyAxis(composite.roll);

          values.push(compositeQ.x, compositeQ.y, compositeQ.z, compositeQ.w);
        }

        const trackName = `${entry.obj.uuid}.quaternion`;
        tracks.push(new QuaternionKeyframeTrack(trackName, keyframeTimes, values));
      }

      for (const curveId of Object.keys(curves)) {
        if (!isNumericAU(curveId)) continue;
        const auId = Number(curveId);
        const bindings = config.auToBones[auId] || [];
        const curve = curves[curveId];
        if (!curve || curve.length === 0) continue;

        for (const binding of bindings) {
          if (binding.channel !== 'tx' && binding.channel !== 'ty' && binding.channel !== 'tz') continue;
          const entry = bones[binding.node as BoneKey];
          if (!entry || binding.maxUnits === undefined) continue;

          const axisIndex: 'x' | 'y' | 'z' = binding.channel === 'tx' ? 'x' : binding.channel === 'ty' ? 'y' : 'z';
          const basePos = entry.basePos[axisIndex];
          const values: number[] = [];

          for (const t of keyframeTimes) {
            const v = sampleCurve(curveId, t);
            const delta = v * binding.maxUnits * binding.scale;
            values.push(basePos + delta);
          }

          const trackName = `${entry.obj.uuid}.position[${axisIndex}]`;
          tracks.push(new NumberKeyframeTrack(trackName, keyframeTimes, values));
        }
      }
    }

    if (tracks.length === 0) {
      console.warn(`[Loom3] snippetToClip: No tracks created for "${clipName}"`);
      return null;
    }

    const clip = new AnimationClip(clipName, maxTime, tracks);
    this.setClipEventMetadata(clip, { keyframeTimes });
    console.log(`[Loom3] snippetToClip: Created clip "${clipName}" with ${tracks.length} tracks, duration ${maxTime.toFixed(2)}s`);

    return clip;
  }

  playClip(clip: AnimationClip, options?: ClipOptions): ClipHandle | null {
    this.ensureMixer();

    if (!this.animationMixer) {
      console.warn('[Loom3] playClip: No model loaded, cannot create mixer');
      return null;
    }

    const playbackState = this.mergePlaybackOptions(
      this.getPlaybackStateSnapshot(clip.name, {
        loop: false,
        source: options?.source ?? 'clip',
      }),
      options
    );
    const startTime = this.resolveStartTime(clip.duration, playbackState, options?.startTime);

    let action = this.clipActions.get(clip.name);
    let actionId = this.getActionId(action);
    if (action && !actionId) {
      actionId = this.setActionId(action, clip.name);
    }
    if (!action) {
      action = this.animationMixer.clipAction(clip);
      actionId = this.setActionId(action, clip.name);
    }

    const existingClip = this.animationClips.find(c => c.name === clip.name);
    if (!existingClip) {
      this.animationClips.push(clip);
    }
    this.applyPlaybackState(action, playbackState);

    if (actionId) {
      this.cleanupClipMonitor(actionId);
    }

    let resolveFinished!: () => void;
    const finishedPromise = new Promise<void>((resolve) => {
      resolveFinished = resolve;
    });
    const keyframeTimes = this.getClipEventMetadata(clip).keyframeTimes;
    const initialDirection: 1 | -1 = playbackState.reverse ? -1 : 1;
    const monitor: ClipMonitor = {
      action,
      actionId: actionId!,
      clip,
      clipName: clip.name,
      duration: clip.duration,
      keyframeTimes,
      listeners: new Set<ClipEventListener>(),
      initialDirection,
      direction: initialDirection,
      iteration: 0,
      lastTime: Math.max(0, Math.min(clip.duration, action.time)),
      lastKeyframeIndex: this.getKeyframeIndex(keyframeTimes, action.time),
      loopMode: playbackState.loopMode,
      finishedPending: false,
      cleanedUp: false,
      resolveFinished,
    };
    this.clipMonitors.set(actionId!, monitor);

    action.reset();
    action.time = startTime;
    action.play();
    this.resetClipMonitor(monitor, action.time);

    this.clipActions.set(clip.name, action);
    this.animationActions.set(clip.name, action);
    this.setPlaybackState(clip.name, playbackState);
    console.log(`[Loom3] playClip: Playing "${clip.name}" (rate: ${playbackState.playbackRate}, loop: ${playbackState.loop}, actionId: ${actionId})`);

    const handle: ClipHandle = {
      clipName: clip.name,
      actionId,

      play: () => {
        action.reset();
        action.time = this.resolveStartTime(
          clip.duration,
          this.getPlaybackStateSnapshot(clip.name, {
            loop: false,
            source: this.clipSources.get(clip.name) ?? playbackState.source,
          })
        );
        action.play();
        this.resetClipMonitor(monitor, action.time);
      },

      stop: () => {
        action.stop();
        // Fully remove action from mixer to prevent accumulation and weight blending issues
        if (this.animationMixer) {
          try { this.animationMixer.uncacheAction(clip); } catch {}
          try { this.animationMixer.uncacheClip(clip); } catch {}
        }
        this.clipActions.delete(clip.name);
        this.animationActions.delete(clip.name);
        this.animationFinishedCallbacks.delete(clip.name);
        this.playbackState.delete(clip.name);
        this.cleanupClipMonitor(actionId!);
      },

      pause: () => {
        action.paused = true;
      },

      resume: () => {
        action.paused = false;
      },

      setWeight: (w: number) => {
        const next = this.playbackState.get(clip.name) ?? playbackState;
        next.weight = typeof w === 'number' && Number.isFinite(w) ? Math.max(0, w) : 1.0;
        action.setEffectiveWeight(next.weight);
        this.setPlaybackState(clip.name, next);
      },

      setPlaybackRate: (r: number) => {
        const next = this.playbackState.get(clip.name) ?? playbackState;
        next.playbackRate = Number.isFinite(r) ? Math.max(0, Math.abs(r)) : 1.0;
        this.applyPlaybackState(action, next);
        monitor.direction = next.reverse ? -1 : 1;
        monitor.initialDirection = monitor.direction;
        this.setPlaybackState(clip.name, next);
      },

      setLoop: (mode: 'once' | 'repeat' | 'pingpong', repeatCount?: number) => {
        const next = this.playbackState.get(clip.name) ?? playbackState;
        next.loopMode = mode;
        next.loop = mode !== 'once';
        next.repeatCount = repeatCount;
        this.applyPlaybackState(action, next);
        monitor.loopMode = mode;
        this.setPlaybackState(clip.name, next);
      },

      setTime: (t: number) => {
        const clamped = Math.max(0, Math.min(clip.duration, t));
        action.time = clamped;
        try { this.animationMixer?.update(0); } catch {}
        this.syncClipMonitorTime(monitor, clamped, true);
      },

      getTime: () => action.time,

      getDuration: () => clip.duration,

      subscribe: (listener: ClipEventListener) => {
        monitor.listeners.add(listener);
        return () => {
          monitor.listeners.delete(listener);
        };
      },

      finished: finishedPromise,
    };
    this.clipHandles.set(clip.name, handle);

    return handle;
  }

  playSnippet(
    snippet: Snippet | { name: string; curves: CurvesMap },
    options?: ClipOptions
  ): ClipHandle | null {
    const clip = this.snippetToClip(snippet.name, snippet.curves, options);
    if (!clip) {
      return null;
    }
    return this.playClip(clip, { ...options, source: options?.source ?? 'snippet' });
  }

  buildClip(
    clipName: string,
    curves: CurvesMap,
    options?: ClipOptions
  ): ClipHandle | null {
    const clip = this.snippetToClip(clipName, curves, options);
    if (!clip) {
      return null;
    }
    return this.playClip(clip, { ...options, source: options?.source ?? 'clip' });
  }

  cleanupSnippet(name: string) {
    if (!this.animationMixer || !this.host.getModel()) return;
    for (const [clipName, action] of Array.from(this.clipActions.entries())) {
      if (clipName === name || clipName.startsWith(`${name}_`)) {
        const actionId = this.getActionId(action);
        try {
          action.stop();
          // Fully remove action from mixer to prevent accumulation
          const clip = action.getClip();
          if (clip) {
            this.animationMixer.uncacheAction(clip);
            this.animationMixer.uncacheClip(clip);
          }
        } catch {}
        this.clipActions.delete(clipName);
        this.animationActions.delete(clipName);
        this.clipHandles.delete(clipName);
        this.animationFinishedCallbacks.delete(clipName);
        this.playbackState.delete(clipName);
        if (actionId) this.cleanupClipMonitor(actionId);
      }
    }
  }

  updateClipParams(name: string, params: { weight?: number; rate?: number; loop?: boolean; loopMode?: 'once' | 'repeat' | 'pingpong'; repeatCount?: number; reverse?: boolean; actionId?: string }): boolean {
    let updated = false;
    const matches = (clipName: string, action?: AnimationAction | null) => {
      if (params.actionId) {
        const aid = action ? this.actionIds.get(action) : this.actionIdToClip.get(params.actionId);
        if (aid && aid === params.actionId) return true;
      }
      return clipName === name || clipName.startsWith(`${name}_`) || clipName.includes(name);
    };

    const debugSnapshot = () => ({
      target: name,
      params,
      clipActions: Array.from(this.clipActions.entries()).map(([k, a]) => ({ name: k, actionId: this.getActionId(a) })),
      animationActions: Array.from(this.animationActions.entries()).map(([k, a]) => ({ name: k, actionId: this.getActionId(a) })),
      clipHandles: Array.from(this.clipHandles.entries()).map(([k, h]) => ({ name: k, actionId: h.actionId })),
      mixerActions: (this.animationMixer?._actions || []).map((a: AnimationAction) => ({ name: a?.getClip?.()?.name || '', actionId: this.getActionId(a) })),
    });

    console.log('[Loom3] updateClipParams start', debugSnapshot());

    const apply = (action: AnimationAction | null | undefined) => {
      if (!action) return;
      const actionId = this.getActionId(action);
      const monitor = actionId ? this.clipMonitors.get(actionId) : undefined;
      const clipName = action.getClip().name;
      const next = this.playbackState.get(clipName)
        ?? this.normalizePlaybackOptions(undefined, { loop: false, source: this.clipSources.get(clipName) ?? 'clip' });
      try { action.paused = false; } catch {}
      if (typeof params.weight === 'number' && Number.isFinite(params.weight)) {
        action.setEffectiveWeight(params.weight);
        next.weight = Math.max(0, params.weight);
        updated = true;
      }
      if (typeof params.rate === 'number' && Number.isFinite(params.rate)) {
        next.playbackRate = Math.max(0, Math.abs(params.rate));
        if (typeof params.reverse === 'boolean') {
          next.reverse = params.reverse;
        }
        const signedRate = next.reverse ? -next.playbackRate : next.playbackRate;
        action.setEffectiveTimeScale(signedRate);
        if (monitor) {
          monitor.direction = next.reverse ? -1 : 1;
          monitor.initialDirection = monitor.direction;
        }
        updated = true;
      }
      if (typeof params.loop === 'boolean' || params.loopMode || params.repeatCount !== undefined) {
        next.loopMode = params.loopMode || (params.loop ? 'repeat' : 'once');
        next.loop = next.loopMode !== 'once';
        next.repeatCount = params.repeatCount;
        this.applyPlaybackState(action, next);
        if (monitor) monitor.loopMode = next.loopMode;
        updated = true;
      }
      this.setPlaybackState(clipName, next);
    };

    for (const [clipName, action] of this.clipActions.entries()) {
      if (matches(clipName, action)) {
        apply(action);
      }
    }
    for (const [clipName, action] of this.animationActions.entries()) {
      if (matches(clipName, action)) {
        apply(action);
      }
    }

    if (!updated && params.actionId) {
      const clipName = this.actionIdToClip.get(params.actionId);
      if (clipName) {
        const action = this.clipActions.get(clipName) || this.animationActions.get(clipName);
        if (action) apply(action);
      }
    }

    console.log('[Loom3] updateClipParams end', debugSnapshot());
    return updated;
  }

  private addMorphTracks(
    tracks: Array<NumberKeyframeTrack | QuaternionKeyframeTrack>,
    morphKey: string,
    keyframes: Array<{ time: number; intensity: number }>,
    intensityScale: number,
    meshNames?: string[]
  ): void {
    const config = this.host.getConfig();
    const hasExplicitMeshes = meshNames !== undefined;
    const targetMeshNames = hasExplicitMeshes ? meshNames : (config.morphToMesh?.face || []);
    const targetMeshes = targetMeshNames.length
      ? targetMeshNames.map((name) => this.host.getMeshByName(name)).filter(Boolean) as Mesh[]
      : [];

    const addTrackForMesh = (mesh: Mesh) => {
      const dict = mesh.morphTargetDictionary;
      if (!dict || dict[morphKey] === undefined) return;

      const morphIndex = dict[morphKey];

      const times: number[] = [];
      const values: number[] = [];

      for (const kf of keyframes) {
        times.push(kf.time);
        values.push(Math.max(0, Math.min(2, kf.intensity * intensityScale)));
      }

      const trackName = `${mesh.uuid}.morphTargetInfluences[${morphIndex}]`;
      const track = new NumberKeyframeTrack(trackName, times, values);

      tracks.push(track);
    };

    for (const mesh of targetMeshes) {
      addTrackForMesh(mesh);
    }
  }

  private addMorphIndexTracks(
    tracks: Array<NumberKeyframeTrack | QuaternionKeyframeTrack>,
    morphIndex: number,
    keyframes: Array<{ time: number; intensity: number }>,
    intensityScale: number,
    meshNames?: string[]
  ): void {
    if (!Number.isInteger(morphIndex) || morphIndex < 0) return;
    const config = this.host.getConfig();
    const hasExplicitMeshes = meshNames !== undefined;
    const targetMeshNames = hasExplicitMeshes ? meshNames : (config.morphToMesh?.face || []);
    const targetMeshes = targetMeshNames.length
      ? targetMeshNames.map((name) => this.host.getMeshByName(name)).filter(Boolean) as Mesh[]
      : [];

    const addTrackForMesh = (mesh: Mesh) => {
      const infl = mesh.morphTargetInfluences;
      if (!infl || morphIndex < 0 || morphIndex >= infl.length) return;

      const times: number[] = [];
      const values: number[] = [];

      for (const kf of keyframes) {
        times.push(kf.time);
        values.push(Math.max(0, Math.min(2, kf.intensity * intensityScale)));
      }

      const trackName = `${mesh.uuid}.morphTargetInfluences[${morphIndex}]`;
      const track = new NumberKeyframeTrack(trackName, times, values);

      tracks.push(track);
    };

    for (const mesh of targetMeshes) {
      addTrackForMesh(mesh);
    }
  }

  private ensureMixer(): AnimationMixer | null {
    const model = this.host.getModel();
    if (!model) return null;

    if (!this.animationMixer) {
      this.animationMixer = new AnimationMixer(model);
    }

    if (this.animationMixer && !this.mixerFinishedListenerAttached) {
      this.animationMixer.addEventListener('finished', (event: any) => {
        const action = event.action as AnimationAction;
        const actionId = this.getActionId(action);
        if (actionId) {
          const monitor = this.clipMonitors.get(actionId);
          if (monitor) {
            monitor.finishedPending = true;
            return;
          }
        }
        const clip = action.getClip();
        const bakedRuntime = this.bakedRuntimeClipToSource.get(clip.name);
        if (bakedRuntime) {
          const group = this.bakedActionGroups.get(bakedRuntime.sourceClipName);
          if (group && group.pendingFinishedChannels.delete(bakedRuntime.channel) && group.pendingFinishedChannels.size === 0) {
            group.resolveFinished();
          }
          return;
        }
        const callback = this.animationFinishedCallbacks.get(clip.name);
        if (callback) {
          callback();
          this.animationFinishedCallbacks.delete(clip.name);
        }
      });
      this.mixerFinishedListenerAttached = true;
    }

    return this.animationMixer;
  }

  private createAnimationHandle(
    clipName: string,
    action: AnimationAction,
    finishedPromise: Promise<void>
  ): AnimationActionHandle {
    return {
      actionId: this.getActionId(action),
      stop: () => this.stopAnimation(clipName),
      pause: () => this.pauseAnimation(clipName),
      resume: () => this.resumeAnimation(clipName),
      setSpeed: (speed: number) => this.setAnimationSpeed(clipName, speed),
      setWeight: (weight: number) => this.setAnimationIntensity(clipName, weight),
      seekTo: (time: number) => this.seekAnimation(clipName, time),
      getState: () => this.getAnimationState(clipName)!,
      crossfadeTo: (targetClip: string, dur?: number) => this.crossfadeTo(targetClip, dur),
      finished: finishedPromise,
    };
  }

  private createBakedAnimationHandle(
    clipName: string,
    group: BakedActionGroup
  ): AnimationActionHandle {
    return {
      actionId: group.actionId,
      stop: () => this.stopAnimation(clipName),
      pause: () => this.pauseAnimation(clipName),
      resume: () => this.resumeAnimation(clipName),
      setSpeed: (speed: number) => this.setAnimationSpeed(clipName, speed),
      setWeight: (weight: number) => this.setAnimationIntensity(clipName, weight),
      seekTo: (time: number) => this.seekAnimation(clipName, time),
      getState: () => this.getAnimationState(clipName)!,
      crossfadeTo: (targetClip: string, dur?: number) => this.crossfadeTo(targetClip, dur),
      finished: group.finishedPromise,
    };
  }
}
