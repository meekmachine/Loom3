import { createActor } from 'xstate';
import { animationMachine } from './animationMachine';
import type { HostCaps, ScheduleOpts } from './types';
import { AnimationScheduler as Scheduler } from './animationScheduler';

/** Preload bundled snippets from JSON files to localStorage */
function preloadSnippets() {
  try {
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
    console.warn('[animationService] Could not preload snippets:', e);
    const categories = ['emotionAnimationsList', 'speakingAnimationsList', 'visemeAnimationsList', 'eyeHeadTrackingAnimationsList'];
    categories.forEach(cat => {
      if (!localStorage.getItem(cat)) localStorage.setItem(cat, JSON.stringify([]));
    });
  }
}

export function createAnimationService(host: HostCaps) {
  const machine = createActor(animationMachine).start();
  const impl = new Scheduler(machine as any, host);
  let disposed = false;

  preloadSnippets();

  const api = {
    // --- Core API (delegated to Scheduler) ---
    loadFromJSON(data: any) { return impl.loadFromJSON(data); },
    schedule(data: any, opts?: ScheduleOpts) { return impl.schedule(data, opts); },
    remove(name: string) { return impl.remove(name); },
    play() { return impl.play(); },
    pause() { return impl.pause(); },
    stop() { return impl.stop(); },
    enable(name: string, on = true) { return impl.enable(name, on); },
    seek(name: string, offsetSec: number) { return impl.seek(name, offsetSec); },

    // --- State access ---
    getState() { return (machine as any).getSnapshot(); },
    getScheduleSnapshot() { return (impl as any).getScheduleSnapshot?.(); },
    getCurrentValue(auId: string): number { return (impl as any).getCurrentValue?.(auId) ?? 0; },
    get playing() { return impl.isPlaying?.() ?? false; },
    isPlaying() { return impl.isPlaying?.() ?? false; },

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
        const now = (impl as any).now?.() ?? Date.now();
        const currentLocal = ((now - (sn.startWallTime || now)) / 1000) * oldRate;
        sn.startWallTime = now - (currentLocal / newRate) * 1000;
      }
      sn.snippetPlaybackRate = newRate;
    },

    setSnippetIntensityScale(name: string, scale: number) {
      const sn = getSnippet(name);
      if (sn) sn.snippetIntensityScale = Math.max(0, Number.isFinite(scale) ? scale : 1);
    },

    setSnippetPriority(name: string, priority: number) {
      const sn = getSnippet(name);
      if (sn) sn.snippetPriority = Number.isFinite(priority) ? priority : 0;
    },

    setSnippetLoop(name: string, loop: boolean) {
      const sn = getSnippet(name);
      if (sn) sn.loop = !!loop;
    },

    setSnippetPlaying(name: string, playing: boolean) {
      const sn = getSnippet(name);
      if (!sn) return;
      sn.isPlaying = !!playing;

      if (playing) {
        const now = (impl as any).now?.() ?? Date.now();
        const currentLocal = sn.currentTime || 0;
        const rate = sn.snippetPlaybackRate ?? 1;
        sn.startWallTime = now - (currentLocal / rate) * 1000;
        (impl as any).resumeSnippet?.(name);
      } else {
        (impl as any).pauseSnippet?.(name);
      }
    },

    setSnippetTime(name: string, tSec: number) {
      (impl as any).seek?.(name, Math.max(0, tSec || 0));
    },

    setSnippetLoopState(name: string, iteration: number, localTime?: number) {
      machine?.send?.({ type: 'SET_LOOP_STATE', name, iteration, localTime });
    },

    // --- Playback runner controls ---
    pauseSnippet(name: string) { return (impl as any).pauseSnippet?.(name); },
    resumeSnippet(name: string) { return (impl as any).resumeSnippet?.(name); },
    stopSnippet(name: string) { return (impl as any).stopSnippet?.(name); },

    // --- Subscriptions ---
    onTransition(cb: (snapshot: any) => void) {
      const sub = (machine as any).subscribe?.((snapshot: any) => {
        if (snapshot.changed !== false) cb(snapshot);
      });
      return () => sub?.unsubscribe?.();
    },

    // --- Lifecycle ---
    dispose() {
      if (disposed) return;
      disposed = true;
      try { impl.dispose(); } catch {}
      try { machine?.stop?.(); } catch {}
    },

    // --- Debug ---
    debug() {
      const state = (machine as any).getSnapshot?.();
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
    const list = (machine as any).getSnapshot?.()?.context?.animations as any[] || [];
    return list.find(s => s?.name === name);
  }

  (window as any).anim = api;
  return api;
}
