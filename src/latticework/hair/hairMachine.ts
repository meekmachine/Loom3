/**
 * Hair State Machine
 *
 * XState machine for managing character hair/eyebrow customization state.
 * Part of the latticework agency architecture.
 */

import { setup, assign } from 'xstate';
import { HairContext, HairEvent, DEFAULT_HAIR_STATE, HAIR_COLOR_PRESETS } from './types';

export const hairMachine = setup({
  types: {
    context: {} as HairContext,
    events: {} as HairEvent,
  },
  actions: {
    setHairColor: assign({
      state: ({ context, event }) => {
        if (event.type !== 'SET_HAIR_COLOR') return context.state;
        return {
          ...context.state,
          hairColor: event.color,
        };
      },
    }),

    setEyebrowColor: assign({
      state: ({ context, event }) => {
        if (event.type !== 'SET_EYEBROW_COLOR') return context.state;
        return {
          ...context.state,
          eyebrowColor: event.color,
        };
      },
    }),

    setHairBaseColor: assign({
      state: ({ context, event }) => {
        if (event.type !== 'SET_HAIR_BASE_COLOR') return context.state;
        return {
          ...context.state,
          hairColor: {
            ...context.state.hairColor,
            baseColor: event.baseColor,
          },
        };
      },
    }),

    setEyebrowBaseColor: assign({
      state: ({ context, event }) => {
        if (event.type !== 'SET_EYEBROW_BASE_COLOR') return context.state;
        return {
          ...context.state,
          eyebrowColor: {
            ...context.state.eyebrowColor,
            baseColor: event.baseColor,
          },
        };
      },
    }),

    setHairGlow: assign({
      state: ({ context, event }) => {
        if (event.type !== 'SET_HAIR_GLOW') return context.state;
        return {
          ...context.state,
          hairColor: {
            ...context.state.hairColor,
            emissive: event.emissive,
            emissiveIntensity: event.intensity,
          },
        };
      },
    }),

    setEyebrowGlow: assign({
      state: ({ context, event }) => {
        if (event.type !== 'SET_EYEBROW_GLOW') return context.state;
        return {
          ...context.state,
          eyebrowColor: {
            ...context.state.eyebrowColor,
            emissive: event.emissive,
            emissiveIntensity: event.intensity,
          },
        };
      },
    }),

    setOutline: assign({
      state: ({ context, event }) => {
        if (event.type !== 'SET_OUTLINE') return context.state;
        return {
          ...context.state,
          showOutline: event.show,
          outlineColor: event.color ?? context.state.outlineColor,
          outlineOpacity: event.opacity ?? context.state.outlineOpacity,
        };
      },
    }),

    setPartVisibility: assign({
      state: ({ context, event }) => {
        if (event.type !== 'SET_PART_VISIBILITY') return context.state;
        return {
          ...context.state,
          parts: {
            ...context.state.parts,
            [event.partName]: {
              ...(context.state.parts[event.partName] || { name: event.partName, visible: true }),
              visible: event.visible,
            },
          },
        };
      },
    }),

    setPartScale: assign({
      state: ({ context, event }) => {
        if (event.type !== 'SET_PART_SCALE') return context.state;
        return {
          ...context.state,
          parts: {
            ...context.state.parts,
            [event.partName]: {
              ...(context.state.parts[event.partName] || { name: event.partName, visible: true }),
              scale: event.scale,
            },
          },
        };
      },
    }),

    setPartPosition: assign({
      state: ({ context, event }) => {
        if (event.type !== 'SET_PART_POSITION') return context.state;
        return {
          ...context.state,
          parts: {
            ...context.state.parts,
            [event.partName]: {
              ...(context.state.parts[event.partName] || { name: event.partName, visible: true }),
              position: event.position,
            },
          },
        };
      },
    }),

    resetToDefault: assign({
      state: () => ({ ...DEFAULT_HAIR_STATE }),
    }),
  },
}).createMachine({
  id: 'hair',
  initial: 'idle',
  context: {
    state: { ...DEFAULT_HAIR_STATE },
    objects: [],
  },
  states: {
    idle: {
      on: {
        SET_HAIR_COLOR: {
          actions: 'setHairColor',
        },
        SET_EYEBROW_COLOR: {
          actions: 'setEyebrowColor',
        },
        SET_HAIR_BASE_COLOR: {
          actions: 'setHairBaseColor',
        },
        SET_EYEBROW_BASE_COLOR: {
          actions: 'setEyebrowBaseColor',
        },
        SET_HAIR_GLOW: {
          actions: 'setHairGlow',
        },
        SET_EYEBROW_GLOW: {
          actions: 'setEyebrowGlow',
        },
        SET_OUTLINE: {
          actions: 'setOutline',
        },
        SET_PART_VISIBILITY: {
          actions: 'setPartVisibility',
        },
        SET_PART_SCALE: {
          actions: 'setPartScale',
        },
        SET_PART_POSITION: {
          actions: 'setPartPosition',
        },
        RESET_TO_DEFAULT: {
          actions: 'resetToDefault',
        },
      },
    },
  },
});

export type HairMachine = typeof hairMachine;
