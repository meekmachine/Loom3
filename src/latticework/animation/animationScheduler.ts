import type { Snippet, HostCaps, ScheduleOpts } from './types';

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

export function normalize(sn: any): Snippet & { curves: Record<string, Array<{ time: number; intensity: number }>> } {
  if (sn && sn.curves) {
    const curves: Record<string, Array<{ time: number; intensity: number }>> = {};
    Object.entries<any[]>(sn.curves).forEach(([key, arr]) => {
      curves[key] = arr.map((k: any) => ({ time: k.time ?? k.t ?? 0, intensity: k.intensity ?? k.v ?? 0 }));
    });
    return {
      name: sn.name ?? `sn_${Date.now()}`,
      loop: !!sn.loop,
      snippetCategory: sn.snippetCategory ?? 'default',
      snippetPriority: sn.snippetPriority ?? 0,
      snippetPlaybackRate: sn.snippetPlaybackRate ?? 1,
      snippetIntensityScale: sn.snippetIntensityScale ?? 1,
      curves
    } as any;
  }

  const curves: Record<string, Array<{ time: number; intensity: number }>> = {};
  (sn.au ?? []).forEach((k: any) => {
    const key = String(k.id);
    (curves[key] ||= []).push({ time: k.t ?? k.time ?? 0, intensity: k.v ?? k.intensity ?? 0 });
  });
  (sn.viseme ?? []).forEach((k: any) => {
    const key = String(k.key);
    (curves[key] ||= []).push({ time: k.t ?? k.time ?? 0, intensity: k.v ?? k.intensity ?? 0 });
  });
  Object.values(curves).forEach(arr => arr.sort((a, b) => a.time - b.time));

  return {
    name: sn.name ?? `sn_${Date.now()}`,
    loop: !!sn.loop,
    snippetCategory: sn.snippetCategory ?? 'default',
    snippetPriority: sn.snippetPriority ?? 0,
    snippetPlaybackRate: sn.snippetPlaybackRate ?? 1,
    snippetIntensityScale: sn.snippetIntensityScale ?? 1,
    curves
  } as any;
}

function sampleAt(arr: Array<{ time: number; intensity: number }>, t: number) {
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
    return this.machine.getSnapshot().context.animations as any[] as Array<Snippet & { curves: Record<string, Array<{ time: number; intensity: number }>> }>;
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

  private buildTargetMap(snippets: Array<Snippet & { curves: Record<string, Array<{ time: number; intensity: number }>> }>, tPlay: number, ignorePlayingState = false) {
    const targets = new Map<string, { v: number; pri: number; durMs: number }>();
    const now = this.now();

    // Track conflicts for debugging
    const conflicts = new Map<string, Array<{ snippet: string; pri: number; v: number; won: boolean }>>();

    for (const sn of snippets) {
      // Honor per-snippet play state (VISOS parity) - unless explicitly ignoring
      if (!ignorePlayingState && sn && (sn as any).isPlaying === false) continue;

      const rate = sn.snippetPlaybackRate ?? 1;
      const dur = this.totalDuration(sn);
      const scale = sn.snippetIntensityScale ?? 1;
      const pri = typeof sn.snippetPriority === 'number' ? sn.snippetPriority : 0;

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

        // Track conflict for debugging (only when there's a previous value)
        if (prev) {
          if (!conflicts.has(curveId)) conflicts.set(curveId, []);
          conflicts.get(curveId)!.push({ snippet: sn.name || 'unknown', pri, v, won: false });
        }

        // Old agency approach: higher priority wins, ties broken by higher value
        const wins = !prev || pri > prev.pri || (pri === prev.pri && v > prev.v);
        if (wins) {
          targets.set(curveId, { v, pri, durMs });
          if (prev && conflicts.has(curveId)) {
            // Mark this one as winner
            const arr = conflicts.get(curveId)!;
            arr[arr.length - 1].won = true;
          }
        }
      }
    }

    return targets;
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
    targets.forEach((entry, curveId) => {
      const v = entry.v;
      if (isNum(curveId)) (this.host.transitionAU ?? this.host.applyAU)(parseInt(curveId, 10), v, 120);
      else (this.host.transitionMorph ?? this.host.setMorph)(curveId, v, 80);
    });
    this.rafId = typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame(this.tick) : null;
  };

  load(snippet: Snippet) {
    this.safeSend({ type: 'LOAD_ANIMATION', data: snippet });

    // Initialize startWallTime immediately for independent wall-clock anchoring
    try {
      const st = this.machine.getSnapshot?.();
      const arr = st?.context?.animations as any[] || [];
      const sn = arr.find((s:any) => s?.name === snippet.name);
      if (sn && !sn.startWallTime) {
        sn.startWallTime = this.now();
        sn.isPlaying = true; // Auto-start when loaded
        console.log('[Scheduler] load() initialized', snippet.name, 'startWallTime:', sn.startWallTime);
      }
    } catch {}

    return snippet.name;
  }

  loadFromJSON(data: any) {
    const sn = normalize(data);
    return this.load(sn as any);
  }

  remove(name: string) {
    this.safeSend({ type: 'REMOVE_ANIMATION', name });
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
      // Clamp AU values to [0,1]
      const v = clamp01(entry.v);
      // All curve IDs are AU numbers (as strings)
      (this.host.transitionAU ?? this.host.applyAU)(parseInt(curveId, 10), v, entry.durMs);
    });
  }

  /** Drive the scheduler from an external clock (preferred, VISOS parity). */
  step(dtSec: number){
    if (!this.useExternalStep || !this.playing) {
      return;
    }
    this.playTimeSec += Math.max(0, dtSec || 0);
    const tPlay = this.playTimeSec;
    // Debug logging - show first 20 steps and every 60 steps after that
    const snippets = this.currentSnippets();
    if (this.playTimeSec < 1 || Math.floor(tPlay) % 3 === 0) {
      console.log('[AnimationScheduler] step() tPlay=', tPlay.toFixed(3), 'snippets=', snippets.length, 'playing:', this.playing);
      snippets.forEach(sn => {
        console.log('  -', sn.name, 'isPlaying:', (sn as any).isPlaying, 'currentTime:', (sn as any).currentTime?.toFixed(3), 'curves:', Object.keys(sn.curves || {}).length);
      });
    }
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
    targets.forEach((entry, curveId) => {
      // Clamp AU values to [0,1]
      const v = clamp01(entry.v);
      // Use the calculated duration to next keyframe (already accounts for playback rate)
      (this.host.transitionAU ?? this.host.applyAU)(parseInt(curveId, 10), v, entry.durMs);
    });
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
}