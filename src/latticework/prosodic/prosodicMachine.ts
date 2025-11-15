/**
 * Prosodic Expression Machine (XState)
 * State machine for managing prosodic gestures (brow raises, head nods)
 * Follows the same pattern as animationMachine.ts
 */

import { createMachine, assign } from 'xstate';

// ---------- Types ----------

export interface ProsodicSnippet {
  name: string;
  curves: Record<string, Array<{ time: number; intensity: number }>>;
  category: 'brow' | 'head';
  priority: number;
  intensityScale: number;
  isPlaying: boolean;
  loop: boolean;
  currentTime: number;
  startWallTime: number;
  duration: number;
  playbackRate: number;
}

export interface ProsodicContext {
  browSnippet: ProsodicSnippet | null;
  headSnippet: ProsodicSnippet | null;
  isSpeaking: boolean;
  fadeInProgress: {
    brow: boolean;
    head: boolean;
  };
}

export type ProsodicEvent =
  | { type: 'START_SPEAKING' }
  | { type: 'STOP_SPEAKING' }
  | { type: 'PULSE'; wordIndex: number }
  | { type: 'LOAD_BROW'; data: any }
  | { type: 'LOAD_HEAD'; data: any }
  | { type: 'FADE_BROW_COMPLETE' }
  | { type: 'FADE_HEAD_COMPLETE' }
  | { type: 'SET_BROW_INTENSITY'; intensity: number }
  | { type: 'SET_HEAD_INTENSITY'; intensity: number }
  | { type: 'STOP_IMMEDIATE' };

// ---------- Helper Functions ----------

function normalizeSnippet(data: any, category: 'brow' | 'head', priority: number): ProsodicSnippet | null {
  if (!data) return null;

  // Normalize curves
  const curves: Record<string, Array<{ time: number; intensity: number }>> = {};
  if (data.curves && typeof data.curves === 'object') {
    Object.entries<any[]>(data.curves).forEach(([key, arr]) => {
      if (Array.isArray(arr)) {
        curves[key] = arr.map((k: any) => ({
          time: k.time ?? k.t ?? 0,
          intensity: k.intensity ?? k.v ?? 0,
        }));
        curves[key].sort((a, b) => a.time - b.time);
      }
    });
  }

  // Calculate duration from keyframes
  let duration = 0;
  Object.values(curves).forEach(arr => {
    if (arr.length > 0) {
      const lastTime = arr[arr.length - 1].time;
      if (lastTime > duration) duration = lastTime;
    }
  });

  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

  return {
    name: data.name ?? `${category}_${Date.now()}`,
    curves,
    category,
    priority,
    intensityScale: data.snippetIntensityScale ?? 1.0,
    isPlaying: false,
    loop: true, // Prosodic loops are always looping
    currentTime: 0,
    startWallTime: now,
    duration,
    playbackRate: data.snippetPlaybackRate ?? 1.0,
  };
}

// ---------- Machine ----------

