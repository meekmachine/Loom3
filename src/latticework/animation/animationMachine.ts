import { createMachine, assign } from 'xstate';
import type {
  AnimContext,
  AnimEvent,
  LoadAnimationEvent,
  NormalizedSnippet,
  CurvePoint
} from './types';

// ---------- helpers ----------
function normalizeCurves(input?: Record<string, Array<CurvePoint | { t?: number; v?: number; time?: number; intensity?: number }>>) {
  const out: Record<string, CurvePoint[]> = {};
  if (!input) return out;
  for (const [key, arr] of Object.entries(input)) {
    const safe = Array.isArray(arr) ? arr : [];
    const norm = safe.map((k: any) => ({
      time: typeof k.time === 'number' ? k.time : (typeof k.t === 'number' ? k.t : 0),
      intensity: typeof k.intensity === 'number' ? k.intensity : (typeof k.v === 'number' ? k.v : 0),
    }));
    norm.sort((a, b) => a.time - b.time);
    out[key] = norm;
  }
  return out;
}

/**
 * Calculate snippet duration from keyframes - finds the latest keyframe time across all curves
 */
function calculateDuration(curves: Record<string, CurvePoint[]>): number {
  if (!curves || !Object.keys(curves).length) return 0;
  let maxTime = 0;
  for (const arr of Object.values(curves)) {
    if (arr.length > 0) {
      const lastTime = arr[arr.length - 1].time;
      if (lastTime > maxTime) maxTime = lastTime;
    }
  }
  return maxTime;
}

function coerceSnippet(d: NonNullable<LoadAnimationEvent['data']>, playing: boolean): NormalizedSnippet {
  const rate = typeof d.snippetPlaybackRate === 'number' ? d.snippetPlaybackRate : 1;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const curves = normalizeCurves(d.curves);
  const duration = calculateDuration(curves);

  return {
    name: d.name ?? `sn_${Date.now()}`,
    curves,
    isPlaying: playing,
    loop: !!d.loop,
    snippetPlaybackRate: rate,
    snippetIntensityScale: typeof d.snippetIntensityScale === 'number' ? d.snippetIntensityScale : 1,
    snippetCategory: (d as any).snippetCategory ?? 'default',
    snippetPriority: typeof (d as any).snippetPriority === 'number' ? (d as any).snippetPriority : 0,
    currentTime: 0,
    startWallTime: now,  // Initialize to current time for wall-clock anchoring
    duration,  // Calculated from keyframes
    cursor: {}
  };
}

