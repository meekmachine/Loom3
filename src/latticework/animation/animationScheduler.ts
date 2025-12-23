import type { Snippet, HostCaps, ScheduleOpts } from './types';
import type { TransitionHandle } from '../../engine/EngineThree.types';
import { VISEME_KEYS, COMPOSITE_ROTATIONS } from '../../engine/arkit/shapeDict';
import { animationEventEmitter } from './animationService';

type RuntimeSched = { name: string; startsAt: number; offset: number; enabled: boolean };

/**
 * Active playback runner for a snippet.
 * Tracks the async playback loop and active TransitionHandles.
 */
type PlaybackRunner = {
  /** Name of the snippet this runner belongs to */
  snippetName: string;
  /** Set to false to stop the playback loop */
  active: boolean;
  /** Currently active TransitionHandles (for pause/resume) */
  handles: TransitionHandle[];
  /** Promise that resolves when the runner completes or is stopped */
  promise: Promise<void>;
};

const isNum = (s: string) => /^\d+$/.test(s);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Apply logarithmic intensity scaling for better control at low values.
 * Maps UI scale [0, 2] to multiplier with these characteristics:
 * - 0.0 → 0.0 (silent)
 * - 1.0 → 1.0 (neutral, no change)
 * - 2.0 → 4.0 (4x amplification)
 *
 * Uses exponential curve: multiplier = scale^2
 * This gives finer control at low intensities and smooth amplification at high.
 */
const applyIntensityScale = (rawValue: number, scale: number): number => {
  // For scale values around 1.0, use quadratic scaling for smooth transitions
  // scale^2 gives: 0.5→0.25, 0.75→0.56, 1.0→1.0, 1.5→2.25, 2.0→4.0
  const multiplier = scale * scale;
  return rawValue * multiplier;
};

/**
 * Normalize keyframe intensity values to [0, 1] range.
 * Handles both 0-1 values and 0-100 percentage values.
 */
const normalizeIntensity = (value: number): number => {
  // If value is > 1, assume it's in percentage (0-100) and divide by 100
  // Otherwise use as-is (already in 0-1 range)
  return value > 1 ? value / 100 : value;
};

type SchedulerCurvePoint = { time: number; intensity: number; inherit?: boolean };

export function normalize(sn: any): Snippet & { curves: Record<string, SchedulerCurvePoint[]> } {
  if (sn && sn.curves) {
    const curves: Record<string, SchedulerCurvePoint[]> = {};
    Object.entries<any[]>(sn.curves).forEach(([key, arr]) => {
      curves[key] = arr.map((k: any) => ({
        time: k.time ?? k.t ?? 0,
        intensity: normalizeIntensity(k.intensity ?? k.v ?? 0),
        inherit: !!k.inherit
      }));
    });
    return {
      name: sn.name ?? `sn_${Date.now()}`,
      loop: !!sn.loop,
      snippetCategory: sn.snippetCategory ?? 'default',
      snippetPriority: sn.snippetPriority ?? 0,
      snippetPlaybackRate: sn.snippetPlaybackRate ?? 1,
      snippetIntensityScale: sn.snippetIntensityScale ?? 1,
      snippetBlendMode: sn.snippetBlendMode ?? 'replace',  // Default to 'replace' for backward compatibility
      snippetJawScale: sn.snippetJawScale ?? 1.0,  // Jaw bone activation for viseme snippets
      snippetBalance: sn.snippetBalance ?? 0,  // Global L/R balance for bilateral AUs
      snippetBalanceMap: sn.snippetBalanceMap ?? {},  // Per-AU balance overrides
      curves
    } as any;
  }

  const curves: Record<string, SchedulerCurvePoint[]> = {};
  (sn.au ?? []).forEach((k: any) => {
    const key = String(k.id);
    (curves[key] ||= []).push({
      time: k.t ?? k.time ?? 0,
      intensity: normalizeIntensity(k.v ?? k.intensity ?? 0),
      inherit: !!k.inherit
    });
  });
  (sn.viseme ?? []).forEach((k: any) => {
    const key = String(k.key);
    (curves[key] ||= []).push({
      time: k.t ?? k.time ?? 0,
      intensity: normalizeIntensity(k.v ?? k.intensity ?? 0),
      inherit: !!k.inherit
    });
  });
  Object.values(curves).forEach(arr => arr.sort((a, b) => a.time - b.time));

  return {
    name: sn.name ?? `sn_${Date.now()}`,
    loop: !!sn.loop,
    snippetCategory: sn.snippetCategory ?? 'default',
    snippetPriority: sn.snippetPriority ?? 0,
    snippetPlaybackRate: sn.snippetPlaybackRate ?? 1,
    snippetIntensityScale: sn.snippetIntensityScale ?? 1,
    snippetBlendMode: sn.snippetBlendMode ?? 'replace',
    snippetJawScale: sn.snippetJawScale ?? 1.0,
    snippetBalance: sn.snippetBalance ?? 0,
    snippetBalanceMap: sn.snippetBalanceMap ?? {},
    curves
  } as any;
}