export const prosodicMachine = createMachine({
  id: 'prosodicMachine',
  initial: 'idle',

  types: {
    context: {} as ProsodicContext,
    events: {} as ProsodicEvent,
  },

  context: {
    browSnippet: null,
    headSnippet: null,
    isSpeaking: false,
    fadeInProgress: {
      brow: false,
      head: false,
    },
  },

  states: {
    idle: {
      on: {
        START_SPEAKING: {
          target: 'speaking',
          actions: 'activateBothChannels',
        },
        LOAD_BROW: { actions: 'loadBrow' },
        LOAD_HEAD: { actions: 'loadHead' },
      },
    },

    speaking: {
      on: {
        STOP_SPEAKING: {
          target: 'fading',
          actions: 'markFadingStart',
        },
        PULSE: { actions: 'handlePulse' },
        SET_BROW_INTENSITY: { actions: 'setBrowIntensity' },
        SET_HEAD_INTENSITY: { actions: 'setHeadIntensity' },
        STOP_IMMEDIATE: {
          target: 'idle',
          actions: 'stopImmediate',
        },
      },
    },

    fading: {
      on: {
        FADE_BROW_COMPLETE: { actions: 'markBrowFadeComplete' },
        FADE_HEAD_COMPLETE: { actions: 'markHeadFadeComplete' },
        START_SPEAKING: {
          target: 'speaking',
          actions: 'activateBothChannels',
        },
        STOP_IMMEDIATE: {
          target: 'idle',
          actions: 'stopImmediate',
        },
      },

      always: {
        target: 'idle',
        guard: 'bothFadesComplete',
      },
    },
  },
}, {
  actions: {
    loadBrow: assign(({ context, event }) => {
      if (event.type !== 'LOAD_BROW') return {};
      const snippet = normalizeSnippet(event.data, 'brow', event.data?.priority ?? 2);
      return { browSnippet: snippet };
    }),

    loadHead: assign(({ context, event }) => {
      if (event.type !== 'LOAD_HEAD') return {};
      const snippet = normalizeSnippet(event.data, 'head', event.data?.priority ?? 2);
      return { headSnippet: snippet };
    }),

    activateBothChannels: assign(({ context }) => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const browSnippet = context.browSnippet ? {
        ...context.browSnippet,
        isPlaying: true,
        currentTime: 0,
        startWallTime: now,
        intensityScale: 1.0,
      } : null;

      const headSnippet = context.headSnippet ? {
        ...context.headSnippet,
        isPlaying: true,
        currentTime: 0,
        startWallTime: now,
        intensityScale: 1.0,
      } : null;

      return {
        browSnippet,
        headSnippet,
        isSpeaking: true,
        fadeInProgress: { brow: false, head: false },
      };
    }),

    markFadingStart: assign(() => ({
      isSpeaking: false,
      fadeInProgress: { brow: true, head: true },
    })),

    markBrowFadeComplete: assign(({ context }) => ({
      fadeInProgress: { ...context.fadeInProgress, brow: false },
      browSnippet: context.browSnippet ? {
        ...context.browSnippet,
        isPlaying: false,
        intensityScale: 0,
      } : null,
    })),

    markHeadFadeComplete: assign(({ context }) => ({
      fadeInProgress: { ...context.fadeInProgress, head: false },
      headSnippet: context.headSnippet ? {
        ...context.headSnippet,
        isPlaying: false,
        intensityScale: 0,
      } : null,
    })),

    handlePulse: assign(({ context, event }) => {
      if (event.type !== 'PULSE') return {};

      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const wordIndex = event.wordIndex;

      // Reset brow on every word
      const browSnippet = context.browSnippet ? {
        ...context.browSnippet,
        currentTime: 0,
        startWallTime: now,
      } : null;

      // Reset head every second word
      const headSnippet = context.headSnippet && wordIndex % 2 === 1 ? {
        ...context.headSnippet,
        currentTime: 0,
        startWallTime: now,
      } : context.headSnippet;

      return { browSnippet, headSnippet };
    }),

    setBrowIntensity: assign(({ context, event }) => {
      if (event.type !== 'SET_BROW_INTENSITY') return {};
      return {
        browSnippet: context.browSnippet ? {
          ...context.browSnippet,
          intensityScale: Math.max(0, Math.min(1, event.intensity)),
        } : null,
      };
    }),

    setHeadIntensity: assign(({ context, event }) => {
      if (event.type !== 'SET_HEAD_INTENSITY') return {};
      return {
        headSnippet: context.headSnippet ? {
          ...context.headSnippet,
          intensityScale: Math.max(0, Math.min(1, event.intensity)),
        } : null,
      };
    }),

    stopImmediate: assign(() => ({
      browSnippet: null,
      headSnippet: null,
      isSpeaking: false,
      fadeInProgress: { brow: false, head: false },
    })),
  },

  guards: {
    bothFadesComplete: ({ context }) => {
      return !context.fadeInProgress.brow && !context.fadeInProgress.head;
    },
  },
});
