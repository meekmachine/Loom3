/**
 * Eye Tracking State Machine
 * Manages eye gaze direction, saccades, smooth pursuit, and blinking
 */

import { createMachine, assign } from 'xstate';
import type { GazeTarget } from './types';

export interface EyeTrackingContext {
  currentGaze: GazeTarget;
  targetGaze: GazeTarget;
  eyeIntensity: number;
  lastBlinkTime: number;
  blinkInterval: number; // ms between blinks
  saccadeSpeed: number; // 0-1
  smoothPursuit: boolean;
}

export type EyeTrackingEvent =
  | { type: 'SET_GAZE'; target: GazeTarget }
  | { type: 'BLINK' }
  | { type: 'START_TRACKING' }
  | { type: 'STOP_TRACKING' }
  | { type: 'SACCADE_COMPLETE' }
  | { type: 'UPDATE_CONFIG'; config: Partial<EyeTrackingContext> };

/**
 * Eye Tracking State Machine
 * States: idle -> tracking -> (saccade | smooth_pursuit) -> tracking -> idle
 */
export const eyeTrackingMachine = createMachine(
  {
    id: 'eyeTracking',
    initial: 'idle',

    types: {
      context: {} as EyeTrackingContext,
      events: {} as EyeTrackingEvent,
    },

    context: {
      currentGaze: { x: 0, y: 0, z: 0 },
      targetGaze: { x: 0, y: 0, z: 0 },
      eyeIntensity: 0,
      lastBlinkTime: 0,
      blinkInterval: 3500, // ~17 blinks/min
      saccadeSpeed: 0.7,
      smoothPursuit: false,
    },

    states: {
      idle: {
        on: {
          START_TRACKING: { target: 'tracking' },
          SET_GAZE: { target: 'tracking', actions: 'setTargetGaze' },
          UPDATE_CONFIG: { actions: 'updateConfig' },
        },
      },

      tracking: {
        on: {
          STOP_TRACKING: { target: 'idle' },
          SET_GAZE: [
            {
              guard: 'useSmoothPursuit',
              target: 'smoothPursuit',
              actions: 'setTargetGaze',
            },
            {
              target: 'saccade',
              actions: 'setTargetGaze',
            },
          ],
          BLINK: { target: 'blinking' },
          UPDATE_CONFIG: { actions: 'updateConfig' },
        },

        // Auto-blink behavior
        after: {
          blinkTimer: { target: 'blinking' },
        },
      },

      saccade: {
        entry: 'startSaccade',
        on: {
          SACCADE_COMPLETE: { target: 'tracking', actions: 'completeSaccade' },
          STOP_TRACKING: { target: 'idle' },
          SET_GAZE: { actions: 'setTargetGaze' },
          UPDATE_CONFIG: { actions: 'updateConfig' },
        },

        // Saccades are fast (50-200ms depending on distance)
        after: {
          saccadeDuration: { target: 'tracking', actions: 'completeSaccade' },
        },
      },

      smoothPursuit: {
        entry: 'startSmoothPursuit',
        on: {
          STOP_TRACKING: { target: 'idle' },
          SET_GAZE: { actions: 'updateTargetGaze' },
          UPDATE_CONFIG: { actions: 'updateConfig' },
        },

        // Smooth pursuit continues until gaze reached
        invoke: {
          src: 'smoothPursuitLoop',
          onDone: { target: 'tracking' },
        },
      },

      blinking: {
        entry: 'startBlink',
        on: {
          STOP_TRACKING: { target: 'idle' },
          UPDATE_CONFIG: { actions: 'updateConfig' },
        },

        // Blink duration (100-400ms, typically ~150ms)
        after: {
          150: { target: 'tracking', actions: 'completeBlink' },
        },
      },
    },
  },
  {
    actions: {
      setTargetGaze: assign(({ context, event }) => {
        if (event.type !== 'SET_GAZE') return {};
        return {
          targetGaze: event.target,
        };
      }),

      updateTargetGaze: assign(({ context, event }) => {
        if (event.type !== 'SET_GAZE') return {};
        return {
          targetGaze: event.target,
        };
      }),

      updateConfig: assign(({ context, event }) => {
        if (event.type !== 'UPDATE_CONFIG') return {};
        return event.config;
      }),

      startSaccade: assign(({ context }) => {
        return {
          eyeIntensity: 1.0,
        };
      }),

      completeSaccade: assign(({ context }) => {
        return {
          currentGaze: context.targetGaze,
          eyeIntensity: 0.8,
        };
      }),

      startSmoothPursuit: assign(({ context }) => {
        return {
          eyeIntensity: 0.9,
        };
      }),

      startBlink: assign(({ context }) => {
        const now = Date.now();
        return {
          lastBlinkTime: now,
          eyeIntensity: 0,
        };
      }),

      completeBlink: assign(({ context }) => {
        return {
          eyeIntensity: 0.8,
        };
      }),
    },

    guards: {
      useSmoothPursuit: ({ context }) => {
        return context.smoothPursuit;
      },
    },

    delays: {
      blinkTimer: ({ context }) => {
        return context.blinkInterval;
      },

      saccadeDuration: ({ context }) => {
        // Saccade duration based on distance (50-200ms)
        // Simplified: use speed setting
        return Math.max(50, Math.min(200, 150 / context.saccadeSpeed));
      },
    },
  }
);
