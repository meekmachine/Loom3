/**
 * LipSync Machine (XState)
 * State machine for managing lip-sync animation lifecycle
 * Follows the Animation Agency architecture pattern
 */

import { createMachine, assign } from 'xstate';
import type { VisemeEvent } from './types';

// ---------- Types ----------

export interface LipSyncSnippet {
  name: string;
  word: string;
  visemeTimeline: VisemeEvent[];
  curves: Record<string, Array<{ time: number; intensity: number }>>;
  maxTime: number;
  scheduledName?: string; // Name returned by animation service
}

export interface LipSyncContext {
  snippets: LipSyncSnippet[];
  isSpeaking: boolean;
  wordCount: number;
  config: {
    jawActivation: number;
    lipsyncIntensity: number;
    speechRate: number;
  };
}

export type LipSyncEvent =
  | { type: 'START_SPEECH' }
  | { type: 'PROCESS_WORD'; word: string; wordIndex: number }
  | { type: 'END_SPEECH' }
  | { type: 'SNIPPET_SCHEDULED'; snippetName: string; scheduledName: string }
  | { type: 'SNIPPET_COMPLETED'; snippetName: string }
  | { type: 'UPDATE_CONFIG'; config: Partial<LipSyncContext['config']> }
  | { type: 'STOP_IMMEDIATE' };

// ---------- Machine ----------

export const lipSyncMachine = createMachine({
  id: 'lipSyncMachine',
  initial: 'idle',

  types: {
    context: {} as LipSyncContext,
    events: {} as LipSyncEvent,
  },

  context: {
    snippets: [],
    isSpeaking: false,
    wordCount: 0,
    config: {
      jawActivation: 1.5,
      lipsyncIntensity: 1.0,
      speechRate: 1.0,
    },
  },

  states: {
    idle: {
      on: {
        START_SPEECH: {
          target: 'speaking',
          actions: 'initializeSpeech',
        },
        UPDATE_CONFIG: {
          actions: 'updateConfig',
        },
      },
    },

    speaking: {
      on: {
        PROCESS_WORD: {
          actions: 'processWord',
        },
        SNIPPET_SCHEDULED: {
          actions: 'markSnippetScheduled',
        },
        SNIPPET_COMPLETED: {
          actions: 'removeSnippet',
        },
        END_SPEECH: {
          target: 'ending',
        },
        STOP_IMMEDIATE: {
          target: 'idle',
          actions: 'cleanup',
        },
        UPDATE_CONFIG: {
          actions: 'updateConfig',
        },
      },
    },

    ending: {
      entry: 'prepareNeutralReturn',
      on: {
        SNIPPET_COMPLETED: {
          actions: 'removeSnippet',
        },
      },
      always: {
        target: 'idle',
        guard: 'allSnippetsCompleted',
        actions: 'cleanup',
      },
    },
  },
}, {
  actions: {
    initializeSpeech: assign({
      isSpeaking: true,
      wordCount: 0,
      snippets: [],
    }),

    processWord: assign(({ context, event }) => {
      if (event.type !== 'PROCESS_WORD') return {};

      // Create placeholder snippet (scheduler will fill in curves)
      const snippet: LipSyncSnippet = {
        name: `lipsync_${event.word.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`,
        word: event.word,
        visemeTimeline: [], // Scheduler will populate
        curves: {},
        maxTime: 0,
      };

      return {
        snippets: [...context.snippets, snippet],
        wordCount: context.wordCount + 1,
      };
    }),

    markSnippetScheduled: assign(({ context, event }) => {
      if (event.type !== 'SNIPPET_SCHEDULED') return {};

      const snippets = context.snippets.map(s =>
        s.name === event.snippetName
          ? { ...s, scheduledName: event.scheduledName }
          : s
      );

      return { snippets };
    }),

    removeSnippet: assign(({ context, event }) => {
      if (event.type !== 'SNIPPET_COMPLETED') return {};

      const snippets = context.snippets.filter(s => s.name !== event.snippetName);
      return { snippets };
    }),

    prepareNeutralReturn: assign({
      isSpeaking: false,
    }),

    cleanup: assign({
      snippets: [],
      isSpeaking: false,
      wordCount: 0,
    }),

    updateConfig: assign(({ context, event }) => {
      if (event.type !== 'UPDATE_CONFIG') return {};

      return {
        config: {
          ...context.config,
          ...event.config,
        },
      };
    }),
  },

  guards: {
    allSnippetsCompleted: ({ context }) => {
      return context.snippets.length === 0;
    },
  },
});