function sampleAt(arr: SchedulerCurvePoint[], t: number) {
  if (!arr.length) return 0;
  if (t <= arr[0].time) return arr[0].intensity;
  if (t >= arr[arr.length - 1].time) return arr[arr.length - 1].intensity;
  for (let i = 0; i < arr.length - 1; i++) {
    const a = arr[i],
      b = arr[i + 1];
    if (t >= a.time && t <= b.time) {
      const dt = Math.max(1e-6, b.time - a.time);
      const p = (t - a.time) / dt;
      return a.intensity + (b.intensity - a.intensity) * p;
    }
  }
  return 0;
}

export class AnimationScheduler {
  private host: HostCaps;
  private machine: any;
  private sched = new Map<string, RuntimeSched>();
  private playing = false;
  private playTimeSec = 0;
  /** Track snippets already notified as completed to avoid duplicate callbacks */
  private ended = new Set<string>();
  /** Track current AU values for smooth continuity when scheduling new snippets */
  private currentValues = new Map<string, number>();
  /** Track last sampled local times per snippet to detect loop wrap events. */
  private loopLocalTimes = new Map<string, { local: number; loopCount: number }>();
  /** Active playback runners per snippet - each runner awaits TransitionHandle promises */
  private playbackRunners = new Map<string, PlaybackRunner>();

  // Defensive: ensure actor is running before any send, recover if stopped
  private ensureActorRunning() {
    try {
      // XState v5 actors expose .start(); safe to call if already running (no-op)
      if (this.machine?.start) this.machine.start();
    } catch {}
  }
  private safeSend(evt: any) {
    try {
      this.ensureActorRunning();
      this.machine?.send?.(evt);
    } catch {
      // Try one more time after forcing a start (covers "stopped actor" edge)
      try { this.machine?.start?.(); this.machine?.send?.(evt); } catch {}
    }
  }

  constructor(machine: any, host: HostCaps) {
    this.machine = machine;
    this.host = host;
    this.ensureActorRunning();
  }

  // ============================================================================
  // PROMISE-BASED PLAYBACK SYSTEM
  // Each playing snippet gets an async runner that:
  // 1. Extracts keyframe times from curves
  // 2. Fires transitions at each keyframe boundary
  // 3. Awaits TransitionHandle.promise to know when to fire next
  // 4. Loops or completes based on snippet.loop
  // ============================================================================

  /**
   * Start an async playback runner for a snippet.
   * The runner fires transitions at keyframe boundaries and awaits their promises.
   */
  private startPlaybackRunner(snippetName: string) {
    // Stop any existing runner for this snippet
    this.stopPlaybackRunner(snippetName);

    // Create runner and add to map BEFORE starting the async loop
    // This ensures runPlaybackLoop can find the runner when it starts
    const runner: PlaybackRunner = {
      snippetName,
      active: true,
      handles: [],
      promise: Promise.resolve(), // Placeholder, will be replaced
    };

    this.playbackRunners.set(snippetName, runner);

    // NOW start the async loop (runner is already in map)
    runner.promise = this.runPlaybackLoop(snippetName);
  }

  /**
   * Stop the playback runner for a snippet.
   * Cancels all active transitions and marks the runner as inactive.
   */
  private stopPlaybackRunner(snippetName: string) {
    const runner = this.playbackRunners.get(snippetName);
    if (!runner) return;

    runner.active = false;
    // Cancel all active handles
    for (const handle of runner.handles) {
      try { handle.cancel(); } catch {}
    }
    runner.handles = [];
    this.playbackRunners.delete(snippetName);
  }

  /**
   * Pause the playback runner for a snippet.
   * Pauses all active TransitionHandles.
   */
  private pausePlaybackRunner(snippetName: string) {
    const runner = this.playbackRunners.get(snippetName);
    if (!runner) return;

    for (const handle of runner.handles) {
      try { handle.pause(); } catch {}
    }
  }

  /**
   * Resume the playback runner for a snippet.
   * Resumes all active TransitionHandles.
   */
  private resumePlaybackRunner(snippetName: string) {
    const runner = this.playbackRunners.get(snippetName);
    if (!runner) return;

    for (const handle of runner.handles) {
      try { handle.resume(); } catch {}
    }
  }