// ---------- machine (XState v5 typing via `types` block) ----------
export const animationMachine = createMachine({
  id: 'animationMachine',
  initial: 'stopped',

  types: {
    context: {} as AnimContext,
    events: {} as AnimEvent
  },

  context: {
    animations: [],
    currentAUs: {},
    currentVisemes: {},
    manualOverrides: {},
    scheduledTransitions: []
  },

  states: {
    stopped: {
      on: {
        LOAD_ANIMATION: { actions: 'addSnippetPaused' },
        REMOVE_ANIMATION: { actions: 'removeSnippet' },
        PLAY_ALL: { target: 'playing', actions: 'markAllPlaying' }
      }
    },
    playing: {
      on: {
        LOAD_ANIMATION: { actions: 'addSnippetPlaying' },
        REMOVE_ANIMATION: { actions: 'removeSnippet' },
        PAUSE_ALL: { target: 'paused', actions: 'markAllPaused' },
        STOP_ALL: { target: 'stopped', actions: 'markAllPaused' },
        KEYFRAME_HIT: { actions: 'applyBlendValues' },
        UI_PROGRESS: { actions: 'updateCurrentTimes' },
        CURVE_CHANGED: { actions: 'mergeCurve' },
        MANUAL_SET: { actions: 'manualSet' },
        MANUAL_CLEAR: { actions: 'manualClear' }
      }
    },
    paused: {
      on: {
        LOAD_ANIMATION: { actions: 'addSnippetPaused' },
        REMOVE_ANIMATION: { actions: 'removeSnippet' },
        PLAY_ALL: { target: 'playing', actions: 'markAllPlaying' },
        STOP_ALL: { target: 'stopped', actions: 'markAllPaused' },
        CURVE_CHANGED: { actions: 'mergeCurve' },
        MANUAL_SET: { actions: 'manualSet' },
        MANUAL_CLEAR: { actions: 'manualClear' }
      }
    }
  }
}, {
  actions: {
    addSnippetPlaying: assign(({ context, event }) => {
      if (event.type !== 'LOAD_ANIMATION' || !event.data) return {};
      const sn = coerceSnippet(event.data, true);
      return { animations: [...context.animations, sn] };
    }),

    addSnippetPaused: assign(({ context, event }) => {
      if (event.type !== 'LOAD_ANIMATION' || !event.data) return {};
      const sn = coerceSnippet(event.data, false);
      return { animations: [...context.animations, sn] };
    }),

    removeSnippet: assign(({ context, event }) => {
      if (event.type !== 'REMOVE_ANIMATION') return {};
      return { animations: context.animations.filter((s) => s?.name !== event.name) };
    }),

    markAllPlaying: assign(({ context }) => ({
      animations: context.animations.map((sn) => ({ ...sn, isPlaying: true }))
    })),

    markAllPaused: assign(({ context }) => ({
      animations: context.animations.map((sn) => ({ ...sn, isPlaying: false }))
    })),

    // Curve edits
    mergeCurve: assign(({ context, event }) => {
      if (event.type !== 'CURVE_CHANGED') return {};
      const { nameOrId, auId, curve } = event;
      const targetIdx = context.animations.findIndex((s) => s.name === nameOrId);
      if (targetIdx < 0) return {};
      const sn = context.animations[targetIdx];
      const newCurves = { ...sn.curves, [String(auId)]: [...curve].sort((a, b) => a.time - b.time) };
      const newCursor = { ...sn.cursor, [String(auId)]: 0 };
      const newSn = { ...sn, curves: newCurves, cursor: newCursor };
      const animations = context.animations.slice();
      animations[targetIdx] = newSn;
      return { animations };
    }),

    // manual overrides
    manualSet: assign(({ context, event }) => {
      if (event.type !== 'MANUAL_SET') return {};
      const manualOverrides = { ...context.manualOverrides, [event.id]: event.value };
      const currentAUs = { ...context.currentAUs };
      const currentVisemes = { ...context.currentVisemes };
      if (event.isViseme) currentVisemes[String(event.id)] = event.value;
      else currentAUs[String(event.id)] = event.value;
      return { manualOverrides, currentAUs, currentVisemes };
    }),

    manualClear: assign(({ context, event }) => {
      if (event.type !== 'MANUAL_CLEAR') return {};
      const manualOverrides = { ...context.manualOverrides };
      delete manualOverrides[event.id];
      return { manualOverrides };
    }),

    // scheduler feedback (optional UI mirrors)
    applyBlendValues: assign(({ context, event }) => {
      if (event.type !== 'KEYFRAME_HIT') return {};
      const currentAUs = { ...context.currentAUs };
      const currentVisemes = { ...context.currentVisemes };
      const ids: string[] = [];

      event.data.forEach((ev) => {
        const sn = ev.snippet;
        const arr = sn.curves[ev.curveId] || [];
        const kf = arr[ev.kfIdx];
        if (!kf) return;
        const val = kf.intensity * sn.snippetIntensityScale;
        if (sn.snippetCategory === 'visemeSnippet') currentVisemes[ev.curveId] = val;
        else currentAUs[ev.curveId] = val;
        ids.push(`${sn.name}:${ev.curveId}:${ev.kfIdx}`);
    });

      // manual overrides win in UI mirrors
      Object.entries(context.manualOverrides).forEach(([id, val]) => {
        if (currentAUs[id] !== undefined) currentAUs[id] = val as number;
        else currentVisemes[id] = val as number;
      });

      return { currentAUs, currentVisemes, scheduledTransitions: ids };
    }),

    updateCurrentTimes: assign(({ context }) => {
      const now = Date.now();
      const animations = context.animations.map((sn) => {
        if (!sn.isPlaying || !sn.startWallTime) return sn;
        const currentTime = ((now - sn.startWallTime) / 1000) * (sn.snippetPlaybackRate || 1);
        return { ...sn, currentTime };
      });
      return { animations };
    })
  }
});