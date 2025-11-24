/**
 * Blink State Machine
 *
 * XState machine for managing character blinking state.
 * Part of the latticework agency architecture.
 */

import { setup, assign } from 'xstate';
import { BlinkContext, BlinkEvent, DEFAULT_BLINK_STATE } from './types';

export const blinkMachine = setup({
  types: {
    context: {} as BlinkContext,
    events: {} as BlinkEvent,
  },
  actions: {
    enable: assign({
      state: ({ context }) => ({
        ...context.state,
        enabled: true,
      }),
    }),

    disable: assign({
      state: ({ context }) => ({
        ...context.state,
        enabled: false,
      }),
    }),

    setFrequency: assign({
      state: ({ context, event }) => {
        if (event.type !== 'SET_FREQUENCY') return context.state;
        return {
          ...context.state,
          frequency: Math.max(0, Math.min(60, event.frequency)), // Clamp 0-60 BPM
        };
      },
    }),

    setDuration: assign({
      state: ({ context, event }) => {
        if (event.type !== 'SET_DURATION') return context.state;
        return {
          ...context.state,
          duration: Math.max(0.05, Math.min(1.0, event.duration)), // Clamp 0.05-1.0s
        };
      },
    }),

    setIntensity: assign({
      state: ({ context, event }) => {
        if (event.type !== 'SET_INTENSITY') return context.state;
        return {
          ...context.state,
          intensity: Math.max(0, Math.min(1, event.intensity)), // Clamp 0-1
        };
      },
    }),

    setRandomness: assign({
      state: ({ context, event }) => {
        if (event.type !== 'SET_RANDOMNESS') return context.state;
        return {
          ...context.state,
          randomness: Math.max(0, Math.min(1, event.randomness)), // Clamp 0-1
        };
      },
    }),

    setLeftEyeIntensity: assign({
      state: ({ context, event }) => {
        if (event.type !== 'SET_LEFT_EYE_INTENSITY') return context.state;
        const intensity = event.intensity === null
          ? null
          : Math.max(0, Math.min(1, event.intensity));
        return {
          ...context.state,
          leftEyeIntensity: intensity,
        };
      },
    }),

    setRightEyeIntensity: assign({
      state: ({ context, event }) => {
        if (event.type !== 'SET_RIGHT_EYE_INTENSITY') return context.state;
        const intensity = event.intensity === null
          ? null
          : Math.max(0, Math.min(1, event.intensity));
        return {
          ...context.state,
          rightEyeIntensity: intensity,
        };
      },
    }),

    recordBlinkTime: assign({
      lastBlinkTime: () => Date.now(),
      scheduledBlinkCount: ({ context }) => context.scheduledBlinkCount + 1,
    }),

    resetToDefault: assign({
      state: () => ({ ...DEFAULT_BLINK_STATE }),
      lastBlinkTime: null,
      scheduledBlinkCount: 0,
    }),
  },
}).createMachine({
  id: 'blink',
  initial: 'idle',
  context: {
    state: { ...DEFAULT_BLINK_STATE },
    lastBlinkTime: null,
    scheduledBlinkCount: 0,
  },
  states: {
    idle: {
      on: {
        ENABLE: {
          actions: 'enable',
        },
        DISABLE: {
          actions: 'disable',
        },
        SET_FREQUENCY: {
          actions: 'setFrequency',
        },
        SET_DURATION: {
          actions: 'setDuration',
        },
        SET_INTENSITY: {
          actions: 'setIntensity',
        },
        SET_RANDOMNESS: {
          actions: 'setRandomness',
        },
        SET_LEFT_EYE_INTENSITY: {
          actions: 'setLeftEyeIntensity',
        },
        SET_RIGHT_EYE_INTENSITY: {
          actions: 'setRightEyeIntensity',
        },
        TRIGGER_BLINK: {
          actions: 'recordBlinkTime',
        },
        RESET_TO_DEFAULT: {
          actions: 'resetToDefault',
        },
      },
    },
  },
});

export type BlinkMachine = typeof blinkMachine;
