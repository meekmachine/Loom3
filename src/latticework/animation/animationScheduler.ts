import type { Snippet, HostCaps, ScheduleOpts } from './types';
import { VISEME_KEYS, COMPOSITE_ROTATIONS } from '../../engine/arkit/shapeDict';

type RuntimeSched = { name: string; startsAt: number; offset: number; enabled: boolean };

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
  private rafId: number | null = null;
  private playing = false;
  private startWall = 0; // ms
  private pausedAt = 0; // ms accumulated
  private playTimeSec = 0;
  private useExternalStep = true;
  /** Track snippets already notified as completed to avoid duplicate callbacks */
  private ended = new Set<string>();
  /** Track current AU values for smooth continuity when scheduling new snippets */
  private currentValues = new Map<string, number>();
  /** Track last sampled local times per snippet to detect loop wrap events. */
  private loopLocalTimes = new Map<string, { local: number; loopCount: number }>();
  /** Detect and handle natural snippet completions (non-looping). Uses wall-clock anchoring. */
  private checkCompletions(tPlay: number) {
    const snippets = this.currentSnippets();
    const now = this.now();
    for (const sn of snippets) {
      const name = sn.name || '';
      if (!name || this.ended.has(name)) continue;
      if (!(sn as any).startWallTime) continue; // Skip if not initialized
      const rate = sn.snippetPlaybackRate ?? 1;
      const dur  = this.totalDuration(sn);
      // Calculate local time using wall-clock anchor
      const local = ((now - (sn as any).startWallTime) / 1000) * rate;
      if (!sn.loop && dur > 0 && local >= dur) {
        // Mark ended before mutating state to prevent reentrancy repeats
        this.ended.add(name);
        // Set isPlaying to false so it stops contributing to targets
        try {
          const st = this.machine.getSnapshot?.();
          const arr = st?.context?.animations as any[] || [];
          const snippet = arr.find((s:any) => s?.name === name);
          if (snippet) snippet.isPlaying = false;
        } catch {}
        // Notify host
        try { this.host.onSnippetEnd?.(name); } catch {}
      }
    }
  }

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

  private buildTargetMap(snippets: Array<Snippet & { curves: Record<string, SchedulerCurvePoint[]> }>, tPlay: number, ignorePlayingState = false) {
    const targets = new Map<string, { v: number; pri: number; durMs: number; category: string }>();
    const now = this.now();

    // Track additive contributions for each AU (all snippets with blendMode='additive' contribute)
    const additiveContributions = new Map<string, Array<{ snippet: string; v: number; pri: number }>>();

    // Track conflicts for debugging
    const conflicts = new Map<string, Array<{ snippet: string; pri: number; v: number; won: boolean }>>();

    for (const sn of snippets) {
      // Honor per-snippet play state (VISOS parity) - unless explicitly ignoring
      if (!ignorePlayingState && sn && (sn as any).isPlaying === false) continue;

      const rate = sn.snippetPlaybackRate ?? 1;
      const dur = this.totalDuration(sn);
      const scale = sn.snippetIntensityScale ?? 1;
      const pri = typeof sn.snippetPriority === 'number' ? sn.snippetPriority : 0;
      const blendMode = (sn as any).snippetBlendMode ?? 'replace';

      // Use wall-clock anchoring (old agency approach) - each snippet has independent timeline
      if (!(sn as any).startWallTime) continue; // Skip if not initialized

      let local = ((now - (sn as any).startWallTime) / 1000) * rate;
      if (local < 0) local = 0;

      // Handle looping and clamping
      if (sn.loop && dur > 0) {
        // Loop: wrap local time within [0, dur]
        local = ((local % dur) + dur) % dur;
      } else {
        // Non-looping: clamp to [0, dur] and hold at end
        local = Math.min(dur, Math.max(0, local));
      }

      this.handleLoopContinuity(sn, local, now, dur, rate);

      for (const [curveId, arr] of Object.entries(sn.curves || {})) {
        // Sample the curve at the current local time
        // Apply logarithmic intensity scaling for better control at low values
        const rawValue = sampleAt(arr, local);
        const scaled = applyIntensityScale(rawValue, scale);
        const v = clamp01(scaled);

        // Find next keyframe to calculate tween duration
        let nextKfTime = dur; // default to end
        for (let i = 0; i < arr.length; i++) {
          if (arr[i].time > local) {
            nextKfTime = arr[i].time;
            break;
          }
        }
        const timeToNext = (nextKfTime - local) / rate; // account for playback rate
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
        console.log(`[AnimationScheduler][Additive] AU ${curveId}: replace=${replaceTarget.v.toFixed(3)} additive=${additiveSum.toFixed(3)} → ${combined.toFixed(3)}`);
      } else {
        // No replace-mode snippet, just use additive sum
        const combined = clamp01(additiveSum);
        targets.set(curveId, { v: combined, pri: maxAdditivePri, durMs: 120, category: 'default' });
        console.log(`[AnimationScheduler][Additive] AU ${curveId}: additive only=${additiveSum.toFixed(3)} → ${combined.toFixed(3)}`);
      }
    }

    return targets;
  }

  /**
   * Apply targets using continuum-aware processing for composite bones.
   * Detects AU pairs that form continuums (e.g., eyes left/right, head up/down)
   * and calls the appropriate engine continuum methods instead of individual setAU.
   */
  private applyContinuumTargets(targets: Map<string, { v: number; pri: number; durMs: number; category: string }>) {
    const processedAUs = new Set<string>();
    const processedContinuums = new Set<string>(); // Track which continuums we've already called

    // Process each composite rotation definition from shapeDict
    for (const composite of COMPOSITE_ROTATIONS) {
      const { node, pitch, yaw, roll } = composite;

      // Process each axis (pitch, yaw, roll) for this node
      const axes: Array<{ name: 'pitch' | 'yaw' | 'roll'; config: typeof pitch }> = [
        { name: 'pitch', config: pitch },
        { name: 'yaw', config: yaw },
        { name: 'roll', config: roll },
      ];

      for (const { name: axisName, config } of axes) {
        if (!config || !config.negative || !config.positive) continue;

        const negAU = String(config.negative);
        const posAU = String(config.positive);
        const negEntry = targets.get(negAU);
        const posEntry = targets.get(posAU);
        const negValue = negEntry?.v ?? 0;
        const posValue = posEntry?.v ?? 0;

        // If either AU is active, calculate continuum value and call the appropriate method
        if (negValue > 0 || posValue > 0) {
          // Continuum value: -1 (negative) to +1 (positive)
          const continuumValue = posValue - negValue;
          const continuumDurationMs = Math.max(
            negEntry?.durMs ?? 0,
            posEntry?.durMs ?? 0,
            0
          );

          // Determine which engine method to call based on node and axis
          const methodName = this.getContinuumMethodName(node, axisName);
          if (methodName) {
            // Create a unique key for this continuum to avoid duplicate calls
            // (e.g., both EYE_L and EYE_R map to setEyesHorizontal, only call once)
            const continuumKey = `${methodName}:${negAU}-${posAU}`;

            if (!processedContinuums.has(continuumKey) && this.host[methodName]) {
              const transitionName = methodName.startsWith('set')
                ? `transition${methodName.slice(3)}`
                : null;
              if (
                transitionName &&
                typeof (this.host as any)[transitionName] === 'function' &&
                continuumDurationMs > 0
              ) {
                (this.host as any)[transitionName](continuumValue, continuumDurationMs);
                console.log(
                  `[AnimationScheduler][Continuum] ${node}.${axisName} value=${continuumValue.toFixed(
                    3
                  )} duration=${continuumDurationMs.toFixed(0)}ms via ${transitionName}`
                );
              } else {
                this.host[methodName](continuumValue);
                console.log(
                  `[AnimationScheduler][Continuum] ${node}.${axisName} value=${continuumValue.toFixed(
                    3
                  )} (neg AU${negAU}=${negValue.toFixed(3)}, pos AU${posAU}=${posValue.toFixed(
                    3
                  )}) via ${methodName}`
                );
              }
              processedContinuums.add(continuumKey);
            } else if (!processedContinuums.has(continuumKey) && !this.host[methodName]) {
              console.warn(
                `[AnimationScheduler][Continuum] Missing host method ${methodName} for ${node}.${axisName}`
              );
            }
          }

          // Mark these AUs as processed so we don't apply them individually
          processedAUs.add(negAU);
          processedAUs.add(posAU);

          // Track current values for continuity
          this.currentValues.set(negAU, negValue);
          this.currentValues.set(posAU, posValue);
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
        (this.host.transitionAU ?? this.host.applyAU)(parseInt(curveId, 10), v, 120);
      } else {
        (this.host.transitionMorph ?? this.host.setMorph)(curveId, v, 80);
      }
    });
  }

  /** Apply morph targets that correspond to visemes so continuum logic only sees AU targets. */
  private applyVisemeTargets(targets: Map<string, { v: number; pri: number; durMs: number; category: string }>) {
    const processedIds: string[] = [];

    targets.forEach((entry, curveId) => {
      const isVisemeCategory = entry.category === 'visemeSnippet' || entry.category === 'combined';
      if (!isVisemeCategory) return;

      const numericId = Number(curveId);
      const numericIsViseme = !Number.isNaN(numericId) && numericId >= 0 && numericId < VISEME_KEYS.length;
      const nameMatchIndex = VISEME_KEYS.indexOf(curveId);
      const morphName = numericIsViseme
        ? VISEME_KEYS[numericId]
        : (nameMatchIndex >= 0 ? VISEME_KEYS[nameMatchIndex] : null);

      if (!morphName) return; // Combined snippets can carry AU ids too - leave them for continuum logic

      const v = clamp01(entry.v);
      (this.host.transitionMorph ?? this.host.setMorph)?.(morphName, v, entry.durMs);
      processedIds.push(curveId);
    });

    processedIds.forEach(id => targets.delete(id));
  }

  /** Detect loop wrap events and refresh inherited keyframes so loops resume from the latest AU values. */
  private handleLoopContinuity(
    sn: Snippet & { curves: Record<string, SchedulerCurvePoint[]> },
    localTime: number,
    now: number,
    duration: number,
    rate: number
  ) {
    const key = sn.name || '__anon__';

    if (!sn.loop || duration <= 0) {
      this.loopLocalTimes.set(key, { local: localTime, loopCount: 0 });
      return;
    }

    const startWall = (sn as any).startWallTime;
    if (!startWall) {
      this.loopLocalTimes.set(key, { local: localTime, loopCount: 0 });
      return;
    }

    const elapsed = ((now - startWall) / 1000) * rate;
    const loopCount = Math.floor(elapsed / duration);
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
      if (Math.abs((first.intensity ?? 0) - current) > 0.001) {
        console.log(`[Scheduler] Loop continuity: ${sn.name} AU ${curveId} resumes from ${current.toFixed(3)}`);
      }
      first.intensity = current;
    });
  }

  /**
   * Get the engine method name for a given composite node and axis.
   * Maps node+axis combinations to EngineThree continuum helper methods.
   */
  private getContinuumMethodName(node: string, axis: 'pitch' | 'yaw' | 'roll'): string | null {
    // Eyes
    if (node === 'EYE_L' || node === 'EYE_R') {
      if (axis === 'yaw') return 'setEyesHorizontal';
      if (axis === 'pitch') return 'setEyesVertical';
    }

    // Head
    if (node === 'HEAD') {
      if (axis === 'yaw') return 'setHeadHorizontal';
      if (axis === 'pitch') return 'setHeadVertical';
      if (axis === 'roll') return 'setHeadRoll';
    }

    // Jaw
    if (node === 'JAW') {
      if (axis === 'yaw') return 'setJawHorizontal';
      // Jaw pitch is handled differently (jaw drop uses multiple AUs)
    }

    // Tongue
    if (node === 'TONGUE') {
      if (axis === 'yaw') return 'setTongueHorizontal';
      if (axis === 'pitch') return 'setTongueVertical';
    }

    return null;
  }

  private tick = () => {
    if (!this.playing) {
      this.rafId = null;
      return;
    }
    const now = this.now();
    const tPlay = this.useExternalStep ? this.playTimeSec : (now - this.startWall) / 1000;
    // Handle natural completions before applying targets
    this.checkCompletions(tPlay);
    const targets = this.buildTargetMap(this.currentSnippets(), tPlay);

    // Apply viseme morphs before AU continuum processing so they don't get mistaken for AUs
    this.applyVisemeTargets(targets);

    // Apply continuum-aware processing for composite bones (eyes, head, jaw, tongue)
    this.applyContinuumTargets(targets);

    this.rafId = typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame(this.tick) : null;
  };

  load(snippet: Snippet) {
    // AUTOMATIC CONTINUITY: Apply current values to first keyframe (time=0) before loading
    // This ensures smooth transitions when snippets take over from other snippets
    const snWithContinuity = this.applyContinuity(snippet);

    this.safeSend({ type: 'LOAD_ANIMATION', data: snWithContinuity });

    // Initialize startWallTime immediately for independent wall-clock anchoring
    try {
      const st = this.machine.getSnapshot?.();
      const arr = st?.context?.animations as any[] || [];
      const sn = arr.find((s:any) => s?.name === snWithContinuity.name);
      if (sn && !sn.startWallTime) {
        sn.startWallTime = this.now();
        sn.isPlaying = true; // Auto-start when loaded
        console.log('[Scheduler] load() initialized', snWithContinuity.name, 'startWallTime:', sn.startWallTime);
      }
    } catch {}

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
        const prevValue = newKeyframes[0].intensity ?? 0;

        if (Math.abs(currentValue - prevValue) > 0.001) {
          console.log(`[Scheduler] Continuity: ${snippet.name} AU ${auId} starts from ${currentValue.toFixed(3)} (was ${prevValue.toFixed(3)})`);
        }

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
    this.safeSend({ type: 'REMOVE_ANIMATION', name });
    this.loopLocalTimes.delete(name);
    this.ended.delete(name);
  }

  schedule(data: any, opts: ScheduleOpts = {}) {
    const sn = normalize(data);
    if (typeof opts.priority === 'number') sn.snippetPriority = opts.priority;
    this.load(sn);

    // Initialize startWallTime immediately (old agency parity)
    // Each snippet needs its own wall-clock anchor for independent playback
    try {
      const st = this.machine.getSnapshot?.();
      const arr = st?.context?.animations as any[] || [];
      const snippet = arr.find((s:any) => s?.name === sn.name);
      if (snippet && !snippet.startWallTime) {
        const now = this.now();
        const offsetSec = opts.offsetSec ?? 0;
        const rate = snippet.snippetPlaybackRate ?? 1;
        // Set startWallTime so that local time = offsetSec
        // Formula: local = ((now - startWallTime) / 1000) * rate
        // Solving: startWallTime = now - (offsetSec / rate) * 1000
        snippet.startWallTime = now - (offsetSec / rate) * 1000;
        snippet.isPlaying = true; // Auto-start when scheduled
        console.log('[Scheduler] schedule() initialized', sn.name, 'startWallTime:', snippet.startWallTime, 'offsetSec:', offsetSec);
      }
    } catch {}

    const rt = this.ensureSched(sn.name || `sn_${Date.now()}`);
    // Play-time (seconds) since the last play() anchor. If not playing yet, treat as 0.
    const tPlay = this.playing
      ? (this.useExternalStep ? this.playTimeSec : (this.now() - this.startWall) / 1000)
      : 0;
    // Respect explicit startAtSec if provided; otherwise schedule relative to current play-time plus startInSec.
    const relStart = (typeof opts.startAtSec === 'number')
      ? Math.max(0, opts.startAtSec)
      : Math.max(0, tPlay + (opts.startInSec ?? 0));
    rt.startsAt = relStart;
    rt.offset = opts.offsetSec ?? 0;
    rt.enabled = true;
    this.sched.set(sn.name || '', rt);
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

  seek(name: string, offsetSec: number) {
    try {
      const st = this.machine.getSnapshot?.();
      const arr = st?.context?.animations as any[] || [];
      const sn = arr.find((s:any) => s?.name === name);
      if (!sn) return;

      // Old agency approach: adjust startWallTime to achieve the target local time
      // Formula: currentTime = ((now - startWallTime) / 1000) * rate
      // We want: currentTime = offsetSec
      // So: startWallTime = now - (offsetSec / rate) * 1000
      const now = this.now();
      const rate = sn.snippetPlaybackRate ?? 1;
      sn.startWallTime = now - (Math.max(0, offsetSec) / rate) * 1000;
      sn.currentTime = Math.max(0, offsetSec);

      console.log('[Scheduler] seek()', name, 'to', offsetSec.toFixed(3),
                  'rate:', rate, 'startWallTime:', sn.startWallTime);

      // If seeking on a completed snippet, re-enable it
      if (this.ended.has(name)) {
        this.ended.delete(name);
        sn.isPlaying = true;
      }
    } catch {}
  }

  play() {
    if (this.playing) return;
    this.playing = true;
    // Reset playTimeSec if starting from stopped
    if (this.useExternalStep) {
      if (this.playTimeSec === 0) this.playTimeSec = 0;
      // external clock will drive playTimeSec via step(dt)
    } else {
      const now = this.now();
      this.startWall = now - this.pausedAt;
      if (this.rafId == null) this.rafId = requestAnimationFrame(this.tick);
    }
    // Ensure state machine is playing before any tick
    this.safeSend({ type: 'PLAY_ALL' });
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    const now = this.now();
    this.pausedAt = now - this.startWall;
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId as any);
      this.rafId = null;
    }
    this.safeSend({ type: 'PAUSE_ALL' });
  }

  stop() {
    this.playing = false;
    this.playTimeSec = 0;
    this.pausedAt = 0;
    // Clear all scheduled snippets
    this.sched.forEach((r) => { r.enabled = false; r.startsAt = 0; r.offset = 0; });
    this.loopLocalTimes.clear();
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId as any);
      this.rafId = null;
    }
    this.safeSend({ type: 'STOP_ALL' });
  }

  flushOnce() {
    // Use current playback time for correct sampling
    const tPlay = this.useExternalStep ? this.playTimeSec : (this.now() - this.startWall) / 1000;
    console.log('[Scheduler] flushOnce() tPlay:', (tPlay ?? 0).toFixed(3));
    // Ignore playing state when flushing - we want to show the scrubbed position even for paused snippets
    const targets = this.buildTargetMap(this.currentSnippets(), tPlay, true);
    console.log('[Scheduler] flushOnce() targets:', targets.size);
    targets.forEach((entry, curveId) => {
      console.log('  -', curveId, '=', (entry.v ?? 0).toFixed(3), 'pri:', entry.pri, 'dur:', (entry.durMs ?? 0).toFixed(1), 'ms');
    });

    // Apply using the same flow as realtime playback so debugging reflects true behavior
    this.applyVisemeTargets(targets);
    this.applyContinuumTargets(targets);
  }

  /** Drive the scheduler from an external clock (preferred, VISOS parity). */
  step(dtSec: number){
    if (!this.useExternalStep || !this.playing) {
      return;
    }

    const snippets = this.currentSnippets();
    // Early exit if no snippets loaded - no work to do
    if (!snippets.length) return;

    this.playTimeSec += Math.max(0, dtSec || 0);
    const tPlay = this.playTimeSec;
    // Handle natural completions before applying targets
    this.checkCompletions(tPlay);
    // Only tick if playing
    if (!this.playing) return;

    // Update currentTime for each snippet using wall-clock anchoring (old agency approach)
    // Each snippet independently tracks its own timeline via startWallTime
    const now = this.now();
    snippets.forEach(sn => {
      // Skip updating currentTime for paused snippets
      if (!(sn as any).isPlaying) return;

      // Initialize startWallTime if not set (should rarely happen now that machine initializes it)
      if (!(sn as any).startWallTime) {
        (sn as any).startWallTime = now;
      }

      const rate = sn.snippetPlaybackRate ?? 1;
      const dur = this.totalDuration(sn);

      // Calculate local time from wall-clock anchor
      let local = ((now - (sn as any).startWallTime) / 1000) * rate;
      if (local < 0) local = 0;

      // Handle looping and clamping (same logic as buildTargetMap)
      if (sn.loop && dur > 0) {
        // Loop: wrap local time within [0, dur]
        local = ((local % dur) + dur) % dur;
      } else {
        // Non-looping: clamp to [0, dur] and hold at end
        local = Math.min(dur, Math.max(0, local));
      }

      (sn as any).currentTime = local;
    });

    const targets = this.buildTargetMap(snippets, tPlay);

    // Apply viseme morph targets first. Remaining entries are AU/morph keys for continuum logic.
    this.applyVisemeTargets(targets);

    // Apply continuum-aware processing for AU targets (eyes, head, jaw, tongue, etc.)
    this.applyContinuumTargets(targets);
  }

  /** Return playing state for external checks */
  isPlaying() {
    return !!this.playing;
  }

  dispose() {
    try { this.stop(); } catch {}
    try { this.machine?.stop?.(); } catch {}
  }
  /** Pause a single snippet without removing it. */
  pauseSnippet(name: string) {
    const rt = this.sched.get(name);
    if (rt) rt.enabled = false;
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
    try { this.remove(name); } catch {}
    // Do not call onSnippetEnd here — this is an explicit user stop, not a natural completion.
    this.ended.add(name);
  }

  /** Introspection: snapshot of current schedule with computed local times. */
  getScheduleSnapshot() {
    const snippets = this.currentSnippets();
    const now = this.now();
    return snippets.map(sn => {
      const name = sn.name || '';
      const rt = this.ensureSched(name);
      const rate = sn.snippetPlaybackRate ?? 1;
      const dur  = this.totalDuration(sn);

      // Use wall-clock anchoring for accurate independent timing
      let local = 0;
      if ((sn as any).startWallTime) {
        local = ((now - (sn as any).startWallTime) / 1000) * rate;
        if (local < 0) local = 0;
        // Handle looping
        if (sn.loop && dur > 0) {
          local = ((local % dur) + dur) % dur;
        } else {
          local = Math.min(dur, Math.max(0, local));
        }
      }

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
