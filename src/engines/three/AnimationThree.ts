/**
 * AnimationThree - Lerp-based animation system
 *
 * Default implementation of the Animation interface.
 * Uses simple lerp interpolation with easing functions.
 */

import {
  AnimationMixer,
  AnimationAction,
  AnimationClip,
  NumberKeyframeTrack,
  QuaternionKeyframeTrack,
  LoopRepeat,
  LoopPingPong,
  LoopOnce,
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
} from '../../core/types';
import type { AUMappingConfig } from '../../mappings/types';
import type { Animation } from '../../interfaces/Animation';
import type { ResolvedBones } from './types';

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

export class AnimationThree implements Animation {
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
  getBones: () => ResolvedBones;
  getConfig: () => AUMappingConfig;
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

export class BakedAnimationController {
  private host: BakedAnimationHost;
  private animationMixer: AnimationMixer | null = null;
  private mixerFinishedListenerAttached = false;
  private animationClips: AnimationClip[] = [];
  private animationActions = new Map<string, AnimationAction>();
  private animationFinishedCallbacks = new Map<string, () => void>();
  private clipActions = new Map<string, AnimationAction>();
  private clipHandles = new Map<string, ClipHandle>();
  private actionIds = new WeakMap<AnimationAction, string>();
  private actionIdToClip = new Map<string, string>();

  constructor(host: BakedAnimationHost) {
    this.host = host;
  }

  update(dtSeconds: number): void {
    if (this.animationMixer) {
      this.animationMixer.update(dtSeconds);
    }
  }

  dispose(): void {
    this.stopAllAnimations();
    if (this.animationMixer) {
      this.animationMixer.stopAllAction();
      this.animationMixer = null;
    }
    this.animationClips = [];
    this.animationActions.clear();
    this.animationFinishedCallbacks.clear();
    this.clipActions.clear();
    this.clipHandles.clear();
  }

  loadAnimationClips(clips: unknown[]): void {
    if (!this.host.getModel()) {
      console.warn('Loom3: Cannot load animation clips before calling onReady()');
      return;
    }

    this.ensureMixer();
    this.animationClips = clips as AnimationClip[];

    for (const clip of this.animationClips) {
      if (!this.animationActions.has(clip.name) && this.animationMixer) {
        const action = this.animationMixer.clipAction(clip);
        this.animationActions.set(clip.name, action);
      }
    }
  }

  getAnimationClips(): AnimationClipInfo[] {
    return this.animationClips.map(clip => ({
      name: clip.name,
      duration: clip.duration,
      trackCount: clip.tracks.length,
    }));
  }

  playAnimation(clipName: string, options: AnimationPlayOptions = {}): AnimationActionHandle | null {
    const action = this.animationActions.get(clipName);
    if (!action) {
      console.warn(`Loom3: Animation clip "${clipName}" not found`);
      return null;
    }

    const {
      speed = 1.0,
      intensity = 1.0,
      loop = true,
      loopMode = 'repeat',
      crossfadeDuration = 0,
      clampWhenFinished = true,
      startTime = 0,
    } = options;

    action.setEffectiveTimeScale(speed);
    action.setEffectiveWeight(intensity);
    action.clampWhenFinished = clampWhenFinished;

    if (!loop || loopMode === 'once') {
      action.setLoop(LoopOnce, 1);
    } else if (loopMode === 'pingpong') {
      action.setLoop(LoopPingPong, Infinity);
    } else {
      action.setLoop(LoopRepeat, Infinity);
    }

    if (startTime > 0) {
      action.time = startTime;
    }

    if (crossfadeDuration > 0) {
      action.reset();
      action.fadeIn(crossfadeDuration);
    } else {
      action.reset();
    }

    action.play();

    this.animationActions.set(clipName, action);
    this.clipActions.set(clipName, action);

    let resolveFinished: () => void;
    const finishedPromise = new Promise<void>((resolve) => {
      resolveFinished = resolve;
    });

    if (!loop || loopMode === 'once') {
      this.animationFinishedCallbacks.set(clipName, () => resolveFinished());
    }

    return this.createAnimationHandle(clipName, action, finishedPromise);
  }