  /**
   * The main async playback loop for a snippet.
   * Fires transitions at keyframe boundaries and awaits their completion.
   */
  private async runPlaybackLoop(snippetName: string): Promise<void> {
    const runner = this.playbackRunners.get(snippetName);
    if (!runner) return;

    // Get snippet from machine context
    const getSnippet = () => {
      try {
        const st = this.machine.getSnapshot?.();
        const arr = st?.context?.animations as any[] || [];
        return arr.find((s: any) => s?.name === snippetName);
      } catch { return null; }
    };

    let loopIteration = 0;

    // Main playback loop (handles looping)
    while (runner.active) {
      const sn = getSnippet();
      if (!sn || !sn.curves) break;

      const curves = sn.curves as Record<string, SchedulerCurvePoint[]>;
      const rate = sn.snippetPlaybackRate ?? 1;
      const scale = sn.snippetIntensityScale ?? 1;

      // Extract all unique keyframe times across all curves, sorted
      const allTimes = new Set<number>();
      for (const arr of Object.values(curves)) {
        for (const kf of arr) {
          allTimes.add(kf.time);
        }
      }
      const keyframeTimes = Array.from(allTimes).sort((a, b) => a - b);

      if (keyframeTimes.length === 0) break;

      // Iterate through keyframe boundaries
      for (let i = 0; i < keyframeTimes.length; i++) {
        if (!runner.active) break;

        const currentTime = keyframeTimes[i];
        const nextTime = keyframeTimes[i + 1] ?? keyframeTimes[keyframeTimes.length - 1];
        // Calculate duration with a minimum of 30ms for smoother transitions
        const rawDurationMs = i < keyframeTimes.length - 1
          ? ((nextTime - currentTime) / rate) * 1000
          : 50; // Last keyframe gets a short duration
        const durationMs = Math.max(30, rawDurationMs);

        // Collect all curve values at nextTime and fire transitions
        const handles: TransitionHandle[] = [];

        // Get snippet category for viseme detection
        const snippetCategory = (sn as any).snippetCategory ?? 'default';
        const isVisemeCategory = snippetCategory === 'visemeSnippet' || snippetCategory === 'combined';

        for (const [curveId, arr] of Object.entries(curves)) {
          const targetValue = clamp01(applyIntensityScale(sampleAt(arr, nextTime), scale));
          this.currentValues.set(curveId, targetValue);

          // Check if this is a viseme index (numeric 0-14 in viseme/combined snippets)
          const numericId = Number(curveId);
          const isVisemeIndex = isVisemeCategory && !Number.isNaN(numericId) && numericId >= 0 && numericId < VISEME_KEYS.length;

          if (isVisemeIndex) {
            // Use transitionViseme for proper jaw bone coordination
            // Get jawScale from snippet metadata (defaults to 1.0)
            const jawScale = (sn as any).snippetJawScale ?? 1.0;
            if (this.host.transitionViseme) {
              const handle = this.host.transitionViseme(numericId, targetValue, durationMs, jawScale);
              handles.push(handle);
            } else if (this.host.setViseme) {
              this.host.setViseme(numericId, targetValue, jawScale);
            } else {
              // Fallback to morph only (no jaw)
              const morphName = VISEME_KEYS[numericId];
              this.host.setMorph(morphName, targetValue);
            }
            continue;
          }

          // Determine if this is a continuum pair
          const continuumInfo = this.getContinuumInfo(curveId);

          if (continuumInfo && this.host.transitionContinuum) {
            // Skip - will be handled by the other AU in the pair
            if (curveId === String(continuumInfo.posAU)) continue;

            // Get the other AU's value
            const otherCurve = curves[String(continuumInfo.posAU)];
            const otherValue = otherCurve
              ? clamp01(applyIntensityScale(sampleAt(otherCurve, nextTime), scale))
              : 0;

            const continuumValue = otherValue - targetValue;
            const handle = this.host.transitionContinuum(
              continuumInfo.negAU,
              continuumInfo.posAU,
              continuumValue,
              durationMs
            );
            handles.push(handle);
          } else if (isNum(curveId)) {
            // Regular AU transition
            // Get balance from snippet: per-AU override takes precedence over global balance
            const snippetBalanceMap = (sn as any).snippetBalanceMap ?? {};
            const snippetBalance = (sn as any).snippetBalance ?? 0;
            const balance = snippetBalanceMap[curveId] !== undefined ? snippetBalanceMap[curveId] : snippetBalance;

            if (this.host.transitionAU) {
              const handle = this.host.transitionAU(parseInt(curveId, 10), targetValue, durationMs, balance);
              handles.push(handle);
            } else {
              this.host.applyAU(parseInt(curveId, 10), targetValue, balance);
            }
          } else {
            // Morph/viseme transition (by name)
            if (this.host.transitionMorph) {
              const handle = this.host.transitionMorph(curveId, targetValue, durationMs);
              handles.push(handle);
            } else {
              this.host.setMorph(curveId, targetValue);
            }
          }
        }

        // Store handles for pause/resume
        runner.handles = handles;

        // Await all transitions to complete
        if (handles.length > 0) {
          await Promise.all(handles.map(h => h.promise));
        }

        runner.handles = [];

        // Emit keyframe completed event for UI updates
        const snForDuration = getSnippet();
        const snippetDuration = snForDuration ? this.totalDuration(snForDuration) : 0;
        animationEventEmitter.emitKeyframeCompleted({
          snippetName,
          keyframeIndex: i,
          totalKeyframes: keyframeTimes.length,
          currentTime: keyframeTimes[i],
          duration: snippetDuration,
        });

        // Check if still active after awaiting
        if (!runner.active) break;
      }

      // Loop complete - check if we should loop again
      if (!runner.active) break;

      const snCheck = getSnippet();
      if (!snCheck?.loop) {
        // Non-looping snippet completed
        this.ended.add(snippetName);
        // Mark snippet as not playing so UI can show play button for replay
        if (snCheck) snCheck.isPlaying = false;
        // Emit snippet completed event for UI
        animationEventEmitter.emitSnippetCompleted(snippetName);
        try { this.host.onSnippetEnd?.(snippetName); } catch {}
        break;
      }

      // Looping - increment and continue
      loopIteration++;
      // Emit loop event for UI
      animationEventEmitter.emitSnippetLooped({
        snippetName,
        iteration: loopIteration,
        localTime: 0,
      });
      this.safeSend({
        type: 'SNIPPET_LOOPED',
        name: snippetName,
        iteration: loopIteration,
        localTime: 0
      });
    }

    // Cleanup
    this.playbackRunners.delete(snippetName);
  }

