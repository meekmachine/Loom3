/**
 * AnimationThree - Lerp-based animation driver
 *
 * Internal driver for time-based interpolation with easing functions.
 */

import {
  AnimationMixer,
  AnimationAction,
  AnimationClip,
  AnimationUtils,
  KeyframeTrack,
  NumberKeyframeTrack,
  QuaternionKeyframeTrack,
  AdditiveAnimationBlendMode,
  LoopRepeat,
  LoopPingPong,
  LoopOnce,
  NormalAnimationBlendMode,
  PropertyBinding,
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
  ClipHandle,
  Snippet,
  BoneKey,
  CompositeRotation,
  RotationAxis,
  AnimationSource,
  AnimationBlendMode,
  AnimationBlendModeFallbackReason,
  AnimationEasing,
} from '../../core/types';
import { getCompositeAxisBinding, getCompositeAxisValue } from '../../core/compositeAxis';
import type { Profile } from '../../mappings/types';
import type { ResolvedBones } from './types';
import { getSideScale, resolveCurveBalance } from './balanceUtils';

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
  reapplyProceduralState?: () => void;
}

// Lightweight unique id for mixer actions/handles
const makeActionId = () => `act_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
const X_AXIS = new Vector3(1, 0, 0);
const Y_AXIS = new Vector3(0, 1, 0);
const Z_AXIS = new Vector3(0, 0, 1);

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

type AdditiveSupport = {
  supported: boolean;
  reason?: AnimationBlendModeFallbackReason;
  unsupportedTracks?: string[];
  keepTracks: KeyframeTrack[];
  ignoredTracks: string[];
};

export class BakedAnimationController {
  private host: BakedAnimationHost;
  private animationMixer: AnimationMixer | null = null;
  private mixerFinishedListenerAttached = false;
  private animationClips: AnimationClip[] = [];
  private animationActions = new Map<string, AnimationAction>();
  private animationFinishedCallbacks = new Map<string, () => void>();
  private clipActions = new Map<string, AnimationAction>();
  private clipHandles = new Map<string, ClipHandle>();
  private clipSources = new Map<string, AnimationSource>();
  private playbackState = new Map<string, NormalizedPlaybackState>();
  private additiveSupport = new Map<string, AdditiveSupport>();
  private additiveClipCache = new Map<string, AnimationClip>();
  private actionIds = new WeakMap<AnimationAction, string>();
  private actionIdToClip = new Map<string, string>();

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

  private clearActionId(action?: AnimationAction | null): void {
    if (!action) return;
    const actionId = this.getActionId(action);
    if (actionId) {
      this.actionIdToClip.delete(actionId);
    }
    this.actionIds.delete(action);
    delete action.__actionId;
  }

  private uncacheAction(action?: AnimationAction | null): void {
    if (!action || !this.animationMixer) return;
    try {
      const clip = action.getClip();
      if (clip) {
        this.animationMixer.uncacheAction(clip);
        this.animationMixer.uncacheClip(clip);
      }
    } catch {}
  }

  private releaseAction(action?: AnimationAction | null): void {
    if (!action) return;
    try {
      action.stop();
    } catch {}
    this.uncacheAction(action);
    this.clearActionId(action);
  }

  private getBakedClip(clipName: string): AnimationClip | null {
    return this.animationClips.find((entry) => entry.name === clipName) ?? null;
  }

  private resolveTrackTarget(
    model: Object3D,
    parsed: ReturnType<typeof PropertyBinding.parseTrackName>
  ): Object3D | null {
    const targetKey = parsed.objectName === 'bones' && parsed.objectIndex
      ? parsed.objectIndex
      : parsed.nodeName;
    if (!targetKey) {
      return null;
    }
    return model.getObjectByProperty('uuid', targetKey)
      ?? PropertyBinding.findNode(model, targetKey)
      ?? null;
  }

  private clearFilteredAdditiveClip(clipName: string): void {
    const clip = this.additiveClipCache.get(clipName);
    if (!clip) return;
    if (this.animationMixer) {
      try {
        this.animationMixer.uncacheClip(clip);
      } catch {}
    }
    this.additiveClipCache.delete(clipName);
  }

  private clearAllFilteredAdditiveClips(): void {
    for (const clipName of Array.from(this.additiveClipCache.keys())) {
      this.clearFilteredAdditiveClip(clipName);
    }
  }

  private getMorphTrackBaseValue(
    target: Object3D | null,
    propertyIndex: string | number | undefined
  ): number {
    if (!target) {
      return 0;
    }

    const meshTarget = target as Mesh & {
      morphTargetInfluences?: number[];
      morphTargetDictionary?: Record<string, number>;
    };
    const influences = meshTarget.morphTargetInfluences;
    if (!influences) {
      return 0;
    }

    let morphIndex: number | undefined;
    if (typeof propertyIndex === 'number' && Number.isInteger(propertyIndex)) {
      morphIndex = propertyIndex;
    } else if (typeof propertyIndex === 'string') {
      if (/^\d+$/.test(propertyIndex)) {
        morphIndex = Number(propertyIndex);
      } else {
        morphIndex = meshTarget.morphTargetDictionary?.[propertyIndex];
      }
    }

    if (morphIndex === undefined) {
      return 0;
    }

    return influences[morphIndex] ?? 0;
  }

  private createAdditiveReferenceTrack(
    track: KeyframeTrack,
    model: Object3D
  ): KeyframeTrack | null {
    const trackName = typeof track?.name === 'string' ? track.name : '';
    if (!trackName) {
      return null;
    }

    let parsed: ReturnType<typeof PropertyBinding.parseTrackName>;
    try {
      parsed = PropertyBinding.parseTrackName(trackName);
    } catch {
      return null;
    }

    const target = this.resolveTrackTarget(model, parsed);
    if (parsed.propertyName === 'morphTargetInfluences') {
      return new NumberKeyframeTrack(
        track.name,
        [0],
        [this.getMorphTrackBaseValue(target, parsed.propertyIndex)]
      );
    }

    return null;
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

  private analyzeAdditiveSupport(clip: AnimationClip): AdditiveSupport {
    if (!this.host.getModel()) {
      return {
        supported: false,
        reason: 'unsafe_baked_additive_tracks',
        keepTracks: [],
        ignoredTracks: [],
      };
    }

    const keepTracks: KeyframeTrack[] = [];
    const ignoredTracks: string[] = [];

    for (const track of clip.tracks) {
      const trackName = typeof track?.name === 'string' ? track.name : '';
      if (!trackName) {
        ignoredTracks.push('[unknown]');
        continue;
      }

      let parsed: ReturnType<typeof PropertyBinding.parseTrackName>;
      try {
        parsed = PropertyBinding.parseTrackName(trackName);
      } catch {
        ignoredTracks.push(trackName);
        continue;
      }

      if (parsed.propertyName === 'morphTargetInfluences') {
        keepTracks.push(track);
        continue;
      }

      ignoredTracks.push(trackName);
    }

    if (keepTracks.length > 0) {
      return {
        supported: true,
        keepTracks,
        ignoredTracks,
      };
    }

    return {
      supported: false,
      reason: 'unsafe_baked_additive_tracks',
      unsupportedTracks: ignoredTracks,
      keepTracks,
      ignoredTracks,
    };
  }

  private getAdditiveSupport(clipName: string, clip?: AnimationClip | null): AdditiveSupport {
    const cached = this.additiveSupport.get(clipName);
    if (cached) {
      return cached;
    }

    const resolvedClip = clip ?? this.animationClips.find((entry) => entry.name === clipName);
    if (!resolvedClip) {
      return {
        supported: false,
        keepTracks: [],
        ignoredTracks: [],
      };
    }

    const support = this.analyzeAdditiveSupport(resolvedClip);
    this.additiveSupport.set(clipName, support);
    return support;
  }

  private getOrCreateFilteredAdditiveClip(
    clipName: string,
    clip: AnimationClip
  ): AnimationClip | null {
    const cached = this.additiveClipCache.get(clipName);
    if (cached) {
      return cached;
    }

    const support = this.getAdditiveSupport(clipName, clip);
    if (!support.supported || support.keepTracks.length === 0) {
      return null;
    }

    const model = this.host.getModel();
    if (!model) {
      return null;
    }
    const additiveClip = new AnimationClip(
      `${clip.name}__loom3_additive_filtered`,
      clip.duration,
      support.keepTracks.map((track) => track.clone())
    );
    const referenceTracks = support.keepTracks
      .map((track) => this.createAdditiveReferenceTrack(track, model))
      .filter((track): track is KeyframeTrack => !!track);
    const referenceClip = new AnimationClip(
      `${clip.name}__loom3_additive_reference`,
      0,
      referenceTracks
    );
    AnimationUtils.makeClipAdditive(additiveClip, 0, referenceClip);
    this.additiveClipCache.set(clipName, additiveClip);
    return additiveClip;
  }

  private sanitizeBakedBlendMode(
    clipName: string,
    state: NormalizedPlaybackState,
    clip?: AnimationClip | null
  ): NormalizedPlaybackState {
    if (state.source !== 'baked' || state.requestedBlendMode !== 'additive') {
      return {
        ...state,
        blendMode: state.requestedBlendMode,
      };
    }

    const bakedClip = clip ?? this.getBakedClip(clipName);
    const support = this.getAdditiveSupport(clipName, bakedClip);
    if (bakedClip && support.supported && this.getOrCreateFilteredAdditiveClip(clipName, bakedClip)) {
      return {
        ...state,
        blendMode: 'additive',
      };
    }

    console.warn(
      `[Loom3] Baked clip "${clipName}" does not support additive playback; falling back to replace.` +
      (support.reason ? ` ${support.reason}.` : '') +
      (support.unsupportedTracks?.length
        ? ` Unsupported tracks: ${support.unsupportedTracks.slice(0, 8).join(', ')}.`
        : '')
    );

    return {
      ...state,
      blendMode: 'replace',
    };
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

  private getOrCreateBakedAction(
    clipName: string,
    blendMode: AnimationBlendMode = this.getPlaybackStateSnapshot(clipName, {
      loop: true,
      source: 'baked',
    }).blendMode
  ): AnimationAction | null {
    const clip = this.getBakedClip(clipName);
    if (!clip || (this.clipSources.get(clipName) ?? 'baked') !== 'baked') {
      return null;
    }

    const desiredClip = blendMode === 'additive'
      ? this.getOrCreateFilteredAdditiveClip(clipName, clip)
      : clip;
    if (!desiredClip) {
      return null;
    }

    const existing = this.animationActions.get(clipName);
    if (existing?.getClip() === desiredClip) {
      return existing;
    }

    this.ensureMixer();
    if (!this.animationMixer) {
      return null;
    }

    if (existing) {
      this.releaseAction(existing);
    }

    const action = this.animationMixer.clipAction(desiredClip);
    if (!this.getActionId(action)) {
      this.setActionId(action, clipName);
    }
    this.animationActions.set(clipName, action);
    return action;
  }

  private hasActiveAdditivePlayback(): boolean {
    for (const [clipName, action] of this.animationActions) {
      const state = this.playbackState.get(clipName);
      if (state?.blendMode !== 'additive') {
        continue;
      }
      if (!action.isRunning() || action.paused) {
        continue;
      }
      if (action.getEffectiveWeight() <= 1e-6) {
        continue;
      }
      return true;
    }
    return false;
  }

  private getMeshNamesForAU(auId: number, config: Profile, explicitMeshNames?: string[]): string[] {
    if (explicitMeshNames && explicitMeshNames.length > 0) {
      return explicitMeshNames;
    }

    if (typeof this.host.getMeshNamesForAU === 'function') {
      return this.host.getMeshNamesForAU(auId) || [];
    }

    const facePart = config.auInfo?.[String(auId)]?.facePart;
    if (facePart) {
      const category = config.auFacePartToMeshCategory?.[facePart];
      if (category) return config.morphToMesh?.[category] || [];
    }
    return config.morphToMesh?.face || [];
  }

  private getMeshNamesForViseme(config: Profile, explicitMeshNames?: string[]): string[] {
    if (explicitMeshNames && explicitMeshNames.length > 0) {
      return explicitMeshNames;
    }

    if (typeof this.host.getMeshNamesForViseme === 'function') {
      return this.host.getMeshNamesForViseme() || [];
    }

    const category = config.visemeMeshCategory || (config.morphToMesh?.viseme ? 'viseme' : 'face');
    const visemeMeshes = config.morphToMesh?.[category];
    if (visemeMeshes && visemeMeshes.length > 0) return visemeMeshes;
    return config.morphToMesh?.face || [];
  }

  update(dtSeconds: number): void {
    if (this.animationMixer) {
      this.animationMixer.update(dtSeconds);
      if (this.hasActiveAdditivePlayback()) {
        this.host.reapplyProceduralState?.();
      }
    }
  }

  dispose(): void {
    this.stopAllAnimations();
    for (const action of new Set([
      ...this.animationActions.values(),
      ...this.clipActions.values(),
    ])) {
      this.clearActionId(action);
    }
    this.clearAllFilteredAdditiveClips();
    if (this.animationMixer) {
      this.animationMixer.stopAllAction();
      this.animationMixer = null;
    }
    this.animationClips = [];
    this.animationActions.clear();
    this.animationFinishedCallbacks.clear();
    this.clipActions.clear();
    this.clipHandles.clear();
    this.clipSources.clear();
    this.playbackState.clear();
    this.additiveSupport.clear();
  }

  loadAnimationClips(clips: unknown[]): void {
    if (!this.host.getModel()) {
      console.warn('Loom3: Cannot load animation clips before calling onReady()');
      return;
    }

    this.ensureMixer();
    this.animationClips = clips as AnimationClip[];
    this.additiveSupport.clear();
    this.clearAllFilteredAdditiveClips();

    for (const clip of this.animationClips) {
      this.clipSources.set(clip.name, 'baked');
    }
  }

  getAnimationClips(): AnimationClipInfo[] {
    return this.animationClips.map(clip => ({
      name: clip.name,
      duration: clip.duration,
      trackCount: clip.tracks.length,
      source: this.clipSources.get(clip.name) ?? 'baked',
      supportsAdditive: this.getAdditiveSupport(clip.name, clip).supported,
      additiveModeReason: this.getAdditiveSupport(clip.name, clip).reason,
    }));
  }

  removeAnimationClip(clipName: string): boolean {
    const clip = this.getBakedClip(clipName);
    if (!clip || (this.clipSources.get(clipName) ?? 'baked') !== 'baked') {
      return false;
    }

    const relatedActions = new Set<AnimationAction>();
    const bakedAction = this.animationActions.get(clipName);
    const clipAction = this.clipActions.get(clipName);
    if (bakedAction) relatedActions.add(bakedAction);
    if (clipAction) relatedActions.add(clipAction);

    this.stopAnimation(clipName);

    for (const action of relatedActions) {
      this.releaseAction(action);
    }
    if (this.animationMixer) {
      try {
        this.animationMixer.uncacheClip(clip);
      } catch {}
    }
    this.clearFilteredAdditiveClip(clipName);

    this.animationClips = this.animationClips.filter((entry) => entry.name !== clipName);
    this.animationActions.delete(clipName);
    this.clipActions.delete(clipName);
    this.clipHandles.delete(clipName);
    this.animationFinishedCallbacks.delete(clipName);
    this.playbackState.delete(clipName);
    this.clipSources.delete(clipName);
    this.additiveSupport.delete(clipName);

    return true;
  }

  playAnimation(clipName: string, options: AnimationPlayOptions = {}): AnimationActionHandle | null {
    const clip = this.getBakedClip(clipName);
    if (!clip) {
      console.warn(`Loom3: Animation clip "${clipName}" not found`);
      return null;
    }

    const playbackState = this.sanitizeBakedBlendMode(
      clipName,
      this.mergePlaybackOptions(
        this.getPlaybackStateSnapshot(clipName, { loop: true, source: 'baked' }),
        options
      ),
      clip
    );
    const action = this.getOrCreateBakedAction(clipName, playbackState.blendMode);
    if (!action) {
      console.warn(`Loom3: Animation clip "${clipName}" not found`);
      return null;
    }
    const crossfadeDuration = options.crossfadeDuration ?? 0;
    const clampWhenFinished = options.clampWhenFinished ?? playbackState.loopMode === 'once';
    const startTime = this.resolveStartTime(clip.duration, playbackState, options.startTime);

    this.applyPlaybackState(action, playbackState);
    action.clampWhenFinished = clampWhenFinished;

    if (crossfadeDuration > 0) {
      action.reset();
      action.fadeIn(crossfadeDuration);
    } else {
      action.reset();
    }
    action.time = startTime;

    action.play();

    this.animationActions.set(clipName, action);
    this.setPlaybackState(clipName, playbackState);

    let resolveFinished: () => void;
    const finishedPromise = new Promise<void>((resolve) => {
      resolveFinished = resolve;
    });

    if (playbackState.loopMode === 'once') {
      this.animationFinishedCallbacks.set(clipName, () => resolveFinished());
    }

    return this.createAnimationHandle(clipName, action, finishedPromise);
  }

  stopAnimation(clipName: string): void {
    const action = this.animationActions.get(clipName);
    if (action) {
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
    }
    const clipAction = this.clipActions.get(clipName);
    if (clipAction && clipAction !== action) {
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
    }
    if (this.clipActions.get(clipName) === action) {
      this.clipActions.delete(clipName);
    }
    this.clipHandles.delete(clipName);
  }

  stopAllAnimations(): void {
    for (const clipName of new Set([
      ...this.animationActions.keys(),
      ...this.clipActions.keys(),
    ])) {
      this.stopAnimation(clipName);
    }
  }

  pauseAnimation(clipName: string): void {
    const action = this.animationActions.get(clipName);
    if (action) {
      action.paused = true;
    }
  }

  resumeAnimation(clipName: string): void {
    const action = this.animationActions.get(clipName);
    if (action) {
      action.paused = false;
    }
  }

  pauseAllAnimations(): void {
    for (const action of this.animationActions.values()) {
      if (action.isRunning()) {
        action.paused = true;
      }
    }
  }

  resumeAllAnimations(): void {
    for (const action of this.animationActions.values()) {
      if (action.paused) {
        action.paused = false;
      }
    }
  }

  setAnimationSpeed(clipName: string, speed: number): void {
    const next = this.getPlaybackStateSnapshot(clipName, {
      loop: true,
      source: this.clipSources.get(clipName) ?? 'baked',
    });
    const action = this.getOrCreateBakedAction(clipName, next.blendMode);
    if (!action) return;
    next.playbackRate = Number.isFinite(speed) ? Math.max(0, Math.abs(speed)) : 1.0;
    this.applyPlaybackState(action, next);
    this.setPlaybackState(clipName, next);
  }

  setAnimationIntensity(clipName: string, intensity: number): void {
    const next = this.getPlaybackStateSnapshot(clipName, {
      loop: true,
      source: this.clipSources.get(clipName) ?? 'baked',
    });
    const action = this.getOrCreateBakedAction(clipName, next.blendMode);
    if (!action) return;
    next.weight = Number.isFinite(intensity) ? Math.max(0, intensity) : 1.0;
    action.setEffectiveWeight(next.weight);
    this.setPlaybackState(clipName, next);
  }

  setAnimationLoopMode(clipName: string, loopMode: 'repeat' | 'once' | 'pingpong'): void {
    const next = this.getPlaybackStateSnapshot(clipName, {
      loop: true,
      source: this.clipSources.get(clipName) ?? 'baked',
    });
    const action = this.getOrCreateBakedAction(clipName, next.blendMode);
    if (!action) return;
    next.loopMode = loopMode;
    next.loop = loopMode !== 'once';
    this.applyPlaybackState(action, next);
    this.setPlaybackState(clipName, next);
  }

  setAnimationRepeatCount(clipName: string, repeatCount?: number): void {
    const next = this.getPlaybackStateSnapshot(clipName, {
      loop: true,
      source: this.clipSources.get(clipName) ?? 'baked',
    });
    const action = this.getOrCreateBakedAction(clipName, next.blendMode);
    if (!action) return;
    next.repeatCount = typeof repeatCount === 'number' && Number.isFinite(repeatCount)
      ? Math.max(0, repeatCount)
      : undefined;
    this.applyPlaybackState(action, next);
    this.setPlaybackState(clipName, next);
  }

  setAnimationReverse(clipName: string, reverse: boolean): void {
    const next = this.getPlaybackStateSnapshot(clipName, {
      loop: true,
      source: this.clipSources.get(clipName) ?? 'baked',
    });
    const action = this.getOrCreateBakedAction(clipName, next.blendMode);
    if (!action) return;
    next.reverse = !!reverse;
    this.applyPlaybackState(action, next);
    this.setPlaybackState(clipName, next);
  }

  setAnimationBlendMode(clipName: string, blendMode: AnimationBlendMode): void {
    const clip = this.getBakedClip(clipName);
    const currentAction = this.animationActions.get(clipName);
    if (!clip || !currentAction) return;

    const next = this.sanitizeBakedBlendMode(
      clipName,
      {
        ...this.getPlaybackStateSnapshot(clipName, {
          loop: true,
          source: this.clipSources.get(clipName) ?? 'baked',
        }),
        requestedBlendMode: blendMode,
        blendMode,
      },
      clip
    );
    const previousTime = currentAction.time;
    const wasRunning = currentAction.isRunning();
    const wasPaused = currentAction.paused;
    const action = this.getOrCreateBakedAction(clipName, next.blendMode);
    if (!action) return;

    this.applyPlaybackState(action, next);
    action.time = Math.max(0, Math.min(action.getClip().duration, previousTime));
    if (wasRunning) {
      action.play();
    }
    action.paused = wasPaused;
    this.setPlaybackState(clipName, next);
  }

  seekAnimation(clipName: string, time: number): void {
    const state = this.getPlaybackStateSnapshot(clipName, {
      loop: true,
      source: this.clipSources.get(clipName) ?? 'baked',
    });
    const action = this.getOrCreateBakedAction(clipName, state.blendMode) ?? this.animationActions.get(clipName);
    if (!action) return;
    const duration = action.getClip().duration;
    action.time = Math.max(0, Math.min(duration, Number.isFinite(time) ? time : 0));
    try {
      this.animationMixer?.update(0);
      if (state.blendMode === 'additive') {
        this.host.reapplyProceduralState?.();
      }
    } catch {}
  }

  setAnimationTimeScale(timeScale: number): void {
    if (this.animationMixer) {
      this.animationMixer.timeScale = timeScale;
    }
  }

  getAnimationState(clipName: string): AnimationState | null {
    const action = this.animationActions.get(clipName);
    if (!action) return null;

    const clip = action.getClip();
    const state = this.playbackState.get(clipName);
    const additiveSupport = this.getAdditiveSupport(clipName, this.getBakedClip(clipName) ?? clip);
    const loopMode = state?.loopMode
      ?? (action.loop === LoopPingPong ? 'pingpong' : action.loop === LoopOnce ? 'once' : 'repeat');
    const playbackRate = state?.playbackRate ?? Math.abs(action.getEffectiveTimeScale());
    const reverse = state?.reverse ?? action.getEffectiveTimeScale() < 0;
    return {
      name: clipName,
      actionId: this.getActionId(action),
      source: state?.source ?? this.clipSources.get(clipName) ?? 'baked',
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
      supportsAdditive: additiveSupport.supported,
      additiveModeReason: additiveSupport.reason,
      easing: state?.easing ?? 'linear',
      loop: loopMode !== 'once',
      loopMode,
      repeatCount: state?.repeatCount,
      isLooping: loopMode !== 'once',
    };
  }

  getPlayingAnimations(): AnimationState[] {
    const playing: AnimationState[] = [];
    for (const [name, action] of this.animationActions) {
      if (action.isRunning()) {
        const state = this.getAnimationState(name);
        if (state) playing.push(state);
      }
    }
    return playing;
  }

  crossfadeTo(clipName: string, duration = 0.3, options: AnimationPlayOptions = {}): AnimationActionHandle | null {
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

    let resolveFinished: () => void;
    const finishedPromise = new Promise<void>((resolve) => {
      resolveFinished = resolve;
    });

    const cleanup = () => {
      try { this.animationFinishedCallbacks.delete(clip.name); } catch {}
      try { action.paused = true; } catch {}
    };

    this.animationFinishedCallbacks.set(clip.name, () => {
      resolveFinished();
      cleanup();
    });
    finishedPromise.catch(() => cleanup());

    action.reset();
    action.time = startTime;
    action.play();

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
        resolveFinished();
        cleanup();
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
        this.setPlaybackState(clip.name, next);
      },

      setLoop: (mode: 'once' | 'repeat' | 'pingpong', repeatCount?: number) => {
        const next = this.playbackState.get(clip.name) ?? playbackState;
        next.loopMode = mode;
        next.loop = mode !== 'once';
        next.repeatCount = repeatCount;
        this.applyPlaybackState(action, next);
        this.setPlaybackState(clip.name, next);
      },

      setTime: (t: number) => {
        const clamped = Math.max(0, Math.min(clip.duration, t));
        action.time = clamped;
        try { this.animationMixer?.update(0); } catch {}
      },

      getTime: () => action.time,

      getDuration: () => clip.duration,

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
        updated = true;
      }
      if (typeof params.loop === 'boolean' || params.loopMode || params.repeatCount !== undefined) {
        next.loopMode = params.loopMode || (params.loop ? 'repeat' : 'once');
        next.loop = next.loopMode !== 'once';
        next.repeatCount = params.repeatCount;
        this.applyPlaybackState(action, next);
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
    const hasExplicitMeshes = !!(meshNames && meshNames.length > 0);
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
    const hasExplicitMeshes = !!(meshNames && meshNames.length > 0);
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
        const clip = action.getClip();
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
}