  stopAnimation(clipName: string): void {
    const action = this.animationActions.get(clipName);
    if (action) {
      action.stop();
      this.animationFinishedCallbacks.delete(clipName);
    }
    const clipAction = this.clipActions.get(clipName);
    if (clipAction && clipAction !== action) {
      try { clipAction.stop(); } catch {}
    }
  }

  stopAllAnimations(): void {
    for (const [name, action] of this.animationActions) {
      try { action.paused = true; } catch {}
      try { this.animationFinishedCallbacks.delete(name); } catch {}
    }
    for (const [name, action] of this.clipActions) {
      if (!this.animationActions.has(name)) {
        try { action.paused = true; } catch {}
      }
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
    const action = this.animationActions.get(clipName);
    if (action) {
      action.setEffectiveTimeScale(speed);
    }
  }

  setAnimationIntensity(clipName: string, intensity: number): void {
    const action = this.animationActions.get(clipName);
    if (action) {
      action.setEffectiveWeight(Math.max(0, Math.min(1, intensity)));
    }
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
    return {
      name: clip.name,
      isPlaying: action.isRunning() && !action.paused,
      isPaused: action.paused,
      time: action.time,
      duration: clip.duration,
      speed: action.getEffectiveTimeScale(),
      weight: action.getEffectiveWeight(),
      isLooping: action.loop !== LoopOnce,
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
    const balance = options?.balance ?? 0;
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
          const visemeKey = config.visemeKeys[auId];
          if (visemeKey) {
            this.addMorphTracks(tracks, visemeKey, keyframes, intensityScale);
          }
        } else {
          const morphsBySide = config.auToMorphs[auId];
          const mixWeight = this.host.isMixedAU(auId) ? this.host.getAUMixWeight(auId) : 1.0;

          const leftKeys = morphsBySide?.left ?? [];
          const rightKeys = morphsBySide?.right ?? [];
          const centerKeys = morphsBySide?.center ?? [];

          for (const morphKey of leftKeys) {
            let effectiveScale = intensityScale * mixWeight;
            if (balance > 0) effectiveScale *= (1 - balance);
            this.addMorphTracks(tracks, morphKey, keyframes, effectiveScale);
          }
          for (const morphKey of rightKeys) {
            let effectiveScale = intensityScale * mixWeight;
            if (balance < 0) effectiveScale *= (1 + balance);
            this.addMorphTracks(tracks, morphKey, keyframes, effectiveScale);
          }
          for (const morphKey of centerKeys) {
            const effectiveScale = intensityScale * mixWeight;
            this.addMorphTracks(tracks, morphKey, keyframes, effectiveScale);
          }
        }
      } else {
        this.addMorphTracks(tracks, curveId, keyframes, intensityScale);
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
        axisConfig: CompositeRotation['pitch'] | CompositeRotation['yaw'] | CompositeRotation['roll'],
        axisValue: number,
        t: number
      ) => {
        if (!axisConfig) return null;

        if (axisConfig.negative !== undefined && axisConfig.positive !== undefined) {
          const auId = axisValue < 0 ? axisConfig.negative : axisConfig.positive;
          return config.auToBones[auId]?.find((b) => b.node === nodeKey) ?? null;
        }

        if (axisConfig.aus.length > 1) {
          let maxAU = axisConfig.aus[0];
          let maxVal = sampleCurve(String(maxAU), t);
          for (const auId of axisConfig.aus) {
            const val = sampleCurve(String(auId), t);
            if (val > maxVal) {
              maxVal = val;
              maxAU = auId;
            }
          }
          return config.auToBones[maxAU]?.find((b) => b.node === nodeKey) ?? null;
        }

        const auId = axisConfig.aus[0];
        return config.auToBones[auId]?.find((b) => b.node === nodeKey) ?? null;
      };

      const getAxisValue = (
        axisConfig: CompositeRotation['pitch'] | CompositeRotation['yaw'] | CompositeRotation['roll'],
        t: number
      ) => {
        if (!axisConfig) return 0;

        if (axisConfig.negative !== undefined && axisConfig.positive !== undefined) {
          const posValue = sampleCurve(String(axisConfig.positive), t);
          const negValue = sampleCurve(String(axisConfig.negative), t);
          return posValue - negValue;
        }

        if (axisConfig.aus.length > 1) {
          let maxVal = 0;
          for (const auId of axisConfig.aus) {
            const val = sampleCurve(String(auId), t);
            if (val > maxVal) maxVal = val;
          }
          return maxVal;
        }

        return sampleCurve(String(axisConfig.aus[0]), t);
      };

      for (const composite of compositeRotations) {
        const nodeKey = composite.node as BoneKey;
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
            axisConfig: CompositeRotation['pitch'] | CompositeRotation['yaw'] | CompositeRotation['roll']
          ) => {
            if (!axisConfig) return;
            let axisValue = getAxisValue(axisConfig, t);
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

        const trackName = `${(entry.obj as any).uuid}.quaternion`;
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

          const trackName = `${(entry.obj as any).uuid}.position[${axisIndex}]`;
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

    const {
      loop = false,
      loopMode,
      reverse = false,
      playbackRate = 1.0,
      mixerWeight,
    } = options || {};

    let action = this.clipActions.get(clip.name);
    let actionId = action ? (this.actionIds.get(action) || (action as any).__actionId) : undefined;
    if (action && !actionId) {
      actionId = makeActionId();
      this.actionIds.set(action, actionId);
      this.actionIdToClip.set(actionId, clip.name);
      (action as any).__actionId = actionId;
    }
    if (!action) {
      action = this.animationMixer.clipAction(clip);
      actionId = makeActionId();
      this.actionIds.set(action, actionId);
      this.actionIdToClip.set(actionId, clip.name);
      (action as any).__actionId = actionId;
    }

    const existingClip = this.animationClips.find(c => c.name === clip.name);
    if (!existingClip) {
      this.animationClips.push(clip);
    }

    const timeScale = reverse ? -playbackRate : playbackRate;
    action.setEffectiveTimeScale(timeScale);
    const weight = typeof mixerWeight === 'number' ? mixerWeight : 1.0;
    action.setEffectiveWeight(weight);
    const mode = loopMode || (loop ? 'repeat' : 'once');
    action.clampWhenFinished = mode === 'once';

    if (mode === 'pingpong') {
      action.setLoop(LoopPingPong, Infinity);
    } else if (mode === 'once') {
      action.setLoop(LoopOnce, 1);
    } else {
      action.setLoop(LoopRepeat, Infinity);
    }

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
    action.play();

    this.clipActions.set(clip.name, action);
    this.animationActions.set(clip.name, action);
    console.log(`[Loom3] playClip: Playing "${clip.name}" (rate: ${playbackRate}, loop: ${loop}, actionId: ${actionId})`);

    const handle: ClipHandle = {
      clipName: clip.name,
      actionId,

      play: () => {
        action.reset();
        action.play();
      },

      stop: () => {
        action.stop();
        this.animationFinishedCallbacks.delete(clip.name);
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
        action.setEffectiveWeight(typeof w === 'number' && Number.isFinite(w) ? w : 1.0);
      },

      setPlaybackRate: (r: number) => {
        const rate = Number.isFinite(r) ? r : 1.0;
        action.setEffectiveTimeScale(rate);
      },

      setLoop: (mode: 'once' | 'repeat' | 'pingpong') => {
        if (mode === 'pingpong') {
          action.setLoop(LoopPingPong, Infinity);
        } else if (mode === 'once') {
          action.setLoop(LoopOnce, 1);
        } else {
          action.setLoop(LoopRepeat, Infinity);
        }
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
    return this.playClip(clip, options);
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
    return this.playClip(clip, options);
  }

  cleanupSnippet(name: string) {
    if (!this.animationMixer || !this.host.getModel()) return;
    for (const [clipName, action] of Array.from(this.clipActions.entries())) {
      if (clipName === name || clipName.startsWith(`${name}_`)) {
        try { action.paused = true; } catch {}
      }
    }
  }

  updateClipParams(name: string, params: { weight?: number; rate?: number; loop?: boolean; loopMode?: 'once' | 'repeat' | 'pingpong'; reverse?: boolean; actionId?: string }): boolean {
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
      clipActions: Array.from(this.clipActions.entries()).map(([k, a]) => ({ name: k, actionId: this.actionIds.get(a) || (a as any).__actionId })),
      animationActions: Array.from(this.animationActions.entries()).map(([k, a]) => ({ name: k, actionId: this.actionIds.get(a) || (a as any).__actionId })),
      clipHandles: Array.from(this.clipHandles.entries()).map(([k, h]) => ({ name: k, actionId: h.actionId })),
      mixerActions: ((this.animationMixer as any)?._actions || []).map((a: any) => ({ name: a?.getClip?.()?.name || '', actionId: this.actionIds.get(a) || (a as any).__actionId })),
    });

    console.log('[Loom3] updateClipParams start', debugSnapshot());

    const apply = (action: AnimationAction | null | undefined) => {
      if (!action) return;
      try { action.paused = false; } catch {}
      if (typeof params.weight === 'number' && Number.isFinite(params.weight)) {
        action.setEffectiveWeight(params.weight);
        updated = true;
      }
      if (typeof params.rate === 'number' && Number.isFinite(params.rate)) {
        const signedRate = params.reverse ? -params.rate : params.rate;
        action.setEffectiveTimeScale(signedRate);
        updated = true;
      }
      if (typeof params.loop === 'boolean' || params.loopMode) {
        const mode = params.loopMode || (params.loop ? 'repeat' : 'once');
        if (mode === 'pingpong') {
          action.setLoop(LoopPingPong, Infinity);
        } else if (mode === 'once') {
          action.setLoop(LoopOnce, 1);
        } else {
          action.setLoop(LoopRepeat, Infinity);
        }
        updated = true;
      }
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
    intensityScale: number
  ): void {
    const config = this.host.getConfig();
    const meshes = this.host.getMeshes();
    const targetMeshNames = config.morphToMesh?.face || [];
    const targetMeshes = targetMeshNames.length
      ? targetMeshNames.map((name) => this.host.getMeshByName(name)).filter(Boolean) as Mesh[]
      : meshes;
    let added = false;

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

      const trackName = `${(mesh as any).uuid}.morphTargetInfluences[${morphIndex}]`;
      const track = new NumberKeyframeTrack(trackName, times, values);

      tracks.push(track);
      added = true;
    };

    for (const mesh of targetMeshes) {
      addTrackForMesh(mesh);
    }

    if (!added && targetMeshes !== meshes) {
      for (const mesh of meshes) {
        addTrackForMesh(mesh);
      }
    }
  }

  private ensureMixer(): AnimationMixer | null {
    const model = this.host.getModel();
    if (!model) return null;

    if (!this.animationMixer) {
      this.animationMixer = new AnimationMixer(model as any);
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
      stop: () => this.stopAnimation(clipName),
      pause: () => this.pauseAnimation(clipName),
      resume: () => this.resumeAnimation(clipName),
      setSpeed: (speed: number) => this.setAnimationSpeed(clipName, speed),
      setWeight: (weight: number) => this.setAnimationIntensity(clipName, weight),
      seekTo: (time: number) => {
        action.time = Math.max(0, Math.min(time, action.getClip().duration));
      },
      getState: () => this.getAnimationState(clipName)!,
      crossfadeTo: (targetClip: string, dur?: number) => this.crossfadeTo(targetClip, dur),
      finished: finishedPromise,
    };
  }
}