  /**
   * Check if a curve ID is part of a continuum pair.
   * Returns the pair info if found, null otherwise.
   */
  private getContinuumInfo(curveId: string): { negAU: number; posAU: number } | null {
    if (!isNum(curveId)) return null;
    const auId = parseInt(curveId, 10);

    for (const composite of COMPOSITE_ROTATIONS) {
      for (const axisName of ['pitch', 'yaw', 'roll'] as const) {
        const axis = composite[axisName];
        if (!axis || axis.negative === undefined || axis.positive === undefined) continue;
        if (auId === axis.negative || auId === axis.positive) {
          return { negAU: axis.negative, posAU: axis.positive };
        }
      }
    }
    return null;
  }

  private now() {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  private currentSnippets() {
    return this.machine.getSnapshot().context.animations as any[] as Array<Snippet & { curves: Record<string, SchedulerCurvePoint[]> }>;
  }

  /** Calculate duration from keyframes - find the latest keyframe time across all curves */
  private totalDuration(sn: Snippet) {
    const curves = (sn as any).curves || {};
    if (!Object.keys(curves).length) return 0;
    return Math.max(0, ...Object.values<any[]>(curves).map(arr => arr.length ? arr[arr.length - 1].time : 0));
  }

  private ensureSched(snName: string) {
    if (!this.sched.has(snName)) this.sched.set(snName, { name: snName, startsAt: 0, offset: 0, enabled: true });
    return this.sched.get(snName)!;
  }

  private computeLocalInfo(
    sn: Snippet & { curves: Record<string, SchedulerCurvePoint[]> },
    tPlay: number
  ) {
    const name = sn.name || '';
    const rt = this.ensureSched(name);
    if (!rt.enabled) return null;
    const startAt = rt.startsAt ?? 0;
    const offset = rt.offset ?? 0;
    const rate = sn.snippetPlaybackRate ?? 1;
    const duration = this.totalDuration(sn);
    const elapsed = tPlay - startAt;
    if (elapsed < 0) return null;
    const rawLocal = offset + elapsed * rate;
    let loopCount = 0;
    let local = rawLocal;
    if (sn.loop && duration > 0) {
      loopCount = Math.floor(local / duration);
      local = ((local % duration) + duration) % duration;
    } else {
      local = Math.min(duration, Math.max(0, local));
    }
    return { rt, startAt, offset, rate, duration, rawLocal, local, loopCount };
  }

  private refreshSnippetTimes(
    snippets: Array<Snippet & { curves: Record<string, SchedulerCurvePoint[]> }>,
    tPlay: number
  ) {
    snippets.forEach(sn => {
      const info = this.computeLocalInfo(sn, tPlay);
      if (!info) return;
      (sn as any).currentTime = info.local;
    });
  }

  private buildTargetMap(snippets: Array<Snippet & { curves: Record<string, SchedulerCurvePoint[]> }>, tPlay: number, ignorePlayingState = false) {
    const targets = new Map<string, { v: number; pri: number; durMs: number; category: string }>();

    // Track additive contributions for each AU (all snippets with blendMode='additive' contribute)
    const additiveContributions = new Map<string, Array<{ snippet: string; v: number; pri: number }>>();

    // Track conflicts for debugging
    const conflicts = new Map<string, Array<{ snippet: string; pri: number; v: number; won: boolean }>>();

    for (const sn of snippets) {
      // Honor per-snippet play state (VISOS parity) - unless explicitly ignoring
      if (!ignorePlayingState && sn && (sn as any).isPlaying === false) continue;

      const scale = sn.snippetIntensityScale ?? 1;
      const pri = typeof sn.snippetPriority === 'number' ? sn.snippetPriority : 0;
      const blendMode = (sn as any).snippetBlendMode ?? 'replace';
      const info = this.computeLocalInfo(sn, tPlay);
      if (!info) continue;

      this.handleLoopContinuity(sn, info.local, info.loopCount, info.duration);

      for (const [curveId, arr] of Object.entries(sn.curves || {})) {
        // Sample the curve at the current local time
        const rawValue = sampleAt(arr, info.local);
        const scaled = applyIntensityScale(rawValue, scale);
        const v = clamp01(scaled);

        // Find next keyframe to calculate tween duration
        let nextKfTime = info.duration; // default to end
        for (let i = 0; i < arr.length; i++) {
          if (arr[i].time > info.local) {
            nextKfTime = arr[i].time;
            break;
          }
        }
        const timeToNext = (nextKfTime - info.local) / info.rate;
        // Use smoother tween duration - longer min for smoother transitions, higher max for slower movements
        const durMs = Math.max(50, Math.min(1000, timeToNext * 1000)); // clamp between 50ms and 1000ms
        const prev = targets.get(curveId);

        // ADDITIVE BLENDING: snippets with blendMode='additive' contribute cumulatively
        if (blendMode === 'additive') {
          if (!additiveContributions.has(curveId)) {
            additiveContributions.set(curveId, []);
          }
          additiveContributions.get(curveId)!.push({ snippet: sn.name || 'unknown', v, pri });
          continue; // Don't compete with replace-mode snippets here, handle after loop
        }

        // Track conflict for debugging (only when there's a previous value)
        if (prev) {
          if (!conflicts.has(curveId)) conflicts.set(curveId, []);
          conflicts.get(curveId)!.push({ snippet: sn.name || 'unknown', pri, v, won: false });
        }

        // REPLACE MODE (default): higher priority wins, ties broken by higher value
        const wins = !prev || pri > prev.pri || (pri === prev.pri && v > prev.v);
        if (wins) {
          targets.set(curveId, { v, pri, durMs, category: sn.snippetCategory || 'default' });
          if (prev && conflicts.has(curveId)) {
            // Mark this one as winner
            const arr = conflicts.get(curveId)!;
            arr[arr.length - 1].won = true;
          }
        }
      }
    }

    // Apply additive contributions: sum all additive values and combine with replace-mode winner
    for (const [curveId, contributions] of additiveContributions.entries()) {
      // Sum all additive values
      const additiveSum = contributions.reduce((sum, c) => sum + c.v, 0);
      const maxAdditivePri = Math.max(...contributions.map(c => c.pri), 0);

      const replaceTarget = targets.get(curveId);

      if (replaceTarget) {
        // Combine replace-mode winner with additive sum
        const combined = clamp01(replaceTarget.v + additiveSum);
        targets.set(curveId, { ...replaceTarget, v: combined });
      } else {
        // No replace-mode snippet, just use additive sum
        const combined = clamp01(additiveSum);
        targets.set(curveId, { v: combined, pri: maxAdditivePri, durMs: 120, category: 'default' });
      }
    }

    return targets;
  }

  /**
   * Apply targets using continuum-aware processing for composite bones.
   * Detects AU pairs that form continuums (e.g., eyes left/right, head up/down)
   * and calls transitionAU for each AU directly. The engine's setAU() handles
   * composite bone rotations automatically through AU_TO_COMPOSITE_MAP.
   *
   * @param immediate - If true, use applyAU/setMorph for instant updates (scrubbing).
   *                    If false, use transitionAU/transitionMorph for smooth animation.
   */
  private applyContinuumTargets(targets: Map<string, { v: number; pri: number; durMs: number; category: string }>, immediate = false) {
    const processedAUs = new Set<string>();
    const processedContinuums = new Set<string>(); // Track which continuum pairs we've already processed

    // Process each composite rotation definition from shapeDict
    for (const composite of COMPOSITE_ROTATIONS) {
      const { pitch, yaw, roll } = composite;

      // Process each axis (pitch, yaw, roll) for this node
      const axes: Array<{ config: typeof pitch }> = [
        { config: pitch },
        { config: yaw },
        { config: roll },
      ];

      for (const { config } of axes) {
        if (!config || !config.negative || !config.positive) continue;

        const negAU = config.negative;
        const posAU = config.positive;
        const negAUStr = String(negAU);
        const posAUStr = String(posAU);
        const negEntry = targets.get(negAUStr);
        const posEntry = targets.get(posAUStr);
        const negValue = negEntry?.v ?? 0;
        const posValue = posEntry?.v ?? 0;

        // Create unique key for this continuum pair to avoid duplicate processing
        // (e.g., EYE_L and EYE_R share the same AU pairs 61/62)
        const continuumKey = `${negAU}-${posAU}`;

        // Check if either AU is in targets (even if value is 0 - we need to apply resets)
        const hasNegTarget = targets.has(negAUStr);
        const hasPosTarget = targets.has(posAUStr);

        // Process if either AU is targeted and we haven't processed this pair yet
        if ((hasNegTarget || hasPosTarget) && !processedContinuums.has(continuumKey)) {
          const durationMs = Math.max(
            negEntry?.durMs ?? 120,
            posEntry?.durMs ?? 120,
            120
          );

          // Calculate continuum value: -1 (full negative) to +1 (full positive)
          const continuumValue = posValue - negValue;

          if (immediate) {
            // Immediate mode (scrubbing): apply values directly without animation
            this.host.applyAU(negAU, negValue);
            this.host.applyAU(posAU, posValue);
          } else if (this.host.transitionContinuum) {
            // Use transitionContinuum if available (handles both AUs as a single animated value)
            // This ensures smooth interpolation through the full -1 to +1 range
            this.host.transitionContinuum(negAU, posAU, continuumValue, durationMs);
          } else if (this.host.transitionAU) {
            // Fallback: transition individual AUs (less smooth for continuums)
            this.host.transitionAU(negAU, negValue, durationMs);
            this.host.transitionAU(posAU, posValue, durationMs);
          } else {
            this.host.applyAU(negAU, negValue);
            this.host.applyAU(posAU, posValue);
          }

          processedContinuums.add(continuumKey);

          // Mark these AUs as processed so we don't apply them individually below
          processedAUs.add(negAUStr);
          processedAUs.add(posAUStr);

          // Track current values for continuity
          this.currentValues.set(negAUStr, negValue);
          this.currentValues.set(posAUStr, posValue);
        }
      }
    }

    // Apply remaining AUs that aren't part of continuum pairs
    targets.forEach((entry, curveId) => {
      if (processedAUs.has(curveId)) return; // Skip continuum pairs already processed

      const v = entry.v;
      // Track current value for continuity
      this.currentValues.set(curveId, v);

      if (isNum(curveId)) {
        if (immediate) {
          this.host.applyAU(parseInt(curveId, 10), v);
        } else {
          (this.host.transitionAU ?? this.host.applyAU)(parseInt(curveId, 10), v, 120);
        }
      } else {
        if (immediate) {
          this.host.setMorph(curveId, v);
        } else {
          (this.host.transitionMorph ?? this.host.setMorph)(curveId, v, 80);
        }
      }
    });
  }

  /** Apply viseme targets with jaw bone coordination.
   * @param immediate - If true, use setViseme for instant updates (scrubbing).
   */
  private applyVisemeTargets(targets: Map<string, { v: number; pri: number; durMs: number; category: string }>, immediate = false) {
    const processedIds: string[] = [];
    const jawScale = 1.0; // Could be made configurable

    targets.forEach((entry, curveId) => {
      const isVisemeCategory = entry.category === 'visemeSnippet' || entry.category === 'combined';
      if (!isVisemeCategory) return;

      const numericId = Number(curveId);
      const numericIsViseme = !Number.isNaN(numericId) && numericId >= 0 && numericId < VISEME_KEYS.length;
      const nameMatchIndex = VISEME_KEYS.indexOf(curveId);

      // Get viseme index (either from numeric ID or name lookup)
      const visemeIndex = numericIsViseme ? numericId : (nameMatchIndex >= 0 ? nameMatchIndex : -1);

      if (visemeIndex < 0) return; // Combined snippets can carry AU ids too - leave them for continuum logic

      const v = clamp01(entry.v);
      if (immediate) {
        // Use setViseme for proper jaw coordination
        if (this.host.setViseme) {
          this.host.setViseme(visemeIndex, v, jawScale);
        } else {
          // Fallback to morph only
          this.host.setMorph(VISEME_KEYS[visemeIndex], v);
        }
      } else {
        // Use transitionViseme for smooth animation with jaw
        if (this.host.transitionViseme) {
          this.host.transitionViseme(visemeIndex, v, entry.durMs, jawScale);
        } else if (this.host.setViseme) {
          this.host.setViseme(visemeIndex, v, jawScale);
        } else {
          this.host.setMorph(VISEME_KEYS[visemeIndex], v);
        }
      }
      processedIds.push(curveId);
    });

    processedIds.forEach(id => targets.delete(id));
  }

  /** Detect loop wrap events and refresh inherited keyframes so loops resume from the latest AU values. */
  private handleLoopContinuity(
    sn: Snippet & { curves: Record<string, SchedulerCurvePoint[]> },
    localTime: number,
    loopCount: number,
    duration: number
  ) {
    const key = sn.name || '__anon__';

    if (!sn.loop || duration <= 0) {
      this.loopLocalTimes.set(key, { local: localTime, loopCount: 0 });
      return;
    }

    const prev = this.loopLocalTimes.get(key);

    if (prev && loopCount > prev.loopCount) {
      this.reseedInheritedKeyframes(sn);
      if (key) {
        this.safeSend({
          type: 'SNIPPET_LOOPED',
          name: key,
          iteration: loopCount,
          localTime
        });
      }
    }

    this.loopLocalTimes.set(key, { local: localTime, loopCount });
  }

  private reseedInheritedKeyframes(sn: Snippet & { curves: Record<string, SchedulerCurvePoint[]> }) {
    Object.entries(sn.curves || {}).forEach(([curveId, arr]) => {
      const first = arr?.[0];
      if (!first || !first.inherit) return;
      const current = this.currentValues.get(curveId) ?? first.intensity ?? 0;
      first.intensity = current;
    });
  }

  load(snippet: Snippet) {
    // AUTOMATIC CONTINUITY: Apply current values to first keyframe (time=0) before loading
    // This ensures smooth transitions when snippets take over from other snippets
    const snWithContinuity = this.applyContinuity(snippet);

    this.safeSend({ type: 'LOAD_ANIMATION', data: snWithContinuity });

    return snWithContinuity.name;
  }

  /**
   * Apply animation continuity: replace first keyframe (time=0) with current values
   * to ensure smooth transitions when taking over from other snippets.
   *
   * This eliminates the need for schedulers to manually query getCurrentValue() -
   * the animation agency handles continuity automatically.
   */
  private applyContinuity(snippet: Snippet): Snippet {
    const curves = (snippet as any).curves || {};
    const continuousCurves: Record<string, SchedulerCurvePoint[]> = {};

    for (const [auId, keyframes] of Object.entries<SchedulerCurvePoint[]>(curves)) {
      if (!keyframes || keyframes.length === 0) {
        continuousCurves[auId] = keyframes;
        continue;
      }

      // Clone the keyframe array to avoid mutating the original
      const newKeyframes = keyframes.map(kf => ({ ...kf }));

      // If first keyframe is marked for inherit (or sits at time 0), replace its intensity with current value
      if (newKeyframes[0].inherit || newKeyframes[0].time === 0) {
        const currentValue = this.currentValues.get(auId) ?? 0;
        newKeyframes[0] = {
          ...newKeyframes[0],
          time: newKeyframes[0].time,
          intensity: currentValue,
          inherit: newKeyframes[0].inherit
        };
      }

      continuousCurves[auId] = newKeyframes;
    }

    return {
      ...snippet,
      curves: continuousCurves
    } as any;
  }

  loadFromJSON(data: any) {
    const sn = normalize(data);
    return this.load(sn as any);
  }

  remove(name: string) {
    // Stop any active playback runner for this snippet
    this.stopPlaybackRunner(name);
    this.safeSend({ type: 'REMOVE_ANIMATION', name });
    this.loopLocalTimes.delete(name);
    this.ended.delete(name);
  }

  schedule(data: any, opts: ScheduleOpts = {}) {
    const sn = normalize(data);
    if (typeof opts.priority === 'number') sn.snippetPriority = opts.priority;
    this.load(sn);

    const rt = this.ensureSched(sn.name || `sn_${Date.now()}`);
    // Play-time (seconds) since the last play() anchor. If not playing yet, treat as 0.
    const tPlay = this.playing ? this.playTimeSec : 0;
    // Respect explicit startAtSec if provided; otherwise schedule relative to current play-time plus startInSec.
    const relStart = (typeof opts.startAtSec === 'number')
      ? Math.max(0, opts.startAtSec)
      : Math.max(0, tPlay + (opts.startInSec ?? 0));
    rt.startsAt = relStart;
    rt.offset = opts.offsetSec ?? 0;
    rt.enabled = true;
    this.sched.set(sn.name || '', rt);

    // If already playing, start a playback runner for the new snippet immediately
    if (this.playing && sn.name) {
      this.startPlaybackRunner(sn.name);
    }

    return sn.name;
  }

  enable(name: string, on = true) {
    const r = this.sched.get(name);
    if (r) r.enabled = !!on;
    try {
      const st = this.machine.getSnapshot?.();
      const arr = st?.context?.animations as any[] || [];
      const sn = arr.find((s:any) => s?.name === name);
      if (sn) sn.isPlaying = !!on;
    } catch {}
  }

  /**
   * Seek to a specific time in a snippet and immediately apply the values.
   * This is used for scrubbing - values are applied instantly (no transitions).
   */
  seek(name: string, offsetSec: number) {
    const seekTime = Math.max(0, offsetSec);

    // Update runtime schedule
    const rt = this.ensureSched(name);
    rt.startsAt = this.playTimeSec;
    rt.offset = seekTime;
    rt.enabled = true;
    this.ended.delete(name);

    // Send SEEK_SNIPPET event to machine - this creates new state and triggers UI updates
    this.safeSend({ type: 'SEEK_SNIPPET', name, time: seekTime });

    // Immediately apply values at the seeked position (for scrubbing)
    this.applyAtCurrentTime();
  }

  /**
   * Apply animation values at the current time immediately (no transitions).
   * Used internally by seek() for scrubbing visual feedback.
   */
  private applyAtCurrentTime() {
    const tPlay = this.playTimeSec;
    const snippets = this.currentSnippets();
    this.refreshSnippetTimes(snippets, tPlay);
    // Ignore playing state - we want to show the scrubbed position even for paused snippets
    const targets = this.buildTargetMap(snippets, tPlay, true);

    // Apply immediately (no transitions) for instant visual feedback
    this.applyVisemeTargets(targets, true);
    this.applyContinuumTargets(targets, true);
  }

  play() {
    if (this.playing) return;
    this.playing = true;
    // Ensure state machine is playing before any tick
    this.safeSend({ type: 'PLAY_ALL' });

    // Start playback runners for all snippets marked as playing
    const snippets = this.currentSnippets();
    for (const sn of snippets) {
      if (sn.name && (sn as any).isPlaying !== false) {
        this.startPlaybackRunner(sn.name);
      }
    }
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    this.safeSend({ type: 'PAUSE_ALL' });

    // Pause all playback runners
    for (const [name] of this.playbackRunners) {
      this.pausePlaybackRunner(name);
    }
  }

  stop() {
    this.playing = false;
    this.playTimeSec = 0;
    // Stop all playback runners
    for (const [name] of this.playbackRunners) {
      this.stopPlaybackRunner(name);
    }
    // Clear all scheduled snippets
    this.sched.forEach((r) => { r.enabled = false; r.startsAt = 0; r.offset = 0; });
    this.loopLocalTimes.clear();
    this.safeSend({ type: 'STOP_ALL' });
  }

  /** Return playing state for external checks */
  isPlaying() {
    return !!this.playing;
  }

  dispose() {
    // Stop all playback runners first
    for (const [name] of this.playbackRunners) {
      try { this.stopPlaybackRunner(name); } catch {}
    }
    try { this.stop(); } catch {}
    try { this.machine?.stop?.(); } catch {}
  }
  /** Pause a single snippet without removing it. */
  pauseSnippet(name: string) {
    const rt = this.sched.get(name);
    if (rt) rt.enabled = false;
    // Pause the playback runner (pauses active TransitionHandles)
    this.pausePlaybackRunner(name);
    try {
      const st = this.machine.getSnapshot?.();
      const arr = st?.context?.animations as any[] || [];
      const sn = arr.find((s:any) => s?.name === name);
      if (sn) sn.isPlaying = false;
    } catch {}
  }

  /** Resume a previously paused snippet. */
  resumeSnippet(name: string) {
    const rt = this.sched.get(name) || this.ensureSched(name);
    rt.enabled = true;
    // Resume the playback runner (resumes active TransitionHandles)
    // If no runner exists, start a new one
    if (this.playbackRunners.has(name)) {
      this.resumePlaybackRunner(name);
    } else if (this.playing) {
      this.startPlaybackRunner(name);
    }
    try {
      const st = this.machine.getSnapshot?.();
      const arr = st?.context?.animations as any[] || [];
      const sn = arr.find((s:any) => s?.name === name);
      if (sn) sn.isPlaying = true;
    } catch {}
  }

  /** Stop (cancel) a snippet and remove it from the machine. */
  stopSnippet(name: string) {
    const rt = this.sched.get(name);
    if (rt) { rt.enabled = false; rt.startsAt = 0; rt.offset = 0; }
    // Stop the playback runner (cancels active TransitionHandles)
    this.stopPlaybackRunner(name);
    try { this.remove(name); } catch {}
    // Do not call onSnippetEnd here — this is an explicit user stop, not a natural completion.
    this.ended.add(name);
  }

  /** Introspection: snapshot of current schedule with computed local times. */
  getScheduleSnapshot() {
    const snippets = this.currentSnippets();
    return snippets.map(sn => {
      const name = sn.name || '';
      const rt = this.ensureSched(name);
      const rate = sn.snippetPlaybackRate ?? 1;
      const dur  = this.totalDuration(sn);
      const info = this.computeLocalInfo(sn, this.playTimeSec);
      const local = info ? info.local : 0;

      return {
        name,
        enabled: rt.enabled,
        startsAt: rt.startsAt, // Keep for backwards compatibility
        offset: rt.offset,      // Keep for backwards compatibility
        localTime: local,
        duration: dur,
        loop: !!sn.loop,
        priority: sn.snippetPriority ?? 0,
        playbackRate: rate,
        intensityScale: sn.snippetIntensityScale ?? 1
      };
    });
  }

  /**
   * Get the current value of an AU or morph target.
   * This is the value that was most recently applied to the engine.
   * Useful for smooth continuity when scheduling new snippets that should
   * start from the current state instead of jumping back to 0.
   *
   * @param auId - AU ID as string (e.g., '31', '33', '61') or morph name
   * @returns Current value (0-1), or 0 if never applied
   */
  getCurrentValue(auId: string): number {
    return this.currentValues.get(auId) ?? 0;
  }
}
