

import { createActor } from 'xstate';
import { animationMachine } from './animationMachine';
import type { Snippet, HostCaps, ScheduleOpts } from './types';
import { AnimationScheduler as Scheduler } from './animationScheduler';

const clamp01 = (v:number) => Math.min(1, Math.max(0, v));
const isNum = (s: string) => /^\d+$/.test(s);

type NormalizedCurvePoint = { time:number; intensity:number; inherit?: boolean };

function normalize(sn: any): Snippet & { curves: Record<string, NormalizedCurvePoint[]> } {
  if (sn && sn.curves) {
    const curves: Record<string, NormalizedCurvePoint[]> = {};
    Object.entries<any[]>(sn.curves).forEach(([key, arr]) => {
      curves[key] = arr.map((k:any) => ({
        time: k.time ?? k.t ?? 0,
        intensity: k.intensity ?? k.v ?? 0,
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
      curves
    } as any;
  }
  const curves: Record<string, NormalizedCurvePoint[]> = {};
  (sn.au ?? []).forEach((k:any) => {
    const key = String(k.id);
    (curves[key] ||= []).push({ time: k.t ?? k.time ?? 0, intensity: k.v ?? k.intensity ?? 0, inherit: !!k.inherit });
  });
  (sn.viseme ?? []).forEach((k:any) => {
    const key = String(k.key);
    (curves[key] ||= []).push({ time: k.t ?? k.time ?? 0, intensity: k.v ?? k.intensity ?? 0, inherit: !!k.inherit });
  });
  Object.values(curves).forEach(arr => arr.sort((a,b)=>a.time-b.time));
  return { name: sn.name ?? `sn_${Date.now()}`, loop: !!sn.loop, snippetCategory: sn.snippetCategory ?? 'default', snippetPriority: sn.snippetPriority ?? 0, snippetPlaybackRate: sn.snippetPlaybackRate ?? 1, snippetIntensityScale: sn.snippetIntensityScale ?? 1, curves } as any;
}

function sampleAt(arr: Array<{ time:number; intensity:number }>, t:number) {
  if (!arr.length) return 0;
  if (t <= arr[0].time) return arr[0].intensity;
  if (t >= arr[arr.length-1].time) return arr[arr.length-1].intensity;
  for (let i=0;i<arr.length-1;i++){
    const a = arr[i], b = arr[i+1];
    if (t >= a.time && t <= b.time){
      const dt = Math.max(1e-6, b.time - a.time);
      const p = (t - a.time) / dt;
      return a.intensity + (b.intensity - a.intensity) * p;
    }
  }
  return 0;
}

class _UnusedMinimalScheduler { // NOTE: kept only for reference; not used.
  private host: HostCaps;
  private machine: any;
  private rafId: number | null = null;
  private playing = false;
  private startWall = 0; // ms
  private pausedAt = 0;  // ms accumulated
  public scheduleHistory: Array<{ data: any; opts?: { startInSec?: number; startAtSec?: number; offsetSec?: number; priority?: number } }> = [];

  constructor(machine:any, host: HostCaps){ this.machine = machine; this.host = host; }
  private now(){ return (typeof performance!=='undefined'?performance.now():Date.now()); }
  private currentSnippets(){ return this.machine.getSnapshot().context.animations as any[] as Array<Snippet & { curves: Record<string, Array<{ time:number; intensity:number }>> }>; }
  private totalDuration(sn: Snippet){ return Math.max(0, ...Object.values((sn as any).curves||{}).map((a: any) => a?.length ? a[a.length-1].time : 0)); }
  private buildTargetMap(snippets: Array<Snippet & { curves: Record<string, Array<{ time:number; intensity:number }>> }>, tPlay: number) {
    const targets = new Map<string, { v:number; pri:number }>();
    for (const sn of snippets){
      const rate = sn.snippetPlaybackRate ?? 1;
      const dur  = this.totalDuration(sn);
      const scale= sn.snippetIntensityScale ?? 1;
      const pri  = typeof sn.snippetPriority==='number' ? sn.snippetPriority : 0;
      let local = tPlay * rate;
      if (!sn.loop && local > dur) local = dur; else if (sn.loop && dur>0) local = ((local % dur) + dur) % dur;
      for (const [curveId, arr] of Object.entries(sn.curves || {})){
        const v = clamp01(sampleAt(arr, local) * scale);
        const prev = targets.get(curveId);
        if (!prev || pri >= prev.pri) targets.set(curveId, { v, pri });
      }
    }
    return targets;
  }
  private tick = () => {
    if (!this.playing){ this.rafId = null; return; }
    const now = this.now();
    const tPlay = (now - this.startWall) / 1000;
    const targets = this.buildTargetMap(this.currentSnippets(), tPlay);
    targets.forEach((entry, curveId) => {
      const v = entry.v;
      if (isNum(curveId)) (this.host.transitionAU ?? this.host.applyAU)(parseInt(curveId,10), v, 120);
      else (this.host.transitionMorph ?? this.host.setMorph)(curveId, v, 80);
    });
    this.rafId = (typeof requestAnimationFrame!=='undefined' ? requestAnimationFrame(this.tick) : null);
  }
  loadFromJSON(data:any){ const sn = normalize(data); this.machine.send({ type:'LOAD_ANIMATION', data: sn }); return sn.name; }
  schedule(data:any, opts?: { startInSec?: number; startAtSec?: number; offsetSec?: number; priority?: number }){
    const sn = normalize(data);
    if (typeof opts?.priority === 'number') sn.snippetPriority = opts.priority;
    this.scheduleHistory.push({ data: sn, opts });
    this.machine.send({ type:'LOAD_ANIMATION', data: sn });
    return sn.name;
  }
  remove(name:string){ this.machine.send({ type:'REMOVE_ANIMATION', name }); }
  play(){ if (this.playing) return; this.playing = true; const now = this.now(); this.startWall = now - this.pausedAt; if (this.rafId==null) this.rafId = requestAnimationFrame(this.tick); this.machine.send({ type: 'PLAY_ALL' }); }
  pause(){ if (!this.playing) return; this.playing = false; const now = this.now(); this.pausedAt = now - this.startWall; if (this.rafId!=null){ cancelAnimationFrame(this.rafId as any); this.rafId = null; } this.machine.send({ type: 'PAUSE_ALL' }); }
  stop(){
    this.playing = false;
    this.pausedAt = 0;
    if (this.rafId!=null){ cancelAnimationFrame(this.rafId as any); this.rafId = null; }
    try { this.machine?.send?.({ type: 'STOP_ALL' }); } catch {}
  }
  flushOnce(){ const targets = this.buildTargetMap(this.currentSnippets(), 0); targets.forEach((entry, curveId) => { const v = entry.v; if (isNum(curveId)) (this.host.transitionAU ?? this.host.applyAU)(parseInt(curveId,10), v, 80); else (this.host.transitionMorph ?? this.host.setMorph)(curveId, v, 60); }); }
  enable(name:string, on=true){ /* no-op */ }
  seek(name:string, offsetSec:number){ /* no-op */ }
  dispose(){
    try { this.stop(); } catch {}
    try { this.machine?.stop?.(); } catch {}
  }
}

/* ---------- preload bundled snippets to localStorage -------- */
function preloadSnippets() {
  try {
    // Use Vite's import.meta.glob to load all JSON files from snippets directories
    const emotionModules = import.meta.glob('./snippets/emotion/*.json', { eager: true });
    const speakingModules = import.meta.glob('./snippets/speaking/*.json', { eager: true });
    const visemeModules = import.meta.glob('./snippets/visemes/*.json', { eager: true });
    const eyeHeadTrackingModules = import.meta.glob('./snippets/eyeHeadTracking/*.json', { eager: true });

    const config = [
      ['emotionAnimationsList', emotionModules],
      ['speakingAnimationsList', speakingModules],
      ['visemeAnimationsList', visemeModules],
      ['eyeHeadTrackingAnimationsList', eyeHeadTrackingModules]
    ] as const;

    config.forEach(([storeKey, modules]) => {
      const names: string[] = [];
      Object.entries(modules).forEach(([filePath, module]) => {
        // Extract filename from path like "./snippets/emotion/happy_smile.json"
        const match = filePath.match(/\/([^/]+)\.json$/);
        if (match) {
          const base = match[1];
          names.push(base);
          const data = (module as any).default || module;
          localStorage.setItem(`${storeKey}/${base}`, JSON.stringify(data));
        }
      });
      localStorage.setItem(storeKey, JSON.stringify(names));
      console.log(`[animationService] Preloaded ${names.length} animations for ${storeKey}:`, names);
    });
  } catch (e) {
    // If import.meta.glob is not available, just ensure the lists exist
    console.warn('[animationService] Could not preload snippets:', e);
    const categories = ['emotionAnimationsList', 'speakingAnimationsList', 'visemeAnimationsList', 'eyeHeadTrackingAnimationsList'];
    categories.forEach(cat => {
      if (!localStorage.getItem(cat)) {
        localStorage.setItem(cat, JSON.stringify([]));
      }
    });
  }
}

export function createAnimationService(host: HostCaps){
  const machine = createActor(animationMachine).start();

  // Use the full scheduler immediately (no async hot-swap)
  // Pass host to Scheduler
  const impl = new Scheduler(machine as any, host);
  let disposed = false;

  // Preload snippets from bundled files to localStorage
  preloadSnippets();

  const api = {
    loadFromLocal(key: string, cat='default', prio=0){
      const str = localStorage.getItem(key);
      if (!str) return null;
      try {
        const obj = JSON.parse(str);
        // Extract name from key if not present in the data
        // key format: "emotionAnimationsList/happy_smile"
        if (!obj.name) {
          const parts = key.split('/');
          obj.name = parts[parts.length - 1]; // "happy_smile"
        }
        return api.schedule(obj, { priority: prio });
      } catch(e) {
        console.error('[animationService] bad JSON from localStorage', e);
        return null;
      }
    },
    loadFromJSON(data:any){ return impl.loadFromJSON(data); },
    schedule(data:any, opts?: ScheduleOpts){ return impl.schedule(data, opts); },
    remove(name:string){ return impl.remove(name); },
    play(){ return impl.play(); },
    pause(){ return impl.pause(); },
    stop(){ return impl.stop(); },
    flushOnce(){ return impl.flushOnce(); },
    enable(name:string, on=true){ return impl.enable(name, on); },
    seek(name:string, offsetSec:number){ return impl.seek(name, offsetSec); },
    getState(){ return (machine as any).getSnapshot(); },
    setSnippetLoopState(name: string, iteration: number, localTime?: number) {
      try {
        machine?.send?.({ type: 'SET_LOOP_STATE', name, iteration, localTime });
      } catch {}
    },
    dispose(){
      if (disposed) return;
      disposed = true;
      try { impl.dispose(); } catch {}
      try { machine?.stop?.(); } catch {}
    },
    /** --- snippet-level tuning (individual speed, intensity, priority, loop) --- */
    setSnippetPlaybackRate(name: string, rate: number){
      const st = (machine as any).getSnapshot?.() ?? null;
      const list = st?.context?.animations as any[] || [];
      const sn = list.find(s => s?.name === name);
      if (!sn) return;

      const newRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
      const oldRate = sn.snippetPlaybackRate ?? 1;

      // Re-anchor timing when rate changes to prevent jumping (old agency approach)
      // Formula: currentTime = ((now - startWallTime) / 1000) * rate
      // We want: maintain current local time with new rate
      if (Math.abs(newRate - oldRate) > 0.001) {
        const implAny = impl as any;
        const now = typeof implAny.now === 'function' ? implAny.now() : Date.now();

        // Calculate current local time with old rate
        const currentLocal = ((now - (sn.startWallTime || now)) / 1000) * oldRate;

        // Adjust startWallTime to maintain same local time with new rate
        // currentLocal = ((now - newStartWallTime) / 1000) * newRate
        // newStartWallTime = now - (currentLocal / newRate) * 1000
        sn.startWallTime = now - (currentLocal / newRate) * 1000;

        // Clear all running transitions in EngineThree so they don't interfere
        try {
          const engine = (host as any).engine ?? (window as any).facslib;
          if (engine && typeof engine.clearTransitions === 'function') {
            engine.clearTransitions();
          }
        } catch {}

        // Immediately apply current values at the new timing
        try { (impl as any).flushOnce?.(); } catch {}
      }

      sn.snippetPlaybackRate = newRate;
    },
    setSnippetIntensityScale(name: string, scale: number){
      const st = (machine as any).getSnapshot?.() ?? null;
      const list = st?.context?.animations as any[] || [];
      const sn = list.find(s => s?.name === name);
      if (!sn) return;
      sn.snippetIntensityScale = Math.max(0, Number.isFinite(scale) ? scale : 1);
      try { (impl as any).flushOnce?.(); } catch {}
    },
    setSnippetPriority(name: string, priority: number){
      const st = (machine as any).getSnapshot?.() ?? null;
      const list = st?.context?.animations as any[] || [];
      const sn = list.find(s => s?.name === name);
      if (!sn) return;
      sn.snippetPriority = Number.isFinite(priority) ? priority : 0;
      // No need to rebuild schedule immediately; priority applied on next tick/flush
      try { (impl as any).flushOnce?.(); } catch {}
    },
    setSnippetLoop(name: string, loop: boolean){
      const st = (machine as any).getSnapshot?.() ?? null;
      const list = st?.context?.animations as any[] || [];
      const sn = list.find(s => s?.name === name);
      if (!sn) return;
      sn.loop = !!loop;
    },
    setSnippetPlaying(name: string, playing: boolean){
      const st = (machine as any).getSnapshot?.() ?? null;
      const list = st?.context?.animations as any[] || [];
      const sn = list.find(s => s?.name === name);
      if (!sn) return;
      sn.isPlaying = !!playing;

      // Wall-clock anchoring: when resuming, re-anchor to current time
      if (playing) {
        const implAny = impl as any;
        const now = typeof implAny.now === 'function' ? implAny.now() : Date.now();
        const currentLocal = sn.currentTime || 0;
        const rate = sn.snippetPlaybackRate ?? 1;
        // Set startWallTime so that current local time is maintained
        // Formula: currentLocal = ((now - startWallTime) / 1000) * rate
        // Solving: startWallTime = now - (currentLocal / rate) * 1000
        sn.startWallTime = now - (currentLocal / rate) * 1000;

        // Also update the scheduler's enabled flag (for compatibility)
        const rt = implAny.sched?.get?.(name);
        if (rt) rt.enabled = true;
      }

      try { (impl as any).flushOnce?.(); } catch {}
    },
    /** Convenience: seek local time within a snippet (seconds) */
    setSnippetTime(name: string, tSec: number){
      try { (impl as any).seek?.(name, Math.max(0, tSec||0)); (impl as any).flushOnce?.(); } catch {}
    },
    /** External frame step (seconds). ThreeProvider calls this each frame. */
    step(dtSec: number){
      const _impl:any = impl as any;
      if (!_impl || typeof dtSec!=='number' || !isFinite(dtSec) || dtSec<=0) return;
      try { if (_impl.step) _impl.step(dtSec); } catch {}
    },
    /** Expose playing state for frame loop safety */
    get playing() {
      if (typeof impl.isPlaying === 'function') return impl.isPlaying();
      return !!(impl as any).playing;
    },
    /** Back-compat helper: method form */
    isPlaying() {
      if (typeof impl.isPlaying === 'function') return !!impl.isPlaying();
      return !!(impl as any).playing;
    },
    pauseSnippet(name: string){ return (impl as any).pauseSnippet?.(name); },
    resumeSnippet(name: string){ return (impl as any).resumeSnippet?.(name); },
    stopSnippet(name: string){ return (impl as any).stopSnippet?.(name); },
    getScheduleSnapshot(){ return (impl as any).getScheduleSnapshot?.(); },
    /** Get current value of an AU or morph for smooth continuity when scheduling new snippets */
    getCurrentValue(auId: string): number { return (impl as any).getCurrentValue?.(auId) ?? 0; },
    /** Subscribe to machine state transitions for UI updates */
    onTransition(cb: (snapshot: any) => void) {
      const sub = (machine as any).subscribe?.((snapshot: any) => {
        if (snapshot.changed !== false) cb(snapshot);
      });
      return () => sub?.unsubscribe?.();
    },
    /** Debug helper: log current state */
    debug() {
      console.log('[AnimationService] Debug Info:');
      console.log('  - playing:', api.playing);
      console.log('  - machine state:', (machine as any).getSnapshot?.()?.value);
      const state = (machine as any).getSnapshot?.();
      const anims = state?.context?.animations || [];
      console.log('  - animations loaded:', anims.length);
      anims.forEach((a: any, i: number) => {
        console.log(`    [${i}] ${a.name}: isPlaying=${a.isPlaying}, maxTime=${a.maxTime}, curves=`, Object.keys(a.curves || {}).length);
      });
      console.log('  - scheduler:', impl);
    }
  } as const;

  (window as any).anim = api;
  return api;
}
